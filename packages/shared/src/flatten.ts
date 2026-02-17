export type FlattenedField = {
  valueText: string | null;
  valueType: string | null;
};

export type FlattenedSnapshot = Record<string, FlattenedField>;

type SnapshotNode = {
  NodeId?: unknown;
  Parameters?: unknown;
  Nodes?: unknown;
};

type SnapshotParameter = {
  FieldId?: unknown;
  Value?: unknown;
  Type?: unknown;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const asStringOrNull = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") {
    return String(v);
  }
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

const asTypeString = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v : null;

const rootFields: ReadonlyArray<string> = [
  "FirmwareVersion",
  "ConfigurationId",
  "TimeStamp"
];

function set(out: FlattenedSnapshot, key: string, valueText: string | null, valueType: string | null) {
  out[key] = { valueText, valueType };
}

function flattenNode(out: FlattenedSnapshot, node: SnapshotNode) {
  const nodeIdRaw = isRecord(node) ? node["NodeId"] : undefined;
  const nodeId = typeof nodeIdRaw === "string" && nodeIdRaw ? nodeIdRaw : "unknown";

  const paramsRaw = isRecord(node) ? node["Parameters"] : undefined;
  if (Array.isArray(paramsRaw)) {
    for (const p of paramsRaw) {
      if (!isRecord(p)) continue;
      const fieldId = p["FieldId"];
      if (typeof fieldId !== "string" || !fieldId) continue;

      const valueText = asStringOrNull(p["Value"]);
      const valueType = asTypeString(p["Type"]);

      set(out, `node:${nodeId}/${fieldId}`, valueText, valueType);
    }
  }

  const childNodesRaw = isRecord(node) ? node["Nodes"] : undefined;
  if (Array.isArray(childNodesRaw)) {
    for (const child of childNodesRaw) {
      if (!isRecord(child)) continue;
      flattenNode(out, child as SnapshotNode);
    }
  }
}

/**
 * Flatten a snapshot JSON payload into stable field keys for diffing.
 *
 * Rules (v1):
 * - Nodes.Parameters: `node:<NodeId>/<FieldId>`
 * - CompositeParameters: `composite/<FieldId>`
 * - Root fields: `root/FirmwareVersion`, `root/ConfigurationId`, `root/TimeStamp`
 */
export function flattenSnapshotJson(snapshot: unknown): FlattenedSnapshot {
  const out: FlattenedSnapshot = {};

  if (!isRecord(snapshot)) return out;

  // Root fields
  for (const f of rootFields) {
    if (!(f in snapshot)) continue;
    const valueText = asStringOrNull(snapshot[f]);
    // Keep root types simple/deterministic.
    const vt = snapshot[f] === null ? "null" : typeof snapshot[f];
    const valueType = vt === "string" || vt === "number" || vt === "boolean" || vt === "null" ? vt : null;
    set(out, `root/${f}`, valueText, valueType);
  }

  // Composite parameters
  const compositeRaw = snapshot["CompositeParameters"];
  if (Array.isArray(compositeRaw)) {
    for (const p of compositeRaw) {
      if (!isRecord(p)) continue;
      const fieldId = p["FieldId"];
      if (typeof fieldId !== "string" || !fieldId) continue;

      const valueText = asStringOrNull(p["Value"]);
      const valueType = asTypeString(p["Type"]);
      set(out, `composite/${fieldId}`, valueText, valueType);
    }
  }

  // Nodes (recursive)
  const nodesRaw = snapshot["Nodes"];
  if (Array.isArray(nodesRaw)) {
    for (const n of nodesRaw) {
      if (!isRecord(n)) continue;
      flattenNode(out, n as SnapshotNode);
    }
  }

  return out;
}
