# Environment Variables

## Overview

Environment variables in the Product Analyzer project are used to configure database connections, authentication, server settings, and application behavior for Vercel (frontend) and Supabase (database).

---

## API Environment Variables

### 1. DATABASE_URL

- **Location**: [`apps/api/src/env.ts`](apps/api/src/env.ts)
- **Type**: PostgreSQL connection string
- **Required**: Optional (falls back to SQLite)
- **Default**: None
- **Usage**: Connection string for PostgreSQL database. When provided, the API uses PostgreSQL instead of SQLite files.

### 2. SUPABASE_JWT_SECRET

- **Location**: [`apps/api/src/env.ts`](apps/api/src/env.ts), [`apps/api/src/server.ts`](apps/api/src/server.ts)
- **Type**: String (JWT secret)
- **Required**: Optional
- **Default**: None
- **Usage**: JWT Secret for Supabase Auth. When provided, authentication is enforced on API endpoints.

### 3. PORT

- **Location**: [`apps/api/env.example`](apps/api/env.example), [`apps/api/src/env.ts`](apps/api/src/env.ts), [`apps/api/src/dev.ts`](apps/api/src/dev.ts)
- **Type**: Number (positive integer)
- **Required**: Optional
- **Default**: 5174 (dev), 3000 (production)
- **Usage**: API server port.

### 4. NODE_ENV

- **Location**: [`apps/api/src/dev.ts`](apps/api/src/dev.ts)
- **Type**: String
- **Required**: Optional
- **Default**: production
- **Usage**: Controls server host binding. When production, binds to 0.0.0.0; otherwise binds to 127.0.0.1.

### 5. SOURCE_DB_PATH

- **Location**: [`apps/api/src/env.ts`](apps/api/src/env.ts)
- **Type**: String (file path)
- **Required**: Optional (falls back to default path)
- **Default**: `./data/source.db`
- **Usage**: Path to the local SQLite database containing Husqvarna product/service data.

### 6. METADATA_DB_PATH

- **Location**: [`apps/api/src/env.ts`](apps/api/src/env.ts)
- **Type**: String (file path)
- **Required**: Optional (falls back to default path)
- **Default**: `./data/product-analyzer-metadata.db`
- **Usage**: Path to the local SQLite database storing application metadata (configuration fields, snapshots, etc.).

### 7. SYNC_DATABASE_URL

- **Location**: [`apps/api/src/env.ts`](apps/api/src/env.ts)
- **Type**: PostgreSQL connection string
- **Required**: Optional
- **Default**: None
- **Usage**: Connection string for Supabase PostgreSQL database. When provided, the API syncs metadata to Supabase for cloud backup and multi-device access. **Contains credentials - treat as secret.**

---

## Web Application Environment Variables

### 8. VITE_SUPABASE_URL

- **Location**: [`apps/web/.env`](apps/web/.env), [`apps/web/src/lib/supabase.ts`](apps/web/src/lib/supabase.ts)
- **Type**: URL string
- **Required**: Optional (shows warning if missing)
- **Default**: None
- **Usage**: Supabase project URL. Used to initialize the Supabase client for authentication.

### 8. VITE_SUPABASE_ANON_KEY

- **Location**: [`apps/web/.env`](apps/web/.env), [`apps/web/src/lib/supabase.ts`](apps/web/src/lib/supabase.ts)
- **Type**: String (anon key)
- **Required**: Optional (shows warning if missing)
- **Default**: None
- **Usage**: Supabase anonymous key. Used to initialize the Supabase client for authentication.

---

## Migration Script Variables

### 9. DATABASE_URL (Migration)

- **Location**: [`scripts/migrate-to-supabase.ts`](scripts/migrate-to-supabase.ts)
- **Type**: PostgreSQL connection string
- **Required**: Required (script exits if not set)
- **Default**: None
- **Usage**: Connection string for the target Supabase/PostgreSQL database for migration.

---

## Summary Table

| Variable Name | Where Defined | Required | Default | Used By |
|---------------|---------------|----------|---------|---------|
| DATABASE_URL | [`apps/api/src/env.ts`](apps/api/src/env.ts) | Required* | - | API, Migration Script |
| SUPABASE_JWT_SECRET | [`apps/api/src/env.ts`](apps/api/src/env.ts) | Optional | - | API |
| PORT | [`apps/api/env.example`](apps/api/env.example), [`apps/api/src/env.ts`](apps/api/src/env.ts) | Optional | 5174 (dev), 3000 (production) | API |
| NODE_ENV | Runtime | Optional | production | API |
| SOURCE_DB_PATH | [`apps/api/src/env.ts`](apps/api/src/env.ts) | Optional | ./data/source.db | API |
| METADATA_DB_PATH | [`apps/api/src/env.ts`](apps/api/src/env.ts) | Optional | ./data/product-analyzer-metadata.db | API |
| SYNC_DATABASE_URL | [`apps/api/src/env.ts`](apps/api/src/env.ts) | Optional | - | API (Supabase sync) |
| VITE_SUPABASE_URL | [`apps/web/.env`](apps/web/.env) | Optional | - | Web App |
| VITE_SUPABASE_ANON_KEY | [`apps/web/.env`](apps/web/.env) | Optional | - | Web App |

* SYNC_DATABASE_URL contains credentials and should be treated as a secret.

---

## Local Development Setup

### Creating .env files

1. **apps/api/.env** - Copy from [`apps/api/env.example`](apps/api/env.example) and fill in paths
2. **apps/web/.env** - Add Supabase credentials

Both .env files are gitignored (see [`.gitignore`](.gitignore)).

