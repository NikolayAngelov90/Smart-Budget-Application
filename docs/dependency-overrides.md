# Dependency overrides — why each one exists

`package.json` cannot carry comments, so every entry in its `overrides` block is
explained here. An override forces a version a parent package did not ask for,
which makes it a maintenance liability: each entry names the parent, the range
it declares, the advisory the override clears, and when it can be deleted.

Rule (2026-11-20): fix vulnerabilities with the SMALLEST UPGRADE that clears
them, never a downgrade. Use an override only when the fix lives in a transitive
dependency whose parent's declared range excludes it.

| Override | Forced to | Parent and the range it declares | Clears | Delete when |
|---|---|---|---|---|
| `serialize-javascript` | `7.1.3` | `next-pwa@5.6.0 > workbox-webpack-plugin@6 > workbox-build@6 > rollup-plugin-terser@7.0.2`, which declares `^4.0.0` | GHSA-m5mm-p8h7-m29v (XSS via unescaped output; fixed in 7.1.3). The override already existed at 7.0.5 (from `2f84f08`), which predates the fix; it was raised to 7.1.3 on 2026-11-20. | `next-pwa` is replaced or updated so that its build chain no longer depends on `rollup-plugin-terser@7` (see the board). |
| `tmp` | `0.2.6` | `@lhci/cli` (`^0.1.0` at 0.15.1) and `external-editor@3` (`^0.0.33`, via `inquirer`) | GHSA-ph9p-34f9-6g65 (path traversal via an unsanitised prefix/postfix; fixed in 0.2.6). It already existed at 0.2.5 (from `2f84f08`) and was raised on 2026-11-20. | No remaining parent declares a vulnerable range. Check with `npm ls tmp --all` after any `@lhci/cli` change. |

Both crossings (`^4` -> 7 for serialize-javascript, `^0.0.33`/`^0.1` -> 0.2 for tmp)
were made before this document existed. They are build- and dev-time code paths
(minifying the PWA service worker, the Lighthouse CI CLI), and the full test
suite plus `next build` pass with them.

Audit record: `docs/dependency-audit-2026-11-20.md`.
