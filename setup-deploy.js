import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Setup & Deployment Automation Script
 * 
 * This script automates:
 * 1. GitHub Repository creation and initial push.
 * 2. Supabase project initialization and linking.
 * 3. Vercel deployment linking.
 * 
 * Prerequisites:
 * - gh CLI installed and authenticated (`gh auth login`)
 * - VERCEL_TOKEN (optional, for non-interactive)
 * - SUPABASE_ACCESS_TOKEN (optional, for non-interactive)
 */

const WORKDIR = process.cwd();

function log(msg) {
  console.log(`\n🚀 [Automation] ${msg}`);
}

async function run() {
  log("Starting Product Analyzer Setup Automation...");

  // 1. GitHub Setup
  try {
    log("Checking GitHub CLI status...");
    execSync('gh auth status', { stdio: 'inherit' });
    
    const repoName = path.basename(WORKDIR);
    log(`Creating GitHub repository: ${repoName}...`);
    execSync(`gh repo create ${repoName} --public --source=. --remote=origin --push`, { stdio: 'inherit' });
  } catch (e) {
    console.warn("⚠️ GitHub CLI not authenticated or repo already exists. Skipping repo creation.");
  }

  // 2. Supabase Setup
  log("Initializing Supabase...");
  try {
    execSync('npx supabase init', { stdio: 'inherit' });
    console.log("✅ Supabase initialized locally.");
  } catch (e) {
    console.warn("⚠️ Supabase already initialized.");
  }

  // 3. Vercel Setup
  log("Linking to Vercel...");
  try {
    // This will be interactive unless VERCEL_TOKEN is set
    execSync('npx vercel link --yes', { stdio: 'inherit' });
    console.log("✅ Vercel project linked.");
  } catch (e) {
    console.error("❌ Vercel linking failed. You may need to run 'npx vercel login' first.");
  }

  // 4. Environment Secrets
  log("Configuring GitHub Secrets for CI/CD...");
  try {
    console.log("Enter your SUPABASE_URL: ");
    // ... prompt or just tell them to set it
    console.log("Use: gh secret set SUPABASE_URL --body 'your-url'");
    console.log("Use: gh secret set SUPABASE_ANON_KEY --body 'your-key'");
    console.log("Use: gh secret set SUPABASE_JWT_SECRET --body 'your-secret'");
  } catch (e) {
    console.warn("⚠️ GitHub Secrets configuration failed.");
  }

  log("Local automation complete!");
  console.log("\nNext Steps:");
  console.log("1. Go to https://supabase.com and create a new project.");
  console.log("2. Run 'npx supabase link --project-ref <your-project-id>'");
  console.log("3. Push your migrations: 'npx supabase db push'");
  console.log("4. Deploy to Vercel: 'npx vercel --prod'");
}

run().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
