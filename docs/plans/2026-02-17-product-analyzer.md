# Product Analyzer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Vite (React) web app + Node backend that reads existing snapshot data from a local SQLite database (`DeviceSnapshot` + `DeviceSnapshotJson`) and lets users compare snapshots and graph selected parameter values over time.

**Architecture:** A small monorepo with `apps/web` (Vite + Tailwind + shadcn/ui) calling `apps/api` (Fastify + SQLite). The API reads snapshots from the existing DB (read-only), flattens JSON payloads into stable field keys, stores user-chosen tracked fields + friendly names in an **app-owned sidecar SQLite metadata DB**, and exposes endpoints for diffs + time-series. UI starts with product selection (ProductNumber → SerialNumber), then snapshots.

**Tech Stack:** Vite + React + TypeScript, Tailwind CSS, shadcn/ui, Fastify, SQLite (source DB + sidecar metadata DB), Zod, Vitest, Playwright.

---

## How to update this plan (add more info safely)

This plan is meant to evolve. When you learn something new (DB schema details, a new visualization requirement, auth, hosting, etc.), update the plan by:

1) **Update the “Assumptions / Decisions” section first** (add/remove bullets, date-stamp decisions).
2) **Fill in “Project-specific details” below** (especially DB schema + mapping).
3) **Only then adjust tasks**:
   - Add a new task rather than rewriting many tasks (keeps diffs small).
   - If a task changes meaningfully, add a short “Why changed” note under it.
4) **Keep tasks bite-sized** (2–5 minutes each): “write failing test” → “run to fail” → “minimal code” → “run to pass” → “commit”.
5) **Prefer adding acceptance criteria** instead of adding complexity (hidden tests love clarity).

If you paste additional info in chat, I can incorporate it directly into this file.

## Project-specific details (fill these in as you learn them)

### SQLite database

- **DB file path (dev):** `TBD` (example: `data/product-analyzer.db`)
- **How snapshots are represented today:** `TBD`
  - Table(s): `TBD`
  - Snapshot identifier: `TBD` (id? timestamp? batch id?)
  - Snapshot timestamp column: `TBD`

### Existing schema (paste from SQLite)

Paste outputs here (or link) so the implementation can map to reality:

- `PRAGMA table_info(<table>);`
- `SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name;`

### Canonical-to-existing mapping

If your DB schema differs from the canonical model, document the mapping here:

- Canonical `Product.id` → `<table>.<column>`
- Canonical `Snapshot.takenAt` → `<table>.<column>`
- Canonical `ProductSnapshotValue.key/value` → `<table>.<column>`

### Acceptance criteria (add concrete user-visible behaviors)

- [ ] I can select a product and see all available snapshots ordered by time.
- [ ] I can compare any two snapshots and see Added/Removed/Changed/Unchanged attribute rows.
- [ ] I can see a timeline summary across consecutive snapshots (counts per hop).
- [ ] The UI is usable with 1k+ products and 50+ snapshots (pagination and/or search).

### Non-goals (keep scope sane)

- No writes back to DB (read-only) in v1.
- No auth in v1 (unless required for internal deployment).
- No AI/LLM enrichment in v1.

## Assumptions / Decisions (lock these in early)

- **Source DB schema is fixed**: we read from `DeviceSnapshot` and `DeviceSnapshotJson` (read-only).
- **Product identity** is `(ProductNumber, SerialNumber)`.
- **Snapshot ordering** is by `DeviceSnapshot.TimeStampUtc`.
- **Parameter configurations** (tracked fields + friendly names) are saved **per `ConfigurationId`** in a sidecar DB.
- **Multiple snapshots comparisons/graphs** require all selected snapshots share the same `ConfigurationId` (v1 blocks mismatch).
- **Events arrays** (`EventData.Events`) are not part of the generic parameter diff in v1 (optional summary later).

If any of these are wrong, stop after Task 2 and adjust.

## Repository Layout (to create)

- `apps/web/` — Vite React UI
- `apps/api/` — Fastify API + Prisma + SQLite file access
- `packages/shared/` — shared types + Zod schemas used by both

Note: we will **not** use Prisma for the existing snapshot DB in v1; we’ll use a lightweight SQLite client and keep the source DB read-only.

## Data Model (derived from your actual DB)

We’ll query/represent:

- `Product` (identity):
  - `productNumber: string`
  - `serialNumber: string`

