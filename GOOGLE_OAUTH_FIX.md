# Google OAuth "Safety Browser Policy" Error - Fix Guide

## Problem
When users try to sign up with Google, they encounter an error: **"App does not support safety browser policy on Google"**

## Root Cause
This error occurs when the OAuth redirect URIs in Google Cloud Console don't match what Supabase expects, or when the OAuth consent screen is not properly configured.

## Solution Steps

### Step 1: Access Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one if you don't have it)

### Step 2: Enable Google+ API (if not already enabled)
1. Navigate to **APIs & Services** > **Library**
2. Search for "Google+ API"
3. Click **Enable**

### Step 3: Configure OAuth Consent Screen
1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** user type (for testing with any Google account)
3. Fill in required information:
   - **App name**: Smart Budget Application
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. **Scopes**: Add the following scopes:
   - `openid`
   - `profile`
   - `email`
5. **Test users** (if in testing mode): Add your test email addresses
6. Click **Save and Continue**

### Step 4: Get Your Supabase Callback URL
1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Authentication** > **URL Configuration**
4. Copy the **Callback URL (for OAuth)** - it should look like:
   ```
   https://rlcgqvqpuqkkxtczalpi.supabase.co/auth/v1/callback
   ```

### Step 5: Configure OAuth Client ID
1. In Google Cloud Console, go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Choose **Web application** as application type
4. Set name: "Smart Budget Application - Web Client"
5. **Authorized JavaScript origins**:
   ```
   https://rlcgqvqpuqkkxtczalpi.supabase.co
   http://localhost:3000 (for local development)
   https://your-production-domain.com (for production)
   ```
6. **Authorized redirect URIs** - Add BOTH of these:
   ```
   https://rlcgqvqpuqkkxtczalpi.supabase.co/auth/v1/callback
   http://localhost:3000/auth/callback (for local development)
   https://your-production-domain.com/auth/callback (for production)
   ```
7. Click **Create**
8. Copy the **Client ID** and **Client Secret**

### Step 6: Configure Supabase
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Authentication** > **Providers**
4. Find **Google** in the list and click to expand
5. Toggle **Enable Google provider** to ON
6. Paste the **Client ID** from Step 5
7. Paste the **Client Secret** from Step 5
8. Click **Save**

### Step 7: Verify Site URL Configuration in Supabase
1. In Supabase Dashboard, go to **Authentication** > **URL Configuration**
2. Verify the following URLs:
   - **Site URL**: `http://localhost:3000` (development) or `https://your-production-domain.com` (production)
   - **Redirect URLs**: Add these allowed redirect URLs:
     ```
     http://localhost:3000/**
     https://your-production-domain.com/**
     ```

### Step 8: Test the Configuration
1. Clear your browser cache and cookies
2. Go to your signup page
3. Click "Continue with Google"
4. You should now be redirected to Google's OAuth consent screen without errors
5. After authorizing, you should be redirected back to your app

## Common Issues and Fixes

### Issue: "redirect_uri_mismatch" error
**Fix**: Make sure the redirect URI in Google Cloud Console exactly matches the Supabase callback URL (including `/auth/v1/callback`)

### Issue: "Access blocked: This app's request is invalid"
**Fix**:
- Ensure OAuth consent screen is configured
- Add your email to test users if app is in testing mode
- Verify all required scopes are added

### Issue: Still getting safety browser policy error
**Fix**:
- Verify the OAuth client type is "Web application" not "iOS" or "Android"
- Clear browser cache and try in incognito mode
- Wait 5-10 minutes for Google's changes to propagate

### Issue: Works locally but not in production
**Fix**: Add your production domain to:
- Authorized JavaScript origins in Google Cloud Console
- Authorized redirect URIs in Google Cloud Console
- Redirect URLs in Supabase settings

## Notes
- Changes to Google Cloud Console may take 5-10 minutes to propagate
- Always test in incognito mode after making changes
- For production, set OAuth consent screen to "In production" status
- Keep your Client Secret secure and never commit it to version control

## Verification Checklist
- [ ] Google+ API enabled
- [ ] OAuth consent screen configured
- [ ] Test users added (if in testing mode)
- [ ] OAuth Client ID created (Web application type)
- [ ] Authorized JavaScript origins added
- [ ] Authorized redirect URIs added (Supabase callback URL)
- [ ] Client ID and Secret added to Supabase
- [ ] Site URL configured in Supabase
- [ ] Tested in incognito mode
- [ ] Default categories seed after Google signup ✅
