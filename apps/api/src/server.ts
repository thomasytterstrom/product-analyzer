import Fastify from "fastify";

import { openMetadataDb } from "./db/metadataDb.js";
import { openSourceDb } from "./db/sourceDb.js";
import { flattenSnapshotJson } from "@product-analyzer/shared";

export function buildServer(opts?: { sourceDbPath: string; metadataDbPath: string }) {
  const app = Fastify({ logger: false });

  // In tests we often want `buildServer()` to work without a database.
  // In dev/prod we want it to auto-connect based on env vars.
  const resolved = (() => {
    if (opts) return opts;

    const sourceDbPath = process.env.SOURCE_DB_PATH;
    const metadataDbPath = process.env.METADATA_DB_PATH;
    if (typeof sourceDbPath !== "string" || sourceDbPath.length === 0) return null;
    if (typeof metadataDbPath !== "string" || metadataDbPath.length === 0) return null;

    return { sourceDbPath, metadataDbPath };
  })();

  const source = resolved ? openSourceDb({ dbPath: resolved.sourceDbPath }) : null;
  const meta = resolved ? openMetadataDb({ dbPath: resolved.metadataDbPath }) : null;

  app.get("/health", async () => {
    return { ok: true };
  });

  app.get("/product-numbers", async () => {
    if (!source) return [];
    return source.listProductNumbers();
  });

  app.get("/product-numbers/:productNumber/serial-numbers", async (req) => {
    if (!source) return [];
    const { productNumber } = req.params as { productNumber: string };
    return source.listSerialNumbers(productNumber);
  });

  app.get("/products/:productNumber/:serialNumber/snapshots", async (req) => {
    if (!source) return [];
    const { productNumber, serialNumber } = req.params as {
      productNumber: string;
      serialNumber: string;
    };

    return source.listSnapshots({ productNumber, serialNumber });
  });

  app.get("/snapshots/:deviceSnapshotId/fields", async (req) => {
    if (!source) return [];
    const { deviceSnapshotId } = req.params as { deviceSnapshotId: string };
    const jsonText = source.getSnapshotJson({ deviceSnapshotId });
    const parsed = JSON.parse(jsonText) as unknown;
    const flat = flattenSnapshotJson(parsed);
    return Object.keys(flat)
      .sort()
      .map((fieldKey) => ({ fieldKey, ...flat[fieldKey] }));
  });

  app.get("/configurations/:configurationId/fields", async (req) => {
    if (!meta) return [];
    const { configurationId } = req.params as { configurationId: string };
    return meta.listConfigurationFields({ configurationId });
  });

  app.put("/configurations/:configurationId/fields", async (req, reply) => {
    if (!meta) return [];

    const { configurationId } = req.params as { configurationId: string };
    const body = req.body as unknown;

    const fields =
      typeof body === "object" &&
      body !== null &&
      Array.isArray((body as any).fields)
        ? ((body as any).fields as unknown[])
        : null;

    if (!fields) {
      reply.code(400);
      return { error: "Invalid body: expected { fields: [...] }" };
    }

    const normalizedFields: Array<{
      fieldKey: string;
      tracked: boolean;
      friendlyName?: string | null;
    }> = [];

    for (const f of fields) {
      if (typeof f !== "object" || f === null) continue;

      const fieldKey = (f as any).fieldKey;
      const tracked = (f as any).tracked;
      const friendlyName = (f as any).friendlyName;

      if (typeof fieldKey !== "string" || fieldKey.length === 0) continue;
      if (typeof tracked !== "boolean") continue;

      normalizedFields.push({
        fieldKey,
        tracked,
        friendlyName:
          friendlyName === undefined || friendlyName === null
            ? null
            : typeof friendlyName === "string"
              ? friendlyName
              : String(friendlyName)
      });
    }

    meta.upsertConfigurationFields({
      configurationId,
      fields: normalizedFields
    });

    return meta.listConfigurationFields({ configurationId });
  });

  app.addHook("onClose", async () => {
    source?.close();
    meta?.close();
  });

  return app;
}
