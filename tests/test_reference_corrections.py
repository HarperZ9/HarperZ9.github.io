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
    "who-pays-the-referees.html": (
        ("two contracted red-team firms", "Foundation reportedly funds safety evaluations", "co-funded by Anthropic and AWS",
         "used 15 payees", "Its basis is unknown", "and names none."),
        ("OpenAI Foundation Board", "recuse himself", "Trajectory Labs, 10a Labs and Gray Swan", "past £27 million",
         "17 payees", "including Cathedral", "now cofounder and chief scientist at Resolution"),
    ),
    "the-terms-for-telling.html": (
        ("Section 802 of Public Law 110-261 (10 July 2008) barred", "The public sees anonymized aggregates"),
        ("Section 802 of the Foreign Intelligence Surveillance Act, which section 201", "H.R. 471", "S. 483",
         "does not itself require its publication", "nearly 180 Reality Labs studies", "wrote on X, as TIME reported",
         "dismissed the appeal of xAI's 2025 Memphis permit"),
    ),
    "who-knew-first.html": (
        ("&#x27;$0 license fees", '<meta property="article:published_time" content="2026-09-23">',
         "1 hour to 90 minutes", "mainly from work with leading labs", "44 to 74 days", "10 to 40 days",
         "credited on 12 CVEs", "grasp of AI", "USD 125.8m.", "section 3.1.1", "only Forms 4 and 144", "Filings are confidential"),
        ("evaluations to improve its own AI cyberdefense", '<meta property="article:published_time" content="2026-09-25">',
         "in less than an hour", "significant revenue from work with leading labs", "54 days after the event",
         "13 CVEs", "USD 75.8m in total receipts", "section 2.1.1", "Ben Morris in collaboration with Claude"),
    ),
    "research-conferred-existence.html": (
        ("Candrakirti's lamp", "al-Ghazali's teaching", "Benjamin's victors writing history",
         "Its canonical anchor is"),
        # 3 October 2026: the October edition of this paper (tools/render_papers.py) spells the
        # name with its diacritics, so the pin follows the new text.
        ("Nāgārjuna's lamp argument", "Saheeh International", "Blessed be He, is truth", "seventh thesis"),
    ),
    "research-conservation-of-faithfulness.html": (
        ('"the difference that makes', "The Page curve:\n      information conserved and scrambled"),
        ('"a difference which makes', "estimates how slowly information leaves"),
    ),
    "conferred-existence-essay.html": (
        ("Three traditions that never met", "into a one-place vocabulary without losing a relatum"),
        ("Three traditions arrived at the same seam:", "addresses a person who can answer and refuse"),
    ),
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
