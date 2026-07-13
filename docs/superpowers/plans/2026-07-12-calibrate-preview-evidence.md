# Calibrate Pro current-preview publication plan

**Goal:** Replace stale public claims that Calibrate Pro still uses its legacy UI
with current, truthful evidence from the reviewed native dark-room workbench.

## Evidence boundary

- The public v1.1.0 binaries remain the earlier beta distribution.
- Current source evidence comes from Calibrate Pro PR #12, merged at
  `8ed017577b34c7a6d2bfe04a17a254f377ad7b7c`.
- The screenshot is a deterministic 1440 × 900 render of a bundled generic
  fixture. It is not a physical display measurement or release-binary receipt.
- Simulated and Not measured values stay visibly distinct; preview mode performs
  no hardware discovery or display/profile mutation.

## Changes

- [x] Add the verified preview PNG and a public provenance/limitations receipt.
- [x] Update `build-products.html` with the current workbench, source/release
  distinction, explicit preview boundary, responsive figure, and review links.
- [x] Remove the stale modernization-pending statement from `overview.html`.
- [x] Update the Calibrate Pro Telos card data and regenerate its 1200 × 630 PNG.
- [x] Add regression tests for copy, source provenance, image dimensions, hashes,
  and the removal of stale legacy-UI claims.

## Verification

- `python -m pytest tests -q -p no:cacheprovider` — 14 passed.
- `node tests/linkcheck.mjs` with the site served on port 8802 — 541 internal
  links across 78 pages, 0 broken.
- `git diff --check` — clean.
- Changed-text credential/local-path scan — clean.
- Desktop page, printed evidence layout, native screenshot, and social card were
  inspected at original resolution.
