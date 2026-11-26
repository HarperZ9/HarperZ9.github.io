"""Every page in the sitemap shares as its own card.

On 4 October 2026, 44 pages shared one generic card (img/og/telos.png, set in a
retired face), 14 more shared a profile card, and 17 had none. A shared link to
an essay showed the wrong picture and an old tagline. These tests make that a
failing build: each page names a 1200 x 630 card that exists, that no other page
uses, whose URL carries the file's own content hash, and whose alt text names
the page.
"""

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://harperz9.github.io/"
PROTECTED = re.compile(r"elder|enb|skyrim", re.I)
# Scheduled briefings are written in CI, which cannot render a card; they borrow
# the section card until the next local render (tools/repo_art/site_cards.py FALLBACK).
BORROWS = re.compile(r"^frontier-safety/archive/")
# Held: the incident briefing is pinned by its own build receipt (a history file) and the
# career pages by the career release manifest, and the open letter by its build record
# (writing/checking-the-machines/build.json). Their cards already exist in img/og/p.
HELD = re.compile(r"^(briefings/2026-08-26-openai-hugging-face-incident/|(hire|resume|portfolio|cover-letter|cv|dossier|checking-the-machines)\.html$)")


def sitemap_pages() -> list[str]:
    locs = re.findall(r"<loc>([^<]+)</loc>", (ROOT / "sitemap.xml").read_text("utf-8"))
    pages = []
    for loc in locs:
        rel = loc.replace(SITE, "").split("#", 1)[0]
        rel = rel + "index.html" if rel.endswith("/") or rel == "" else rel
        if rel not in pages and not PROTECTED.search(rel) and not HELD.search(rel):
            pages.append(rel)
    return pages


def meta(src: str, key: str) -> str | None:
    m = re.search(rf'<meta (?:property|name)="{re.escape(key)}" content="([^"]*)"', src)
    return m.group(1) if m else None


def jpeg_size(data: bytes) -> tuple[int, int]:
    i = 2
    while i < len(data):
        marker, length = data[i + 1], int.from_bytes(data[i + 2:i + 4], "big")
        if marker in (0xC0, 0xC1, 0xC2):
            return int.from_bytes(data[i + 7:i + 9], "big"), int.from_bytes(data[i + 5:i + 7], "big")
        i += 2 + length
    raise ValueError("no frame header")


def test_sitemap_is_not_empty() -> None:
    assert len(sitemap_pages()) >= 140


def test_held_pages_have_their_cards_ready() -> None:
    locs = re.findall(r"<loc>([^<]+)</loc>", (ROOT / "sitemap.xml").read_text("utf-8"))
    for loc in locs:
        rel = loc.replace(SITE, "")
        if HELD.search(rel):
            slug = re.sub(r"(^|/)index\.html$", "", rel + ("index.html" if rel.endswith("/") else ""))
            slug = slug.removesuffix(".html").strip("/").replace("/", "--")
            assert (ROOT / "img" / "og" / "p" / f"{slug}.jpg").is_file(), rel


def test_every_page_has_its_own_card_that_exists() -> None:
    owners: dict[str, str] = {}
    for rel in sitemap_pages():
        src = (ROOT / rel).read_text("utf-8")
        og, tw = meta(src, "og:image"), meta(src, "twitter:image")
        assert og, f"{rel}: no og:image"
        assert tw == og, f"{rel}: twitter:image {tw} differs from og:image {og}"
        assert meta(src, "twitter:card") == "summary_large_image", f"{rel}: twitter:card is not summary_large_image"
        path, _, query = og.replace(SITE, "").partition("?")
        assert path.startswith("img/og/p/") and path.endswith(".jpg"), f"{rel}: {og} is not a page card"
        card = ROOT / path
        assert card.is_file(), f"{rel}: {path} is missing"
        data = card.read_bytes()
        assert query == "v=" + hashlib.sha256(data).hexdigest()[:12], f"{rel}: {og} does not carry its hash"
        assert jpeg_size(data) == (1200, 630), f"{rel}: {path} is not 1200 x 630"
        if BORROWS.search(rel) and path == "img/og/p/frontier-safety.jpg":
            continue
        assert path not in owners, f"{rel} and {owners.get(path)} share {path}"
        owners[path] = rel


def test_card_alt_names_the_page_and_its_author() -> None:
    for rel in sitemap_pages():
        src = (ROOT / rel).read_text("utf-8")
        alt = meta(src, "og:image:alt") or ""
        assert "by Zain Dana Harper." in alt, f"{rel}: alt text does not name the author"
        assert len(alt) > 60, f"{rel}: alt text is too thin to describe the picture"
        assert meta(src, "twitter:image:alt") == alt, f"{rel}: twitter alt differs from og alt"


def test_no_page_points_at_a_retired_card() -> None:
    retired = ("img/og/telos.png", "img/og/profile.png", "img/og/portfolio-home.png", ".svg\"")
    for rel in sitemap_pages():
        head = (ROOT / rel).read_text("utf-8").split("</head>", 1)[0]
        for name in retired:
            assert f'og:image" content="{SITE}{name}' not in head and not (
                name == ".svg\"" and re.search(r'og:image" content="[^"]+\.svg"', head)), f"{rel} still uses {name}"


def test_every_card_has_a_receipt() -> None:
    import json
    book = json.loads((ROOT / "img" / "og" / "p" / "receipts.json").read_text("utf-8"))["receipts"]
    for jpg in (ROOT / "img" / "og" / "p").glob("*.jpg"):
        rec = book.get(jpg.name)
        assert rec, f"{jpg.name} has no receipt"
        assert rec["outputs"][jpg.name] == hashlib.sha256(jpg.read_bytes()).hexdigest(), f"{jpg.name} changed"
        assert rec["schema"] == "superstack.receipt/1"
