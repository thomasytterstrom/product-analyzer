import Database from "better-sqlite3";
import pg from "pg";
const { Client } = pg;

export interface MigrationResult {
  success: boolean;
  metadataMigrated: number;
  snapshotsMigrated: number;
  errors: string[];
}

/**
 * Core migration logic: SQLite -> Supabase (Postgres)
 */
export async function runMigration(params: {
  databaseUrl: string;
  sourceDbPath: string;
  metadataDbPath: string;
}): Promise<MigrationResult> {
  const { databaseUrl, sourceDbPath, metadataDbPath } = params;
  const result: MigrationResult = {
    success: true,
    metadataMigrated: 0,
    snapshotsMigrated: 0,
    errors: [],
  };

  const pgClient = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pgClient.connect();

    // 1. Migrate Metadata
    try {
      console.log(`\n📦 Migrating Metadata from ${metadataDbPath}...`);
      const metaDb = new Database(metadataDbPath, { fileMustExist: true });
      const rows = metaDb.prepare("SELECT * FROM ConfigurationField").all() as any[];

      for (const row of rows) {
        await pgClient.query(
          `
          INSERT INTO configuration_field (configuration_id, field_key, friendly_name, tracked, created_utc, updated_utc)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (configuration_id, field_key) DO UPDATE SET
            friendly_name = EXCLUDED.friendly_name,
            tracked = EXCLUDED.tracked,
            updated_utc = EXCLUDED.updated_utc
        `,
          [
            row.configurationId,
            row.fieldKey,
            row.friendlyName,
            row.tracked === 1,
            row.createdUtc,
            row.updatedUtc,
          ]
        );
      }
      result.metadataMigrated = rows.length;
      metaDb.close();
      console.log(`✅ Successfully migrated ${rows.length} metadata entries.`);
    } catch (e: any) {
      const msg = `Metadata migration skipped: ${e.message}`;
      console.warn(`⚠️ ${msg}`);
      result.errors.push(msg);
    }

    // 2. Migrate Snapshots (Source DB)
    try {
      console.log(`\n📸 Migrating Snapshots from ${sourceDbPath}...`);
      const sourceDb = new Database(sourceDbPath, { fileMustExist: true });

      // Migrate DeviceSnapshot headers
      const snapshots = sourceDb.prepare("SELECT * FROM DeviceSnapshot").all() as any[];
      for (const s of snapshots) {
        await pgClient.query(
          `
          INSERT INTO device_snapshot (id, snapshot_id, product_number, serial_number, time_stamp_utc)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO NOTHING
        `,
          [s.Id, s.SnapshotId, s.ProductNumber, s.SerialNumber, s.TimeStampUtc]
        );
      }

      // Migrate DeviceSnapshotJson (the big data)
      const snapshotJsons = sourceDb.prepare("SELECT * FROM DeviceSnapshotJson").all() as any[];
      for (const sj of snapshotJsons) {
        await pgClient.query(
          `
          INSERT INTO device_snapshot_json (device_snapshot_id, json)
          VALUES ($1, $2)
          ON CONFLICT (device_snapshot_id) DO NOTHING
        `,
          [sj.DeviceSnapshotId, sj.Json]
        );
      }

      result.snapshotsMigrated = snapshots.length;
      sourceDb.close();
      console.log(`✅ Successfully migrated ${snapshots.length} snapshots.`);
    } catch (e: any) {
      const msg = `Snapshot migration skipped: ${e.message}`;
      console.warn(`⚠️ ${msg}`);
      result.errors.push(msg);
    }
  } catch (error: any) {
    result.success = false;
    result.errors.push(`Critical connection error: ${error.message}`);
    throw error;
  } finally {
    await pgClient.end();
  }

  return result;
}
