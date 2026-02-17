# Product Analyzer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Vite (React) web app + Node backend that reads existing snapshot data from a local SQLite database (`DeviceSnapshot` + `DeviceSnapshotJson`), lets users choose “interesting” parameters (per `ConfigurationId`) with friendly names, compares snapshots, and graphs selected values across many snapshots.

**Architecture:** Monorepo with `apps/web` (Vite + Tailwind + shadcn/ui) calling `apps/api` (Fastify). The API reads snapshots from the existing **source SQLite DB (read-only)**, flattens snapshot JSON payloads into stable field keys, stores tracked fields + friendly names in an **app-owned sidecar SQLite metadata DB**, and provides diff + time-series endpoints. UI starts from ProductNumber → SerialNumber → snapshots.

**Tech Stack:** Vite + React + TypeScript, Tailwind CSS, shadcn/ui, Fastify, SQLite (source DB + sidecar metadata DB), Zod, Vitest, Playwright, charts (Recharts or similar).

---

## Assumptions / Decisions (lock these in early)

- Source DB is read-only and contains:
  - `DeviceSnapshot` and `DeviceSnapshotJson`
- Product identity is `(ProductNumber, SerialNumber)`.
- Snapshot ordering is by `DeviceSnapshot.TimeStampUtc`.
- Parameter configurations (tracked fields + friendly names) are saved **per `DeviceSnapshot.ConfigurationId`**.
- Multi-snapshot comparison/graphs require selected snapshots share the same `ConfigurationId` (v1: warn + block mismatch).
- JSON arrays like `EventData.Events` are not included in the generic parameter diff in v1 (optional summary later).

---

## Repository layout

- `apps/api/` — Fastify API
- `apps/web/` — Vite React UI
- `packages/shared/` — shared schemas + diff/flatten utilities

---

## Data model (derived)

- Product:
  - `productNumber: string`
  - `serialNumber: string`

- Snapshot:
  - `deviceSnapshotId: string` (DeviceSnapshot.Id)
  - `snapshotId: string` (DeviceSnapshot.SnapshotId)
  - `timeStampUtc: string`
  - `configurationId: string`

- Flattened field (computed from snapshot JSON):
  - `fieldKey: string` (examples: `node:master/<FieldId>`, `composite/<FieldId>`, `root/<FieldName>`)
  - `valueText: string | null`
  - `valueType: string | null`

- ConfigurationField (stored in sidecar metadata DB):
  - `configurationId: string`
  - `fieldKey: string`
  - `friendlyName?: string`
  - `tracked: boolean`

---

## Task 1: Workspace + monorepo scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `apps/api/` (Fastify)
- Create: `apps/web/` (placeholder for now)
- Create: `packages/shared/` (placeholder for now)

**Step 1: Write the failing smoke test**

- Create: `apps/api/src/smoke.test.ts`

```ts
import { describe, expect, it } from "vitest";

describe("smoke", () => {
  it("runs tests", () => {
    expect(1 + 1).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails (no tooling yet)**

Run: `npm test`
Expected: FAIL (no package.json/scripts yet)

**Step 3: Add minimal monorepo config and scripts**

- Root `package.json` (workspaces + scripts). Use `concurrently` for cross-platform `dev`.

```json
{
  "name": "product-analyzer",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "concurrently -n api,web \"npm -w apps/api run dev\" \"npm -w apps/web run dev\"",
    "test": "npm -ws run test"
  }
}
```

- `apps/api/package.json` with `vitest` + `tsx`.
- `apps/web/package.json` and `packages/shared/package.json` must have a `test` script that doesn’t fail (can be a no-op initially).

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS for api smoke test

**Step 5: Commit**

```bash
git add package.json tsconfig.base.json apps/api apps/web packages/shared
git commit -m "chore: scaffold monorepo with web and api"
```

---

## Task 2: Shared diff logic

**Files:**
- Create: `packages/shared/src/diff.ts`
- Test: `packages/shared/src/diff.test.ts`

**Step 1: Write failing tests for diff computation**

```ts
import { describe, expect, it } from "vitest";
import { diffAttributes } from "./diff";

