#!/usr/bin/env python3
"""Apply Wave 16A 611 -> 42 HTML unification cleanly and deterministically.

1. Verifies every legacy HTML file is harvested in assets/data/unified/legacy_route_map.json.
2. Removes the 576 redundant legacy HTML files (leaving exact 42 tracked HTML files).
3. Updates site-src/world/addresses.json so every retired URL has kind="moved" -> unified #slug.
4. Rewrites internal links in all kept site HTML pages, system/routes.js, discover.json, and sitemap.xml.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from harvest_unified_content import KEEP_HTML  # noqa: E402

ROUTE_MAP_PATH = ROOT / "assets" / "data" / "unified" / "legacy_route_map.json"
ADDRESSES_PATH = ROOT / "site-src" / "world" / "addresses.json"
DISCOVER_PATH = ROOT / "discover.json"
SITEMAP_PATH = ROOT / "sitemap.xml"

SEALED_HTML = {
    "media/low-water/world-cac3416/walk/index.html",
    "media/low-water/world-cac3416/walk/flora/atlas.html",
    "media/raw-native/tree-ada041f/web/motion/capture.html",
    "media/raw-native/tree-c6b114d/web/motion/capture.html",
    "media/raw-native/viewer-0.8.0/web/viewer/index.html",
    "media/raw-native/web-23ec93f/motion/capture.html",
}

LIVE_SURFACE_META = {
    "/models.html": ("surface", "flywheel"),
    "/demos.html": ("surface", "articulate"),
    "/media/": ("surface", "playground"),
    "/tools.html": ("surface", "flywheel"),
    "/world/": ("surface", "playground"),
    "/studies/": ("surface", "research"),
    "/findings/": ("surface", "research"),
    "/essays.html": ("surface", "research"),
    "/frontier-safety/": ("surface", "research"),
}

UNIFIED_LATE_PARTS = {
    "/world/": ["assets/data/unified/world_atlas.json"],
    "/studies/": ["assets/data/unified/studies_findings.json"],
    "/findings/": ["assets/data/unified/studies_findings.json"],
    "/essays.html": ["assets/data/unified/essays_writings.json"],
    "/frontier-safety/": ["assets/data/unified/essays_writings.json"],
    "/media/": ["assets/data/unified/media_figures.json"],
    "/demos.html": ["assets/data/unified/tools_plugins_demos.json"],
    "/tools.html": ["assets/data/unified/tools_plugins_demos.json", "assets/data/unified/all_public_repos_catalog.json"],
}


def addr_of(rel: str) -> str:
    if rel == "index.html":
        return "/"
    if rel.endswith("/index.html"):
        return "/" + rel[: -len("index.html")]
    return "/" + rel


def remove_legacy_html(routes: dict[str, str]) -> int:
    tracked = sorted(
        subprocess.check_output(
            ["git", "-C", str(ROOT), "ls-files", "*.html"], text=True
        ).splitlines()
    )
    to_remove = [f for f in tracked if f not in KEEP_HTML]
    missing = [f for f in to_remove if ("/" + f) not in routes]
    if missing:
        raise RuntimeError(f"Unmapped legacy HTML files found: {missing[:5]}")
    for rel in to_remove:
        fp = ROOT / rel
        if fp.exists():
            fp.unlink()
    return len(to_remove)


def update_addresses(routes: dict[str, str]) -> tuple[int, int]:
    ledger = json.loads(ADDRESSES_PATH.read_text(encoding="utf-8"))
    live_addrs = {addr_of(f) for f in KEEP_HTML if f != "404.html"}
    kept_rows = []
    seen = set()
    moved_count = 0

    for row in ledger["rows"]:
        p = row["path"]
        if p in seen:
            continue
        # Old fragment rows whose parent page moved cannot stay as live rows; parent handles them
        if "#" in p and p.split("#")[0] not in live_addrs:
            continue
        if p == "/tools/":
            kept_rows.append({"path": "/tools/", "kind": "moved", "surface": "flywheel", "to": "/tools.html", "moved": "2026-11-26", "since": row.get("since", "2026-11-26")})
            seen.add(p)
            moved_count += 1
            continue
        seen.add(p)
        if p in live_addrs:
            if p in LIVE_SURFACE_META:
                kind, surf = LIVE_SURFACE_META[p]
                kept_rows.append({"path": p, "kind": kind, "surface": surf, "since": row.get("since", "2026-11-26")})
            elif row.get("kind") in ("moved", "redirect", "gone"):
                kept_rows.append({"path": p, "kind": "leaf", "surface": row.get("surface", "unassigned"), "since": row.get("since", "2026-11-26")})
            else:
                kept_rows.append(row)
        else:
            target = routes.get(p) or routes.get(p + "index.html")
            if target:
                target = target.replace("/tools/#", "/tools.html#").replace("/demos.html#crucible-cleanroom", "/demos.html#crucible")
                new_row = {
                    "path": p,
                    "kind": "moved",
                    "surface": row.get("surface", "unassigned"),
                    "to": target,
                    "moved": "2026-11-26",
                    "since": row.get("since", "2026-11-26"),
                }
                kept_rows.append(new_row)
                moved_count += 1
            elif row.get("kind") in ("moved", "redirect"):
                to = row.get("to", "/").replace("/tools/#", "/tools.html#").replace("/demos.html#crucible-cleanroom", "/demos.html#crucible")
                base_to = to.split("#")[0].split("?")[0]
                if base_to in routes:
                    to = routes[base_to].replace("/tools/#", "/tools.html#").replace("/demos.html#crucible-cleanroom", "/demos.html#crucible")
                elif base_to not in live_addrs and not any(to.startswith(ps) for ps in ledger.get("projectSites", [])):
                    to = "/"
                new_row = {
                    "path": p,
                    "kind": "moved",
                    "surface": row.get("surface", "unassigned"),
                    "to": to,
                    "moved": row.get("moved", "2026-11-26"),
                    "since": row.get("since", "2026-11-26"),
                }
                kept_rows.append(new_row)
                moved_count += 1
            else:
                kept_rows.append(row)

    # Ensure every live kept page has a row
    for p in sorted(live_addrs):
        if p not in seen:
            kind, surf = LIVE_SURFACE_META.get(p, ("leaf", "unassigned"))
            kept_rows.append({"path": p, "kind": kind, "surface": surf, "since": "2026-11-26"})
            seen.add(p)

    # Ensure every retired route has a moved row (skip excluded tools/ directory paths)
    for old_p, target in sorted(routes.items()):
        if old_p in live_addrs or old_p in seen or old_p.endswith("/index.html") or old_p.startswith("/tools/"):
            continue
        kept_rows.append({
            "path": old_p,
            "kind": "moved",
            "surface": "unassigned",
            "to": target.replace("/tools/#", "/tools.html#"),
            "moved": "2026-11-26",
            "since": "2026-11-26",
        })
        seen.add(old_p)
        moved_count += 1

    # Also ensure /tools/ redirects to /tools.html
    if "/tools/" not in seen:
        kept_rows.append({"path": "/tools/", "kind": "moved", "surface": "flywheel", "to": "/tools.html", "moved": "2026-11-26", "since": "2026-11-26"})

    ledger["lateParts"] = UNIFIED_LATE_PARTS
    ledger["rows"] = kept_rows
    ADDRESSES_PATH.write_text(json.dumps(ledger, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    return len(kept_rows), moved_count


def rewrite_kept_html_links(routes: dict[str, str]) -> int:
    # Build lookup including relative forms and directory forms
    lookup: dict[str, str] = {}
    for k, v in routes.items():
        lookup[k] = v
        lookup[k.lstrip("/")] = v
        if k.endswith("/index.html"):
            d = k[: -len("index.html")]
            lookup[d] = v
            lookup[d.lstrip("/")] = v
            lookup[d.rstrip("/")] = v
            lookup[d.strip("/")] = v

    rewrites = 0
    for rel in sorted(KEEP_HTML - SEALED_HTML - {"404.html"}):
        fp = ROOT / rel
        if not fp.exists():
            continue
        orig = fp.read_text(encoding="utf-8", errors="replace")
        txt = orig.replace("/tools/#", "/tools.html#").replace('href="/tools/"', 'href="/tools.html"').replace('href="tools/"', 'href="tools.html"')
        parent = "/" + str(Path(rel).parent).replace("\\", "/")
        if parent == "/.":
            parent = "/"
        elif not parent.endswith("/"):
            parent += "/"

        def repl(m: re.Match[str]) -> str:
            nonlocal rewrites
            attr, q, href = m.group(1), m.group(2), m.group(3)
            if href.startswith(("http://", "https://", "mailto:", "#", "javascript:", "data:", "tel:")):
                return m.group(0)
            base = href.split("#")[0].split("?")[0]
            if not base:
                return m.group(0)
            if base.startswith("/"):
                cand = base
            else:
                cand = os.path.normpath(parent + base).replace("\\", "/")
                if not cand.startswith("/"):
                    cand = "/" + cand
            target = lookup.get(cand) or lookup.get(cand + "/") or lookup.get(base)
            if target and target != cand:
                rewrites += 1
                return f"{attr}={q}{target.replace('/tools/#', '/tools.html#')}{q}"
            return m.group(0)

        new_txt = re.sub(r'(href)=(["\'])([^"\']+)\2', repl, txt)
        if new_txt != orig:
            fp.write_text(new_txt, encoding="utf-8")

    # Also rewrite internal links inside served .htm partials
    for htm in ("system/retro-panel.htm", "site-src/world/raw-certificate.htm"):
        fp = ROOT / htm
        if not fp.exists():
            continue
        txt = fp.read_text(encoding="utf-8", errors="replace")
        def htm_repl(m: re.Match[str]) -> str:
            nonlocal rewrites
            h = m.group(1)
            t = lookup.get(h) or lookup.get(h + "/")
            if t:
                rewrites += 1
                return f'href="{t.replace("/tools/#", "/tools.html#")}"'
            return m.group(0)
        new_txt = re.sub(r'href="(/[^"#?]+)"', htm_repl, txt)
        if new_txt != txt:
            fp.write_text(new_txt, encoding="utf-8")
    return rewrites


def update_discover_and_sitemap(routes: dict[str, str]) -> int:
    disc = json.loads(DISCOVER_PATH.read_text(encoding="utf-8"))
    for tool in disc.get("tools", []):
        pg = tool.get("page")
        if pg and pg not in KEEP_HTML:
            mapped = routes.get("/" + pg, "")
            if mapped and "#" not in mapped and "?" not in mapped:
                tool["page"] = mapped.lstrip("/")
            else:
                tool.pop("page", None)
    # Exclude unified generated hubs that use dynamic JS or sealed frames from strict static-only rules if needed
    DISCOVER_PATH.write_text(json.dumps(disc, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")

    # Regenerate clean sitemap.xml containing only our 35 indexable flagship pages
    urls = []
    for rel in sorted(KEEP_HTML - SEALED_HTML - {"404.html"}):
        loc = "https://harperz9.github.io/" + ("" if rel == "index.html" else rel.replace("index.html", ""))
        urls.append(f"  <url><loc>{loc}</loc><lastmod>2026-11-26</lastmod></url>")
    sm = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    SITEMAP_PATH.write_text(sm, encoding="utf-8")
    return len(urls)


def main() -> int:
    rmap = json.loads(ROUTE_MAP_PATH.read_text(encoding="utf-8"))
    routes: dict[str, str] = rmap["routes"]
    removed = remove_legacy_html(routes)
    rows, moved = update_addresses(routes)
    rewrites = rewrite_kept_html_links(routes)
    sm_count = update_discover_and_sitemap(routes)
    on_disk = sorted(p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*.html") if ".git" not in p.parts and "node_modules" not in p.parts)
    print(f"REMOVED_LEGACY_HTML={removed}")
    print(f"REMAINING_HTML_ON_DISK={len(on_disk)}")
    print(f"ADDRESSES_ROWS={rows} MOVED={moved}")
    print(f"INTERNAL_LINKS_REWRITTEN={rewrites}")
    print(f"SITEMAP_URLS={sm_count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
