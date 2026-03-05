import pg from "pg";
const { Pool } = pg;
import { MetadataDb, ConfigurationFieldRow } from "./metadataDb.js";

export function openMetadataDbPostgres(opts: { connectionString: string }): MetadataDb {
  const pool = new Pool({
    connectionString: opts.connectionString,
    ssl: { rejectUnauthorized: false }
  });

  return {
    async upsertConfigurationFields({ configurationId, fields }) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const f of fields) {
          if (!f.fieldKey) continue;
          await client.query(`
            INSERT INTO configuration_field (configuration_id, field_key, friendly_name, tracked, updated_utc)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (configuration_id, field_key) DO UPDATE SET
              friendly_name = EXCLUDED.friendly_name,
              tracked = EXCLUDED.tracked,
              updated_utc = NOW()
          `, [configurationId, f.fieldKey, f.friendlyName ?? null, f.tracked]);
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },

    async listConfigurationFields({ configurationId }) {
      const { rows } = await pool.query(
        "SELECT configuration_id, field_key, friendly_name, tracked FROM configuration_field WHERE configuration_id = $1 ORDER BY field_key",
        [configurationId]
      );
      
      return rows.map(r => ({
        configurationId: String(r.configuration_id),
        fieldKey: String(r.field_key),
        friendlyName: r.friendly_name,
        tracked: Boolean(r.tracked)
      }));
    },

    async close() {
      await pool.end();
    }
  };
}
