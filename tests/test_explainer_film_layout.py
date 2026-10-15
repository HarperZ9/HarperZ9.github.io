"""The film sound plan (tools/explainer/film/layout.py) that narrate.py records and the provisional
timing estimates: sentence splitting, the old gaps for live films, and the pauses a film declares."""

import json
import re
from pathlib import Path

from tools.explainer.film.layout import GAP_LINE, GAP_SEGMENT, GAP_SENTENCE, HEAD, check_anchors, plan, sentences
from tools.explainer.film.provisional_timing import build

ROOT = Path(__file__).resolve().parents[1]
LIVE = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((ROOT / "media" / "explainers").glob("*/film.json"))
        if not json.loads(p.read_text(encoding="utf-8")).get("draft")]


def old_split(line: str) -> list[str]:
    return [s for s in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", line.strip()) if s]


def test_initials_and_abbreviations_stay_in_their_sentence() -> None:
    assert sentences("In 1973, B. E. Bayer published a pattern for this. It is still used.") == [
        "In 1973, B. E. Bayer published a pattern for this.", "It is still used."]
    assert sentences("Kumar et al. 2018 ran the checks. Errors fell.") == ["Kumar et al. 2018 ran the checks.", "Errors fell."]
    assert sentences("One. Two? Three!") == ["One.", "Two?", "Three!"]


def test_live_films_keep_their_old_sentences_and_gaps() -> None:
    """The five live films were narrated with the old splitter and gaps; the plan reproduces both."""
    for film in LIVE:
        ev = plan(film)
        said = [e["text"] for e in ev if e["kind"] == "say"]
        assert said == [s for seg in film["segments"] for line in seg["lines"] for s in old_split(line)], film["slug"]
        gaps = [e["seconds"] for e in ev if e["kind"] == "silence"]
        assert gaps[0] == HEAD and set(gaps[1:]) <= {GAP_SENTENCE, GAP_LINE, GAP_SEGMENT}, film["slug"]
        assert not any(e["kind"] == "ask" for e in ev)


def test_a_film_declares_its_pauses_and_the_plan_places_them() -> None:
    film = {"slug": "x", "host": {"open": {"seconds": 4.0}, "close": {"seconds": 5.0}},
            "segments": [{"key": "a", "lines": ["One. Two.", "Three."],
                          "predict": [{"after": [0, 1], "question": "What next?", "hold": 2.5}],
                          "holds": [{"before": [1, 0], "seconds": 3.0, "what": "a picture"}]}]}
    ev = [(e["kind"], e.get("text") or e.get("why"), e.get("seconds")) for e in plan(film)]
    assert ev == [("silence", "head", HEAD), ("silence", "host open", 4.0), ("say", "One.", None), ("silence", "gap", GAP_SENTENCE),
                  ("say", "Two.", None), ("silence", "gap", GAP_LINE), ("ask", "What next?", None), ("silence", "predict", 2.5),
                  ("silence", "hold", 3.0), ("say", "Three.", None), ("silence", "gap", GAP_SEGMENT), ("silence", "host close", 5.0)]
    rows = build(film)
    assert [r.get("predict") for r in rows] == [None, None, 0, None]
    q, nxt = rows[2], rows[3]
    assert nxt["start"] - q["end"] >= 2.5 + 3.0 - 1e-6
    assert check_anchors(film) == []


def test_a_bad_anchor_is_reported() -> None:
    assert check_anchors({"segments": [{"lines": ["One."], "holds": [{"before": [2, 0], "seconds": 1}]}]})
