# Dependency audit — 2026-11-20

Branch `chore/dependency-audit`. Replaces the earlier `npm audit fix --force`, which
downgraded jest 30 -> 29 and next-pwa 5 -> 2 and was discarded.

- **Before** (`main` at `8a2cd97`): 60 vulnerabilities (7 low, 21 moderate, 29 high, 3 critical)
- **After**: 20 vulnerabilities (0 low, 19 moderate, 1 high, 0 critical)

**Rule:** for each advisory, the smallest upgrade that clears it, never a downgrade.
A transitive fix whose parent excludes it goes through an `overrides` entry,
documented in `docs/dependency-overrides.md`. Each major is its own commit, with
the full suite and a build.

**Classification:**
- **RUNTIME** ships to users or runs on the server.
- **DEV-ONLY** is build, test or lint tooling, even where npm reaches it through
  `dependencies`. The main case is next-pwa, a build-time webpack plugin, so its
  babel/webpack/rollup chain only runs at `next build`.
- `npm audit --omit=dev` counted 23 as runtime; by the definition above, 8 are.

One row per vulnerable package (the unit npm counts). Path = shortest chain from a
direct dependency in the original lockfile.

| Class | Severity | Package | Path | Why this class | Advisories | Outcome |
|---|---|---|---|---|---|---|
| RUNTIME | critical | `next` | still-vulnerable copies: next | App server + client bundle | GHSA-2464-fhr4-w9xw, GHSA-267c-6grr-h53f, GHSA-26hh-7cqf-hhc6, GHSA-2xp9-vwfh-vxw4, GHSA-36qx-fr4f-26g5, GHSA-3g8h-86w9-wvmq, GHSA-4633-3j49-mh5q, GHSA-492v-c6pp-mqqv, GHSA-4c39-4ccg-62r3, GHSA-4jqv-mc3x-m676, GHSA-68g3-v927-f742, GHSA-7qx7-33qx-rqx2, GHSA-89xv-2m56-2m9x, GHSA-8h8q-6873-q5fj, GHSA-955p-x3mx-jcvp, GHSA-c4j6-fc7j-m34r, GHSA-f3mh-rxg3-f5g2, GHSA-ffhc-5mcf-pf4q, GHSA-gx5p-jg67-6x7h, GHSA-h64f-5h5j-jqjh, GHSA-m99w-x7hq-7vfj, GHSA-mcj8-r9mp-w47p, GHSA-mg66-mrh9-m8jx, GHSA-p293-qw3h-jr36, GHSA-p3m5-59mp-jv5r, GHSA-p9j2-gv94-2wf4, GHSA-pc58-hwjq-p385, GHSA-q8wf-6r8g-63ch, GHSA-vfv6-92ff-j949, GHSA-wfc6-r584-vfw7 | all 30 of its OWN advisories fixed in `5c79257` (15.5.29), the critical RCEs included; still listed (now MODERATE) only through its exact build-time postcss pin - see "Left" |
| RUNTIME | high | `sharp` | sharp | Next's image optimizer when self-hosted (on Vercel, the platform's image service replaces it) | GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c, GHSA-wq5f-xc86-pv6w | fixed `324f13b` sharp major |
| RUNTIME | high | `ws` | @supabase/supabase-js > @supabase/realtime-js > ws | Node WebSocket client inside supabase realtime-js (server side) | GHSA-58qx-3vcg-4xpx, GHSA-96hv-2xvq-fx4p | fixed `5c79257` in-range |
| RUNTIME | high | `zod` | zod | API input validation on the server | GHSA-mrhx-c7xc-m3w5 | fixed: the RUNTIME copy in `5c79257` (zod 4.6.6); a nested zod 3 under chromium-bidi (dev, @lhci chain) cleared by `e8d68f3` |
| RUNTIME | moderate | `dompurify` | jspdf > dompurify | client-side PDF export (jspdf) | GHSA-39q2-94rc-95cp, GHSA-55q2-fjhq-7xh7, GHSA-6688-9rhm-gjv2, GHSA-76mc-f452-cxcm, GHSA-c2j3-45gr-mqc4, GHSA-c6gr-qvv4-5v3f, GHSA-cmwh-pvxp-8882, GHSA-crv5-9vww-q3g8, GHSA-gvmj-g25r-r7wr, GHSA-h7mw-gpvr-xq4m, GHSA-hpcv-96wg-7vj8, GHSA-mrv2-3pqr-j5jr, GHSA-r47g-fvhr-h676, GHSA-rp9w-3fw7-7cwq, GHSA-v9jr-rg53-9pgp, GHSA-vxr8-fq34-vvx9, GHSA-x4vx-rjvf-j5p4 | fixed `5c79257` in-range |
| RUNTIME | moderate | `fflate` | jspdf > fflate | client-side PDF export (jspdf) | GHSA-px8p-9vwx-vf98 | fixed `5c79257` in-range |
| RUNTIME | moderate | `next-intl` | next-intl | i18n on server and client | GHSA-4c35-wcg5-mm9h | fixed `5c79257` in-range |
| RUNTIME | low | `icu-minify` | next-intl > icu-minify | i18n message formatting (via next-intl) | GHSA-r27j-894h-3w3p | fixed `5c79257` in-range |
| DEV-ONLY | critical | `handlebars` | ts-jest > handlebars | devDependency `ts-jest` | GHSA-8r5x-fm3f-whwj, GHSA-p8wg-vrv2-v86f, GHSA-xw65-4hp5-5hc7 | fixed `5c79257` in-range |
| DEV-ONLY | critical | `proxy-addr` | @lhci/cli > express > proxy-addr | devDependency `@lhci/cli` | GHSA-jqcg-44mw-7w3h | fixed `5c79257` in-range |
| DEV-ONLY | high | `@babel/plugin-transform-modules-systemjs` | next-pwa > workbox-webpack-plugin > workbox-build > @babel/preset-env > @babel/plugin-transform-modules-systemjs | build-time webpack plugin (generates the service worker at `next build`) | GHSA-fv7c-fp4j-7gwp | fixed `5c79257` in-range |
| DEV-ONLY | high | `@lhci/cli` | @lhci/cli | devDependency `@lhci/cli` | via @lhci/utils, inquirer, lighthouse, tmp, uuid | fixed `e8d68f3` @lhci/cli major |
| DEV-ONLY | high | `@lhci/utils` | @lhci/cli > @lhci/utils | devDependency `@lhci/cli` | via lighthouse | fixed `e8d68f3` @lhci/cli major |
| DEV-ONLY | high | `@puppeteer/browsers` | @lhci/cli > lighthouse > puppeteer-core > @puppeteer/browsers | devDependency `@lhci/cli` | via extract-zip | fixed `e8d68f3` @lhci/cli major |
| DEV-ONLY | high | `axios` | wait-on > axios | devDependency `wait-on` | GHSA-35jp-ww65-95wh, GHSA-3g43-6gmg-66jw, GHSA-3pq3-5fj3-cg6v, GHSA-3w6x-2g7m-8v23, GHSA-42h9-826w-cgv3, GHSA-445q-vr5w-6q77, GHSA-44g4-m2mj-wpvx, GHSA-4hqw-qxg8-jxx2, GHSA-542g-h47m-68v8, GHSA-5c9x-8gcm-mpgx, GHSA-62hf-57xw-28j9, GHSA-6chq-wfr3-2hj9, GHSA-777c-7fjr-54vf, GHSA-7q8q-rj6j-mhjq, GHSA-898c-q2cr-xwhg, GHSA-9fr6-4gfg-395g, GHSA-f4gw-2p7v-4548, GHSA-hfxv-24rg-xrqf, GHSA-j5f8-grm9-p9fc, GHSA-j8rh-479h-cp32, GHSA-jqh4-m9w3-8hp9, GHSA-m7pr-hjqh-92cm, GHSA-mghh-pgcx-3jjj, GHSA-mmx7-hfxf-jppx, GHSA-mwf2-3pr3-8698, GHSA-p92q-9vqr-4j8v, GHSA-pf86-5x62-jrwf, GHSA-pjwm-pj3p-43mv, GHSA-pmv8-rq9r-6j72, GHSA-pmwg-cvhr-8vh7, GHSA-q8qp-cvcw-x6jj, GHSA-vf2m-468p-8v99, GHSA-vh66-26gq-q6x8, GHSA-w9j2-pvgh-6h63, GHSA-xhjh-pmcv-23jw, GHSA-xx6v-rp6x-q39c | fixed `5c79257` in-range |
| DEV-ONLY | high | `basic-ftp` | @lhci/cli > proxy-agent > pac-proxy-agent > get-uri > basic-ftp | devDependency `@lhci/cli` | GHSA-5pm8-86m8-9m6r, GHSA-c475-qrg2-pj4r, GHSA-r4jh-29pc-gfqr, GHSA-rp42-5vxx-qpwr, GHSA-rpmf-866q-6p89 | fixed `e8d68f3` @lhci/cli major |
| DEV-ONLY | high | `body-parser` | @lhci/cli > express > body-parser | devDependency `@lhci/cli` | GHSA-27r3-jxmh-p828, GHSA-v422-hmwv-36x6 | fixed `5c79257` in-range |
| DEV-ONLY | high | `brace-expansion` | recharts > eslint-plugin-react-perf > eslint > minimatch > brace-expansion | lint tooling recharts declares as a dependency (eslint-plugin-react-perf > eslint); never executed at runtime | GHSA-3jxr-9vmj-r5cp, GHSA-6j4f-fj2g-mc7p, GHSA-mh99-v99m-4gvg, GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7, GHSA-rgw5-rvv9-x895 | fixed `a470bbc` in-range |
| DEV-ONLY | high | `browserslist` | next-pwa > babel-loader > webpack > browserslist | build-time webpack plugin (generates the service worker at `next build`) | GHSA-73wf-gq98-2v4g, GHSA-c83g-rgw3-j3cx | fixed `5c79257` in-range |
| DEV-ONLY | high | `chromium-bidi` | @lhci/cli > lighthouse > puppeteer-core > chromium-bidi | devDependency `@lhci/cli` | via zod | fixed `e8d68f3` @lhci/cli major |
| DEV-ONLY | high | `compression` | @lhci/cli > compression | devDependency `@lhci/cli` | GHSA-vc2v-76pw-4v95 | fixed `5c79257` in-range |
| DEV-ONLY | high | `external-editor` | @lhci/cli > inquirer > external-editor | devDependency `@lhci/cli` | via tmp | fixed `e8d68f3` @lhci/cli major |
| DEV-ONLY | high | `extract-zip` | @lhci/cli > lighthouse > puppeteer-core > @puppeteer/browsers > extract-zip | devDependency `@lhci/cli` | GHSA-7pqw-9j4j-h8q3, GHSA-jmr9-qjv8-65gv | fixed `e8d68f3` @lhci/cli major |
| DEV-ONLY | high | `fast-uri` | recharts > eslint-plugin-react-perf > eslint > ajv > fast-uri | lint tooling recharts declares as a dependency (eslint-plugin-react-perf > eslint); never executed at runtime | GHSA-333x-w4r6-6crp, GHSA-4c8g-83qw-93j6, GHSA-7p8r-x3mc-p8w7, GHSA-f65p-4m7j-42xc, GHSA-hrr3-gc8f-f4qj, GHSA-jqff-g426-hqxp, GHSA-q3j6-qgpj-74h6, GHSA-qw65-cvwx-89v3, GHSA-v2hh-gcrm-f6hx, GHSA-v39h-62p7-jpjc, GHSA-w74x-v6f9-j3xg, GHSA-xhq7-xmqj-769h | fixed `5c79257` in-range |
| DEV-ONLY | high | `follow-redirects` | wait-on > axios > follow-redirects | devDependency `wait-on` | GHSA-8r9p-f939-6h3c, GHSA-mrwp-f3q8-3g9p, GHSA-q3jh-wrc6-jgq8 | fixed `5c79257` in-range |
| DEV-ONLY | high | `form-data` | wait-on > axios > form-data | devDependency `wait-on` | GHSA-hmw2-7cc7-3qxx | fixed `5c79257` in-range |
| DEV-ONLY | high | `inquirer` | @lhci/cli > inquirer | devDependency `@lhci/cli` | via external-editor | fixed `5c79257` in-range |
| DEV-ONLY | high | `ip-address` | @lhci/cli > proxy-agent > socks-proxy-agent > socks > ip-address | devDependency `@lhci/cli` | GHSA-h3mg-xc3c-68pw, GHSA-j6r3-76f7-8jcv, GHSA-mwp4-54f8-5fhr, GHSA-rpw4-54j3-4h4q, GHSA-rxp7-6hxx-x8q5, GHSA-v2v4-37r5-5v8g | fixed `5c79257` in-range |
| DEV-ONLY | high | `joi` | wait-on > joi | devDependency `wait-on` | GHSA-4528-x5fx-h6hg, GHSA-6h2x-m376-mqjq, GHSA-6w3j-5fw6-r9vr, GHSA-gg4h-3hg2-grpc, GHSA-q7cg-457f-vx79, GHSA-wr44-6hxh-3jwq | fixed `5c79257` in-range |
| DEV-ONLY | high | `js-yaml` | recharts > eslint-plugin-react-perf > eslint > js-yaml | lint tooling recharts declares as a dependency (eslint-plugin-react-perf > eslint); never executed at runtime | GHSA-2883-xcg3-v3hh, GHSA-52cp-r559-cp3m, GHSA-5p4m-2wfm-xmqj, GHSA-h67p-54hq-rp68 | fixed `5c79257` in-range |
| DEV-ONLY | high | `lighthouse` | @lhci/cli > lighthouse | devDependency `@lhci/cli` | via puppeteer-core | fixed `e8d68f3` @lhci/cli major |
| DEV-ONLY | high | `nanoid` | next > postcss > nanoid | Next's build-time CSS pipeline (postcss), not request-time code | GHSA-28wg-ghj8-5hjv, GHSA-2v37-7h3g-55p8, GHSA-xwg4-73v4-xw9w | fixed `5c79257` in-range |
| DEV-ONLY | high | `postcss` | still-vulnerable copies: postcss | Next's build-time CSS pipeline (postcss), not request-time code | GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-qx2v-qp2m-jg93, GHSA-r28c-9q8g-f849 | LEFT: Next pins `postcss@8.4.31` EXACTLY; npm's only fix is Next 16 (framework major). Build-time CSS on our own stylesheets. |
| DEV-ONLY | high | `puppeteer-core` | @lhci/cli > lighthouse > puppeteer-core | devDependency `@lhci/cli` | via @puppeteer/browsers, chromium-bidi | fixed `e8d68f3` @lhci/cli major |
| DEV-ONLY | high | `source-map-js` | next > postcss > source-map-js | Next's build-time CSS pipeline (postcss), not request-time code | GHSA-68fv-2mgg-jv7q | fixed `5c79257` in-range |
| DEV-ONLY | high | `tmp` | @lhci/cli > tmp | devDependency `@lhci/cli` | GHSA-ph9p-34f9-6g65 | fixed `e8d68f3` @lhci/cli major |
| DEV-ONLY | moderate | `@jest/core` | still-vulnerable copies: @jest/core | devDependency `jest` | via @jest/reporters, jest-config, jest-runner, jest-runtime | LEFT: jest chain - no non-downgrade fix (see below) |
| DEV-ONLY | moderate | `@jest/reporters` | still-vulnerable copies: @jest/reporters | devDependency `jest` | via glob | LEFT: jest chain - no non-downgrade fix (see below) |
| DEV-ONLY | moderate | `@typescript-eslint/eslint-plugin` | eslint-config-next > @typescript-eslint/eslint-plugin | devDependency `eslint-config-next` | via @typescript-eslint/type-utils, @typescript-eslint/utils | fixed `5c79257` in-range |
| DEV-ONLY | moderate | `@typescript-eslint/parser` | eslint-config-next > @typescript-eslint/parser | devDependency `eslint-config-next` | via @typescript-eslint/typescript-estree | fixed `5c79257` in-range |
| DEV-ONLY | moderate | `@typescript-eslint/type-utils` | eslint-config-next > @typescript-eslint/eslint-plugin > @typescript-eslint/type-utils | devDependency `eslint-config-next` | via @typescript-eslint/typescript-estree, @typescript-eslint/utils | fixed `5c79257` in-range |
| DEV-ONLY | moderate | `@typescript-eslint/typescript-estree` | eslint-config-next > @typescript-eslint/parser > @typescript-eslint/typescript-estree | devDependency `eslint-config-next` | via minimatch | fixed `5c79257` in-range |
| DEV-ONLY | moderate | `@typescript-eslint/utils` | eslint-config-next > @typescript-eslint/eslint-plugin > @typescript-eslint/utils | devDependency `eslint-config-next` | via @typescript-eslint/typescript-estree | fixed `5c79257` in-range |
| DEV-ONLY | moderate | `baseline-browser-mapping` | next-pwa > babel-loader > webpack > browserslist > baseline-browser-mapping | build-time webpack plugin (generates the service worker at `next build`) | GHSA-w5vr-8v7q-w6rv | fixed `5c79257` in-range |
| DEV-ONLY | moderate | `glob` | still-vulnerable copies: @jest/reporters > glob, jest-config > glob, jest-runtime > glob ... | build-time webpack plugin (generates the service worker at `next build`) | GHSA-3g3m-2fjr-6pw4 | LEFT: jest chain - no non-downgrade fix (see below) |
| DEV-ONLY | moderate | `jest` | still-vulnerable copies: jest | devDependency `jest` | via @jest/core, jest-cli | LEFT: jest chain - no non-downgrade fix (see below) |
| DEV-ONLY | moderate | `jest-circus` | still-vulnerable copies: jest-circus | devDependency `jest` | via jest-runtime | LEFT: jest chain - no non-downgrade fix (see below) |
| DEV-ONLY | moderate | `jest-cli` | still-vulnerable copies: jest-cli | devDependency `jest` | via @jest/core, jest-config | LEFT: jest chain - no non-downgrade fix (see below) |
| DEV-ONLY | moderate | `jest-config` | still-vulnerable copies: jest-config | devDependency `jest` | via glob, jest-circus, jest-runner | LEFT: jest chain - no non-downgrade fix (see below) |
| DEV-ONLY | moderate | `jest-runner` | still-vulnerable copies: jest-runner | devDependency `jest` | via jest-runtime | LEFT: jest chain - no non-downgrade fix (see below) |
| DEV-ONLY | moderate | `jest-runtime` | still-vulnerable copies: jest-runtime | devDependency `jest` | via glob | LEFT: jest chain - no non-downgrade fix (see below) |
| DEV-ONLY | moderate | `minimatch` | still-vulnerable copies: @jest/reporters > minimatch, jest-config > minimatch, jest-runtime > minimatch ... | lint tooling recharts declares as a dependency (eslint-plugin-react-perf > eslint); never executed at runtime | GHSA-g3hv-75wg-m249 | LEFT: jest chain - no non-downgrade fix (see below) |
| DEV-ONLY | moderate | `qs` | @lhci/cli > express > qs | devDependency `@lhci/cli` | GHSA-4mjr-xmp4-gh2g, GHSA-6pq8-jhm2-2vcw, GHSA-q8mj-m7cp-5q26, GHSA-x5fp-wj9c-mxmx | fixed `e8d68f3` @lhci/cli major |
| DEV-ONLY | moderate | `uuid` | @lhci/cli > uuid | devDependency `@lhci/cli` | GHSA-w5hq-g745-h8pq | fixed `e8d68f3` @lhci/cli major |
| DEV-ONLY | low | `@babel/core` | next-pwa > babel-loader > @babel/core | build-time webpack plugin (generates the service worker at `next build`) | GHSA-4x5r-pxfx-6jf8 | fixed `5c79257` in-range |
| DEV-ONLY | low | `next-pwa` | next-pwa | build-time webpack plugin (generates the service worker at `next build`) | via workbox-webpack-plugin | fixed `5c79257` in-range |
| DEV-ONLY | low | `rollup-plugin-terser` | next-pwa > workbox-webpack-plugin > workbox-build > rollup-plugin-terser | build-time webpack plugin (generates the service worker at `next build`) | via serialize-javascript | fixed `5c79257` in-range |
| DEV-ONLY | low | `serialize-javascript` | next-pwa > workbox-webpack-plugin > workbox-build > rollup-plugin-terser > serialize-javascript | build-time webpack plugin (generates the service worker at `next build`) | GHSA-m5mm-p8h7-m29v | fixed `5c79257` in-range |
| DEV-ONLY | low | `workbox-build` | next-pwa > workbox-webpack-plugin > workbox-build | build-time webpack plugin (generates the service worker at `next build`) | via rollup-plugin-terser | fixed `5c79257` in-range |
| DEV-ONLY | low | `workbox-webpack-plugin` | next-pwa > workbox-webpack-plugin | build-time webpack plugin (generates the service worker at `next build`) | via workbox-build | fixed `5c79257` in-range |

