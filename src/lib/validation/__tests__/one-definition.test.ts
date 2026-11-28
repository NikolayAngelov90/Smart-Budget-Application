/**
 * @jest-environment node
 *
 * spec-cyrillic-names: ONE definition of a valid name. Two copies of a rule are
 * how one of them drifts (removeMember had exactly that), and an ASCII-only
 * class is how "Храна" came to be refused.
 *
 * 1. Every file that writes a person-chosen name calls the shared module.
 * 2. DISCOVERY: every product file that writes to a name column's table, sends
 *    a POST/PUT/PATCH to one of their APIs, or IS one of those API routes, is
 *    classified - a name writer (1.), or an entry saying why it needs no check.
 *    A new write site fails this test until someone decides which it is.
 * 3. No name schema exists outside the shared module.
 * 4. No ASCII-only letter class ([a-z], [A-Z], \w) appears in product code,
 *    except where it is not a name rule, each with its reason.
 * Each scanner is checked on a synthetic fixture, so a scanner that silently
 * matches nothing cannot pass.
 */

import fs from 'node:fs';
import path from 'node:path';
import { checkName } from '@/lib/validation/names';
import { DEFAULT_CATEGORIES } from '@/lib/utils/constants';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Every form, route and service that checks a person-chosen name, and the shared call it must make. */
const NAME_WRITERS: Array<[file: string, mustCall: RegExp]> = [
  ['src/app/api/categories/route.ts', /nameSchema\('category'\)/],
  ['src/app/api/categories/[id]/route.ts', /nameSchema\('category'\)/],
  ['src/app/api/goals/route.ts', /checkName\(body\.name, 'goal'\)/],
  ['src/app/api/goals/[id]/route.ts', /checkName\(body\.name, 'goal'\)/],
  ['src/app/api/households/route.ts', /nameSchema\('household'\)/],
  ['src/app/api/households/goals/route.ts', /nameSchema\('sharedGoal'\)/],
  ['src/app/api/wishlist/route.ts', /nameSchema\('wishlistItem'\)/],
  ['src/app/api/values/route.ts', /nameSchema\('value'\)/],
  ['src/app/api/values/[id]/route.ts', /nameSchema\('value'\)/],
  ['src/app/api/user/profile/route.ts', /checkName\(raw, 'displayName'\)/],
  ['src/components/categories/CategoryModal.tsx', /nameSchema\('category'\)/],
  ['src/components/goals/GoalForm.tsx', /nameSchema\('goal'\)/],
  ['src/components/common/OnboardingModal.tsx', /optionalNameSchema\('displayName'\)/],
  ['src/components/household/HouseholdCreateCard.tsx', /checkName\(name, 'household'\)/],
  ['src/components/household/SharedGoalsCard.tsx', /checkName\(name, 'sharedGoal'\)/],
  ['src/components/goals/WishlistSection.tsx', /checkName\(name, 'wishlistItem'\)/],
  [
    'src/components/values/ValuesPlanSection.tsx',
    /checkName\(newName, 'value'\)[\s\S]*checkName\(rawName, 'value'\)/,
  ],
  ['src/lib/hooks/useSettingsProfile.ts', /checkName\(displayName, 'displayName'\)/],
  // The OAuth provider's name (Google), pre-filled at first sign-in.
  ['src/app/auth/callback/route.ts', /checkName\(oauthDisplayName, 'displayName'\)/],
  // The services that check again, below their routes.
  ['src/lib/services/householdService.ts', /checkName\(name, 'household'\)/],
  ['src/lib/services/valuesService.ts', /checkName\(name, 'value'\)/],
  ['src/lib/services/householdGoalService.ts', /checkName\(input\.name, 'sharedGoal'\)/],
];

/**
 * Discovered write sites that need no check of their own, and why. An entry
 * here must still be discovered (a stale entry fails), so the list cannot rot.
 */
