import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

import { buildServer } from "../server.js";
import { openMetadataDb } from "../db/metadataDb.js";

function makeTmpDbPath(prefix: string) {
  return path.join(os.tmpdir(), `${prefix}-${randomUUID()}.db`);
}

describe("GET /products/:productNumber/:serialNumber/diff", () => {
  it("returns diff for tracked fields between two snapshots", async () => {
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

    const meta = openMetadataDb({ dbPath: metadataDbPath });
    meta.upsertConfigurationFields({
      configurationId: "cfg-1",
      fields: [{ fieldKey: "root/FirmwareVersion", tracked: true, friendlyName: "FW" }]
    });
    meta.close();

    const app = buildServer({ sourceDbPath, metadataDbPath });

    const res = await app.inject({
      method: "GET",
      url: "/products/531285301/S1/diff?snapshotA=ds1&snapshotB=ds2"
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      configurationId: "cfg-1",
      snapshotA: {
        deviceSnapshotId: "ds1",
        snapshotId: "snap-1",
        timeStampUtc: "2026-02-17T07:50:23.000Z"
      },
      snapshotB: {
        deviceSnapshotId: "ds2",
        snapshotId: "snap-2",
        timeStampUtc: "2026-02-18T07:50:23.000Z"
      },
      diff: {
        added: [],
        removed: [],
        changed: [{ key: "root/FirmwareVersion", from: "A", to: "B" }],
        unchanged: []
      }
    });

    await app.close();
  });
});
