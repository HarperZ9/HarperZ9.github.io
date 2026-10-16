"""Lesson page specs for track S (small models): S17 Distillation and S19 LoRA.

Each spec takes the lesson's facts.json and returns the words the lesson page needs; every
number is read from the facts, none typed here. tools/school/lessons.py renders them.
"""

from __future__ import annotations


def _pc(v: float) -> str:
    return f"{v * 100:.0f}%"


def spec_distill(f: dict) -> dict:
    fd, low = f["fullData"]["arms"], f["lowData"]
    return {
        "id": "S17", "slug": "distill", "guide": "Tallow",
        "title": "Distillation: a big teacher, a small student",
        "h1": "Distillation. <span class=\"g\">A big teacher, a small student.</span>",
        "desc": "Train a small model on a big one's guesses instead of the text alone: when the teacher's soft answers help, and when the text is enough.",
        "lede": ("A big model is costly to run. Tallow trains a student a fifth its size on the attention model's whole "
                 "wheel of guesses, at several temperatures, and measures when that beats the text's own words."),
        "film": "It asks you two questions and waits for your answer before it shows you.",
        "lab_h": "The lab: two wheels",
        "lab": (f"Choose what the student learns from (the text's words, the teacher's wheel at a temperature, the teacher's top word, "
                f"or the rules' own odds) and how much text it sees; train it in this page and watch its wheel and held-out loss. "
                f"In the film, on {low['pool']['small']} rows the text's words ended at a held-out loss of {low['pool32']['hard']['heldOut']['mean']:.2f} "
                f"and the teacher's wheel at {low['pool32']['soft2']['heldOut']['mean']:.2f}; on fresh text, {fd['hard']['heldOut']['mean']:.2f} "
                f"and {fd['soft2']['heldOut']['mean']:.2f}."),
        "lab_btn": "Light the lamp", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/distill/facts.json")],
        "limits": [
            f"One teacher of {f['teacher']['nParams']:,} numbers and one student of {f['students']['sizes']['d16x1']['nParams']:,}, three seeds per arm: the results "
            "say what happens here, not how much distillation helps a large model.",
            "The teacher learned from far more text than the small pools, so the low-data result is what crosses over through the teacher's wheel, not learning from a few rows alone.",
            "The best checkpoint on a pool is read off the held-out rows themselves, which flatters every arm equally.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-trainloop.html\">The training loop</a> (L12). Next in the boatyard: <a class=\"inline\" href=\"night-school-lora.html\">LoRA and fine-tuning</a> (S19).",
    }


def spec_lora(f: dict) -> dict:
    r = f["methods"]["runs"]
    return {
        "id": "S19", "slug": "lora", "guide": "Tallow",
        "title": "LoRA and fine-tuning",
        "h1": "LoRA. <span class=\"g\">A small rudder for a big boat.</span>",
        "desc": "Teach a trained model a new habit by changing every number, a few, or a pair of thin LoRA strips: what each learns, and what each forgets.",
        "lede": ("Tallow teaches the attention model one new habit three ways and measures the new habit, the old skill, "
                 "and whether the change really needs only a few directions, as the LoRA paper argued."),
        "film": "It asks you one question and waits for your answer before it shows you.",
        "lab_h": "The lab: the rudder",
        "lab": (f"Pick a method, train it in this page on the new habit, and watch the change it makes to one attention table, "
                f"the new habit and the old skill. In the film, changing every number got {_pc(r['full']['answer']['mean'])} of answers right, "
                f"rank-1 strips on attention {_pc(r['lora.attn.r1']['answer']['mean'])}, and rank-8 strips on every table {_pc(r['lora.all.r8']['answer']['mean'])}."),
        "lab_btn": "Open the boatyard", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/lora/facts.json")],
        "limits": [
            "One small model, one new habit and one learning-rate grid, three seeds per method; at low rank the seeds disagree widely.",
            "Every method trained on the new habit alone; mixing old text into fine-tuning, the usual guard against forgetting, was not tried.",
            "The low-rank test covers this model and this habit only.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-distill.html\">Distillation</a> (S17). Earlier: <a class=\"inline\" href=\"night-school-matrices.html\">Matrices move space</a> (F2).",
    }
