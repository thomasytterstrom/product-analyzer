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

  it("keeps the app in SQLite mode when only SYNC_DATABASE_URL is set", async () => {
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
    process.env.SYNC_DATABASE_URL = "postgresql://sync-target.invalid/postgres";

    const app = buildServer();

    const health = await app.inject({
      method: "GET",
      url: "/health"
    });

    const products = await app.inject({
      method: "GET",
      url: "/product-numbers"
    });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ ok: true, database: "sqlite", auth: "disabled" });
    expect(products.statusCode).toBe(200);
    expect(products.json()).toEqual(["PN-123"]);

    await app.close();
  });

  it("uses SYNC_DATABASE_URL for the sync route", async () => {
    const sourceDbPath = tmpDbPath("product-analyzer-source");
    const metadataDbPath = tmpDbPath("product-analyzer-metadata");

    const sourceSeed = new Database(sourceDbPath);
    sourceSeed.exec(`
      CREATE TABLE DeviceSnapshot (
        Id TEXT NOT NULL,
        SnapshotId TEXT NOT NULL,
        ProductNumber TEXT NOT NULL,
        SerialNumber TEXT NOT NULL,
        TimeStampUtc TEXT NOT NULL
      );
      CREATE TABLE DeviceSnapshotJson (
        DeviceSnapshotId TEXT NOT NULL,
        Json TEXT NOT NULL
      );
    `);
    sourceSeed.close();

    const metadataSeed = new Database(metadataDbPath);
    metadataSeed.exec(`
      CREATE TABLE ConfigurationField (
        configurationId TEXT NOT NULL,
        fieldKey TEXT NOT NULL,
        friendlyName TEXT,
        tracked INTEGER NOT NULL,
        createdUtc TEXT,
        updatedUtc TEXT,
        PRIMARY KEY (configurationId, fieldKey)
      );
    `);
    metadataSeed.close();

    process.env.SOURCE_DB_PATH = sourceDbPath;
    process.env.METADATA_DB_PATH = metadataDbPath;
    process.env.SYNC_DATABASE_URL = "postgresql://sync-target.invalid/postgres";

    const app = buildServer();

    const res = await app.inject({
      method: "POST",
      url: "/sync"
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({
      error: "Internal Server Error during sync"
    });

    await app.close();
  });
});
