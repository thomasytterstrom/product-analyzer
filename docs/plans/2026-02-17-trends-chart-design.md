# Trends Chart (Web UI) — Design

**Date:** 2026-02-17

## Goal
Enable users to plot **one or more tracked snapshot fields** as a **time-series line chart** in the Trends area, using the existing snapshots/time-series API.

## Context
- Frontend: React + TypeScript (Vite), Tailwind, shadcn/ui primitives.
- Backend: API already supports requesting time-series points per field key via:
  - `POST /products/:productNumber/:serialNumber/timeseries`
  - payload: `{ snapshotIds: string[], fieldKeys: string[] }`

## Requirements (v1)
- Typical series size is small: **< 500 points**.
- Users want **multiple fields overlaid as multiple lines on the same chart**.
- No zoom/pan/brush required in v1.

## Non-goals (v1)
- No routing/state persistence (URL/localStorage) for selections.
- No advanced interactions (zoom/brush) in the first iteration.
- No multi-axis/unit handling (single y-axis only).

## Library choice
**Recharts** (React-first charting library).

Rationale:
- Fast to implement for multi-line time-series charts.
- Great DX for React + TS.
- Sufficient performance for < 500 points.

## Data flow
1. User selects product/serial and a set of snapshots (already supported).
2. In Trends, user selects **multiple field keys** to trend.
3. On “Show trend”, the UI calls:
   - `POST /products/:productNumber/:serialNumber/timeseries`
   - `snapshotIds`: selected DeviceSnapshot ids
   - `fieldKeys`: selected field keys
4. API returns one series per field key:
   - `{ fieldKey, points: [{ deviceSnapshotId, timeStampUtc, valueText, valueType }] }[]`

## Frontend transformation
### X-axis
- Use `timeStampUtc` as the x value.
- Sort ascending.

### Series values
- For each field key, attempt to parse numeric values.
- When a point is missing for a field or not numeric, store `null` so the line renders a gap.

### Merged chart rows
Transform API output into an array like:
- `[{ timeStampUtc: string, [fieldKey: string]: number | null }, ...]`

## Rendering rules
- If **at least one numeric field** is selected:
  - render a single line chart
  - one line per numeric field
  - legend label: friendly name if present, else field key
  - tooltip: values for all series at the hovered timestamp
- If a selected field is non-numeric:
  - do not plot it in the chart (v1)
  - still show its points in the Trends table (existing behavior)
- If **no numeric fields** are selected:
  - hide chart area and show a short message (“No numeric fields selected”) plus tables.

## UX notes
- Field selection UI should support selecting multiple fields (checkbox list or multi-select).
- Keep the existing “Show trend” explicit action to avoid auto-fetch spam.

## Error handling
- API errors: show a concise inline error message in Trends.
- Empty responses: show “No points found for the selected snapshots/fields.”

## Testing strategy
- Unit/UI tests:
  - selecting multiple numeric fields produces a rendered chart (presence of SVG/chart container and legend entries).
  - non-numeric fields do not produce chart lines but still render in the table.
- API route tests already cover multi-field response shape; extend only if needed.
