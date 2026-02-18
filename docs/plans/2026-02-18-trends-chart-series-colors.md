# Trends Chart Series Colors Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make each numeric series in the Trends chart render with a distinct, deterministic color using the existing shadcn/Tailwind theme token approach.

**Architecture:** Add shadcn-style chart color tokens (`--chart-1`..`--chart-5`) to the global CSS theme, expose them via Tailwind color utilities, then assign series colors in `App.tsx` by index (cycled) and render a matching color marker next to each series label.

**Tech Stack:** React + TypeScript (Vite), Tailwind, shadcn/ui, Recharts, Vitest + Testing Library.

---

### Task 1: Add a failing UI test for distinct series colors

**Files:**
- Modify: `apps/web/src/App.test.tsx`

**Step 1: Write the failing test**

Add a test near the existing multi-series Trends tests:

- Scenario: two numeric series (FW + Temp)
- Expectation:
  - both series render in the series list
  - each series shows a color marker with a distinct token (e.g. `chart-1` vs `chart-2`)
  - the chart renders at least one path per series with the expected stroke color

Test code to add (adjust positioning as needed):

```ts
it("assigns distinct colors to each trend series", async () => {
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

    if (u.includes("/snapshots/ds1/fields")) {
      return new Response(
        JSON.stringify([
          { fieldKey: "root/ConfigurationId", valueText: "cfg-1", valueType: "string" },
          { fieldKey: "root/FirmwareVersion", valueText: "1", valueType: "number" },
          { fieldKey: "root/Temperature", valueText: "10", valueType: "number" }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    if (u.includes("/snapshots/ds2/fields")) {
      return new Response(
        JSON.stringify([
          { fieldKey: "root/ConfigurationId", valueText: "cfg-1", valueType: "string" },
          { fieldKey: "root/FirmwareVersion", valueText: "2", valueType: "number" },
          { fieldKey: "root/Temperature", valueText: "12", valueType: "number" }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (u.includes("/configurations/cfg-1/fields")) {
      return new Response(
        JSON.stringify([
          { configurationId: "cfg-1", fieldKey: "root/FirmwareVersion", tracked: true, friendlyName: "FW" },
          { configurationId: "cfg-1", fieldKey: "root/Temperature", tracked: true, friendlyName: "Temp" }
        ]),
        { status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    if (u.includes("/products/531285301/S1/timeseries") && init?.method === "POST") {
      return new Response(
        JSON.stringify([
          {
            fieldKey: "root/FirmwareVersion",
            points: [
              { deviceSnapshotId: "ds1", timeStampUtc: "2026-02-17T07:50:23.000Z", valueText: "1", valueType: "number" },
              { deviceSnapshotId: "ds2", timeStampUtc: "2026-02-18T07:50:23.000Z", valueText: "2", valueType: "number" }
            ]
          },
          {
            fieldKey: "root/Temperature",
            points: [
              { deviceSnapshotId: "ds1", timeStampUtc: "2026-02-17T07:50:23.000Z", valueText: "10", valueType: "number" },
              { deviceSnapshotId: "ds2", timeStampUtc: "2026-02-18T07:50:23.000Z", valueText: "12", valueType: "number" }
            ]
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

  // Switch to Trends
  {
    const workspaceTabs = screen.getByRole("tablist", { name: /workspace/i });
    fireEvent.click(within(workspaceTabs).getByRole("tab", { name: /analysis/i }));

    const analysisTabs = screen.getByRole("tablist", { name: /analysis/i });
    fireEvent.click(within(analysisTabs).getByRole("tab", { name: /trends/i }));
  }

  fireEvent.click(await screen.findByLabelText("Include snap-1"));
  fireEvent.click(await screen.findByLabelText("Include snap-2"));

  fireEvent.click(await screen.findByLabelText("Select trend root/FirmwareVersion"));
  fireEvent.click(await screen.findByLabelText("Select trend root/Temperature"));

  fireEvent.click(screen.getByRole("button", { name: /show trend/i }));

  const seriesList = await screen.findByRole("list", { name: /trend series/i });
  const fw = within(seriesList).getByText("FW").closest("li");
  const temp = within(seriesList).getByText("Temp").closest("li");

  expect(fw).toBeTruthy();
  expect(temp).toBeTruthy();

  // Implementation will set deterministic tokens.
  expect(fw).toHaveAttribute("data-series-color", "chart-1");
  expect(temp).toHaveAttribute("data-series-color", "chart-2");

  const chart = await screen.findByLabelText("Trend chart");
  // Recharts renders SVG paths; we assert our stroke values are present.
  expect(chart.querySelectorAll('path[stroke="hsl(var(--chart-1))"]').length).toBeGreaterThan(0);
  expect(chart.querySelectorAll('path[stroke="hsl(var(--chart-2))"]').length).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

Run: `npm -w apps/web test`

Expected: FAIL because `data-series-color` attributes and explicit `stroke="hsl(var(--chart-N))"` are not set yet.

---

### Task 2: Add shadcn-style chart color tokens to the theme

**Files:**
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/tailwind.config.cjs`

