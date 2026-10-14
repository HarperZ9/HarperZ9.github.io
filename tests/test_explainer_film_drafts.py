"""Draft films: scene code in review, with provisional timing and no narration, render or page yet.

A film whose film.json says "draft": true is left out of the live-film checks. These hold it to what
a draft must be: its timing is provisional and covers the script sentence for sentence, its scene
imports one vendored engine tree, every fact the scene shows names a source that says it, it carries
no em dash or local path, and no live page shows it yet.
"""

import json
import re
from pathlib import Path

from tools.explainer.film.narrate import sentences
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


def test_there_is_a_draft() -> None:
    assert DRAFTS, "no draft film; delete this file once the last draft ships"


def test_timing_is_provisional_and_covers_the_script() -> None:
    for folder in DRAFTS:
        film, timing = load(folder, "film.json"), load(folder, "timing.json")
        said = [s for seg in film["segments"] for line in seg["lines"] for s in sentences(line)]
        assert [r["text"] for r in timing] == said, folder.name
        assert all(r["provisional"] is True for r in timing), folder.name
        assert all(a["end"] <= b["start"] for a, b in zip(timing, timing[1:])), folder.name
        # The file is what the generator writes from this script: no hand-edited times.
        assert [(r["start"], r["end"]) for r in build(film)] == [(r["start"], r["end"]) for r in timing], folder.name


def test_predict_beats_are_silent_holds() -> None:
    for folder in DRAFTS:
        film, timing = load(folder, "film.json"), load(folder, "timing.json")
        for i, seg in enumerate(film["segments"]):
            p = seg.get("predict")
            if not p:
                continue
            j, k = p["before"]
            at = next(n for n, r in enumerate(timing) if (r["segment"], r["line"], r["sentence"]) == (i, j, k))
            assert timing[at]["start"] - timing[at - 1]["end"] >= p["seconds"], f"{folder.name}: no hold before {i}.{j}.{k}"
            assert "pending" in p["status"]


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
        assert unsourced(folder, load(folder, "evidence.json")) == [], folder.name


def test_a_fact_check_can_fail() -> None:
    """Control: a shown value that no source says is caught."""
    for folder in DRAFTS:
        ev = load(folder, "evidence.json")
        used = re.findall(r'fact\(\w+, "([a-z_]+)"\)', (folder / "scene" / "s1-check.mjs").read_text(encoding="utf-8")
                          + "".join(f.read_text(encoding="utf-8") for f in scene_files(folder)))
        ev["facts"]["values"][used[0]]["show"] = "987,654,321"
        assert unsourced(folder, ev), f"{folder.name}: a changed value was not caught"


def test_no_em_dashes_local_paths_or_live_page() -> None:
    for folder in DRAFTS:
        for f in [*scene_files(folder), folder / "film.json", folder / "evidence.json"]:
            body = f.read_text(encoding="utf-8")
            assert "—" not in body, f"{f.name} has an em dash"
            assert not re.search(r"[A-Z]:[\\/]", body), f"{f.name} has a local path"
        assert f'id="{folder.name}"' not in PAGE, f"{folder.name} is a draft and is on explainers.html"
