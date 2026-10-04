# HarperZ9.github.io brand assets

Current assets, rendered on 4 October 2026 from the shared art direction:

- `docs/art/hero-dark.svg`, `docs/art/hero-light.svg`: the README hero, 1280 x 480, text outlined from Hanken Grotesk and Conso.
- `docs/art/social.png`: the GitHub social preview, 1280 x 640.
- The mark: `docs/brand/mark-16.png`, `docs/brand/mark-32.png` and `docs/brand/mark-16.svg` (favicon sizes),
  `docs/brand/mark-64.png`, `docs/brand/mark-512.png` and `docs/brand/mark-tile.svg` (app and listing icons),
  `docs/brand/mark-light.svg` and `docs/brand/mark-dark.svg` (on a page, no tile).
- The lockups: `docs/brand/lockup-horizontal-light.svg`, `docs/brand/lockup-horizontal-dark.svg`,
  `docs/brand/lockup-stacked-light.svg` and `docs/brand/lockup-stacked-dark.svg`.
- `docs/art/receipts.json`: a `superstack.receipt/1` for every PNG, with the seed, the scene hash and the font hashes.

The seed is the repository name. The same seed gives the same SVG bytes.

The record below describes the previous brand render and stays as it was written.

## Previous render

This directory contains the public README artwork for HarperZ9.github.io.

- Hero image: `portfolio-site-hero.png`
- Source contract: `telos.rendering.research`
- Typography: rendered from local operator font inputs, exported as a static PNG.
- Accessibility floor: the README must keep the product name, tagline, and commands available as real text outside the image.
- Provenance boundary: purchased font files remain local inputs and are not committed to this repository.

## Deterministic social-card receipts

Command:

```powershell
npm run media:cards -- --keys phantom,security-toolkit,private-practice
```

The receipt was recorded at 2026-08-26T22:58:03-07:00 after two byte-identical runs.
Each PNG is 1200 x 630.

- img/og/phantom.png SHA-256 BCD44E9AFD12F96726756493A107D71FFDEA011414DEEC14C1997D92E7ABD58C
- img/og/security-toolkit.png SHA-256 8FDF6D6AC66861AB1EE31F002503C019181D585CE30312F0EAAC04756E6DAABC
- img/og/private-practice.png SHA-256 6F23096A0B07E874A902B2C9F10FE4C69AD1C4E4C489E093A24919BA2E16330F

