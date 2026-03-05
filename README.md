# Deploying Product Analyzer

This directory contains the necessary configurations to deploy the Product Analyzer application.

## Prerequisites

- Node.js installed locally
- GitHub account
- Existing Husqvarna SQLite data file (the "source DB")

## Option 1: Vercel (Frontend) + Render (Backend)

This is the recommended free approach. Vercel provides excellent static hosting for the React frontend, while Render provides a free Node.js container for the Fastify API.

### Step 1: Push code to GitHub

Push your local repository to a new GitHub repository.

### Step 2: Deploy Frontend to Vercel

1. Log in to [Vercel](https://vercel.com/) with GitHub.
2. Click **Add New** > **Project**
3. Select your repository
4. Vercel will automatically detect Vite. Leave the default build settings:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Click **Deploy**. Note the assigned URL (e.g., `https://product-analyzer.vercel.app`).

### Step 3: Configure `vercel.json`

The provided `vercel.json` file configures Vercel to proxy API requests to your future Render backend. 

Before deploying the backend, update `vercel.json`:
Replace `https://product-analyzer-api.onrender.com` with the actual URL of your deployed Render backend once you have it.

### Step 4: Prepare the Backend Data

The API requires two SQLite databases:
1. **Source DB**: The existing Husqvarna Service Hub data.
2. **Metadata DB**: The application uses this to store user configurations.

Because Render's free tier spins down and loses data, you must use a persistent disk or provide the databases via a Volume.

### Step 5: Deploy Backend to Render

1. Log in to [Render](https://render.com/) with GitHub.
2. Click **New** > **Web Service**.
3. Select your GitHub repository.
4. Set the following:
   - **Name**: `product-analyzer-api`
   - **Runtime**: `Node`
   - **Build Command**: `npm ci && npm run typecheck --workspace=@product-analyzer/api && npm run build --workspace=@product-analyzer/api`
   - **Start Command**: `npm start --workspace=@product-analyzer/api`
   - **Instance Type**: `Free`
5. Expand **Advanced**:
   - Add Environment Variables:
     - `NODE_ENV`: `production`
     - `SOURCE_DB_PATH`: `/data/source.db`
     - `METADATA_DB_PATH`: `/data/metadata.db`
     - `PORT`: `10000`
   - Add a Disk:
     - Name: `data`
     - Mount Path: `/data`
     - Size: `1 GB`
6. Click **Create Web Service**.

**Important**: Once deployed, you must access the Render console/shell and upload your `source.db` to the `/data/` directory. The application will automatically create the `metadata.db` if it doesn't exist.

## Option 2: Docker / Custom VPS

If you prefer to host everything on a single VPS (like DigitalOcean, Linode, or AWS EC2), use the provided Docker configuration.

### 1. Build the Docker Image

```bash
docker build -t product-analyzer-api -f Dockerfile.api .
```

### 2. Run the Container

Create a local directory for your databases:

```bash
mkdir -p ./data
cp path/to/your/husqvarna/source.db ./data/source.db
```

Run the container, mounting the data directory:

```bash
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --name product-analyzer-api \
  product-analyzer-api
```

The API will now be available at `http://localhost:3000`.

### 3. Serve the Frontend

You can build the frontend statically and serve it with Nginx:

```bash
npm run build --workspace=@product-analyzer/web
```

Copy the contents of `apps/web/dist` to your Nginx web root (e.g., `/var/www/html`).

## Database Migration
## Option 3: Fly.io (Free-ish)

Fly.io allows deploying containers globally with persistent volumes. While not strictly "free" (requires a credit card for verification), its Hobby plan has a generous free allowance.

### Step 1: Install Fly CLI
```bash
curl -L https://fly.io/install.sh | sh
```

### Step 2: Deploy the API
From this directory:
```bash
fly launch --config fly.toml
```

### Step 3: Upload your database
```bash
fly sftp shell
# Use sftp to upload source.db to /data/source.db
```


If you want to move away from SQLite for the metadata DB to avoid persistent disk requirements (e.g., using a free PostgreSQL database on Supabase), see `MIGRATION_GUIDE.md` for instructions on adapting the code.
