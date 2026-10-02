# Changelog

## 2026-10-01 - Zentropy Labs logotype and avatar retired

- `brand/zentropy-logo.html` and `brand/zentropy-avatar.html` are now redirect
  pages written by `tools/redirect_stubs.py`. They carry `noindex`, show no
  retired name or art, and send a reader to `typeface.html` and the home page.
- Removed the retired art: `brand/zentropy-logo.png`, its four WebP sizes,
  `brand/zentropy-face.json`, `brand/zentropy-specimen.svg` and
  `brand/zentropy-avatar.png` (a byte-identical copy of
  `brand/aperture-mark.png`, which the header still uses).
- Removed three superseded home bundles that no page, test or bundle
  references: `assets/index-BOzfAcuL.js`, `assets/index-EaeROAAw.js` and
  `assets/index-NqGo0RlY.js`.
- Kept on purpose: `--zentropy-*` CSS variable names, `zentropy.*/v1` record
  format names, the old font URLs, the dated 24 and 25 August archives, and the
  superseded bundles that the release tests pin. None renders as page text.

## 2026-10-01 - Typefaces renamed Zain

- The site typefaces now carry the Zain name: Zain Editorial Preview, Zain Mono
  Preview and Zain Display. The OpenType name table (family, typographic
  family, full name, PostScript name, unique ID, version, manufacturer and
  designer) changed. Every other table is unchanged, and specimens render with
  zero differing pixels before and after.
- Versions: Editorial and Mono 0.001 to 0.002, Display 1.0 to 1.001. The
  license text is unchanged. Manufacturer and designer read Zain Dana Harper.
- New files: `type/preview/zain-editorial-regular.woff2`,
  `type/preview/zain-mono-regular.woff2`, `brand/ZainDisplay.ttf`. The fonts
  page, its CSS, the specimen copy, the route registry, the site index and the
  home bundle use the new names.
- Old URLs still work. `type/preview/zentropy-editorial-regular.woff2`,
  `type/preview/zentropy-mono-regular.woff2` and `brand/ZentropyDisplay.ttf`
  stay in place as byte-identical copies of the renamed files, so external
  embeds keep loading. A stylesheet that declares its own `font-family` name
  is unaffected; local font menus show the new name.

## 2026-08-30 - Product map and evidence registry clarity

- Clarified the distinction between the compact product map and the detailed
  evidence registry. A product can appear once in the map and in additional
  registry domains without implying duplicate products or hierarchy.
- Preserved the release fingerprint after the copy correction and kept the
  catalog generator aligned with the explanatory note.

## 2026-06-29 - Public Delivery Refresh

- Added this public changelog.
- Added GitHub Actions CI for Python content contracts and internal-link
  crawling.
- Added standalone usage and verification documentation for public and
  developer visitors.
- Normalized scanner-blocking dash punctuation in repository-facing docs.

## Current Status

- Runtime: static GitHub Pages site.
- Surfaces: portfolio pages, product pages, sample reports, Project Telos
  Studio showcase, and repo/developer links.
- Verification: Python content contracts, static link crawl, and public surface
  sweep.
