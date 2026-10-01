"""Write the redirect pages that keep retired reading addresses working.

GitHub Pages has no server redirects, so each retired address keeps a small page: it
tells search engines not to index it, names its replacement as canonical, sends a reader
on with a meta refresh, and lists every target as a plain link so nothing depends on the
script. writing.html also carries a fragment map, because a meta refresh drops the part
after "#": an old link to writing.html#verified must land on the essay's own page.

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

# writing.html anchors and where each one now lives. The sixteen generated anchors were
# the piece ids; the two inline essays moved onto pages of their own on 1 October 2026.
WRITING_FRAGMENTS = {
    "verified": "verified-is-not-trustworthy.html",
    "conferred": "conferred-existence-essay.html",
    **{
        slug: f"{slug}.html"
        for slug in (
            "who-pays-the-referees", "who-knew-first", "the-number-has-a-vintage",
            "what-the-formula-counts", "the-timestamp-is-not-the-order",
            "the-scene-the-song-did-not-tell-you", "support-has-more-than-one-record",
            "what-the-label-changes", "the-second-hearing", "the-sandbox-was-never-just-a-box",
            "ltj-bukem-the-man-behind-the-atmosphere", "borrowed-ground", "checking-the-machines",
            "a-witness-should-not-become-a-ruler", "growth-needs-a-before", "availability-is-not-reach",
        )
    },
}

STUBS = {
    "writing.html": {
        "target": "publications.html",
        "note": "The writing index moved. Every essay, investigation, briefing and paper is now listed on one page.",
        "fragments": WRITING_FRAGMENTS,
    },
    "writing/index.html": {
        "target": "/publications.html",
        "note": "This folder holds the plain-text sources of some essays. The essays themselves are listed on the Writing page.",
        "fragments": {},
    },
    "publications/index.html": {
        "target": "/publications.html",
        "note": "This folder holds the machine records behind the essays. The essays themselves are listed on the Writing page.",
        "fragments": {},
    },
    "papers/index.html": {
        "target": "/publications.html#research",
        "note": "The papers in this folder are listed, with their research notes, on the Writing page.",
        "fragments": {},
    },
}

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
        script = f'<script>location.replace("{target}");</script>\n'
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Moved to the Writing page · Zain Dana Harper</title>
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
<p><a href="{html.escape(target)}">Open the Writing page</a></p>
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
