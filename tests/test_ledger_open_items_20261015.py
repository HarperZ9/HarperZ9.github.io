"""Contracts for the 15 October 2026 ledger corrections on the series pages.

Each fix must carry its corrected wording and a dated note, and the old wording must be gone
from the page outside the Corrections section, except inside the byte-locked op-ed, where a
note beside the paragraph carries the fix instead.
"""

from __future__ import annotations

import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORRECTIONS = re.compile(r'id="corrections"[^>]*>(.*?)(?:<h2 id="sources">|<section id="ledger")', re.S)


def page(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def outside_notes(text: str) -> str:
    return CORRECTIONS.sub("", text)


def oped(text: str) -> str:
    return text[text.index("<!-- oped:start -->"):text.index("<!-- oped:end -->")]


WKF_GONE = (
    "Think Big, which received $20M from Leading the Future, spent",
    "legacy key holders rotated keys; defenders spent four months",
    "Events the operator labeled misalignment or no harm reached it",
)
WKF_PRESENT = (
    "Think Big, which received $22.5M from Leading the Future through 3 August 2026 ($20M of it by 30 June)",
    "if the attribution holds, defenders spent four months modeling an unknown human actor",
    "Events the operator labeled misalignment, no harm or not verified reached it 49 to 108 days later",
    "the revision credits the agent traces it reports to researchers from Transluce",
    'href="https://transluce.org/agent-activity"',
    "d28189dex991.htm",
    "relevant labs were notified in late July",
    "by the Minister for Industry and Innovation",
)
WKF_OPED_NOTES = (
    "Alphabet priced the $25B of notes on August 6, and the sale closed on August 10",
    "Discovery: May 25, 2026",
    "Meta&#x27;s retrospective says its evaluation ran entirely on Irregular&#x27;s infrastructure",
    "The writes come from the Prime Minister&#x27;s 23 September press conference",
)
WKF_DATED = (
    "October 15, 2026: correction, Private interests at the table",
    "October 15, 2026: correction, Follow-up, October 1",
    "October 15, 2026: update, Australia Medicare ledger",
    "October 15, 2026: clarification, The cost of the gap",
    "October 15, 2026: correction, Days hidden, then days to the public",
)


def test_who_knew_first_fixes_are_in_place_and_errors_gone() -> None:
    text = page("who-knew-first.html")
    body = outside_notes(text)
    for phrase in WKF_GONE:
        assert phrase not in body, phrase
    for phrase in WKF_PRESENT:
        assert phrase in body, phrase
    notes = oped(text)
    for phrase in WKF_OPED_NOTES:
        assert phrase in notes, phrase


def test_who_knew_first_notes_are_dated_and_keep_the_old_text() -> None:
    text = page("who-knew-first.html")
    notes = CORRECTIONS.search(text).group(1)
    for phrase in WKF_DATED:
        assert phrase in notes, phrase
    assert notes.count("October 15, 2026: sources added, no claim changed") == 2
    for old in ("Alphabet sold $25B of notes the same day", "received $20M from Leading the Future",
                "defenders spent four months modeling an unknown human actor",
                "Events the operator labeled misalignment or no harm reached it 49 to 108 days later"):
        assert old in html.unescape(notes), old


def test_graph_data_carries_the_added_sources() -> None:
    text = page("who-knew-first.html")
    graph = text[text.index('id="wkf-graph-data">'):]
    graph = graph[:graph.index("</script>")]
    for phrase in ("d28189dex991.htm", "relevant labs were notified in late July",
                   "by the Minister for Industry and Innovation"):
        assert phrase in graph, phrase


def test_who_pays_the_referees_meta_figures_read_as_one_total() -> None:
    text = page("who-pays-the-referees.html")
    assert "Meta's reported $45 million and $65 million" not in outside_notes(text)
    assert "Meta's reported $65 million for its state-level political committees, $45 million of it in the American Technology Excellence Project" in text
    assert "15 October 2026, clarification, open threads" in text


def test_new_notes_carry_no_dashes() -> None:
    for name in ("who-knew-first.html", "who-pays-the-referees.html"):
        notes = html.unescape(CORRECTIONS.search(page(name)).group(1))
        new = [line for line in notes.splitlines() if "15 October 2026" in line or "October 15, 2026" in line]
        assert new, name
        for line in new:
            assert "—" not in line and "–" not in line, line
