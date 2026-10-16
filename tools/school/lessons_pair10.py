"""Lesson page specs for L16 Evaluating a language model and K21 Threads, workgroups and memory.

Each spec takes the lesson's facts.json and returns the words the lesson page needs; every
number is read from the facts, none typed here. tools/school/lessons.py renders them.
"""

from __future__ import annotations


def spec_evaluate(f: dict) -> dict:
    a = f["checkpoints"]["across"]
    return {
        "id": "L16", "slug": "evaluate", "guide": "Rerun",
        "title": "Evaluating a language model",
        "h1": "Evaluating <span class=\"g\">a language model.</span>",
        "desc": "One small model scored three ways, by loss, exact match and two judges, with error bars: where the scores agree, where they part, and how a leaked test fools them.",
        "lede": ("There is no single number for how good a language model is. Rerun scores one small model three ways as it trains, "
                 "tests a cheap judge against a perfect one, and leaks the test into training on purpose."),
        "film": "It asks you one question and waits for your answer before it shows you.",
        "lab_h": "The lab: three instruments",
        "lab": (f"Train the model from scratch in this page and score 64 fresh rows at each checkpoint: loss, exact match, a perfect judge and a cheap one. "
                f"In the film, at step 200 exact match was {a['200']['exact']['mean'] * 100:.0f}% while the cheap judge passed {a['200']['fluent']['mean'] * 100:.0f}% of the writing."),
        "lab_btn": "Set up the instruments", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/evaluate/facts.json")],
        "limits": [
            "One small model trained three times: the questions carry over to large models, the numbers do not.",
            "The perfect judge exists only because the rules that write this text are known; real evaluations use people or other models, which are not perfect.",
            "The cheap judge's preference for the first-shown and longer answer is written into its rule, to show the effect; it measures nothing about real model judges.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-gaming.html\">When the check can be fooled</a> (E24). Next, in the cannery: <a class=\"inline\" href=\"night-school-threads.html\">Threads, workgroups and memory</a> (K21).",
    }


def spec_threads(f: dict) -> dict:
    R = f["traffic"]["rows"]
    return {
        "id": "K21", "slug": "threads", "guide": "Pylon",
        "title": "Threads, workgroups and memory",
        "h1": "Threads, workgroups <span class=\"g\">and memory.</span>",
        "desc": "How a graphics chip adds a million numbers at once: threads, workgroups, idle threads at the edge, and why neighbouring reads take fewer trips to memory.",
        "lede": ("A graphics chip does thousands of small sums at the same time. Pylon runs the cannery where that happens, counts every thread "
                 "and every trip to the warehouse, and catches a thread that writes one place past the end."),
        "film": "It asks you two questions and waits for your answer before it shows you.",
        "lab_h": "The lab: the cannery floor",
        "lab": (f"Choose a crew size, a stride and a list length; count every thread and every trip with the emulator; then, if your browser has WebGPU, run the real kernel on your own chip, "
                f"check it and time it. In the film, reads eight apart took {R[3]['ratio32']:.2f} times the trips of neighbouring reads."),
        "lab_btn": "Open the cannery", "lab_note": "Counting runs in this page. Timing runs the kernel on your own graphics chip, only when you press Time. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/threads/facts.json")],
        "limits": [
            "The film's numbers are counts from a model of the chip, not times; caches are not modelled.",
            "Teams of 32 and 32-byte blocks are NVIDIA's; other chips use other sizes, so a time on your chip can differ from the count.",
            "The kernels were checked against the emulator and the main processor; they were not timed on a graphics chip for this film.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-matrices.html\">Matrices move space</a> (F2). Earlier at the prism: <a class=\"inline\" href=\"night-school-evaluate.html\">Evaluating a language model</a> (L16).",
    }
