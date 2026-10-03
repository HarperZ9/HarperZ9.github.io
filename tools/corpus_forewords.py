"""Dated forewords that sit above an archived corpus, apart from the deposited text.

A corpus page reproduces a deposit with a permanent DOI, so its deposited text is never
edited (tools/corpus_corrections.py). A foreword is site prose written later and dated: it
renders above the deposit in its own section, closed by a rule, and the word count in the
page footer counts the deposit only.
"""

from __future__ import annotations

from pathlib import Path

from tools.paper_markdown import render

ROOT = Path(__file__).resolve().parents[1]

FOREWORDS: dict[str, str] = {
    "witnessing-spine.html": "writing/papers/witnessing-spine-foreword.md",
}


def foreword(page: str) -> str:
    """Return the foreword section for a corpus page, or an empty string."""
    source = FOREWORDS.get(page)
    if not source:
        return ""
    body = render((ROOT / source).read_text(encoding="utf-8").replace("\r\n", "\n").strip())
    return f'<section id="foreword" class="corpus-foreword">\n{body}\n</section>\n<hr class="corpus-rule">\n'
