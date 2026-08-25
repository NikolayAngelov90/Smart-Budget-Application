/**
 * Authenticated route smoke test.
 *
 * WHY THIS EXISTS: `lint -> type-check -> jest -> build` all passed while
 * /dashboard returned HTTP 500 on every authenticated render (hp-13). A build
 * compiles; it does not render. jsdom has no server. Only opening the page finds
 * this class of defect.
 *
 * WHY IT AUTHENTICATES: unauthenticated /dashboard returns 307 to /login. A
 * smoke test asserting "200 or 3xx" would have stayed green for the entire life
 * of that bug — a check that cannot see the failure it exists to catch is worse
 * than no check, because it is believed.
 *
 * IT IS READ-ONLY. Navigate and assert; never create, edit or delete. The QA
 * account has a second driver — a local Playwright session — so two writers
 * would race, and corrupting state someone is mid-way through testing is worse
 * than having no smoke test. Verified rather than assumed that navigation is
 * side-effect free: insight generation is the one destructive path (it deletes
 * and reinserts a user's insights) and it is reachable only from
 * `/api/insights/generate` and from `checkAndTriggerForTransactionCount`, which
 * is called at transactions/route.ts:403 inside POST. GET never triggers it.
 *
 * IT ASSUMES CONCURRENCY. A local session may be signed in at the same time.
 * The app supports multiple sessions, so signing in here does not disturb them —
 * and this script deliberately does NOT sign out, revoke sessions, or clear
 * server-side state on teardown. Closing the browser is the whole teardown.
 *
 * NEVER PRINTS CREDENTIALS. Not on success, not on failure, not in a stack
 * trace. A smoke test that dumps its own credentials on a red build is a leak
 * waiting to happen.
 */
import { chromium, type Browser, type Page } from '@playwright/test';

const BASE_URL = (process.env.SMOKE_BASE_URL || '').replace(/\/$/, '');
const EMAIL = process.env.QA_EMAIL;
const PASSWORD = process.env.QA_PASSWORD;

/**
 * Routes to check. `why` is printed on failure so a red build explains itself.
 */
const ROUTES: Array<{ path: string; why?: string }> = [
  {
    path: '/dashboard',
    why: 'hp-13: SSR-500d for authenticated users while unauthenticated it 307d, '
      + 'so an unauthenticated check stayed green through the whole bug',
  },
  { path: '/insights' },
  { path: '/transactions' },
  { path: '/categories' },
  { path: '/goals' },
  { path: '/household' },
  { path: '/settings' },
];

/**
 * Next renders its own error page when a route throws; there is no custom
 * error.tsx in this app. These are the markers that page leaves behind.
 *
 * EVERY MARKER HERE WAS VERIFIED ABSENT FROM A HEALTHY 200 PAGE. That is not
 * paranoia: the first version of this list included "This page could not be
 * found", which Next ships inside the bundle of EVERY page — so all seven
 * routes failed on a perfectly healthy build. A permanently red smoke check
 * gets disabled, and then there is no smoke check. A 404 is caught by the
 * status assertion below anyway, which is the right place for it.
 *
 * If you add a marker, curl a known-good page first and confirm it is absent.
 */
const ERROR_MARKERS = [
  '__next_error__',
  'Application error: a client-side exception has occurred',
  'Internal Server Error',
];

/**
 * 429 is NOT a failure. Only `/api/insights/generate` is rate limited in this
 * app (one manual refresh per five minutes, `rateLimitService` on Upstash) and
 * this script never calls it — but the QA account has a concurrent local
 * driver, and Supabase's own auth endpoints rate limit per project. A 429 means
 * "too many requests right now", which is not the same as "the app is broken",
 * and failing the build on it would produce exactly the false red that gets a
 * smoke check disabled.
 */
const ACCEPTABLE_STATUSES = new Set([200, 429]);

