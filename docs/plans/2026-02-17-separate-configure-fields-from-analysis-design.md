# Product Analyzer — UX Adjustment: Separate Configure Fields from Analysis

**Date:** 2026-02-17

## Summary
Today the web UI renders field configuration (tracked fields + friendly names) directly alongside comparison tools (Diff/Trends), which makes configuration and comparison feel coupled.

This change keeps the single-page flow, but introduces a clearer separation by placing configuration and comparison under tabs.

## Goals
- Keep a **single page** (no routing changes).
- Make **Configure fields** feel like its own “view” distinct from comparison.
- Preserve existing behavior and API contracts.
- Reduce visual clutter and scrolling while comparing.

## Non-goals
- No backend/API changes.
- No persistence of selected tab (URL/localStorage) in v1.
- No new UI dependency (use existing shadcn/ui `Button`/`Card` primitives).

## Proposed UI
After the existing **Selection** and **Snapshots** cards, replace the current always-visible stack:
- Fields (Snapshot A)
- Diff
- Trends

…with a tabbed “workspace” area.

### Top-level tabs
A tablist with:
- **Configure fields** (default)
- **Analysis**

#### Configure fields panel
Contains the existing **Fields (Snapshot A)** UI (table + save button), unchanged in behavior:
- Value/type shown from Snapshot A.
- Tracked and Friendly name editable only when `root/ConfigurationId` exists.
- Save uses existing PUT endpoint.

#### Analysis panel
Contains comparison tools, grouped under a second tablist:
- **Diff** (default)
- **Trends**

Diff and Trends keep their existing behavior, but Trends is only rendered when selected.

### UX nicety
When the user clicks **Compare** on a snapshot (sets Snapshot B), the UI auto-switches to:
- **Analysis → Diff**

Rationale: “I clicked compare; show me the comparison”.

## State + interactions
Add UI state in `App.tsx` (conceptual):
- `workspaceTab: "configure" | "analysis"` (default `"configure"`)
- `analysisTab: "diff" | "trends"` (default `"diff"`)

Interaction rules:
- Clicking Compare sets Snapshot B and also sets `workspaceTab="analysis"` and `analysisTab="diff"`.
- Selecting Snapshot A continues to drive field discovery, `configurationId`, tracked fields editor, etc.

## Accessibility
Use proper tab semantics:
- `role="tablist"`, `role="tab"`, `role="tabpanel"`
- `aria-selected`, `aria-controls`, panel `id`

Keep internal headings inside panels (“Fields (Snapshot A)”, “Diff”, “Trends”) so users and tests can still find them.

## Testing impact (apps/web)
Update UI tests to reflect:
- Configure fields is visible by default.
- Diff/Trends are not visible until switching to Analysis.
- Within Analysis, Diff is selected by default; Trends appears only after selecting Trends.
- Optional: clicking Compare switches to Analysis/Diff.

## Acceptance criteria
- Configure fields and analysis are visually separated by tabs on the same page.
- Default state shows Configure fields.
- Clicking Compare switches to Analysis/Diff.
- All `apps/web` tests and typecheck pass.
