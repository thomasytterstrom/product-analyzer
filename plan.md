# plan.md — Product Analyzer (execution)

Follow `docs/plans/2026-02-17-product-analyzer.md`.

## Task 1: Workspace + monorepo scaffolding
- [x] Step 1: Add failing smoke test (`apps/api/src/smoke.test.ts`)
- [x] Step 2: Run `npm test` → expect FAIL
- [x] Step 3: Add monorepo scripts + minimal workspaces
- [x] Step 4: Run `npm test` → expect PASS
- [x] Step 5: Commit

## Task 2: Shared diff
- [x] Write failing test
- [x] Run → FAIL
- [x] Implement `diffAttributes`
- [x] Run → PASS
- [x] Commit

## Task 3: Flatten JSON
- [x] Write failing test
- [x] Run → FAIL
- [x] Implement `flattenSnapshotJson`
- [x] Run → PASS
- [x] Commit

## Task 4+: API + UI
- [x] DB access modules
- [x] Fastify server + endpoints
- [ ] Web UI (in progress)
