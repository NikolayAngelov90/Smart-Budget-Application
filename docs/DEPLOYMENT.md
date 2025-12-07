# Deployment Checklist - Smart Budget Application

This document provides a comprehensive checklist for deploying the Smart Budget Application to production (Vercel) and setting up all required environment variables and services.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [External Services Setup](#external-services-setup)
4. [Vercel Deployment](#vercel-deployment)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- [ ] Vercel account created
- [ ] Supabase project created
- [ ] Google OAuth app configured
- [ ] GitHub OAuth app configured
- [ ] Upstash Redis database created (required for production)
- [ ] Git repository connected to Vercel

---

## Environment Variables

All environment variables must be configured in **Vercel Dashboard → Settings → Environment Variables**.

### Required for ALL Environments (Production, Preview, Development)

#### 1. Supabase Configuration
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Where to find:**
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Settings → API**
4. Copy **Project URL** and **anon public** key

---

#### 2. Google OAuth
```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

**Where to find:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services → Credentials**
3. Find your OAuth 2.0 Client ID
4. Copy **Client ID** and **Client Secret**

**⚠️ Important:** Update authorized redirect URIs:
- Add: `https://your-project.vercel.app/auth/callback`
- Add: `https://<project-id>.supabase.co/auth/v1/callback`

---

#### 3. GitHub OAuth
```bash
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

**Where to find:**
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps**
3. Find your application
4. Copy **Client ID** and generate a new **Client Secret** if needed

**⚠️ Important:** Update authorization callback URL:
- Add: `https://your-project.vercel.app/auth/callback`

---

#### 4. Cron Job Authentication (Production & Preview only)
```bash
CRON_SECRET=your_secure_random_string_minimum_32_characters
```

**How to generate:**

**Option 1: Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 2: OpenSSL**
```bash
openssl rand -hex 32
```

**Option 3: Online Generator**
- Use: [RandomKeygen.com](https://randomkeygen.com/)
- Select "CodeIgniter Encryption Keys" (256-bit)

**⚠️ Security:**
- **MUST** be at least 32 characters
- Use different values for production vs. preview
- Store securely in password manager
- Rotate every 90 days

---

#### 5. Upstash Redis (REQUIRED for Production, Optional for Local)
```bash
UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token
```

**Where to find:**
1. Go to [Upstash Console](https://console.upstash.com/)
2. Select your Redis database
3. Navigate to **REST API** section
4. Copy **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN**

**⚠️ Critical:** Rate limiting will NOT work across multiple instances without Redis.

**How to create Upstash Redis database:**
1. Sign up at [Upstash](https://upstash.com/)
2. Click **Create Database**
3. Choose **Global** for multi-region support
4. Select region closest to your Vercel deployment
5. Click **Create**
6. Copy REST API credentials

---

#### 6. Application URL
```bash
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
```

**Production:**
- Use your production domain (e.g., `https://smartbudget.app`)
- Or use Vercel domain (e.g., `https://smart-budget.vercel.app`)

**Preview:**
- Use: `https://your-project-git-branch-user.vercel.app`
- Or set to preview domain pattern

**Development:**
- Use: `http://localhost:3000`

---

## External Services Setup

### 1. Supabase Database

**Row-Level Security (RLS) Policies:**
- [ ] Verify RLS is enabled on all tables
- [ ] Test policies with different user accounts
- [ ] Ensure transactions table has user_id filter
- [ ] Ensure insights table has user_id filter
- [ ] Ensure categories table has user_id filter

**Database Schema:**
- [ ] Run all migrations from `supabase/migrations/`
- [ ] Verify all tables exist: `profiles`, `transactions`, `categories`, `insights`
- [ ] Check indexes are created for performance
- [ ] Verify foreign key constraints

**Authentication Providers:**
- [ ] Enable Email/Password provider
- [ ] Enable Google OAuth provider
- [ ] Enable GitHub OAuth provider
- [ ] Configure redirect URLs for all providers

---

### 2. Upstash Redis

**Database Configuration:**
- [ ] Select **Global** type for multi-region
- [ ] Enable **Eviction** to automatically remove old keys
- [ ] Set **Max Memory Policy** to `allkeys-lru`
- [ ] Enable **TLS** for security

**Monitoring:**
- [ ] Set up alerts for high memory usage (>80%)
- [ ] Monitor daily request count
- [ ] Check error rates in dashboard

---

## Vercel Deployment

### Step 1: Connect Repository

1. [ ] Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. [ ] Click **New Project**
3. [ ] Import your Git repository
4. [ ] Select **Next.js** as framework
5. [ ] Configure project settings:
   - **Framework Preset:** Next.js
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
   - **Install Command:** `npm install`

---

### Step 2: Configure Environment Variables

1. [ ] Navigate to **Settings → Environment Variables**
2. [ ] Add all variables from [Environment Variables](#environment-variables) section
3. [ ] Select appropriate environments:
   - ✅ Production (required for all variables)
   - ✅ Preview (recommended for all variables)
   - ⬜ Development (optional, use .env.local instead)
4. [ ] Click **Save** after each variable

**⚠️ Important Order:**
1. Add **CRON_SECRET** first
2. Add **Upstash Redis** credentials second
3. Add **Supabase** credentials third
4. Add **OAuth** credentials fourth
5. Add **NEXT_PUBLIC_APP_URL** last

---

### Step 3: Configure Build & Development Settings

1. [ ] Go to **Settings → General**
2. [ ] Set **Node.js Version:** 18.x or 20.x
3. [ ] Enable **Automatically expose System Environment Variables**
4. [ ] Go to **Settings → Git**
5. [ ] Configure **Production Branch:** `main` or `master`
6. [ ] Enable **Preview Deployments** for pull requests

---

### Step 4: Configure Cron Jobs (vercel.json)

**File should already exist:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/generate-insights",
      "schedule": "0 0 * * *"
    }
  ]
}
```

- [ ] Verify `vercel.json` exists in repository root
- [ ] Verify cron path matches your API route
- [ ] Schedule: `0 0 * * *` = Daily at midnight UTC

**⚠️ Note:** Cron jobs are only active on **production** deployments, not preview.

---

### Step 5: Deploy

1. [ ] Click **Deploy** button in Vercel
2. [ ] Wait for build to complete (~2-4 minutes)
3. [ ] Check build logs for errors
4. [ ] Verify deployment status is **Ready**

**If build fails:**
- Check build logs in Vercel dashboard
- Verify all environment variables are set
- Ensure no TypeScript errors exist locally
- Run `npm run build` locally to reproduce

---

## Post-Deployment Verification

### 1. Application Health Checks

- [ ] Visit production URL: `https://your-project.vercel.app`
- [ ] Homepage loads without errors
- [ ] Sign up with email/password works
- [ ] Sign in with Google works
- [ ] Sign in with GitHub works
- [ ] Create a test transaction
- [ ] View dashboard with charts
- [ ] Test category creation
- [ ] Verify insights are displayed

---

### 2. API Endpoint Tests

Test each endpoint using browser or Postman:

- [ ] `GET /api/transactions` (authenticated)
- [ ] `POST /api/transactions` (authenticated)
- [ ] `GET /api/categories` (authenticated)
- [ ] `GET /api/insights` (authenticated)
- [ ] `POST /api/insights/generate?forceRegenerate=true` (authenticated)
- [ ] `GET /api/cron/generate-insights` (with `Authorization: Bearer <CRON_SECRET>`)

---

### 3. Database Verification

1. [ ] Go to Supabase Dashboard → Table Editor
2. [ ] Verify test user exists in `profiles` table
3. [ ] Verify test transaction exists in `transactions` table
4. [ ] Verify insights exist in `insights` table
5. [ ] Check RLS policies are enforced (try accessing other user's data)

---

### 4. Redis Verification

1. [ ] Go to Upstash Console → Your Database
2. [ ] Click **Data Browser**
3. [ ] Trigger manual refresh: `/api/insights/generate?forceRegenerate=true`
4. [ ] Check for key: `rate_limit:<user_id>`
5. [ ] Verify key expires after 5 minutes (300 seconds)

---

### 5. Cron Job Verification

**⚠️ Note:** Cron jobs only run in **production**, not preview.

**Method 1: Manual Trigger**
```bash
curl -X GET https://your-project.vercel.app/api/cron/generate-insights \
  -H "Authorization: Bearer your-cron-secret-here"
```

**Expected Response:**
```json
{
  "success": true,
  "skipped": true,
  "reason": "Not start of month"
}
```

**Method 2: Check Vercel Logs**
1. [ ] Go to Vercel Dashboard → Deployments → Your Production Deployment
2. [ ] Click **View Function Logs**
3. [ ] Filter for `/api/cron/generate-insights`
4. [ ] Wait for midnight UTC
5. [ ] Verify cron executed successfully

---

### 6. Performance Checks

- [ ] Run Lighthouse audit (target: 90+ score)
- [ ] Check Time to First Byte (TTFB) < 600ms
- [ ] Verify API response times < 1s
- [ ] Test with 100+ transactions loaded
- [ ] Verify pagination works on insights page

---

## Troubleshooting

### Issue: "Unauthorized" error on login

**Causes:**
- OAuth redirect URLs not configured
- Wrong CLIENT_ID or CLIENT_SECRET
- Supabase Auth providers not enabled

**Solutions:**
1. Verify OAuth redirect URLs in Google/GitHub dashboards
2. Check environment variables in Vercel
3. Enable auth providers in Supabase Dashboard → Authentication → Providers

---

### Issue: Cron job not running

**Causes:**
- `CRON_SECRET` environment variable not set
- Cron job only runs in production (not preview)
- Invalid `vercel.json` configuration

**Solutions:**
1. Verify `CRON_SECRET` is set in Production environment
2. Deploy to production (not preview)
3. Check Vercel logs for cron execution
4. Manually trigger endpoint to test authentication

---

### Issue: Rate limiting not working across instances

**Causes:**
- Upstash Redis not configured
- Wrong Redis credentials
- Using in-memory fallback

**Solutions:**
1. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
2. Verify credentials in Upstash Console
3. Check Vercel logs for Redis connection errors
4. Redeploy after adding variables

---

### Issue: Database queries failing

**Causes:**
- RLS policies blocking queries
- Wrong user_id in JWT token
- Supabase credentials incorrect

**Solutions:**
1. Check RLS policies in Supabase Dashboard → Authentication → Policies
2. Verify user is authenticated (check session in browser DevTools)
3. Test with RLS disabled temporarily (NOT in production)
4. Check Supabase logs for auth errors

---

### Issue: Build failing on Vercel

**Causes:**
- TypeScript errors
- Missing environment variables during build
- Node.js version mismatch

**Solutions:**
1. Run `npm run build` locally to reproduce
2. Fix TypeScript errors shown in logs
3. Ensure `NEXT_PUBLIC_*` variables are set (needed at build time)
4. Set Node.js version to 18.x or 20.x in Vercel settings

---

## Security Checklist

Before going live:

- [ ] Rotate all secrets (CRON_SECRET, OAuth secrets)
- [ ] Enable 2FA on Supabase, Vercel, and OAuth provider accounts
- [ ] Review RLS policies for security gaps
- [ ] Set up error tracking (Sentry recommended)
- [ ] Configure rate limiting for API endpoints
- [ ] Add CSP headers for XSS protection
- [ ] Enable HTTPS only (HTTP redirects to HTTPS)
- [ ] Review and limit CORS origins if using custom domain
- [ ] Set up monitoring alerts for errors and downtime
- [ ] Create backup strategy for database (Supabase automatic backups)

---

## Monitoring & Maintenance

### Daily

- [ ] Check Vercel analytics for errors
- [ ] Monitor Upstash Redis usage
- [ ] Review Supabase auth logs

### Weekly

- [ ] Review application performance metrics
- [ ] Check for dependency updates
- [ ] Review user feedback and bug reports

### Monthly

- [ ] Rotate CRON_SECRET
- [ ] Review and update OAuth apps
- [ ] Audit RLS policies
- [ ] Check database usage and optimize queries
- [ ] Review and prune old insights data

### Quarterly

- [ ] Full security audit
- [ ] Update all dependencies
- [ ] Review and optimize Redis cache strategy
- [ ] Performance benchmarking
- [ ] Disaster recovery drill

---

## Rollback Procedure

If deployment has critical issues:

1. [ ] Go to Vercel Dashboard → Deployments
2. [ ] Find previous stable deployment
3. [ ] Click **⋯** (three dots) → **Promote to Production**
4. [ ] Verify rollback successful
5. [ ] Investigate and fix issue in development
6. [ ] Redeploy when fixed

---

## Support & Resources

- **Vercel Documentation:** https://vercel.com/docs
- **Next.js Documentation:** https://nextjs.org/docs
- **Supabase Documentation:** https://supabase.com/docs
- **Upstash Documentation:** https://docs.upstash.com/
- **Project Repository:** [Your GitHub repo URL]
- **Production URL:** [Your production URL]

---

**Last Updated:** 2025-12-07
**Version:** 1.0.0
