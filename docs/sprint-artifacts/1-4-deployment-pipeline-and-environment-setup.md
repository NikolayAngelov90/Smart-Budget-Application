# Story 1.4: Deployment Pipeline and Environment Setup

Status: ready-for-dev
Created: 2025-11-16
Epic: 1 - Foundation & Infrastructure

## Story

As a developer,
I want automated deployment to Vercel with proper environment management,
So that I can ship updates quickly and reliably.

## Acceptance Criteria

**AC-4.1:** GitHub repository connected to Vercel

**AC-4.2:** Automatic deployment triggers on push to main branch

**AC-4.3:** Production build completes successfully in < 2 minutes

**AC-4.4:** Application accessible via Vercel production URL

**AC-4.5:** Environment variables configured in Vercel dashboard

**AC-4.6:** HTTPS enabled and working (Vercel automatic TLS)

**AC-4.7:** Preview deployments created for feature branches

## Tasks / Subtasks

- [ ] Task 1: Create GitHub repository and push code (AC: #4.1)
  - [ ] Create new repository on GitHub (https://github.com)
  - [ ] Initialize git if not already done: `git init`
  - [ ] Add remote: `git remote add origin <repository-url>`
  - [ ] Stage all files: `git add .`
  - [ ] Create initial commit: `git commit -m "feat: Initial commit with auth infrastructure"`
  - [ ] Push to main: `git push -u origin main`
  - [ ] Verify repository is accessible and code is pushed

- [ ] Task 2: Connect repository to Vercel (AC: #4.1)
  - [ ] Sign up for Vercel account at https://vercel.com
  - [ ] Click "Import Project" or "Add New..."
  - [ ] Select "Import Git Repository"
  - [ ] Authorize Vercel to access GitHub account
  - [ ] Select the Smart Budget repository
  - [ ] Choose team/account for deployment
  - [ ] Verify repository connection established

- [ ] Task 3: Configure Vercel project settings (AC: #4.2, #4.3, #4.7)
  - [ ] Framework Preset: Next.js (auto-detected)
  - [ ] Root Directory: `.` (project root)
  - [ ] Build Command: `npm run build` (default)
  - [ ] Output Directory: `.next` (default)
  - [ ] Install Command: `npm install` (default)
  - [ ] Node.js Version: 18.x or higher
  - [ ] Enable automatic deployments for main branch
  - [ ] Enable preview deployments for all branches
  - [ ] Configure build settings if needed

- [ ] Task 4: Configure environment variables in Vercel (AC: #4.5)
  - [ ] Navigate to Project Settings → Environment Variables
  - [ ] Add `NEXT_PUBLIC_SUPABASE_URL` (Production, Preview, Development)
    - Value: Copy from Supabase Project Settings → API → Project URL
  - [ ] Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production, Preview, Development)
    - Value: Copy from Supabase Project Settings → API → anon public key
  - [ ] Add `SUPABASE_SERVICE_ROLE_KEY` (Production only - sensitive!)
    - Value: Copy from Supabase Project Settings → API → service_role key
  - [ ] Save environment variables
  - [ ] Verify all required env vars are set for each environment

- [ ] Task 5: Deploy to production and verify (AC: #4.2, #4.3, #4.4, #4.6)
  - [ ] Trigger deployment: Push a commit to main or click "Deploy" in Vercel dashboard
  - [ ] Monitor build logs in Vercel dashboard
  - [ ] Verify build completes in < 2 minutes
  - [ ] Check for any build errors or warnings
  - [ ] Verify deployment status shows "Ready"
  - [ ] Access production URL (e.g., `https://smart-budget-app.vercel.app`)
  - [ ] Verify application loads successfully
  - [ ] Check HTTPS is enabled (URL shows padlock icon)
  - [ ] Test basic functionality: Visit /login, /signup pages
  - [ ] Verify middleware redirects work (try accessing /dashboard without auth)

- [ ] Task 6: Test preview deployments (AC: #4.7)
  - [ ] Create a new branch: `git checkout -b test/vercel-preview`
  - [ ] Make a small change (e.g., update README or add comment)
  - [ ] Push branch: `git push -u origin test/vercel-preview`
  - [ ] Verify Vercel creates a preview deployment
  - [ ] Check preview URL in Vercel dashboard or GitHub PR comments
  - [ ] Verify preview deployment works correctly
  - [ ] Delete test branch after verification

- [ ] Task 7: Configure custom domain (Optional)
  - [ ] Navigate to Project Settings → Domains
  - [ ] Add custom domain if available
  - [ ] Configure DNS settings as instructed
  - [ ] Verify custom domain resolves to application
  - [ ] Verify HTTPS certificate is auto-provisioned

- [ ] Task 8: Set up deployment monitoring (Optional but recommended)
  - [ ] Enable Vercel Analytics in Project Settings
  - [ ] Configure deployment notifications (Slack, Email, etc.)
  - [ ] Set up build failure alerts
  - [ ] Review deployment logs and performance metrics

- [ ] Task 9: Document deployment process and verify (AC: all)
  - [ ] Create deployment documentation (can be added to README or separate DEPLOYMENT.md)
  - [ ] Document environment variables required
  - [ ] Document deployment process for team members
  - [ ] Verify all 7 acceptance criteria are met:
    - AC-4.1: GitHub ↔ Vercel connected ✓
    - AC-4.2: Auto-deploy on main push ✓
    - AC-4.3: Build < 2 minutes ✓
    - AC-4.4: App accessible via Vercel URL ✓
    - AC-4.5: Env vars configured ✓
    - AC-4.6: HTTPS enabled ✓
    - AC-4.7: Preview deployments working ✓
  - [ ] Test full deployment cycle: Code change → Push → Auto-deploy → Verify

## Dev Notes

### Architecture Context

This story implements the deployment pipeline as defined in [Epic 1 Tech Spec](tech-spec-epic-1.md), establishing continuous deployment for the application.

**Deployment Strategy:**
- **Platform:** Vercel (Next.js optimized, zero-config deployment)
- **Repository:** GitHub (version control and CI trigger)
- **Environments:** Production (main branch) + Preview (all other branches)
- **Build Process:** Next.js production build with static optimization

**Key Architecture Decisions:**
- Vercel chosen for its Next.js optimization and automatic HTTPS
- Environment-based configuration for Supabase credentials
- Preview deployments enable testing before production merge
- Build time target < 2 minutes ensures rapid iteration

**Critical Constraints:**
- MUST configure environment variables before deployment (app won't work without Supabase keys)
- MUST use HTTPS (Vercel provides automatically)
- MUST test deployment with real Supabase connection
- Service role key should ONLY be in Production environment (security)

### Dependencies on Previous Stories

**Requires Story 1.1 (Project Initialization):**
- Next.js project must be initialized and configured
- package.json with build scripts must exist
- TypeScript configuration must be complete

**Requires Story 1.2 (Supabase Setup):**
- Supabase project URL and keys needed for environment variables
- Database migrations should be run on Supabase project
- `.env.local.example` provides template for required env vars

**Requires Story 1.3 (Authentication):**
- Authentication middleware and routes must be implemented
- Auth utilities must be present for app to function
- Placeholder auth pages must exist

### Learnings from Previous Story

**From Story 1.3: Authentication Configuration and Middleware (Status: done)**

- **New Files Created**: Authentication infrastructure fully implemented
  - `src/middleware.ts` - Route protection (will be deployed)
  - `src/app/auth/callback/route.ts` - OAuth callback handler
  - `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx` - Auth pages
  - `src/lib/auth/server.ts`, `src/lib/auth/client.ts` - Auth utilities
  - All these files will be included in the deployment

- **Environment Variables Required**: Story 1.3 uses Supabase environment variables
  - Deployment MUST include: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Production only: `SUPABASE_SERVICE_ROLE_KEY` (for server-side operations)

- **Build Verification**: Story 1.3 confirmed production build succeeds
  - `npm run build` completed successfully
  - TypeScript type-check passed
  - ESLint passed
  - This gives confidence that deployment will succeed

- **Deployment Readiness**: Application is production-ready
  - All quality checks passed in Story 1.3
  - No blocker issues from code review
  - Auth configuration is done (Tasks 1, 2, 3, 6 completed manually)

[Source: docs/sprint-artifacts/1-3-authentication-configuration-and-middleware.md]

### Project Structure Notes

**No new source code files created in this story** - this is purely infrastructure/configuration:
- GitHub repository setup
- Vercel project configuration
- Environment variable configuration
- Deployment verification

**Files to reference:**
- `.env.local.example` - Template for environment variables
- `package.json` - Build scripts and dependencies
- `next.config.mjs` - Next.js configuration
- All `src/` files from Stories 1.1-1.3 will be deployed

### Testing Strategy

**For This Story:**
- Manual verification of deployment pipeline setup
- Manual testing of deployed application functionality
- Verification that environment variables are correctly loaded
- Testing preview deployment workflow

**No automated tests required** for this infrastructure story. Manual verification ensures:
- Deployment succeeds
- Application loads and functions correctly
- Environment variables are properly configured
- HTTPS is enabled
- Preview deployments work

**Testing Checklist:**
- [ ] Production build succeeds locally: `npm run build`
- [ ] Production deployment succeeds on Vercel
- [ ] Application accessible via Vercel URL
- [ ] HTTPS enabled (check browser padlock)
- [ ] Environment variables loaded (app connects to Supabase)
- [ ] Middleware redirects work (/dashboard → /login when not authenticated)
- [ ] Auth pages load correctly (/login, /signup)
- [ ] Preview deployment works for feature branches
- [ ] Build time < 2 minutes

### Deployment Workflow

**Standard Deployment Process (after this story):**

1. **Make changes** in local development environment
2. **Test locally**: `npm run dev` and verify changes
3. **Run quality checks**: `npm run type-check && npm run lint && npm run build`
4. **Commit changes**: `git add . && git commit -m "feat: description"`
5. **Push to main**: `git push origin main`
6. **Automatic deployment**: Vercel detects push and deploys
7. **Verify deployment**: Check Vercel dashboard for deployment status
8. **Test production**: Visit production URL and verify changes

**Preview Deployment Process:**

1. **Create branch**: `git checkout -b feature/name`
2. **Make changes** and commit
3. **Push branch**: `git push -u origin feature/name`
4. **Automatic preview**: Vercel creates preview deployment
5. **Get preview URL**: Check Vercel dashboard or GitHub PR
6. **Test preview**: Verify changes in preview environment
7. **Merge to main**: Create PR → Merge → Automatic production deployment

### References

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel + Next.js Guide](https://vercel.com/docs/frameworks/nextjs)
- [Environment Variables on Vercel](https://vercel.com/docs/concepts/projects/environment-variables)
- [GitHub Integration](https://vercel.com/docs/concepts/git/vercel-for-github)
- [Epic 1 Technical Specification](tech-spec-epic-1.md) - AC-4.1 through AC-4.7

---

## Dev Agent Record

### Context Reference

- [Story Context XML](1-4-deployment-pipeline-and-environment-setup.context.xml)

### Agent Model Used

<!-- To be filled by dev agent -->

### Debug Log References

<!-- To be filled by dev agent during implementation -->

### Completion Notes List

<!-- To be filled by dev agent after story completion -->

### File List

<!-- To be filled by dev agent with created/modified files -->

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-11-16 | AI Dev Agent | Initial story draft created via create-story workflow |
