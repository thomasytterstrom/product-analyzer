import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { buildServer } from "../server.js";

function makeTmpDbPath(prefix: string) {
  return path.join(os.tmpdir(), `${prefix}-${randomUUID()}.db`);
}

describe("GET /products/:productNumber/:serialNumber/snapshots", () => {
  it("lists snapshots ordered by TimeStampUtc desc", async () => {
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
    `);

    const ins = seed.prepare(
      "INSERT INTO DeviceSnapshot (Id, ProductNumber, SerialNumber, SnapshotId, TimeStampUtc) VALUES (?, ?, ?, ?, ?)"
    );
    ins.run("ds1", "531285301", "S1", "snap-1", "2026-02-17T07:50:23.000Z");
    ins.run("ds2", "531285301", "S1", "snap-2", "2026-02-18T07:50:23.000Z");
    ins.run("ds3", "531285301", "S2", "snap-3", "2026-02-19T07:50:23.000Z");
    seed.close();

    const app = buildServer({ sourceDbPath, metadataDbPath });

    const res = await app.inject({
      method: "GET",
      url: "/products/531285301/S1/snapshots"
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      {
        deviceSnapshotId: "ds2",
        snapshotId: "snap-2",
        timeStampUtc: "2026-02-18T07:50:23.000Z"
      },
      {
        deviceSnapshotId: "ds1",
        snapshotId: "snap-1",
        timeStampUtc: "2026-02-17T07:50:23.000Z"
      }
    ]);

    await app.close();
  });
});
