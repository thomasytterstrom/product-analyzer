import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { buildServer } from "../server.js";

function makeTmpDbPath(prefix: string) {
  return path.join(os.tmpdir(), `${prefix}-${randomUUID()}.db`);
}

describe("GET/PUT /configurations/:configurationId/fields", () => {
  it("starts empty, upserts, then lists sorted by fieldKey", async () => {
    const sourceDbPath = makeTmpDbPath("product-analyzer-source");
    const metadataDbPath = makeTmpDbPath("product-analyzer-metadata");

    // Source DB must exist and contain DeviceSnapshot (openSourceDb prepares statements against it).
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
    seed.close();

    const app = buildServer({ sourceDbPath, metadataDbPath });

    const configurationId = "Construction.RemoteControl.Corea";

    const res0 = await app.inject({
      method: "GET",
      url: `/configurations/${encodeURIComponent(configurationId)}/fields`
    });

    expect(res0.statusCode).toBe(200);
    expect(res0.json()).toEqual([]);

    const putRes = await app.inject({
      method: "PUT",
      url: `/configurations/${encodeURIComponent(configurationId)}/fields`,
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({
        fields: [
          { fieldKey: "root/FirmwareVersion", tracked: true, friendlyName: "Firmware" },
          { fieldKey: "node:master/send.command.Response.status", tracked: false, friendlyName: null }
        ]
      })
    });

    expect(putRes.statusCode).toBe(200);
    expect(putRes.json()).toEqual([
      {
        configurationId,
        fieldKey: "node:master/send.command.Response.status",
        tracked: false,
        friendlyName: null
      },
      {
        configurationId,
        fieldKey: "root/FirmwareVersion",
        tracked: true,
        friendlyName: "Firmware"
      }
    ]);

    const res1 = await app.inject({
      method: "GET",
      url: `/configurations/${encodeURIComponent(configurationId)}/fields`
    });

    expect(res1.statusCode).toBe(200);
    expect(res1.json()).toEqual([
      {
        configurationId,
        fieldKey: "node:master/send.command.Response.status",
        tracked: false,
        friendlyName: null
      },
      {
        configurationId,
        fieldKey: "root/FirmwareVersion",
        tracked: true,
        friendlyName: "Firmware"
      }
    ]);

    await app.close();
  });
});
