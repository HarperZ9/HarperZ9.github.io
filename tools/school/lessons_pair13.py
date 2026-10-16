"""Lesson page specs for K25 the denoiser's tensor-core parity and E25 Flywheel's receipts.

Each spec takes the lesson's facts.json and returns the words the lesson page needs; every
number is read from the facts, none typed here. tools/school/lessons.py renders them.
"""

from __future__ import annotations


def spec_denoiser(f: dict) -> dict:
    P, M = f["primary"], f["primary"]["mixed"]
    img = f["recreation"]["image"]["WA"]
    return {
        "id": "K25", "slug": "denoiser", "guide": "Rerun",
        "title": "Case study: the denoiser's tensor-core parity",
        "h1": "The denoiser's <span class=\"g\">tensor-core parity.</span>",
        "desc": "A real parity check that failed: 16-bit tensor-core arithmetic against a fixed bound, a sun glint that broke it, the fixes that fell short, and a bound that stayed.",
        "lede": ("raw-native's neural denoiser runs on the tensor cores with 16-bit inputs and weights, or in plain 32-bit. "
                 f"On an RTX 4090 the tensor-core path missed its parity bound of {f['recipe']['bound']} by ten times, at one sun glint. "
                 "Rerun follows the search for why, and the fix that was not made: moving the bound."),
        "film": "It asks you one question and waits for your answer before it shows you.",
        "lab_h": "The lab: the parity check",
        "lab": (f"Pick a version of the arithmetic, a seed and whether the image has its glint, and run every pixel against the exact value with raw-native's own bound and measure. "
                f"The image is a small synthetic stand-in built to the note's magnitudes: with the glint, the tensor-core arithmetic missed on {img['pixelsOver']} of {img['values'] // 3} pixels at seed 1. "
                f"The real chip's figure was {P['rtx']['coop']['max_abs']}."),
        "lab_btn": "Raise the prism", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/denoiser/facts.json")],
        "limits": [
            "The film's figures for the real denoiser come from raw-native's published evidence; the re-creation is synthetic, because the frame's pixel values and the network's weights are not in that evidence.",
            "The emulations ran on a processor, not the tensor cores, so their summation order may differ from the chip's; they agree with it on the worst frame and pixel.",
            (f"Three mixed-precision splits were tried, down to {M['keep-10_1_9_8_0_3']['max_abs']:.4f}; other splits were not, so the film says none of those tried met the bound."),
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-precision.html\">Mixed precision</a> (K24). Next, on the same beach: <a class=\"inline\" href=\"night-school-receipts.html\">A score that carries its receipt</a> (E25).",
    }


def spec_receipts(f: dict) -> dict:
    R, M = f["receipt"], f["film"]
    return {
        "id": "E25", "slug": "receipts", "guide": "Rerun",
        "title": "Case study: a score that carries its receipt",
        "h1": "A score that carries <span class=\"g\">its receipt.</span>",
        "desc": "Re-derive a published score from its receipt in your browser, flip any byte and watch the check fail, and see the one lie a receipt cannot catch.",
        "lede": (f"Flywheel's demonstration receipt says {R['correct']} of {R['total']} and carries the fingerprints to prove its rows were not changed. "
                 "Rerun recounts the rows, recomputes every fingerprint in this page, tampers with every byte, and finds the edit that only the true answers can catch."),
        "film": "It asks you one question and waits for your answer before it shows you.",
        "lab_h": "The lab: the receipt",
        "lab": (f"The real bundle, checked from scratch in this page. Flip any byte of any file and check again, or try a cheater's edits. "
                f"In the film's sweep, all {M['results']['bytes']:,} flips of the rows file were caught, and {M['receipt']['caught']:,} of {M['receipt']['bytes']:,} in the receipt."),
        "lab_btn": "Open the shell", "lab_note": "The bundle is checked on your computer, in this page, with your browser's own SHA-256 and Ed25519. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/receipts/facts.json"), ("receipt.json", "media/school/receipts/receipt.json"), ("results.jsonl", "media/school/receipts/results.jsonl")],
        "limits": [
            "The receipt is Flywheel's demonstration fixture with a toy job, not a real model's evaluation.",
            "A receipt proves the bytes have not changed since they were signed and which key signed them; it does not prove the rows were true, or that the run was the only one.",
            "The sweep flips one byte at a time; edits by someone who holds the key are the signed lie the film shows.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-gaming.html\">When the check can be fooled</a> (E24) and <a class=\"inline\" href=\"night-school-evaluate.html\">Evaluating a language model</a> (L16). Earlier on this beach: <a class=\"inline\" href=\"night-school-denoiser.html\">The denoiser's tensor-core parity</a> (K25).",
    }
