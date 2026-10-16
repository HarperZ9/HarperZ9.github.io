"""Lesson page specs for K23 Fused attention and K24 Mixed precision.

Each spec takes the lesson's facts.json and returns the words the lesson page needs; every
number is read from the facts, none typed here. tools/school/lessons.py renders them.
"""

from __future__ import annotations


def spec_fused(f: dict) -> dict:
    b = f["film"]["bars"]
    u16, f16, u64, f64 = b["d16"]["unfused"][6], b["d16"]["fused"][6], b["d64"]["unfused"][6], b["d64"]["fused"][6]
    held = f["overflow"]["heldOut"]
    over, total = sum(h["atOrOverFp16Overflow"] for h in held), sum(h["count"] for h in held)
    return {
        "id": "K23", "slug": "fused", "guide": "Pylon",
        "title": "Fused attention",
        "h1": "Fused <span class=\"g\">attention.</span>",
        "desc": "Attention without writing its table of scores: a running largest score and total, the bytes it saves, and the overflow the running largest prevents.",
        "lede": ("The plain way writes every head's table of scores to memory and reads it back twice. Pylon's crew keeps a running largest score and a running total instead, "
                 "never builds the table, and leaves the rescale out on purpose to see the checker catch it."),
        "film": "It asks you one question and waits for your answer before it shows you.",
        "lab_h": "The lab: the cannery",
        "lab": (f"Pick a kernel and sizes; the emulator counts every byte to and from memory and checks the answer against an exact one; then, if your browser has WebGPU, time the real kernels on your own chip. "
                f"In the film, at {u16['N']:,} words and 16 numbers per head, the plain way moved {u16['bytes']:,} bytes and fused {f16['bytes']:,}; "
                f"at 64 per head, {u64['bytes']:,} against {f64['bytes']:,}."),
        "lab_btn": "Open the cannery", "lab_note": "Counting runs in this page. Timing runs the kernels on your own graphics chip, only when you press Time. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/fused/facts.json")],
        "limits": [
            "Counts of bytes asked for, not times; caches can serve repeated reads, and the film's kernels were not timed on a graphics chip.",
            "The check tolerance is a first-order float32 error bound derived for this lesson, not a published one.",
            (f"The model computes in float32 and subtracts the largest score, so it never overflows; {over:,} of {total:,} held-out scores "
             "would overflow fp16 without that subtraction."),
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-tiling.html\">Matmul tiling</a> (K22). Next, in the lamp room: <a class=\"inline\" href=\"night-school-precision.html\">Mixed precision</a> (K24).",
    }


def spec_precision(f: dict) -> dict:
    S = {(r["format"], r["step"]): r for r in f["stagnation"]["rows"]}
    bars = {b["mode"]: b for b in f["film"]["lossBars"]}
    n = f["near110"]
    return {
        "id": "K24", "slug": "precision", "guide": "Tallow",
        "title": "Mixed precision",
        "h1": "Mixed <span class=\"g\">precision.</span>",
        "desc": "Run a model with 16-bit numbers: where fp16 and bf16 can put a value, why sums stall, and what keeping the sums in 32 bits buys on held-out rows.",
        "lede": ("Graphics chips multiply 16-bit numbers fastest. Tallow measures where fp16 and bf16 can put a value, adds 1 to a running total until it stops moving, "
                 "and scores the whole model with 16-bit inputs and with 16-bit sums."),
        "film": "It asks you one question and waits for your answer before it shows you.",
        "lab_h": "The lab: the measuring jugs",
        "lab": (f"Type a number and see the values each format can store around it; run a long sum; or score the model on held-out rows in each mode. "
                f"In the film, adding 1 stalled at {S[('fp16', 1)]['stuckAt']:,} in fp16 and {S[('bf16', 1)]['stuckAt']:,} in bf16; "
                f"near 110, fp16's marks are {n['fp16']['spacing']} apart. The model's loss was {bars['fp32']['value']:.4f} in 32 bits and {bars['bf16acc16']['value']:.4f} in bf16 throughout."),
        "lab_btn": "Take down the jugs", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/precision/facts.json")],
        "limits": [
            "The 16-bit formats are emulated by rounding in the main processor; no graphics chip and no tensor core ran these numbers.",
            "One small model; its scores are small enough that fp16 never overflows here, which large models cannot count on.",
            f"Scores on {f['recipe']['heldOutRows']:,} held-out rows; differences from 32 bits are paired on the same rows.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-fused.html\">Fused attention</a> (K23). Earlier: <a class=\"inline\" href=\"night-school-quant.html\">Quantisation</a> (S18).",
    }
