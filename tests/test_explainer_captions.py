"""The caption on the stage never contradicts the outcome the figure computes.

A scene whose figure depends on the reader's values gives "outcome" (a binding) and one caption
per outcome word. These tests walk a grid of parameter values through the same state function the
offline video and the live stage draw with, and fail when:

- a scene's verdict or heading changes with the values but its caption is one fixed string;
- the caption shown is not the variant keyed by the computed outcome;
- a computed verdict anywhere in the explainer, drawn from the outcome's words, differs from it;
- the caption shown asserts a different outcome (the phrase table below);
- the default values do not narrate the caption the video's receipt recorded.

Controls at the end feed a swapped and a fixed caption through the same checks and require them
to fail, so a passing run is not vacuous.
"""

from __future__ import annotations

import copy
import itertools
import json
from pathlib import Path

from tools.explainer import scene

ROOT = Path(__file__).resolve().parents[1]
FOLDERS = sorted(p.parent for p in (ROOT / "media" / "explainers").glob("*/spec.json"))

# Phrases that assert one outcome. A caption shown under any other outcome must not contain them.
ASSERTS = {
    "MATCH": ["claim holds", "says yes"],
    "DRIFT": ["claim fails", "reports drift"],
    "PASS": ["a pass writes a receipt", "passed: receipt written"],
    "FAIL": ["no candidate passed", "with no pass", "no receipt is written"],
}
OPPOSITE = {"MATCH": "DRIFT", "DRIFT": "MATCH", "PASS": "FAIL", "FAIL": "PASS"}


def load(folder: Path):
    spec = json.loads((folder / "spec.json").read_text(encoding="utf-8"))
    receipt = json.loads((folder / "receipt.json").read_text(encoding="utf-8"))
    return spec, receipt


def grid(spec: dict) -> list[dict]:
    """Every combination of five points per range parameter and every option of a choice."""
    axes = []
    for p in spec.get("params", []):
        if p.get("kind", "range") == "range":
            pts = [p["min"] + (p["max"] - p["min"]) * i / 4 for i in range(5)] + [p["default"]]
        else:
            pts = [o["value"] for o in p["options"]]
        axes.append([(p["id"], v) for v in pts])
    return [dict(combo) for combo in itertools.product(*axes)] or [{}]


def shown(spec: dict, receipt: dict, overrides: dict) -> list[dict]:
    """The frame state at each scene's settled still, as the stage draws it."""
    rows = scene.timeline(spec, receipt)
    scenes = scene.resolved_scenes(spec, overrides)
    return [scene.frame_state(scenes, rows, start + (end - start) * 0.97) for _, start, end in rows]


def problems(spec: dict, receipt: dict) -> list[str]:
    out = []
    raw = {s["key"]: s for s in spec["scenes"]}
    states = {json.dumps(o, sort_keys=True): shown(spec, receipt, o) for o in grid(spec)}
    # A verdict that changes with the values, and its words.
    computed = {}
    for sts in states.values():
        for st in sts:
            for j, m in enumerate(st["marks"]):
                computed.setdefault((st["scene"], j), set()).add(m.get("verdict"))
    computed = {k: v for k, v in computed.items() if len(v) > 1}
    for key, s in raw.items():
        seen = {(st["heading"], json.dumps([m.get("verdict") for m in st["marks"]]))
                for sts in states.values() for st in sts if st["scene"] == key}
        if len(seen) > 1 and not isinstance(s["say"], dict):
            out.append(f"{spec['slug']}/{key}: the figure changes with the values but the caption is fixed")
    for label, sts in states.items():
        for st in sts:
            s = raw[st["scene"]]
            outcome = st["outcome"]
            if isinstance(s["say"], dict):
                if outcome not in s["say"]:
                    out.append(f"{spec['slug']}/{st['scene']} {label}: no caption for outcome {outcome}")
                    continue
                expected = scene.resolve(s["say"][outcome], scene.values(spec, json.loads(label)))
                if st["say"] != expected:
                    out.append(f"{spec['slug']}/{st['scene']} {label}: caption is not the {outcome} variant")
                for (where, j), words in computed.items():
                    if outcome in words:
                        verdict = next(x for x in sts if x["scene"] == where)["marks"][j].get("verdict")
                        if verdict != outcome:
                            out.append(f"{spec['slug']}/{st['scene']} {label}: outcome {outcome}, figure shows {verdict}")
            if outcome in OPPOSITE:
                hits = [ph for ph in ASSERTS[OPPOSITE[outcome]] if ph in st["say"].lower()]
                if hits:
                    out.append(f"{spec['slug']}/{st['scene']} {label}: outcome {outcome}, caption says {hits}")
    return out


