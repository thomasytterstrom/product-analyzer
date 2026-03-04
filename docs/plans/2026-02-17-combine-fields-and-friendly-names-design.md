# Product Analyzer — UX Adjustment: Combine Field Discovery + Friendly Names

**Date:** 2026-02-17

## Summary
The current UI shows:
- **Field discovery**: values from Snapshot A (`fieldKey`, `valueText`, `valueType`)
- **Tracked fields**: per-`ConfigurationId` editor (`tracked`, `friendlyName`)

This is redundant and forces users to jump between two sections while doing one job (decide what to track, and name it).

## Goal
Provide a single, combined view that lets a user:
- see Snapshot A values,
- toggle whether a field is tracked,
- set a friendly name,
all in one place.

## Non-goals
- No change to API contracts.
- No change to diff/timeseries behavior.
- No new metadata schema.

## Proposed UI
Replace the two cards with **one card**:

**Title:** `Fields (Snapshot A)` (or `Fields`)

**Table columns:**
1) Field key (read-only)
2) Value (A) (read-only)
3) Type (read-only)
4) Tracked (editable checkbox)
5) Friendly name (editable text input)

**Save action:**
- Keep the existing "Save tracked fields" button.

## Data flow
- Selecting Snapshot A loads `fields` via `GET /snapshots/:deviceSnapshotId/fields`.
- `configurationId` continues to be derived from Snapshot A `root/ConfigurationId`.
- When `configurationId` is available, load existing configuration rows via:
  - `GET /configurations/:configurationId/fields`
- Merge behavior remains:
  - Server rows are the source of truth for `tracked` + `friendlyName` for known keys.
  - Newly discovered keys from Snapshot A are seeded locally as `tracked=false`, `friendlyName=null`.
- Save persists to:
  - `PUT /configurations/:configurationId/fields` with the existing payload shape.

## Edge cases
- No Snapshot A selected:
  - Show helper text; no table.
- Snapshot A missing `root/ConfigurationId`:
  - Allow viewing values, but disable tracked/name editing + save (no configuration scope).
- While configuration fields load:
  - Show a loading hint for editable columns; still render Snapshot A value columns.

## Testing impact
Update existing UI tests to reflect:
- The separate "Field discovery" section is removed.
- Combined section still shows snapshot values.
- Combined section still allows editing tracked + friendly name and saving via PUT.

## Optional follow-ups (separate decisions)
- Add filter/search for field key and friendly name.
- Column density tweaks (hide Type by default, etc.).
