import Fastify from "fastify";

import { openMetadataDb } from "./db/metadataDb.js";
import { openSourceDb } from "./db/sourceDb.js";
import { flattenSnapshotJson } from "@product-analyzer/shared";

export function buildServer(opts?: { sourceDbPath: string; metadataDbPath: string }) {
  const app = Fastify({ logger: false });

  const source = opts ? openSourceDb({ dbPath: opts.sourceDbPath }) : null;
  const meta = opts ? openMetadataDb({ dbPath: opts.metadataDbPath }) : null;

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

  app.addHook("onClose", async () => {
    source?.close();
    meta?.close();
  });

  return app;
}
