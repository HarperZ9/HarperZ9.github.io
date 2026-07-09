# AGENTS.md - Portfolio Site

## Scope

This file applies to the `HarperZ9.github.io` portfolio-site worktree. Root
workspace instructions still apply; this repo is a public GitHub Pages surface.

## Product Boundary

Treat this repository as the first public portfolio signal for release-candidate
products and public tools.

Publishable surfaces:

- `index.html` - generative home shell (Vite bundle plus `system/home-art.js`).
- `*-sample.html` pages - scrubbed public sample reports and witness surfaces.
- `README.md` and `AUTHORS.md` - repository context and authorship posture.

Never publish:

- `.env`, `.env.*`, credentials, API tokens, browser profiles, or local config.
- Private client data, protected corpus material, raw operation logs, or
  generated evidence that has not been deliberately scrubbed for public release.
- Screenshots or browser artifacts that contain local paths, private tabs, or
  credentials.

## Editing Rules

- Keep the site static unless there is a clear product need for a build step.
- Keep sample pages inspectable and self-contained.
- Link only to repositories or artifacts intended to be visible from a public
  portfolio surface.
- When adding a new product tile, make the maturity level clear: sample,
  release candidate, production-ready, archived, or research.
- Preserve a calm, work-focused tone; this site is a working surface, not a
  hype page.

## Verification

For docs-only changes:

```powershell
git diff --check
```

For page or style changes, also render-check the page:

```powershell
npx serve -l 8765 .
```

(`python -m http.server` serves `.mjs` as `text/plain` on some Windows setups,
which breaks the Studio's module graph; use a server with correct MIME types.)

Then inspect `http://127.0.0.1:8765/` at desktop and mobile widths with
Playwright or a browser.

Before committing or pushing, scan changed files for credential-shaped content
and confirm no local-only artifacts are staged.
