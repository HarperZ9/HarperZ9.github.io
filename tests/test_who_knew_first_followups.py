"""Contracts for the dated follow-ups that sit inside the op-ed's findings section."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "who-knew-first.html"


def test_second_october_follow_up_sits_after_the_first_inside_the_findings_section() -> None:
    page = PAGE.read_text(encoding="utf-8")
    first_end = page.index("<!-- follow-up:20261001:end -->")
    start = page.index("<!-- follow-up:20261001-transluce:start -->")
    end = page.index("<!-- follow-up:20261001-transluce:end -->")
    assert first_end < start < end < page.index("<!-- oped:end -->")
    block = page[start:end]
    assert '<h3 id="findings-20261001-transluce">Follow-up, October 1: when the requests are public' in block
    assert "What this does not prove:" in block
    assert "drafted with an Anthropic-built model" in block
    assert "55 websites" not in block and "\u2014" not in block
    cited = set(re.findall(r'href="#source-(s\d+)"', block))
    assert cited == {f"s{n}" for n in range(134, 144)}
    for sid in cited:
        assert f'<li id="source-{sid}">' in page


def test_second_october_follow_up_is_logged_under_corrections() -> None:
    page = PAGE.read_text(encoding="utf-8")
    corrections = page[page.index('<h2 id="corrections">'):page.index('<h2 id="sources">')]
    assert 'href="#findings-20261001-transluce">second dated follow-up</a>' in corrections
    assert "It does not change the nine cases, chart or author paragraphs." in corrections
