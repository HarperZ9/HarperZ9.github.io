"""Which pages get a link card, and what each card carries: its words, its art and its alt text.

Pure functions over the tracked pages. `plan()` is the whole list; site_cards renders and stamps from it.
"""

from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

if __package__ in {None, ""}:  # loaded by path: make the package importable
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools.repo_art.archive_objects import object_name, object_treat, object_work  # noqa: E402
from tools.repo_art.page_covers import ALT as COVER_ALT  # noqa: E402
from tools.repo_art.page_covers import dealt  # noqa: E402
from tools.repo_art.tool_covers import ALT as TOOL_ALT, leads, subject  # noqa: E402

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
def _meta(src: str, key: str) -> str:
    m = re.search(rf'<meta (?:property|name)="{re.escape(key)}" content="([^"]*)"', src)
    return html.unescape(m.group(1)) if m else ""


# A page titled with the author's name alone (the home) gets its card title from what the site does: the name stays
# a byline on the card and is never the picture (the author, 2026-11-09).
NAME_TITLE = "Tools that check AI work and render every medium"  # one line on the card, so the water under it shows
HOME = {"veil": "low", "anchor": 1.0}  # the home card: the picture at full height, the dark low and light


def clean_title(title: str) -> str:
    """The page title as a card shows it: no site suffix, no author prefix, no dashes."""
    title = SUFFIX.sub("", html.unescape(title)).strip()  # a head escaped twice still reads as words
    if title == "Zain Dana Harper":
        return NAME_TITLE
    title = re.sub(r"^Zain Dana Harper\s*[|:]\s*", "", title)
    seps = chr(0x2014) + chr(0x2013) + chr(0xB7)  # em dash, en dash, middle dot
    title = re.sub(r"\s+[" + seps + r"-]\s+", ", ", title).replace(chr(0x2014), ", ")  # none on a card
    title = re.sub(r",\s*(Editorial essay|Essay|Paper|Briefing)$", "", title)
    return re.sub(r"\s+LCCN\d+", "", title)  # a library control number is a record key, not a title


def card_title(slug: str, title: str) -> str:
    """The title a card shows: an archive object's display name, else the page title cleaned."""
    return object_name(slug) or clean_title(title)


