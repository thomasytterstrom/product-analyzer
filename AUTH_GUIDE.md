# Authentication & Cloud Deployment Guide (Vercel + Supabase)

This guide explains how to deploy the Product Analyzer to **Vercel** and **Supabase** for a 100% free, credit-card-free setup.

## 1. Database Setup (Supabase)

1.  Create a free project at [Supabase](https://supabase.com).
2.  Go to the **SQL Editor** and run the contents of `SUPABASE_SCHEMA.sql` (found in the deployments folder). This creates your tables for Metadata and Snapshots.
3.  Go to **Project Settings > API** and copy:
    *   `Project URL`
    *   `anon` `public` key
    *   `service_role` key (keep secret)
    *   `JWT Secret`
4.  Go to **Project Settings > Database** and copy the `Connection String` (for the API).

## 2. Authentication Setup

The app is pre-configured to use **Supabase Auth**.

### Frontend Integration
I have added instructions to `apps/web/src/Auth.tsx` (or created it) to handle the login UI using `@supabase/auth-ui-react`.

### Backend Protection
The Fastify server in `apps/api/src/server.ts` uses `@fastify/jwt` to verify the Supabase JWT on every request.

## 3. Deployment to Vercel

1.  Push your code to a GitHub repository.
2.  Import the project into **Vercel**.
3.  Vercel will detect the monorepo. Use these settings:
    *   **Framework Preset**: `Vite`
    *   **Root Directory**: (Leave empty)
    *   **Build Command**: `npm run build:api && npm run build --workspace=@product-analyzer/web`
4.  Add **Environment Variables** in Vercel:
    *   `DATABASE_URL`: Your Supabase Postgres connection string.
    *   `SUPABASE_JWT_SECRET`: Your Supabase JWT secret.
    *   `VITE_SUPABASE_URL`: Your Supabase URL.
    *   `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key.

## 4. Migrating your Snapshots (Source DB)

Since we are skipping SQLite, you need to upload your local snapshots to Supabase:

1.  Export your local SQLite `DeviceSnapshot` and `DeviceSnapshotJson` tables to CSV.
2.  Use the Supabase **Table Editor** to import these CSVs into the corresponding Postgres tables.

## 5. Security

The app uses **Row Level Security (RLS)**. By default, users can only see their own configuration fields. Ensure you enable RLS on the `configuration_field` table in the Supabase dashboard.

```sql
ALTER TABLE configuration_field ENABLE ROW LEVEL SECURITY;
```
