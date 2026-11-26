"""Every Who Knew First series page carries one "Continue the series" table, built from one definition.

The table is rendered by tools/series_table.py from publications/data/series/who-knew-first.json.
Publishing a part means adding its id there; these contracts fail if any page drifts from the
definition, marks the wrong current row, or links to a page that does not exist.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.series_table import BEGIN, END, carrier_routes, reading_minutes, series_rows  # noqa: E402

SERIES = json.loads((ROOT / "publications/data/series/who-knew-first.json").read_text(encoding="utf-8"))
EXPECTED_CARRIERS = ["why-i-do-this.html", "who-knew-first.html", "who-pays-the-referees.html", "the-terms-for-telling.html",
                     "who-kept-the-books.html", "the-maker-is-part-of-the-story.html",
                     "a-check-it-cannot-predict.html",
                     "who-knew-first-series.html"]


def text(value: str) -> str:
    return " ".join(unescape(re.sub(r"<[^>]+>", " ", value)).split())


def block(route: str) -> str:
    page = (ROOT / route).read_text(encoding="utf-8")
    assert page.count(BEGIN) == 1 and page.count(END) == 1, f"{route} must carry exactly one series table"
    return page.split(BEGIN, 1)[1].split(END, 1)[0]


def test_every_table_matches_the_definition() -> None:
    result = subprocess.run([sys.executable, "tools/series_table.py", "--check"], cwd=ROOT,
                            capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


def test_every_series_page_carries_the_table() -> None:
    assert carrier_routes(SERIES) == EXPECTED_CARRIERS
    for route in carrier_routes(SERIES):
        page = (ROOT / route).read_text(encoding="utf-8")
        assert "system/series-table.css" in page, route
        assert 'id="continue-the-series"' in block(route), route


def test_rows_follow_the_publication_order_and_mark_the_current_page() -> None:
    rows = series_rows(SERIES)
    assert [row["title"] for row in rows] == ["A Bullshitter Knows a Bullshitter", "Who Knew First", "Who Pays the Referees", "The Terms for Telling",
                                              "Who Kept the Books", "The Maker Is Part of the Story",
                                              "A Check It Cannot Predict"]
    numbered = [row for row in rows if row["n"] != "start"]
    for route in carrier_routes(SERIES):
        found = re.findall(r'<tr data-part="(\d)" class="sc-row sc-(\w+)"( aria-current="page")?>(.*?)</tr>',
                           block(route), re.S)
        assert [int(n) for n, *_ in found] == list(range(6)), route
        for (n, state, current, cells), row in zip(found, numbered):
            assert row["title"] in text(cells)
            assert row["question"] in text(cells)
            is_here = row["route"] == route
            assert bool(current) == is_here and (state == "current") == is_here, (route, n)
            if not row["route"]:
                assert state == "planned" and "href=" not in cells and "Planned" in text(cells)
            elif is_here:
                assert "href=" not in cells and "You are here" in text(cells)
            else:
                assert f'href="{row["route"]}"' in cells and "Published" in text(cells)
                assert f'{reading_minutes((ROOT / row["route"]).read_text(encoding="utf-8"))} min' in text(cells)


def test_each_question_is_one_plain_sentence() -> None:
    for row in series_rows(SERIES):
        question = row["question"]
        assert question.endswith("?") and question.count("?") == 1, question
        assert not re.search(r"[.!;:]", question), question
        assert "—" not in question and len(question.split()) <= 22, question


def test_tables_link_only_to_pages_that_exist() -> None:
    for route in carrier_routes(SERIES):
        for href in re.findall(r'href="([^"#]+)', block(route)):
            assert not href.startswith(("http:", "https:", "//")), (route, href)
            assert (ROOT / href.lstrip("/")).is_file(), f"{route} links to missing {href}"


def test_no_hashes_or_slugs_on_the_reader_surface() -> None:
    for route in carrier_routes(SERIES):
        visible = text(re.sub(r"<svg.*?</svg>", " ", block(route), flags=re.S))
        assert not re.search(r"\b[0-9a-f]{12,}\b|sha256|\.html|—", visible), route


def test_narrow_screens_stack_rows_instead_of_scrolling() -> None:
    css = (ROOT / "system/series-table.css").read_text(encoding="utf-8")
    narrow = css.split("@media (max-width:44rem){", 1)[1].split("\n}", 1)[0]
    assert ".sc-table,.sc-table tbody,.sc-table tr,.sc-table td,.sc-table tbody th{display:block}" in narrow
    assert "grid-template-columns:3.4rem minmax(0,1fr)" in narrow
    assert "width:auto!important" in narrow
    assert "min(60rem,calc(100vw - 32px))" in css


def test_the_opener_row_comes_first_on_every_page_and_has_no_blade() -> None:
    """A Bullshitter Knows a Bullshitter is the "Start here" row: above the anchor, linked, and the aperture's core."""
    opener = SERIES["opener"]
    for route in carrier_routes(SERIES):
        table = block(route)
        rows = re.findall(r'<tr data-part="([^"]+)" class="sc-row ([^"]+)"( aria-current="page")?>(.*?)</tr>', table, re.S)
        assert rows[0][0] == "start" and "sc-opener" in rows[0][1], route
        cells = rows[0][3]
        assert "Start here" in text(cells) and opener["text"] in text(cells) and opener["question"] in text(cells)
        here = route == opener["href"]
        assert bool(rows[0][2]) == here and ("sc-current" in rows[0][1]) == here, route
        assert ('href="why-i-do-this.html"' in cells) != here, route
        assert table.count('class="sc-blade ') == 6 and 'data-part="start"' not in table.split("</svg>", 1)[0]
        assert ('class="sc-core sc-core-current"' in table) == here, route
        lede = re.search(r'<p class="sc-lede">(.*?)</p>', table, re.S).group(1)
        assert "of 6 are published" in text(lede), route
        assert ("opens it" in text(lede)) == here, route
        assert ('href="why-i-do-this.html"' in lede) == (not here and route != SERIES["route"]), route
