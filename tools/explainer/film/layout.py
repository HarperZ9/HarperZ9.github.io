"""Where a film's sound goes, in order: spoken sentences, predict questions, and held silences.

narrate.py records from this plan and provisional_timing.py estimates from it, so the provisional
timing and the real narration put every pause in the same place.

film.json fields read here (one convention for every film, draft or live):

    "host": {"guide": "...", "open": {"seconds": 4.0, ...}, "close": {"seconds": 5.0, ...}}
        The guide's cold open is silence before the first sentence; its close is silence after the last.
    segment "predict": [{"before" | "after": [line, sentence], "question": "...", "hold": 2.5}]
        A prediction pause (approved by the author on 2026-10-14: "Yes, you may publish the films in
        4K, with the prediction pauses."). The question is spoken, then `hold` seconds of silence
        while the frame holds. A dict is read as a one-item list.
    segment "holds": [{"before" | "after": [line, sentence], "seconds": 3.0, "what": "..."}]
        A picture beat with no words.

Anchors name a sentence by its line and its index inside that line, as sentences() splits it.
"""

from __future__ import annotations

HEAD, GAP_SENTENCE, GAP_LINE, GAP_SEGMENT = 0.6, 0.32, 0.6, 1.2
PREDICT_HOLD = 2.5


def sentences(line: str) -> list[str]:
    """Split a script line into sentences: after . ! or ? followed by a space and a capital or a
    digit, except after an initial ("B. E. Bayer") or a short abbreviation, which stay joined."""
    import re
    parts = [s for s in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", line.strip()) if s]
    out: list[str] = []
    for p in parts:
        if out and re.search(r"(?:^|\s)(?:[A-Z]|Dr|Mr|Mrs|Ms|St|vs|al|e\.g|i\.e|cf|Fig|No)\.$", out[-1]):
            out[-1] = f"{out[-1]} {p}"
        else:
            out.append(p)
    return out


def _list(x) -> list:
    return [] if not x else [x] if isinstance(x, dict) else list(x)


def _at(entry: dict, j: int, k: int, last_k: int) -> str | None:
    if entry.get("before") == [j, k]:
        return "before"
    if entry.get("after") == [j, k]:
        return "after"
    return None


def plan(film: dict) -> list[dict]:
    """Events in order: {"kind": "silence", "seconds", "why"}, {"kind": "say", "segment", "line",
    "sentence", "text"} and {"kind": "ask", "segment", "predict", "text"}. Gaps between spoken
    sentences are silences with why "gap"."""
    ev: list[dict] = [{"kind": "silence", "seconds": HEAD, "why": "head"}]
    host = film.get("host") if isinstance(film.get("host"), dict) else {}
    if host.get("open", {}).get("seconds"):
        ev.append({"kind": "silence", "seconds": float(host["open"]["seconds"]), "why": "host open"})
    segs = film["segments"]
    for i, seg in enumerate(segs):
        preds, holds = _list(seg.get("predict")), _list(seg.get("holds"))
        for j, line in enumerate(seg["lines"]):
            said = sentences(line)
            for k, text in enumerate(said):
                def beats(where: str) -> None:
                    for n, p in enumerate(preds):
                        if _at(p, j, k, len(said) - 1) == where:
                            ev.append({"kind": "ask", "segment": i, "predict": n, "text": p["question"]})
                            ev.append({"kind": "silence", "seconds": float(p.get("hold", PREDICT_HOLD)), "why": "predict"})
                    for h in holds:
                        if _at(h, j, k, len(said) - 1) == where:
                            ev.append({"kind": "silence", "seconds": float(h["seconds"]), "why": "hold"})
                beats("before")
                ev.append({"kind": "say", "segment": i, "line": j, "sentence": k, "text": text})
                last_l = j == len(seg["lines"]) - 1
                ev.append({"kind": "silence", "seconds": GAP_SENTENCE if k < len(said) - 1 else GAP_SEGMENT if last_l else GAP_LINE, "why": "gap"})
                beats("after")
    if host.get("close", {}).get("seconds"):
        ev.append({"kind": "silence", "seconds": float(host["close"]["seconds"]), "why": "host close"})
    return ev


def check_anchors(film: dict) -> list[str]:
    """Anchors that name no sentence of their segment (a typo would silently drop a pause)."""
    bad = []
    for i, seg in enumerate(film["segments"]):
        names = {(j, k) for j, line in enumerate(seg["lines"]) for k, _ in enumerate(sentences(line))}
        for e in [*_list(seg.get("predict")), *_list(seg.get("holds"))]:
            a = e.get("before") or e.get("after")
            if not a or tuple(a) not in names:
                bad.append(f"segment {i} ({seg.get('key')}): anchor {a} names no sentence")
            if "question" in e and not e["question"].strip():
                bad.append(f"segment {i}: empty predict question")
    return bad
