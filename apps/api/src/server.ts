import Fastify from "fastify";

import { openMetadataDb } from "./db/metadataDb.js";
import { openSourceDb } from "./db/sourceDb.js";
import { diffAttributes, flattenSnapshotJson } from "@product-analyzer/shared";

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


  app.get("/products/:productNumber/:serialNumber/diff", async (req, reply) => {
    if (!source) {
      reply.code(500);
      return { error: "Source DB not configured" };
    }
    if (!meta) {
      reply.code(500);
      return { error: "Metadata DB not configured" };
    }

    const { productNumber, serialNumber } = req.params as {
      productNumber: string;
      serialNumber: string;
    };

    const query = req.query as unknown;
    const snapshotA =
      typeof query === "object" && query !== null ? ((query as any).snapshotA as unknown) : null;
    const snapshotB =
      typeof query === "object" && query !== null ? ((query as any).snapshotB as unknown) : null;

    if (typeof snapshotA !== "string" || snapshotA.length === 0) {
      reply.code(400);
      return { error: "Missing query param: snapshotA" };
    }
    if (typeof snapshotB !== "string" || snapshotB.length === 0) {
      reply.code(400);
      return { error: "Missing query param: snapshotB" };
    }

    const headerA = source.getSnapshotHeader({ deviceSnapshotId: snapshotA });
    const headerB = source.getSnapshotHeader({ deviceSnapshotId: snapshotB });

    if (headerA.productNumber !== productNumber || headerA.serialNumber !== serialNumber) {
      reply.code(400);
      return {
        error: `Snapshot ${snapshotA} does not belong to product ${productNumber} / serial ${serialNumber}`
      };
    }

    if (headerB.productNumber !== productNumber || headerB.serialNumber !== serialNumber) {
      reply.code(400);
      return {
        error: `Snapshot ${snapshotB} does not belong to product ${productNumber} / serial ${serialNumber}`
      };
    }

    const flatA = flattenSnapshotJson(JSON.parse(source.getSnapshotJson({ deviceSnapshotId: snapshotA })));
    const flatB = flattenSnapshotJson(JSON.parse(source.getSnapshotJson({ deviceSnapshotId: snapshotB })));

    const configurationIdA = flatA["root/ConfigurationId"]?.valueText?.trim() ?? "";
    const configurationIdB = flatB["root/ConfigurationId"]?.valueText?.trim() ?? "";

    if (!configurationIdA || !configurationIdB) {
      reply.code(400);
      return { error: "Missing ConfigurationId on one or both snapshots" };
    }

    if (configurationIdA !== configurationIdB) {
      reply.code(400);
      return { error: `Snapshots have different ConfigurationId (${configurationIdA} vs ${configurationIdB})` };
    }

    const configurationId = configurationIdA;

    const trackedKeys = meta
      .listConfigurationFields({ configurationId })
      .filter((r) => r.tracked)
      .map((r) => r.fieldKey);

    const a: Record<string, string | null | undefined> = {};
    const b: Record<string, string | null | undefined> = {};

    for (const key of trackedKeys) {
      const ea = flatA[key];
      const eb = flatB[key];

      if (ea !== undefined) a[key] = ea.valueText ?? null;
      if (eb !== undefined) b[key] = eb.valueText ?? null;
    }

    return {
      configurationId,
      snapshotA: {
        deviceSnapshotId: headerA.deviceSnapshotId,
        snapshotId: headerA.snapshotId,
        timeStampUtc: headerA.timeStampUtc
      },
      snapshotB: {
        deviceSnapshotId: headerB.deviceSnapshotId,
        snapshotId: headerB.snapshotId,
        timeStampUtc: headerB.timeStampUtc
      },
      diff: diffAttributes(a, b)
    };
  });

  app.post("/products/:productNumber/:serialNumber/timeseries", async (req, reply) => {
    if (!source) return [];

    const { productNumber, serialNumber } = req.params as {
      productNumber: string;
      serialNumber: string;
    };

    const body = req.body as unknown;
    const snapshotIds =
      typeof body === "object" &&
      body !== null &&
      Array.isArray((body as any).snapshotIds)
        ? ((body as any).snapshotIds as unknown[])
        : null;

    const fieldKeys =
      typeof body === "object" &&
      body !== null &&
      Array.isArray((body as any).fieldKeys)
        ? ((body as any).fieldKeys as unknown[])
        : null;

    if (!snapshotIds || !fieldKeys) {
      reply.code(400);
      return { error: "Invalid body: expected { snapshotIds: string[], fieldKeys: string[] }" };
    }

    const normalizedSnapshotIds = snapshotIds
      .filter((v): v is string => typeof v === "string" && v.length > 0);

    const normalizedFieldKeys = fieldKeys
      .filter((v): v is string => typeof v === "string" && v.length > 0);

    // Pre-build response buckets.
    const buckets = new Map(
      normalizedFieldKeys.map((fieldKey) => [fieldKey, [] as Array<{
        deviceSnapshotId: string;
        timeStampUtc: string;
        valueText: string | null;
        valueType: string | null;
      }>] as const)
    );

    for (const deviceSnapshotId of normalizedSnapshotIds) {
      const header = source.getSnapshotHeader({ deviceSnapshotId });
      if (header.productNumber !== productNumber || header.serialNumber !== serialNumber) {
        reply.code(400);
        return {
          error: `Snapshot ${deviceSnapshotId} does not belong to product ${productNumber} / serial ${serialNumber}`
        };
      }

      const jsonText = source.getSnapshotJson({ deviceSnapshotId });
      const parsed = JSON.parse(jsonText) as unknown;
      const flat = flattenSnapshotJson(parsed);

      for (const fieldKey of normalizedFieldKeys) {
        const entry = flat[fieldKey];
        const valueText = entry?.valueText ?? null;
        const valueType = entry?.valueType ?? null;

        buckets.get(fieldKey)?.push({
          deviceSnapshotId,
          timeStampUtc: header.timeStampUtc,
          valueText,
          valueType
        });
      }
    }

    return [...buckets.entries()].map(([fieldKey, points]) => {
      points.sort((a, b) => a.timeStampUtc.localeCompare(b.timeStampUtc));
      return { fieldKey, points };
    });
  });

  app.addHook("onClose", async () => {
    source?.close();
    meta?.close();
  });

  return app;
}