function required(name: string, value: string | undefined): string {
  if (!value) {
    // Report the NAME only. Never the value, and never a partial value.
    console.error(`[smoke] missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'load' });

  // Target ids, not labels. `getByLabel(/password/i)` matches BOTH the input
  // (aria-label="Password") and the visibility toggle (aria-label="Show
  // password"), which is a strict-mode violation. Ids are also stable across
  // the en/bg locales, where visible label text is not.
  const emailField = page.locator('#email');
  const passwordField = page.locator('#password');
  const submit = page.locator('form button[type="submit"]').first();

  // HYDRATION RACE. The submit button is `isDisabled={!email || !password}`,
  // bound to React state. Playwright's `fill()` sets the DOM value and
  // dispatches input events — but if React has not attached its listeners yet,
  // nothing hears them, state never updates, and the button stays disabled
  // FOREVER. `click()` then waits out its full timeout on an element that will
  // never become actionable.
  //
  // This passed locally and hung against production, which is exactly how a
  // timing bug presents: fast hydration hid it. Fill, then wait for the button
  // to actually enable; if it has not, hydration lost the first round, so fill
  // again — by then React is certainly listening.
  await emailField.fill(email);
  await passwordField.fill(password);

  try {
    await submit.waitFor({ state: 'attached', timeout: 10_000 });
    await page.waitForFunction(
      () => {
        const b = document.querySelector('form button[type="submit"]');
        return b instanceof HTMLButtonElement && !b.disabled;
      },
      undefined,
      { timeout: 10_000 }
    );
  } catch {
    await emailField.fill('');
    await emailField.fill(email);
    await passwordField.fill('');
    await passwordField.fill(password);
    await page.waitForFunction(
      () => {
        const b = document.querySelector('form button[type="submit"]');
        return b instanceof HTMLButtonElement && !b.disabled;
      },
      undefined,
      { timeout: 20_000 }
    );
  }

  await submit.click();

  // Landing anywhere other than /login is success; the app may route to
  // /dashboard or to onboarding depending on account state, and asserting a
  // specific destination would couple this to data we do not control.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
}

async function checkRoute(page: Page, path: string): Promise<string[]> {
  const failures: string[] = [];
  const response = await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });

  const status = response?.status() ?? 0;
  if (!ACCEPTABLE_STATUSES.has(status)) {
    failures.push(`HTTP ${status}`);
  }

  // If the session silently failed, every route redirects to /login and returns
  // 200 for the login page — a green run that tested nothing. Assert we are
  // still where we asked to be.
  const landed = new URL(page.url()).pathname;
  if (landed.startsWith('/login')) {
    failures.push(`redirected to /login (session not established)`);
  }

  const html = await page.content();
  for (const marker of ERROR_MARKERS) {
    if (html.includes(marker)) failures.push(`error page marker: "${marker}"`);
  }

  return failures;
}

async function main(): Promise<void> {
  required('SMOKE_BASE_URL', BASE_URL);
  const email = required('QA_EMAIL', EMAIL);
  const password = required('QA_PASSWORD', PASSWORD);

  console.log(`[smoke] target: ${BASE_URL}`);
  console.log(`[smoke] ${ROUTES.length} routes, authenticated, read-only\n`);

  let browser: Browser | undefined;
  const failed: string[] = [];

  try {
    browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    await signIn(page, email, password);
    console.log('[smoke] signed in\n');

    for (const { path, why } of ROUTES) {
      const failures = await checkRoute(page, path);
      if (failures.length === 0) {
        console.log(`  PASS  ${path}`);
      } else {
        console.log(`  FAIL  ${path} — ${failures.join('; ')}`);
        if (why) console.log(`        ${why}`);
        failed.push(path);
      }
    }
  } catch (error) {
    // Print the message only. A Playwright error can carry the page content or
    // the arguments of a failed `fill()` — which is the password.
    console.error(`\n[smoke] aborted: ${(error as Error).message.split('\n')[0]}`);
    process.exit(1);
  } finally {
    // Teardown is closing the browser. Deliberately no sign-out and no session
    // revocation: the QA account may have a concurrent local session, and
    // signing out globally would kick it off mid-run.
    await browser?.close();
  }

  console.log('');
  if (failed.length > 0) {
    console.error(`[smoke] FAILED on ${failed.length} route(s): ${failed.join(', ')}`);
    process.exit(1);
  }
  console.log(`[smoke] all ${ROUTES.length} routes OK`);
}

void main();
