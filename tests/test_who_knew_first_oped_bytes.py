"""The author's op-ed on who-knew-first.html stays byte-identical to its first publication.

The op-ed runs between the <!-- oped:start --> and <!-- oped:end --> markers. Two kinds of
block inside it are marked insertions that the site may change: the finding-note asides and
the closing wkf-findings follow-up section. Every other non-blank line is the author's own
text and must match the first publication (commit 5904d39) byte for byte.

CI checks out one commit, so the guard pins the digest of the author blocks. When the first
publication is reachable in local history, the blocks are also compared line by line.
"""

from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "who-knew-first.html"
FIRST_PUBLICATION = "5904d39"
AUTHOR_BLOCK_COUNT = 64
AUTHOR_BLOCKS_SHA256 = "46bdfe9828b68ef5783dfe2ef7e776c3348d87002a287aa98a6a05c142b2672e"


def author_blocks(text: str) -> list[str]:
    start = text.index("<!-- oped:start -->")
    end = text.index("<!-- oped:end -->")
    blocks: list[str] = []
    in_findings = False
    for line in text[start:end].split("\n"):
        if line.startswith('<section class="wkf-findings"'):
            in_findings = True
        if in_findings:
            if line.startswith("</section>"):
                in_findings = False
            continue
        if line.startswith('<aside class="wkf-finding-note"'):
            continue
        if line.strip():
            blocks.append(line)
    return blocks


def digest(blocks: list[str]) -> str:
    return hashlib.sha256("\n".join(blocks).encode("utf-8")).hexdigest()


def current_blocks() -> list[str]:
    return author_blocks(PAGE.read_bytes().decode("utf-8").replace("\r\n", "\n"))


def test_author_blocks_match_the_pinned_first_publication_digest() -> None:
    blocks = current_blocks()
    assert len(blocks) == AUTHOR_BLOCK_COUNT
    assert digest(blocks) == AUTHOR_BLOCKS_SHA256


def test_author_blocks_match_the_first_publication_when_history_is_available() -> None:
    result = subprocess.run(
        ["git", "-C", str(ROOT), "show", f"{FIRST_PUBLICATION}:who-knew-first.html"],
        capture_output=True,
    )
    if result.returncode != 0:
        pytest.skip("first publication is not in local history (shallow checkout)")
    base = author_blocks(result.stdout.decode("utf-8").replace("\r\n", "\n"))
    assert current_blocks() == base


def test_the_guard_rejects_an_edited_author_sentence() -> None:
    blocks = current_blocks()
    edited = [line.replace("1 to 9 days", "2.35 to 9 days") for line in blocks]
    assert edited != blocks, "the author's 1 to 9 days sentence must stay in the op-ed"
    assert digest(edited) != AUTHOR_BLOCKS_SHA256


def test_security_path_range_outside_the_op_ed_matches_the_clock_chart() -> None:
    text = PAGE.read_text(encoding="utf-8")
    after_oped = text[text.index("<!-- oped:end -->"):]
    assert "reached the public 2.35 to 9 days after the operator became aware" in after_oped
    assert "reached the public 2.35 to 9 days after awareness." in after_oped
    corrections = after_oped[after_oped.index('<h2 id="corrections">'):after_oped.index('<h2 id="sources">')]
    assert "September 26, 2026: the summary and the closing line" in corrections
    assert "No figure in the chart or table changed." in corrections
    assert "1 to 9 days after" not in after_oped
