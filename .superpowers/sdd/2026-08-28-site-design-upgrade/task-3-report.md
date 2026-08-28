# Task 3 report: homepage constellation front door

Date: 2026-08-28

Branch: `codex/site-design-upgrade-20260828`

Base context:

- Planned Task 3 base: `c2940fbd9dd812d989ca8eba115517a5ff348394`
- Actual implementation parent before Task 3 commit: `5026c35 fix(site): guard route headers without document location`
- Task 3 implementation commit: `4a6a26fe32a5b1e34f5693b7c64cce12e2af7990`

## Outcome

Rebuilt the homepage around the Zain Dana Harper / Zentropy Labs front door. Flywheel is now the second major section and remains the only `architectureRole=primary-platform` system. The old workflow wall and browser-native check sections were removed from the homepage. The page now uses a plain document flow with direct route access, source-backed evidence tables, and an accessible capability constellation drawn from `system/systems.json`, `feed.json`, and `media/retro-systems-lab/evidence-manifest.json`.

The latest operator correction, "Less eyebrows too", is reflected by removing decorative prefaces from the homepage contract and source. The homepage no longer uses visible eyebrow, kicker, overline, slash-route preface, pseudo-dashboard, row-index, global vignette, or `GroundField` framing.

## TDD record

RED before production edits:

```text
python -m pytest tests/test_home_marketing_funnel.py tests/test_portfolio_visual_contract.py -q
7 failed, 6 passed
```

Main failures captured before implementation:

- legacy Flywheel-first framing still present;
- hard-coded retro/source expectations did not match the live data route;
- metadata and no-JS fallback still used the older marketing surface;
- `ZentropyDisplay` and decorative scaffolding were still present;
- evidence table and deployed visual contract did not match the new intended homepage.

GREEN after production edits and local deploy:

```text
python -m pytest tests/test_home_marketing_funnel.py tests/test_portfolio_visual_contract.py -q
13 passed in 0.16s
```

```text
python -m pytest tests/test_deploy_sanity.py tests/test_flywheel_retro_live_release.py -q
9 passed in 0.07s
```

```text
python -m pytest tests/test_capability_publication_release.py tests/test_shared_release_merge.py tests/live/test_capability_constellation_static.py -q
22 passed in 1.44s
```

Build and local deployment:

```text
npm run build
✓ built in 119ms
dist/assets/index-Bh3pWSfE.css
dist/assets/index-FyYdKcDU.js
```

```text
node deploy.mjs
deployed: index.html + index-Bh3pWSfE.css, index-FyYdKcDU.js
```

Known build warnings:

- `/system/home-readable.css?v=20260812-angular` remains a runtime static path.
- `/system/fonts/*.woff2` and `/system/fonts/*.woff` remain runtime static paths.

These were pre-existing static-site resolution warnings and did not block the Vite build.

## Release-contract changes outside the initial Task 3 file list

`tests/test_capability_publication_release.py` and `tests/test_shared_release_merge.py` were updated because the homepage build intentionally replaced the atomic root bundle pair. The tests pin the exact JS/CSS artifact names and release fingerprint; leaving them stale would make the reviewed release contract refer to assets no longer referenced by `index.html`.

Pinned release assets after Task 3:

- `assets/index-FyYdKcDU.js`
- `assets/index-Bh3pWSfE.css`
- reviewed release fingerprint: `c906e740b9645f6b5a8db7adf8d6b426fea5de4fbae2ee835317cd163a86addf`

`sitemap.xml` changed by adding the four capability figure routes:

- `figures/system-capability-map.html`
- `figures/security-capability-map.html`
- `figures/verification-capability-map.html`
- `figures/graphics-retro-capability-map.html`

This is justified because the homepage now exposes the capability-constellation path and the live route test requires the route registry, homepage, or sitemap to cover these public figure surfaces. The homepage no-JS fallback also carries the same links directly.

`home/package-lock.json` changed only in optional transitive lock metadata:

