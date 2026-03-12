# Product Analyzer

A web application for analyzing Husqvarna product data.

## Tech Stack

- **Frontend**: React + Vite + TypeScript
- **Backend**: Node.js + Fastify
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel

## Prerequisites

- Node.js installed locally
- GitHub account
- Supabase account (free tier)

## Quick Start

### 1. Clone and Install

```bash
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the database migration:
```bash
npm run db:migrate
```

### 3. Configure Environment Variables

Create `apps/api/.env`:
```bash
cp apps/api/env.example apps/api/.env
```

Edit `apps/api/.env` and add your Supabase connection details:
```
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres
SUPABASE_JWT_SECRET=[YOUR-JWT-SECRET]
```

Create `apps/web/.env`:
```bash
cp apps/web/.env.example apps/web/.env  # if exists
```

Add your Supabase credentials:
```
VITE_SUPABASE_URL=https://[YOUR-PROJECT].supabase.co
VITE_SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
```

### 4. Run Locally

```bash
npm run dev
```

The frontend will be available at http://localhost:5173 and the API at http://localhost:5174.

## Deployment

### Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

For more details, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Documentation

- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) - Environment variable reference
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [AUTH_GUIDE.md](AUTH_GUIDE.md) - Authentication setup
- [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) - Database migration guide
