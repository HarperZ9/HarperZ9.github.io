"""Where every line of a film sits in time, and what a frame at time t shows.

The narration writes `timing.json`: one row per spoken sentence with its start and end. A line is
one or more sentences. A segment starts with its first line and ends where the next one starts.
Figure marks appear at the start of the line named by their `on` field, and fade in over FADE s.
"""

from __future__ import annotations

FADE = 0.6


def ease(u: float) -> float:
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def line_spans(film: dict, timing: list[dict]) -> list[dict]:
    """One row per (segment, line): start and end in seconds, and the line's text."""
    spans: dict[tuple[int, int], dict] = {}
    for row in timing:
        key = (row["segment"], row["line"])
        span = spans.setdefault(key, {"segment": row["segment"], "line": row["line"], "start": row["start"],
                                      "end": row["end"], "text": []})
        span["end"] = max(span["end"], row["end"])
        span["text"].append(row["text"])
    out = [dict(s, text=" ".join(s["text"])) for _, s in sorted(spans.items())]
    expected = [(i, j) for i, seg in enumerate(film["segments"]) for j in range(len(seg["lines"]))]
    if [(s["segment"], s["line"]) for s in out] != expected:
        raise ValueError("timing.json does not cover every line of the film in order")
    return out


def segment_bounds(film: dict, spans: list[dict], total: float) -> list[tuple[float, float]]:
    starts = [next(s["start"] for s in spans if s["segment"] == i) for i in range(len(film["segments"]))]
    starts[0] = 0.0
    return [(a, b) for a, b in zip(starts, starts[1:] + [total])]


def frame_state(film: dict, spans: list[dict], bounds: list[tuple[float, float]], t: float) -> dict:
    """What a frame at time t shows: the segment, its progress u, each line's reveal alpha."""
    i = max(k for k, (a, _) in enumerate(bounds) if t >= a or k == 0)
    a, b = bounds[i]
    seg = film["segments"][i]
    lines = [s for s in spans if s["segment"] == i]
    reveal = [ease((t - s["start"]) / FADE) if t >= s["start"] else 0.0 for s in lines]
    reveal[0] = max(reveal[0], ease((t - a) / FADE))
    enter = ease((t - a) / 0.8)
    leave = 1.0 - ease((t - (b - 0.5)) / 0.5) if i < len(bounds) - 1 else 1.0
    plate = seg.get("plate", {"from": 0, "to": 0})
    u = (t - a) / max(1e-6, b - a)
    return {"index": i, "segment": seg, "u": u, "alpha": min(enter, leave), "reveal": reveal,
            "scale": plate["from"] + (plate["to"] - plate["from"]) * ease(u), "t": t}


def revealed(state: dict, on: int | None) -> float:
    """Alpha of a mark that appears at line `on` (None or absent: with the segment)."""
    if on is None:
        return state["alpha"]
    r = state["reveal"]
    return state["alpha"] * (r[on] if on < len(r) else 0.0)
