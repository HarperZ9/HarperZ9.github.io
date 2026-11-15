"""Write the redirect pages that still stand at a retired address.

Since 15 November 2026 a retired address has no file: its row in site-src/world/addresses.json
has kind "moved" and 404.html sends the reader on. The writing index, its three folders, the
two retired brand canvases, the toolkit, the product list and the start page went that way,
and the fragment map writing.html carried is now "places" on its row.

Four pages stay here until the pages that link to them are folded: demonstrations.html (the
Demonstrations fold), tour.html and typeface.html (The Playground's rooms), and
work-with-me.html (the map's pages name it).

    python tools/redirect_stubs.py          # write the stubs
    python tools/redirect_stubs.py --check  # fail if any stub differs from this source
"""
from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE_URL = "https://harperz9.github.io/"

STUBS: dict[str, dict] = {}

# Consolidation of 2 November 2026 (the author: "I think that the non-destructive rules should start being favored
# less than consolidation and reintegration."). The list pages fold into the one index of the work on floor.html;
# the type pages into the Accession page; the second contact page into Work. Git history keeps every retired page.
_INDEX = "The site's list pages are now one index of all the work, current and past, by platform."
for _page, _target in {
    "demonstrations.html": "/floor.html",
    "tour.html": "/floor.html",
}.items():
    STUBS[_page] = {"target": _target, "note": _INDEX, "title": "Moved to the index of the work", "link": "Open the index", "fragments": {}, "keep_hash": "#" not in _target}
for _page in ("typeface.html",):
    STUBS[_page] = {"target": "/accession.html", "note": "The site's type now lives on one page: Accession and the faces the site draws on.", "title": "Moved to the Accession page", "link": "Open the Accession page", "fragments": {}}
STUBS["work-with-me.html"] = {"target": "/hire.html", "note": "Working with me is now on the Work page.", "title": "Moved to the Work page", "link": "Open the Work page", "fragments": {}, "keep_hash": True}

LABELS = {
    "verified-is-not-trustworthy.html": "Verified Is Not Trustworthy",
    "conferred-existence-essay.html": "Conferred Existence",
}


def _label(path: str) -> str:
    """The piece's own title, read from its record or listing."""
    if path in LABELS:
        return LABELS[path]
    slug = path.removesuffix(".html")
    for folder in ("records", "listings"):
        source = ROOT / "publications" / "data" / folder / f"{slug}.json"
        if source.is_file():
            return json.loads(source.read_text(encoding="utf-8"))["title"]
    raise SystemExit(f"no record or listing names {path}")


def render_stub(path: str, spec: dict) -> str:
    target = spec["target"]
    canonical = SITE_URL + target.lstrip("/").split("#")[0]
    prefix = "/" if "/" in path else ""
    fragments = {key: prefix + value for key, value in spec["fragments"].items()}
    script = ""
    links = ""
    if fragments:
        mapping = json.dumps(fragments, sort_keys=True)
        script = (
            "<script>(function(){var map=" + mapping + ";"
            "var key=decodeURIComponent(location.hash.slice(1));"
            f'location.replace(map[key]||"{target}");}})();</script>\n'
        )
        links = "<ul>" + "".join(
            f'<li><a href="{html.escape(href)}">{html.escape(_label(href.lstrip("/")))}</a></li>'
            for _key, href in sorted(fragments.items(), key=lambda pair: pair[1])
        ) + "</ul>\n"
    else:
        script = (f'<script>location.replace("{target}"+location.hash);</script>\n' if spec.get("keep_hash")
                  else f'<script>location.replace("{target}");</script>\n')
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(spec.get("title", "Moved to the Writing page"))} · Zain Dana Harper</title>
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="{canonical}">
{script}<meta http-equiv="refresh" content="0; url={html.escape(target)}">
<style>
:root{{color-scheme:dark;font-family:system-ui,sans-serif;background:#09080b;color:#f1eef4}}
body{{margin:0;min-height:100vh;display:grid;place-items:center;padding:2rem;box-sizing:border-box}}
main{{max-width:42rem}}a{{color:#a6e7e5}}li{{margin:.35rem 0}}
</style>
</head>
<body>
<main>
<p>{html.escape(spec["note"])}</p>
<p><a href="{html.escape(target)}">{html.escape(spec.get("link", "Open the Writing page"))}</a></p>
{links}</main>
</body>
</html>
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    drift = []
    for path, spec in STUBS.items():
        rendered = render_stub(path, spec)
        target = ROOT / path
        if args.check:
            if not target.is_file() or target.read_text(encoding="utf-8") != rendered:
                drift.append(path)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(rendered, encoding="utf-8", newline="\n")
    if drift:
        print("redirect stubs differ from tools/redirect_stubs.py: " + ", ".join(drift), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
