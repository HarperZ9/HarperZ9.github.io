SHA = "11a31215924a1a07329745001a7ad3b9b658e5dc"
B = f"https://github.com/HarperZ9/repo-proof-index/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

FLOW = ["artifacts", "strict JSON", "shape-tolerant read", "index row", "summary", "validate"]

SPEC = {
    "slug": "repo-proof-index", "repo": "repo-proof-index", "sha": SHA, "name": "Repo Proof Index", "version": "version 0.2.0",
    "description": "An animated walk through Repo Proof Index: four kinds of proof artifact read into one reviewer table, each status labelled as declared by its producer and not verified, a summary with action items, and a strict JSON reader that rejects duplicate keys and NaN before anything is indexed. Built from repo-proof-index at commit 11a3121.",
    "lede": "Index a repository's proof packets and receipts into one table a reviewer can read.",
    "for_you": "As a repository collects receipts and proof packets, a reviewer needs to find what each one claims and where its evidence lives. Repo Proof Index reads them all, whatever their shape, and gives one row per artifact: its kind, the surface it describes, the status it reports, a short evidence line and its path. It says plainly which statuses it checked and which it only read.",
    "uses": [
        ("One table for many shapes", "Proof contracts, proof-surface packets, witness receipts and backend descriptors all become rows."),
        ("Declared is not verified", "Each row records the producer's status and a separate verification state."),
        ("Action items", "<code>--summary</code> counts kinds and statuses and lists what needs work."),
        ("A strict reader first", "Duplicate keys, NaN and Infinity, oversized files and deep nesting are rejected before indexing."),
    ],
    "how_intro": "Scroll, or use the step buttons. The panel indexes the four artifacts in <code>examples/contracts/</code>. Every line is output from repo-proof-index at commit 11a3121.",
    "steps": [
        {"title": "Four artifacts, one table",
         "paras": ["The examples hold a proof-surface packet, a backend capability descriptor, a product use-case contract and a witness receipt. Each has its own shape. The index gives every one the same columns."],
         "src": L("examples/contracts") + "; " + L("src/repo_proof_index/indexer.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 3}},
                   {"table": {"head": ["kind", "surface", "status", "evidence"], "rows": [
                       ["proof-surface-packet", "public release read...", "needs-polish", "declared=needs-polish, verification=not_verified, claims=3, checks=3"],
                       ["backend-capability", "rust", "backend-matrix", "pass=1, planned=1"], ["product-use-case", "sample-tool", "release-candidate", "pass: example tests passed"],
                       ["witness-receipt", "sample-witness", "MATCH", "sample receipt available"]]}}]},
        {"title": "A status read is not a status checked",
         "paras": ["The witness receipt says MATCH. The index records that as the producer's status and sets its own verification state to <code>not_assessed</code>, because it did not re-run the witness. It indexes the evidence; it does not decide whether the evidence is enough."],
         "src": L("src/repo_proof_index/indexer.py") + "; README.md, opening paragraph",
         "scene": [{"pipe": {"stages": FLOW, "active": 3}},
                   {"io": {"cmd": "repo-proof-index examples/contracts/sample-witness-receipt.json --json", "lines": ['"kind": "witness-receipt"', '"status": "MATCH"', ['"producer_status": "MATCH"', "hi"], ['"verification_state": "not_assessed"', "hi"]]}}]},
        {"title": "A summary with what to do next",
         "paras": ["<code>--summary</code> counts the kinds, the statuses and the verification states, and turns any status that needs work into an action item. Here the proof-surface packet says it needs polish."],
         "src": L("src/repo_proof_index/cli.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 4}},
                   {"io": {"cmd": "repo-proof-index examples/contracts/*.json --summary", "lines": ["total: 4", "kinds: backend-capability=1, product-use-case=1, proof-surface-packet=1, witness-receipt=1",
                                                                                               "statuses: MATCH=1, backend-matrix=1, needs-polish=1, release-candidate=1", "verification_states: not_assessed=3, not_verified=1", "evidence_gaps: 0",
                                                                                               "action_items:", ["- proof-surface-public-release-demo: resolve needs-polish", "hi"]]}}]},
        {"title": "Validate a packet's shape",
         "paras": ["<code>--validate</code> checks a proof-surface packet against the shared contract. The example packet is structurally valid. Valid shape and a verified status are different things, and the index keeps them apart."],
         "src": L("src/repo_proof_index/cli.py") + "; the proof-surface packet contract",
         "scene": [{"pipe": {"stages": FLOW, "active": 5}},
                   {"io": {"cmd": "repo-proof-index --validate examples/contracts/proof-surface-packet.json", "lines": ["examples/contracts/proof-surface-packet.json: valid"], "verdict": ["valid shape", "ok", "status still not_verified"]}}]},
        {"title": "A strict reader before a tolerant one",
         "paras": ["The parser tolerates unknown shapes, but only after a strict JSON read. A key written twice, such as a status of MATCH and then DRIFT, is rejected; so is a NaN value, and so is a file that holds no JSON object. Pick each file in the panel."],
         "src": L("src/repo_proof_index/strict_json.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 1}},
                   {"cases": {"label": "Choose a file", "items": [
                       {"label": "status written twice", "blocks": [{"io": {"cmd": "repo-proof-index dup.json", "lines": ["error: duplicate JSON key: status"], "verdict": ["rejected", "drift"]}}]},
                       {"label": "a NaN value", "blocks": [{"io": {"cmd": "repo-proof-index nan.json", "lines": ["error: non-finite JSON value: NaN"], "verdict": ["rejected", "drift"]}}]},
                       {"label": "not an object", "blocks": [{"io": {"cmd": "repo-proof-index examples/malformed/not-object.json", "lines": ["error: ...not-object.json did not contain a JSON object"], "verdict": ["rejected", "drift"]}}]}]}}]},
    ],
    "try": [
        ("Install from PyPI (Python 3.10 or newer).",
         "$ python -m pip install repo-proof-index\n$ git clone https://github.com/HarperZ9/repo-proof-index && cd repo-proof-index\n$ repo-proof-index examples/contracts/*.json --summary\n<span class=\"out\">total: 4\nverification_states: not_assessed=3, not_verified=1</span>"),
    ],
    "try_src": "Output from repo-proof-index at 11a3121 run from source with proof-surface on the path.",
    "limits": [
        "It indexes evidence. It does not decide whether the evidence is enough, and it produces no compliance finding.",
        "A status in the table is the producer's word unless the verification state says otherwise.",
        "Shape-tolerant parsing gives unknown artifacts best-effort fields, which a reviewer should read as guesses.",
    ],
    "limits_src": "README.md at 11a3121, opening paragraph, \"Current status\" and \"Existing technical notes\"",
    "recall": [
        ("The witness receipt says MATCH. What is its verification state, and why?", "not_assessed: the index read the status and did not re-run the witness."),
        ("A file writes the key status twice. What happens?", "The strict reader rejects it before indexing: duplicate JSON key."),
        ("What turns a row into an action item?", "A status that needs work, such as the packet's needs-polish."),
    ],
    "license_line": "Repo Proof Index is released under the MIT license.",
}
