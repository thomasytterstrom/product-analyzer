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

## Task 8: Web UX adjustment — fields table tweaks


- [x] Step 1: Update web UI tests for fields table layout + interactions
	- Remove Type column
	- Value column should be wider
	- Clicking “Track” should persist the change immediately (same as Save)

- [x] Step 2: Run `npm -w apps/web test` → verify PASS (behavior already implemented)

- [x] Step 3: Confirm `apps/web/src/App.tsx` already:
	- Remove Type column from table
	- Make Value column wider (layout/utility classes)
	- Save tracked state when clicking Track (no separate Save required for that action)

- [x] Step 4: Run `npm -w apps/web test` → PASS

- [x] Step 5: Run `npm -w apps/web run typecheck` → PASS

- [x] Step 6: Commit already done in `d955c37` (`chore(web): improve fields table a11y and save errors`)

- [x] Step 7: Update web UI tests for wider Friendly name column + slightly wider page container
	- Friendly name column should be larger
	- Increase overall content width (container max width)
- [x] Step 8: Run `npm -w apps/web test` → expect FAIL
- [x] Step 9: Update `apps/web/src/App.tsx` to:
	- Increase Friendly name column width
	- Increase container max width (e.g., max-w-7xl)
- [x] Step 10: Run `npm -w apps/web test` → expect PASS
- [x] Step 11: Run `npm -w apps/web run typecheck` → expect PASS

## Task 9: Web UX adjustment — move Trends into a tab

Follow `docs/plans/2026-02-17-trends-tab-web-ux.md`.

Implemented via the Workspace (Configure/Analysis) tabs + nested Analysis (Diff/Trends) tabs in `apps/web/src/App.tsx`, with coverage in `apps/web/src/App.test.tsx`.

- [x] Step 1: Update web UI tests to expect an Analysis tablist (Diff default, Trends hidden by default)
- [x] Step 2: Run `npm -w apps/web test` → expect FAIL
- [x] Step 3: Update `apps/web/src/App.tsx` to render Diff/Trends under tabs (keep behavior)
- [x] Step 4: Run `npm -w apps/web test` → expect PASS
- [x] Step 5: Run `npm -w apps/web run typecheck` → expect PASS
- [x] Step 6: Commit (`feat(web): move trends into analysis tab`)

## Task 10: Web UX adjustment — separate Configure fields from Analysis

Follow `docs/plans/2026-02-17-separate-configure-fields-from-analysis-design.md`.

- [x] Step 1: Update web UI tests to expect a Workspace tablist (Configure fields default, Analysis hidden)
- [x] Step 2: Run `npm -w apps/web test` → expect FAIL
- [x] Step 3: Update `apps/web/src/App.tsx` to:
	- Wrap Fields UI in a “Configure fields” tabpanel (default)
	- Move Diff+Trends under an “Analysis” tabpanel
	- Keep Diff/Trends behavior; keep headings inside panels
	- On “Compare” click, auto-switch to Analysis → Diff
- [x] Step 4: Run `npm -w apps/web test` → expect PASS
- [x] Step 5: Run `npm -w apps/web run typecheck` → expect PASS
	- [x] Step 6: Commit (`feat(web): separate configure fields from analysis`)

## Task 11: Web Trends — multi-field chart (Recharts)

Follow `docs/plans/2026-02-17-trends-chart-design.md`.

- [x] Step 1: Update web UI tests to support selecting multiple trend fields and expect multiple-series rendering
- [x] Step 2: Run `npm -w apps/web test` → expect FAIL
- [x] Step 3: Add `recharts` dependency to `apps/web`
- [x] Step 4: Update `apps/web/src/setupTests.ts` with a minimal `ResizeObserver` polyfill (for JSDOM)
- [x] Step 5: Update `apps/web/src/App.tsx` Trends to:
	- Select multiple tracked fields (checkboxes or multi-select)
	- POST `/timeseries` with multiple `fieldKeys`
	- Render a single multi-line chart for numeric series
	- Keep table output (and show non-numeric series as table-only)
- [x] Step 6: Run `npm -w apps/web test` → expect PASS
- [x] Step 7: Run `npm -w apps/web run typecheck` → expect PASS
- [x] Step 8: Commit (`feat(web): multi-field trends chart`)

