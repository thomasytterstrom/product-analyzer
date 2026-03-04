import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { buildServer } from "../server.js";

function makeTmpDbPath(prefix: string) {
  return path.join(os.tmpdir(), `${prefix}-${randomUUID()}.db`);
}

describe("POST /products/:productNumber/:serialNumber/timeseries", () => {
  it("returns points per requested field across snapshots", async () => {
    const sourceDbPath = makeTmpDbPath("product-analyzer-source");
    const metadataDbPath = makeTmpDbPath("product-analyzer-metadata");

    const seed = new Database(sourceDbPath);
    seed.exec(`
      CREATE TABLE DeviceSnapshot (
        Id TEXT PRIMARY KEY,
        ProductNumber TEXT NOT NULL,
        SerialNumber TEXT NOT NULL,
        SnapshotId TEXT NOT NULL,
        TimeStampUtc TEXT NOT NULL
      );
      CREATE TABLE DeviceSnapshotJson (
        Id TEXT PRIMARY KEY,
        Json TEXT NOT NULL,
        DeviceSnapshotId TEXT NOT NULL
      );
    `);

    seed
      .prepare(
        "INSERT INTO DeviceSnapshot (Id, ProductNumber, SerialNumber, SnapshotId, TimeStampUtc) VALUES (?, ?, ?, ?, ?)"
      )
      .run("ds1", "531285301", "S1", "snap-1", "2026-02-17T07:50:23.000Z");

    seed
      .prepare(
        "INSERT INTO DeviceSnapshot (Id, ProductNumber, SerialNumber, SnapshotId, TimeStampUtc) VALUES (?, ?, ?, ?, ?)"
      )
      .run("ds2", "531285301", "S1", "snap-2", "2026-02-18T07:50:23.000Z");

    seed
      .prepare("INSERT INTO DeviceSnapshotJson (Id, Json, DeviceSnapshotId) VALUES (?, ?, ?)")
      .run(
        "j1",
        JSON.stringify({ ConfigurationId: "cfg-1", FirmwareVersion: "A" }),
        "ds1"
      );

    seed
      .prepare("INSERT INTO DeviceSnapshotJson (Id, Json, DeviceSnapshotId) VALUES (?, ?, ?)")
      .run(
        "j2",
        JSON.stringify({ ConfigurationId: "cfg-1", FirmwareVersion: "B" }),
        "ds2"
      );

    seed.close();

    const app = buildServer({ sourceDbPath, metadataDbPath });

    const res = await app.inject({
      method: "POST",
      url: "/products/531285301/S1/timeseries",
      headers: { "content-type": "application/json" },
      payload: {
        snapshotIds: ["ds1", "ds2"],
        fieldKeys: ["root/FirmwareVersion"]
      }
    });

    expect(res.statusCode).toBe(200);

    const body = res.json() as Array<{
      fieldKey: string;
      points: Array<{
        deviceSnapshotId: string;
        timeStampUtc: string;
        valueText: string | null;
        valueType: string | null;
      }>;
    }>;

    expect(body).toEqual([
      {
        fieldKey: "root/FirmwareVersion",
        points: [
          {
            deviceSnapshotId: "ds1",
            timeStampUtc: "2026-02-17T07:50:23.000Z",
            valueText: "A",
            valueType: "string"
          },
          {
            deviceSnapshotId: "ds2",
            timeStampUtc: "2026-02-18T07:50:23.000Z",
            valueText: "B",
            valueType: "string"
          }
        ]
      }
    ]);

    await app.close();
  });
});
