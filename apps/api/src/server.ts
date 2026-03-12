import Fastify, { FastifyInstance } from "fastify";
import fastifyJWT from "@fastify/jwt";
import { MetadataDb } from "./db/metadataDb.js";
import { SourceDb } from "./db/sourceDb.js";
import { openMetadataDb } from "./db/metadataDb.js";
import { openSourceDb } from "./db/sourceDb.js";
import { openMetadataDbPostgres } from "./db/metadataDbPostgres.js";
import { openSourceDbPostgres } from "./db/sourceDbPostgres.js";
import { diffAttributes, flattenSnapshotJson } from "@product-analyzer/shared";
import { runMigration } from "./services/migration.service.js";

export function buildServer(opts?: { 
  sourceDbPath?: string; 
  metadataDbPath?: string;
  databaseUrl?: string;
  syncDatabaseUrl?: string;
  jwtSecret?: string;
}) {
  const app = Fastify({ logger: false });

  const databaseUrl = opts?.databaseUrl || process.env.DATABASE_URL;
  const isPostgres = !!databaseUrl;
  const jwtSecret = opts?.jwtSecret || process.env.SUPABASE_JWT_SECRET;

  // 1. Setup Database
  const source: SourceDb | null = (() => {
    if (isPostgres) {
      return openSourceDbPostgres({ connectionString: databaseUrl! });
    }
    const path = opts?.sourceDbPath || process.env.SOURCE_DB_PATH;
    return path ? openSourceDb({ dbPath: path }) : null;
  })();

  const meta: MetadataDb | null = (() => {
    if (isPostgres) {
      return openMetadataDbPostgres({ connectionString: databaseUrl! });
    }
    const path = opts?.metadataDbPath || process.env.METADATA_DB_PATH;
    return path ? openMetadataDb({ dbPath: path }) : null;
  })();

  // 2. Setup Authentication (Optional but enforced if secret is present)
  if (jwtSecret) {
    app.register(fastifyJWT, {
      secret: jwtSecret
    });

    app.addHook("onRequest", async (request, reply) => {
      // Skip auth for health check
      if (request.url === "/health") return;

      try {
        await request.jwtVerify();
      } catch (err: any) {
        reply.code(401).send({ error: "Unauthorized", message: err.message });
      }
    });
  }

  // 3. Routes
  app.get("/health", async () => {
    return { 
      ok: true, 
      database: isPostgres ? "postgres" : "sqlite",
      auth: !!jwtSecret ? "enabled" : "disabled"
    };
  });

  app.get("/product-numbers", async () => {
    if (!source) return [];
    return await source.listProductNumbers();
  });

  app.get("/product-numbers/:productNumber/serial-numbers", async (req) => {
    if (!source) return [];
    const { productNumber } = req.params as { productNumber: string };
    return await source.listSerialNumbers(productNumber);
  });

  app.get("/products/:productNumber/:serialNumber/snapshots", async (req) => {
    if (!source) return [];
    const { productNumber, serialNumber } = req.params as {
      productNumber: string;
      serialNumber: string;
    };
    return await source.listSnapshots({ productNumber, serialNumber });
  });

  app.get("/snapshots/:deviceSnapshotId/fields", async (req) => {
    if (!source) return [];
    const { deviceSnapshotId } = req.params as { deviceSnapshotId: string };
    const jsonText = await source.getSnapshotJson({ deviceSnapshotId });
    const parsed = JSON.parse(jsonText) as unknown;
    const flat = flattenSnapshotJson(parsed);
    return Object.keys(flat)
      .sort()
      .map((fieldKey) => ({ fieldKey, ...flat[fieldKey] }));
  });

  app.get("/configurations/:configurationId/fields", async (req) => {
    if (!meta) return [];
    const { configurationId } = req.params as { configurationId: string };
    return await meta.listConfigurationFields({ configurationId });
  });

  app.put("/configurations/:configurationId/fields", async (req, reply) => {
    if (!meta) return [];
    const { configurationId } = req.params as { configurationId: string };
    const body = req.body as any;
    const fields = Array.isArray(body?.fields) ? body.fields : null;

    if (!fields) {
      reply.code(400);
      return { error: "Invalid body: expected { fields: [...] }" };
    }

    const normalizedFields = fields.map((f: any) => ({
      fieldKey: String(f.fieldKey),
      tracked: Boolean(f.tracked),
      friendlyName: f.friendlyName ? String(f.friendlyName) : null
    }));

    await meta.upsertConfigurationFields({ configurationId, fields: normalizedFields });
    return await meta.listConfigurationFields({ configurationId });
  });

  app.get("/products/:productNumber/:serialNumber/diff", async (req, reply) => {
    if (!source || !meta) {
      reply.code(500);
      return { error: "Database not configured" };
    }

    const { productNumber, serialNumber } = req.params as { productNumber: string; serialNumber: string };
    const { snapshotA, snapshotB } = req.query as { snapshotA: string; snapshotB: string };

    if (!snapshotA || !snapshotB) {
      reply.code(400);
      return { error: "Missing snapshotA or snapshotB" };
    }

    const [headerA, headerB, jsonA, jsonB] = await Promise.all([
      source.getSnapshotHeader({ deviceSnapshotId: snapshotA }),
      source.getSnapshotHeader({ deviceSnapshotId: snapshotB }),
      source.getSnapshotJson({ deviceSnapshotId: snapshotA }),
      source.getSnapshotJson({ deviceSnapshotId: snapshotB })
    ]);

    const flatA = flattenSnapshotJson(JSON.parse(jsonA));
    const flatB = flattenSnapshotJson(JSON.parse(jsonB));

    const configurationId = flatA["root/ConfigurationId"]?.valueText?.trim() || "unknown";
    const trackedFields = await meta.listConfigurationFields({ configurationId });
    const trackedKeys = trackedFields.filter(f => f.tracked).map(f => f.fieldKey);

    const a: any = {};
    const b: any = {};
    for (const key of trackedKeys) {
      a[key] = flatA[key]?.valueText ?? null;
      b[key] = flatB[key]?.valueText ?? null;
    }

    return {
      configurationId,
      snapshotA: { ...headerA },
      snapshotB: { ...headerB },
      diff: diffAttributes(a, b)
    };
  });

  app.post("/products/:productNumber/:serialNumber/timeseries", async (req, reply) => {
    if (!source) return [];
    const { productNumber, serialNumber } = req.params as any;
    const { snapshotIds, fieldKeys } = req.body as any;

    if (!Array.isArray(snapshotIds) || !Array.isArray(fieldKeys)) {
      reply.code(400);
      return { error: "Invalid body" };
    }

    const results = await Promise.all(snapshotIds.map(async (id) => {
      const header = await source.getSnapshotHeader({ deviceSnapshotId: id });
      const json = await source.getSnapshotJson({ deviceSnapshotId: id });
      const flat = flattenSnapshotJson(JSON.parse(json));
      return { id, header, flat };
    }));

    return fieldKeys.map(fieldKey => ({
      fieldKey,
      points: results.map(r => ({
        deviceSnapshotId: r.id,
        timeStampUtc: r.header.timeStampUtc,
        valueText: r.flat[fieldKey]?.valueText ?? null,
        valueType: r.flat[fieldKey]?.valueType ?? null
      })).sort((a, b) => a.timeStampUtc.localeCompare(b.timeStampUtc))
    }));
  });
  app.post("/sync", async (req, reply) => {
    const databaseUrl = opts?.syncDatabaseUrl || process.env.SYNC_DATABASE_URL || opts?.databaseUrl || process.env.DATABASE_URL;
    const sourceDbPath = opts?.sourceDbPath || process.env.SOURCE_DB_PATH;
    const metadataDbPath = opts?.metadataDbPath || process.env.METADATA_DB_PATH;

    if (!databaseUrl) {
      reply.code(400);
      return { error: "DATABASE_URL is not configured. Sync only works when a remote Postgres database is targeted." };
    }

    if (!sourceDbPath || !metadataDbPath) {
      reply.code(500);
      return { error: "Local database paths are not configured." };
    }

    try {
      const result = await runMigration({
        databaseUrl,
        sourceDbPath,
        metadataDbPath
      });

      if (!result.success) {
        reply.code(500);
        return { error: "Migration failed", details: result.errors };
      }

      return {
        message: "Sync completed successfully",
        ...result
      };
    } catch (error: any) {
      reply.code(500);
      return { error: "Internal Server Error during sync", message: error.message };
    }
  });


  app.addHook("onClose", async () => {
    await Promise.all([source?.close(), meta?.close()]);
  });

  return app;
}
