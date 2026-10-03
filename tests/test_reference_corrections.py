"""Contracts for the dated reference corrections of October 2026.

Each corrected page must carry the corrected wording, must no longer carry the error, and
must date its note with the batch date set once in tools/correction_batch.py.
"""

from __future__ import annotations

import datetime as dt
import html
import re
from pathlib import Path

from tools.correction_batch import BATCH_DATE, check

ROOT = Path(__file__).resolve().parents[1]
END = r'(?:</section>|<h2 id="sources">|<details class="source-parts">|<p class="essay-sig">)'
NOTES = re.compile(r'id="corrections"[^>]*>(.*?)' + END, re.S)

# page -> (wording that must be gone, wording that must be present)
FIXES = {
    "no-receipt-no-accept.html": (
        ("Computation for the people", "a century early", "compulsory licensing like the fees radio",
         "its absence is why medieval merchants", "All of it does, everywhere, for good",
         "count together with someone"),
        ("Ted Nelson's <em>Computer Lib</em> (1974)", "Marilyn Strathern", "court-supervised blanket licensing",
         "check partners and agents they could not watch", "since the 1963 test ban", "<em>computare</em>",
         "the phrase the economist Joseph Schumpeter made famous"),
    ),
    "pick-the-lock-for-everyone.html": (
        ("for three decades.", "safe, stable and caring", "with eight words", "National Archives, <em>Last Seen",
         "conjecture associated with Dinitz, Garg and Goemans"),
        ("nearly three decades", "safe, stable, nurturing relationships and environments", "Villanova University",
         "Goemans's cost conjecture", "a spoken passage that begins", "resting-state functional connectivity studies"),
    ),
    "models-propose-oracles-dispose.html": ((), ("buildlang 1.3.0 (6 September 2026)",)),
    "the-number-has-a-vintage.html": (
        ("three weeks after the reference month.",),
        ("three weeks after the reference week",),
    ),
    "who-pays-the-referees.html": ((), ("OpenAI Foundation Board", "recuse himself")),
    "the-terms-for-telling.html": (
        ("Section 802 of Public Law 110-261 (10 July 2008) barred", "The public sees anonymized aggregates"),
        ("Section 802 of the Foreign Intelligence Surveillance Act, which section 201", "H.R. 471", "S. 483",
         "does not itself require its publication"),
    ),
    "who-knew-first.html": (
        ("&#x27;$0 license fees", '<meta property="article:published_time" content="2026-09-23">'),
        ("evaluations to improve its own AI cyberdefense", '<meta property="article:published_time" content="2026-09-25">'),
    ),
    "research-conferred-existence.html": (
        ("Candrakirti's lamp", "al-Ghazali's teaching", "Benjamin's victors writing history",
         "Its canonical anchor is"),
        ("Nagarjuna's lamp argument", "Saheeh International", "Blessed be He, is truth", "seventh thesis"),
    ),
    "research-conservation-of-faithfulness.html": (
        ('"the difference that makes', "The Page curve:\n      information conserved and scrambled"),
        ('"a difference which makes', "estimates how slowly information leaves"),
    ),
    "conferred-existence-essay.html": (("Three traditions that never met",), ("Three traditions arrived at the same seam:",)),
}


def test_every_note_and_date_in_the_batch_agrees() -> None:
    assert check(dt.date.fromisoformat(BATCH_DATE)) == []


def test_each_error_is_gone_and_each_fix_is_in_place() -> None:
    for page, (gone, present) in FIXES.items():
        source = (ROOT / page).read_text(encoding="utf-8")
        body = NOTES.sub("", source)  # a note may quote the error it corrects
        for phrase in gone:
            assert phrase not in body, (page, phrase)
        for phrase in present:
            assert phrase in source, (page, phrase)


def test_deposited_corpora_keep_their_text_and_point_to_dated_notes() -> None:
    for page, needle in (("witnessing-spine.html", "Three traditions that never met"),
                         ("conferred-existence.html", "(i) You do what you do because of the way you are.")):
        source = (ROOT / page).read_text(encoding="utf-8")
        assert needle in source, page  # the deposit is reproduced unchanged
        assert 'class="corpus-correction"' in source and '<section id="corrections">' in source, page


def test_new_correction_prose_carries_no_dashes() -> None:
    for page in FIXES:
        source = (ROOT / page).read_text(encoding="utf-8")
        match = NOTES.search(source)
        assert match, page
        notes = html.unescape(match.group(1))
        assert "—" not in notes and "–" not in notes, page
