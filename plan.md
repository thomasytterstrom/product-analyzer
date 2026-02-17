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
- [x] Step 6: Re-review commit `5e7c3e2145e3ce2f9b9170944716298a148f4721` (CardTitle ref typing + guard + dependency removal) → run repo tests + typecheck → expect PASS

## Follow-ups
- [x] Code quality review: UI polish (Tailwind + shadcn/ui) in `apps/web`
- [x] Manual run against real DB
- [x] Add server-side timeseries endpoint and switch UI trends to it
- [x] Optional: add server-side diff endpoint and switch UI to it
- [x] Plot numeric trend values as a chart in the UI

## Task 7: Web UX adjustment — combine Fields + Friendly names
- [x] Step 1: Update web UI tests to expect a single combined Fields section → run → expect FAIL
- [x] Step 2: Update `apps/web/src/App.tsx` to remove separate Field discovery + Tracked fields cards
	- One table shows: Field key, Value (A), Type, Tracked, Friendly name
	- Value/Type are read-only, sourced from Snapshot A
	- Editing/saving tracked/friendly is disabled when ConfigurationId is missing
- [x] Step 3: Run `npm -w apps/web test` → expect PASS
- [x] Step 4: Run `npm -w apps/web run typecheck` → expect PASS
- [x] Step 5: Commit (`feat(web): combine field discovery and friendly names`)

## Task 8: Web UX — filter/search Fields table
- [x] Step 1: Update web UI tests for a Fields filter input (by field key + friendly name) → run → expect FAIL
- [x] Step 2: Update `apps/web/src/App.tsx` to add a filter input and apply it to the Fields (Snapshot A) table
	- Case-insensitive substring match
	- Should work whether we’re showing discovered `fields` (no ConfigurationId) or `configurationFields`
	- Should not affect saved payloads (filter is purely a view concern)
- [x] Step 3: Run `npm -w apps/web test` → expect PASS
- [x] Step 4: Run `npm -w apps/web run typecheck` → expect PASS
- [x] Step 5: Commit (`feat(web): add field filter`)

## Task 8: Web UX adjustment — move Trends into a tab

Follow `docs/plans/2026-02-17-trends-tab-web-ux.md`.

- [x] Step 1: Update web UI tests to expect an Analysis tablist (Diff default, Trends hidden by default)
- [x] Step 2: Run `npm -w apps/web test` → expect FAIL
- [x] Step 3: Update `apps/web/src/App.tsx` to render Diff/Trends under tabs (keep behavior)
- [x] Step 4: Run `npm -w apps/web test` → expect PASS
- [x] Step 5: Run `npm -w apps/web run typecheck` → expect PASS
- [ ] Step 6: Commit (`feat(web): move trends into analysis tab`)
