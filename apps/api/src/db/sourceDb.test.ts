import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { openSourceDb } from "./sourceDb.js";

function makeTmpDbPath() {
  return path.join(os.tmpdir(), `product-analyzer-source-${randomUUID()}.db`);
}

describe("sourceDb", () => {
  it("lists product numbers, serial numbers, snapshots and loads snapshot json", () => {
    const dbPath = makeTmpDbPath();
    const seed = new Database(dbPath);

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
      .prepare(
        "INSERT INTO DeviceSnapshot (Id, ProductNumber, SerialNumber, SnapshotId, TimeStampUtc) VALUES (?, ?, ?, ?, ?)"
      )
      .run("ds3", "999", "S9", "snap-x", "2026-02-01T00:00:00.000Z");

    seed
      .prepare(
        "INSERT INTO DeviceSnapshotJson (Id, Json, DeviceSnapshotId) VALUES (?, ?, ?)"
      )
      .run("j1", JSON.stringify({ ConfigurationId: "C1" }), "ds2");

    seed.close();

    const source = openSourceDb({ dbPath });

    expect(source.listProductNumbers()).toEqual(["531285301", "999"]);
    expect(source.listSerialNumbers("531285301")).toEqual(["S1"]);

    const snaps = source.listSnapshots({ productNumber: "531285301", serialNumber: "S1" });
    expect(snaps.map((s) => s.deviceSnapshotId)).toEqual(["ds2", "ds1"]);
    expect(snaps[0].timeStampUtc).toBe("2026-02-18T07:50:23.000Z");

    expect(source.getSnapshotHeader({ deviceSnapshotId: "ds1" })).toEqual({
      deviceSnapshotId: "ds1",
      productNumber: "531285301",
      serialNumber: "S1",
      snapshotId: "snap-1",
      timeStampUtc: "2026-02-17T07:50:23.000Z"
    });

    expect(source.getSnapshotJson({ deviceSnapshotId: "ds2" })).toBe(
      JSON.stringify({ ConfigurationId: "C1" })
    );

    source.close();
  });
});
