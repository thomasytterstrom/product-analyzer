import Database from "better-sqlite3";

export type SourceSnapshotRow = {
  deviceSnapshotId: string;
  snapshotId: string;
  timeStampUtc: string;
};

export type OpenSourceDbOptions = {
  dbPath: string;
  /** Default: true */
  readonly?: boolean;
};

export type SourceDb = {
  listProductNumbers(): string[];
  listSerialNumbers(productNumber: string): string[];
  listSnapshots(input: { productNumber: string; serialNumber: string }): SourceSnapshotRow[];
  getSnapshotJson(input: { deviceSnapshotId: string }): string;
  close(): void;
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

  const getSnapshotJsonStmt = db.prepare(
    "SELECT Json as json FROM DeviceSnapshotJson WHERE DeviceSnapshotId = ?"
  );

  return {
    listProductNumbers() {
      return listProductNumbersStmt
        .all()
        .map((r: any) => r.productNumber)
        .filter((v: unknown): v is string => typeof v === "string" && v.length > 0);
    },

    listSerialNumbers(productNumber: string) {
      return listSerialNumbersStmt
        .all(productNumber)
        .map((r: any) => r.serialNumber)
        .filter((v: unknown): v is string => typeof v === "string" && v.length > 0);
    },

    listSnapshots({ productNumber, serialNumber }) {
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

    getSnapshotJson({ deviceSnapshotId }) {
      const row = getSnapshotJsonStmt.get(deviceSnapshotId) as { json?: unknown } | undefined;
      if (!row || typeof row.json !== "string") {
        throw new Error(`Snapshot JSON not found for DeviceSnapshotId=${deviceSnapshotId}`);
      }
      return row.json;
    },

    close() {
      db.close();
    }
  };
}