- added `node_modules/@emnapi/core` `1.11.3`
- added nested `node_modules/@emnapi/core/node_modules/@emnapi/wasi-threads` `1.2.3`

No `home/package.json` dependency declaration changed. The package-lock delta is lockfile graph metadata from the local npm toolchain, not a new direct dependency.

## Visual and accessibility inspection

Local server:

```text
npx serve -l 8765 .
INFO Accepting connections at http://localhost:64885
```

The visual audit used the server's reported loopback URL, `http://127.0.0.1:64885/`.

Screenshots produced as ignored local evidence:

- `C:/dev/public/portfolio-site/.worktrees/site-design-upgrade-20260828/.superpowers/sdd/2026-08-28-site-design-upgrade/visuals/home-1440.png`
- `C:/dev/public/portfolio-site/.worktrees/site-design-upgrade-20260828/.superpowers/sdd/2026-08-28-site-design-upgrade/visuals/home-390.png`
- `C:/dev/public/portfolio-site/.worktrees/site-design-upgrade-20260828/.superpowers/sdd/2026-08-28-site-design-upgrade/visuals/home-390-no-js.png`
- `C:/dev/public/portfolio-site/.worktrees/site-design-upgrade-20260828/.superpowers/sdd/2026-08-28-site-design-upgrade/visuals/home-390-forced-colors.png`

Automated visual checks passed:

- 390px and 1440px viewports had no horizontal overflow.
- DOM order matched the approved sequence: identity, flywheel, evidence, constellation, representative, research, retro systems lab, security boundary, hiring/collaboration.
- Hero title computed `text-transform: none`.
- Keyboard order begins at skip link, then brand/home route.
- No-JS fallback contains the required sections and route links.
- Reduced-motion media query was active and produced no overflow.
- Forced-colors media query was active and preserved the main title.
- Sampled contrast ratios were all above 4.5:1:
  - body text: 18.36
  - hero line: 18.36
  - hero lab line: 8.79
  - section lead: 8.79
  - data table text: 11.32
  - primary button: 13.75

Manual screenshot inspection notes:

- Desktop view keeps the Zain Dana Harper / Zentropy Labs identity first, with the contained Zentropy artwork beside it.
- Flywheel appears as the next major section, not as the page owner.
- Capability and evidence sections use warm-paper tables and ruled rows rather than dashboard panels.
- Mobile view preserves route order and avoids horizontal overflow.

## Boundary checks

Source checks found no remaining homepage occurrences of:

- `eyebrow`
- `overline`
- `kicker`
- `orientation / artifact`
- `viewport-vignette`
- `ground-field`
- `Project Telos`
- `ZentropyDisplay`
- `pseudo-dashboard`
- `row-index`
- `Route→Verify`
- `Recorded workflows`
- `browser-native`

The security section keeps public copy at the defensive/authorization-boundary level. It does not publish live bypasses, exploit chains, target-specific techniques, jailbreak corpora, or bypass payloads.

## Not done

- No live deployment was performed.
- No push or merge was performed.
- No subagents or external reviewers were spawned from this task.

## Fix round 1: remove legacy homepage floor

Date: 2026-08-28

Reviewed head before fix: `deb05788970ae7ee83941e48adaed92c5760816f`

Review failure addressed:

- `home/index.html` and generated `index.html` still referenced `/system/home-readable.css?v=20260812-angular`.
- That legacy stylesheet defined `.hero::before`, `.hero::after`, `conic-gradient`, and `.kicker` rules, which could visually hide the new hero copy and crop the identity artwork.
- The hero still placed the role line `Systems Engineer | AI Evaluation, Developer Tools, and Technical Operations` before the identity thesis.
- The shipped stylesheet graph did not yet prove that homepage CSS was closed over the new visual contract.

TDD RED for this fix round:

```text
python -m pytest tests/test_home_marketing_funnel.py tests/test_portfolio_visual_contract.py -q
4 failed, 10 passed
```

The failures covered:

