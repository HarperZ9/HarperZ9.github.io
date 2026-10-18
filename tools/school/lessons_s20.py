"""Lesson page spec for S20, the case study of our MMBU Challenge entry.

The spec takes the lesson's facts.json and returns the words the lesson page needs; every number is
read from the facts, none typed here. tools/school/lessons.py renders it.
"""

from __future__ import annotations


def spec_mmbu(f: dict) -> dict:
    R, L, S = f["records"], f["ledger"], f["records"]["survival"]
    n4, v = f["ft7"]["N4"], f["vocab"]["ft7minusFt6"]
    return {
        "id": "S20", "slug": "mmbu", "guide": "Tallow",
        "title": "Case study: our MMBU Challenge entry",
        "h1": "Our MMBU Challenge entry. <span class=\"g\">The logbook, misses included.</span>",
        "desc": "Two weeks of fine-tuning a small model for a biomedical image contest: every bar written first, the misses kept, and what the logbook cannot prove.",
        "lede": (f"For the MMBU Challenge we fine-tuned two small open models on {R['challenge']['sources']} disclosed sources and wrote down every bar before the result it judged. "
                 "Tallow opens the logbook: the runs that missed, the rule that turned away its own champion, a score that flipped sign when the answer key changed, and the gap in our own record."),
        "film": "It asks you one question and waits for your answer before it shows you.",
        "lab_h": "The lab: redo the logbook's intervals",
        "lab": (f"Pick a comparison and the lab reruns the scorer's bootstrap on the published per-row scores, in this page, with numpy's own random stream ported to JavaScript. "
                f"With the scorer's seed, {f['recomputedCount']} intervals come out to the logbook's printed digits, among them the candidacy bar, "
                f"+{n4['mean']} [{n4['lo']}, {n4['hi']}], and both readings of the held-out context score. Another seed moves the bounds in the third or fourth decimal."),
        "lab_btn": "Open the logbook", "lab_note": "The scores are loaded from this site and resampled on your computer. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/mmbu/facts.json"), ("published.json", "media/school/mmbu/published.json"), ("dev_per_row.json", "media/school/mmbu/data/dev_per_row.json"),
                 ("heldout_context_per_row.json", "media/school/mmbu/data/heldout_context_per_row.json"), ("heldout_task_per_row.json", "media/school/mmbu/data/heldout_task_per_row.json")],
        "limits": [
            "Every score here comes from our own local scorers. The contest's judge was never called, and dev scores will not match the final leaderboard. Nothing has been submitted.",
            "This is benchmark work. The images are benchmark data, and nothing here is a medical tool or a clinical claim.",
            (f"The ledger's fingerprints still match the rule files, but only entries up to {L['lastPushedEntry']} were pushed to GitHub before the results, the last on {L['lastPushDate']}; "
             f"entries {L['firstUnpushed']} to {L['lastEntry']}, which cover every run in the film, were first pushed on {L['latePushDate']}, after the results, and the ledger is now {L['visibility']}. "
             "So the claim that each bar came before its result has no outside timestamp before that date for those runs."),
            (f"The held-out vocabulary re-score (FT7 minus FT6: {v['original']['mean']} under the sources' words, +{v['harmonised']['mean']} under the paper's) was made after the fall was seen, "
             "so for these runs it is a measurement, not a test. The eighth run's reading was preregistered, but that run was paused before it was scored."),
            f"MMBU work is paused: the eighth run stopped at step {S['ft8Step']} of {S['ft8Steps']:,} when the author paused it on 16 October 2026. The contest runs to {R['challenge']['deadline']}.",
            "The lab re-derives the arithmetic from the published per-row scores. It does not check that those scores are right; they come from our scorers.",
        ],
        "next": ("Before this: <a class=\"inline\" href=\"night-school-lora.html\">LoRA and fine-tuning</a> (S19), <a class=\"inline\" href=\"night-school-evaluate.html\">Evaluating a language model</a> (L16) "
                 "and <a class=\"inline\" href=\"night-school-gaming.html\">When the check can be fooled</a> (E24). The same lesson about fingerprints, from the other side: "
                 "<a class=\"inline\" href=\"night-school-receipts.html\">A score that carries its receipt</a> (E25)."),
    }
