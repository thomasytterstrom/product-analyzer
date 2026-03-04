import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { buildServer } from "../server.js";

function makeTmpDbPath(prefix: string) {
  return path.join(os.tmpdir(), `${prefix}-${randomUUID()}.db`);
}

describe("GET /product-numbers", () => {
  it("lists distinct product numbers from DeviceSnapshot", async () => {
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

    seed
      .prepare(
        "INSERT INTO DeviceSnapshot (Id, ProductNumber, SerialNumber, SnapshotId, TimeStampUtc) VALUES (?, ?, ?, ?, ?)"
      )
      .run("ds1", "531285301", "S1", "snap-1", "2026-02-17T07:50:23.000Z");
    seed
      .prepare(
        "INSERT INTO DeviceSnapshot (Id, ProductNumber, SerialNumber, SnapshotId, TimeStampUtc) VALUES (?, ?, ?, ?, ?)"
      )
      .run("ds2", "531285301", "S2", "snap-2", "2026-02-18T07:50:23.000Z");
    seed
      .prepare(
        "INSERT INTO DeviceSnapshot (Id, ProductNumber, SerialNumber, SnapshotId, TimeStampUtc) VALUES (?, ?, ?, ?, ?)"
      )
      .run("ds3", "999", "S9", "snap-x", "2026-02-01T00:00:00.000Z");
    seed.close();

    const app = buildServer({ sourceDbPath, metadataDbPath });

    const res = await app.inject({ method: "GET", url: "/product-numbers" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(["531285301", "999"]);

    await app.close();
  });
});
