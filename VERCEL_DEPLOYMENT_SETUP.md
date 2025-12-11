# Vercel Deployment Setup Guide

This guide will help you configure automatic deployment to Vercel after GitHub Actions tests pass.

## Prerequisites

- Vercel account with your project already set up
- GitHub repository with admin access

## Step 1: Get Vercel Token

1. Go to [Vercel Account Settings](https://vercel.com/account/tokens)
2. Click **"Create Token"**
3. Give it a name (e.g., "GitHub Actions Deployment")
4. Set the scope to your team/account
5. Click **"Create"**
6. **Copy the token immediately** (you won't be able to see it again)

## Step 2: Get Vercel Project Information

Run these commands in your project directory:

```bash
# Install Vercel CLI if not already installed
npm install --global vercel@latest

# Login to Vercel
vercel login

# Link to your Vercel project
vercel link

# This will create a .vercel folder with project.json
```

After running `vercel link`, check the `.vercel/project.json` file:

```bash
cat .vercel/project.json
```

You'll see something like:
```json
{
  "projectId": "prj_xxxxxxxxxxxx",
  "orgId": "team_xxxxxxxxxxxx"
}
```

## Step 3: Add GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"** and add:

### Required Secret:

**VERCEL_TOKEN**
- Name: `VERCEL_TOKEN`
- Value: The token you copied from Step 1

### Optional Secrets (for more control):

**VERCEL_ORG_ID** (Optional)
- Name: `VERCEL_ORG_ID`
- Value: The `orgId` from `.vercel/project.json`

**VERCEL_PROJECT_ID** (Optional)
- Name: `VERCEL_PROJECT_ID`
- Value: The `projectId` from `.vercel/project.json`

## Step 4: Test the Deployment

1. Commit and push your changes to the `main` branch:
   ```bash
   git add .
   git commit -m "Add Vercel deployment to GitHub Actions"
   git push origin main
   ```

2. Go to **Actions** tab in your GitHub repository
3. Watch the workflow run
4. After tests pass, the "Deploy to Vercel" job will start automatically

## How It Works

- **On Pull Requests**: Only tests run (no deployment)
- **On Push to Main**: Tests run first, then deploys to Vercel production if tests pass
- **Deployment Condition**: Only deploys when:
  - Event is a push (not PR)
  - Branch is `main`
  - All tests pass

## Workflow Steps

1. ✅ Run type check
2. ✅ Run linter
3. ✅ Run tests with coverage
4. ✅ Run performance benchmarks
5. 🚀 Deploy to Vercel (only if all above pass)

## Troubleshooting

### Error: "No token found"
- Make sure you added `VERCEL_TOKEN` to GitHub Secrets
- Check the secret name matches exactly (case-sensitive)

### Error: "Project not found"
- Run `vercel link` in your local project
- Make sure your Vercel project exists
- Check if you need to add `VERCEL_PROJECT_ID` and `VERCEL_ORG_ID` secrets

### Deployment doesn't trigger
- Check if you pushed to `main` branch
- Verify all tests passed
- Check workflow logs in GitHub Actions tab

## Environment Variables

The deployment will use environment variables from:
1. Vercel project settings (production environment)
2. Any `.env.production` file in your repository

Make sure all required environment variables are set in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `NEXT_PUBLIC_APP_URL`

## Alternative: Use Vercel GitHub Integration

If you prefer simpler setup without GitHub Actions deployment:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Git**
4. Enable **"Production Branch"** deployment for `main`
5. Vercel will automatically deploy when tests pass

This approach doesn't require `VERCEL_TOKEN` secret.
