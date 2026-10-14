"""A provisional timing.json for a film whose narration is not recorded yet.

    python -m tools.explainer.film.provisional_timing media/explainers/<slug>

The scene code takes every cue from timing.json, so a film can be built and checked before the
voice exists. This writes one row per sentence, split the way narrate.py splits them, at the
author's measured pace: 3.79 syllables a second while speaking and 2.94 overall with the pauses.
Syllables are counted by the same vowel-group rule as that measurement, over the words narrate.py
would hear (digits spelled out). The pauses are layout.plan()'s, the same ones narrate.py records:
the sentence, line and segment gaps are scaled so the spoken part comes out at 2.94 overall; held
beats (the host's open and close, each predict question's hold, picture holds) are added as they
are. Predict questions are spoken, so they get rows too, keyed by "predict". Every row carries
"provisional": true. The real narration replaces the file.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from tools.explainer.film.layout import plan
from tools.explainer.film.narrate import norm

ARTICULATION, OVERALL = 3.79, 2.94


def syl(word: str) -> int:
    """One word's syllables, the rule of the pace measurement that gave 3.79 and 2.94: vowel
    groups (y counts after the first letter), less a silent final e, at least one."""
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        return 0
    n = len(re.findall(r"[aeiou]+|(?<=.)y", w))
    if w.endswith("e") and not w.endswith(("le", "ee")) and n > 1:
        n -= 1
    return max(1, n)


def syllables(text: str) -> int:
    """Syllables in the words narrate.py would hear, with digits spelled out."""
    return sum(syl(w) for w in norm(text))


def build(film: dict) -> list[dict]:
    events = plan(film)
    spoken = [e for e in events if e["kind"] in ("say", "ask")]
    syl = {id(e): syllables(e["text"]) for e in spoken}
    total = sum(syl.values())
    gaps = sum(e["seconds"] for e in events if e["kind"] == "silence" and e["why"] in ("head", "gap"))
    last_gap = next((e["seconds"] for e in reversed(events) if e["kind"] == "silence" and e["why"] == "gap"), 0.0)
    # Scale the ordinary gaps (not the trailing one) so speech plus gaps runs at OVERALL.
    scale = (total / OVERALL - total / ARTICULATION) / max(1e-9, gaps - last_gap)
    t, rows = 0.0, []
    for e in events:
        if e["kind"] == "silence":
            t += e["seconds"] * (scale if e["why"] in ("head", "gap") else 1.0)
            continue
        d = syl[id(e)] / ARTICULATION
        where = {"segment": e["segment"], "line": e["line"], "sentence": e["sentence"]} if e["kind"] == "say" else {"segment": e["segment"], "predict": e["predict"]}
        rows.append({**where, "start": round(t, 3), "end": round(t + d, 3), "text": e["text"], "syllables": syl[id(e)],
                     "seconds": round(d, 3), "provisional": True, "accepted": True})
        t += d
    return rows


def duration(film: dict, rows: list[dict]) -> float:
    """The film's length: the last sentence's end plus the host's close."""
    return round(rows[-1]["end"] + film.get("host", {}).get("close", {}).get("seconds", 1.0), 3)


def main(argv: list[str]) -> int:
    folder = Path(argv[0])
    film = json.loads((folder / "film.json").read_text(encoding="utf-8"))
    rows = build(film)
    (folder / "timing.json").write_text(json.dumps(rows, indent=1) + "\n", encoding="utf-8")
    speak = sum(r["syllables"] for r in rows)
    print(f"{len(rows)} sentences, {speak} syllables, last line ends {rows[-1]['end']:.2f} s, film {duration(film, rows):.2f} s")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