const NO_NAME_CHECK: Record<string, string> = {
  'src/app/api/wishlist/[id]/route.ts': 'PATCH changes the status only',
  'src/app/categories/page.tsx':
    'sends share and delete requests; renames go through CategoryModal',
  'src/app/join/page.tsx': 'accepts an invitation (a token only)',
  'src/app/page.tsx':
    'sends the display name OnboardingModal already normalised with the shared rule; the API checks it again',
  'src/app/transactions/page.tsx': 'creates transactions, no name',
  'src/components/goals/GoalCard.tsx': 'celebrates and deletes a goal, no name',
  'src/components/household/PendingInviteBanner.tsx': 'accepts an invitation (a token only)',
  'src/components/household/TransparencyPresetCard.tsx': 'changes the transparency preset, no name',
  'src/components/settings/ProfilePictureUpload.tsx': 'sets or clears the picture URL, no name',
  'src/lib/hooks/useReengagement.ts': 'writes a preference timestamp, no name',
  'src/lib/services/categoryShareService.ts':
    'moves a category in or out of the household, no name',
  'src/lib/services/goalService.ts': 'stores the name /api/goals and /api/goals/[id] checked',
  'src/lib/services/insightService.ts': 'writes the insights timestamp, no name',
  'src/lib/services/savingsTransactionService.ts':
    'creates the fixed "Savings" category (its name is checked below)',
  'src/lib/services/seedCategoriesService.ts':
    'inserts the fixed default names (each is checked below)',
  'src/lib/services/settingsService.ts':
    'stores the display name /api/user/profile checked; its other writes are not names',
  'src/lib/services/wishlistService.ts': 'stores the name /api/wishlist checked',
};

/** Product source files (tests excluded). */
function productFiles(dir = 'src'): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'test-utils' || entry.name === '__mocks__')
        continue;
      out.push(...productFiles(rel));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

