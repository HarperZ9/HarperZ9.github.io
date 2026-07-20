# ZentropyLabs site-wide brand integration design

## Objective

Extend the approved Zentropy home-brand work across the public
`harperz9.github.io` site so every major page family carries the same
ZentropyLabs identity, rhinoCase naming, custom typography, and current
first-party artwork.

The home page already moved in the right direction. The remaining problem is
that static system pages, document pages, and several standalone pages still
load the old Telos-era shared chrome, old purple/lime theme material, and
mobile-heavy shader behavior. This design updates the shared shell instead of
hand-restyling pages one by one.

## Approved Direction

Use approach A: "Zentropy route plates and unified shell."

The public brand name in the shared chrome is `zentropyLabs`. Project Telos
remains the public workbench and project family. ZentropyLabs is the publishing
workshop / brand system that frames the site.

## Source of Truth

- `C:/dev/public/portfolio-site/docs/superpowers/specs/2026-07-18-zentropy-home-brand.md`
  - Existing home-brand contract to preserve and extend.
- `C:/dev/public/telos-v2/public/brand/zentropy-logo.png`
  - Approved wordmark / aperture artwork already used by the home pass.
- `C:/dev/public/telos-v2/public/brand/zentropy-avatar.png`
  - Approved compact aperture/avatar mark for shared navigation and fallbacks.
- `C:/dev/public/telos-v2/public/brand/ZentropyDisplay.ttf`
  - Custom display face for short brand, route, and project marks.
- `C:/dev/public/telos-v2/public/img/og/*.png`
  - Current in-flight redesign cards for page/project artwork.
- `C:/dev/public/telos-v2/public/img/og/_card.html`
  - Visual contract for palette, grain, scanlines, lower wash, metadata,
    aperture behavior, and rhinoCase spelling.

## Requirements

- [ ] Shared navigation renders `zentropyLabs` in rhinoCase and no longer
  hardcodes `TELOS` as the primary brand label.
- [ ] Shared navigation uses the approved aperture/avatar mark as its compact
  visual signal. WebGL logo rendering is optional desktop enhancement only, not
  a baseline requirement.
- [ ] Static pages that already expose an `og:image` use that image as visible
  route art. The visible treatment can be a full masthead, compact route plate,
  or background plate depending on page family, but the new artwork must not
  remain hidden only in social metadata.
- [ ] The new Telos v2 OG artwork is copied into `img/og/` so existing metadata
  and visible route plates point at current assets.
- [ ] `zentropy-avatar.png` is copied into the public site and used for compact
  shell branding and route-art fallback.
- [ ] `ZentropyDisplay` is available from the shared CSS layer and is used for
  short brand/page/project marks. Hanken Grotesk remains body text. Conso
  remains metadata/readout text.
- [ ] `system/system.css` and `system/doc.css` share the Zentropy material
  direction: near-black ground, ice ink, muted blue-gray text, oxblood/rust
  wash, cyan aperture signal, grain, scanline, and fine registration details.
- [ ] Old purple/lime/iris material remains only where a specific project
  component needs it. It must not be the default shared site theme.
- [ ] Static page WebGL/canvas field imports are gated by capability:
  `prefers-reduced-motion: no-preference`, fine pointer, and at least a
  desktop-width viewport. Narrow/touch/reduced-motion devices receive static
  artwork and DOM content only.
- [ ] Mobile navigation no longer crams the primary links into an unreadable
  single row. It presents the brand, a small active-section signal, and a usable
  menu control.
- [ ] Long-form document pages keep readable measures and print-friendly
  structure while adopting the Zentropy shell, artwork plate, and typography
  hierarchy.
- [ ] Existing page content, links, maturity labels, and public/private
  boundaries remain intact.

## Page-Family Design

### Home

The Vite home shell remains authoritative for the first viewport. The
site-wide pass does not rework the home interaction model except where shared
assets, metadata, or naming need to stay consistent with the rest of the site.

### System Pages

Pages using `system/system.css` get the strongest route-art treatment. The
shared runtime reads the page's `og:image` metadata, normalizes same-origin
absolute URLs into relative public paths, and exposes that image to the DOM/CSS
as page art. A route plate appears near the top of the content without hiding
or replacing the existing hero copy.

The route plate should feel like the Telos v2 card system: hard black field,
oxblood lower band, scanline/grain texture, cyan aperture signal, and compact
Conso metadata. `ZentropyDisplay` is used only for short words where the custom
face is legible.

### Document Pages

Pages using `system/doc.css` keep the `body.doc` reading frame, but the old
light sheet default is no longer the screen default. The screen experience
becomes a dark Zentropy document shell with a compact route plate above or
inside the first sheet. Print styles preserve a simpler high-contrast
document treatment.

### Standalone Sample/Demo Pages

