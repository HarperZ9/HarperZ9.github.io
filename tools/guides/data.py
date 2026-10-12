"""The three guides, as one record each: the words every page uses about them.

guides.html (tools/guides/page.py), the host line on each film (tools/explainer/film/page.py), the
Writing hub and the home page (home/src/guides.ts, checked against this file by
tests/test_guides.py) all take their words from here, so the pages cannot tell different stories.
"""
from __future__ import annotations

GUIDES = [
    {
        "id": "tallow", "name": "Tallow", "title": "the night clerk", "style": "retro thriller",
        "role": "His head is a candle, and the wax is the time he has: every claim he checks burns a little of it.",
        "habit": "Before he looks, he asks what you think. Then you find the source together.",
        "home": "A dark claims office, lit only by his flame.",
        "films": ["checking-cost", "visible-reasoning"],
        "alt": "Tallow, a tall clerk whose head is a lit candle, holds a reference card up to his flame in a dark office.",
        "close_alt": "Tallow's face: one eye in the wax under the flame.",
    },
    {
        "id": "pylon", "name": "Pylon", "title": "the claims inspector", "style": "painted isometric",
        "role": "A harbour seal in a traffic cone. A cone means nobody has checked a claim yet, and she puts one on every claim that washes in.",
        "habit": "She shows you where each claim came from, tells you what is still waiting, and leaves the call to you.",
        "home": "A painted harbour town, seen from above.",
        "films": ["rederive", "incentives"],
        "alt": "Pylon, a heavy harbour seal wearing an orange traffic cone and a sash, stands on a lamplit harbour street holding a paper.",
        "close_alt": "Pylon's face under her cone, deadpan.",
    },
    {
        "id": "rerun", "name": "Rerun", "title": "the hermit crab", "style": "pixel 2.5D",
        "role": "Its shell is glass with the receipts inside: a claim should carry its own evidence, so anyone can run the check again.",
        "habit": "It knocks on a claim to hear whether anything is in there, and keeps count of its own wrong guesses on its claw.",
        "home": "A pixel beach at two depths, with one spectral flare in the glass.",
        "films": ["passing-check", "release-media"],
        "alt": "Rerun, a red hermit crab with a glass prism for a shell, on a pixel-art beach; light through the prism splits into a small spectrum.",
        "close_alt": "Rerun's eyes on their stalks under the glass shell.",
    },
]

FILM_TITLES = {
    "checking-cost": "Claiming got cheap. Checking did not.",
    "passing-check": "A passing check can still be wrong",
    "rederive": "Re-derive it. Don't take it on trust.",
    "incentives": "Models do what training pays for",
    "visible-reasoning": "What a model's written reasoning can and cannot show",
    "release-media": "the films from the latest releases",
}

VOICE = "Each introduction runs about 25 seconds, with captions and no sound."


def by_film(slug: str) -> dict:
    return next(g for g in GUIDES if slug in g["films"])
