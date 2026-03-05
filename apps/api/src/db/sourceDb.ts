import Database from "better-sqlite3";

export type SourceSnapshotRow = {
  deviceSnapshotId: string;
  snapshotId: string;
  timeStampUtc: string;
};

export type SourceSnapshotHeader = {
  deviceSnapshotId: string;
  productNumber: string;
  serialNumber: string;
  snapshotId: string;
  timeStampUtc: string;
};

export type OpenSourceDbOptions = {
  dbPath: string;
  /** Default: true */
  readonly?: boolean;
};

export type SourceDb = {
  listProductNumbers(): Promise<string[]>;
  listSerialNumbers(productNumber: string): Promise<string[]>;
  listSnapshots(input: { productNumber: string; serialNumber: string }): Promise<SourceSnapshotRow[]>;
  getSnapshotHeader(input: { deviceSnapshotId: string }): Promise<SourceSnapshotHeader>;
  getSnapshotJson(input: { deviceSnapshotId: string }): Promise<string>;
  close(): Promise<void>;
};

export function openSourceDb(opts: OpenSourceDbOptions): SourceDb {
  const db = new Database(opts.dbPath, {
    readonly: opts.readonly ?? true,
    fileMustExist: true
  });

  const listProductNumbersStmt = db.prepare(
    "SELECT DISTINCT ProductNumber as productNumber FROM DeviceSnapshot ORDER BY ProductNumber"
  );

  const listSerialNumbersStmt = db.prepare(
    "SELECT DISTINCT SerialNumber as serialNumber FROM DeviceSnapshot WHERE ProductNumber = ? ORDER BY SerialNumber"
  );

  const listSnapshotsStmt = db.prepare(
    "SELECT Id as deviceSnapshotId, SnapshotId as snapshotId, TimeStampUtc as timeStampUtc FROM DeviceSnapshot WHERE ProductNumber = ? AND SerialNumber = ? ORDER BY TimeStampUtc DESC"
  );

  const getSnapshotHeaderStmt = db.prepare(
    "SELECT Id as deviceSnapshotId, ProductNumber as productNumber, SerialNumber as serialNumber, SnapshotId as snapshotId, TimeStampUtc as timeStampUtc FROM DeviceSnapshot WHERE Id = ?"
  );

  return {
    async listProductNumbers() {
      return listProductNumbersStmt
        .all()
        .map((r: any) => r.productNumber)
        .filter((v: unknown): v is string => typeof v === "string" && v.length > 0);
    },

    async listSerialNumbers(productNumber: string) {
      return listSerialNumbersStmt
        .all(productNumber)
        .map((r: any) => r.serialNumber)
        .filter((v: unknown): v is string => typeof v === "string" && v.length > 0);
    },

    async listSnapshots({ productNumber, serialNumber }) {
      return listSnapshotsStmt
        .all(productNumber, serialNumber)
        .map(
          (r: any): SourceSnapshotRow => ({
            deviceSnapshotId: String(r.deviceSnapshotId),
            snapshotId: String(r.snapshotId),
            timeStampUtc: String(r.timeStampUtc)
          })
        );
    },

    async getSnapshotHeader({ deviceSnapshotId }) {
      const row = getSnapshotHeaderStmt.get(deviceSnapshotId) as
        | {
            deviceSnapshotId?: unknown;
            productNumber?: unknown;
            serialNumber?: unknown;
            snapshotId?: unknown;
            timeStampUtc?: unknown;
          }
        | undefined;

      if (!row) {
        throw new Error(`Snapshot not found: DeviceSnapshotId=${deviceSnapshotId}`);
      }

      return {
        deviceSnapshotId: String(row.deviceSnapshotId),
        productNumber: String(row.productNumber),
        serialNumber: String(row.serialNumber),
        snapshotId: String(row.snapshotId),
        timeStampUtc: String(row.timeStampUtc)
      };
    },

    async getSnapshotJson({ deviceSnapshotId }) {
      const getSnapshotJsonStmt = db.prepare(
        "SELECT Json as json FROM DeviceSnapshotJson WHERE DeviceSnapshotId = ?"
      );

      const row = getSnapshotJsonStmt.get(deviceSnapshotId) as { json?: unknown } | undefined;
      if (!row || typeof row.json !== "string") {
        throw new Error(`Snapshot JSON not found for DeviceSnapshotId=${deviceSnapshotId}`);
      }
      return row.json;
    },

    async close() {
      db.close();
    }
  };
}
