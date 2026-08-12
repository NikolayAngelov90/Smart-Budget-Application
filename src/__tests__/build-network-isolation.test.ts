/**
 * @jest-environment node
 */

/**
 * `next build` must not touch the network.
 *
 * `next/font/google` downloads woff2 files from fonts.gstatic.com AT BUILD TIME.
 * That made deploys depend on Google Fonts being reachable from a CI runner, and
 * on 2026-08-12 it failed one:
 *
 *     src/app/layout.tsx
 *     `next/font` error:
 *     Failed to fetch `Onest` from Google Fonts.
 *     > Build failed because of webpack errors
 *
 * The failure is intermittent, so it cannot be caught by "the build passed once".
 * These are source-level guards: jsdom has no font engine, and no rendering test
 * can tell a self-hosted face from a downloaded one.
 *
 * The assertions below deliberately key on the IMPORT SPECIFIER `next/font/google`.
 * An earlier habit in this repo was asserting on a loose substring that something
 * else in the file already satisfied — matching /font/ here would pass happily
 * with `next/font/google` restored, since `next/font/local` contains it too.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.join(process.cwd(), 'src');
const FONT_DIR = path.join(SRC, 'fonts');
const LAYOUT = path.join(SRC, 'app', 'layout.tsx');

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      sourceFiles(full, acc);
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('build-time network isolation', () => {
  it('no source file imports from next/font/google', () => {
    // Matches the specifier in any import form: `from '…'`, `require('…')`,
    // `import('…')`. Comments are stripped first — the hazard is documented in
    // prose in layout.tsx and in this file, and a guard that trips on its own
    // documentation would just get deleted.
    const specifier = /(?:from|require\s*\(|import\s*\()\s*['"]next\/font\/google['"]/;
    const stripComments = (s: string) =>
      s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');

    const offenders = sourceFiles(SRC)
      .filter((f) => specifier.test(stripComments(fs.readFileSync(f, 'utf8'))))
      .map((f) => path.relative(process.cwd(), f));

    expect(offenders).toEqual([]);
  });

  it('layout.tsx loads both faces through next/font/local', () => {
    const src = fs.readFileSync(LAYOUT, 'utf8');
    expect(src).toMatch(/import\s+localFont\s+from\s+['"]next\/font\/local['"]/);
    expect(src).toMatch(/src:\s*['"]\.\.\/fonts\/SpaceGrotesk-Variable\.woff2['"]/);
    expect(src).toMatch(/src:\s*['"]\.\.\/fonts\/Onest-Variable\.woff2['"]/);
  });

  it('the referenced font files exist and are real woff2', () => {
    for (const file of ['SpaceGrotesk-Variable.woff2', 'Onest-Variable.woff2']) {
      const full = path.join(FONT_DIR, file);
      expect(fs.existsSync(full)).toBe(true);
      // wOF2 magic number — catches an LFS pointer, a stub, or a truncated file,
      // any of which would build fine and render nothing.
      expect(fs.readFileSync(full).subarray(0, 4).toString('ascii')).toBe('wOF2');
    }
  });

  it('ships the OFL licence text for every redistributed family', () => {
    // Committing the binaries is redistribution; the SIL Open Font License
    // requires the licence to travel with them.
    for (const licence of ['SpaceGrotesk-OFL.txt', 'Onest-OFL.txt']) {
      const full = path.join(FONT_DIR, licence);
      expect(fs.existsSync(full)).toBe(true);
      expect(fs.readFileSync(full, 'utf8')).toContain('SIL OPEN FONT LICENSE');
    }
  });

  it('declares the variable weight axis rather than a single weight', () => {
    const src = fs.readFileSync(LAYOUT, 'utf8');
    // A bare weight: '400' would silently lose every other weight in the app.
    expect(src).toMatch(/weight:\s*['"]300 700['"]/);
    expect(src).toMatch(/weight:\s*['"]100 900['"]/);
  });
});
