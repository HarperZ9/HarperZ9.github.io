"""Lesson page specs for track E (evaluation and honesty): E23 Error bars and E24 gaming.

Each spec takes the lesson's facts.json and returns the words the lesson page needs; every
number is read from the facts, none typed here. tools/school/lessons.py renders them.
"""

from __future__ import annotations


def spec_errorbars(f: dict) -> dict:
    R = f["coverage"]["runs"]
    return {
        "id": "E23", "slug": "errorbars", "guide": "Rerun",
        "title": "Error bars: how sure is the number",
        "h1": "Error bars. <span class=\"g\">How sure is the number.</span>",
        "desc": "Rerun bootstraps the attention model's score, checks the intervals against a truth known exactly, and shows what to resample: rows, words, or seeds.",
        "lede": ("Every score in this school came from one set of test rows. Rerun shows how far it could move, "
                 "checks that the error bars catch the truth as often as they claim, and finds the spread the rows cannot see."),
        "film": "It asks you one question and waits for your answer before it shows you.",
        "lab_h": "The lab: the bucket",
        "lab": (f"Resample the model's held-out rows or single words and watch the interval form; or draw fresh rows from the rules "
                f"again and again and count how often the interval holds the true average. In the film, {R['rows64']['rowPct']['coverage'] * 100:.1f}% "
                f"of 1,000 row intervals at 64 rows held it."),
        "lab_btn": "Open the bucket", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/errorbars/facts.json")],
        "limits": [
            "One small model and its own test rows: the method carries over, the numbers do not.",
            "Our rows hold one word at every position, which is why single-word intervals came out too wide here; with real clusters of questions, they come out too narrow.",
            f"Coverage at 16 and 64 rows ran about {round((0.95 - R['rows64']['rowPct']['coverage']) / R['rows64']['rowPct']['se'])} standard errors under 95%; percentile intervals are a little short when rows are few.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-heldout.html\">The held-out set</a> (F6). Next under the prism: <a class=\"inline\" href=\"night-school-gaming.html\">When the check can be fooled</a> (E24).",
    }


def spec_gaming(f: dict) -> dict:
    S = f["start200"]
    return {
        "id": "E24", "slug": "gaming", "guide": "Rerun",
        "title": "When the check can be fooled",
        "h1": "When the check <span class=\"g\">can be fooled.</span>",
        "desc": "Train a small model by trial and reward against a checker with a gap: the points climb to the top while the right answers fall to none.",
        "lede": ("Training pushes a model toward whatever the score pays for. Rerun builds a checker with a gap, trains against it, "
                 "and shows where the push goes, then closes the gap and checks the check."),
        "film": "It asks you one question and waits for your answer before it shows you.",
        "lab_h": "The lab: the gate",
        "lab": (f"Pick a checker and train the early attention model against it in this page; watch the points and the right answers. "
                f"In the film, the first checker's points ended at {S['gamed']['end']['reward']['mean'] * 100:.1f}% with {S['gamed']['end']['correct']['mean'] * 100:.0f}% of answers right; "
                f"with the gap closed, {S['fixed']['end']['correct']['mean'] * 100:.0f}% right."),
        "lab_btn": "Open the gate", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/gaming/facts.json")],
        "limits": [
            "One tiny model, one task and three runs per checker: it shows the mechanism, not how often it happens in large models.",
            "Correct means the right name and then a stop; most gamed answers began with the right name and never stopped.",
            "The model optimises what it is paid for; nothing here wants, tries or decides.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-errorbars.html\">Error bars</a> (E23). Earlier: <a class=\"inline\" href=\"night-school-trainloop.html\">The training loop</a> (L12).",
    }
