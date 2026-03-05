import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { openMetadataDb } from "./metadataDb.js";

function makeTmpDbPath() {
  return path.join(os.tmpdir(), `product-analyzer-metadata-${randomUUID()}.db`);
}

describe("metadataDb", () => {
  it("can upsert and list configuration fields", async () => {
    const dbPath = makeTmpDbPath();

    const meta = openMetadataDb({ dbPath });

    await meta.upsertConfigurationFields({
      configurationId: "Construction.RemoteControl.Corea",
      fields: [
        {
          fieldKey: "node:master/send.command.Response.status",
          tracked: true,
          friendlyName: "Command status"
        },
        {
          fieldKey: "root/FirmwareVersion",
          tracked: false,
          friendlyName: "FW"
        }
      ]
    });

    const fields = await meta.listConfigurationFields({
      configurationId: "Construction.RemoteControl.Corea"
    });

    // order is deterministic
    expect(fields).toEqual([
      {
        configurationId: "Construction.RemoteControl.Corea",
        fieldKey: "node:master/send.command.Response.status",
        tracked: true,
        friendlyName: "Command status"
      },
      {
        configurationId: "Construction.RemoteControl.Corea",
        fieldKey: "root/FirmwareVersion",
        tracked: false,
        friendlyName: "FW"
      }
    ]);

    // update existing
    await meta.upsertConfigurationFields({
      configurationId: "Construction.RemoteControl.Corea",
      fields: [
        {
          fieldKey: "root/FirmwareVersion",
          tracked: true,
          friendlyName: "Firmware"
        }
      ]
    });

    const after = await meta.listConfigurationFields({
      configurationId: "Construction.RemoteControl.Corea"
    });

    expect(after).toEqual([
      {
        configurationId: "Construction.RemoteControl.Corea",
        fieldKey: "node:master/send.command.Response.status",
        tracked: true,
        friendlyName: "Command status"
      },
      {
        configurationId: "Construction.RemoteControl.Corea",
        fieldKey: "root/FirmwareVersion",
        tracked: true,
        friendlyName: "Firmware"
      }
    ]);

    await meta.close();
  });
});
