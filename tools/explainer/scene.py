"""What one explainer frame shows, with no imaging dependencies.

The offline renderer (draw.py) and the live engine plugin (system/explainer/state.mjs) both
draw from frame_state(): the same spec, the same timeline and the same parameters give the same
scene, mark alphas, hot mark, bar values and resolved text in both. tests/test_explainer_parity.py
runs the two side by side over sampled frames.

A spec may expose parameters ("params") and derived values ("derived"). Any value in a scene can
then be a binding:

    {"param": "id"}                       the parameter's value
    {"param": "id", "mul": k}             value times k
    {"param": "id", "over": k}            k divided by the value
    {"if": COND, "then": A, "else": B}    COND is {"le"|"lt"|"ge"|"gt"|"eq": [A, B]} or {"all": [COND...]}
    "text {id} text"                      a template; numbers print with the parameter's "digits"

A scene whose narration depends on the figure gives "outcome" (a binding that computes an outcome
word, such as MATCH or DRIFT) and makes "say" an object of one caption per outcome word. Resolving
the scene picks the caption for the computed outcome, so the caption and the figure come from the
same values. The offline video renders with every parameter at its default, so it narrates the
default outcome's caption.
"""

from __future__ import annotations

import re

from tools.explainer.marks import LEVELS, risk_of

FADE, STAGGER = 0.12, 0.08
TEMPLATE = re.compile(r"\{([a-z_][a-z0-9_]*)\}")
COMPARE = {"le": lambda a, b: a <= b, "lt": lambda a, b: a < b, "ge": lambda a, b: a >= b,
           "gt": lambda a, b: a > b, "eq": lambda a, b: a == b}


def ease(u: float) -> float:
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def fmt(value, digits: int) -> str:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f"{value:.{digits}f}"
    return str(value)


def values(spec: dict, overrides: dict | None = None) -> dict:
    """Every parameter's value (default unless overridden, clamped to its range), then derived."""
    out, digits = {}, {}
    for p in spec.get("params", []):
        v = (overrides or {}).get(p["id"], p["default"])
        if p.get("kind", "range") == "range":
            v = min(p["max"], max(p["min"], float(v)))
            v = int(v) if float(v).is_integer() and p.get("digits", 0) == 0 else v
        elif v not in [o["value"] for o in p["options"]]:
            v = p["default"]
        out[p["id"]], digits[p["id"]] = v, p.get("digits", 0)
    for key, expr in spec.get("derived", {}).items():
        out[key] = resolve(expr, out, digits)
    out["__digits__"] = digits
    return out


def condition(cond: dict, env: dict, digits: dict) -> bool:
    if "all" in cond:
        return all(condition(c, env, digits) for c in cond["all"])
    (op, (a, b)), = cond.items()
    return COMPARE[op](resolve(a, env, digits), resolve(b, env, digits))


def resolve(value, env: dict, digits: dict | None = None):
    digits = env.get("__digits__", {}) if digits is None else digits
    if isinstance(value, str):
        return TEMPLATE.sub(lambda m: fmt(env[m.group(1)], digits.get(m.group(1), 0)), value)
    if isinstance(value, list):
        return [resolve(v, env, digits) for v in value]
    if not isinstance(value, dict):
        return value
    if "param" in value:
        v = env[value["param"]]
        if "mul" in value:
            v = v * value["mul"]
        if "over" in value:
            v = value["over"] / v
        return v
    if "if" in value:
        return resolve(value["then"] if condition(value["if"], env, digits) else value["else"], env, digits)
    return {k: resolve(v, env, digits) for k, v in value.items()}


def pick_caption(scene: dict) -> dict:
    """A resolved scene with "say" as one string: the caption keyed by the scene's outcome."""
    if not isinstance(scene["say"], dict):
        return scene
    return {**scene, "say": scene["say"][scene["outcome"]]}


def resolved_scenes(spec: dict, overrides: dict | None = None) -> list[dict]:
    env = values(spec, overrides)
    return [pick_caption(resolve(scene, env)) for scene in spec["scenes"]]


