# Product Analyzer — Design (DeviceSnapshot JSON)

**Date:** 2026-02-17

## Goal
Build a web app that lets a user:
1) select a product (by ProductNumber → SerialNumber),
2) browse its available snapshots,
3) choose which snapshot parameters are “interesting” and assign friendly names,
4) compare snapshots and visualize how selected values change over time (tables + graphs).

## Non-goals (v1)
- No writes to the existing source SQLite database (read-only).
- No authentication / multi-user permissions (local/internal tool).
- No full ETL of all snapshot JSON into a giant flattened table.
- No generic deep-diff of arbitrary JSON arrays (not useful for stable comparisons).

## Data sources
### Source SQLite DB (existing)
Tables involved:
- `DeviceSnapshot`
- `DeviceSnapshotJson`

Important columns:
- `DeviceSnapshot.ProductNumber` (string)
- `DeviceSnapshot.SerialNumber` (string)
- `DeviceSnapshot.ConfigurationId` (string)
- `DeviceSnapshot.SnapshotId` (string)
- `DeviceSnapshot.TimeStampUtc` (string/ISO timestamp)
- `DeviceSnapshotJson.DeviceSnapshotId` → FK to `DeviceSnapshot.Id`
- `DeviceSnapshotJson.Json` → the snapshot payload

### Product identity (user-facing)
A “product/device” is identified by **(ProductNumber, SerialNumber)**.

### Snapshot identity + ordering
Snapshots are identified by `DeviceSnapshot.SnapshotId` (and/or `DeviceSnapshot.Id`).
Ordering is by `DeviceSnapshot.TimeStampUtc` ascending/descending.

## Snapshot JSON shape (observed)
The JSON payload can vary across products. A common structure includes:
- `Nodes[]` with `NodeId` and `Parameters[]` of `{ FieldId, Value, Type }`
- `CompositeParameters[]` of `{ FieldId, Value, Type }`
- top-level scalar fields like `FirmwareVersion`, `ConfigurationId`, `TimeStamp`, `ProductNumber`, `SerialNumber`
- `EventData.Events[]` as an array of objects

## Core concept: normalized “field keys”
To diff consistently, we normalize the snapshot JSON into a flat key/value map.

### Key format
- Node parameters:
  - `node:<NodeId>/<FieldId>`
  - Example: `node:master/send.command.Response.status`
- Composite parameters:
  - `composite/<FieldId>`
- Selected top-level scalars (optional):
  - `root/<FieldName>`
  - Example: `root/FirmwareVersion`

### Value representation
For v1 we store/compare values as:
- `valueText: string | null` (stringified value)
- `valueType: string | null` (from `Type` in JSON, when present)

### Events (array) handling (v1)
`EventData.Events[]` is an array of objects and does not diff cleanly as a single “parameter”.

v1 behavior:
- Exclude raw events from the generic parameter diff.
- Optionally provide a separate “Events summary” later (counts by `Code`, max `Severity`, etc.).

## Parameter discovery + “configuration”
### UX requirement
The user chooses which parameters are interesting **after** selecting a product and loading its snapshots.

### Saved configuration scope
User-created parameter configurations (tracked fields + friendly names) are saved **per `DeviceSnapshot.ConfigurationId`**.

Rationale:
- Parameter sets vary by ConfigurationId.
- Friendly names and “tracked” choices should be reusable across devices that share a ConfigurationId.

### Behavior across snapshots
- When comparing multiple snapshots, all selected snapshots must share the same `ConfigurationId`.
- v1: if `ConfigurationId` differs across chosen snapshots, the app warns and blocks comparison.

## Sidecar metadata database (app-owned)
We maintain a separate SQLite DB to store tracked parameters and friendly names.

### File
Example: `data/product-analyzer-metadata.db`

### Tables (v1)
#### `ConfigurationField`
Stores the parameter catalog + user preferences for a given `ConfigurationId`.

Columns:
- `configurationId TEXT NOT NULL`
- `fieldKey TEXT NOT NULL`
- `friendlyName TEXT NULL`
- `tracked INTEGER NOT NULL DEFAULT 0`  (0/1)
- `createdUtc TEXT NOT NULL`
- `updatedUtc TEXT NOT NULL`

Constraints:
- `PRIMARY KEY (configurationId, fieldKey)`

Optional later:
- `groupName`, `sortOrder`, `description`

## Backend API (Node)
### Read model endpoints
- `GET /product-numbers`
  - returns distinct ProductNumber list
- `GET /product-numbers/:productNumber/serial-numbers`
  - returns distinct SerialNumber list for that ProductNumber
- `GET /products/:productNumber/:serialNumber/snapshots`
  - returns snapshots (id(s), timestamp, configurationId)
- `GET /snapshots/:deviceSnapshotId/fields`
  - returns flattened discovered fields (fieldKey, sample valueText, valueType)

### Diff and time-series endpoints
- `GET /products/:productNumber/:serialNumber/diff?snapshotA=<id>&snapshotB=<id>`
  - diffs only the tracked fields for the snapshots’ ConfigurationId
- `POST /products/:productNumber/:serialNumber/timeseries`
  - body: `{ snapshotIds: string[], fieldKeys: string[] }`
  - returns: values per snapshot for charting

### Metadata endpoints (sidecar DB)
- `GET /configurations/:configurationId/fields`
- `PUT /configurations/:configurationId/fields`
  - upsert friendlyName/tracked for a list of fieldKeys

## Frontend UI (Vite + Tailwind + shadcn/ui)
### Primary flow (v1)
1) Select ProductNumber
2) Select SerialNumber
3) View snapshots list (ordered by TimeStampUtc)
4) Choose snapshots:
   - Compare two snapshots (diff table)
   - Or select multiple snapshots for trends
5) Manage tracked parameters + friendly names

### Views/components
- Product picker (ProductNumber → SerialNumber)
- Snapshots list (multi-select)
- Parameter configuration editor:
  - shows discovered `fieldKey`s
  - toggle “tracked”
  - edit friendly name
  - filter/search by fieldKey
- Diff table:
  - Changed / Added / Removed / Unchanged for tracked keys
- Trends:
  - table (snapshot timestamp vs value)
  - graphs:
    - numeric types → line chart
    - strings → change markers / step-like display
    - missing values → gaps

## Error handling
- Missing JSON / parse failure:
  - show snapshot as “unavailable” with error details
- ConfigurationId mismatch in selection:
  - warn and block comparison in v1
- Very large values (e.g., logs):
  - truncate in UI, allow expand/copy

## Performance notes (v1)
- Parse JSON on demand for selected snapshots.
- Limit default multi-snapshot selections (e.g., first 20) with “load more”.
- Cache parsed/flattened results in-memory in the API process (optional).

## Testing strategy
- Unit tests:
  - JSON flattening → deterministic `fieldKey → valueText` mapping
  - diff logic on flattened maps
- API tests:
  - list products/snapshots
  - diff endpoint respects tracked fields + friendly names
  - timeseries endpoint returns aligned rows
- UI tests:
  - parameter editor saves tracked fields
  - diff view renders friendly names

## Open questions (defer unless needed)
- Do we need a shared “configuration catalog” UI to browse ConfigurationIds without selecting a product? (v1: no)
- Do we need event analytics beyond summary? (v1: no)
