"""The coast map draws the whole curriculum: every made lesson is a link on the map and in the
list beneath it, a planned lesson is drawn but not linked, and the published page is the one the
generator writes from the current curriculum.
"""

from __future__ import annotations

import copy
import json
import re
from pathlib import Path

import pytest

from tools.school.coast import LIGHTS, coast_page, coast_svg

ROOT = Path(__file__).resolve().parents[1]
CUR = json.loads((ROOT / "media" / "school" / "curriculum.json").read_text(encoding="utf-8"))
PAGE = (ROOT / "night-school-coast.html").read_text(encoding="utf-8")


def test_the_published_page_is_the_generated_one() -> None:
    # The head's card lines are stamped afterwards by tools/repo_art/site_cards.py; the rest is the generator's.
    body = lambda page: page[page.index('<div class="frame">'):]  # noqa: E731
    assert body(PAGE) == body(coast_page(CUR))


def test_every_made_lesson_is_linked_on_the_map_and_in_the_list() -> None:
    svg = PAGE[PAGE.index('<svg class="cm"'):PAGE.index("</svg>")]
    rest = PAGE[PAGE.index('id="places"'):]
    made = [le for le in CUR["lessons"] if le.get("href")]
    assert made, "the curriculum has made lessons"
    for le in made:
        assert svg.count(f'<a href="{le["href"]}"') == 1, le["id"]
        assert f'href="{le["href"]}"' in rest, le["id"]
        assert (ROOT / le["href"]).is_file(), le["href"]
    assert svg.count("<a href=") == len(made)


def test_a_planned_lesson_is_drawn_but_not_linked() -> None:
    planned = [le for le in CUR["lessons"] if not le.get("href")]
    for le in planned:
        assert f'data-id="{le["id"]}" role="img"' in PAGE, le["id"]


def test_each_lit_path_joins_a_lesson_to_one_it_needs() -> None:
    n = sum(len(le["needs"]) for le in CUR["lessons"])
    paths = re.search(r'<g class="cm-path"[^>]*>(.*?)</g></g>', PAGE).group(0)
    assert paths.count("<path ") == n


def test_a_lesson_without_a_place_on_the_map_fails_the_build() -> None:
    cur = copy.deepcopy(CUR)
    cur["lessons"].append({"id": "X99", "track": "A", "title": "Unplaced", "needs": [], "status": "planned"})
    with pytest.raises(SystemExit, match="X99"):
        coast_svg(cur)


def test_every_light_is_inside_the_map() -> None:
    for i, (_, x, y) in LIGHTS.items():
        assert 20 <= x <= 1165 and 20 <= y <= 740, i
