# Visual Guide: Finding and Setting Up Project Secrets

This guide explains how to locate your Supabase and Render credentials and add them to GitHub Actions.

## 1. Supabase Secrets

Find these in your [Supabase Dashboard](https://supabase.com/dashboard).

### SUPABASE_URL and SUPABASE_ANON_KEY
*   Open your project in the dashboard.
*   Click the **Settings** icon (gear) at the bottom of the left sidebar.
*   Select **API** from the sidebar menu under the Project Settings section.
*   **SUPABASE_URL**: Look for the **Project URL** field. It starts with `https://` and ends with `.supabase.co`.
*   **SUPABASE_ANON_KEY**: Look for the **Project API keys** section. Copy the value labeled **anon** and **public**.

### SUPABASE_JWT_SECRET
*   Stay on the same **API** settings page.
*   Scroll down to the **JWT Settings** section.
*   **SUPABASE_JWT_SECRET**: Find the field labeled **JWT Secret**. Click the reveal button to see the value.

## 2. Render Deploy Hook

Find this in your [Render Dashboard](https://dashboard.render.com).

*   Select the **Web Service** you want to deploy.
*   Click **Settings** in the top navigation bar or the left sidebar.
*   Scroll down to the **Deploy Hook** section.
*   **RENDER_DEPLOY_HOOK**: Copy the full URL provided in the input box. It usually looks like `https://api.render.com/deploy/srv-...`.

## 3. GitHub Actions Secrets

Add these secrets to your repository to enable automated deployments.

*   Navigate to your repository on **GitHub**.
*   Click on the **Settings** tab in the top navigation bar.
*   In the left sidebar, find the **Security** section.
*   Click **Secrets and variables** to expand it, then select **Actions**.
*   Click the green **New repository secret** button.
*   Enter the **Name** (e.g., `SUPABASE_URL`).
*   Paste the corresponding value into the **Secret** box.
*   Click **Add secret**.
*   Repeat these steps for each secret:
    *   `SUPABASE_URL`
    *   `SUPABASE_ANON_KEY`
    *   `SUPABASE_JWT_SECRET`
    *   `RENDER_DEPLOY_HOOK`

Once added, these secrets are encrypted and available to your GitHub Actions workflows.
