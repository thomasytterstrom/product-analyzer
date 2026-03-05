import Database from "better-sqlite3";

export type ConfigurationFieldRow = {
  configurationId: string;
  fieldKey: string;
  tracked: boolean;
  friendlyName: string | null;
};

export type OpenMetadataDbOptions = {
  dbPath: string;
};

export type MetadataDb = {
  upsertConfigurationFields(input: {
    configurationId: string;
    fields: Array<{ fieldKey: string; tracked: boolean; friendlyName?: string | null }>;
  }): Promise<void>;
  listConfigurationFields(input: { configurationId: string }): Promise<ConfigurationFieldRow[]>;
  close(): Promise<void>;
};

function nowUtcIso() {
  return new Date().toISOString();
}

export function openMetadataDb(opts: OpenMetadataDbOptions): MetadataDb {
  const db = new Database(opts.dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS ConfigurationField (
      configurationId TEXT NOT NULL,
      fieldKey TEXT NOT NULL,
      friendlyName TEXT NULL,
      tracked INTEGER NOT NULL DEFAULT 0,
      createdUtc TEXT NOT NULL,
      updatedUtc TEXT NOT NULL,
      PRIMARY KEY (configurationId, fieldKey)
    );
  `);

  const upsertStmt = db.prepare(`
    INSERT INTO ConfigurationField (configurationId, fieldKey, friendlyName, tracked, createdUtc, updatedUtc)
    VALUES (@configurationId, @fieldKey, @friendlyName, @tracked, @createdUtc, @updatedUtc)
    ON CONFLICT(configurationId, fieldKey)
    DO UPDATE SET
      friendlyName = excluded.friendlyName,
      tracked = excluded.tracked,
      updatedUtc = excluded.updatedUtc
  `);

  const listStmt = db.prepare(`
    SELECT configurationId, fieldKey, friendlyName, tracked
    FROM ConfigurationField
    WHERE configurationId = ?
    ORDER BY fieldKey
  `);

  return {
    async upsertConfigurationFields({ configurationId, fields }) {
      const ts = nowUtcIso();
      const tx = db.transaction(() => {
        for (const f of fields) {
          if (!f.fieldKey) continue;
          upsertStmt.run({
            configurationId,
            fieldKey: f.fieldKey,
            friendlyName: f.friendlyName ?? null,
            tracked: f.tracked ? 1 : 0,
            createdUtc: ts,
            updatedUtc: ts
          });
        }
      });

      tx();
    },

    async listConfigurationFields({ configurationId }) {
      return listStmt.all(configurationId).map((r: any) => ({
        configurationId: String(r.configurationId),
        fieldKey: String(r.field_key || r.fieldKey),
        friendlyName: r.friendlyName === null || typeof r.friendlyName === "string" ? r.friendlyName : String(r.friendlyName),
        tracked: Boolean(r.tracked)
      }));
    },

    async close() {
      db.close();
    }
  };
}
