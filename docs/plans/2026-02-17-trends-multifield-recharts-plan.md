# Trends — Multi-field chart (Recharts) Implementation Plan

**Date:** 2026-02-17

Follow `docs/plans/2026-02-17-trends-chart-design.md`.

## Goal
Upgrade the Trends UI so a user can select **multiple tracked fields** and render a **single multi-line chart** (numeric series only), while keeping the existing table output.

## Current state (baseline)
- `apps/web/src/App.tsx` Trends:
  - Select snapshots via checkboxes
  - Select **one** trend field via `<select>`
  - Calls `getTimeSeries(..., fieldKeys: [trendFieldKey])`
  - Renders table of points
  - Renders a simple inline SVG chart for numeric points (single series)

## Acceptance criteria
- User can select **multiple** tracked field keys for Trends.
- Clicking “Show trend” posts **multiple** `fieldKeys` to `/timeseries`.
- If at least one selected field yields numeric points:
  - Show a single chart with **one line per numeric field**
  - Show legend labels using friendly name when available, else field key
- Non-numeric selected fields are not charted (v1) but are still shown in the table.
- All `apps/web` tests and `typecheck` pass.

## Non-goals
- Zoom/brush/pan.
- Multiple y-axes.
- Auto-fetch on every selection change.

---

## Task 1 — Tests first (expect fail)
**File:** `apps/web/src/App.test.tsx`

1) Update existing Trends tests to match the new UI:
- Replace “Trend field” single-select usage with multi-field selection.
- Keep existing snapshot selection flow.

2) Add a new test that proves multi-series behavior:
- Mark two fields as tracked via the configuration fields endpoint.
- Select both fields in Trends.
- Stub `/timeseries` to return **two** series with numeric values.
- Assert that:
  - a chart container exists (keep using `aria-label="Trend chart"`)
  - a legend/series list contains two labels (e.g. “FW” and another friendly name)

**Run:** `npm -w apps/web test` → FAIL

---

## Task 2 — Add chart library dependency
**Files:**
- `apps/web/package.json`
- lockfile

Add `recharts` dependency to `apps/web`.

---

## Task 3 — JSDOM compatibility
**File:** `apps/web/src/setupTests.ts`

Add a minimal `ResizeObserver` polyfill so Recharts’ responsive features don’t crash tests.

---

## Task 4 — Implement multi-field Trends UI
**File:** `apps/web/src/App.tsx`

1) State changes
- Replace single `trendFieldKey: string` with `trendFieldKeys: string[]`.
- Replace `trendRows` with a structure that can hold multiple series, e.g.:
  - `trendSeries: Array<{ fieldKey: string; points: Array<{ timeStampUtc: string; valueText: string | null; valueType: string | null }> }>`

2) Field selection UI
- Replace the `<select>` with a list of checkboxes for tracked fields.
- Labels should prefer friendly name where possible.

3) Fetch logic
- Update `showTrend()` to pass `fieldKeys: trendFieldKeys`.
- Store the entire returned series array in state.

4) Chart data transformation
- Compute `numericFieldKeys` where values can be parsed as numbers.
- Build merged `chartRows` keyed by `timeStampUtc`:
  - `[{ timeStampUtc, [fieldKey]: number | null }, ...]`
- Missing values become `null` so lines show gaps.

5) Rendering
- Render a single multi-line Recharts chart when at least one numeric series exists.
- Keep table output; either:
  - a combined table per timestamp/field, or
  - one table per selected field (simpler, stable).

6) Accessibility/testing hooks
- Keep `aria-label="Trend chart"` on a stable container.
- Provide a stable series name list (e.g. `aria-label="Trend series"`) so tests don’t depend on Recharts internals.

---

## Task 5 — Verify
- `npm -w apps/web test`
- `npm -w apps/web run typecheck`

---

## Task 6 — Commit
Commit message:
- `feat(web): multi-field trends chart`
