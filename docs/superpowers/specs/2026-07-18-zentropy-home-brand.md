# Zentropy home-brand integration

## Goal

Bring the deployed `harperz9.github.io` home into alignment with the approved
Zentropy Labs work on `telos-v2/feat/brand-zentropy`, while preserving Project
Telos as the public workbench and retaining the verified fourteen-engine
content.

## Source of truth

- `C:/dev/public/telos-v2/public/brand/zentropy-logo.png`: approved aperture,
  halftone, scanline, grain, and reflection artwork.
- `C:/dev/public/telos-v2/public/brand/ZentropyDisplay.ttf`: the custom display
  face used exclusively for the Zentropy wordmark.
- `C:/dev/public/telos-v2/public/img/og/_card.html`: approved rhinoCase spelling
  (`zentropyLabs`) and oxblood-and-ice palette reference.

## Experience contract

1. The navigation and footer identify the publishing workshop as
   `zentropyLabs`; Project Telos remains the workbench and the fourteen-engine
   roster remains intact.
2. The hero leads with the approved rendered Zentropy artwork, not a recreated
   approximation. Its surrounding UI uses restrained oxblood, ice, grain, and
   registration details drawn from the source renderer.
3. `ZentropyDisplay` is reserved for the `zentropyLabs` wordmark. Hanken Grotesk
   and Conso remain the two reading/data faces used everywhere else.
4. On touch, narrow, or reduced-motion devices, no hero, wordmark, or emphasis
   WebGL context is created. The static artwork and DOM copy remain complete and
   accessible.
5. On desktop fine-pointer screens, at most the existing low-priority ground
   field may mount. It must respect the same capability gate and always sit
   behind readable content.

## Verification

- Source-contract tests prove the new identity, rhinoCase, static hero artwork,
  and mobile GPU gate.
- The Vite build succeeds and the generated static root is inspected at desktop
  and narrow viewport sizes.
- Public deployment remains out of scope until explicitly approved.
