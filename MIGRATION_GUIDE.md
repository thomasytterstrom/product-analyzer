## 0. Automated Data Migration (Recommended)

I have created a dedicated script to migrate your data from local SQLite files (like those in `apps/api/data`) directly to Supabase.

1.  **Configure `.env`**: Ensure `DATABASE_URL`, `SOURCE_DB_PATH`, and `METADATA_DB_PATH` are set.
2.  **Run Migration**:
    ```bash
    npx tsx scripts/migrate-to-supabase.ts
    ```
This will automatically migrate your Configuration Fields and Snapshots to the remote database.

# PostgreSQL Migration Guide for Product Analyzer

If you choose to host the metadata database on a free PostgreSQL service like Supabase or Neon instead of a persistent SQLite file on Render/Railway, you will need to migrate the API logic from `better-sqlite3` to a PostgreSQL client.

This guide outlines the necessary changes.

## 1. Install Dependencies

You'll need a PostgreSQL client. We recommend `pg` and `postgres` (or `@supabase/supabase-js` if using Supabase specifically).

```bash
npm install --workspace=@product-analyzer/api pg
npm install --workspace=@product-analyzer/api -D @types/pg
```

## 2. SQL Syntax Differences

When converting SQLite queries to PostgreSQL:

### Table Creation
**SQLite:**
```sql
CREATE TABLE IF NOT EXISTS configuration_fields (
  configuration_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  tracked INTEGER NOT NULL,
  friendly_name TEXT,
  PRIMARY KEY (configuration_id, field_key)
)
```

**PostgreSQL:**
```sql
CREATE TABLE IF NOT EXISTS configuration_fields (
  configuration_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  tracked BOOLEAN NOT NULL,  -- Note BOOLEAN instead of INTEGER
  friendly_name TEXT,
  PRIMARY KEY (configuration_id, field_key)
)
```

### Upsert (Insert or Update)
**SQLite:**
```sql
INSERT INTO configuration_fields (configuration_id, field_key, tracked, friendly_name)
VALUES (?, ?, ?, ?)
ON CONFLICT (configuration_id, field_key) DO UPDATE SET
  tracked = excluded.tracked,
  friendly_name = excluded.friendly_name
```

**PostgreSQL:**
```sql
INSERT INTO configuration_fields (configuration_id, field_key, tracked, friendly_name)
VALUES ($1, $2, $3, $4)
ON CONFLICT (configuration_id, field_key) DO UPDATE SET
  tracked = EXCLUDED.tracked,
  friendly_name = EXCLUDED.friendly_name
```

## 3. Code Migration (`apps/api/src/db/metadataDb.ts`)

Replace the `better-sqlite3` connection with a `pg` Pool.

```typescript
import { Pool } from 'pg';

export function openMetadataDb(opts: { connectionString: string }) {
  const pool = new Pool({
    connectionString: opts.connectionString,
    ssl: { rejectUnauthorized: false } // Usually required for Supabase/Neon
  });

  // Run migrations
  pool.query(`
    CREATE TABLE IF NOT EXISTS configuration_fields (
      configuration_id TEXT NOT NULL,
      field_key TEXT NOT NULL,
      tracked BOOLEAN NOT NULL,
      friendly_name TEXT,
      PRIMARY KEY (configuration_id, field_key)
    )
  `).catch(console.error);

  return {
    async listConfigurationFields({ configurationId }: { configurationId: string }) {
      const { rows } = await pool.query(
        'SELECT * FROM configuration_fields WHERE configuration_id = $1',
        [configurationId]
      );
      return rows.map(r => ({
        configurationId: r.configuration_id,
        fieldKey: r.field_key,
        tracked: Boolean(r.tracked),
        friendlyName: r.friendly_name
      }));
    },

    async upsertConfigurationFields(opts: {
      configurationId: string;
      fields: Array<{ fieldKey: string; tracked: boolean; friendlyName?: string | null }>;
    }) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Example: simple loop for upsert (in production you might batch this)
        for (const f of opts.fields) {
          await client.query(`
            INSERT INTO configuration_fields (configuration_id, field_key, tracked, friendly_name)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (configuration_id, field_key) DO UPDATE SET
              tracked = EXCLUDED.tracked,
              friendly_name = EXCLUDED.friendly_name
          `, [
            opts.configurationId,
            f.fieldKey,
            f.tracked,
            f.friendlyName || null
          ]);
        }
        
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },

    async close() {
      await pool.end();
    }
  };
}
```

## 4. Note on API Changes

If you make these database functions asynchronous (`async/await`), you will also need to update the Fastify route handlers in `server.ts` to `await` the database calls (if they aren't already).