## Task 12: Web UI bugfix — Fields table key/value overlap

- [x] Step 1: Add failing web UI test covering long Field key text not visually overlapping Value (A)
- [x] Step 2: Run `npm -w apps/web test` → expect FAIL
- [x] Step 3: Fix Fields (Snapshot A) Field key cell styling so long keys wrap/truncate instead of overlapping
- [x] Step 4: Run `npm -w apps/web test` → expect PASS
- [x] Step 5: Run `npm -w apps/web run typecheck` → expect PASS

## Task 13: Web Trends — deterministic series colors

Follow `docs/plans/2026-02-18-trends-chart-series-colors.md`.

- [x] Step 1: Add failing web UI test asserting distinct series colors + stable series markers
- [x] Step 2: Run `npm -w apps/web test` → expect FAIL
- [x] Step 3: Add shadcn-style chart color tokens (`--chart-1`..`--chart-5`) + Tailwind `chart` palette
- [x] Step 4: Wire chart series strokes + series list markers to the palette
- [x] Step 5: Run `npm -w apps/web test` → expect PASS
- [x] Step 6: Run `npm -w apps/web run typecheck` → expect PASS

## Task 14: Web Trends — hero chart + two-column controls

Follow `docs/plans/2026-02-18-trends-hero-layout.md`.

- [x] Step 1: Add failing Trends layout test (`apps/web/src/App.test.tsx`)
- [x] Step 2: Run `npm -w apps/web test` → expect FAIL
- [x] Step 3: Update Trends layout in `apps/web/src/App.tsx` (hero chart + 2-column controls)
- [x] Step 4: Run `npm -w apps/web test` → expect PASS
- [x] Step 5: Run `npm -w apps/web run typecheck` → expect PASS
- [x] Step 6: Commit (`feat(web): make trends chart hero and controls two-column`)

## Task 15: Web Trends — values table shows friendly name

- [x] Step 1: Update/add a failing web UI test asserting the trend values table clearly indicates the friendly name
- [x] Step 2: Run `npm -w apps/web test` → expect FAIL
- [x] Step 3: Update `apps/web/src/App.tsx` Trends values table labeling (aria + visible) to include friendly name (and field key when different)
- [x] Step 4: Run `npm -w apps/web test` → expect PASS
- [x] Step 5: Run `npm -w apps/web run typecheck` → expect PASS

## Task 16: Web Trends — series label above values table (friendly-only)

- [x] Step 1: Update/add a failing web UI test asserting the per-series values table has a visible, easier-to-see label above it using the friendly name
- [x] Step 2: Run `npm -w apps/web test` → expect FAIL
- [x] Step 3: Update `apps/web/src/App.tsx` to render a visible series label above each values table (friendly name only; fallback to field key if missing/blank)
- [x] Step 4: Run `npm -w apps/web test` → expect PASS
- [x] Step 5: Run `npm -w apps/web run typecheck` → expect PASS

## Task 17: Web Trends — select all snapshots + values tables in columns

Follow `docs/plans/2026-02-18-trends-select-all-and-values-columns.md`.

- [x] Step 1: Add failing web UI tests for:
	- Select all snapshots control in Trends include snapshots
	- Multi-column layout for trend values tables
- [x] Step 2: Run `npm -w apps/web test` → expect FAIL
- [x] Step 3: Implement Select all snapshots control in `apps/web/src/App.tsx`
- [x] Step 4: Implement multi-column layout for trend values tables in `apps/web/src/App.tsx`
- [x] Step 5: Run `npm -w apps/web test` → expect PASS
- [x] Step 6: Run `npm -w apps/web run typecheck` → expect PASS
- [x] Step 7: Commit

## Task 18: Web Trends — visualize timestamp range

- [x] Step 1: Add failing web UI test for visible timestamp/time-range label in the Trends hero chart
- [x] Step 2: Run `npm -w apps/web test` → expect FAIL
- [x] Step 3: Update `apps/web/src/App.tsx` to render a visible trend time range label (and format chart tooltip timestamp)
- [x] Step 4: Run `npm -w apps/web test` → expect PASS
- [x] Step 5: Run `npm -w apps/web run typecheck` → expect PASS
