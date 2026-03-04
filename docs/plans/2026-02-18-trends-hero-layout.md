# Trends Hero Layout (Web UI) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Trends chart more prominent ("hero"), and lay out snapshot selection + trend field selection as two columns under the Trends section.

**Architecture:** This is a pure web UI layout refactor in `apps/web/src/App.tsx`.
- Keep all existing Trends data flow (snapshot A provides `ConfigurationId`, tracked fields drive selectable trend fields, explicit “Show trend” fetch to `/timeseries`).
- Keep existing accessibility hooks (notably `aria-label="Trend chart"` and `role="list" aria-label="Trend series"`).
- Add a small number of stable test hooks (`data-testid`) for layout assertions.

**Tech Stack:** React + TypeScript (Vite), Tailwind, shadcn/ui primitives, Recharts, Vitest + Testing Library.

---

## Acceptance criteria

- [ ] In the Analysis → Trends tab, the chart area is visually prominent (hero) and placed above the controls.
- [ ] Snapshot selection (Include snapshots) and trend field selection (Trend fields) render as two columns on `md+` screens and stack on small screens.
- [ ] Existing behavior is unchanged:
  - [ ] Trends still requires Snapshot A with `root/ConfigurationId`.
  - [ ] “Show trend” still performs the only fetch; no auto-fetch is introduced.
  - [ ] Tables per selected field still render, ordered by `timeStampUtc` ascending.
  - [ ] Numeric series still render on the chart and keep deterministic series colors.
- [ ] `npm -w apps/web test` passes.
- [ ] `npm -w apps/web run typecheck` passes.

## Non-goals

- No change to the timeseries API contract.
- No new chart interactions (zoom/brush) or state persistence.
- No virtualization of the snapshot/field lists.

---

### Task 1: Add a failing test for the new Trends layout

**Files:**
- Modify: `apps/web/src/App.test.tsx`

**Step 1: Write the failing test**

Add a new test near the existing Trends tests:

```ts
it("lays out Trends controls as two columns under a hero chart panel", async () => {
  globalThis.fetch = async (url: any, init?: any) => {
    const u = String(url);

    if (u.endsWith("/product-numbers")) {
      return new Response(JSON.stringify(["531285301"]), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (u.includes("/serial-numbers")) {
      return new Response(JSON.stringify(["S1"]), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (u.includes("/products/") && u.includes("/snapshots")) {
      return new Response(
        JSON.stringify([
          { deviceSnapshotId: "ds2", snapshotId: "snap-2", timeStampUtc: "2026-02-18T07:50:23.000Z" },
          { deviceSnapshotId: "ds1", snapshotId: "snap-1", timeStampUtc: "2026-02-17T07:50:23.000Z" }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    // Snapshot A (selected) => provides ConfigurationId
    if (u.includes("/snapshots/ds1/fields")) {
      return new Response(
        JSON.stringify([
          { fieldKey: "root/ConfigurationId", valueText: "cfg-1", valueType: "string" },
          { fieldKey: "root/FirmwareVersion", valueText: "1", valueType: "number" }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (u.includes("/configurations/cfg-1/fields")) {
      return new Response(
        JSON.stringify([
          {
            configurationId: "cfg-1",
            fieldKey: "root/FirmwareVersion",
            tracked: true,
            friendlyName: "FW"
          }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  };

  render(<App />);

  await screen.findByRole("option", { name: "531285301" });
  fireEvent.change(screen.getByLabelText("Product number"), { target: { value: "531285301" } });

  await screen.findByRole("option", { name: "S1" });
  fireEvent.change(screen.getByLabelText("Serial number"), { target: { value: "S1" } });

  // Select snapshot A => enables trends
  fireEvent.click(await screen.findByText(/snap-1/));

  // Switch to Workspace: Analysis, then Analysis tab: Trends
  {
    const workspaceTabs = screen.getByRole("tablist", { name: /workspace/i });
    fireEvent.click(within(workspaceTabs).getByRole("tab", { name: /analysis/i }));

    const analysisTabs = screen.getByRole("tablist", { name: /analysis/i });
    fireEvent.click(within(analysisTabs).getByRole("tab", { name: /trends/i }));
  }

  const hero = await screen.findByTestId("trend-hero");
  const controls = await screen.findByTestId("trend-controls-grid");

  // “Hero chart” panel exists and appears above controls in DOM order.
  expect(hero).toBeInTheDocument();
  expect(controls).toBeInTheDocument();
  expect(hero.compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  // Controls are a responsive two-column grid.
  expect(controls).toHaveClass("grid");
  expect(controls).toHaveClass("md:grid-cols-2");

  // Section headings still present.
  expect(within(controls).getByText(/include snapshots/i)).toBeInTheDocument();
  expect(within(controls).getByText(/trend fields/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm -w apps/web test`

