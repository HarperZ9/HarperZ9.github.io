SHA = "da827816e28dd5db976b3910784bafb7ef601200"
B = f"https://github.com/HarperZ9/coherence-membrane/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

FLOW = ["perceive", "observation", "pin baseline", "check", "verdict", "receipt"]

SPEC = {
    "slug": "coherence-membrane", "repo": "coherence-membrane", "sha": SHA, "name": "Coherence Membrane", "version": "version 0.2.0 alpha",
    "description": "An animated walk through Coherence Membrane: an agent's observation of a file turned into exact and canonical hashes, a baseline checked on a three-rung ladder so reformatting matches and a changed value drifts, a propositional claim verified or refuted with a counterexample, and a receipt that is UNVERIFIABLE until its anchor is pinned. Built from coherence-membrane at commit da82781.",
    "lede": "Give an agent observations of files, images and screens that it can re-check.",
    "for_you": "An agent that edits a file or reads a screen needs a record of what it saw. Coherence Membrane turns files, images, sound, structured data and screen captures into observations with exact hashes and fingerprints, compares later observations against a baseline you authorised, and answers MATCH, DRIFT or UNVERIFIABLE. For logical, arithmetic and graph claims it runs a deterministic checker, so the model proposes and the checker decides.",
    "uses": [
        ("Observations with hashes", "Each observation carries an exact SHA-256 and, where it applies, a canonical form or a perceptual hash."),
        ("A baseline ladder", "Byte identity, then canonical identity, then perceptual distance: reformatting is not drift."),
        ("Checkers, not guesses", "Logic, quantities, distributions, linear arithmetic and graph claims get a certificate from a deterministic oracle."),
        ("Two implementations agree", "A 16-case conformance corpus is re-derived by the Python reference and an independent Node.js core."),
    ],
    "how_intro": "Scroll, or use the step buttons. The panel follows the README's worked example on a small JSON document and two logic claims. Every line is output from coherence-membrane at commit da82781.",
    "steps": [
        {"title": "Observe a document",
         "paras": ["Observe the JSON document <code>{\"a\": 1, \"b\": 2}</code>. The structured-data perceiver records the SHA-256 of the exact bytes and of a canonical form with keys sorted and spacing normalised, along with its type and key count."],
         "src": L("src/coherence_membrane") + ", <code>StructuredDataOrgan</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 1}},
                   {"io": {"cmd": "StructuredDataOrgan().observe(b'{\"a\": 1, \"b\": 2}')", "lines": ["identity_sha256   d8497d9d82770a70...", "canonical_sha256  43258cff783fe703...", "top_level_type    object", "key_count         2"]}}]},
        {"title": "Pin it, then check what comes later",
         "paras": ["Pin that observation as the authorised baseline. Later observations are checked on a ladder: same bytes first, then same canonical form, then perceptual distance where a fingerprint exists. Pick each later document in the panel.",
                   "The same keys in a different order with different spacing are a MATCH on the canonical rung. A changed value is a DRIFT. A broken document is a DRIFT too, and the check says it cannot measure how far."],
         "src": L("src/coherence_membrane/baseline.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 4}},
                   {"cases": {"label": "Choose the later document", "items": [
                       {"label": "{\"a\": 1, \"b\": 2}", "blocks": [{"io": {"lines": ["matches the pinned baseline (identity equal)"], "verdict": ["MATCH", "ok", "byte rung"]}}]},
                       {"label": "{ \"b\": 2, \"a\": 1 }", "blocks": [{"io": {"lines": ["canonical form equal (normalised bytes match; raw bytes differ)"], "verdict": ["MATCH", "ok", "canonical rung"]}}]},
                       {"label": "{\"a\": 1, \"b\": 3}", "blocks": [{"io": {"lines": ["canonical form changed from the baseline (normalised content differs)"], "verdict": ["DRIFT", "drift"]}}]},
                       {"label": "{\"a\": 1,", "blocks": [{"io": {"lines": ["changed from baseline; a perceptual fingerprint is missing so the magnitude is unquantified"], "verdict": ["DRIFT", "drift", "the size of the change is not claimed"]}}]}]}}]},
        {"title": "A claim gets a certificate",
         "paras": ["Logic claims go to a deterministic checker. Modus ponens, if A and A implies B then B, is verified: its negation is unsatisfiable. Affirming the consequent, if B and A implies B then A, is refuted, and the certificate gives the counterexample: A false, B true."],
         "src": L("src/coherence_membrane/propositional.py"),
         "scene": [{"cases": {"label": "Choose a claim", "items": [
             {"label": "modus ponens", "blocks": [{"io": {"cmd": "((A & (A -> B)) -> B)", "lines": ["oracle    propositional-dpll-v1", "evidence  valid: negation unsatisfiable"], "verdict": ["verified", "ok"]}}]},
             {"label": "affirming the consequent", "blocks": [{"io": {"cmd": "((B & (A -> B)) -> A)", "lines": ["oracle    propositional-dpll-v1", "evidence  counterexample A = 0, B = 1"], "verdict": ["refuted", "drift"]}}]}]}}]},
        {"title": "A receipt needs its anchor",
         "paras": ["<code>emit_receipt</code> wraps an observation in a witness receipt with an anchor you can pin or sign out of band. Verified against the pinned anchor it is VALID. Verified with no anchor it is UNVERIFIABLE: the receipt alone cannot vouch for itself."],
         "src": L("src/coherence_membrane") + ", <code>emit_receipt</code> and <code>verify_receipt</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 5}},
                   {"table": {"head": ["verify_receipt", "verdict"], "rows": [["with pinned_anchor 2fdae9515f6c334f...", ["VALID", "ok"]], ["with no anchor", ["UNVERIFIABLE", "unv"]]]}}]},
        {"title": "Two implementations, one corpus",
         "paras": ["A frozen corpus of 16 cases is re-derived value for value by the Python reference and by a Node.js core that shares no code with it. Both pass all 16."],
         "src": L("conformance/run.py") + ", " + L("impl/js"),
         "scene": [{"io": {"cmd": "python conformance/run.py", "lines": ['{"cases": 16, "passed": 16, "failed": 0, "corpus_sha256": "0748fc1adef9753d..."}']}},
                   {"io": {"cmd": "node impl/js/run.js", "lines": ['{"impl":"js","cases":16,"passed":16,"failed":0}'], "verdict": ["16 of 16", "ok", "in both"]}}]},
    ],
    "try": [
        ("Install from a checkout (Python 3.10 or newer); release 0.1.0 is on PyPI and this tree is the 0.2.0 alpha.",
         "$ git clone https://github.com/HarperZ9/coherence-membrane && cd coherence-membrane\n$ python -m pip install -e \".[test]\"\n$ python -m coherence_membrane selftest\n$ python conformance/run.py\n<span class=\"out\">{\"cases\": 16, \"passed\": 16, \"failed\": 0, ...}</span>"),
    ],
    "try_src": "Output from coherence-membrane at da82781 on Windows with Python 3.12 and Node 25. The class names in code use the word organ; this page calls them perceivers.",
    "limits": [
        "Screen capture reads the composited display. Use it only on surfaces you own or are authorised to inspect.",
        "A MATCH on the canonical rung means the normalised content is equal. It says nothing about whether that content is right.",
        "A deterministic checker certifies the claim it was given. Translating a question into that claim is still the agent's work.",
        "This source tree is an alpha. The PyPI release is 0.1.0.",
    ],
    "limits_src": "README.md at da82781, \"Install\" and \"Quickstart\"",
    "recall": [
        ("Why is { \"b\": 2, \"a\": 1 } a MATCH against { \"a\": 1, \"b\": 2 }?", "Their canonical forms are equal, so the ladder matches on its second rung."),
        ("What does the refutation of affirming the consequent carry?", "A counterexample: A false and B true."),
        ("Why is a receipt UNVERIFIABLE without an anchor?", "Nothing outside the receipt vouches for it until you pin or sign its anchor."),
    ],
    "license_line": "Coherence Membrane is released under FSL-1.1-MIT.",
}
