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

## Limits

- GitHub Pages serves static files. It hosts these pages, manifests and docs. It
  cannot run an HTTPS MCP server.
- The pages reproduce what each privacy file says. A grep of each repository's
  non-test source for telemetry SDKs and publisher-hosted endpoints found none on
  2026-10-01; that check does not prove the absence of every network path.