describe("diffAttributes", () => {
  it("detects changed and added keys", () => {
    const a = { price: "10", name: "X" };
    const b = { price: "12", name: "X", color: "red" };

    const d = diffAttributes(a, b);

    expect(d.changed).toEqual([{ key: "price", from: "10", to: "12" }]);
    expect(d.added).toEqual([{ key: "color", to: "red" }]);
    expect(d.removed).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm -w packages/shared test`
Expected: FAIL (“diffAttributes” not found)

**Step 3: Minimal implementation**

```ts
export function diffAttributes(
  a: Record<string, string | null | undefined>,
  b: Record<string, string | null | undefined>
) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  const added: { key: string; to: string | null }[] = [];
  const removed: { key: string; from: string | null }[] = [];
  const changed: { key: string; from: string | null; to: string | null }[] = [];
  const unchanged: { key: string; value: string | null }[] = [];

  for (const key of [...keys].sort()) {
    const av = a[key] ?? null;
    const bv = b[key] ?? null;

    if (!(key in a) && key in b) added.push({ key, to: bv });
    else if (key in a && !(key in b)) removed.push({ key, from: av });
    else if (av !== bv) changed.push({ key, from: av, to: bv });
    else unchanged.push({ key, value: av });
  }

  return { added, removed, changed, unchanged };
}
```

**Step 4: Run tests to verify it passes**

Run: `npm -w packages/shared test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add attribute diff computation"
```

---

## Task 3: Shared JSON flattening (field discovery)

**Files:**
- Create: `packages/shared/src/flatten.ts`
- Test: `packages/shared/src/flatten.test.ts`

**Goal:** Flatten snapshot JSON into `{ [fieldKey]: { valueText, valueType } }`.

**Step 1: Write failing tests**

Use the provided JSON example (redacted) and assert:
- `node:master/send.command.Response.status` exists
- `composite/Identities.ParseHid.Response.ProductNumber` exists
- `root/FirmwareVersion` exists

**Step 2: Implement minimal flattening**

Rules:
- Nodes.Parameters: `node:<NodeId>/<FieldId>`
- CompositeParameters: `composite/<FieldId>`
- Selected root fields: `root/FirmwareVersion`, `root/ConfigurationId`, `root/TimeStamp` (extend later)

**Step 3: Commit**

---

## Task 4: Backend DB access (source DB + sidecar metadata DB)

**Files:**
- Create: `apps/api/src/env.ts`
- Create: `apps/api/src/db/sourceDb.ts`
- Create: `apps/api/src/db/metadataDb.ts`
- Test: `apps/api/src/db/sourceDb.test.ts`
- Test: `apps/api/src/db/metadataDb.test.ts`

**Env:**
- `SOURCE_DB_PATH` (existing DB)
- `METADATA_DB_PATH` (sidecar DB)

**Implement:**
- source queries:
  - list product numbers
  - list serial numbers for a product number
  - list snapshots for a (productNumber, serialNumber)
  - get snapshot JSON by `deviceSnapshotId`
- metadata queries:
  - ensure schema
  - list/upsert `ConfigurationField`

---

## Task 5: Backend Fastify server + health

**Files:**
- Create: `apps/api/src/server.ts`
- Test: `apps/api/src/server.test.ts`

- `GET /health` → `{ ok: true }`

---

## Task 6: Backend read endpoints (product selection + snapshots + fields)

**Endpoints:**
- `GET /product-numbers`
- `GET /product-numbers/:productNumber/serial-numbers`
- `GET /products/:productNumber/:serialNumber/snapshots`
- `GET /snapshots/:deviceSnapshotId/fields` (uses flattening)

---

## Task 7: Metadata endpoints (tracked fields + friendly names)

**Endpoints:**
- `GET /configurations/:configurationId/fields`
- `PUT /configurations/:configurationId/fields` (upsert tracked/friendlyName)

---

## Task 8: Diff endpoint (two snapshots)

**Endpoint:**
- `GET /products/:productNumber/:serialNumber/diff?snapshotA=<deviceSnapshotId>&snapshotB=<deviceSnapshotId>`

Rules:
- Load JSON for both snapshots, flatten, filter to tracked keys for `ConfigurationId`, diff using `diffAttributes`.

---

## Task 9: Time-series endpoint (graphs across many snapshots)

**Endpoint:**
- `POST /products/:productNumber/:serialNumber/timeseries`

Body:
- `{ snapshotIds: string[], fieldKeys: string[] }`

Returns:
- `{ fieldKey, points: [{ deviceSnapshotId, timeStampUtc, valueText, valueType }] }[]`

---

## Task 10+: Frontend UI

Implement in this order:
1) Product picker (ProductNumber → SerialNumber)
2) Snapshots list (multi-select)
3) Parameter configuration editor (toggle tracked, set friendly names)
4) Diff view (two snapshots)
5) Trends view (graphs across many snapshots)

---

## Execution handoff

After each task:
- run the specified tests
- commit small, focused changes
