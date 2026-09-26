"""Render the conclusions of a Frontier Safety Briefing edition for the plate shell.

Each conclusion reads as one bold sentence with its strength word. Everything that
supports it (the observed, inferred and unknown paragraphs, the evidence links and
what would change it) sits in a closed disclosure titled "Evidence and what would
change this", the way the Who Knew First findings read. Validation lives in
frontier_safety_conclusions.py.
"""

from __future__ import annotations

import html
from datetime import date as calendar_date
from urllib.parse import urlparse

from frontier_safety_conclusions import (
    ADDENDUM_KEY, STRENGTHS, _index, control_anchor, entries_and_context,
)


MONTHS = ("January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December")
# The strength word each conclusion carries beside its sentence.
STRENGTH_WORDS = {"shows": "Shows", "points_to": "Points to", "grey": "Still grey"}
DETAILS_SUMMARY = "Evidence and what would change this"
ADDENDUM_NOTE = ("Added on {added}, after this edition's record was published. The edition "
                 "checksum covers the published record and leaves this section out.")
OPENING = ("Each conclusion is held at the strength its evidence supports and applies one standard "
           "to every organization in the briefing. Where a conclusion explains a pattern, it does so "
           "through incentives, costs, rules and information flow.")
# What each strength heading means, shown once above the groups so a reader can weigh a
# heading without the builder's documentation.
STRENGTH_KEY = {
    "shows": "the finding holds across the record, with no credible alternative left open.",
    "points_to": "the record fits the finding, and alternatives remain open.",
    "grey": "the record cannot settle it, and the conclusion names what is missing.",
}


def _e(value: object) -> str:
    return html.escape(str(value), quote=True)


def human_date(value: str) -> str:
    day = calendar_date.fromisoformat(value)
    return f"{day.day} {MONTHS[day.month - 1]} {day.year}"


def _evidence_link(reference: str, edition: dict, index: dict, root: str, page: str) -> str:
    """page is the document that holds the records and control rows: "" for this page."""
    kind, value = reference.split(":", 1)
    if kind == "item":
        label, text, href = "Record", index["item"][value]["title"], f"{page}#{value}"
    elif kind == "control":
        row = index["control"][value]
        control = edition["controls"][row - 1]
        label, href = "Control", f"#{control_anchor(row)}"
        text = f"{control['announced_by']}, {control['status']}: {control['claim']}"
    elif kind == "source":
        host = (urlparse(value).hostname or "").removeprefix("www.")
        label, text = "Source", index["source"][value] or f"source ({host})"
        return (f'<li><span class="evidence-kind">{label}</span> '
                f'<a href="{_e(value)}" rel="noreferrer">{_e(text)}</a></li>')
    else:
        label, text = "Edition", f"Edition of {human_date(value)}"
        href = f"{root}frontier-safety/archive/{value}.html"
    return f'<li><span class="evidence-kind">{label}</span> <a href="{_e(href)}">{_e(text)}</a></li>'


def _render_key(strengths: set[str]) -> str:
    rows = "".join(f"<div><dt>{STRENGTHS[key]}</dt> <dd>{_e(STRENGTH_KEY[key])}</dd></div>"
                   for key in STRENGTHS if key in strengths)
    return f'<dl class="conclusions-key">{rows}</dl>'


def _render_entry(entry: dict, edition: dict, index: dict, root: str, page: str) -> str:
    body = "".join(f"<p>{_e(paragraph)}</p>" for paragraph in entry["body"])
    links = "".join(_evidence_link(ref, edition, index, root, page) for ref in entry["evidence"])
    return (f'\n    <article class="conclusion" id="conclusion-{_e(entry["id"])}">'
            f'<p class="conclusion-lead"><span class="conclusion-strength">'
            f'{STRENGTH_WORDS[entry["strength"]]}</span> <strong>{_e(entry["lead"])}</strong></p>'
            f'<details class="conclusion-more"><summary>{DETAILS_SUMMARY}</summary>'
            f'<div class="conclusion-support"><div class="conclusion-body">{body}'
            f'<p class="conclusion-change"><strong>What would change this:</strong> '
            f'{_e(entry["would_change_it"])}</p></div>'
            f'<div class="conclusion-evidence"><p class="evidence-head">Evidence</p><ul>{links}</ul></div>'
            f"</div></details></article>")


def _render_groups(entries: list[dict], edition: dict, index: dict, root: str, level: int, page: str) -> str:
    groups = []
    for strength, heading in STRENGTHS.items():
        members = [entry for entry in entries if entry["strength"] == strength]
        if members:
            body = "".join(_render_entry(entry, edition, index, root, page) for entry in members)
            groups.append(f'\n  <div class="conclusion-group" data-strength="{strength}">'
                          f"<h{level}>{heading}</h{level}>{body}</div>")
    return "".join(groups)


def _render_note(edition: dict, root: str, record_link: bool) -> str:
    if ADDENDUM_KEY not in edition:
        return ""
    added = human_date(edition[ADDENDUM_KEY]["added_on"])
    link = ""
    if record_link:
        href = f"{root}frontier-safety/conclusions/{edition['edition_date']}.html"
        link = (f' <a href="{_e(href)}">Dated record of these conclusions</a>, kept after the next '
                "edition replaces this page.")
    return f'<p class="conclusions-note">{_e(ADDENDUM_NOTE.format(added=added))}{link}</p>'


def render_section(edition: dict, root: str, *, page: str = "", record_link: bool = True,
                   title: str = "What this edition lets us conclude") -> str:
    """The section before the lanes, or "" when the edition has no conclusions.

    page is where record anchors live ("" for this page, or a dated archive), and
    record_link adds the link from a companion record's note to its dated page."""
    found = entries_and_context(edition)
    if found is None:
        return ""
    entries = found[0]
    index = _index(edition)
    here = [entry for entry in entries if entry["scope"] == "edition"]
    across = [entry for entry in entries if entry["scope"] == "cross_edition"]
    across_html = (f'\n  <div class="conclusions-across"><h3>Across editions</h3>'
                   f"{_render_groups(across, edition, index, root, 4, page)}</div>" if across else "")
    return (f'<section class="mv conclusions" id="conclusions" aria-labelledby="conclusions-title">\n'
            f'  <header><h2 id="conclusions-title">{_e(title)}</h2>'
            f'<p class="conclusions-dek">{_e(OPENING)}</p>'
            f'{_render_key({entry["strength"] for entry in entries})}'
            f'{_render_note(edition, root, record_link)}</header>'
            f"{_render_groups(here, edition, index, root, 3, page)}{across_html}\n</section>\n\n  ")
