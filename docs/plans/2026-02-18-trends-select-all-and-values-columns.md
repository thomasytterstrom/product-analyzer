# Trends “Select all” + Multi-column Values Tables Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve Trends UX by adding a **Select all** control for “Include snapshots” and rendering the per-field **trend values tables in multiple columns** instead of a single full-width stack.

**Architecture:** Small, local UI changes in `apps/web/src/App.tsx`.
- Keep the existing Trends data-flow (snapshot A provides `ConfigurationId`, explicit “Show trend” fetch, per-field tables, Recharts hero chart).
- Add a stable, accessible **Select all snapshots** control above the snapshot list.
- Change the values table container from a vertical stack to a responsive grid so tables don’t stretch across the entire width.

**Tech Stack:** React + TypeScript (Vite), Tailwind, shadcn/ui primitives (`Button`, `Card`, `Table`, `Checkbox`), Vitest + Testing Library.

---

## Context (current state)

- Trends UI is in `apps/web/src/App.tsx` under the Analysis → Trends tabpanel.
- Snapshot inclusion is currently per-snapshot checkboxes only:
  - `trendSnapshotIds: string[]` stores *deviceSnapshotId*s.
  - Each checkbox uses `aria-label={\`Include ${s.snapshotId}\`}`.
- Trend values are rendered as **one section per field**, each containing a table:
  - `<section aria-label={\`Trend values ${friendlyName}\`}>`
  - `<Table aria-label={\`Trend ${friendlyName}\`}>`
  - All tables are currently stacked in a single column (`className="space-y-4"`).

Relevant anchors in `apps/web/src/App.tsx`:
- Snapshot selection heading text: **“Include snapshots”**
- Values section: `aria-label={\`Trend values ${friendlyName}\`}`

---

## Acceptance criteria

- [ ] Trends “Include snapshots” area has a **Select all** control.
- [ ] Clicking Select all:
  - [ ] selects all available snapshots
  - [ ] clicking again clears all
- [ ] Trend values tables render in a **multi-column layout** on larger screens (and stack on small screens).
- [ ] Existing behavior and a11y hooks remain stable:
  - [ ] per-snapshot checkboxes keep their `aria-label="Include snap-X"`
  - [ ] per-field values regions and tables keep their `aria-label`s
- [ ] `npm -w apps/web test` passes.
- [ ] `npm -w apps/web run typecheck` passes.

## Non-goals

- No API changes.
- No virtualization/pagination of snapshot lists.
- No new component extraction (keep changes local to `App.tsx`).

---

### Task 1: Add “Select all snapshots” control (tests first)

**Files:**
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/App.tsx`

#### Step 1: Write the failing test

Add a new test near the existing Trends tests (reuse the same fetch stub pattern you already use in those tests):

```ts
it("offers a Select all control for trend snapshot inclusion", async () => {
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

  // Select snapshot A
  fireEvent.click(await screen.findByText(/snap-1/));

  // Switch to Workspace: Analysis, then Analysis tab: Trends
  {
    const workspaceTabs = screen.getByRole("tablist", { name: /workspace/i });
    fireEvent.click(within(workspaceTabs).getByRole("tab", { name: /analysis/i }));

    const analysisTabs = screen.getByRole("tablist", { name: /analysis/i });
    fireEvent.click(within(analysisTabs).getByRole("tab", { name: /trends/i }));
  }

  // New control
  const selectAll = await screen.findByLabelText(/select all snapshots/i);

  // Initially none selected
  expect((await screen.findByLabelText("Include snap-1"))).not.toBeChecked();
  expect((await screen.findByLabelText("Include snap-2"))).not.toBeChecked();

  // Select all
  fireEvent.click(selectAll);
  expect((await screen.findByLabelText("Include snap-1"))).toBeChecked();
  expect((await screen.findByLabelText("Include snap-2"))).toBeChecked();

  // Clear all
  fireEvent.click(selectAll);
  expect((await screen.findByLabelText("Include snap-1"))).not.toBeChecked();
  expect((await screen.findByLabelText("Include snap-2"))).not.toBeChecked();
});
```

**Notes:**
- If you prefer a button rather than a checkbox for “Select all”, update the test selector accordingly (e.g. `getByRole("button", { name: /select all/i })`).
- The test intentionally asserts the existing per-snapshot labels (`Include snap-1`, `Include snap-2`) stay stable.

#### Step 2: Run test to verify it fails

Run: `npm -w apps/web test`

Expected: FAIL because “Select all snapshots” doesn’t exist yet.

#### Step 3: Write minimal implementation

In `apps/web/src/App.tsx`, inside the **Include snapshots** block (above the snapshot list), add a compact control row:

- Add a checkbox with label text **“Select all snapshots”**.
- Toggling it should:
  - if *not all* snapshots are currently selected → set `trendSnapshotIds` to all `snapshots.map(s => s.deviceSnapshotId)`
  - else → set `trendSnapshotIds` to `[]`

Recommended implementation snippet (drop into the Include snapshots section):

```tsx
const allSnapshotIds = snapshots.map((s) => s.deviceSnapshotId);
const selectedCount = trendSnapshotIds.length;
const allSelected = allSnapshotIds.length > 0 && selectedCount === allSnapshotIds.length;
const someSelected = selectedCount > 0 && !allSelected;