- the role line appearing before the intended first three hero lines;
- `home-readable.css` appearing in template/generated HTML;
- the referenced stylesheet graph resolving to the legacy stylesheet;
- the old deployed bundle still containing the role line.

Additional RED after rendered inspection found the identity art still using `object-fit: cover`:

```text
python -m pytest tests/test_home_marketing_funnel.py::test_home_hero_display_and_visual_system_are_restrained -q
1 failed
```

Additional RED after removing `home-readable.css` found the injected home menu had lost its closed-state rule:

```text
python -m pytest tests/test_portfolio_visual_contract.py::test_home_menu_readability_rules_live_in_the_home_bundle -q
1 failed
```

Implementation:

- Removed the `/system/home-readable.css` link from `home/index.html`; `node deploy.mjs` propagated this to generated `index.html`.
- Removed the early role line from the hero; the role territory remains covered by the hiring section's "engineering and evaluation, technical operations, and public-service or field work" copy.
- Changed `.identity-art img` from cropped `object-fit: cover` to contained intrinsic rendering.
- Moved only the necessary injected `.home-menu` and `.home-menu-list` dropdown/readability rules into `home/src/App.css`.
- Added a stylesheet-closure test that resolves every local stylesheet linked by `home/index.html` and generated `index.html`, then scans the resolved homepage CSS for `home-readable.css`, `conic-gradient`, generic `.hero::before`/`.hero::after` overlays, and legacy lead-in strings.

Final local build and deploy:

```text
npm run build
✓ built in 866ms
dist/assets/index-CTypHnDj.css
dist/assets/index-CZipnc6C.js
```

```text
node deploy.mjs
deployed: index.html + index-CTypHnDj.css, index-CZipnc6C.js
```

Final focused tests:

```text
python -m pytest tests/test_home_marketing_funnel.py tests/test_portfolio_visual_contract.py -q
15 passed in 0.07s
```

```text
python -m pytest tests/test_deploy_sanity.py tests/test_flywheel_retro_live_release.py -q
9 passed in 0.20s
```

```text
python -m pytest tests/test_capability_publication_release.py tests/test_shared_release_merge.py tests/live/test_capability_constellation_static.py -q
22 passed in 4.88s
```

Pinned release assets after fix round 1:

- `assets/index-CZipnc6C.js`
- `assets/index-CTypHnDj.css`
- reviewed release fingerprint: `400c75d675f03b1db53a2cdcb2484a1045f3c7f6e87625bd630c9ebdd84c3c34`

Fresh rendered evidence:

- `C:/dev/public/portfolio-site/.worktrees/site-design-upgrade-20260828/.superpowers/sdd/2026-08-28-site-design-upgrade/visuals/home-fix1-1440.png`
- `C:/dev/public/portfolio-site/.worktrees/site-design-upgrade-20260828/.superpowers/sdd/2026-08-28-site-design-upgrade/visuals/home-fix1-390.png`
- `C:/dev/public/portfolio-site/.worktrees/site-design-upgrade-20260828/.superpowers/sdd/2026-08-28-site-design-upgrade/visuals/home-fix1-390-no-js.png`
- `C:/dev/public/portfolio-site/.worktrees/site-design-upgrade-20260828/.superpowers/sdd/2026-08-28-site-design-upgrade/visuals/home-fix1-390-forced-colors.png`

Rendered checks passed:

- no visible horizontal overflow at 390px or 1440px;
- `.hero::before` and `.hero::after` computed `content: none` and `background-image: none`;
- hero copy was rendered bright in actual screenshots, with sampled title/line luminance above the threshold;
- identity artwork rendered as `object-fit: contain`, 505x284 desktop and 351x197 mobile, not a tall middle-letter crop;
- no-JS fallback, reduced motion, and forced colors were checked.

Fix-round scope notes:

- No `home/package-lock.json` changes were made in this round.
- No `sitemap.xml` changes were made in this round.
- No live deployment, push, merge, subagent, or external review action was performed.
