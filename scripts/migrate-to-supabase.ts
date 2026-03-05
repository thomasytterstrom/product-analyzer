import 'dotenv/config';
import { runMigration } from '../apps/api/src/services/migration.service.js';

/**
 * Migration Script: SQLite -> Supabase (PostgreSQL)
 * 
 * This script copies data from your local SQLite files to your remote Supabase instance.
 */

const SOURCE_DB_PATH = process.env.SOURCE_DB_PATH || 'apps/api/data/source.db';
const METADATA_DB_PATH = process.env.METADATA_DB_PATH || 'apps/api/data/product-analyzer-metadata.db';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ Error: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

async function migrate() {
  console.log("🚀 Starting migration to Supabase via script...");

  try {
    const result = await runMigration({
      databaseUrl: DATABASE_URL!,
      sourceDbPath: SOURCE_DB_PATH,
      metadataDbPath: METADATA_DB_PATH
    });

    if (result.errors.length > 0) {
      console.warn("\n⚠️ Migration finished with warnings:", result.errors);
    }

    console.log(`\n✅ Successfully migrated ${result.metadataMigrated} metadata entries.`);
    console.log(`✅ Successfully migrated ${result.snapshotsMigrated} snapshots.`);
    console.log("\n✨ Migration complete!");
  } catch (error: any) {
    console.error("\n❌ Migration failed critically:", error.message);
    process.exit(1);
  }
}

migrate();
