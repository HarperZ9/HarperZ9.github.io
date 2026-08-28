# Task 2 report: route headers and shared navigation

Date: 2026-08-28

Branch: `codex/site-design-upgrade-20260828`

Scope owned by this task:

- `system/nav.js`
- `system/nav.test.mjs`
- `system/nav.css`
- `system/system.css`
- `system/doc.css`
- `tests/test_zentropy_sitewide_contract.py`
- `tests/test_page_metadata.py`
- this report

## Result

The committed Task 2 implementation replaces the old route-art poster injection with a structural route header enhancement:

- existing page opening containers are enhanced in place;
- existing `h1` elements are reused and not cloned;
- route headers get a sentence-case breadcrumb, existing title, and existing summary copy;
- no route-header kicker, eyebrow, overline, scanline, stripe, route-art pseudo-label, or automatic OG-image poster is generated;
- the shared home label is `Zentropy Labs`;
- the shared home accessible label no longer names the site as Project Telos;
- route-art CSS was removed from the shared route-header surfaces.

One additional follow-up fix is included after the Task 2 commit: local preview routes served extensionlessly by `npx serve` now canonicalize back to their `.html` route records, so current-page state remains correct for `/catalog`, `/retro`, and `/hire#engineering-path`.

## Red checks recorded

The first test pass intentionally failed before implementation.

Command:

```powershell
python -m pytest tests/test_zentropy_sitewide_contract.py tests/test_page_metadata.py -q
```

Expected failures:

- `mountRouteArt` was still present in `system/nav.js`;
- `.route-header` and `.route-header__path` were not yet present in shared CSS;
- forced-colors route-header border coverage was missing.

Command:

```powershell
node --test system/nav.test.mjs
```

Expected failure:

- `system/nav.js` did not export `buildRouteHeader`.

## Green checks recorded

After the route-header implementation:

```powershell
python -m pytest tests/test_zentropy_sitewide_contract.py tests/test_page_metadata.py -q
```

Result:

```text
22 passed in 6.74s
```

```powershell
node --test system/nav.test.mjs
```

Result:

```text
11 passed
```

```powershell
git diff --check
```

Result: clean.

No additional long test or browser command was run while finalizing this report, per parent-session instruction.

## Browser inspection evidence

Local server used:

```powershell
npx serve -l 8765 .
```

Inspected pages:

- `catalog.html`
- `publications.html`
- `retro.html`
- `hire.html#engineering-path`

Widths:

- 390 px
- 1440 px

Recorded browser facts after the local-preview route fix:

- each inspected page had exactly one `h1`;
- each inspected page had exactly one `.route-header`;
- no inspected page had `.route-art`;
- current-page navigation state resolved correctly for each inspected route;
- no horizontal overflow was detected.

Screenshot artifacts:

- `.superpowers/sdd/2026-08-28-site-design-upgrade/screenshots-task-2/catalog-html-390.png`
- `.superpowers/sdd/2026-08-28-site-design-upgrade/screenshots-task-2/catalog-html-1440.png`
- `.superpowers/sdd/2026-08-28-site-design-upgrade/screenshots-task-2/publications-html-390.png`
- `.superpowers/sdd/2026-08-28-site-design-upgrade/screenshots-task-2/publications-html-1440.png`
- `.superpowers/sdd/2026-08-28-site-design-upgrade/screenshots-task-2/retro-html-390.png`
- `.superpowers/sdd/2026-08-28-site-design-upgrade/screenshots-task-2/retro-html-1440.png`
- `.superpowers/sdd/2026-08-28-site-design-upgrade/screenshots-task-2/hire-html-engineering-path-390.png`
- `.superpowers/sdd/2026-08-28-site-design-upgrade/screenshots-task-2/hire-html-engineering-path-1440.png`

## Limitations and follow-up

- The last screenshot review surfaced one remaining eyebrow-like detail: on mobile, the shared nav still exposes the current section label under the logo as uppercase metadata (`SECURITY`, `STUDIO`, or `WORK`). This is outside the route-header replacement itself, but it conflicts with the later "less eyebrows" direction and should be removed or changed to non-metadata copy in the next pass.
- `publications.html` still has a tall opening block because of existing page copy density. Task 2 did not rewrite route content.
- Homepage work was intentionally not completed in this task. The homepage belongs to the next architecture and visual-system pass.
