# Product Analyzer - Deployment Configuration

This directory contains deployment configurations for hosting the Product Analyzer application.

## Architecture

The application consists of:
- **Frontend**: React + Vite (static SPA)
- **Backend**: Node.js + Fastify API
- **Database**: SQLite (better-sqlite3)

## Deployment Options

### Option 1: Vercel (Frontend) + Render (Backend) + Supabase (Database)

#### Frontend → Vercel (Free)
```bash
npm i -g vercel
vercel --prod
```

#### Backend → Render (Free tier)
- Create a new Web Service on Render
- Connect your GitHub repository
- Use the following settings:
  - Build Command: `npm install && npm run build:api`
  - Start Command: `npm run start:api`
  - Environment: `Node`

#### Database → Supabase (Free tier)
- Create a Supabase project
- Use Supabase client instead of better-sqlite3 for the metadata DB

### Option 2: Full-Stack on Render

Deploy both frontend and backend as a single Node.js app.

### Option 3: Fly.io

Deploy containers globally with persistent volumes for SQLite.

## Environment Variables

### Backend (API)
```
SOURCE_DB_PATH=/app/data/source.db
METADATA_DB_PATH=/app/data/metadata.db
PORT=3000
NODE_ENV=production
```

### Frontend
```
VITE_API_URL=https://your-api.onrender.com
```

## Quick Start

1. Fork/clone this repository
2. Set up your database (see below)
3. Deploy frontend to Vercel
4. Deploy backend to your chosen platform
5. Configure environment variables

## Database Setup

### For Production (Recommended: Supabase PostgreSQL)

The app uses two SQLite databases:
1. **Source DB** (read-only): Your existing Husqvarna Service Hub data
2. **Metadata DB** (read-write): Stores tracked fields + friendly names

For production deployment, migrate to PostgreSQL:

```sql
-- Create tables for metadata DB
CREATE TABLE configuration_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  configuration_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  tracked INTEGER DEFAULT 0,
  friendly_name TEXT,
  UNIQUE(configuration_id, field_key)
);
```

Update the API code to use `pg` or `@supabase/supabase-js` instead of better-sqlite3.

### For Development/Local Production

Keep using SQLite with persistent storage:
- Render: Use persistent disks
- Fly.io: Use volumes

## API Endpoints

Once deployed, the API provides:
- `GET /health` - Health check
- `GET /product-numbers` - List all product numbers
- `GET /product-numbers/:productNumber/serial-numbers` - List serial numbers
- `GET /products/:productNumber/:serialNumber/snapshots` - List snapshots
- `GET /snapshots/:deviceSnapshotId/fields` - Get snapshot fields
- `GET /configurations/:configurationId/fields` - Get tracked fields
- `PUT /configurations/:configurationId/fields` - Save tracked fields
- `GET /products/:productNumber/:serialNumber/diff` - Compare snapshots
- `POST /products/:productNumber/:serialNumber/timeseries` - Get trend data

## Troubleshooting

### CORS Issues
If frontend can't reach API, ensure CORS is configured in Fastify:
```typescript
await app.register(require('@fastify/cors'), { 
  origin: true // or specific domain
});
```

### Database Connection
Ensure environment variables point to the correct database paths.
