"""A provisional timing.json for a film whose narration is not recorded yet.

    python -m tools.explainer.film.provisional_timing media/explainers/<slug>

The scene code takes every cue from timing.json, so a film can be built and checked before the
voice exists. This writes one row per sentence, split the way narrate.py splits them, at the
author's measured pace: 3.79 syllables a second while speaking and 2.94 overall with the pauses.
Syllables are counted by the same vowel-group rule as that measurement, over the words narrate.py
would hear (digits spelled out). The pauses
keep narrate.py's proportions (head, sentence, line and segment gaps), scaled so the overall rate
comes out at 2.94. Held beats that are not narration are added on top: the host's cold open
before the first line, a segment's predict beat (a silent still), and the host's close after the
last line. Every row carries "provisional": true. The real narration replaces the file.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from tools.explainer.film.narrate import GAP_LINE, GAP_SEGMENT, GAP_SENTENCE, HEAD, norm, sentences

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
    plan = []   # (segment, line, sentence, text, gap_after_base)
    segs = film["segments"]
    for i, seg in enumerate(segs):
        for j, line in enumerate(seg["lines"]):
            said = sentences(line)
            for k, text in enumerate(said):
                last_l = j == len(seg["lines"]) - 1
                gap = GAP_SENTENCE if k < len(said) - 1 else GAP_SEGMENT if last_l else GAP_LINE
                plan.append((i, j, k, text, gap))
    syl = [syllables(p[3]) for p in plan]
    total_syl = sum(syl)
    speech = total_syl / ARTICULATION
    base_pause = HEAD + sum(p[4] for p in plan[:-1])
    scale = (total_syl / OVERALL - speech) / base_pause
    host = film.get("host", {})
    t = HEAD * scale + host.get("open", {}).get("seconds", 0.0)
    rows = []
    for (i, j, k, text, gap), s in zip(plan, syl):
        pred = segs[i].get("predict")
        if pred and [j, k] == pred["before"]:
            t += pred["seconds"]
        d = s / ARTICULATION
        rows.append({"segment": i, "line": j, "sentence": k, "start": round(t, 3), "end": round(t + d, 3), "text": text,
                     "syllables": s, "seconds": round(d, 3), "provisional": True, "accepted": True})
        t += d + gap * scale
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
