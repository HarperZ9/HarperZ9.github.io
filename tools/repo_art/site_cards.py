"""One link-preview card per site page, and the head tags that point at it.

    python -m tools.repo_art.site_cards plan            # list page, title, kind, art
    python -m tools.repo_art.site_cards render          # write img/og/p/<slug>.jpg and receipts
    python -m tools.repo_art.site_cards stamp           # point each page's og and twitter tags at its card

Every page in sitemap.xml gets img/og/p/<slug>.jpg, 1200 x 630, with its own
title and author. The URL carries ?v=<first 12 hex of the file's SHA-256>, so
a platform that cached an older card fetches the new one on the next share.
Pages for the Elder, ENB and Skyrim projects are left as they are.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
import sys
from pathlib import Path

if __package__ in {None, ""}:  # run as a file: make the package importable
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from tools.repo_art.card_plan import (HELD, MOTIF_RULES, OUT, ROOT, SITE, WORK_RULES, art_alt, classify,  # noqa: E402,F401
                                      card_title, clean_title, page_info, pages, plan, slug_for, card_rel, _meta)


FALLBACK = [(r"^frontier-safety--", "frontier-safety")]


def card_url(rel: str) -> str:
    """The card's public URL with its content hash, for any generator that writes a head."""
    path = ROOT / card_rel(rel)
    if not path.exists():
        slug = slug_for(rel)
        # Any other page without a card yet (a new essay, a test fixture) borrows the home
        # card; tests/test_link_cards.py fails the build until its own card is rendered.
        borrowed = next((f"img/og/p/{to}.jpg" for pat, to in FALLBACK if re.search(pat, slug)), "img/og/p/home.jpg")
        path = ROOT / borrowed
    v = hashlib.sha256(path.read_bytes()).hexdigest()[:12]
    return f"{SITE}{path.relative_to(ROOT).as_posix()}?v={v}"


def card_alt(rel_or_url: str, title: str, og_type: str = "article") -> str:
    """Alt text for a page's card, from its title and the art it carries."""
    rel = rel_or_url.replace(SITE, "")
    rel = rel + "index.html" if rel.endswith("/") or rel == "" else rel
    slug = slug_for(rel)
    c = {"slug": slug, "title": card_title(slug, title), **classify({"slug": slug, "og_type": og_type})}
    alts = json.loads((ROOT / "art" / "aperture" / "covers.json").read_text("utf-8"))["alt"]
    repos = json.loads((Path(__file__).parent / "repos.json").read_text("utf-8"))["repos"]
    return f"{c['title']}, by Zain Dana Harper. {art_alt(c, alts, repos)}"


NEWLINE = chr(10)


def card_tags(rel_or_url: str, title: str, og_type: str = "article", sep: str = NEWLINE) -> str:
    """The preview tags every page carries, for generators that write a head.
    title is the page's og:title as written (escaped HTML is unescaped first)."""
    rel = rel_or_url.replace(SITE, "")
    rel = rel + "index.html" if rel.endswith("/") or rel == "" else rel
    url = card_url(rel)
    alt = html.escape(card_alt(rel, html.unescape(title), og_type), quote=True)
    return sep.join([
        f'<meta property="og:image" content="{url}">',
        '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">',
        f'<meta property="og:image:alt" content="{alt}">', '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:image" content="{url}">', f'<meta name="twitter:image:alt" content="{alt}">'])


def image_alt(card: dict) -> str:
    return f'{card["title"]}, by Zain Dana Harper. {card["alt"]}'


TAGS = re.compile(r'\s*<meta (?:property|name)="(?:og:image(?::[a-z]+)?|twitter:image(?::alt)?|twitter:card)"'
                  r' content="[^"]*"\s*/?>')


# Built pages whose head comes from a source file: stamp the source as well.
SOURCES = {"workshop.html": "home/index.html",  # the React build deploys to workshop.html since 2026-10-26
           "repo-explainers.html": "tools/repo_explainers/pages/hub.src.html"}  # build.py --publish copies the hub


