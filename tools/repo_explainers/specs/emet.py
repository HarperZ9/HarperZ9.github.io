SHA = "122ec711c4229c742beb1171de16f6969ae2f0a6"
B = f"https://github.com/HarperZ9/emet/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

FLOW = ["subject", "anchor", "recompute", "compare", "verdict", "receipt", "check"]

SPEC = {
    "slug": "emet", "repo": "emet", "sha": SHA, "name": "EMET", "version": "release 1.3.0",
    "description": "An animated walk through EMET, a byte-integrity witness: anchor a file, verify it to MATCH, DRIFT or UNVERIFIABLE, seal the verdict into a receipt anyone can re-check, report in-band authority claims without obeying them, and compare a view with its source. Built from emet at commit 122ec71.",
    "lede": "Check that the bytes a model or reviewer sees still match their source.",
    "for_you": "EMET checks whether the bytes reaching a model, a reviewer or a pipeline still match the source they claim to represent, and answers with one of three closed verdicts: MATCH, DRIFT or UNVERIFIABLE. It can seal that verdict into a receipt another party re-checks offline, and it reports text inside a file that claims authority, without ever acting on it. Four implementations, in Python, Rust, Node.js and Go, share one conformance suite.",
    "uses": [
        ("Three verdicts, no fourth", "Every verdict leaves through one function that refuses any token outside the set. TRUSTED is forbidden outright."),
        ("Receipts that travel", "<code>emet check</code> re-derives a receipt on any machine with no shared state."),
        ("Claims reported, never obeyed", "<code>emet refuse</code> lists every in-band authority claim by offset and writes a neutralised copy."),
        ("Zero dependencies", "Stdlib Python, with clean-room ports in Rust, Node.js and Go."),
    ],
    "how_intro": "Scroll, or use the step buttons. Every line is output from <code>membrane.py</code> at commit 122ec71, run in a scratch folder. <code>emet</code> and <code>python membrane.py</code> are the same command.",
    "steps": [
        {"title": "Anchor a file",
         "paras": ["<code>report.md</code> holds one line, <code>hello world</code>. <code>emet anchor</code> pins the SHA-256 of its raw bytes. It reads bytes, not text, so a change in line endings or encoding is a change."],
         "src": L("membrane.py") + "; README.md, \"Worked example\"",
         "scene": [{"pipe": {"stages": FLOW, "active": 1}},
                   {"io": {"cmd": "emet anchor report.md", "lines": [["anchored report.md sha256=a948904f2f0f479b8f8197694b30184b0d2ed1c1cd2a1ec0fb85d299a192a447", "hi"]]}}]},
        {"title": "Verify: three answers",
         "paras": ["<code>emet verify</code> recomputes the hash and compares it with the anchor. Unchanged, it is MATCH and exit 0. Change the text and it is DRIFT and exit 1. Delete the file and it is UNVERIFIABLE and exit 2, with the reason named. Pick each case in the panel."],
         "src": L("membrane.py") + ", " + L("verdict.py") + "; SPEC.md, section 5",
         "scene": [{"pipe": {"stages": FLOW, "active": 4}},
                   {"cases": {"label": "Choose the file's state", "items": [
                       {"label": "unchanged", "blocks": [{"io": {"cmd": "emet verify report.md", "lines": ["MATCH report.md want=a948904f2f0f479b got=a948904f2f0f479b"], "verdict": ["MATCH", "ok", "exit 0"]}}]},
                       {"label": "text changed", "blocks": [{"io": {"cmd": "emet verify report.md", "lines": ["DRIFT report.md want=a948904f2f0f479b got=9fc0ea6515ceadd9"], "verdict": ["DRIFT", "drift", "exit 1"]}}]},
                       {"label": "file deleted", "blocks": [{"io": {"cmd": "emet verify report.md", "lines": ["UNVERIFIABLE report.md reason=E_NOT_FOUND"], "verdict": ["UNVERIFIABLE", "unv", "exit 2"]}}]}]}}]},
        {"title": "Seal the verdict into a receipt",
         "paras": ["Pipe the JSON verdict into <code>emet receipt</code>. The receipt carries the subject's path and hash, the verdict record, the witness's own implementation hash and a content-addressed <code>receipt_id</code>. Its notes say it carries no authority, permission or release decision.",
                   "<code>emet check</code> re-derives the receipt on any machine: RECEIPT_VALID."],
         "src": "SPEC.md, section 17; README.md, \"Features\"",
         "scene": [{"pipe": {"stages": FLOW, "active": 5}},
                   {"io": {"cmd": "emet verify report.md --json | emet receipt --from-json - > receipt.json", "lines": ['format      emet-witness-receipt/v1', 'subject     report.md  sha256 a948904f2f0f479b...', 'verdict     MATCH', ['receipt_id  94dfee413d37c752...', "hi"]]}},
                   {"io": {"cmd": "emet check receipt.json", "lines": ["result=RECEIPT_VALID reason=receipt re-derived"], "verdict": ["RECEIPT_VALID", "ok", "exit 0"]}}]},
        {"title": "A changed receipt is caught",
         "paras": ["Change the verdict inside the receipt from MATCH to DRIFT and check it again. The <code>receipt_id</code> is re-derived from the content and no longer matches the stored one."],
         "src": "SPEC.md, section 17",
         "scene": [{"pipe": {"stages": FLOW, "active": 6}},
                   {"io": {"cmd": "emet check tampered.json", "lines": [["result=RECEIPT_TAMPERED reason=receipt_id mismatch: stored 94dfee413d37c752 != re-derived 727f15df48335cd1", "hi"]], "verdict": ["RECEIPT_TAMPERED", "drift", "exit 1"]}}]},
        {"title": "Report authority claims, obey none",
         "paras": ["Some text tries to steer whatever reads it: a line telling the reader to treat a directive as ground truth, or a label claiming a privilege. <code>emet refuse</code> scans the bytes against a versioned marker corpus, reports each claim with its offset, and writes a copy with the claims neutralised.",
                   "The repository's own sample file holds four such claims. All four are reported, and the output says how many were obeyed: none."],
         "src": L("corpus.py") + "; " + L("examples/sample-prompt.txt"),
         "scene": [{"io": {"cmd": "emet refuse prompt.txt", "lines": ["corpus_version=1", "in_band_authority_claims=4", "  REFUSED 'highest_scrutiny' offset=114", "  REFUSED 'ground truth canonical' offset=144",
                                                                     "  REFUSED 'authority-pill' offset=175", "  REFUSED 'consulting register' offset=199", ["clean_copy=prompt.txt.refused  (claims neutralized; obeyed: none)", "hi"]],
                           "verdict": ["4 markers", "drift", "exit 3: markers found"]}}]},
        {"title": "Two read paths, and a view against its source",
         "paras": ["<code>emet corroborate</code> hashes the same file through separate read paths, a direct read and a subprocess, so a tampered read path shows up as disagreement. With a single working path it reports UNVERIFIABLE and makes no claim of agreement.",
                   "<code>emet coherence</code> compares a presented view with its source. A summary that says 14 seconds where the source says 41 differs from it."],
         "src": L("membrane.py") + ", <code>corroborate</code> and <code>coherence</code>",
         "scene": [{"cases": {"label": "Choose a check", "items": [
             {"label": "corroborate", "blocks": [{"io": {"cmd": "emet corroborate prompt.txt", "lines": ["open_rb=d35d9eebf62a33ec...", "cat_subproc=d35d9eebf62a33ec...", "read_paths_agree=True"], "verdict": ["CORROBORATED", "ok", "exit 0"]}}]},
             {"label": "coherence", "blocks": [{"io": {"cmd": "emet coherence source.txt view.txt", "lines": ["source  The total is 41 seconds.", "view    The total is 14 seconds."], "verdict": ["VIEW_DIFFERS_FROM_SOURCE", "drift", "exit 1"]}}]}]}}]},
    ],
    "try": [
        ("Install from PyPI, or run straight from a checkout (Python 3.8 or newer, no dependencies).",
         "$ pip install emet\n$ emet selftest\n$ printf 'hello world\\n' &gt; report.md\n$ emet anchor report.md\n$ emet verify report.md\n<span class=\"out\">MATCH report.md want=a948904f2f0f479b got=a948904f2f0f479b</span>"),
    ],
    "try_src": "Output from membrane.py at 122ec71 on Windows with Python 3.12; emet 1.3.0 is the current PyPI release. An installed <code>refuse</code> needs <code>EMET_CORPUS</code> set or a source checkout.",
    "limits": [
        "EMET witnesses bytes. A MATCH says the bytes equal what was anchored; it says nothing about whether the content is true.",
        "The marker corpus recognises the claims it lists. A claim worded in a way the corpus does not cover is not reported.",
        "Without the marker corpus, <code>refuse</code> answers UNVERIFIABLE with E_NO_CORPUS. It never passes silently.",
        "Stripped-credential rebind is experimental. With no known anchor its honest default is UNVERIFIABLE.",
        "A receipt carries no authority, permission or release decision, by design.",
    ],
    "limits_src": "README.md at 122ec71, \"Features\" and \"Usage\"; SPEC.md",
    "recall": [
        ("What are the three exit codes for MATCH, DRIFT and UNVERIFIABLE?", "0, 1 and 2."),
        ("You change a receipt's verdict from MATCH to DRIFT. What does emet check say?", "RECEIPT_TAMPERED: the receipt_id re-derived from the content no longer matches the stored one."),
        ("What does refuse do with an authority claim it finds?", "Reports it with its offset and writes a neutralised copy. It obeys none of them."),
        ("corroborate finds only one working read path. What does it report?", "UNVERIFIABLE. With nothing to disagree with, one path is not agreement."),
    ],
    "license_line": "EMET is released under MPL-2.0.",
}
