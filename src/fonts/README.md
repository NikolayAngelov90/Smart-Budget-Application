# Self-hosted fonts

These files exist so that **`next build` never touches the network**.

Before this, `src/app/layout.tsx` imported `Space_Grotesk` and `Onest` from
`next/font/google`, which fetches ~14 woff2 files from `fonts.gstatic.com`
*during the build*. That made every deploy dependent on Google Fonts being
reachable from a CI runner, and it failed:

```
src/app/layout.tsx
`next/font` error:
Failed to fetch `Onest` from Google Fonts.
> Build failed because of webpack errors
```

Fonts were the **only** network access on the build path — the rest of the app
reaches the network exclusively at request time.

## What is here

| File | Family | Axis range | Size |
| --- | --- | --- | --- |
| `Onest-Variable.woff2` | Onest | `wght` 100–900 | 84 KB |
| `SpaceGrotesk-Variable.woff2` | Space Grotesk | `wght` 300–700 | 49 KB |

**Variable, not static.** Two files replace fourteen: smaller in total, and the
intermediate weights come free instead of snapping to the nearest of five. The
weights actually used (400/500/600/700 for Space Grotesk, 400–800 for Onest) sit
inside both ranges.

**Onest carries Cyrillic; Space Grotesk does not.** Verified against the `cmap`
table, not assumed — Onest resolves glyphs for А, я, б, and the Bulgarian щ, ъ,
ю; Space Grotesk resolves none of them. This is by design: Space Grotesk is the
display face for headings and amounts, and Cyrillic headings fall back to Onest
through the font stack in `src/theme/index.ts`. **Onest's Cyrillic coverage is
what makes the `bg` locale work at all** — if you ever swap this file, check
Cyrillic first, because jsdom has no font engine and no unit test will catch it.

## Licence

Both families are licensed under the **SIL Open Font License 1.1**. Committing
the binaries here is redistribution, so the full licence text ships alongside
them and the reserved font names are preserved:

- `Onest-OFL.txt` — Copyright 2021 The Onest Project Authors
  (https://github.com/googlefonts/onest)
- `SpaceGrotesk-OFL.txt` — Copyright 2020 The Space Grotesk Project Authors
  (https://github.com/floriankarsten/space-grotesk)

The fonts are not renamed or modified — only re-encoded TTF → woff2, which the
OFL permits.

## Regenerating

Sources are the upstream `google/fonts` repository (`main` branch, fetched
2026-08-12):

```
https://raw.githubusercontent.com/google/fonts/main/ofl/onest/Onest%5Bwght%5D.ttf
https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf
```

Convert with `wawoff2` (installed only for this, then removed — it is not a
project dependency):

```bash
npm i -D wawoff2
node -e "const w=require('wawoff2'),fs=require('fs');(async()=>{ \
  for (const [i,o] of [['Onest[wght].ttf','Onest-Variable.woff2'], \
                       ['SpaceGrotesk[wght].ttf','SpaceGrotesk-Variable.woff2']]) \
    fs.writeFileSync(o, Buffer.from(await w.compress(fs.readFileSync(i)))); })()"
npm uninstall wawoff2
```

Re-download `OFL.txt` from the same directories whenever the fonts are updated.