**Step 1: Add chart CSS variables (light + dark)**

In `apps/web/src/index.css` under `:root` add:

```css
--chart-1: 12 76% 61%;
--chart-2: 173 58% 39%;
--chart-3: 197 37% 24%;
--chart-4: 43 74% 66%;
--chart-5: 27 87% 67%;
```

And under `.dark` add:

```css
--chart-1: 220 70% 50%;
--chart-2: 160 60% 45%;
--chart-3: 30 80% 55%;
--chart-4: 280 65% 60%;
--chart-5: 340 75% 55%;
```

(These are the shadcn-style “chart palette” tokens: HSL components, used via `hsl(var(--chart-1))`.)

**Step 2: Expose tokens via Tailwind colors**

In `apps/web/tailwind.config.cjs` add an extended `chart` color group:

```js
chart: {
  1: "hsl(var(--chart-1))",
  2: "hsl(var(--chart-2))",
  3: "hsl(var(--chart-3))",
  4: "hsl(var(--chart-4))",
  5: "hsl(var(--chart-5))"
}
```

This enables utility classes like `bg-chart-1` (for markers) while keeping the actual colors theme-driven.

**Step 3: Run typecheck + tests**

Run: `npm -w apps/web test`
Expected: still FAIL (we haven’t wired colors into the chart yet).

Run: `npm -w apps/web run typecheck`
Expected: PASS.

---

### Task 3: Assign deterministic colors to series in the chart + series list

**Files:**
- Modify: `apps/web/src/App.tsx`

**Step 1: Add a small color helper**

Near the Trends logic (close to where `numericTrendSeries` is built), add:

```ts
const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))"
] as const;

function getChartColor(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

function getChartColorToken(index: number) {
  const n = (index % CHART_COLORS.length) + 1;
  return `chart-${n}`;
}
```

**Step 2: Apply stroke colors to Recharts `<Line>`**

Where lines are rendered:

```tsx
{numericTrendSeries.map((s, idx) => (
  <Line
    key={s.fieldKey}
    type="monotone"
    dataKey={s.fieldKey}
    name={trackedFriendlyNameByKey.get(s.fieldKey) ?? s.fieldKey}
    dot={false}
    strokeWidth={2}
    stroke={getChartColor(idx)}
  />
))}
```

**Step 3: Render a matching marker in the series list**

Update the `Trend series` `<ul>` so each `<li>`:
- has `data-series-color="chart-N"` (for tests)
- includes a small dot using Tailwind `bg-chart-N`

Example structure:

```tsx
<li
  key={s.fieldKey}
  data-series-color={getChartColorToken(idx)}
  className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1"
>
  <span
    aria-hidden="true"
    className={`h-2.5 w-2.5 rounded-full bg-${getChartColorToken(idx)}`}
  />
  <span>{label}</span>
</li>
```

Important note for implementation: Tailwind cannot see dynamic class names, so do **not** use string interpolation to produce `bg-chart-1` etc.

Instead, implement the marker using one of these safe approaches:

Option A (recommended): a tiny `ChartColorDot` component that switches on index:

```tsx
function ChartColorDot({ index }: { index: number }) {
  switch (index % 5) {
    case 0:
      return <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-chart-1" />;
    case 1:
      return <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-chart-2" />;
    case 2:
      return <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-chart-3" />;
    case 3:
      return <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-chart-4" />;
    default:
      return <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-chart-5" />;
  }
}
```

Option B: inline `style={{ backgroundColor: getChartColor(idx) }}` (no Tailwind class), but still set `data-series-color`.

**Step 4: Run tests**

Run: `npm -w apps/web test`
Expected: PASS.

**Step 5: Run typecheck**

Run: `npm -w apps/web run typecheck`
Expected: PASS.

---

### Task 4: (Optional) Keep legend colors consistent

**Files:**
- Modify: `apps/web/src/App.tsx`

If the Recharts `Legend` does not reflect `stroke` colors in your theme, replace the default legend with a custom one that uses the same `ChartColorDot` + labels.

**Step 1: Add a custom legend**

Implement a simple legend under the chart using shadcn/Tailwind primitives, rather than relying on Recharts internal markup.

**Step 2: Verify**

Run: `npm -w apps/web test` → PASS

(If the default Legend looks good already, skip this task.)

---

### Task 5: Commit

**Files:**
- `apps/web/src/App.test.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/index.css`
- `apps/web/tailwind.config.cjs`

**Step 1: Commit**

```bash
git add apps/web/src/App.test.tsx apps/web/src/App.tsx apps/web/src/index.css apps/web/tailwind.config.cjs
git commit -m "feat(web): add distinct colors for trend chart series"
```
