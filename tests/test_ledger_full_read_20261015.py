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
)
PRESENT = (
    "The two posts name different builds of one model: the 16 Jul disclosure links zai-org/GLM-5.2"
    " (the link was added on 30 Jul)",
    # The batch 1 change from 3.86 to 3.85 days was withdrawn in batch 3: the ledger counts from the
    # 08:35 UTC commit that disabled registrations, which gives 3.86.
    "Reopened registrations after about 3.86 days, counted from the 08:35 UTC change that disabled them",
    "the registration pause of about 3.86 days",
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


# Batch 2 (WKF-0116 to WKF-0233), plus three batch 1 citation gaps (WKF-0040, -0045, -0050).
B2_GONE = (
    "a scan that missed one incident found later in August",
    "(runs from January and April, found on 24 Jul and in August)",
    "and ongoing checks of names",
    "It committed to clearer setup documentation with customers and to continuous re-checking",
    "within minutes, the malicious pull request",
)
B2_PRESENT = (
    "a scan that missed one incident, found later (in August, as Anthropic&#x27;s post implies)",
    "found on 24 Jul and, as Anthropic&#x27;s post implies, in August",
    "and says fictional names need continuous re-checking",
    "It plans clearer setup documentation with customers and says fictional names need continuous re-checking",
    "by the 11:42 BST incident declaration 46 minutes after the alert reached the evaluation team",
)
# Each entry phrase must be followed, in its own Sources list, by the added source.
B2_SOURCES = (
    ("1,000 to 2,000 accounts and 500-plus yanked packages", "2026/09/11/update-may-spam-publishing-campaign.html"),
    ("Ruby Central formalized status-page protocols in March 2026", "Ruby%20Central/2026-03.md"),
    ("limited log retention", "security-advisory-legacy-api-key-leak.html"),
    ("systems the internal research model scanned (about 9,000)", "news/investigating-incidents-cybersecurity-evals"),
    ("would hold runs or deployments until METR", "anthropic-follow-up-letter.pdf"),
    ("It had its own 21 Jul findings", "cheating-behaviour-in-frontier-model-evaluations"),
    ("framework of 16 Sep says serious incidents should be shared", "model-misalignment-reporting-framework"),
    ("Meta knew of the incident and had confirmed it to press", "cnn.com/2026/08/05/tech/meta-ai-hacking"),
    ("found on 24 Jul and, as Anthropic&#x27;s post implies, in August", "research/alignment-assessment-cybersecurity-incidents"),
)
B2_NOTES = (
    "October 15, 2026: sources added, ledger entries: eight entries stated facts",
    "October 15, 2026: clarification, Google and Meta ledgers",
    "October 15, 2026: correction, AISI and Sol ledger and Google ledger",
)


def entry_sources(t: str, phrase: str) -> str:
    i = t.index(phrase)
    j = t.index('<details class="wkf-src">', i)
    return t[j:t.index("</details>", j)]


def test_batch2_fixes_present_and_old_wording_gone() -> None:
    t = body(text())
    for phrase in B2_GONE:
        assert phrase not in t, phrase
    for phrase in B2_PRESENT:
        assert phrase in t, phrase


def test_batch2_entries_cite_the_source_that_carries_the_claim() -> None:
    t = text()
    for phrase, url in B2_SOURCES:
        block = entry_sources(t, phrase)
        assert url in block, (phrase, url)
        n = int(re.search(r"Sources \((\d+)\)", block).group(1))
        assert block.count("<li>") == n, phrase


def test_batch2_notes_are_dated_and_quote_the_old_text() -> None:
    notes = CORRECTIONS.search(text()).group(1)
    for phrase in B2_NOTES:
        assert phrase in notes, phrase
    for old in ("a scan that missed one incident found later in August", "within minutes",
                "committed to clearer setup documentation with customers and to continuous re-checking"):
        assert old in notes, old


# Batch 3 (WKF-0234 to WKF-0357).
B3_GONE = (
    "OpenAI&#x27;s first observation of agent message-board activity",
    "had not (vendor-claimed, 24 Aug letter)",
    "Irregular&#x27;s news page lists no press item after 2026-06-16",
    "and no Gemini assessment at any date; whether Meta or Google still use Irregular is unknown",
)
B3_PRESENT = (
    "an OpenAI internal team&#x27;s observation of agent message-board activity",
    "had not (vendor-claimed: the 24 Aug letter for A, B and C, the 9 Sep post for D)",
    "Irregular&#x27;s news page listed no press item after 2026-06-16 when read on 24 Sep; a 28 Sep item has since been added",
    "On 13 Oct it added one of Gemini 4 Argon, which Google DeepMind ran on CyScenarioBench",
    "once OpenAI linked its agents (Hugging Face ledger).",
)
B3_SOURCES = (
    ("whether the Code applied to a model not yet on the EU market is unknown", "policies/contents-code-gpai"),
    ("only the linked 244-page card described the escape", "Claude%20Mythos%20Preview%20System%20Card.pdf"),
    ("commitment to clear reporting criteria came later, on 9 Sep", "research/alignment-assessment-cybersecurity-incidents"),
    ("Google says it notified the three companies and federal authorities (vendor-claimed)", "rcna598651"),
    ("(OpenAI is a signatory; a voluntary compliance route", "policies/contents-code-gpai"),
    ("Against the roughly 21 hours it took to acknowledge DSEWiki", "exclusive-openai-agents-hijacked-german-100307199"),
    ("Against the roughly 21 hours it took to acknowledge DSEWiki", "x.com/OpenAI/status/2096133504417616165"),
    ("said there was no formal report", "exclusive-openai-didnt-report-another-incident-under-eu-ai-safety-rules"),
    ("said there was no formal report", "ai-safety-incident-reporting-not-just-a-tick-box-warns-eu"),
    ("8-K on its Hugging Face acquisition was accepted the same morning", "0001045810-26-000078-index.htm"),
    ("figures of 6 and 12 business days appear only in third-party reports", "openai-six-misalignment-incident-reports"),
    ("the public prospectus was not expected until late September", "anthropic-ipo-launch-shifts-toward-mid-october-reuters"),
    ("3.5 Flash Cyber was already cited in the 22 Jul earnings release", "googexhibit991q22026.htm"),
    ("the 9 Sep post for D)", "1AI7pCaa_s6cb_jRBHVonGa50OjUyBqkQ"),
    ("the 9 Sep post for D)", "research/alignment-assessment-cybersecurity-incidents"),
)
B3_NOTES = (
    "October 15, 2026: correction, interests table: five OpenAI entries dated",
    "October 15, 2026: correction, interests table: the Anthropic Series H entry",
    "October 15, 2026: update, interests table: two Irregular entries",
    "October 15, 2026: sources added, ledger entries and interests table: thirteen entries",
    "October 15, 2026: correction withdrawn, RubyGems ledger",
)


def test_batch3_fixes_present_and_old_wording_gone() -> None:
    t = body(text())
    for phrase in B3_GONE:
        assert phrase not in t, phrase
    for phrase in B3_PRESENT:
        assert phrase in t, phrase


def test_batch3_entries_cite_the_source_that_carries_the_claim() -> None:
    t = text()
    for phrase, url in B3_SOURCES:
        block = entry_sources(t, phrase)
        assert url in block, (phrase, url)
        n = int(re.search(r"Sources \((\d+)\)", block).group(1))
        assert block.count("<li>") == n, phrase
    # The Meta 8-K index goes to the interests entry, not the chart tooltip that repeats the text.
    i = t.index("Q2 2026 earnings (8-K accepted 2026-07-29 20:03:23Z)")
    j = t.index("Q2 2026 earnings (8-K accepted 2026-07-29 20:03:23Z)", i + 1)
    assert "0001628280-26-050596-index.htm" in entry_sources(t[j:], "Q2 2026 earnings")


def test_batch3_notes_are_dated_and_quote_the_old_text() -> None:
    notes = CORRECTIONS.search(text()).group(1)
    for phrase in B3_NOTES:
        assert phrase in notes, phrase
    for old in ("OpenAI&#x27;s first observation of agent message-board activity",
                "vendor-claimed, 24 Aug letter", "lists no press item after 2026-06-16",
                "no Gemini assessment at any date"):
        assert old in notes, old
