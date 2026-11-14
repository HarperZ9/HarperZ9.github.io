"""The portfolio's contribution record lists what the census lists, once each.

career/open-source-census.json is what GitHub reported. The page may not name a
pull request the census does not hold, may not drop one it does, and may not
move one into a better group than the one GitHub reported.
"""

from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CENSUS = json.loads((ROOT / "career" / "open-source-census.json").read_text(encoding="utf-8"))
PAGE = (ROOT / "portfolio.html").read_text(encoding="utf-8")
PULL = re.compile(r'href="(https://github\.com/[^"/]+/[^"/]+/pull/\d+)"')
HEADINGS = {"merged": "Merged", "open": "Open", "closed_unmerged": "Closed without merge"}


def _groups() -> dict[str, list[str]]:
    record = PAGE.split("<!-- contribution-record:start -->", 1)[1]
    record = record.split("<!-- contribution-record:end -->", 1)[0]
    found = {}
    for bucket, heading in HEADINGS.items():
        block = record.split(f"<h3>{heading} (", 1)[1].split("</ol>", 1)[0]
        found[bucket] = PULL.findall(block)
    return found


def test_page_matches_generator_output() -> None:
    proc = subprocess.run(
        [sys.executable, str(ROOT / "tools" / "render_contribution_record.py"), "--check"],
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_each_census_pull_request_is_listed_once_in_its_own_group() -> None:
    groups = _groups()
    for bucket, urls in groups.items():
        expected = sorted(i["url"] for i in CENSUS["buckets"][bucket]["items"])
        assert sorted(urls) == expected, f"{bucket} list and census disagree"
    every = [u for urls in groups.values() for u in urls]
    assert len(every) == len(set(every)) == CENSUS["totals"]["all"]


def test_page_names_no_pull_request_outside_the_census() -> None:
    known = {i["url"] for v in CENSUS["buckets"].values() for i in v["items"]}
    assert set(PULL.findall(PAGE)) <= known


def test_page_states_when_the_counts_were_read() -> None:
    assert f'<span data-census="read-on">{CENSUS["read_on"]}</span>' in PAGE
    assert "closed without merge" in PAGE
