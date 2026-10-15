"""Contracts for the corrections from the full second read of the Who Knew First ledger (October 2026).

Each batch of the read adds its confirmed fixes here. Every fix must carry its corrected wording
outside the Corrections section, the old wording must be gone from the page outside that section,
the op-ed stays as published, and the Corrections section must carry a dated note that quotes the
old text.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "who-knew-first.html"
CORRECTIONS = re.compile(r'id="corrections"[^>]*>(.*?)<h2 id="sources">', re.S)

# Batch 1 (WKF-0001 to WKF-0115) and the confirmed WKF-0319 reader note.
GONE = (
    "The two posts name different models: the 16 Jul disclosure names zai-org/GLM-5.2, and",
    "Reopened registrations after about 3.86 days.",
    "the registration pause of about 3.86 days",
)
PRESENT = (
    "The two posts name different builds of one model: the 16 Jul disclosure links zai-org/GLM-5.2"
    " (the link was added on 30 Jul)",
    "Reopened registrations after about 3.85 days.",
    "the registration pause of about 3.85 days",
)
NOTES = (
    "October 15, 2026: correction, Hugging Face ledger",
    "October 15, 2026: correction, RubyGems ledger: two entries said registrations reopened &quot;after"
    " about 3.86 days&quot;",
    "October 15, 2026: sources added, interests table: the Anthropic entry for the September 12 essay",
)


def text() -> str:
    return PAGE.read_text(encoding="utf-8")


def body(t: str) -> str:
    return CORRECTIONS.sub("", t)


def test_fixes_present_and_old_wording_gone() -> None:
    t = body(text())
    for phrase in GONE:
        assert phrase not in t, phrase
    for phrase in PRESENT:
        assert phrase in t, phrase


def test_notes_are_dated_and_quote_the_old_text() -> None:
    notes = CORRECTIONS.search(text()).group(1)
    for phrase in NOTES:
        assert phrase in notes, phrase
    assert "names zai-org/GLM-5.2, and the 28 Jul timeline names NVIDIA&#x27;s quantized" in notes


def test_essay_entry_cites_the_reuters_report() -> None:
    t = text()
    i = t.index("Anthropic&#x27;s public S-1 was expected in late September (Reuters).")
    entry = t[i:t.index("</details>", i)]
    assert "<summary>Sources (4)</summary>" in entry
    assert "anthropic-ipo-launch-shifts-toward-mid-october-reuters.html" in entry


def test_new_notes_carry_no_em_dash() -> None:
    notes = CORRECTIONS.search(text()).group(1)
    tail = notes[notes.index("October 15, 2026: correction, Hugging Face ledger"):]
    assert "—" not in tail
