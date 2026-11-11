"""The route backend of narrate.py (default since 2026-11-09): chosen takes read back, checked by the ASR rule,
flagged when the words do not match, and the command line that makes route the default."""

import json
import wave
from pathlib import Path

import numpy as np
import pytest

from tools.explainer.film import narrate as N
from tools.explainer.film.route_takes import describe_route, read_pcm, route_take, take_tag


class Seg:
    def __init__(self, text):
        self.text = text


class FakeASR:
    """Hears what it is told to hear and records the audio it was given."""

    def __init__(self, heard):
        self.heard, self.calls = heard, []

    def transcribe(self, x, **kw):
        self.calls.append((len(x), x.dtype, kw.get("language")))
        return [Seg(self.heard)], None


def write(path: Path, x: np.ndarray, sr: int, width: int) -> None:
    q = np.round(np.clip(x, -1, 1) * ((1 << (8 * width - 1)) - 1)).astype(np.int64)
    if width == 3:
        raw = b"".join(int(v & 0xFFFFFF).to_bytes(3, "little") for v in q)
    else:
        raw = q.astype("<i2" if width == 2 else "<i4").tobytes()
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1), w.setsampwidth(width), w.setframerate(sr), w.writeframes(raw)


def tone(sr=24000, seconds=1.5):
    t = np.arange(int(sr * seconds)) / sr
    x = 0.4 * np.sin(2 * np.pi * 180 * t)
    x[: int(0.2 * sr)] = 0.0                                             # leading silence for trim() to remove
    return x


@pytest.mark.parametrize("width", [2, 3, 4])
def test_pcm_round_trips_at_every_width(tmp_path, width):
    x = tone()
    write(tmp_path / "a.wav", x, 24000, width)
    y, sr = read_pcm(tmp_path / "a.wav")
    assert sr == 24000 and len(y) == len(x)
    assert np.max(np.abs(y - x)) < 2.0 / (1 << (8 * width - 1)) + 1e-12


def test_tags_from_both_seed_forms():
    assert take_tag("checking-cost/1/0/2") == "1.0.2"
    assert take_tag("checking-cost/1.0.2") == "1.0.2"
    assert take_tag("checking-cost/3/p0") == "3.p0"


def test_a_matching_take_is_accepted_with_its_engine_and_hash(tmp_path):
    write(tmp_path / "1.0.2.wav", tone(), 24000, 3)
    (tmp_path / "1.0.2.json").write_text(json.dumps({"engine": "qwen_ft_labels", "seed": 7}), encoding="utf-8")
    text = "Fifty-five percent of the references did not exist."
    asr = FakeASR("55% of the references did not exist.")
    x, row, sr = route_take(tmp_path)(None, asr, text, "checking-cost/1/0/2")
    assert sr == 24000 and len(x) < len(tone())                          # trimmed
    assert row["ratio"] >= N.ACCEPT and row["engine"] == "qwen_ft_labels" and row["seed"] == 7
    assert len(row["take_sha256"]) == 64
    assert asr.calls[0][1] == np.float32 and asr.calls[0][2] == "en"   # resampled to 16 kHz float32 for the ASR


def test_a_take_with_the_wrong_words_is_flagged(tmp_path):
    write(tmp_path / "0.0.0.wav", tone(), 24000, 2)
    _, row, _ = route_take(tmp_path)(None, FakeASR("something else entirely"), "The tricks continued.", "f/0.0.0")
    assert row["ratio"] < N.ACCEPT and row["engine"] == "unknown"


def test_a_missing_take_stops_the_film(tmp_path):
    with pytest.raises(FileNotFoundError, match="2.1.0"):
        route_take(tmp_path)(None, FakeASR(""), "Text.", "f/2/1/0")


def test_route_is_the_default_and_each_backend_needs_its_input():
    a = N.parse(["media/explainers/x", "out", "--takes", "chosen"])
    assert a.backend == "route" and a.takes == Path("chosen")
    with pytest.raises(SystemExit):
        N.parse(["media/explainers/x", "out"])
    with pytest.raises(SystemExit):
        N.parse(["media/explainers/x", "out", "--backend", "qwen"])
    assert N.parse(["f", "o", "--backend", "qwen", "--model", "m"]).model == Path("m")


def test_narration_json_counts_engines_and_flags():
    rows = [{"engine": "a", "ratio": 1.0, "accepted": True}, {"engine": "a", "ratio": 0.5, "accepted": False},
            {"engine": "b", "ratio": 0.95, "accepted": True}]
    info = describe_route(rows, {"after_lufs": -16.0}, "medium.en")
    assert info["backend"] == "route-local" and info["engines"] == {"a": 2, "b": 1}
    assert info["asr_check"]["flagged"] == 1 and info["asr_check"]["sentences"] == 3
    assert "with his approval" in info["label"]