// optional: indeterminate visual state
const selectAllRef = React.useRef<HTMLInputElement | null>(null);
React.useEffect(() => {
  if (!selectAllRef.current) return;
  selectAllRef.current.indeterminate = someSelected;
}, [someSelected]);
```

And the UI:

```tsx
<label className="flex items-center gap-3 text-sm">
  <Checkbox
    ref={selectAllRef}
    aria-label="Select all snapshots"
    checked={allSelected}
    onChange={() => {
      setTrendSnapshotIds(allSelected ? [] : allSnapshotIds);
    }}
  />
  <span className="font-medium">Select all</span>
</label>
```

**Important:** keep the existing per-snapshot checkbox behavior unchanged.

#### Step 4: Run tests to verify they pass

Run: `npm -w apps/web test`

Expected: PASS

#### Step 5: Run typecheck

Run: `npm -w apps/web run typecheck`

Expected: PASS

#### Step 6: Commit

```bash
git add apps/web/src/App.test.tsx apps/web/src/App.tsx
git commit -m "feat(web): add select all for trend snapshots"
```

---

### Task 2: Render trend values tables in multiple columns (tests first)

**Files:**
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/App.tsx`

#### Step 1: Write the failing test

Add a layout-focused test that asserts the values tables container is a responsive grid (use a stable test id so the test is not brittle):

```ts
it("renders trend values tables in a multi-column layout", async () => {
  // You can reuse the fetch stub from an existing Trends test that returns 2+ trendSeries.
  // The important part is that trendSeries.length > 0 after clicking “Show trend”.

  // ... setup identical to an existing multi-field trend test ...

  fireEvent.click(screen.getByRole("button", { name: /show trend/i }));

  // New layout container
  const valuesGrid = await screen.findByTestId("trend-values-grid");
  expect(valuesGrid).toHaveClass("grid");
  expect(valuesGrid).toHaveClass("md:grid-cols-2");

  // Existing accessibility should still work
  expect(await screen.findByRole("region", { name: /trend values\s+fw/i })).toBeInTheDocument();
});
```

If you want the test to be fully copy/paste, base it on the existing test that already produces trendSeries and then add only the final assertions above.

#### Step 2: Run test to verify it fails

Run: `npm -w apps/web test`

Expected: FAIL because `trend-values-grid` doesn’t exist and/or isn’t a grid.

#### Step 3: Write minimal implementation

In `apps/web/src/App.tsx`, change the trend values tables container from:

```tsx
<div className="space-y-4">
  {trendSeries.map(...)}
</div>
```

…to a responsive grid, for example:

```tsx
<div
  data-testid="trend-values-grid"
  className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
>
  {trendSeries.map(...)}
</div>
```

Also tweak each per-series `<section>` to behave nicely in a grid:
- keep the existing `aria-label` exactly as-is
- optional: add `className="h-full"` so cards align nicely

Example section class change:

```tsx
<section
  key={s.fieldKey}
  aria-label={`Trend values ${friendlyName}`}
  className="h-full space-y-2 rounded-md border bg-background p-3"
>
```

This satisfies “does not have to stretch over the whole width” by distributing tables across columns on larger screens.

#### Step 4: Run tests to verify they pass

Run: `npm -w apps/web test`

Expected: PASS

#### Step 5: Run typecheck

Run: `npm -w apps/web run typecheck`

Expected: PASS

#### Step 6: Commit

```bash
git add apps/web/src/App.test.tsx apps/web/src/App.tsx
git commit -m "feat(web): render trend values tables in columns"
```

---

## Verification checklist

- `npm -w apps/web test` ✅
- `npm -w apps/web run typecheck` ✅

---

## Execution handoff

Plan complete and saved to `docs/plans/2026-02-18-trends-select-all-and-values-columns.md`. Two execution options:

1. **Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Parallel Session (separate)** — Open a new session in a worktree; that session uses superpowers:executing-plans

Which approach do you want?
