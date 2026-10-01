"""Sections of the Writing hub: which section lists each piece, and how a piece links back.

publications/data/sections.json is the one source of membership. Every full record and
every listing appears in exactly one section, with the kind word a reader sees ("Atlas
essay", "Open letter") and a plain topic. Research notes come from the research-*.html
pages, papers from publications/data/papers.json, and Frontier Safety editions from the
briefing's own history, so none of those need a listing of their own.

The same data drives the back-link line (docnav) on generated pages and the menu's
Writing group, so a section renamed here is renamed everywhere it shows.
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

from tools.publication_model import PublicationError

SECTIONS_PATH = Path("publications/data/sections.json")
SERIES_DIR = Path("publications/data/series")
HISTORY_PATH = Path("frontier-safety/data/history.json")
CONCLUSIONS_DIR = Path("frontier-safety/conclusions")
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December")
SECTION_IDS = ("series", "essays", "atlas", "briefings", "research")


def human_date(value: str) -> str:
    year, month, day = value.split("-")
    return f"{int(day)} {MONTHS[int(month) - 1]} {year}"


def _e(value: object) -> str:
    return html.escape(str(value), quote=True)


def load_sections(root: Path) -> dict:
    data = json.loads((root / SECTIONS_PATH).read_text(encoding="utf-8"))
    ids = tuple(section["id"] for section in data["sections"])
    if ids != SECTION_IDS:
        raise PublicationError(f"sections must be {SECTION_IDS} in that order, found {ids}")
    seen: set[str] = set()
    for section in data["sections"]:
        for member in section["members"]:
            if member["id"] in seen:
                raise PublicationError(f"{member['id']} is listed in more than one section")
            seen.add(member["id"])
            if "—" in json.dumps(member, ensure_ascii=False):
                raise PublicationError(f"section member {member['id']} contains an em dash")
    return data


def load_series(root: Path, series_id: str) -> dict:
    return json.loads((root / SERIES_DIR / f"{series_id}.json").read_text(encoding="utf-8"))


def membership(sections: dict) -> dict[str, tuple[dict, dict]]:
    """Map each piece id to (section, member)."""
    return {
        member["id"]: (section, member)
        for section in sections["sections"]
        for member in section["members"]
    }


def check_coverage(sections: dict, items: list[dict]) -> None:
    """Every record and listing sits in exactly one section, and nothing else does."""
    members = membership(sections)
    item_ids = {item["id"] for item in items}
    missing = sorted(item_ids - set(members))
    extra = sorted(set(members) - item_ids)
    if missing:
        raise PublicationError(f"pieces without a Writing section: {missing}")
    if extra:
        raise PublicationError(f"sections name pieces with no record or listing: {extra}")


def page_title(path: Path) -> str:
    source = path.read_text(encoding="utf-8")
    match = re.search(r"<h1\b[^>]*>(.*?)</h1>", source, re.S)
    text = re.sub(r"<[^>]+>", "", match.group(1)) if match else path.stem
    return " ".join(html.unescape(text).split())


def research_notes(root: Path, section: dict) -> list[dict]:
    config = section["notes"]
    labels = config.get("labels", {})
    notes = []
    for path in sorted(root.glob(config["glob"])):
        notes.append({"href": path.name, "title": labels.get(path.name) or page_title(path)})
    return sorted(notes, key=lambda note: note["title"].casefold())


def papers(root: Path, section: dict) -> list[dict]:
    path = root / section["papers"]
    if not path.is_file():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    listed = [paper["file"] for paper in data["papers"]]
    on_disk = sorted(path.relative_to(root).as_posix() for path in (root / "papers").glob("*.pdf"))
    if sorted(listed) != on_disk or len(set(listed)) != len(listed):
        raise PublicationError("papers.json must list every PDF in papers/ exactly once")
    return data["papers"]


def briefing_editions(root: Path) -> tuple[list[str], list[str]]:
    """Dated editions newest first, and dated conclusions pages newest first."""
    if not (root / HISTORY_PATH).is_file():
        return [], []
    history = json.loads((root / HISTORY_PATH).read_text(encoding="utf-8"))
    editions = sorted((item["date"] for item in history["editions"]), reverse=True)
    for date in editions:
        if not (root / "frontier-safety" / "archive" / f"{date}.html").is_file():
            raise PublicationError(f"Frontier Safety edition {date} has no archive page")
    conclusions = sorted((path.stem for path in (root / CONCLUSIONS_DIR).glob("*.html")), reverse=True)
    return editions, conclusions


def docnav(sections: dict, piece_id: str, *, prefix: str = "") -> str:
    """The back-link line under the site menu: section, then hub, then series."""
    found = membership(sections).get(piece_id)
    if not found:
        raise PublicationError(f"{piece_id} has no Writing section")
    section, member = found
    hub = prefix + sections["hub"]
    series = member.get("series")
    where = "Who Knew First series" if series else section["name"]
    links = [f'<a href="{_e(hub)}">All writing</a>']
    if series:
        links.append(f'<a href="{prefix}{_e(series["id"])}-series.html">The series</a>')
        if series["part"]:
            links.append(f'<a href="{prefix}who-knew-first.html">Who Knew First</a>')
    else:
        links.append(f'<a href="{_e(hub)}#{_e(section["id"])}">{_e(section["more"])}</a>')
    return (
        '<nav class="docnav" aria-label="Where this piece sits">'
        f'<span class="where">Writing · {_e(where)}</span>'
        f'<span class="switch">{"".join(links)}</span></nav>'
    )