def stamp(card: dict, path: Path | None = None) -> bool:
    """Rewrite one page's preview tags. Returns True when the file changed."""
    path = path or ROOT / card["rel"]
    src = path.read_text("utf-8")
    info = page_info(card["rel"])
    block = card_tags(card["rel"], _meta(src, "og:title") or info["title"], info["og_type"], sep="")
    if not _meta(src, "og:title"):
        block = f'<meta property="og:title" content="{html.escape(info["title"], quote=True)}">' + block
    if not _meta(src, "og:description") and info["description"]:
        block += f'<meta property="og:description" content="{html.escape(info["description"], quote=True)}">'
    first = TAGS.search(src)
    if first:  # replace in place, where the page (or its generator) already keeps these tags
        lead = re.match(r"\s*", first.group(0)).group(0)
        rest = TAGS.sub("", src[first.end():])
        sep = lead if NEWLINE in lead else ""
        block = card_tags(card["rel"], _meta(src, "og:title") or info["title"], info["og_type"],
                          sep=sep or "") if sep else block
        new = src[:first.start()] + lead + block + rest
        if new != src:
            path.write_text(new, "utf-8", newline=NEWLINE)
            return True
        return False
    new = TAGS.sub("", src)
    anchor = (re.search(r'<meta property="og:url" content="[^"]*">', new)
              or re.search(r'<meta name="description" content="[^"]*">', new))
    if anchor:
        if new[anchor.end():anchor.end() + 1] == "\n":  # one tag per line in this head: keep that style
            line_start = new.rfind("\n", 0, anchor.start()) + 1
            indent = re.match(r"[ \t]*", new[line_start:]).group(0)
            block = "\n" + indent + block.replace("><meta", ">\n" + indent + "<meta")
        new = new[:anchor.end()] + block + new[anchor.end():]
    else:
        new = new.replace("</head>", block + "\n</head>", 1)
    if new != src:
        path.write_text(new, "utf-8", newline="\n")
        return True
    return False


def write_manifest(cards: list[dict]) -> None:
    """img/og/p/cards.json: each page's card URL and alt text, for the JS generators."""
    data = {c["rel"]: {"image": card_url(c["rel"]),
                       "alt": card_alt(c["rel"], _meta((ROOT / c["rel"]).read_text("utf-8"), "og:title") or c["title"],
                                       page_info(c["rel"])["og_type"])}
            for c in cards}
    (OUT / "cards.json").write_text(json.dumps(data, indent=1, sort_keys=True, ensure_ascii=False) + NEWLINE,
                                    "utf-8", newline=NEWLINE)


def main(argv: list[str]) -> int:
    cmd = argv[0] if argv else "plan"
    cards = plan()
    if cmd == "plan":
        for c in cards:
            print(f'{c["slug"]:<58} {c["kind"]:<13} {c.get("tool") or c.get("work") or c.get("motif") or c["cover"]:<36} {c["title"][:60]}')
        print(len(cards), "pages")
    elif cmd == "render":  # render [--only slug,slug] [--masters DIR]; held pages keep the card their head pins
        from tools.repo_art.render import render_cards
        only = argv[argv.index("--only") + 1].split(",") if "--only" in argv else None
        masters = Path(argv[argv.index("--masters") + 1]) if "--masters" in argv else None
        cards = [c for c in cards if not HELD.search(c["rel"]) and (only is None or c["slug"] in only)]
        render_cards(cards, OUT, masters)
    elif cmd == "stamp":
        cards = [c for c in cards if not HELD.search(c["rel"])]
        print(sum(stamp(c) for c in cards), "of", len(cards), "pages changed")
        for c in cards:
            if c["rel"] in SOURCES:
                stamp(c, ROOT / SOURCES[c["rel"]])
        write_manifest(plan())
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(ROOT))
    raise SystemExit(main(sys.argv[1:]))
