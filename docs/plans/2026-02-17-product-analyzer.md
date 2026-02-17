# Product Analyzer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Vite (React) web app + Node backend that reads snapshot data from a local SQLite database and visualizes how product attribute values change over time.

**Architecture:** A small monorepo with `apps/web` (Vite + Tailwind + shadcn/ui) calling `apps/api` (Fastify + Prisma + SQLite). The backend exposes read-only endpoints for products, snapshots, and computed “diffs” between snapshots; the frontend renders a product timeline view and snapshot-to-snapshot comparisons.

**Tech Stack:** Vite + React + TypeScript, Tailwind CSS, shadcn/ui, Fastify, Prisma (SQLite), Zod, Vitest, Playwright.

---

## Assumptions / Decisions (lock these in early)

- **Data is already in SQLite** (as you described). If schema is unknown, we’ll add an adapter layer to map existing tables into a canonical model.
- **Read-only first**: we focus on analysis + visualization; any write/import tools come later.
- **Snapshot definition**: a “snapshot” is a point-in-time capture of product attributes (e.g., daily export). Snapshots must be orderable by timestamp.

If any of these are wrong, stop after Task 2 and adjust.

## Repository Layout (to create)

- `apps/web/` — Vite React UI
- `apps/api/` — Fastify API + Prisma + SQLite file access
- `packages/shared/` — shared types + Zod schemas used by both

## Data Model (canonical, even if your DB differs)

We’ll query/represent:

- `Product`:
  - `id: string` (or int)
  - `name: string`
  - `sku?: string`
  - `category?: string`

- `Snapshot`:
  - `id: string` (or int)
  - `takenAt: datetime`
  - `source?: string` (optional label)

- `ProductSnapshotValue`:
  - `productId`
  - `snapshotId`
  - `key: string` (attribute name)
  - `value: string | number | boolean | null`

### Diff logic
For any product and two snapshots (A → B), we compute:

- `added`: keys present in B but not A
- `removed`: keys present in A but not B
- `changed`: keys present in both but values differ
- `unchanged`: keys equal

We’ll normalize values as strings for display, but preserve raw type where possible.

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

## Task 3: Backend DB access (Prisma + SQLite)

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/db.ts`
- Create: `apps/api/src/env.ts`
- Test: `apps/api/src/db.test.ts`

**Step 0: Decide DB mode**

Two options:
1) **Use existing SQLite file** (recommended): backend points Prisma at an existing `.db` file.
2) **Create new DB schema**: add migrations and (optionally) an import routine.

This plan assumes (1), but we’ll still create a minimal canonical schema so the code is testable.

**Step 1: Write failing test for DB connection**

```ts
import { describe, expect, it } from "vitest";
import { createDb } from "./db";

describe("db", () => {
  it("can connect and run a simple query", async () => {
    const db = createDb({ url: "file:./tmp-test.db" });
    const result = await db.$queryRawUnsafe<{ ok: number }[]>("SELECT 1 as ok");
    expect(result[0].ok).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm -w apps/api test`
Expected: FAIL (Prisma not installed / createDb missing)

**Step 3: Minimal Prisma + db wrapper**

- `schema.prisma` (canonical tables)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Product {
  id        String   @id
  name      String
  sku       String?
  category  String?
  values    ProductSnapshotValue[]
}

model Snapshot {
  id       String   @id
  takenAt  DateTime
  source   String?
  values   ProductSnapshotValue[]
}

model ProductSnapshotValue {
  productId  String
  snapshotId String
  key        String
  value      String?

  product  Product  @relation(fields: [productId], references: [id])
  snapshot Snapshot @relation(fields: [snapshotId], references: [id])

  @@id([productId, snapshotId, key])
  @@index([snapshotId])
  @@index([productId])
}
```

- `env.ts`

```ts
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1)
});

export function getEnv(env: NodeJS.ProcessEnv) {
  return EnvSchema.parse(env);
}
```

- `db.ts`

```ts
import { PrismaClient } from "@prisma/client";

export function createDb(opts: { url: string }) {
  return new PrismaClient({ datasources: { db: { url: opts.url } } });
}
```

**Step 4: Run tests to verify it passes**

Run: `npm -w apps/api test`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/prisma apps/api/src/db.ts apps/api/src/env.ts apps/api/src/db.test.ts
git commit -m "feat(api): add Prisma sqlite db access"
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
- Create: `apps/api/src/routes/products.ts`
- Create: `apps/api/src/routes/snapshots.ts`
- Modify: `apps/api/src/server.ts` (register routes)
- Test: `apps/api/src/routes/products.test.ts`
- Test: `apps/api/src/routes/snapshots.test.ts`

**Step 1: Write failing tests (seed minimal data via Prisma)**

Example for products:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../server";
import { createDb } from "../db";

describe("GET /products", () => {
  beforeEach(async () => {
    const db = createDb({ url: "file:./tmp-test.db" });
    await db.product.deleteMany();
    await db.product.create({ data: { id: "p1", name: "Prod 1" } });
    await db.$disconnect();
  });

  it("lists products", async () => {
    const app = buildServer({ databaseUrl: "file:./tmp-test.db" });
    const res = await app.inject({ method: "GET", url: "/products" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ id: "p1", name: "Prod 1" }]);
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

- `GET /products/:productId/diff?snapshotA=<id>&snapshotB=<id>`

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

Seed values for A and B and expect changed/added/removed.

**Step 2: Run test; verify fail**

Run: `npm -w apps/api test`
Expected: FAIL

**Step 3: Minimal implementation**

- Query `ProductSnapshotValue` for `(productId, snapshotId)` for both snapshots
- Convert arrays to maps `{ [key]: value }`
- Call `diffAttributes` from `packages/shared`

**Step 4: Run tests; verify pass**

**Step 5: Commit**

```bash
git add apps/api/src/routes/diff.ts packages/shared/src/diff.ts
git commit -m "feat(api): add diff endpoint for product snapshots"
```

---

## Task 7: Frontend scaffolding (Vite + Tailwind + shadcn/ui)

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

## Task 8: Frontend data fetching (products + snapshots)

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
  - `listProducts()`
  - `listSnapshots()`
  - `getProductDiff(productId, snapshotA, snapshotB)`

Use a single `VITE_API_BASE_URL`.

**Step 4: Run; verify pass**

**Step 5: Commit**

```bash
git add apps/web/src/lib apps/web/src/pages
git commit -m "feat(web): list products and snapshots"
```

---

## Task 9: Product diff UI (snapshot picker + diff table)

**Files:**
- Create: `apps/web/src/components/SnapshotPicker.tsx`
- Create: `apps/web/src/components/DiffTable.tsx`
- Modify: `apps/web/src/pages/ProductTimelinePage.tsx`
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

## Task 10: “Lifecycle” view: timeline of changes across many snapshots

**Files:**
- Create: `apps/api/src/routes/productTimeline.ts` (or extend existing)
- Create: `apps/web/src/components/ChangeTimeline.tsx`
- Test: `apps/api/src/routes/productTimeline.test.ts`

**Backend endpoint**

- `GET /products/:productId/timeline`

Returns an array of consecutive diffs:

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

- For each consecutive snapshot pair, compute diff counts only (cheap)

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