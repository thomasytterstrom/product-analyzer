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
- [x] Dev server reads env + connects SQLite
- [x] Task 7: Metadata endpoints (tracked fields + friendly names)

- [x] Web UI
	- [x] Web API client: `getSnapshotFields(deviceSnapshotId)`
	- [x] Web UI: show snapshot fields (parameter discovery)
	- [x] Web UI: tracked fields editor (per ConfigurationId)
	- [x] Code review: tracked-fields editor contract alignment
	- [x] Web UI: diff two snapshots
	- [x] Web UI: trends/graphs across snapshots

## Task 5: Web UI polish (Tailwind + shadcn/ui)
- [x] Step 1: Add/adjust a UI structure test for `apps/web` → run → expect FAIL
- [x] Step 2: Add Tailwind CSS to `apps/web` (deps + configs + `index.css`) → run tests
- [x] Step 3: Add shadcn/ui basics (utils + ui components) → run typecheck
- [x] Step 4: Refactor `App.tsx` to use Tailwind + shadcn components (keep behavior + a11y)
- [x] Step 5: Run `npm -w apps/web test` + `npm -w apps/web run typecheck` → expect PASS
- [x] Step 6: Commit (`feat(web): add tailwind + shadcn ui`)

## Task 6: Code quality review fixes (web)
- [x] Step 1: Add typecheck guard for `CardTitle` ref element type → run typecheck → expect FAIL
- [x] Step 2: Fix `CardTitle` forwardRef typing in `apps/web/src/components/ui/card.tsx` → run typecheck → expect PASS
- [x] Step 3: Confirm `lucide-react` is unused in `apps/web/src/**` and remove dependency + lockfile entry
- [x] Step 4: Run `npm -w apps/web test` + `npm -w apps/web run typecheck` → expect PASS
- [x] Step 5: Commit (`chore(web): fix card typings`)

## Follow-ups
- [x] Code quality review: UI polish (Tailwind + shadcn/ui) in `apps/web`
- [ ] Manual run against real DB
- [ ] Optional: add server-side diff/timeseries endpoints and switch UI to them