- `Snapshot`:
  - `deviceSnapshotId: string` (DeviceSnapshot.Id)
  - `snapshotId: string` (DeviceSnapshot.SnapshotId)
  - `timeStampUtc: string` (DeviceSnapshot.TimeStampUtc)
  - `configurationId: string`

- `FlattenedField` (computed from JSON):
  - `fieldKey: string` (e.g., `node:master/<FieldId>`, `composite/<FieldId>`, `root/<FieldName>`)
  - `valueText: string | null`
  - `valueType: string | null`

- `ConfigurationField` (stored in sidecar metadata DB):
  - `configurationId: string`
  - `fieldKey: string`
  - `friendlyName?: string`
  - `tracked: boolean`

### Diff logic
For any product and two snapshots (A → B), we compute diffs over **tracked fieldKeys** for the snapshots’ `ConfigurationId`:

- `added`: keys present in B but not A
- `removed`: keys present in A but not B
- `changed`: keys present in both but values differ
- `unchanged`: keys equal

We normalize values as strings for display (`valueText`) and carry `valueType` when present.

---

## Task 1: Workspace + monorepo scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `apps/web/` (Vite)
- Create: `apps/api/` (Fastify)
- Create: `packages/shared/`

**Step 1: Write the failing “smoke test”**

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

- Root `package.json` (workspaces + scripts)

```json
{
  "name": "product-analyzer",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm -w apps/api run dev & npm -w apps/web run dev",
    "test": "npm -ws run test"
  }
}
```

- Create `apps/api/package.json` with `vitest` + `tsx` dev runner.

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS for api workspace smoke test

**Step 5: Commit**

```bash
git add package.json tsconfig.base.json apps/api apps/web packages/shared
git commit -m "chore: scaffold monorepo with web and api"
```

---

## Task 2: Define shared types + Zod schemas

**Files:**
- Create: `packages/shared/src/models.ts`
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

## Task 3: Backend DB access (read-only source DB + sidecar metadata DB)

**Files:**
- Create: `apps/api/src/db/sourceDb.ts`
- Create: `apps/api/src/db/metadataDb.ts`
- Create: `apps/api/src/env.ts`
- Test: `apps/api/src/db/sourceDb.test.ts`
- Test: `apps/api/src/db/metadataDb.test.ts`

**Step 1: Write failing tests**

- source DB: can connect and query `sqlite_master` (or `SELECT 1`)
- metadata DB: creates table `ConfigurationField` and can upsert/query rows

**Step 2: Run tests to verify they fail**

Run: `npm -w apps/api test`
Expected: FAIL (db modules not implemented)

**Step 3: Minimal implementation**

- Use a lightweight SQLite client (Node) to open:
  - `SOURCE_DB_PATH` (existing DB)
  - `METADATA_DB_PATH` (sidecar DB)
- Implement:
  - `getProductNumbers()`
  - `getSerialNumbers(productNumber)`
  - `getSnapshots(productNumber, serialNumber)`
  - metadata: `upsertConfigurationFields(configurationId, fields[])`, `listConfigurationFields(configurationId)`

**Step 4: Run tests to verify pass**

Run: `npm -w apps/api test`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/db apps/api/src/env.ts
git commit -m "feat(api): add sqlite access for source and metadata db"
```

---

## Task 4: Backend API skeleton (Fastify) + health endpoint

**Files:**
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/routes/health.ts`
- Test: `apps/api/src/routes/health.test.ts`

**Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildServer } from "../server";

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = buildServer({ databaseUrl: "file:./tmp-test.db" });
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm -w apps/api test`
Expected: FAIL (buildServer missing)

**Step 3: Minimal Fastify server**

```ts
import Fastify from "fastify";
import { createDb } from "./db";

export function buildServer(opts: { databaseUrl: string }) {
  const app = Fastify();
  const db = createDb({ url: opts.databaseUrl });

  app.get("/health", async () => ({ ok: true }));

  app.addHook("onClose", async () => {
    await db.$disconnect();
  });

  return app;
}
```

**Step 4: Verify tests pass**

Run: `npm -w apps/api test`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/server.ts apps/api/src/routes/health.test.ts
# (route file optional if inlined)
git commit -m "feat(api): add Fastify server and health endpoint"
```

---

## Task 5: Read endpoints: products + snapshots

**Files:**
- Create: `apps/api/src/routes/productNumbers.ts`
- Create: `apps/api/src/routes/serialNumbers.ts`
- Create: `apps/api/src/routes/snapshots.ts`
- Modify: `apps/api/src/server.ts` (register routes)
- Test: `apps/api/src/routes/productNumbers.test.ts`
- Test: `apps/api/src/routes/serialNumbers.test.ts`
- Test: `apps/api/src/routes/snapshots.test.ts`

