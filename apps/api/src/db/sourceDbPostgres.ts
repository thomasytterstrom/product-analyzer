import pg from "pg";
const { Pool } = pg;
import { SourceDb, SourceSnapshotRow, SourceSnapshotHeader } from "./sourceDb.js";

export function openSourceDbPostgres(opts: { connectionString: string }): SourceDb {
  const pool = new Pool({
    connectionString: opts.connectionString,
    ssl: { rejectUnauthorized: false }
  });

  return {
    async listProductNumbers() {
      const { rows } = await pool.query(
        "SELECT DISTINCT product_number as productNumber FROM device_snapshot ORDER BY product_number"
      );
      return rows.map(r => r.productnumber);
    },

    async listSerialNumbers(productNumber: string) {
      const { rows } = await pool.query(
        "SELECT DISTINCT serial_number as serialNumber FROM device_snapshot WHERE product_number = $1 ORDER BY serial_number",
        [productNumber]
      );
      return rows.map(r => r.serialnumber);
    },

    async listSnapshots({ productNumber, serialNumber }) {
      const { rows } = await pool.query(
        "SELECT id as deviceSnapshotId, snapshot_id as snapshotId, time_stamp_utc as timeStampUtc FROM device_snapshot WHERE product_number = $1 AND serial_number = $2 ORDER BY time_stamp_utc DESC",
        [productNumber, serialNumber]
      );
      return rows.map(r => ({
        deviceSnapshotId: String(r.devicesnapshotid),
        snapshotId: String(r.snapshotid),
        timeStampUtc: String(r.timestamputc)
      }));
    },

    async getSnapshotHeader({ deviceSnapshotId }) {
      const { rows } = await pool.query(
        "SELECT id as deviceSnapshotId, product_number as productNumber, serial_number as serialNumber, snapshot_id as snapshotId, time_stamp_utc as timeStampUtc FROM device_snapshot WHERE id = $1",
        [deviceSnapshotId]
      );

      const row = rows[0];
      if (!row) {
        throw new Error(`Snapshot not found: DeviceSnapshotId=${deviceSnapshotId}`);
      }

      return {
        deviceSnapshotId: String(row.devicesnapshotid),
        productNumber: String(row.productnumber),
        serialNumber: String(row.serialnumber),
        snapshotId: String(row.snapshotid),
        timeStampUtc: String(row.timestamputc)
      };
    },

    async getSnapshotJson({ deviceSnapshotId }) {
      const { rows } = await pool.query(
        "SELECT json FROM device_snapshot_json WHERE device_snapshot_id = $1",
        [deviceSnapshotId]
      );

      const row = rows[0];
      if (!row || typeof row.json !== "string") {
        throw new Error(`Snapshot JSON not found for DeviceSnapshotId=${deviceSnapshotId}`);
      }
      return row.json;
    },

    async close() {
      await pool.end();
    }
  };
}