const TABLES = 'categories|goals|households|wishlist_items|user_values|user_profiles';
const ENDPOINTS = 'categories|goals|households|households/goals|wishlist|values|user/profile';
/** A direct write to a table holding a name column. */
const DB_WRITE = new RegExp(
  String.raw`\.from\(\s*['"](${TABLES})['"]\s*\)\s*\.(insert|update|upsert)\(`
);
/** A literal path of one of their APIs ("/api/values" or "/api/values/${id}")... */
const API_PATH = new RegExp(String.raw`[${'`'}'"]/api/(${ENDPOINTS})(/\$\{[^}]+\})?[${'`'}'"]`);
/** ...in a file that also names a writing method. */
const WRITE_METHOD = /['"](POST|PUT|PATCH)['"]/;
/** One of those API routes, with a writing handler. */
const API_ROUTE = new RegExp(String.raw`^src/app/api/(${ENDPOINTS})(/\[id\])?/route\.ts$`);
const WRITE_HANDLER = /export\s+(async\s+)?function\s+(POST|PUT|PATCH)\b/;

function writesToANameTable(file: string, src: string): boolean {
  return (
    DB_WRITE.test(src) ||
    (API_PATH.test(src) && WRITE_METHOD.test(src)) ||
    (API_ROUTE.test(file) && WRITE_HANDLER.test(src))
  );
}

/** A regex literal: /body/flags (roughly; a division is not followed by a class or an escape). */
const REGEX_LITERAL = /(?<![\w)\]])\/((?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n[])+)\/([dgimsuvy]*)/g;
/** Inside a regex body: a class with an ASCII letter range, or \w (ASCII even with the u flag). */
const ASCII_LETTERS = /\[[^\]\n]*(a-z|A-Z)[^\]\n]*\]|\\w/;

function asciiLetterRegexes(src: string): string[] {
  return [...src.matchAll(REGEX_LITERAL)]
    .filter(([, body]) => ASCII_LETTERS.test(body ?? ''))
    .map(([whole]) => whole);
}

/** Where an ASCII letter class is legitimately NOT a name rule. Each entry says why. */
const ASCII_CLASS_ALLOWED: Record<string, string> = {
  'src/app/(auth)/signup/page.tsx':
    'password strength rules - board item (Cyrillic letters must count), own auth PR',
  'src/app/(auth)/reset-password/page.tsx':
    'password strength rules - board item (Cyrillic letters must count), own auth PR',
  'src/app/api/allowance/route.ts': 'ISO 4217 currency codes are ASCII capitals by standard',
  'src/app/api/transactions/route.ts': 'ISO 4217 currency codes are ASCII capitals by standard',
  'src/lib/services/exchangeRateService.ts':
    'ISO 4217 currency codes are ASCII capitals by standard',
  'src/lib/hooks/useSettingsProfile.ts': 'reads the NEXT_LOCALE cookie; locale codes are ASCII',
};

const FILES = productFiles();

describe('one definition of a valid name', () => {
  test('CONTROL: the scan reads the product tree', () => {
    expect(FILES.length).toBeGreaterThan(300);
    expect(FILES).toContain('src/lib/validation/names.ts');
  });

  test.each(NAME_WRITERS)('%s writes names through the shared rule', (file, mustCall) => {
    const src = read(file);
    expect({ file, imports: /from '@\/lib\/validation\/names'/.test(src) }).toEqual({
      file,
      imports: true,
    });
    expect({ file, calls: mustCall.test(src) }).toEqual({ file, calls: true });
  });

  test('DISCOVERY: every file that writes to a name table or its API is classified', () => {
    const discovered = FILES.filter((f) => writesToANameTable(f, read(f)));
    const writers = new Set(NAME_WRITERS.map(([f]) => f));
    // PRESENCE CONTROL: each kind of signal finds what it must.
    expect(discovered).toEqual(
      expect.arrayContaining([
        'src/lib/services/goalService.ts', // a direct table write
        'src/components/categories/CategoryModal.tsx', // an API path + a writing method
        'src/app/api/values/[id]/route.ts', // a writing route
      ])
    );
    // A new write site: decide whether it writes a name, and list it.
    expect(discovered.filter((f) => !writers.has(f) && !(f in NO_NAME_CHECK))).toEqual([]);
    // A stale entry: the file no longer writes there (or is gone) - remove it.
    expect(Object.keys(NO_NAME_CHECK).filter((f) => !discovered.includes(f))).toEqual([]);
    expect(Object.keys(NO_NAME_CHECK).filter((f) => writers.has(f))).toEqual([]);
  });

  test('DISCOVERY scanner, on a synthetic fixture: finds every kind of write, and not a read', () => {
    const found = (file: string, src: string) => writesToANameTable(file, src);
    expect(found('src/x.ts', "await db.from('goals').insert({ name })")).toBe(true);
    expect(found('src/x.ts', "db.from('user_profiles')\n  .update({ display_name: n })")).toBe(
      true
    );
    expect(found('src/x.tsx', "fetch('/api/values', { method: 'POST', body })")).toBe(true);
    expect(found('src/x.tsx', "fetch(`/api/values/${id}`, { method: 'PATCH' })")).toBe(true);
    expect(found('src/app/api/wishlist/route.ts', 'export async function POST() {}')).toBe(true);
    expect(found('src/x.ts', "await db.from('goals').select('name')")).toBe(false);
    expect(found('src/x.tsx', "fetch('/api/values')")).toBe(false);
    expect(found('src/app/api/wishlist/route.ts', 'export async function GET() {}')).toBe(false);
  });

  test('the fixed names the app writes itself pass the rule, unchanged', () => {
    for (const name of [...DEFAULT_CATEGORIES.map((c) => c.name), 'Savings']) {
      expect({ name, result: checkName(name, 'category') }).toEqual({
        name,
        result: { ok: true, name },
      });
    }
    expect(read('src/lib/services/savingsTransactionService.ts')).toMatch(
      /SAVINGS_CATEGORY_NAME = 'Savings'/
    );
  });

  test('no name schema exists outside the shared module', () => {
    const offenders = FILES.filter((f) => f !== 'src/lib/validation/names.ts').filter((f) =>
      /\b(name|displayName|display_name)\s*:\s*z\s*\.\s*string\(/.test(read(f))
    );
    expect(offenders).toEqual([]);
  });

  test('no ASCII-only letter class exists in product code, except where it is not a name rule', () => {
    const found = FILES.filter((f) => asciiLetterRegexes(read(f)).length > 0);
    expect(found.filter((f) => !(f in ASCII_CLASS_ALLOWED))).toEqual([]);
    // Each allowance is still needed (and so the scan really finds things).
    expect(Object.keys(ASCII_CLASS_ALLOWED).filter((f) => !found.includes(f))).toEqual([]);
  });

  test('ASCII scanner, on a synthetic fixture: every ASCII letter shape, and not the Unicode rule', () => {
    const hits = (src: string) => asciiLetterRegexes(src).length;
    expect(hits('const r = /^[a-zA-Z ]+$/;')).toBe(1);
    expect(hits('const r = /^[A-Z]/;')).toBe(1);
    expect(hits('const r = /^[a-z0-9 ]+$/i;')).toBe(1);
    expect(hits('const r = /^\\w+$/u;')).toBe(1); // \w is ASCII even with the u flag
    expect(hits('z.string().regex(/[^A-Za-z0-9]/, "x")')).toBe(1);
    expect(hits('const r = /^[\\p{L}\\p{M}\\p{N} ]+$/u;')).toBe(0);
    expect(hits('const half = total / 2; const r = a / b;')).toBe(0);
  });

  test('the shared rule itself is Unicode-aware', () => {
    const src = read('src/lib/validation/names.ts');
    expect(src).toMatch(/\\p\{L\}\\p\{M\}\\p\{N\}/);
    expect(asciiLetterRegexes(src)).toEqual([]);
  });
});