def timeline(spec: dict, receipt: dict | None = None) -> list[tuple[str, float, float]]:
    """(key, start, end) per scene: the narrated timing from a receipt, else each scene's minimum."""
    if receipt:
        return [(row["scene"], row["start"], row["end"]) for row in receipt["timeline"]]
    rows, t = [], 0.0
    for scene in spec["scenes"]:
        rows.append((scene["key"], t, t + scene.get("min", 3.0)))
        t += scene.get("min", 3.0)
    return rows


def locate(rows, t: float) -> tuple[int, float]:
    """Index of the scene playing at t and how far through it (0..1)."""
    t = min(max(t, 0.0), rows[-1][2] - 1e-9)
    for i, (_, start, end) in enumerate(rows):
        if start <= t < end + 1e-9:
            return i, (t - start) / (end - start)
    return len(rows) - 1, 1.0


def tries_slots(mark: dict, u: float, a: float) -> list[dict]:
    """One slot per candidate: FAIL before the first pass, PASS at it, not run after it."""
    budget, first = int(mark["budget"]), int(mark["first_pass"])
    passed = 1 <= first <= budget
    slots = []
    for i in range(1, int(mark["max"]) + 1):
        alpha = a * ease((u - mark.get("at", 0.0) - STAGGER * (i - 1)) / FADE) if not mark.get("carry") else 1.0
        if i > budget:
            word = "over budget"
        elif passed and i == first:
            word = "PASS"
        elif passed and i > first:
            word = "not run"
        else:
            word = "FAIL"
        slots.append({"n": i, "word": word, "alpha": round(alpha, 6), "in_budget": i <= budget})
    return slots


def mark_state(mark: dict, u: float, alpha: float, hot: bool) -> dict:
    state = {"type": mark["type"], "alpha": round(alpha, 6), "hot": hot, "risk": risk_of(mark)}
    if mark["type"] == "bars":
        state["items"] = []
        for item in mark["items"]:
            v = item["value"] + (item.get("to", item["value"]) - item["value"]) * ease((u - 0.2) / 0.6)
            state["items"].append({"label": item["label"], "display": item["display"], "value": round(v, 6),
                                   "strong": bool(item.get("strong")),
                                   "alpha": 1.0 if item.get("carry") else round(alpha, 6)})
        state["scale"] = mark.get("scale") or max(max(i["value"], i.get("to", 0)) for i in mark["items"])
    elif mark["type"] == "tries":
        state["slots"] = tries_slots(mark, u, alpha)
    elif mark["type"] == "grid":
        state["filled"], state["count"], state["label"] = int(round(mark["filled"])), mark["count"], mark["label"]
    else:
        state.update({k: mark[k] for k in ("label", "value", "text", "verdict") if k in mark})
    return state


def hot_of(marks: list[dict], alphas: list[float]) -> int:
    best, rank = -1, -1
    for i, (mark, alpha) in enumerate(zip(marks, alphas)):
        level = risk_of(mark) if alpha > 0 else None
        if level and LEVELS.index(level) > rank:
            best, rank = i, LEVELS.index(level)
    return best


def frame_state(scenes: list[dict], rows, t: float) -> dict:
    """Everything a frame shows at time t, for already-resolved scenes."""
    i, u = locate(rows, t)
    scene = scenes[i]
    marks = scene.get("marks", [])
    alphas = [ease((u - m.get("at", 0.0)) / FADE) for m in marks]
    hot = hot_of(marks, alphas)
    return {
        "scene": scene["key"], "index": i, "u": round(u, 6), "layout": scene.get("layout", "marks"),
        "heading": scene.get("heading", ""), "say": scene["say"], "outcome": scene.get("outcome"),
        "command": scene.get("command"),
        "heading_alpha": round(1.0 if scene.get("carry_heading") else ease(u / (0.15 if scene.get("layout") in ("title", "close") else FADE)), 6),
        "marks": [mark_state(m, u, a, j == hot) for j, (m, a) in enumerate(zip(marks, alphas))],
    }