**Step 1: Write failing tests (seed minimal data via Prisma)**

Example for product numbers:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../server";
import { createDb } from "../db";

describe("GET /product-numbers", () => {
  beforeEach(async () => {
    const db = createDb({ url: "file:./tmp-test.db" });
    // seed a test sqlite db with minimal DeviceSnapshot rows (ProductNumber/SerialNumber)
    await db.$disconnect();
  });

  it("lists product numbers", async () => {
    const app = buildServer({ databaseUrl: "file:./tmp-test.db" });
    const res = await app.inject({ method: "GET", url: "/product-numbers" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(["531285301"]);
  });
});
```

**Step 2: Run tests; verify they fail**

Run: `npm -w apps/api test`
Expected: FAIL (routes not registered)

**Step 3: Implement minimal routes**

- `GET /products?query=` (optional query later)
- `GET /snapshots` ordered by `takenAt DESC`

**Step 4: Run tests; verify pass**

Run: `npm -w apps/api test`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/routes apps/api/src/server.ts
git commit -m "feat(api): add products and snapshots read endpoints"
```

---

## Task 6: Diff endpoint for a product across two snapshots

**Files:**
- Create: `apps/api/src/routes/diff.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `packages/shared/src/diff.ts` (if needed)
- Test: `apps/api/src/routes/diff.test.ts`

**Endpoint shape**

- `GET /products/:productNumber/:serialNumber/diff?snapshotA=<deviceSnapshotId>&snapshotB=<deviceSnapshotId>`

Response:

```ts
{
  productId: string,
  snapshotA: { id: string, takenAt: string },
  snapshotB: { id: string, takenAt: string },
  added: { key: string, to: string | null }[],
  removed: { key: string, from: string | null }[],
  changed: { key: string, from: string | null, to: string | null }[],
  unchanged: { key: string, value: string | null }[]
}
```

**Step 1: Write failing test**

Seed two snapshot JSON payloads (A and B) and expect changed/added/removed for **tracked** keys.

**Step 2: Run test; verify fail**

Run: `npm -w apps/api test`
Expected: FAIL

**Step 3: Minimal implementation**

- Load JSON for both snapshots via `DeviceSnapshotJson`
- Flatten to `{ [fieldKey]: valueText }`
- Filter to tracked keys (from metadata DB for the snapshots’ `ConfigurationId`)
- Call `diffAttributes` from `packages/shared`

---

## Task 7: JSON flattening + field discovery endpoint

**Files:**
- Create: `packages/shared/src/flatten.ts`
- Test: `packages/shared/src/flatten.test.ts`
- Create: `apps/api/src/routes/fields.ts`
- Test: `apps/api/src/routes/fields.test.ts`

**Goal:** given a snapshot JSON payload, return discovered `fieldKey`s and sample values.

**Step 4: Run tests; verify pass**

**Step 5: Commit**

```bash
git add apps/api/src/routes/diff.ts packages/shared/src/diff.ts
git commit -m "feat(api): add diff endpoint for product snapshots"
```

---

## Task 8: Frontend scaffolding (Vite + Tailwind + shadcn/ui)

**Files:**
- Create: `apps/web/` (Vite React TS)
- Create: `apps/web/tailwind.config.*`, `apps/web/postcss.config.*`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/App.tsx`

**Step 1: Write a failing component test**

- Test: `apps/web/src/App.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders header", () => {
    render(<App />);
    expect(screen.getByText(/Product Analyzer/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test; verify fail**

Run: `npm -w apps/web test`
Expected: FAIL (tooling not set)

**Step 3: Implement minimal UI**

- Add Tailwind
- Add shadcn/ui init
- Add `App` with a header “Product Analyzer”

**Step 4: Run test; verify pass**

**Step 5: Commit**

```bash
git add apps/web
git commit -m "chore(web): scaffold Vite React UI with Tailwind"
```

---

## Task 9: Frontend data fetching (product numbers + serial numbers + snapshots)

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/pages/ProductsPage.tsx`
- Create: `apps/web/src/pages/ProductTimelinePage.tsx`
- Modify: `apps/web/src/App.tsx` (routing)
- Test: `apps/web/src/pages/ProductsPage.test.tsx`

**Step 1: Failing test with mocked fetch**

- Mock `fetch` to return `[{ id: "p1", name: "Prod 1" }]`
- Expect list item rendered

**Step 2: Run; verify fail**

**Step 3: Minimal implementation**

- `api.ts` wrappers:
  - `listProductNumbers()`
  - `listSerialNumbers(productNumber)`
  - `listSnapshots(productNumber, serialNumber)`
  - `getSnapshotFields(deviceSnapshotId)`
  - `getConfigurationFields(configurationId)`
  - `saveConfigurationFields(configurationId, payload)`
  - `getProductDiff(productNumber, serialNumber, snapshotA, snapshotB)`
  - `getTimeSeries(productNumber, serialNumber, snapshotIds, fieldKeys)`

Use a single `VITE_API_BASE_URL`.

**Step 4: Run; verify pass**

**Step 5: Commit**

```bash
git add apps/web/src/lib apps/web/src/pages
git commit -m "feat(web): list products and snapshots"
```

---

## Task 10: Parameter configuration editor + diff UI

**Files:**
- Create: `apps/web/src/components/SnapshotPicker.tsx`
- Create: `apps/web/src/components/ParameterConfigEditor.tsx`
- Create: `apps/web/src/components/DiffTable.tsx`
- Modify: `apps/web/src/pages/ProductPage.tsx` (or equivalent)
- Test: `apps/web/src/components/DiffTable.test.tsx`

**Step 1: Write failing tests**

- Given diff response, renders sections: Changed/Added/Removed

**Step 2: Run; verify fail**

**Step 3: Implement minimal components**

- Use shadcn `Select` and `Table`
- Show counts and render rows

**Step 4: Run; verify pass**

**Step 5: Commit**

```bash
git add apps/web/src/components apps/web/src/pages/ProductTimelinePage.tsx
git commit -m "feat(web): add snapshot diff UI"
```

---

## Task 11: Trends view (graphs across many snapshots)

**Files:**
- Create: `apps/api/src/routes/productTimeline.ts` (or extend existing)
- Create: `apps/web/src/components/ChangeTimeline.tsx`
- Test: `apps/api/src/routes/productTimeline.test.ts`

**Backend endpoint**

- `POST /products/:productNumber/:serialNumber/timeseries`

Returns values aligned per snapshot for charting:

```ts
{
  productId: string,
  edges: Array<{
    fromSnapshotId: string,
    toSnapshotId: string,
    fromTakenAt: string,
    toTakenAt: string,
    changedCount: number,
    addedCount: number,
    removedCount: number
  }>
}
```

**Step 1: Write failing tests**

- Seed 3 snapshots, ensure you get 2 edges in correct order.

**Step 2: Run; verify fail**

**Step 3: Implement minimal logic**

- For selected snapshots, load JSON and flatten only selected tracked keys
- Return time-series points: `{ snapshotId, timeStampUtc, valueText }`

**Step 4: Run; verify pass**

**Step 5: Commit**

```bash
git add apps/api/src/routes/productTimeline.ts apps/web/src/components/ChangeTimeline.tsx
git commit -m "feat: add product lifecycle timeline"
```

---

## Task 11: Config + environment variables

**Files:**
- Create: `apps/api/.env.example`
- Create: `apps/web/.env.example`
- Create (optional): `.env` (dev only, gitignored)

**Backend:**
- `DATABASE_URL=file:../data/product-analyzer.db` (example)
- `PORT=3001`

**Frontend:**
- `VITE_API_BASE_URL=http://localhost:3001`

**Step 1: Add failing test that server refuses to start without DATABASE_URL**

**Step 2: Implement env validation using `getEnv()`**

**Step 3: Commit**

---

## Task 12: E2E smoke test (Playwright)

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/smoke.spec.ts`

**Test:**
- Start web + api
- Navigate to `/`
- Expect to see “Product Analyzer”

**Commit**

---

## Task 13: Docs (how to run + DB expectations)

**Files:**
- Create: `README.md`

Include:
- required Node version
- how to set up `.env`
- where to place the SQLite file
- how “snapshot” is expected to be represented

---

## Verification Checklist (run before merge)

- `npm test` passes in all workspaces
- `npm run dev` starts API + Web
- Manual sanity:
  - Products list loads
  - Snapshots list loads
  - Diff view shows changed/added/removed
  - Timeline view renders edges

---

## Execution handoff

Plan complete and saved to `docs/plans/2026-02-17-product-analyzer.md`. Two execution options:

1. **Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Parallel Session (separate)** — Open a new session in a worktree; that session uses superpowers:executing-plans

Which approach do you want?