# Trends Tab (Web UI) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce UI clutter by moving the existing **Trends** section into a dedicated tab in the web app.

**Architecture:** Keep the current single-page `App.tsx` flow, but replace the always-visible “Diff” + “Trends” cards with a small **tabbed “Analysis” area**. Default tab is **Diff**; **Trends** renders only when its tab is selected.

**Tech Stack:** React + TypeScript (Vite), Tailwind, existing shadcn/ui primitives (`Button`, `Card`, etc.), Vitest + Testing Library.

---

## Context (current state)

- File: `apps/web/src/App.tsx`
  - Renders cards in order: Selection, Snapshots, Fields (Snapshot A), Diff, Trends.
  - “Trends” is currently always rendered (even if empty/disabled).
- File: `apps/web/src/App.test.tsx`
  - Has a layout test that currently expects a `heading` named **Trends** to exist immediately.

## Acceptance criteria

- [ ] The “Trends” UI is no longer always visible.
- [ ] There is a tabbed UI control with at least two tabs: **Diff** and **Trends**.
- [ ] Default selected tab is **Diff**.
- [ ] Clicking the **Trends** tab shows the existing Trends UI, unchanged in behavior:
  - selecting snapshots + field + clicking “Show trend” still fetches `/timeseries` and renders the table (and chart for numeric values).
- [ ] All `apps/web` tests pass.

## Non-goals (keep it small)

- No routing changes.
- No persistence of the selected tab (URL/localStorage) in v1.
- No new dependency (e.g. Radix Tabs) unless strictly necessary.

---

### Task 1: Update tests to require a tabbed Analysis area

**Files:**
- Modify: `apps/web/src/App.test.tsx`

**Step 1: Write the failing test**

Update `it("renders semantic layout regions and key sections")` to:

- Still assert the landmarks and the always-present sections:
  - Selection
  - Snapshots
  - Fields (Snapshot A)
- Replace the “Trends heading exists immediately” assertion with:
  - A `tablist` exists for analysis
  - A tab named “Diff” exists and is selected by default
  - A tab named “Trends” exists
  - The Trends heading is **not** present by default
  - After clicking the “Trends” tab, the Trends heading becomes present

Suggested test code (drop-in replacement for the end of that test):

```ts
// Analysis tabs
const tabs = screen.getByRole("tablist", { name: /analysis/i });
const diffTab = within(tabs).getByRole("tab", { name: /diff/i });
const trendsTab = within(tabs).getByRole("tab", { name: /trends/i });

expect(diffTab).toHaveAttribute("aria-selected", "true");
expect(trendsTab).toHaveAttribute("aria-selected", "false");

// Trends should not be visible by default
expect(screen.queryByRole("heading", { name: /trends/i })).not.toBeInTheDocument();

fireEvent.click(trendsTab);
expect(await screen.findByRole("heading", { name: /trends/i })).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npm -w apps/web test`

Expected: FAIL because there is no tablist/tabs yet and Trends is still rendered.

**Step 3: Commit (tests only)**

```bash
git add apps/web/src/App.test.tsx
git commit -m "test(web): expect trends under analysis tab"
```

---

### Task 2: Implement the Diff/Trends tab UI (minimal, accessible)

**Files:**
- Modify: `apps/web/src/App.tsx`

**Step 1: Write minimal implementation**

1) Add UI state near other `useState` calls:

```ts
type AnalysisTab = "diff" | "trends";
const [analysisTab, setAnalysisTab] = useState<AnalysisTab>("diff");
```

2) Replace the current two cards:
- `<Card>…Diff…</Card>`
- `<Card>…Trends…</Card>`

…with a single “Analysis” Card containing:

- A `role="tablist"` element labelled “Analysis”
- Two tab buttons (Diff/Trends) with:
  - `role="tab"`
  - `aria-selected={analysisTab === "diff"}` etc
  - `aria-controls` pointing at panel ids
- Two panels with:
  - `role="tabpanel"`
  - `hidden={analysisTab !== "diff"}`
  - `id` matching `aria-controls`

Suggested structure (simplified):

```tsx
<Card>
  <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="space-y-1">
      <CardTitle>Analysis</CardTitle>
      <CardDescription>Diff and trends for tracked fields.</CardDescription>
    </div>

    <div role="tablist" aria-label="Analysis" className="flex gap-2">
      <Button
        type="button"
        variant={analysisTab === "diff" ? "default" : "secondary"}
        size="sm"
        role="tab"
        aria-selected={analysisTab === "diff"}
        aria-controls="analysis-panel-diff"
        onClick={() => setAnalysisTab("diff")}
      >
        Diff
      </Button>

      <Button
        type="button"
        variant={analysisTab === "trends" ? "default" : "secondary"}
        size="sm"
        role="tab"
        aria-selected={analysisTab === "trends"}
        aria-controls="analysis-panel-trends"
        onClick={() => setAnalysisTab("trends")}
      >
        Trends
      </Button>
    </div>
  </CardHeader>

  <CardContent>
    <div id="analysis-panel-diff" role="tabpanel" hidden={analysisTab !== "diff"}>
      {/* move existing Diff card content here (keep existing <CardTitle>Diff</CardTitle> as a heading inside) */}
    </div>

    <div id="analysis-panel-trends" role="tabpanel" hidden={analysisTab !== "trends"}>
      {/* move existing Trends card content here (keep existing <CardTitle>Trends</CardTitle> as a heading inside) */}
    </div>
  </CardContent>
</Card>
```

**Important:** Keep the internal headings “Diff” and “Trends” as headings (e.g. `CardTitle`) within each panel so the existing tests (and users) can still discover them. If you keep only the tab labels and remove headings, update tests accordingly.

3) Ensure behavior stays unchanged:
- Diff still reacts to A/B selection as before.
- Trends still requires a selected snapshot (for ConfigurationId) and still calls `showTrend()` only when the user clicks.

**Step 2: Run tests to verify they pass**

Run: `npm -w apps/web test`

Expected: PASS

**Step 3: Run typecheck**

Run: `npm -w apps/web run typecheck`

Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): move trends into analysis tab"
```

---

### Task 3: Manual UX sanity check (dev run)

**Files:**
- None (manual)

**Step 1: Run dev**

Run: `npm run dev`

Expected:
- Web loads
- Under the “Analysis” area, Diff is shown by default
- Clicking “Trends” shows the trends UI without shifting the entire page as much (less clutter)

**Step 2: No commit**

---

## Verification checklist

- `npm -w apps/web test` ✅
- `npm -w apps/web run typecheck` ✅
- Manual:
  - Tabs switch Diff/Trends
  - Trends still fetches time series and renders chart/table

---

## Execution handoff

Plan complete and saved to `docs/plans/2026-02-17-trends-tab-web-ux.md`. Two execution options:

1. **Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Parallel Session (separate)** — Open a new session in a worktree; that session uses superpowers:executing-plans

Which approach do you want?
