import Fastify from "fastify";

import { openMetadataDb } from "./db/metadataDb.js";
import { openSourceDb } from "./db/sourceDb.js";

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

  app.addHook("onClose", async () => {
    source?.close();
    meta?.close();
  });

  return app;
}
