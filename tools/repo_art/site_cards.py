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

ROOT = Path(__file__).resolve().parents[2]
SITE = "https://harperz9.github.io/"
OUT = ROOT / "img" / "og" / "p"
SKIP = re.compile(r"elder|enb|skyrim", re.I)
# Held pages: the incident briefing is pinned by its own build receipt (a history file), and the
# career pages by the career release manifest (career/career-artifacts.json), and the open letter
# by its build record (writing/checking-the-machines/build.json). Their cards are
# rendered; their heads change with the next build of that briefing or the next career release.
HELD = re.compile(r"^(briefings/2026-08-26-openai-hugging-face-incident/|(hire|resume|portfolio|cover-letter|cv|dossier|checking-the-machines)\.html$)")
SUFFIX = re.compile(r"\s*(?:·|&middot;|\||-|–)\s*(?:Zain Dana Harper|Spoken Edition)\s*$")
TOOLS = ("crucible", "forum", "gather", "index", "telos", "raw-native")


def pages() -> list[str]:
    """Site-relative paths of every sitemap page, as files on disk."""
    locs = re.findall(r"<loc>([^<]+)</loc>", (ROOT / "sitemap.xml").read_text("utf-8"))
    out = []
    for loc in locs:
        rel = loc.replace(SITE, "").split("#", 1)[0]
        rel = rel + "index.html" if rel.endswith("/") or rel == "" else rel
        if rel not in out:
            out.append(rel)
    return out


def slug_for(rel: str) -> str:
    s = re.sub(r"(^|/)index\.html$", "", rel).removesuffix(".html").strip("/")
    return s.replace("/", "--") or "home"


def card_rel(rel: str) -> str:
    return f"img/og/p/{slug_for(rel)}.jpg"


# Pages a scheduled job creates before anyone can render their card (CI has no Chrome
# and no font files) borrow their section's card until the next local render.
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


def _meta(src: str, key: str) -> str:
    m = re.search(rf'<meta (?:property|name)="{re.escape(key)}" content="([^"]*)"', src)
    return html.unescape(m.group(1)) if m else ""


# A page titled with the author's name alone (the home) gets its card title from what the site does: the name stays
# a byline on the card and is never the picture (the author, 2026-11-09).
NAME_TITLE = "Tools that check AI work against its sources, and an engine that renders one idea in every medium"


def clean_title(title: str) -> str:
    """The page title as a card shows it: no site suffix, no author prefix, no dashes."""
    title = SUFFIX.sub("", title).strip()
    if title == "Zain Dana Harper":
        return NAME_TITLE
    title = re.sub(r"^Zain Dana Harper\s*[|:]\s*", "", title)
    seps = chr(0x2014) + chr(0x2013) + chr(0xB7)  # em dash, en dash, middle dot
    title = re.sub(r"\s+[" + seps + r"]\s+", ", ", title).replace(chr(0x2014), ", ")  # none on a card
    title = re.sub(r",\s*(Editorial essay|Essay|Paper|Briefing)$", "", title)
    return title


def page_info(rel: str) -> dict:
    src = (ROOT / rel).read_text("utf-8")
    t = re.search(r"<title>(.*?)</title>", src, re.S)
    title = _meta(src, "og:title") or (html.unescape(re.sub(r"\s+", " ", t.group(1))) if t else slug_for(rel))
    title = clean_title(title)
    og_type = _meta(src, "og:type")
    desc = _meta(src, "og:description") or _meta(src, "description")
    first = re.split(r"(?<=[.!?])\s", desc, maxsplit=1)[0] if desc else ""
    return {"rel": rel, "slug": slug_for(rel), "title": title, "description": desc, "og_type": og_type,
            "dek": first if len(first) <= 150 else "", "src": src}


ART_RULES = [  # (pattern on the slug, kind, art key); the first match wins
    (r"^frontier-safety", "Briefing", "cover-frontier-safety"),
    (r"^briefings", "Briefing", "cover-briefing-openai-hugging-face-incident"),
    (r"^research", "Paper", "pillar-research"),
    (r"^(who-knew-first|who-pays|the-terms-for-telling|who-kept-the-books|the-maker-is-part-of-the-story|a-check-it-cannot-predict)", "Investigation", "pillar-who-knew-first"),
    (r"^(cv|resume|hire|dossier|person|work-with-me|flywheel-pilot|cover-letter|independence|income-ledger|start-here|career)",
     "Page", "cover-resume"),
    (r"^(typeface|fonts|type-forge)", "Page", "pillar-fonts"),
    (r"^(security|private-practice|phantom|secret|isomorph|kun|bounds|seed|sofer|array|orca|gate)", "Tool",
     "pillar-security"),
    (r"^(studio|gallery|gaussian|retro|loom|current-story|atelier|session-archive|tour)", "Studio", "pillar-studio"),
    (r"^(flywheel|demo-flywheel|field-guide|metr)", "Tool", "pillar-flywheel"),
    (r"^(systems|plugins|plexus|relay|mneme|bulletin|join|accountable|coherence|emet|proof|repo-proof|canon|learn|"
     r"chorus|articulate|build|calibrate|engine-revival|brender|provenance|witnessing)", "Tool", "pillar-systems"),
    (r"^analytics", "Record", "domain-evaluation-verification"),
    (r"^(writing|publications|essays|presentation|checking-the-machines)", "Page", "pillar-writing"),
]


