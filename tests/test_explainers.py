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
from tools.explainer import scene
from tools.explainer.embed import HAND_PLACED
from tools.render_legacy_essays import EXPLAINERS

ROOT = Path(__file__).resolve().parents[1]
FOLDERS = sorted(p.parent for p in (ROOT / "media" / "explainers").glob("*/receipt.json"))


def test_there_are_explainers_to_check() -> None:
    assert {f.name for f in FOLDERS} >= {"cost-to-verify", "receipt-is-not-a-verdict", "receipt-loop"}


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
        settings = [{}] + [{p["id"]: o["value"]} for p in spec.get("params", []) for o in p.get("options", [])]
        for overrides in settings:
            for resolved in scene.resolved_scenes(spec, overrides):
                for mark in resolved.get("marks", []):
                    level = marks.risk_of(mark)
                    assert level is None or level in marks.LEVELS, (folder.name, resolved["key"])


def test_one_hot_mark_per_view() -> None:
    view = [{"verdict": "MATCH"}, {"verdict": "DRIFT"}, {"risk": "elevated"}, {}]
    assert marks.hot_index(view) == 1
    assert marks.hot_index([{}, {"text": "plain"}]) == -1


def test_risk_colours_match_the_media_engine_tokens_when_present() -> None:
    # The tokens live in the vendored superstack contract; colour.mjs re-exports them.
    colour = ROOT / "system/media-engine/contracts.mjs"
    dark = re.search(r"dark:\s*Object\.freeze\(\{([^}]*)\}", colour.read_text(encoding="utf-8")).group(1)
    tokens = dict(re.findall(r"""(\w+):\s*["'](#[0-9a-fA-F]{6})["']""", dark))
    assert {k: tokens[k] for k in marks.RISK} == marks.RISK
    assert (tokens["ink"], tokens["quiet"]) == (marks.INK, marks.QUIET)


def test_each_explainer_is_on_its_page_with_captions_and_transcript() -> None:
    placed = {slug: page for page, sections in EXPLAINERS.items() for slug in sections.values()}
    placed.update(HAND_PLACED)
    for folder in FOLDERS:
        slug = folder.name
        html = (ROOT / placed[slug]).read_text(encoding="utf-8")
        assert f'id="explainer-{slug}"' in html, slug
        assert f'src="media/explainers/{slug}/{slug}.vtt"' in html, slug
        assert f'id="explainer-{slug}-transcript"' in html, slug
        assert "autoplay" not in html.split(f'id="explainer-{slug}"', 1)[1].split("</figure>", 1)[0]


def test_every_explainer_has_a_sealed_narration_receipt() -> None:
    # superstack.receipt/1 over the narration's s16le PCM (SPEC 8.7): the seal holds, it names the
    # same WAV and spec as the explainer's receipt, and the script hash still matches the spec.
    from tools.explainer import narration
    for folder in FOLDERS:
        assert narration.check(folder) == [], folder.name
        rec = json.loads((folder / narration.NAME).read_text(encoding="utf-8"))
        nar = rec["media"]["narration"]
        assert nar["reference"] is False and nar["hosted"] is False
        assert rec["media"]["access"] == {"autoplay": False, "captions": "vtt", "transcript": True, "reduced_sound": "silent"}
        assert rec["media"]["loudness_class"] == "speech"
        # Re-pinned 3 October 2026. The lead decided to rebuild the narrations to the -16 LUFS speech
        # target (they measured -20.12 to -20.31 LUFS and read "refuted"). loudness.py now runs
        # before the hash, so every receipt must read "verified", sit within 0.05 LU of the target,
        # keep the sample peak at the -2.0 dBFS ceiling (0.5 dB under the -1.5 dBTP limit), and
        # carry the same loudness record as the explainer receipt.
        assert rec["media"]["loudness_verdict"] == "verified", folder.name
        assert abs(rec["media"]["integrated_lufs"] - -16.0) <= 0.05, folder.name
        assert rec["media"]["peak_dbfs"] <= -2.0, folder.name
        step = json.loads((folder / "receipt.json").read_text(encoding="utf-8"))["narration_loudness"]
        assert rec["media"]["processing"] == step, folder.name
        assert step["rule"] == "explainer-speech-normalise/1" and step["sample_peak_headroom_db"] >= 0.5


def test_a_narration_receipt_check_can_fail() -> None:
    from tools import superstack as ss
    from tools.explainer import narration
    folder = FOLDERS[0]
    rec = json.loads((folder / narration.NAME).read_text(encoding="utf-8"))
    forged = {**rec, "content_sha256": "0" * 64}
    assert ss.verify_receipt(forged) == ["seal"]
    assert narration.text_sha256(["a", "b"]) != narration.text_sha256(["a b"])


def test_the_loudness_step_is_deterministic_and_holds_its_ceiling() -> None:
    # A loud synthetic voice stand-in: a 180 Hz tone with a 6 Hz syllable envelope and spikes. Two runs
    # give the same bytes, the result meets the target, and neither the samples nor the 4x
    # interpolated points exceed the ceiling.
    import numpy as np
    from tools.explainer import loudness
    rate = 22050
    t = np.arange(rate * 6) / rate
    x = 0.9 * np.sin(2 * np.pi * 180 * t) * (0.55 + 0.45 * np.sin(2 * np.pi * 6 * t)) ** 2
    x[::997] = 0.99
    pcm = loudness.to_s16(x * 0.2)
    out, info = loudness.normalise(pcm, rate)
    assert loudness.normalise(pcm, rate)[0] == out
    assert abs(info["after_lufs"] - loudness.TARGET_LUFS) <= 0.05
    y = np.frombuffer(out, dtype="<i2") / loudness.FULL_SCALE
    assert loudness.peak_level(y).max() <= 10 ** (loudness.CEILING_DBFS / 20) + 1 / loudness.FULL_SCALE
