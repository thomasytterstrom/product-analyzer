import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { buildServer } from "./server.js";

function tmpDbPath(prefix: string) {
  return path.join(os.tmpdir(), `${prefix}-${randomUUID()}.db`);
}

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("buildServer() uses SQLite when env vars are set", () => {
  it("returns product numbers from source db", async () => {
    const sourceDbPath = tmpDbPath("product-analyzer-source");
    const metadataDbPath = tmpDbPath("product-analyzer-metadata");

    const seed = new Database(sourceDbPath);
    seed.exec(`
      CREATE TABLE DeviceSnapshot (
        Id TEXT NOT NULL,
        SnapshotId TEXT NOT NULL,
        ProductNumber TEXT NOT NULL,
        SerialNumber TEXT NOT NULL,
        TimeStampUtc TEXT NOT NULL
      );
    `);
    seed
      .prepare(
        "INSERT INTO DeviceSnapshot (Id, SnapshotId, ProductNumber, SerialNumber, TimeStampUtc) VALUES (?, ?, ?, ?, ?)"
      )
      .run("ds-1", "s-1", "PN-123", "SN-999", "2026-02-17T10:00:00.000Z");
    seed.close();

    process.env.SOURCE_DB_PATH = sourceDbPath;
    process.env.METADATA_DB_PATH = metadataDbPath;

    const app = buildServer();

    const res = await app.inject({
      method: "GET",
      url: "/product-numbers"
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(["PN-123"]);

    await app.close();
  });
});
