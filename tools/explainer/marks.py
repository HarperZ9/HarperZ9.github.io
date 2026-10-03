"""Risk levels for the explainer marks, with no imaging dependencies so CI can test them.

The colours are the dark pole of the site's risk tokens (system/media-engine/colour.mjs,
RISK_TOKENS.dark); tests/test_explainers.py keeps the two equal.
"""

from __future__ import annotations

GROUND = "#060608"
INK, QUIET, HAIR = "#ebe5d8", "#9d978a", "#2a2830"
RISK = {"low": "#8fdc8a", "moderate": "#a9a6b4", "elevated": "#f0a848", "high": "#ff7a6b"}
LEVELS = ["low", "moderate", "elevated", "high"]
VERDICT_RISK = {"MATCH": "low", "VERIFIED": "low", "PASS": "low", "UNVERIFIABLE": "moderate",
                "UNKNOWN": "moderate", "DRIFT": "elevated", "STALE": "elevated", "FAIL": "high", "REFUSED": "high"}


def risk_of(mark: dict) -> str | None:
    if mark.get("risk"):
        return mark["risk"]
    verdict = mark.get("verdict")
    return VERDICT_RISK.get(verdict.upper(), "moderate") if verdict else None


def hot_index(marks: list[dict]) -> int:
    """The one mark drawn in colour: the highest liability, the first on a tie."""
    best, rank = -1, -1
    for i, mark in enumerate(marks):
        level = risk_of(mark)
        if level and LEVELS.index(level) > rank:
            best, rank = i, LEVELS.index(level)
    return best