Standalone pages that import `system/nav.js` but own their inline styles should
receive shared navigation, the mobile shader gate, and a conservative route-art
fallback. Their local report layouts should not be deeply rewritten in this
pass unless the shared shell visibly breaks them.

## Technical Approach

### Assets

Copy these public assets from `telos-v2` into `portfolio-site`:

- `public/brand/zentropy-avatar.png` to `brand/zentropy-avatar.png`
- any missing/current `public/brand/ZentropyDisplay.ttf` to
  `brand/ZentropyDisplay.ttf`
- `public/img/og/*.png` to `img/og/*.png`

Do not copy source generators, private drafts, browser captures, credentials,
or local-only artifacts.

### Shared Runtime

Update `system/nav.js` as the shared control point:

- render `zentropyLabs` in the home/brand link
- use `brand/zentropy-avatar.png` as the fallback mark
- expose a compact active-section label for narrow navigation
- import heavy canvas modules only when capability checks pass
- add or import a small route-art helper that reads `og:image` and
  `og:image:alt`, then mounts a decorative/semantic route-art element once

The route-art helper should be idempotent and no-op cleanly on pages with no
usable metadata.

### Shared Styles

Update `system/system.css` and `system/doc.css` rather than patching every
static page. Preserve old variable names where selectors depend on them, but
remap their values to the Zentropy palette:

- `--void`: `#070406`
- `--void-opaque`: `#070406`
- `--bone` / primary ink: `#eaf5f6`
- `--muted`: `#94afb4`
- `--prussian` / faint text: `#678188`
- `--signal`: `#8ee3f2`
- `--ember` / warm accent: `#c86a44`
- `--zentropy-oxblood`: `#1e0f14`

Add a shared `@font-face` for `ZentropyDisplay` and introduce explicit tokens
for brand display, body, and mono roles. Remove comments that say Telos
Display/Kilon/custom display work is retired when they contradict the current
brand direction.

### Page Markup

Prefer shared runtime and CSS changes. Only touch individual HTML files when a
page has stale cache-busting query strings, missing metadata, broken local
structure, or an inline layout that prevents the shared shell from rendering
correctly.

### Mobile and Reduced Motion

The static pages should use the same practical gate as the home pass:

- reduced motion disables ambient canvas
- coarse pointer disables ambient canvas
- viewport below the desktop threshold disables ambient canvas

This must prevent `system/generative-field.js`, the nav WebGL logo, and cursor
field enhancements from mounting on mobile. The fallback state is not blank:
the aperture/avatar image, route art image, and text content remain visible.

## Files Expected To Change

- `system/nav.js` - shared nav label, mark, menu behavior, route-art mount,
  and runtime capability gate.
- `system/system.css` - main static page palette, typography, route plate,
  navigation, and mobile behavior.
- `system/doc.css` - document page palette, typography, route plate, navigation,
  print-safe fallback, and mobile behavior.
- `brand/zentropy-avatar.png` - public compact brand mark.
- `brand/ZentropyDisplay.ttf` - custom display font if the local copy differs
  from the Telos v2 source.
- `img/og/*.png` - current Zentropy/Telos v2 page and project cards.
- Selected `*.html` files only if needed for cache strings or missing metadata.
- Tests under `tests/` if existing coverage does not assert the new contract.

## Verification Plan

- Run source checks that assert:
  - `system/nav.js` renders `zentropyLabs`
  - static nav no longer hardcodes `TELOS` as the brand label
  - mobile capability checks prevent heavy canvas imports
  - `ZentropyDisplay` is referenced from shared styles
  - representative pages still expose valid `og:image` metadata
- Run the repo's Python tests.
- Run the home build if implementation touches home source or generated root
  assets.
- Run `git diff --check`.
- Serve the site with `npx serve -l 8765 .`.
- Inspect desktop and mobile widths with Playwright/browser screenshots for:
  - home
  - `overview.html`
  - `research.html`
  - one flagship/project page such as `forum.html`
  - one standalone sample page such as `proof-surface-sample.html`
- Run the link checker against the local server.
- Scan changed/staged files for credential-shaped content before committing.
- Push to `main` and verify GitHub Pages reports the pushed commit as built
  before treating the published site as updated.

## Risks and Constraints

- The CSS files are large and carry several historical cascades. The
  implementation should preserve compatibility variables first, then layer the
  Zentropy defaults late enough to win the cascade.
- Some standalone pages have inline CSS. The site-wide pass should improve
  their shared shell without turning this into a full redesign of every sample
  report.
- Large OG images can affect page weight if every page eagerly loads them. Route
  plates should use lazy images where possible and avoid hidden duplicate image
  loads.
- GitHub Pages is production for this repo. Publishing is allowed only after the
  implementation passes the verification plan and the current task scope still
  includes publish approval.

## Status: APPROVED

Design direction approved by the user on 2026-07-19. Written-spec review was
approved by the user before implementation planning.
