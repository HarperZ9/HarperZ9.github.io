"""The explainer videos match their receipts, use the risk scale, and sit on their page.

Rendering needs Windows (the narration voice). These checks need only the repository: a spec,
render file or output that changes without a re-render fails here.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from tools.explainer import marks
from tools.explainer import render
from tools.render_legacy_essays import EXPLAINERS

ROOT = Path(__file__).resolve().parents[1]
FOLDERS = sorted(p.parent for p in (ROOT / "media" / "explainers").glob("*/receipt.json"))


def test_there_are_explainers_to_check() -> None:
    assert {f.name for f in FOLDERS} >= {"cost-to-verify", "receipt-is-not-a-verdict"}


def test_every_receipt_matches_its_spec_code_and_outputs() -> None:
    for folder in FOLDERS:
        assert render.check(folder) == [], folder.name


def test_receipts_carry_limits_and_no_local_paths() -> None:
    for folder in FOLDERS:
        text = (folder / "receipt.json").read_text(encoding="utf-8")
        receipt = json.loads(text)
        assert receipt["does_not_prove"]
        assert receipt["rerun"].startswith("python -m tools.explainer.render media/explainers/")
        assert not re.search(r"[A-Za-z]:[\\/]|/Users/|AppData", text), folder.name


def test_status_marks_use_the_four_risk_levels() -> None:
    for folder in FOLDERS:
        spec = json.loads((folder / "spec.json").read_text(encoding="utf-8"))
        for scene in spec["scenes"]:
            for mark in scene.get("marks", []):
                level = marks.risk_of(mark)
                assert level is None or level in marks.LEVELS, (folder.name, scene["key"])


def test_one_hot_mark_per_view() -> None:
    view = [{"verdict": "MATCH"}, {"verdict": "DRIFT"}, {"risk": "elevated"}, {}]
    assert marks.hot_index(view) == 1
    assert marks.hot_index([{}, {"text": "plain"}]) == -1


def test_risk_colours_match_the_media_engine_tokens_when_present() -> None:
    colour = ROOT / "system/media-engine/colour.mjs"
    if not colour.is_file():
        return  # the engine's token file lands in its own change; marks.py carries the same values
    dark = re.search(r"dark:\s*Object\.freeze\(\{([^}]*)\}", colour.read_text(encoding="utf-8")).group(1)
    tokens = dict(re.findall(r'(\w+):\s*"(#[0-9a-fA-F]{6})"', dark))
    assert {k: tokens[k] for k in marks.RISK} == marks.RISK
    assert (tokens["ink"], tokens["quiet"]) == (marks.INK, marks.QUIET)


def test_each_explainer_is_on_its_page_with_captions_and_transcript() -> None:
    placed = {slug: page for page, sections in EXPLAINERS.items() for slug in sections.values()}
    for folder in FOLDERS:
        slug = folder.name
        html = (ROOT / placed[slug]).read_text(encoding="utf-8")
        assert f'id="explainer-{slug}"' in html, slug
        assert f'src="media/explainers/{slug}/{slug}.vtt"' in html, slug
        assert f'id="explainer-{slug}-transcript"' in html, slug
        assert "autoplay" not in html.split(f'id="explainer-{slug}"', 1)[1].split("</figure>", 1)[0]