Expected: FAIL because `trend-hero` and `trend-controls-grid` don’t exist yet and the layout hasn’t been updated.

**Step 3: Commit (tests only)**

```bash
git add apps/web/src/App.test.tsx
git commit -m "test(web): expect trends hero chart and two-column controls"
```

---

### Task 2: Implement hero chart panel + two-column controls layout

**Files:**
- Modify: `apps/web/src/App.tsx`

**Step 1: Minimal implementation (layout-only)**

In the Trends panel (`id="analysis-trends-panel"`), restructure the enabled Trends UI from:
- a single vertical `grid` containing:
  - Include snapshots
  - Trend fields
  - Show trend
  - Results (chart + series list + tables)

…to:

1) **Hero chart panel** at the top (always rendered when Trends is enabled):
- Add a wrapper with `data-testid="trend-hero"`.
- When numeric series exist, render the existing Recharts chart inside it (keeping `aria-label="Trend chart"`).
- Otherwise render an empty-state message (do **not** add `aria-label="Trend chart"` for the placeholder).

Suggested structure:

```tsx
<div
  data-testid="trend-hero"
  className="rounded-lg border bg-muted/20 p-4 md:p-6"
>
  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
    <div className="space-y-1">
      <div className="text-sm font-medium">Chart</div>
      <div className="text-xs text-muted-foreground">
        Numeric tracked fields plotted over time.
      </div>
    </div>
  </div>

  {numericTrendSeries.length > 0 && numericTrendChartRows.length >= 2 ? (
    <div aria-label="Trend chart" className="h-72 w-full md:h-96">
      {/* existing <ResponsiveContainer><LineChart>… */}
    </div>
  ) : (
    <div className="flex h-40 items-center justify-center rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">
      Select snapshots + fields, then click “Show trend” to render a chart.
    </div>
  )}
</div>
```

2) **Controls grid** under the hero:
- Wrap the two selection sections in a container with `data-testid="trend-controls-grid"`.
- Use `className="grid gap-4 md:grid-cols-2"`.

```tsx
<div data-testid="trend-controls-grid" className="grid gap-4 md:grid-cols-2">
  {/* Include snapshots section */}
  {/* Trend fields section */}
</div>
```

3) Keep the “Show trend” button below the control grid, right-aligned on wider screens:

```tsx
<div className="flex flex-wrap gap-2 md:justify-end">
  <Button ...>Show trend</Button>
</div>
```

4) Keep the existing results area (series list + per-field tables) below the button:
- Do not change `aria-label="Trend series"`.
- Do not change table `aria-label` values (`Trend ${fieldKey}`), so existing tests remain stable.

**Step 2: Run tests to verify they pass**

Run: `npm -w apps/web test`

Expected: PASS

**Step 3: Run typecheck**

Run: `npm -w apps/web run typecheck`

Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): make trends chart hero and controls two-column"
```

---

### Task 3: Manual UX sanity check

**Files:**
- None

**Step 1: Run dev**

Run: `npm -w apps/web run dev`

Expected:
- Trends shows a prominent chart area above controls.
- Include snapshots + Trend fields are two columns on desktop, stacked on mobile.
- After “Show trend”, chart is large enough to feel like the main focus.

**Step 2: No commit**

---

## Verification checklist

- `npm -w apps/web test` ✅
- `npm -w apps/web run typecheck` ✅
- Manual:
  - Trends feels less “tall”/cluttered
  - Chart is visually prominent (hero)
  - Controls are side-by-side on `md+`

---

## Execution handoff

Plan complete and saved to `docs/plans/2026-02-18-trends-hero-layout.md`. Two execution options:

1. **Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Parallel Session (separate)** — Open a new session in a worktree; that session uses superpowers:executing-plans

Which approach do you want?
