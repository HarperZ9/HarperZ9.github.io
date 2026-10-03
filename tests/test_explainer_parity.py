"""One spec drives both renders: the offline video's frame states equal the live engine's.

tools/explainer/scene.py (Pillow and ffmpeg) and system/explainer/state.mjs (the page's engine
plugin) each compute what a frame shows. This runs both over sampled frames of every explainer,
at the defaults and with every parameter moved, and requires the same scene, text, verdicts, hot
mark, alphas and bar values. It cannot compare pixels: Pillow and the browser rasterise type
differently, so the check is on what is drawn, not on how each rasteriser draws it.
"""

from __future__ import annotations

import json
import math
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from tools.explainer import marks, scene

ROOT = Path(__file__).resolve().parents[1]
FOLDERS = sorted(p.parent for p in (ROOT / "media" / "explainers").glob("*/spec.json"))
NODE = shutil.which("node")


def load(folder: Path):
    spec = json.loads((folder / "spec.json").read_text(encoding="utf-8"))
    receipt_path = folder / "receipt.json"
    receipt = json.loads(receipt_path.read_text(encoding="utf-8")) if receipt_path.is_file() else None
    return spec, receipt


def moved(spec: dict) -> list[dict]:
    """The defaults, then each parameter at its minimum and its maximum (or each option)."""
    sets = [{}]
    for p in spec.get("params", []):
        if p.get("kind", "range") == "range":
            sets += [{p["id"]: p["min"]}, {p["id"]: p["max"]}]
        else:
            sets += [{p["id"]: o["value"]} for o in p["options"]]
    return sets


def same(a, b, path="") -> list[str]:
    if isinstance(a, dict) and isinstance(b, dict):
        if set(a) != set(b):
            return [f"{path}: keys {sorted(set(a) ^ set(b))}"]
        return [p for k in a for p in same(a[k], b[k], f"{path}.{k}")]
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return [f"{path}: length {len(a)} != {len(b)}"]
        return [p for i, (x, y) in enumerate(zip(a, b)) for p in same(x, y, f"{path}[{i}]")]
    if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool):
        return [] if math.isclose(a, b, abs_tol=2e-6) else [f"{path}: {a} != {b}"]
    return [] if a == b else [f"{path}: {a!r} != {b!r}"]


@pytest.mark.skipif(NODE is None, reason="node is not on PATH")
@pytest.mark.parametrize("folder", FOLDERS, ids=[f.name for f in FOLDERS])
def test_live_and_offline_frame_states_agree(folder: Path) -> None:
    spec, receipt = load(folder)
    rows = scene.timeline(spec, receipt)
    end = rows[-1][2]
    times = [round(end * k / 97, 4) for k in range(98)]
    for overrides in moved(spec):
        ours = [scene.frame_state(scene.resolved_scenes(spec, overrides), rows, t) for t in times]
        out = subprocess.run([NODE, "tools/explainer/state_dump.mjs", str(folder.relative_to(ROOT)), json.dumps(overrides),
                              *map(str, times)], cwd=ROOT, capture_output=True, text=True, check=True).stdout
        theirs = json.loads(out)
        problems = same(ours, theirs)
        assert problems == [], (folder.name, overrides, problems[:5])


def test_control_a_changed_parameter_changes_the_state() -> None:
    """A parity check that cannot see a parameter would pass vacuously."""
    for folder in FOLDERS:
        spec, receipt = load(folder)
        if not spec.get("params"):
            continue
        rows = scene.timeline(spec, receipt)
        times = [rows[-1][2] * k / 40 for k in range(41)]
        base = [scene.frame_state(scene.resolved_scenes(spec), rows, t) for t in times]
        for overrides in moved(spec)[1:]:
            if all(overrides[k] == p["default"] for p in spec["params"] for k in overrides if k == p["id"]):
                continue
            other = [scene.frame_state(scene.resolved_scenes(spec, overrides), rows, t) for t in times]
            assert same(base, other), (folder.name, overrides)


def test_the_verdict_tables_agree() -> None:
    text = (ROOT / "system/explainer/state.mjs").read_text(encoding="utf-8")
    block = re.search(r"VERDICT_RISK = Object\.freeze\(\{(.*?)\}\)", text, re.S).group(1)
    assert dict(re.findall(r"(\w+): \"(\w+)\"", block)) == marks.VERDICT_RISK


def test_every_spec_parameter_is_well_formed_and_used() -> None:
    for folder in FOLDERS:
        spec, _ = load(folder)
        text = json.dumps(spec["scenes"]) + json.dumps(spec.get("derived", {}))
        keys = {s["key"] for s in spec["scenes"]}
        for p in spec.get("params", []):
            assert re.fullmatch(r"[a-z_][a-z0-9_]*", p["id"]), p
            assert p.get("label") and p.get("scene") in keys, (folder.name, p["id"])
            if p.get("kind", "range") == "range":
                assert p["min"] <= p["default"] <= p["max"] and p["step"] > 0, (folder.name, p["id"])
            else:
                assert p["default"] in [o["value"] for o in p["options"]], (folder.name, p["id"])
            assert f'"param": "{p["id"]}"' in text or "{" + p["id"] + "}" in text, (folder.name, p["id"])
