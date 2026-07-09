# Inspiration Synthesis - 2026-07-09

## Verified inputs

- Local inspiration corpus: `C:/Users/Zain/Desktop/art-theme-style-generative-inspiration/`.
- Corpus scan artifact: `.preview/inspiration-corpus-analysis.json`.
- Corpus contact sheet: `.preview/inspiration-all-contact-sheet.jpg`.
- Corpus size: 162 files total, with 155 images and 7 videos.
- Image formats: 144 WebP files, 4 GIF files, 3 PNG files, 3 JPEG files, and 1 JPG file.
- Aspect mix: 64 square images, 65 portrait images, and 26 landscape images.
- Average measured signals: edge density 0.1256, saturation 0.396, contrast 47.95, luma 85.87.
- Ditto capture of `alexandernikolas.com`: `C:/dev/tmp/ditto-alexander/alexandernikolas/.clone/`.
- Live source inspection copy: `C:/dev/tmp/alexander-source-inspection/index.html`.

## Read from the corpus

The corpus is not one style. It is a family of dark computational posters:

- near-black and navy foundations with high-detail texture
- ordered dither, halftone, ASCII, scanline, and pixel-grid behavior
- contour-line terrain, rug density, cellular automata, hydra tiling, and fractal geometry
- lamp, pillar, crystal, and radial-symmetry compositions
- acid cyan, lime, violet, magenta, and ember bursts used as events, not as a monotone wash
- square and portrait poster composition, but with enough structure to become page material

## Read from the reference implementation

The reference site is strong because the visual effect is engineered, not pasted on. The relevant patterns to internalize are:

- document-aware canvas sizing, with a strong guard against runaway height
- DPR clamping so animation stays under mobile pixel limits
- CPU and GPU fallback thinking, with reduced-motion behavior preserved
- interaction pulses, chromatic field disturbance, ASCII scrambling, and readout strips
- activity-aware frame pacing, rather than burning the same frame budget while idle
- sparse DOM and clear copy column, so the effect supports the page instead of competing with it

No source, shader, asset, or image from the reference implementation should be copied into the public site.

## Site synthesis rules

1. Text wins. The field may be dense, but the reading corridor must stay protected.
2. Telos Display is a signature face, not body text. Use Kilon and Hanken Grotesk for actual reading.
3. The engine should generate the material: fluid washes, metaball potential, ordered dither, contour ridges, planar tiles, symmetry marks, ASCII fields, and route-seeded palettes.
4. Color should behave like signal events. Avoid a single blue, purple, green, beige, or terminal-only mood.
5. Pages need hard nav, shared rhythm, and clear route connection. The site is broad-scope, not accountability-only.
6. Reduced motion, local assets, link integrity, and visual screenshots remain release gates.

## Current implementation direction

- Typeface 0.5 starts from readable Kilon outlines and applies deterministic outline modulation.
- The shared canvas now moves toward activity-aware field behavior with interaction pulses, poster dither, hydra-like planar tiles, lamp symmetry, fluid curl, and ASCII/metaball overlays.
- The typeface specimen explains the synthesis directly and makes the custom face visible without using it for dense reading.