def test_every_explainer_has_a_spec_and_receipt() -> None:
    assert len(FOLDERS) >= 3 and all((f / "receipt.json").is_file() for f in FOLDERS)


def test_no_caption_contradicts_the_computed_outcome() -> None:
    found = [p for folder in FOLDERS for p in problems(*load(folder))]
    assert found == [], found[:10]


def test_keyed_captions_exist_where_the_figure_branches() -> None:
    keyed = {(f.name, s["key"]) for f in FOLDERS for s in load(f)[0]["scenes"] if isinstance(s["say"], dict)}
    assert {("receipt-is-not-a-verdict", "split"), ("receipt-loop", "receipt"), ("receipt-loop", "budget")} <= keyed


def test_the_video_narrates_the_default_captions() -> None:
    for folder in FOLDERS:
        spec, receipt = load(folder)
        said = [s["say"] for s in scene.resolved_scenes(spec)]
        assert said == [row["text"] for row in receipt["timeline"]], folder.name


def test_live_and_offline_pick_the_same_caption() -> None:
    """state.mjs picks the caption with the same rule; the parity test compares whole states, this
    names the caption directly at every grid point."""
    import shutil
    import subprocess

    node = shutil.which("node")
    if node is None:
        import pytest
        pytest.skip("node is not on PATH")
    for folder in FOLDERS:
        spec, receipt = load(folder)
        rows = scene.timeline(spec, receipt)
        times = [str(start + (end - start) * 0.97) for _, start, end in rows]
        for overrides in grid(spec)[:: max(1, len(grid(spec)) // 12)]:
            ours = [(st["say"], st["outcome"]) for st in shown(spec, receipt, overrides)]
            out = subprocess.run([node, "tools/explainer/state_dump.mjs", str(folder.relative_to(ROOT)),
                                  json.dumps(overrides), *times], cwd=ROOT, capture_output=True, text=True, check=True).stdout
            theirs = [(st["say"], st["outcome"]) for st in json.loads(out)]
            assert ours == theirs, (folder.name, overrides)


def test_control_swapped_captions_fail() -> None:
    spec, receipt = load(ROOT / "media/explainers/receipt-is-not-a-verdict")
    bad = copy.deepcopy(spec)
    split = next(s for s in bad["scenes"] if s["key"] == "split")
    split["say"] = {"MATCH": split["say"]["DRIFT"], "DRIFT": split["say"]["MATCH"]}
    found = problems(bad, receipt)
    assert any("caption says" in p for p in found), found


def test_control_a_fixed_caption_over_a_changing_verdict_fails() -> None:
    spec, receipt = load(ROOT / "media/explainers/receipt-loop")
    bad = copy.deepcopy(spec)
    for s in bad["scenes"]:
        if s["key"] == "receipt":
            s["say"] = s["say"]["PASS"]
            s.pop("outcome")
    found = problems(bad, receipt)
    assert any("caption is fixed" in p for p in found), found


def test_control_an_outcome_that_disagrees_with_the_figure_fails() -> None:
    spec, receipt = load(ROOT / "media/explainers/receipt-loop")
    bad = copy.deepcopy(spec)
    for s in bad["scenes"]:
        if s["key"] == "budget":
            s["outcome"] = {"if": {"eq": [{"param": "passed"}, 1]}, "then": "FAIL", "else": "PASS"}
    found = problems(bad, receipt)
    assert any("figure shows" in p for p in found), found
