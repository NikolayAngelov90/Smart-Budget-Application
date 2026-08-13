/**
 * @jest-environment node
 */

/**
 * Chakra's viewport hooks must never carry `{ ssr: false }`.
 *
 * That option makes the hook read `window` DURING RENDER. On the server there is
 * no `window`, so the request 500s and is rescued only by the client
 * re-rendering — which hides it from everything except an actual browser:
 *
 *     ReferenceError: window is not defined
 *       at SpendingTrendsChart (src/components/dashboard/SpendingTrendsChart.tsx:99)
 *
 * This has now happened twice. hp-9 introduced it with `useMediaQuery` and it
 * was caught before merge; hp-13 found `useBreakpointValue` already on main,
 * 500ing every authenticated /dashboard render. Neither was caught by the test
 * suite or the build, because a build compiles and jsdom has no server.
 *
 * NARROWLY SCOPED ON PURPOSE. `ssr: false` is correct and in use elsewhere:
 *   - `next/dynamic(..., { ssr: false })` in GoalCard — a different API entirely
 *   - Chakra's `colorModeManager.ssr` in useAppearance — a manager property
 * A blanket ban on the string would flag both and get itself deleted. This keys
 * on the option INSIDE a call to one of the viewport hooks, found by matching
 * balanced parentheses rather than a line regex, because the call spans lines.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.join(process.cwd(), 'src');

/** Hooks whose `ssr: false` option reads `window` during render. */
const VIEWPORT_HOOKS = ['useBreakpointValue', 'useMediaQuery'];

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      sourceFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Strip comments so prose describing the hazard cannot trip the guard. */
function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');
}

/** Extract the argument text of every `name(...)` call, parens balanced. */
function callArgs(source: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`\\b${name}\\s*\\(`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < source.length && depth > 0) {
      const c = source[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    out.push(source.slice(start, i - 1));
  }
  return out;
}

describe('SSR safety', () => {
  it('no viewport hook is called with { ssr: false }', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const source = stripComments(fs.readFileSync(file, 'utf8'));
      for (const hook of VIEWPORT_HOOKS) {
        for (const args of callArgs(source, hook)) {
          if (/\bssr\s*:\s*false\b/.test(args)) {
            offenders.push(`${path.relative(process.cwd(), file)} -> ${hook}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('the extractor actually finds these calls (guard against a silent no-op)', () => {
    // If `callArgs` ever stopped matching — a rename, a regex slip — the test
    // above would pass by finding nothing at all. Prove it still sees the real
    // call sites before trusting its silence.
    const found = sourceFiles(SRC).flatMap((file) => {
      const source = stripComments(fs.readFileSync(file, 'utf8'));
      return VIEWPORT_HOOKS.flatMap((hook) => callArgs(source, hook));
    });

    expect(found.length).toBeGreaterThan(0);
    // And it must capture the OPTIONS argument, not stop at the first comma.
    expect(found.some((a) => a.includes('base:'))).toBe(true);
  });
});