def _plain(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def dek_for(title: str, desc: str) -> str:
    """The line under a card's title: the description's first sentence, when it adds to the title and fits."""
    first = re.split(r"(?<=[.!?])\s", html.unescape(desc), maxsplit=1)[0] if desc else ""
    if not first or len(first) > 150 or _plain(title) in _plain(first) or _plain(first) in _plain(title):
        return ""
    return first


def page_info(rel: str) -> dict:
    src = (ROOT / rel).read_text("utf-8")
    t = re.search(r"<title>(.*?)</title>", src, re.S)
    title = _meta(src, "og:title") or (html.unescape(re.sub(r"\s+", " ", t.group(1))) if t else slug_for(rel))
    slug = slug_for(rel)
    named, title = card_title(slug, title), clean_title(title)
    og_type = _meta(src, "og:type")
    desc = _meta(src, "og:description") or _meta(src, "description")
    return {"rel": rel, "slug": slug, "title": named, "description": desc, "og_type": og_type,
            "dek": dek_for(title, desc), "src": src}


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


# Pages that show a render of their own work carry it on their card, edge to edge (the author, 2026-11-09: the
# site media should show the creative work, never the name as the picture). (slug pattern, render, alt, layout);
# the first match wins. "foot" sets the title along the foot, clear of a render that is a word or a whole scene;
# "side" sets it down the left of a render with room there. A word in the render never sits under the title.
WORK_RULES = [
    (r"^(index|home)$", "media/world/glass-water/field-day-2560.webp",
     "A rendered sea under a clear sky, a small sun high on the right and its light running down the water.", "foot"),
    (r"^glass-water$|^world--glass--", "media/world/glass-water/close-3840.webp",
     "The word light in glass letters standing in a rendered sea, the horizon and a low sun showing through them.", "foot"),
    (r"^superframe$|^world--superframe--", "media/world/superframe/paint-3840.webp",
     "A superframe render in paint: rust coral ridges, an ink pool, a contour lens drawn in fine lines and an ochre stroke.", "foot"),
    (r"^accession$|^world--typeengine--", "media/world/lettering/deco-arc-poster.webp",
     "Accession set in gold on a stepped deco sunburst, over a green dial of fine rings.", "foot"),
    (r"^cmmns$|^daylight-commons", "media/world/lettering/mosaic-smalti-poster.webp",
     "The Commons laid in gold glass smalti with a red border, on a ground of blue tiles.", "foot"),
    (r"^(flywheel|flywheel-pilot|no-receipt-no-accept)$", "media/world/lettering/intaglio-lines-3840.webp",
     "No receipt no accept engraved in intaglio lines on laid paper, beside an embossed guilloche seal with FW in gold foil.", "foot"),
    (r"^demo-flywheel$", "media/demos/flywheel/flywheel-app-console.png",
     "The Flywheel console from the demo, with a run, its receipt and the check on it.", "foot"),
    (r"^(elements|swatches)$", "media/world/crossover/overprint-day-3840.webp",
     "Five inks of an Olivetti print laid down as sheets of tinted glass crossing on warm paper.", "foot"),
]
FILM_POSTERS = [(r"^night-school-(\w+)$", "media/school/{0}/narrated-poster.jpg")]  # a lesson page's own film


def work_for(slug: str):
    """(render, alt, layout, anchor) for a page that has a picture of its own work or subject."""
    obj = object_work(slug, ROOT)
    if obj:
        return obj
    for pat, path, alt, layout in WORK_RULES:
        if re.search(pat, slug) and (ROOT / path).exists():
            return path, alt, layout, 0.5
    for pat, tmpl in FILM_POSTERS:
        m = re.search(pat, slug)
        if m and (ROOT / tmpl.format(*m.groups())).exists():
            return tmpl.format(*m.groups()), f"A still from the {m.group(1)} lesson film, drawn by the raw-native engine.", "foot", 0.5
    return None


# A page with no render and no cover of its own gets a drawn cover from the family for its kind
# (tools/repo_art/page_motifs.py). (pattern on the last part of the slug, family); the first match wins.
MOTIF_RULES = [
    (r"^obj-", "frames"), (r"^film-", "strip"), (r"^night-school", "plot"),
    (r"^(explainers|guides?|glossary|catalog|site-index|overview|portfolio|credits|experiments|workshop|floor|"
     r"repo-explainers|gallery|museum|front|learn|listen|support|current|raw|aleph)", "map"),
    (r"^(the|who|what|why|how|a|an|we|no|on)-", "column"),
    (r"", "contours"),
]
MOTIF_ALT = COVER_ALT  # what each family of cut-paper cover shows


def motif_for(slug: str) -> str:
    part = slug.rsplit("--", 1)[-1]
    return next(family for pat, family in MOTIF_RULES if re.search(pat, part))


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
        return {"kind": kind, "work": work[0], "work_alt": work[1], "layout": work[2], "anchor": work[3],
                **object_treat(slug), **(HOME if slug == "home" else {})}
    if (ROOT / "art" / "aperture" / f"cover-{slug}-dark.svg").exists():
        return {"kind": kind, "cover": f"cover-{slug}"}
    if rule:
        return {"kind": kind, "cover": rule[1]}
    if article:
        return {"kind": kind, "cover": "pillar-writing"}
    return {"kind": kind, "motif": motif_for(slug)}


def art_alt(c: dict, alts: dict, repos: dict) -> str:
    """What a card's picture shows, in words, for whichever kind of art it carries."""
    if "work" in c:
        return c["work_alt"]
    if "tool" in c:
        return repos[c["tool"]]["figure_alt"]
    if c.get("motif") == "contours":
        return TOOL_ALT[subject(c["slug"], f'{c["title"]}\n{c.get("dek") or ""}')]
    return MOTIF_ALT[c["motif"]] if "motif" in c else alts[c["cover"]]


def plan() -> list[dict]:
    alts = json.loads((ROOT / "art" / "aperture" / "covers.json").read_text("utf-8"))["alt"]
    repos = json.loads((Path(__file__).parent / "repos.json").read_text("utf-8"))["repos"]
    cards = []
    for rel in pages():
        if SKIP.search(rel) or not (ROOT / rel).exists():
            continue
        info = page_info(rel)
        c = {"slug": info["slug"], "rel": rel, "title": info["title"], "dek": info["dek"], **classify(info)}
        c["alt"] = art_alt(c, alts, repos)
        c.pop("work_alt", None)
        cards.append(c)
    lead = leads([(c["slug"], f'{c["title"]}\n{c["dek"] or ""}') for c in cards if c.get("motif") == "contours"])
    lead.update(dealt([(c["slug"], c["motif"]) for c in cards if c.get("motif")]))
    return [{**c, "lead": lead[c["slug"]]} if c["slug"] in lead else c for c in cards]
