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

#### 5. Redis Configuration (REQUIRED for Production, Optional for Local)

**Option 1: Upstash Redis (Recommended for Vercel/Serverless)**
```bash
UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token
```

**Option 2: Self-hosted Redis (Alternative)**
```bash
REDIS_URL=redis://localhost:6379
# Or with authentication:
# REDIS_URL=redis://username:password@your-redis-server:6379
```

**Option 3: Feature Flag (Disable Redis)**
```bash
USE_REDIS_RATE_LIMIT=false
```

**⚠️ Critical:** Rate limiting will NOT work across multiple serverless instances without Redis. In-memory fallback is NOT production-ready for multi-instance deployments.

**See [Redis Setup Guide](#redis-setup-guide) below for detailed configuration instructions.**

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

## Redis Setup Guide

The application uses Redis for distributed rate limiting across multiple serverless instances. This section provides detailed setup instructions for both Upstash Redis (recommended) and self-hosted Redis.

### Why Redis is Required

**Production Requirements:**
- **Multi-instance rate limiting:** Vercel deploys multiple serverless function instances. Without Redis, each instance maintains its own in-memory rate limit cache, allowing users to bypass rate limits by hitting different instances.
- **Consistent rate limiting:** Redis provides a centralized store for rate limit counters across all instances.
- **Sliding window algorithm:** Uses @upstash/ratelimit library with sliding window for accurate rate limiting (10 requests per 60 seconds).

**Development/Local:**
- Redis is optional for local development
- Application gracefully falls back to in-memory Map when Redis is unavailable
- Use `USE_REDIS_RATE_LIMIT=false` to explicitly disable Redis

---

### Option 1: Upstash Redis (Recommended for Vercel)

**Why Upstash?**
- Serverless-native (REST API, no persistent connections)
- Global replication for low latency
- Pay-per-request pricing (free tier available)
- Zero infrastructure management
- Built-in TLS encryption

**Setup Instructions:**

1. **Create Upstash Account**
   - Go to [https://console.upstash.com/](https://console.upstash.com/)
   - Sign up with GitHub or email

2. **Create Redis Database**
   - Click **Create Database**
   - **Name:** `smart-budget-production` (or your preferred name)
   - **Type:** Select **Global** for multi-region replication
   - **Region:** Choose region closest to your Vercel deployment
     - US East: `us-east-1` (recommended for US traffic)
     - EU West: `eu-west-1` (recommended for EU traffic)
     - Asia Pacific: `ap-southeast-1` (recommended for Asia traffic)
   - **Eviction:** Enable
   - **TLS:** Enable (default)
   - Click **Create**

3. **Get REST API Credentials**
   - Navigate to your database dashboard
   - Click **REST API** tab
   - Copy the following:
     - `UPSTASH_REDIS_REST_URL` (e.g., `https://us1-flying-fish-12345.upstash.io`)
     - `UPSTASH_REDIS_REST_TOKEN` (long alphanumeric string)

4. **Add to Vercel Environment Variables**
   ```bash
   UPSTASH_REDIS_REST_URL=https://us1-flying-fish-12345.upstash.io
   UPSTASH_REDIS_REST_TOKEN=AYmrASQgYjlmM2E3YTItMTY5Zi00...
   ```

5. **Verify Configuration**
   - Deploy to Vercel
   - Visit: `https://your-app.vercel.app/api/health/redis`
   - Expected response:
     ```json
     {
       "status": "healthy",
       "provider": "upstash",
       "latency_ms": 15,
       "feature_flag": true,
       "timestamp": "2026-01-07T10:30:00.000Z"
     }
     ```

**Free Tier Limits:**
- 10,000 commands per day
- 256 MB storage
- Sufficient for small-to-medium applications

**Pricing (as of 2026):**
- Free tier: $0
- Pro tier: $0.20 per 100k commands

---

### Option 2: Self-hosted Redis

**When to use self-hosted?**
- You already have Redis infrastructure
- Enterprise requirements (on-premises)
- Cost optimization for high-traffic apps
- Custom Redis modules needed

**Deployment Options:**

#### Option 2A: Docker (Local Development)

1. **Install Docker**
   - Download from [https://www.docker.com/](https://www.docker.com/)

2. **Run Redis Container**
   ```bash
   docker run -d \
     --name smart-budget-redis \
     -p 6379:6379 \
     redis:7-alpine \
     redis-server --requirepass your-strong-password
   ```

3. **Set Environment Variable**
   ```bash
   REDIS_URL=redis://:your-strong-password@localhost:6379
   ```

4. **Verify Connection**
   ```bash
   docker exec -it smart-budget-redis redis-cli
   AUTH your-strong-password
   PING
   # Should return: PONG
   ```

#### Option 2B: Redis Cloud (Managed Service)

1. **Create Redis Cloud Account**
   - Go to [https://redis.com/try-free/](https://redis.com/try-free/)
   - Sign up for free tier (30 MB)

2. **Create Database**
   - Click **New Database**
   - Select region closest to your deployment
   - Choose free tier or paid plan

3. **Get Connection String**
   - Copy **Public endpoint**
   - Format: `redis://username:password@redis-12345.c1.us-east-1-2.ec2.cloud.redislabs.com:12345`

4. **Set Environment Variable**
   ```bash
   REDIS_URL=redis://default:your-password@redis-12345.c1.us-east-1-2.ec2.cloud.redislabs.com:12345
   ```

#### Option 2C: AWS ElastiCache

1. **Create ElastiCache Redis Cluster**
   - Go to AWS Console → ElastiCache
   - Click **Create Redis cluster**
   - Choose **Cluster Mode Disabled** for simplicity
   - Select instance type (t3.micro for testing)

2. **Configure Security Group**
   - Allow inbound traffic on port 6379
   - From your application's IP range

3. **Get Primary Endpoint**
   - Copy endpoint: `my-cluster.abc123.0001.use1.cache.amazonaws.com:6379`

4. **Set Environment Variable**
   ```bash
   REDIS_URL=redis://my-cluster.abc123.0001.use1.cache.amazonaws.com:6379
   ```

**⚠️ Important for Self-hosted Redis:**
- Ensure Redis is accessible from Vercel (public endpoint or VPN)
- Enable TLS if exposing to internet
- Use strong authentication passwords
- Configure firewall rules (allow only Vercel IPs)
- Monitor memory usage and set eviction policy

---

### Option 3: Disable Redis (Development Only)

**Use Case:**
- Local development without Redis installed
- Testing rate limiting fallback behavior
- CI/CD environments without Redis

**Configuration:**
```bash
USE_REDIS_RATE_LIMIT=false
```

**Behavior:**
- Application uses in-memory Map for rate limiting
- Rate limits are per-instance (not distributed)
- **NOT suitable for production** with multiple instances

**Health Check Response:**
```json
{
  "status": "degraded",
  "provider": "none",
  "latency_ms": null,
  "feature_flag": false,
  "message": "Redis disabled by feature flag (USE_REDIS_RATE_LIMIT=false)",
  "timestamp": "2026-01-07T10:30:00.000Z"
}
```

---

### Rate Limit Configuration

**Current Settings:**
- **Rate Limit:** 10 requests per 60 seconds (sliding window)
- **Algorithm:** Sliding window (via @upstash/ratelimit)
- **Scope:** Per user ID
- **Endpoints Protected:** `/api/insights/generate`, `/api/insights/dismiss`

**Key Prefix:**
- `rate_limit:<user_id>` (e.g., `rate_limit:abc123-def456-789`)

**Fallback Behavior:**
- If Redis is unavailable, automatically falls back to in-memory Map
- Logs warning: `[Rate Limit] @upstash/ratelimit error, falling back to in-memory`
- Continues serving requests (graceful degradation)

---

### Health Check Endpoint

**Endpoint:** `GET /api/health/redis`

**Purpose:**
- Monitor Redis connection status
- Check latency and provider type
- Verify feature flag configuration
- Use in deployment readiness checks

**Response Codes:**
- `200 OK` - Redis healthy, degraded, or disabled (all valid states)
- `500 Internal Server Error` - Health check itself failed

**Response Examples:**

**Healthy (Upstash):**
```json
{
  "status": "healthy",
  "provider": "upstash",
  "latency_ms": 12,
  "feature_flag": true,
  "timestamp": "2026-01-07T10:30:00.000Z"
}
```

**Healthy (Self-hosted):**
```json
{
  "status": "healthy",
  "provider": "ioredis",
  "latency_ms": 5,
  "feature_flag": true,
  "timestamp": "2026-01-07T10:30:00.000Z"
}
```

**Degraded (Not Configured):**
```json
{
  "status": "degraded",
  "provider": "none",
  "latency_ms": null,
  "feature_flag": true,
  "message": "Redis not configured, using in-memory fallback",
  "timestamp": "2026-01-07T10:30:00.000Z"
}
```

**Degraded (Ping Failed):**
```json
{
  "status": "degraded",
  "provider": "upstash",
  "latency_ms": null,
  "feature_flag": true,
  "message": "Redis ping failed, falling back to in-memory",
  "timestamp": "2026-01-07T10:30:00.000Z"
}
```

**Use in Monitoring:**
```bash
# Vercel deployment readiness check
curl https://your-app.vercel.app/api/health/redis

# Uptime monitoring (UptimeRobot, Pingdom, etc.)
# Configure HTTP monitor for /api/health/redis
# Alert on status code != 200
```

---

### Troubleshooting Redis

#### Issue: Health check shows "degraded" status

**Cause 1: Redis not configured**
- Missing environment variables

**Solution:**
```bash
# Verify environment variables are set
echo $UPSTASH_REDIS_REST_URL
echo $UPSTASH_REDIS_REST_TOKEN
# Or
echo $REDIS_URL
```

**Cause 2: Redis credentials incorrect**
- Wrong URL or token
- Expired credentials

**Solution:**
1. Go to Upstash Console → Your Database → REST API
2. Copy fresh credentials
3. Update Vercel environment variables
4. Redeploy

**Cause 3: Redis server unreachable**
- Self-hosted Redis down
- Firewall blocking connection
- Network issues

**Solution:**
```bash
# Test Redis connection manually
redis-cli -u $REDIS_URL PING
# Should return: PONG

# Check Redis logs
docker logs smart-budget-redis
```

---

#### Issue: Rate limiting not working across instances

**Symptom:**
- Users can refresh page rapidly and bypass rate limits
- Rate limit only applies to some requests

**Cause:**
- Using in-memory fallback instead of Redis
- Each serverless instance has its own rate limit cache

**Solution:**
1. Check health endpoint: `GET /api/health/redis`
2. Verify provider is `upstash` or `ioredis`, not `none`
3. If degraded, check Redis credentials and connectivity
4. Verify `USE_REDIS_RATE_LIMIT` is not set to `false`

---

#### Issue: High Redis latency

**Symptom:**
- Health check shows `latency_ms > 100`
- Slow API responses

**Cause:**
- Redis region far from Vercel deployment
- Network congestion
- Redis server overloaded

**Solution:**
1. **For Upstash:** Create database in region closer to Vercel
   - Check Vercel region: `vercel inspect <deployment-url>`
   - Create new Upstash database in matching region
   - Update environment variables

2. **For Self-hosted:** Optimize network path
   - Use Redis in same datacenter as application
   - Enable Redis pipelining
   - Upgrade Redis instance size

---

#### Issue: ECONNREFUSED or connection timeout

**Symptom:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Cause:**
- Redis URL pointing to localhost in production
- Redis server not running
- Firewall blocking port 6379

**Solution:**
1. **Local Development:**
   ```bash
   # Start Redis with Docker
   docker start smart-budget-redis
   # Or install Redis locally
   brew install redis
   redis-server
   ```

2. **Production:**
   - Ensure `REDIS_URL` uses public endpoint, not localhost
   - Verify Redis server is running
   - Check security group rules (AWS) or firewall

---

#### Issue: Authentication failed

**Symptom:**
```
Error: ERR invalid password
```

**Cause:**
- Wrong password in `REDIS_URL`
- Redis configured with AUTH but URL missing password

**Solution:**
```bash
# Correct format for authenticated Redis
REDIS_URL=redis://:password@host:6379
# Or with username
REDIS_URL=redis://username:password@host:6379

# Test authentication
redis-cli -u $REDIS_URL PING
```

---

#### Issue: Memory limit exceeded

**Symptom:**
- Upstash dashboard shows memory near 100%
- Rate limiting stops working

**Cause:**
- Free tier limit (256 MB) exceeded
- Rate limit keys not expiring
- Too many users

**Solution:**
1. **Enable Eviction:**
   - Upstash Console → Your Database → Settings
   - Enable **Eviction**
   - Set policy to `allkeys-lru` (least recently used)

2. **Verify Key Expiration:**
   ```bash
   # Check rate limit key TTL
   redis-cli -u $REDIS_URL TTL "rate_limit:user-123"
   # Should return: ~60 (seconds remaining)
   ```

3. **Upgrade Plan:**
   - Upstash: Upgrade to Pro tier for more storage
   - Self-hosted: Increase max memory limit

---

### Redis Monitoring Best Practices

1. **Set Up Alerts**
   - Upstash: Enable email alerts for >80% memory usage
   - Self-hosted: Use CloudWatch (AWS) or Prometheus

2. **Monitor Key Metrics**
   - Latency (should be <50ms for Upstash, <10ms for local)
   - Memory usage
   - Request count per day
   - Error rate

3. **Regular Maintenance**
   - Review eviction policy monthly
   - Check for unused keys
   - Monitor memory growth trends

4. **Health Check Integration**
   - Add `/api/health/redis` to uptime monitoring
   - Alert on status != "healthy"
   - Set up Vercel deployment checks

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

**Health Check:**
1. [ ] Test Redis health endpoint:
   ```bash
   curl https://your-project.vercel.app/api/health/redis
   ```
2. [ ] Verify response shows `"status": "healthy"`
3. [ ] Confirm provider is `"upstash"` or `"ioredis"` (not `"none"`)
4. [ ] Check latency is reasonable (`latency_ms < 100`)

**Data Browser:**
1. [ ] Go to Upstash Console → Your Database → Data Browser
2. [ ] Trigger manual refresh: `/api/insights/generate?forceRegenerate=true`
3. [ ] Check for key pattern: `rate_limit:<user_id>`
4. [ ] Verify key expires after 60 seconds (TTL ~60)
5. [ ] Confirm rate limit counter increments on each request

**Rate Limiting Test:**
1. [ ] Make 11 consecutive requests to `/api/insights/generate`
2. [ ] Verify first 10 requests succeed
3. [ ] Verify 11th request returns 429 Too Many Requests
4. [ ] Wait 60 seconds and verify rate limit resets

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
- Redis not configured or using in-memory fallback
- Wrong Redis credentials
- Feature flag disabled (`USE_REDIS_RATE_LIMIT=false`)
- Redis provider is `none` instead of `upstash` or `ioredis`

**Solutions:**
1. **Check Redis health:**
   ```bash
   curl https://your-project.vercel.app/api/health/redis
   ```
   - Verify `"status": "healthy"` and `"provider"` is not `"none"`

2. **For Upstash Redis:**
   - Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
   - Verify credentials in Upstash Console → Your Database → REST API

3. **For Self-hosted Redis:**
   - Add `REDIS_URL` (e.g., `redis://localhost:6379`)
   - Ensure Redis server is accessible from Vercel

4. **Check feature flag:**
   - Ensure `USE_REDIS_RATE_LIMIT` is not set to `false`
   - If missing, it defaults to `true` (enabled)

5. **Redeploy:**
   - After adding variables, trigger new deployment
   - Check Vercel logs for Redis connection errors

**See [Redis Setup Guide](#redis-setup-guide) and [Troubleshooting Redis](#troubleshooting-redis) for detailed instructions.**

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

**Last Updated:** 2026-01-07
**Version:** 2.0.0 (Story 9-1: Added comprehensive Redis setup guide for multi-provider support)
