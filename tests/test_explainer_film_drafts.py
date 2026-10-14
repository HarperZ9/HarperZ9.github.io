"""Draft films: scene code in review, with provisional timing and no narration, render or page yet.

A film whose film.json says "draft": true is left out of the live-film checks. These hold it to what
a draft must be: its timing is provisional and covers the script sentence for sentence, its scene
imports one vendored engine tree, every fact the scene shows names a source that says it, it carries
no em dash or local path, and no live page shows it yet.
"""

import json
import re
from pathlib import Path

from tools.explainer.film.layout import check_anchors, plan
from tools.explainer.film.provisional_timing import build

ROOT = Path(__file__).resolve().parents[1]
DRAFTS = sorted(p.parent for p in (ROOT / "media" / "explainers").glob("*/film.json")
                if json.loads(p.read_text(encoding="utf-8")).get("draft"))
PAGE = (ROOT / "explainers.html").read_text(encoding="utf-8")
IMPORT = re.compile(r'"(?:\.\./)+raw-native/(tree-[0-9a-z]+|web-[0-9a-f]{7})/')


def load(folder: Path, name: str):
    return json.loads((folder / name).read_text(encoding="utf-8"))


def scene_files(folder: Path) -> list[Path]:
    return [folder / "film.scene.mjs", *sorted((folder / "scene").glob("*.mjs"))]


def test_timing_is_provisional_and_covers_the_script() -> None:
    for folder in DRAFTS:
        film, timing = load(folder, "film.json"), load(folder, "timing.json")
        said = [e["text"] for e in plan(film) if e["kind"] in ("say", "ask")]
        assert [r["text"] for r in timing] == said, folder.name
        assert all(r["provisional"] is True for r in timing), folder.name
        assert all(a["end"] <= b["start"] for a, b in zip(timing, timing[1:])), folder.name
        # The file is what the generator writes from this script: no hand-edited times.
        assert [(r["start"], r["end"]) for r in build(film)] == [(r["start"], r["end"]) for r in timing], folder.name


def test_predict_pauses_follow_the_one_convention() -> None:
    """Every predict pause is a list item with a spoken question and an anchor that names a sentence,
    and the timing holds its silence after the question (layout.py; approved 2026-10-14)."""
    for folder in DRAFTS:
        film, timing = load(folder, "film.json"), load(folder, "timing.json")
        assert check_anchors(film) == [], folder.name
        for i, seg in enumerate(film["segments"]):
            preds = seg.get("predict") or []
            assert isinstance(preds, list), f"{folder.name} segment {i}: predict must be a list"
            for n, p in enumerate(preds):
                assert p["question"].strip() and ("before" in p or "after" in p), f"{folder.name} segment {i}"
                at = next(m for m, r in enumerate(timing) if r.get("predict") == n and r["segment"] == i)
                if at + 1 < len(timing):
                    assert timing[at + 1]["start"] - timing[at]["end"] >= p.get("hold", 2.5) - 1e-6, f"{folder.name}: no hold after question {i}.{n}"


def test_a_misplaced_anchor_is_caught() -> None:
    """Control: an anchor that names no sentence is reported, not silently dropped."""
    film = {"segments": [{"key": "a", "lines": ["One. Two."], "predict": [{"after": [0, 5], "question": "Q?"}]}]}
    assert check_anchors(film)


def test_scene_imports_one_engine_tree() -> None:
    for folder in DRAFTS:
        trees = {m for f in scene_files(folder) for m in IMPORT.findall(f.read_text(encoding="utf-8"))}
        assert len(trees) == 1, f"{folder.name}: {sorted(trees)}"


def unsourced(folder: Path, ev: dict) -> list[str]:
    """Facts the scene shows whose shown value is not in the named source or the script."""
    script = " ".join(line for seg in load(folder, "film.json")["segments"] for line in seg["lines"])
    used = {k for f in scene_files(folder) for k in re.findall(r'fact\(\w+, "([a-z_]+)"\)', f.read_text(encoding="utf-8"))}
    bad = []
    for key in sorted(used):
        f = ev["facts"]["values"][key]
        src = ev["sources"][f["source"]]
        said = " ".join([*src["claims"], src["n"], src["short"], script])
        show = str(f.get("show", f["value"]))
        if not (show in said or show.replace(",", "") in said.replace(",", "")):
            bad.append(f"{key}={show} not in {f['source']}")
    return bad


def test_every_fact_names_a_source_that_says_it() -> None:
    for folder in DRAFTS:
        ev = load(folder, "evidence.json")
        if "facts" in ev:
            assert unsourced(folder, ev) == [], folder.name


def test_a_fact_check_can_fail() -> None:
    """Control: a shown value that no source says is caught (for drafts whose scenes show facts)."""
    for folder in DRAFTS:
        ev = load(folder, "evidence.json")
        used = re.findall(r'fact\(\w+, "([a-z_]+)"\)', "".join(f.read_text(encoding="utf-8") for f in scene_files(folder)))
        if "facts" not in ev or not used:
            continue
        ev["facts"]["values"][used[0]]["show"] = "987,654,321"
        assert unsourced(folder, ev), f"{folder.name}: a changed value was not caught"


def test_no_em_dashes_local_paths_or_live_page() -> None:
    for folder in DRAFTS:
        for f in [*scene_files(folder), folder / "film.json", folder / "evidence.json"]:
            body = f.read_text(encoding="utf-8")
            assert "—" not in body, f"{f.name} has an em dash"
            assert not re.search(r"[A-Z]:[\\/]", body), f"{f.name} has a local path"
        assert f'id="{folder.name}"' not in PAGE, f"{folder.name} is a draft and is on explainers.html"
