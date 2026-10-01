"""Reading has one home: every piece sits in one Writing section, two clicks from home.

Contracts for the 1 October 2026 information-architecture change: the Writing hub's
sections, the Who Knew First series hub, the redirect pages that keep retired addresses
working, the back-link line on each piece, and the sitemap and canonical links.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from collections import deque
from html import unescape
from pathlib import Path
from urllib.parse import urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://harperz9.github.io/"
SECTIONS = json.loads((ROOT / "publications/data/sections.json").read_text(encoding="utf-8"))
SERIES = json.loads((ROOT / "publications/data/series/who-knew-first.json").read_text(encoding="utf-8"))
INDEX = json.loads((ROOT / "publications/data/index.json").read_text(encoding="utf-8"))

# The hub text of PUBLICATION-PLAN section 5, which the series hub carries verbatim.
PLAN_INTRO = (
    "Who Knew First is a record of nine 2026 incidents in which an AI agent crossed a boundary. "
    "It argues one thing: whoever holds an incident's logs gets to name it, and the name decides "
    "how fast anyone else hears about it. The pieces below each test one question that argument "
    "raises. They stand alone, and each says how it connects."
)
PLAN_CLOSING = (
    "Every piece lists its sources, the confidence of each claim, what each claim does not prove "
    "and the threads still open for anyone to pick up. An Anthropic-built model helped compile all "
    "of them, and Anthropic appears in the record, so the pieces name where Anthropic is a party "
    "and invite an outside check of those items."
)
OLD_WRITING_ANCHORS = {
    "verified", "conferred", "who-pays-the-referees", "who-knew-first", "the-number-has-a-vintage",
    "what-the-formula-counts", "the-timestamp-is-not-the-order", "the-scene-the-song-did-not-tell-you",
    "support-has-more-than-one-record", "what-the-label-changes", "the-second-hearing",
    "the-sandbox-was-never-just-a-box", "ltj-bukem-the-man-behind-the-atmosphere", "borrowed-ground",
    "checking-the-machines", "a-witness-should-not-become-a-ruler", "growth-needs-a-before",
    "availability-is-not-reach",
}
STUBS = ("writing.html", "writing/index.html", "publications/index.html", "papers/index.html")


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def text(value: str) -> str:
    return " ".join(unescape(re.sub(r"<[^>]+>", " ", value)).split())


def generated_hub() -> str:
    page = read("publications.html")
    return page.split("<!-- BEGIN GENERATED EDITORIAL PUBLICATIONS -->", 1)[1].split("<!-- END", 1)[0]


def piece_routes() -> list[str]:
    """Every reading page: records, listings, notes, papers, editions and the series hub."""
    routes = [item["route"].lstrip("/") for item in INDEX["records"] + INDEX["listings"]]
    routes += [path.name for path in ROOT.glob("research-*.html")]
    routes += [path.relative_to(ROOT).as_posix() for path in (ROOT / "papers").glob("*.pdf")]
    routes += [path.relative_to(ROOT).as_posix() for path in (ROOT / "frontier-safety/archive").glob("*.html")]
    routes += [path.relative_to(ROOT).as_posix() for path in (ROOT / "frontier-safety/conclusions").glob("*.html")]
    routes.append(SERIES["route"])
    return sorted(set(routes))


def test_every_piece_sits_in_exactly_one_writing_section() -> None:
    hub = generated_hub()
    blocks = dict(re.findall(r'<section class="mv publication-section" id="([a-z]+)".*?>(.*?)</section>', hub, re.S))
    assert list(blocks) == ["series", "essays", "atlas", "briefings", "research"]
    for route in piece_routes():
        if route == SERIES["route"]:
            continue
        holders = [name for name, block in blocks.items() if f'href="{route}"' in block or f'href="/{route}"' in block]
        assert len(holders) == 1, f"{route} is listed in {holders}"
        # And once inside that section, apart from a related sub-line.
        block = blocks[holders[0]]
        assert block.count(f'href="{route}"') + block.count(f'href="/{route}"') == 1, route


def test_each_piece_carries_the_kind_word_from_sections_json() -> None:
    kinds = {member["id"]: member["kind"] for section in SECTIONS["sections"] for member in section["members"]}
    allowed = {"Investigation", "Series piece", "Essay", "Open letter", "Atlas essay", "Dossier",
               "Briefing", "Research corpus", "Visual sequence"}
    assert set(kinds.values()) <= allowed
    rows = re.findall(r'<article data-publication-entry[^>]*><p class="publication-meta">([^·<]+) ·.*?<h3><a href="([^"]+)"',
                      generated_hub())
    by_route = {item["route"]: item["id"] for item in INDEX["records"] + INDEX["listings"]}
    for kind, route in rows:
        assert kind.strip() == kinds[by_route[route]], route


def test_series_hub_carries_the_plan_text_and_links_only_published_parts() -> None:
    assert SERIES["intro"] == PLAN_INTRO
    assert SERIES["closing"] == PLAN_CLOSING
    page = read(SERIES["route"])
    body = text(page)
    assert PLAN_INTRO in body
    assert PLAN_CLOSING in body
    parts = re.findall(r"<li value=\"\d\">(.*?)</li>", page, re.S)
    assert len(parts) == 5
    for part, definition in zip(parts, SERIES["parts"]):
        assert definition["title"] in text(part)
        if definition["id"]:
            assert f'href="{definition["id"]}.html"' in part
            assert "Published" in text(part)
        else:
            assert "href=" not in part
            assert "Planned" in text(part)
    for hash_shape in (r"\b[0-9a-f]{40,64}\b", r"sha256"):
        assert not re.search(hash_shape, page), "no hashes on a reader surface"


def test_series_parts_match_the_aside_on_the_published_piece() -> None:
    """The hub and the aside on Who Pays the Referees name the same five questions."""
    aside = re.search(r'<aside class="wpr-series".*?</aside>', read("who-pays-the-referees.html"), re.S).group(0)
    items = re.findall(r"<li[^>]*><strong>(.*?)\.</strong> <span class=\"wpr-label\">[^<]*</span> (.*?)</li>", aside)
    assert [(title, question) for title, question in items] == [
        (part["title"], part["question"]) for part in SERIES["parts"]
    ]
    assert 'href="who-knew-first-series.html"' in aside


def test_redirect_stubs_cover_every_old_anchor_and_match_their_generator() -> None:
    result = subprocess.run([sys.executable, "tools/redirect_stubs.py", "--check"], cwd=ROOT,
                            capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    stub = read("writing.html")
    mapping = json.loads(re.search(r"var map=(\{.*?\});", stub).group(1))
    assert set(mapping) == OLD_WRITING_ANCHORS
    for anchor, target in mapping.items():
        assert (ROOT / target).is_file(), f"writing.html#{anchor} points at a missing page"
        assert f'href="{target}"' in stub, f"no-script reader cannot reach {target}"
    for path in STUBS:
        source = read(path)
        assert '<meta name="robots" content="noindex,follow">' in source, path
        assert '<link rel="canonical" href="https://harperz9.github.io/publications.html">' in source, path
        assert '<meta http-equiv="refresh"' in source, path


def test_lifted_essays_keep_the_text_of_their_old_anchors() -> None:
    old = subprocess.run(["git", "show", "d64c7ed:writing.html"], cwd=ROOT, capture_output=True,
                         text=True, encoding="utf-8")
    if old.returncode != 0:
        return  # a shallow checkout lacks the old page; the pinned phrases below still hold
    for anchor, page in (("verified", "verified-is-not-trustworthy.html"), ("conferred", "conferred-existence-essay.html")):
        source = re.search(rf'<article class="sheet essay" id="{anchor}">(.*?)</article>', old.stdout, re.S).group(1)
        paragraphs = [text(p) for p in re.findall(r"<p>(.*?)</p>", source, re.S)]
        new = text(read(page))
        for paragraph in paragraphs:
            assert paragraph in new, f"{page} lost a paragraph: {paragraph[:60]}"


def test_sitemap_lists_every_piece_once_and_no_redirect_page() -> None:
    sitemap = read("sitemap.xml")
    locs = re.findall(r"<loc>(.*?)</loc>", sitemap)
    assert len(locs) == len(set(locs)), "a sitemap entry repeats"
    for route in piece_routes():
        if route.endswith(".pdf"):
            continue  # a PDF is a file, not a page; the hub lists every one
        assert SITE + route in locs, f"{route} is missing from the sitemap"
    for stub in STUBS:
        assert SITE + stub not in locs and SITE + stub.replace("index.html", "") not in locs, stub


def test_every_piece_page_names_its_own_address_as_canonical() -> None:
    for route in piece_routes():
        if route.endswith(".pdf"):
            continue
        path = ROOT / route
        if path.is_dir() or route.endswith("/"):
            path = ROOT / route / "index.html"
        source = path.read_text(encoding="utf-8")
        canonical = re.search(r'<link\s+rel="canonical"\s+href="([^"]+)"', source)
        assert canonical, f"{route} has no canonical link"
        assert canonical.group(1) == SITE + route, route


def test_every_piece_links_back_to_its_section() -> None:
    frozen = ("frontier-safety/archive/", "frontier-safety/conclusions/")
    for route in piece_routes():
        if route.endswith(".pdf") or route.startswith(frozen) or route.startswith("briefings/"):
            continue  # frozen editions and the hashed dossier reach the hub through the menu crumb
        path = ROOT / route
        source = path.read_text(encoding="utf-8")
        docnav = re.search(r'<(?:nav|div) class="docnav"[^>]*>(.*?)</(?:nav|div)>', source, re.S)
        assert docnav, f"{route} has no back-link line"
        assert 'href="publications.html' in docnav.group(1), f"{route} does not link back to Writing"


def _routes_module() -> tuple[list[str], list[str]]:
    source = read("system/routes.js")
    registry = json.loads(json.loads(re.search(r'ROUTE_REGISTRY_JSON = ("(?:[^"\\]|\\.)*");', source).group(1)))
    primary = [route["href"] for family in registry["families"] for route in family["routes"] if route.get("primary")]
    writing = [item["href"] for item in json.loads(re.search(r"WRITING_SECTIONS = (\[.*?\]);", source).group(1))]
    return primary, writing


def _links(route: str, menu: list[str]) -> set[str]:
    path = ROOT / route
    if not path.is_file() or path.suffix != ".html":
        return set()
    source = path.read_text(encoding="utf-8")
    hrefs = set(re.findall(r'href="([^"]+)"', source))
    if "system/nav.js" in source:
        hrefs |= set(menu)
    out = set()
    for href in hrefs:
        if href.startswith(("http", "mailto:", "#", "javascript:")):
            continue
        target = urlsplit(urljoin(SITE + route, href)).path.lstrip("/")
        if target.endswith("/"):
            target += "index.html"
        out.add(target)
    return out


def test_every_piece_is_two_clicks_from_home() -> None:
    """Breadth-first over static links. Home's edges are its no-script links, the links the
    home app renders (href literals in home/src) and the site menu every page mounts."""
    primary, writing = _routes_module()
    menu = [*primary, *writing, "site-index.html"]
    home = _links("index.html", menu) | set(menu)
    for source in (ROOT / "home" / "src").glob("*.ts*"):
        home |= {href.lstrip("/") for href in re.findall(r'"(/[a-z0-9-]+\.html)', source.read_text(encoding="utf-8"))}
    depth = {"index.html": 0}
    queue = deque()
    for target in home:
        depth.setdefault(target.split("#")[0], 1)
        queue.append(target.split("#")[0])
    while queue:
        route = queue.popleft()
        if depth[route] >= 2:
            continue
        for target in _links(route, menu):
            target = target.split("#")[0]
            if target not in depth:
                depth[target] = depth[route] + 1
                queue.append(target)
    normalized = {key.replace("/index.html", "/"): value for key, value in depth.items()}
    far = [route for route in piece_routes() if normalized.get(route, depth.get(route, 99)) > 2]
    assert not far, f"more than two clicks from home: {far}"
