"""Lesson page specs for S18 Quantisation and K22 Matmul tiling.

Each spec takes the lesson's facts.json and returns the words the lesson page needs; every
number is read from the facts, none typed here. tools/school/lessons.py renders them.
"""

from __future__ import annotations


def spec_quant(f: dict) -> dict:
    r, g = f["schemes"]["rows"][18], f["schemes"]["rows"][19]
    return {
        "id": "S18", "slug": "quant", "guide": "Tallow",
        "title": "Quantisation: fewer bits per number",
        "h1": "Quantisation. <span class=\"g\">Fewer bits per number.</span>",
        "desc": "Store a model's weights in 8, 6, 4, 3 or 2 bits and measure what it loses: scales per table, per output and per group, and GPTQ's careful rounding.",
        "lede": ("Every weight is stored in 32 bits. Tallow stores them in fewer, with one scale per table, per output or per group, "
                 "rounds them plainly or with GPTQ, and scores each version on the same held-out rows."),
        "film": "It asks you one question and waits for your answer before it shows you.",
        "lab_h": "The lab: the palette",
        "lab": (f"Pick the bits, the scale and the rounding; the page quantises the model, scores it on held-out rows against the full one and repaints one table. "
                f"In the film, 4 bits with one scale per output raised the loss by {r['loss']['diff']:.4f} by plain rounding and {g['loss']['diff']:.4f} by GPTQ, "
                f"at {r['bytes']['ratio'] * 100:.0f}% of the size."),
        "lab_btn": "Open the palette", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/quant/facts.json")],
        "limits": [
            f"One model of {f['schemes']['float']['bytes']:,} bytes; large models behave differently, and their activation outliers do not show here because activations stay in full precision.",
            "Symmetric round-to-nearest without a zero point, and GPTQ with a symmetric grid and calibration text from the lesson's own generator.",
            "Scores on 1,024 held-out rows; differences from the full model are paired on the same rows.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-threads.html\">Threads, workgroups and memory</a> (K21). Next, in the cannery: <a class=\"inline\" href=\"night-school-tiling.html\">Matmul tiling</a> (K22).",
    }


def spec_tiling(f: dict) -> dict:
    R = f["counts"]["rows"]
    return {
        "id": "K22", "slug": "tiling", "guide": "Pylon",
        "title": "Matmul tiling",
        "h1": "Matmul <span class=\"g\">tiling.</span>",
        "desc": "Multiply two tables on a graphics chip by carrying tiles to fast shared memory: how many reads it saves, why the crew must wait, and what the count leaves out.",
        "lede": ("Most of the arithmetic in a language model is multiplying tables. Pylon counts every read from memory for the simple kernel and for tiled ones, "
                 "and breaks the wait on purpose to see the checker catch it."),
        "film": "It asks you one question and waits for your answer before it shows you.",
        "lab_h": "The lab: the trays",
        "lab": (f"Pick a kernel and a size; count every read and check the answer with the emulator; then, if your browser has WebGPU, run the real kernel on your own chip and time it. "
                f"In the film, at {R[12]['n']:,} wide, tiles of {R[14]['T']} took {R[14]['globalLoads']:,} reads against {R[12]['globalLoads']:,}."),
        "lab_btn": "Hand out the trays", "lab_note": "Counting runs in this page. Timing runs the kernel on your own graphics chip, only when you press Time. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/tiling/facts.json")],
        "limits": [
            "Counts of reads asked for, not times; caches can serve repeated reads, so the simple kernel may be faster than its count suggests.",
            "The missing-wait failure was shown in the emulator under a worst-case schedule, not on a chip.",
            "The kernels were checked against the main processor within a float32 error bound; they were not timed on a graphics chip for this film.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-threads.html\">Threads, workgroups and memory</a> (K21). Earlier: <a class=\"inline\" href=\"night-school-quant.html\">Quantisation</a> (S18).",
    }
