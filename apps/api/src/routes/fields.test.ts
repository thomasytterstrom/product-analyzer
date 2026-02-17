import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { buildServer } from "../server.js";

function makeTmpDbPath(prefix: string) {
  return path.join(os.tmpdir(), `${prefix}-${randomUUID()}.db`);
}

describe("GET /snapshots/:deviceSnapshotId/fields", () => {
  it("returns flattened field keys and values", async () => {
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

    const json = {
      FirmwareVersion: "599807801M",
      ConfigurationId: "Construction.RemoteControl.Corea",
      TimeStamp: "2026-02-17T07:50:23.9370956Z",
      Nodes: [
        {
          NodeId: "master",
          Parameters: [
            { FieldId: "send.command.Response.status", Value: "OK", Type: "string" }
          ],
          Nodes: []
        }
      ],
      CompositeParameters: [
        {
          FieldId: "Identities.ParseHid.Response.ProductNumber",
          Value: "531285301",
          Type: "string"
        }
      ]
    };

    seed
      .prepare("INSERT INTO DeviceSnapshotJson (Id, Json, DeviceSnapshotId) VALUES (?, ?, ?)")
      .run("j1", JSON.stringify(json), "ds1");

    seed.close();

    const app = buildServer({ sourceDbPath, metadataDbPath });

    const res = await app.inject({ method: "GET", url: "/snapshots/ds1/fields" });

    expect(res.statusCode).toBe(200);

    const body = res.json() as Array<{ fieldKey: string; valueText: string | null; valueType: string | null }>;

    expect(body).toEqual(
      expect.arrayContaining([
        {
          fieldKey: "node:master/send.command.Response.status",
          valueText: "OK",
          valueType: "string"
        },
        {
          fieldKey: "composite/Identities.ParseHid.Response.ProductNumber",
          valueText: "531285301",
          valueType: "string"
        },
        {
          fieldKey: "root/FirmwareVersion",
          valueText: "599807801M",
          valueType: "string"
        }
      ])
    );

    await app.close();
  });
});
