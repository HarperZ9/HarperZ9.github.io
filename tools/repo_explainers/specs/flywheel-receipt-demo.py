SHA = "89326085ecb7f0261c73370833ca524780c864c1"
B = f"https://github.com/HarperZ9/flywheel-receipt-demo/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

FLOW = ["task", "run the oracle", "receipt", "re-derive", "forge", "re-derive again"]

SPEC = {
    "slug": "flywheel-receipt-demo", "repo": "flywheel-receipt-demo", "sha": SHA, "name": "flywheel-receipt-demo", "version": "demo against flywheel-verify 1.5.0",
    "description": "An animated walk through flywheel-receipt-demo: one coding task run through Flywheel's receipt path, the receipt re-derived in a fresh process to MATCH, then forged and caught as DRIFT, with no API key, GPU or network. Built from flywheel-receipt-demo at commit 8932608.",
    "lede": "Run a re-derivable receipt in one command, and catch a forged one.",
    "for_you": "Flywheel's rule is no receipt, no accept, and no learned model on the path that accepts an answer. This repository lets you see that rule work on your own machine in one command: a real coding task runs, a receipt is written, a separate process re-derives it, and a forged copy is caught. It also lays out how the receipt could pair with hardware-attested inference, as a proposal.",
    "uses": [
        ("One command", "<code>python run_demo.py</code>, with no API key, no GPU and no network."),
        ("A separate process re-checks", "<code>harness.verify_receipt</code> re-derives the receipt in its own process."),
        ("A control that must fail", "The demo forges the receipt and requires the re-derivation to say DRIFT."),
        ("Check it yourself", "Edit any field of the receipt and run the verifier again."),
    ],
    "how_intro": "Scroll, or use the step buttons. Every line is output from <code>demo/run_demo.py</code> at commit 8932608, run against flywheel-verify 1.5.0 installed from PyPI.",
    "steps": [
        {"title": "A real task with a real check",
         "paras": ["The task asks for <code>merge_intervals</code>: merge overlapping integer intervals and return them sorted, where intervals that touch, like [1,2] and [2,3], merge into one. The oracle is pytest running <code>test_merge_intervals.py</code>.",
                   "The candidate answer comes from a stub, recorded as <code>model_ref: stub</code>, so the demo needs no model. What is under test is the receipt path."],
         "src": L("demo/task/task.json"),
         "scene": [{"pipe": {"stages": FLOW, "active": 0}},
                   {"io": {"lines": ['task id     merge-intervals.v1', 'oracle      pytest', 'oracle cmd  python -m pytest test_merge_intervals.py', 'prompt      Implement merge_intervals(intervals) in solution.py ...']}}]},
        {"title": "Run it and write the receipt",
         "paras": ["The engine runs the oracle against the candidate. The tests pass, the result is accepted, and the receipt records the task, the exact command, the candidate, the oracle's output hash and the verdict."],
         "src": L("demo/run_demo.py") + ", steps 2 and 3",
         "scene": [{"pipe": {"stages": FLOW, "active": 2}},
                   {"io": {"lines": ["verdict             PASS", "accepted            True", "oracle_cmd          python -m pytest test_merge_intervals.py --junitxml=_oracle_junit.xml -q", ["oracle_output_hash  a2e1d126b3cd1870", "hi"], "model_ref           stub", "receipt file        out/receipt.json"]}}]},
        {"title": "A fresh process re-derives it",
         "paras": ["A separate process reads the receipt, re-runs the oracle from the task files beside it, and compares. The recomputed verdict and output hash both match the claimed ones: MATCH, exit 0."],
         "src": "README.md, \"Quick start\"; flywheel <code>harness/verify_receipt.py</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 3}},
                   {"io": {"cmd": "python -m harness.verify_receipt --receipt out/receipt.json --task-dir task", "lines": ['claimed     verdict PASS, output_hash a2e1d126b3cd1870', 'recomputed  verdict PASS, output_hash a2e1d126b3cd1870', 'checks      output_hash_matches true, verdict_matches true'], "verdict": ["MATCH", "ok", "exit 0"]}}]},
        {"title": "Forge it, and the re-derivation catches it",
         "paras": ["The demo flips the stored verdict from PASS to FAIL and runs the verifier again. The output hash still matches, but the recomputed verdict is PASS against a claimed FAIL: DRIFT, exit 1.",
                   "A receipt that could not be forged would still say MATCH here. This control is what shows the check can fail."],
         "src": L("demo/run_demo.py") + ", step 5",
         "scene": [{"pipe": {"stages": FLOW, "active": 5}},
                   {"cases": {"label": "Choose the receipt", "items": [
                       {"label": "honest", "blocks": [{"io": {"lines": ["claimed PASS, recomputed PASS"], "verdict": ["MATCH", "ok", "exit 0"]}}]},
                       {"label": "forged: verdict set to FAIL", "blocks": [{"io": {"lines": ["claimed FAIL, recomputed PASS", "checks  output_hash_matches true, verdict_matches false"], "verdict": ["DRIFT", "drift", "exit 1"]}}]}]}}]},
        {"title": "What it proves, and what it does not",
         "paras": ["The demo ends by saying what it showed: the result re-derives from its receipt, and a forged result does not. It does not show the task is hard, that the answer is the best one, or anything about a model.",
                   "The repository also describes pairing a receipt with hardware-attested inference: attestation shows what ran, and the receipt shows the answer re-derives. That pairing is a proposal and is not shipped."],
         "src": L("demo/run_demo.py") + ", step 6; README.md, \"The two layers\" and \"Honest state\"",
         "scene": [{"table": {"head": ["layer", "shows", "status"], "rows": [["hardware attestation", "what code ran, in sealed hardware", "proposal"], ["Flywheel receipt", "the answer re-derives offline", "shipped, shown here"]]}},
                   {"verdict": ["honest MATCH, forged DRIFT", "ok", "the receipt path checks out"]}]},
    ],
    "try": [
        ("Install the engine from PyPI and run the demo (Python 3.11 or newer).",
         "$ pip install flywheel-verify pytest\n$ git clone https://github.com/HarperZ9/flywheel-receipt-demo && cd flywheel-receipt-demo/demo\n$ python run_demo.py\n<span class=\"out\">  RESULT: receipt path verified. Honest MATCH, forged DRIFT.</span>\n$ python -m harness.verify_receipt --receipt out/receipt.json --task-dir task"),
    ],
    "try_src": "Output from demo/run_demo.py at 8932608 with flywheel-verify 1.5.0 from PyPI on Windows. The repository's CI pins flywheel-verify 1.0.0.",
    "limits": [
        "The candidate answer comes from a stub. The demo tests the receipt path; generation is outside it.",
        "On the shipped benchmark the verified loop shows no accuracy gain over single-shot, and no capability uplift is claimed.",
        "The pairing with hardware-attested inference is a proposal and is not shipped.",
    ],
    "limits_src": "README.md at 8932608, \"Honest state\"; demo/run_demo.py step 6",
    "recall": [
        ("Who re-derives the receipt?", "A separate process running harness.verify_receipt from the task files."),
        ("When the verdict is forged to FAIL, which check fails?", "verdict_matches. The output hash still matches, and the recomputed verdict is PASS."),
        ("What does hardware attestation add that a receipt cannot?", "Evidence of what code ran in sealed hardware. The receipt shows the answer re-derives."),
    ],
    "license_line": "flywheel-receipt-demo is released under FSL-1.1-MIT.",
}
