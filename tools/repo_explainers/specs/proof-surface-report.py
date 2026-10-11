SHA = "a930401909cdaa4875c63c8561a4f8a696765c72"
B = f"https://github.com/HarperZ9/proof-surface-report/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

FLOW = ["packet or receipt", "validate shape", "check wording", "render", "Markdown handoff"]

SPEC = {
    "slug": "proof-surface-report", "repo": "proof-surface-report", "sha": SHA, "name": "Proof Surface Report", "version": "version 0.1.0",
    "description": "An animated walk through Proof Surface Report: a proof-surface packet and an EMET witness receipt rendered into one Markdown handoff for a reviewer, and the guards that refuse a title, a claim or a verdict worded as approval or certification. Built from proof-surface-report at commit a930401.",
    "lede": "Turn proof packets and witness receipts into Markdown a reviewer can read.",
    "for_you": "Receipts help only when a reviewer can read them quickly. Proof Surface Report takes proof-surface packets and EMET witness receipts and writes one Markdown handoff: a summary table, each packet's claims, checks and action items, and each receipt's verdict, subject and evidence. It refuses wording that would turn the handoff into an approval or a certification.",
    "uses": [
        ("One readable handoff", "Packets and receipts in, one Markdown report out, with sources named."),
        ("Shape checked first", "Unknown fields and ungoverned verdicts are rejected before anything renders."),
        ("No authority words", "Certified, approved, compliant and safe to release are refused in titles, claims and verdicts."),
        ("A small adapter", "Standard library plus the shared proof-surface contract package."),
    ],
    "how_intro": "Scroll, or use the step buttons. The panel renders the bundled synthetic examples, <code>examples/public-surface.packet.json</code> and <code>examples/emet.receipt.json</code>. Every line is output from proof-surface-report at commit a930401.",
    "steps": [
        {"title": "A packet and a receipt",
         "paras": ["The packet comes from a public-surface sweep: three claims, one check that warned at score 90, and one action item about an em dash in a README. The receipt is from EMET: a MATCH on README.md with its digest and the witness's own facts."],
         "src": L("examples/public-surface.packet.json") + ", " + L("examples/emet.receipt.json"),
         "scene": [{"pipe": {"stages": FLOW, "active": 0}},
                   {"table": {"head": ["artifact", "what it says"], "rows": [["packet", "status needs-polish; 3 claims; public-surface-sweeper warn, score=90"], ["packet action item", "README.md:14: replace em dash with plain punctuation"], ["receipt", "verdict MATCH, witness emet-python-reference, check verify"], ["receipt subject", "README.md sha256 2c26b46b68ffc68f..."]]}}]},
        {"title": "One Markdown handoff",
         "paras": ["The renderer validates both, then writes a summary table and a section for each artifact. The report opens by calling itself an evidence handoff, and disclaims certification, safety verdicts and authority in the same sentence."],
         "src": L("src/proof_surface_report/core.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 4}},
                   {"io": {"cmd": "proof-surface-report examples/public-surface.packet.json examples/emet.receipt.json", "lines": ["# Proof Surface Handoff Report", "This report summarizes proof-surface artifacts. It is an evidence handoff,", "not a certification, safety verdict, or authority claim.",
                                                                                                                         "| Packets | 1 |  | Witness receipts | 1 |  | Aggregate status | needs-polish |", "### Claims", "- Public text hygiene is checkable. Evidence: em-dash findings=1",
                                                                                                                         "### Action Items", "- README.md:14: replace em dash with plain punctuation", "## Witness Receipt: emet-verify-example-7d26e03c2a4f13b0", ["| Verdict | MATCH |", "hi"]],
                           "verdict": ["rendered", "ok", "exit 0"]}}]},
        {"title": "Two packets roll up to the weaker status",
         "paras": ["Render the public-surface packet with the provenance packet beside it. The provenance packet is ready; the public-surface packet needs polish. The summary counts six claims and two checks, and the aggregate status is needs-polish: the report carries the weaker of the two forward."],
         "src": L("examples/provenance.packet.json") + "; " + L("src/proof_surface_report/core.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 3}},
                   {"io": {"cmd": "proof-surface-report examples/public-surface.packet.json examples/provenance.packet.json", "lines": ["| Packets | 2 |", "| Witness receipts | 0 |", ["| Aggregate status | needs-polish |", "hi"], "| Claims | 6 |", "| Checks | 2 |", "| Action items | 1 |"]}}]},
        {"title": "Shape is checked before wording",
         "paras": ["Add a field the packet contract does not define, such as <code>reviewer_signoff</code>, and validation fails before rendering starts. A handoff cannot carry a sign-off field in through the side."],
         "src": "the proof-surface packet contract; " + L("src/proof_surface_report/core.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 1}},
                   {"io": {"cmd": "proof-surface-report extra.json", "lines": ["error: extra.json packet validation failed: $.reviewer_signoff unexpected field"], "verdict": ["refused", "drift"]}}]},
        {"title": "Words that would overclaim are refused",
         "paras": ["Give the report the title \"Certified release review\" and it refuses to render. Write a claim that the release is approved and safe to release, and the packet fails validation, naming each word. Set a receipt's verdict to TRUSTED, a word outside EMET's closed set, and it is rejected. Pick each case in the panel."],
         "src": L("src/proof_surface_report/core.py") + "; README.md, \"Existing technical notes\"",
         "scene": [{"pipe": {"stages": FLOW, "active": 2}},
                   {"cases": {"label": "Choose an input", "items": [
                       {"label": "title: Certified release review", "blocks": [{"io": {"cmd": 'proof-surface-report examples/public-surface.packet.json --title "Certified release review"', "lines": ["error: report title validation failed: $.title contains authority-shaped wording: certified"], "verdict": ["refused", "drift", "exit 1"]}}]},
                       {"label": "claim: approved and safe to release", "blocks": [{"io": {"cmd": "proof-surface-report approved.json", "lines": ["error: approved.json packet validation failed:", "$.claims[0].claim contains authority-shaped wording: approved;", "$.claims[0].claim contains authority-shaped wording: safe-for-release"], "verdict": ["refused", "drift"]}}]},
                       {"label": "verdict: TRUSTED", "blocks": [{"io": {"cmd": "proof-surface-report trusted.json", "lines": ["error: trusted.json receipt validation failed:", "$.verdict expected one of: COHERENT, CORROBORATED, DRIFT, MATCH, QUARANTINE_READ_PATH_DIVERGENCE, UNVERIFIABLE, VIEW_DIFFERS_FROM_SOURCE;", "$.verdict forbidden authority token: TRUSTED"], "verdict": ["refused", "drift"]}}]}]}}]},
    ],
    "try": [
        ("Install the proof-surface contract from git, then this package (Python 3.10 or newer).",
         "$ pip install git+https://github.com/HarperZ9/proof-surface.git\n$ git clone https://github.com/HarperZ9/proof-surface-report && cd proof-surface-report\n$ pip install .\n$ proof-surface-report examples/public-surface.packet.json examples/emet.receipt.json"),
    ],
    "try_src": "Output from proof-surface-report at a930401 with proof-surface on the path. The two refused files change one field each in copies of the bundled examples.",
    "limits": [
        "It renders a handoff. It is not a release approval system and makes no certification, safety or compliance finding.",
        "The wording guard catches the words on its list. A claim can still overstate in other words, and a reviewer reads for that.",
        "It validates two artifact shapes, proof-surface packets and EMET witness receipts. Other shapes are rejected.",
    ],
    "limits_src": "README.md at a930401, \"Current status\" and \"Existing technical notes\"",
    "recall": [
        ("What does the report call itself at the top?", "An evidence handoff, with certification, safety verdicts and authority disclaimed."),
        ("Why is a receipt with the verdict TRUSTED rejected twice over?", "TRUSTED is outside EMET's closed verdict set, and it is also a forbidden authority token."),
        ("Where does the authority-word guard apply?", "In artifact text, such as claims, and in the report title."),
    ],
    "license_line": "Proof Surface Report is released under the MIT license.",
}