# Pages that show a render of their own work carry it on their card (the author, 2026-11-09: the site media
# should show the creative work, never the name as the picture). (slug pattern, render, alt); first match wins.
WORK_RULES = [
    (r"^(index|home)$", "media/world/glass-water/low-sun-3840.webp",
     "Glass letters spelling Low Water stand in the sea at a low sun, the light running across the water toward them.", "whole"),
    (r"^glass-water$|^world--glass--", "media/world/glass-water/close-3840.webp",
     "Glass letters rendered at the water line, close enough that the horizon runs through them."),
    (r"^superframe$|^world--superframe--", "media/world/superframe/paint-3840.webp",
     "A superframe render in paint: rust coral ridges, an ink pool, a contour lens drawn in fine lines and an ochre stroke."),
    (r"^(accession|typeface|fonts|type-forge)$|^world--typeengine--", "media/world/lettering/deco-arc-poster.webp",
     "Accession set in gold on a stepped deco sunburst, over a green dial of fine rings.", "whole"),
    (r"^cmmns$|^daylight-commons", "media/world/lettering/mosaic-smalti-poster.webp",
     "The Commons laid in gold glass smalti with a red border, on a ground of blue tiles.", "whole"),
    (r"^(flywheel|demo-flywheel|flywheel-pilot|no-receipt-no-accept)$", "media/world/lettering/intaglio-lines-3840.webp",
     "No receipt no accept engraved in intaglio lines on laid paper, beside an embossed guilloche seal with FW in gold foil.", "whole"),
    (r"^(elements|swatches)$", "media/world/crossover/overprint-day-3840.webp",
     "Five inks of an Olivetti print laid down as sheets of tinted glass crossing on warm paper."),
]
FILM_POSTERS = [(r"^night-school-(\w+)$", "media/school/{0}/narrated-poster.jpg")]  # a lesson page's own film


def work_for(slug: str):
    for pat, path, alt, *fit in WORK_RULES:
        if re.search(pat, slug) and (ROOT / path).exists():
            return path, alt, (fit or ["cover"])[0]
    for pat, tmpl in FILM_POSTERS:
        m = re.search(pat, slug)
        if m and (ROOT / tmpl.format(*m.groups())).exists():
            return tmpl.format(*m.groups()), f"A still from the {m.group(1)} lesson film, drawn by the raw-native engine.", "cover"
    return None


def classify(info: dict) -> dict:
    slug = info["slug"]
    base = re.sub(r"^(demo-|systems--)|(-sample|-graph)$", "", slug)
    if base in TOOLS:
        return {"kind": "Tool", "tool": base}
    rule = next(((k, a) for pat, k, a in ART_RULES if re.search(pat, slug)), None)
    article = info.get("og_type") == "article"
    kind = rule[0] if rule else ("Essay" if article else "Page")
    work = work_for(slug)
    if work:
        return {"kind": kind, "work": work[0], "work_alt": work[1], "fit": work[2]}
    if (ROOT / "art" / "aperture" / f"cover-{slug}-dark.svg").exists():
        return {"kind": kind, "cover": f"cover-{slug}"}
    if rule:
        return {"kind": kind, "cover": rule[1]}
    return {"kind": kind, "cover": "pillar-writing" if article else "home-hero"}


def plan() -> list[dict]:
    alts = json.loads((ROOT / "art" / "aperture" / "covers.json").read_text("utf-8"))["alt"]
    repos = json.loads((Path(__file__).parent / "repos.json").read_text("utf-8"))["repos"]
    cards = []
    for rel in pages():
        if SKIP.search(rel) or not (ROOT / rel).exists():
            continue
        info = page_info(rel)
        c = {"slug": info["slug"], "rel": rel, "title": info["title"], "dek": info["dek"], **classify(info)}
        c["alt"] = c.pop("work_alt") if "work" in c else repos[c["tool"]]["figure_alt"] if "tool" in c else alts[c["cover"]]
        cards.append(c)
    return cards


def card_alt(rel_or_url: str, title: str, og_type: str = "article") -> str:
    """Alt text for a page's card, from its title and the art it carries."""
    rel = rel_or_url.replace(SITE, "")
    rel = rel + "index.html" if rel.endswith("/") or rel == "" else rel
    c = classify({"slug": slug_for(rel), "og_type": og_type})
    alts = json.loads((ROOT / "art" / "aperture" / "covers.json").read_text("utf-8"))["alt"]
    repos = json.loads((Path(__file__).parent / "repos.json").read_text("utf-8"))["repos"]
    alt = c["work_alt"] if "work" in c else repos[c["tool"]]["figure_alt"] if "tool" in c else alts[c["cover"]]
    return f"{clean_title(title)}, by Zain Dana Harper. {alt}"


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
            print(f'{c["slug"]:<58} {c["kind"]:<13} {c.get("tool") or c["cover"]:<36} {c["title"][:60]}')
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
