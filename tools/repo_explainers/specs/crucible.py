SHA = "14fca4fe80576e172c3cd1bed2c0fca57be3139c"
B = f"https://github.com/HarperZ9/crucible/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

STAGES = ["thesis", "steelman", "measure", "verdict", "registry", "recheck"]
C1 = "at most 11 comparisons for n=1024"
C2 = "at most 3 comparisons for n=1024"
C3 = "more elegant than linear search"

SPEC = {
    "slug": "crucible", "repo": "crucible", "sha": SHA, "name": "crucible", "version": "release 1.5.0",
    "description": "An animated walk through crucible: a thesis split into claims with falsification conditions, a pure verdict function that gives MATCH, DRIFT or UNVERIFIABLE from a measurement, a sealed registry and a recheck that catches a flipped verdict. Built from crucible at commit 14fca4f.",
    "lede": "Register a thesis, measure each claim, and name the weakest one.",
    "for_you": "crucible turns a thesis into claims, each paired with the observation that would refute it. It measures each claim, gives each one a verdict from a pure function of the measurement, and writes a sealed record that anyone can recheck. A claim with nothing to measure is reported as unverifiable, never as a pass.",
    "uses": [
        ("Claims with their refutation", "Each claim states what measured result would prove it wrong. A claim that states none cannot pass."),
        ("A verdict with no model in it", "<code>verdict_for</code> compares a deviation with a tolerance. The same record always gives the same verdict."),
        ("A record that resists edits", "Theses, claims, measurements and verdicts are sealed by SHA-256. A flipped verdict fails the recheck."),
        ("A CI gate", "<code>crucible ci</code> exits non-zero when a claim loses standing against a sealed baseline."),
    ],
    "how_intro": "Scroll, or use the step buttons. The panel follows the bundled example thesis on binary search, from <code>examples/</code>, through <code>crucible run</code>. Every id, verdict and margin is output from crucible at commit 14fca4f.",
    "steps": [
        {"title": "A thesis is a list of claims",
         "paras": ["The example thesis makes three claims about binary search on 1,024 sorted elements: at most 11 comparisons, at most 3 comparisons, and \"more elegant than linear search\".",
                   "Each claim carries a falsification condition: the measured result that would refute it. The third claim has an empty one."],
         "src": L("examples/thesis-binary-search.json"),
         "scene": [{"pipe": {"stages": STAGES, "active": 0}},
                   {"table": {"head": ["claim", "refuted by"], "rows": [
                       [C1, "a measured worst case above 11"], [C2, "a measured worst case above 3"], [C3, "(nothing stated)"]]}},
                   {"verdict": ["thesis bd7404c02eb2036e", "ink", "the seal hashes the title, disposition and every claim"]}]},
        {"title": "Steelman each claim",
         "paras": ["Before anything is measured, each claim gets the strongest test against it. The default steelman restates the claim's own falsification condition as the challenge. The third claim gets none: with no condition, it cannot be refuted, and the record says so."],
         "src": L("src/crucible/steelman.py") + "; README.md, \"How a thesis run works\"",
         "scene": [{"pipe": {"stages": STAGES, "active": 1}},
                   {"io": {"cmd": "steelman refutations: 3", "lines": [
                       "7ff70998  test the stated falsification: a measured worst-case comparison count above 11 for n=1024",
                       "6c256194  test the stated falsification: a measured worst-case comparison count above 3 for n=1024",
                       ["2fb8fae1  the claim states no falsification condition, so it cannot be refuted", "hi"]]}}]},
        {"title": "Measure: deviation against tolerance",
         "paras": ["A measurement gives each claim a deviation and a tolerance. The worst case for 1,024 elements is floor(log2 1024) + 1 = 11 probes, so the 11 claim deviates by 0 and the 3 claim deviates by 8. Both use a tolerance of 0.5.",
                   "The elegance claim gets no measurement."],
         "src": L("examples/measurements-binary-search.json"),
         "scene": [{"pipe": {"stages": STAGES, "active": 2}},
                   {"table": {"head": ["claim", "deviation", "tolerance", "evidence"], "rows": [
                       [C1, "0", "0.5", "worst case is floor(log2(1024)) + 1 = 11"], [C2, "8", "0.5", "worst case 11, claimed 3, excess 8"], [C3, "none", "none", "none"]]}}]},
        {"title": "The verdict is a pure function",
         "paras": ["<code>verdict_for</code> runs a fixed ladder. No falsification condition: UNVERIFIABLE. No measurement, or one bound to a different claim: UNVERIFIABLE. A tolerance that differs from the one sealed with the claim: UNVERIFIABLE, so a verdict cannot be rescued by widening it later.",
                   "Otherwise the margin is (tolerance minus deviation) divided by tolerance. A margin of 0 or more is MATCH; below 0 is DRIFT. Pick each claim in the panel."],
         "src": L("src/crucible/verdict.py") + ", <code>verdict_for</code>",
         "scene": [{"pipe": {"stages": STAGES, "active": 3}},
                   {"cases": {"label": "Choose a claim", "items": [
                       {"label": "at most 11", "blocks": [{"io": {"cmd": "margin = (0.5 - 0) / 0.5", "lines": [["= 1.0", "hi"]], "verdict": ["MATCH", "ok", "deviation 0 within tolerance 0.5"]}}]},
                       {"label": "at most 3", "blocks": [{"io": {"cmd": "margin = (0.5 - 8) / 0.5", "lines": [["= -15.0", "hi"]], "verdict": ["DRIFT", "drift", "deviation 8 exceeds tolerance 0.5"]}}]},
                       {"label": "more elegant", "blocks": [{"io": {"cmd": "falsification = \"\"", "lines": [["ladder stops at rung 1", "hi"]], "verdict": ["UNVERIFIABLE", "unv", "claim states no falsification condition"]}}]}]}}]},
        {"title": "Seal it into the registry",
         "paras": ["The assessment goes into a content-addressed registry with a seal over the verdicts and another over the measurements. Each claim carries its own SHA-256, and the registry rejects a second thesis with the same id and a different seal.",
                   "The assessment seal includes the run's start time, so a new run writes a new seal. The thesis seal and the claim ids stay the same."],
         "src": L("src/crucible/registry.py") + "; README.md, \"Highlights\"",
         "scene": [{"pipe": {"stages": STAGES, "active": 4}},
                   {"io": {"cmd": "crucible run examples/thesis-binary-search.json --measurements examples/measurements-binary-search.json --registry .crucible-registry",
                           "lines": ["ran thesis bd7404c02eb2036e: 3 claim(s)", "  steelman refutations: 3", ["  MATCH 1  DRIFT 1  UNVERIFIABLE 1", "hi"],
                                     "  assessment seal: ec7783a3a1c0e8e8...", ["  re-derived from disk: True  {'seals_ok': True, 'thesis_ok': True, 'verdicts_rederive': True}", "hi"]],
                           "verdict": ["exit 0", "ok", "the run re-read its own record from disk and every check held"]}}]},
        {"title": "Flip one verdict, and the recheck catches it",
         "paras": ["The bundled demo changes the DRIFT verdict to MATCH inside the sealed assessment, then verifies it again. Verification fails: the edited record no longer agrees with what its seal and measurements re-derive."],
         "src": L("examples/demo.py"),
         "scene": [{"pipe": {"stages": STAGES, "active": 5}},
                   {"io": {"cmd": "python examples/demo.py", "lines": ["counts: MATCH 1  DRIFT 1  UNVERIFIABLE 1", "assessment seal 07dafef03f5c..., verified True",
                                                                        ["after flipping a DRIFT to a MATCH, verified False  <- caught", "hi"]],
                           "verdict": ["verified False", "drift", "a flipped verdict is caught"]}}]},
    ],
    "try": [
        ("Install from PyPI (Python 3.11 or newer). The quickstart inputs ship with the package.",
         "$ pip install crucible-bench\n$ crucible examples --out crucible-examples\n$ crucible run crucible-examples/thesis-binary-search.json --measurements crucible-examples/measurements-binary-search.json --registry .crucible-registry\n<span class=\"out\">ran thesis bd7404c02eb2036e: 3 claim(s)\n  steelman refutations: 3\n  MATCH 1  DRIFT 1  UNVERIFIABLE 1</span>"),
    ],
    "try_src": "Output from crucible at 14fca4f; crucible-bench 1.5.0 is the current PyPI release. The assessment seal line is left out because it changes with each run's start time.",
    "limits": [
        "A verdict is only as good as the measurement fed to it. crucible checks that a measurement binds to its claim; it cannot check that the measuring was done well.",
        "A claim with no falsification condition is never passed. Opinions like \"more elegant\" stay UNVERIFIABLE by design.",
        "The LLM-as-judge measure puts a model at the measurement step. The verdict still comes from <code>verdict_for</code>, but the deviation is the judge's.",
        "A sealed record shows the verdicts were not edited after the run. It does not show the thesis was worth testing.",
    ],
    "limits_src": "README.md at 14fca4f, \"Highlights\" and \"How a thesis run works\"; src/crucible/verdict.py",
    "recall": [
        ("Why does the elegance claim read UNVERIFIABLE and not DRIFT?", "It states no falsification condition, so verdict_for stops at the first rung. Nothing could refute it, so nothing can confirm it."),
        ("What is the margin for the \"at most 3\" claim, and what verdict does it give?", "(0.5 minus 8) divided by 0.5, which is -15. Below zero, so DRIFT."),
        ("A measurement arrives with a wider tolerance than the one sealed with the claim. What happens?", "UNVERIFIABLE. The sealed tolerance decides, so a verdict cannot be rescued by widening the bound after the seal."),
        ("Why does the assessment seal change between runs when the verdicts do not?", "The assessment record includes the run's start time. The thesis seal and the claim hashes stay fixed."),
    ],
    "license_line": "crucible is released under FSL-1.1-MIT.",
}