## Left, and why

1. **`postcss` (high) and `next` (moderate), from the same pin.**
   - Next 15.5.29 declares `postcss: 8.4.31` exactly. The four postcss advisories
     (GHSA-qx2v-qp2m-jg93, -6g55-p6wh-862q, -r28c-9q8g-f849, -fxqj-rqcc-2cmp) need
     attacker-controlled CSS or source maps at build time. Ours are our own stylesheets.
   - npm's only fix is Next 16, a framework major with its own migration.
   - Overriding a framework's exact pin across a minor it was not tested with is not
     "cheap and safe". On the board.
2. **The jest chain: 18 moderate entries, but only TWO advisories.** They are
   GHSA-3g3m-2fjr-6pw4 (glob AbortSignal bypass) and GHSA-g3hv-75wg-m249 (minimatch
   globparts DoS).
   - The newest jest 30 (30.5.2) still depends on `glob ^13`, and npm marks glob
     vulnerable through 14.0.1.
   - npm's only fix is a DOWNGRADE to jest 29, which is excluded.
   - Overriding glob across a major inside the test runner is not safe.
   - Dev-only: the patterns and signals come from our own test configuration.
   - The entry count went from 10 to 18 because jest 30.2 -> 30.5.2 (inside `^30`)
     reports the same two advisories through more of its packages. The 6
     `@typescript-eslint` entries for the same minimatch advisory cleared.
   - On the board.

Every advisory in code that runs for users or on the server is fixed. What remains is
Next's build-time CSS pipeline (postcss) and the test runner (jest).

## Found in CI, after the fact

The first CI run of this PR failed at `npm ci` on every job: `Missing: rollup@4.68.7 from lock file`.

- **What changed hands.** `@lhci/cli` 0.16.1 (`e8d68f3`) brought lighthouse's `@sentry/node` from 7.120.4 to **11.15.0**, a major jump in a dev-only dependency of a dev-only dependency. The local check of that commit looked for downgrades only, not majors, so this was not caught.
- **Why it broke CI.** Its `@sentry/bundler-plugins` declares an OPTIONAL peer `rollup >=3.2.0`, while rollup 2.80.0 is already present for next-pwa's workbox. Local npm 11.6.3 accepts a present-but-incompatible optional peer. CI's npm 10 (Node 22) does not, and wants rollup 4 in the lockfile.
- **The fix (`07be18d`).** `npm@10 install --package-lock-only` added exactly the 27 missing entries (rollup 4.68.7 and its platform binaries), with nothing changed or removed. Both `npm@10 ci --dry-run` and `npm@11.6.3 ci --dry-run` pass.
