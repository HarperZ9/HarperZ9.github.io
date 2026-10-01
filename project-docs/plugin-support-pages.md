# Plugin support, privacy and terms pages

`plugins/` holds a support page, a privacy policy page and a terms page for each
flagship plugin, plus `plugins/index.html` and the machine-readable
`plugins/plugins.json`. Directory listings (Anthropic plugin directory, OpenAI
plugin directory) link to these URLs.

## Where the text comes from

Every sentence on these pages comes from a file in the tool's own repository:

| Page | Source file |
| --- | --- |
| Privacy | `client-plugin/PRIVACY.md` (Articulate: `PRIVACY.md` at `plugin-v0.6.0`) |
| Support | `client-plugin/README.md` lead, "Try it" prompts and runtime line; issue tracker; `SECURITY.md` when present |
| Terms | `LICENSE` sections quoted verbatim, plus the privacy file's own sentences about the publisher service and telemetry |

The repository and pinned commit for each tool are in `plugins/data/plugins.json`.
Snapshots of the source files sit in `plugins/data/<tool>/`, and
`plugins/data/sources.lock.json` records each file's SHA-256 (LF-normalized).

The terms page says a tool has no separate terms-of-service document because none
exists in any of the eleven repositories; the license is the terms. Learn's license
has an integrity clause that contains an em dash, so the page summarizes that clause
in one sentence and links to the license instead of quoting it.

## Commands

```sh
python tools/build_plugin_support_pages.py            # render from snapshots
python tools/build_plugin_support_pages.py --check    # fail on stale pages or drifted snapshots
python tools/build_plugin_support_pages.py --refresh  # download snapshots at the pinned commits
```

To update after a tool changes its privacy file or README: move the tool's `ref` in
`plugins/data/plugins.json` to the new commit, run `--refresh`, review the diff of
`plugins/data/`, then commit the snapshots, lock and rendered pages together.
`tests/test_plugin_support_pages.py` runs `--check` and fails on drift.

## Icons

`plugins/icons/` holds a square icon for each plugin, shown in the hub table and in
an "Icon" section on each support page. `plugins/plugins.json` gives the SVG and
512 px PNG URLs.

- One family: the site's void ground, a hairline aperture ring, fine bone
  line-work, and one incandescent core as the single hot mark. The motif inside the
  ring tells the tools apart (`tools/plugin_icon_art.py`). Telos is the eye: the iris
  corona stands for its senses, three nested lids for its permission tiers, and the
  lashes for actuation.
- Three detail tiers keep the line-work legible: `<tool>.svg` (full, for 512 and
  1024 px), `<tool>-mid.svg` (128 and 256), `<tool>-small.svg` (48 and 64). Each
  tool also has a transparent composer glyph, `<tool>-glyph.svg` (ink, light UI) and
  `<tool>-glyph-dark.svg` (bone, dark UI), exported at 128 px.
- Size rules read from the directory docs on 2026-10-01. OpenAI plugins: `logo` and
  `composerIcon` (optional `logoDark`, `composerIconDark`), square, at least 48 by 48,
  at most 4096 px, PNG, JPEG, WebP or SVG, at most 5 MiB; an SVG needs a square
  viewBox of at least 48. Anthropic: a connector listing takes a square 1:1 icon with
  no stated pixel size; `plugin.json` has no icon field, and images in a plugin
  folder must be complete PNG, JPEG, GIF or WebP files, or SVG, under 5 MiB each.

The SVGs are rendered by `build_plugin_support_pages.py` with the pages, so
`--check` covers them. PNGs need Chromium:

```sh
pip install playwright && playwright install chromium
python tools/render_plugin_icons.py                       # PNGs + plugins/icons/icons.json
python tools/render_plugin_icons.py --sheet sheet.png     # plus a contact sheet to review
```

`icons.json` pins each PNG to the SHA-256 of its SVG. `tests/test_plugin_icons.py`
fails when an SVG changes without a re-render, when a PNG has the wrong size, or when
a page links an icon file that does not exist. Look at every rendered size before
committing; a passing test does not judge how an icon looks.

## Limits

- GitHub Pages serves static files. It hosts these pages, manifests and docs. It
  cannot run an HTTPS MCP server.
- The pages reproduce what each privacy file says. A grep of each repository's
  non-test source for telemetry SDKs and publisher-hosted endpoints found none on
  2026-10-01; that check does not prove the absence of every network path.
