"""Render the Writing hub sections on publications.html and the newest-writing strip.

Rows are the notebook row the hub already used: kind and date, title, one-line summary.
Order inside a section is newest first by published_at. When a piece was revised later,
the revision date shows after the first date and never replaces it.
"""
from __future__ import annotations

import html
from pathlib import Path

from tools.publication_sections import (
    SERIES_DIR,
    briefing_editions,
    human_date,
    load_series,
    membership,
    papers,
    research_notes,
)


def _e(value: object) -> str:
    return html.escape(str(value), quote=True)


def newest_first(items: list[dict]) -> list[dict]:
    return sorted(items, key=lambda item: (item["published_at"], item["route"]), reverse=True)


def display_title(item: dict, member: dict) -> str:
    return member.get("label") or item["title"]


def _dates(item: dict) -> str:
    text = f'<time datetime="{_e(item["published_at"])}">{human_date(item["published_at"])}</time>'
    if item["updated_at"] != item["published_at"]:
        text += (
            f'<span class="publication-updated">Updated '
            f'<time datetime="{_e(item["updated_at"])}">{human_date(item["updated_at"])}</time></span>'
        )
    return text


def _topics(section: dict, member: dict, item: dict) -> str:
    words = [section["id"], member["kind"], member.get("topic", ""), *item.get("topics", [])]
    return _e(" ".join(words).replace("-", " ").casefold())


def render_row(item: dict, section: dict, member: dict, *, entry: bool = True) -> str:
    related = "".join(
        f' <span class="publication-related">Also: <a href="{_e(link["href"])}">{_e(link["label"])}</a>.</span>'
        for link in member.get("related", [])
    )
    marker = f' data-publication-entry data-topics="{_topics(section, member, item)}"' if entry else ""
    return (
        f'<article{marker} data-collection="{_e(section["id"])}">'
        f'<p class="publication-meta">{_e(member["kind"])} · {_dates(item)}</p>'
        f'<h3><a href="{_e(item["route"])}">{_e(display_title(item, member))}</a></h3>'
        f'<p>{_e(item["summary"])}{related}</p></article>'
    )


def _compact(entries: list[tuple[str, str, str]], section_id: str, label: str,
             extras: list[str] | None = None) -> str:
    """A compact list; `extras` holds trusted HTML appended inside each row's meta span."""
    extras = extras or [""] * len(entries)
    rows = "".join(
        f'<li data-publication-entry data-topics="{_e(section_id)} {_e(title.casefold())}">'
        f'<a href="{_e(href)}">{_e(title)}</a>'
        + (f' <span class="publication-meta">{_e(note)}{extra}</span>' if note else "")
        + "</li>"
        for (href, title, note), extra in zip(entries, extras)
    )
    return f'<ul class="publication-compact" aria-label="{_e(label)}">{rows}</ul>'


def _series_callout(root: Path, items_by_id: dict[str, dict]) -> str:
    if not (root / SERIES_DIR / "who-knew-first.json").is_file():
        return ""
    series = load_series(root, "who-knew-first")
    published = sum(1 for part in series["parts"] if part["id"] and part["id"] in items_by_id)
    return (
        '<p class="publication-series-callout">'
        f'<a href="{_e(series["route"])}">{_e(series["title"])}</a>: the series hub. '
        f'Five pieces planned, {"one" if published == 1 else published} published.</p>'
    )


def _briefing_lists(root: Path) -> str:
    editions, conclusions = briefing_editions(root)
    edition_rows = [(f"frontier-safety/archive/{date}.html", f"Edition of {human_date(date)}", "") for date in editions]
    conclusion_rows = [
        (f"frontier-safety/conclusions/{date}.html", f"Conclusions on the edition of {human_date(date)}", "")
        for date in conclusions
    ]
    return (
        '<h3 class="publication-subhead" id="briefing-editions">Every dated edition</h3>'
        + _compact(edition_rows + conclusion_rows, "briefings", "Dated Frontier Safety editions")
    )


def _research_lists(root: Path, section: dict) -> str:
    note_rows = [(note["href"], note["title"], "") for note in research_notes(root, section)]
    paper_list = papers(root, section)
    paper_rows = [(paper["file"], paper["title"], f'{paper["status"]} · PDF') for paper in paper_list]
    return (
        '<h3 class="publication-subhead" id="research-notes">Research notes</h3>'
        + _compact(note_rows, "research", "Research notes")
        + '<h3 class="publication-subhead" id="research-papers">Papers</h3>'
        + _compact(paper_rows, "research", "Papers as PDF files",
                   [_paper_links(root, paper) for paper in paper_list])
    )


def _paper_links(root: Path, paper: dict) -> str:
    """The DOI and, for a PDF typeset by tools/build_latex_papers.py, its build receipt and LaTeX source."""
    links = []
    if paper.get("doi"):
        links.append(f'<a href="https://doi.org/{_e(paper["doi"])}" translate="no">DOI</a>')
    receipt = f'papers/receipts/{Path(paper["file"]).stem}.json'
    if (root / receipt).is_file():
        links.append(f'<a href="{_e(receipt)}">build receipt</a>')
    tex = f'papers/tex/{Path(paper["file"]).stem}.tex'
    if (root / tex).is_file():
        links.append(f'<a href="{_e(tex)}">LaTeX source</a>')
    return "".join(f" · {link}" for link in links)


def _opener_first(items: list[dict], members: dict[str, dict]) -> list[dict]:
    """A series opener is the "Start here" row, so it leads its section whatever its date."""
    def is_opener(item: dict) -> bool:
        return (members[item["id"]].get("series") or {}).get("part") == "opener"
    return [item for item in items if is_opener(item)] + [item for item in items if not is_opener(item)]


def render_sections(root: Path, sections: dict, items: list[dict]) -> str:
    items_by_id = {item["id"]: item for item in items}
    blocks = []
    for section in sections["sections"]:
        members = {member["id"]: member for member in section["members"]}
        rows = "\n".join(
            render_row(item, section, members[item["id"]])
            for item in _opener_first(newest_first([items_by_id[member_id] for member_id in members]), members)
        )
        extra = ""
        if section["id"] == "series":
            extra = _series_callout(root, items_by_id)
        lists = ""
        if section.get("editions"):
            lists = _briefing_lists(root)
        if section.get("notes"):
            lists = _research_lists(root, section)
        blocks.append(
            f'<section class="mv publication-section" id="{_e(section["id"])}" data-publication-section aria-labelledby="{_e(section["id"])}-h">'
            f'<header class="publication-section-head"><h2 id="{_e(section["id"])}-h">{_e(section["name"])}</h2>'
            f'<p class="body-text">{_e(section["explainer"])}</p></header>{extra}\n'
            f'<div class="publication-ledger" data-publication-ledger>\n{rows}\n</div>{lists}</section>'
        )
    return "\n".join(blocks)


def render_newest(sections: dict, items: list[dict], count: int = 3) -> str:
    members = membership(sections)
    rows = "\n".join(
        render_row(item, *members[item["id"]], entry=False) for item in newest_first(items)[:count]
    )
    return f'<div class="publication-ledger publication-newest">\n{rows}\n</div>'
