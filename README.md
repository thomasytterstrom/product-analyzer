# Product Analyzer

Analyze device snapshot history from the existing Husqvarna Service Hub SQLite DB.

## Prerequisites

- Node.js (includes npm)

## Configure databases

The API connects to two SQLite databases:

- **Source (read-only)**: your existing snapshots DB
- **Metadata (read-write)**: a sidecar DB used to store tracked fields + friendly names per `ConfigurationId`

Copy `apps/api/env.example` to `apps/api/.env` (this file is gitignored) and set paths. Example:

- `SOURCE_DB_PATH="C:\\Users\\ThomasYtterstrom\\AppData\\Local\\HusqvarnaServiceHubData\\data.db"`
- `METADATA_DB_PATH="./data/product-analyzer-metadata.db"`

## Install

From the repo root:

- `npm install`

## Run (dev)

From the repo root:

- `npm run dev`

This starts:

- Web UI: http://127.0.0.1:5173
- API: http://127.0.0.1:5174

The web dev server proxies API routes (`/product-numbers`, `/products`, `/snapshots`, `/configurations`, `/health`) to the API port.

## What you can do in the UI

- Pick Product number → Serial number
- View snapshots
- Discover flattened fields for a snapshot
- Edit tracked fields + friendly names (stored per `ConfigurationId`)
- Diff tracked fields between two snapshots
- Show a simple trend (time series) for a tracked field across selected snapshots
