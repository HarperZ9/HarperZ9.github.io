"""The three guides, as one record each: the words every page uses about them.

guides.html (tools/guides/page.py), the host line on each film (tools/explainer/film/page.py), the
Writing hub and the home page (home/src/guides.ts, checked against this file by
tests/test_guides.py) all take their words from here, so the pages cannot tell different stories.
"""
from __future__ import annotations

GUIDES = [
    {
        "id": "tallow", "intro_s": 26, "name": "Tallow", "title": "the night clerk", "style": "retro thriller",
        "role": "His head is a candle, and the wax is the time he has: every claim he checks burns a little of it.",
        "habit": "Before he looks, he asks what you think. Then you find the source together.",
        "home": "A dark claims office, lit only by his flame.",
        "films": ["checking-cost", "visible-reasoning"],
        "drafts": ["brender-frame", "keepers-hour-trailer"],
        "alt": "Tallow, a tall clerk whose head is a lit candle, holds a reference card up to his flame in a dark office.",
        "close_alt": "Tallow's face: one eye in the wax under the flame.",
    },
    {
        "id": "pylon", "intro_s": 26, "name": "Pylon", "title": "the claims inspector", "style": "painted isometric",
        "role": "A harbour seal in a traffic cone. A cone means nobody has checked a claim yet, and she puts one on every claim that washes in.",
        "habit": "She shows you where each claim came from, tells you what is still waiting, and leaves the call to you.",
        "home": "A painted harbour town, seen from above.",
        "films": ["rederive", "incentives"],
        "alt": "Pylon, a heavy harbour seal wearing an orange traffic cone and a sash, stands on a lamplit harbour street holding a paper.",
        "close_alt": "Pylon's face under her cone, deadpan.",
    },
    {
        "id": "rerun", "intro_s": 20, "name": "Rerun", "title": "the hermit crab", "style": "pixel 2.5D",
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

# Films whose scene code is in review and not yet on a live page: the host is decided (the rule
# in this file: Tallow for one light in the dark), but no page lists them until each one ships,
# when its slug moves into the guide's "films" and its title into FILM_TITLES.
DRAFT_TITLES = {
    "brender-frame": "How a 1998 engine drew a frame",
    "keepers-hour-trailer": "The Keeper's Hour trailer",
}

VOICE = ("Each guide speaks its introduction in its own synthesized voice. A speech model trained on the author's "
         "recordings reads the lines, and code written for the guides reshapes that reading into each guide's voice. "
         "Captions are on, and the sound plays only when you press play.")

# The introductions that carry a sound track, and which voice take each one is. Only a take the
# author approved after listening goes here (2026-10-12, verbatim: "I do like the voice changes.").
# Rerun's take moved from round 10 (V5) to round 11 (V8) when the author chose it over round 10
# (2026-10-14, verbatim: "r11").
# tools/guides/build_media.py refuses --intro for any other guide, and tests/test_guides.py checks
# that an introduction has sound exactly when it is listed here.
INTRO_VOICES = {
    "tallow": "character voice, round 7, setting H",
    "pylon": "character voice, round 7, setting S",
    "rerun": "character voice, round 11, setting V8",
}


# Films a guide hosts whose scene code is in review and which no page shows yet: their film.json
# says "draft": true (tests/test_explainer_film_drafts.py). Pages and the home page leave them out
# until the film ships, which is when the flag comes off.
def _drafts() -> set[str]:
    import json
    from pathlib import Path
    root = Path(__file__).resolve().parents[2] / "media" / "explainers"
    return {p.parent.name for p in root.glob("*/film.json") if json.loads(p.read_text(encoding="utf-8")).get("draft")}


DRAFTS = _drafts()


def live_films(g: dict) -> list[str]:
    return [f for f in g["films"] if f not in DRAFTS]


def by_film(slug: str) -> dict:
    return next(g for g in GUIDES if slug in g["films"])
