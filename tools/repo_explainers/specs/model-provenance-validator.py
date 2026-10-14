SHA = "1da6150ada42fdb3751143bc502aedd785ffcd24"
B = f"https://github.com/HarperZ9/model-provenance-validator/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

FLOW = ["envelope", "shape", "closed values", "result", "summary", "proof packet"]

SPEC = {
    "slug": "model-provenance-validator", "repo": "model-provenance-validator", "sha": SHA, "name": "Model Provenance Validator", "version": "version 0.1.1",
    "description": "An animated walk through Model Provenance Validator: a provenance envelope for a public claim checked field by field, an invalid one turned into named errors and action items, a status word outside the allowed set refused, and a proof-surface packet for the batch. Built from model-provenance-validator at commit 1da6150.",
    "lede": "Keep a model or release claim attached to a small envelope you can check.",
    "for_you": "A model card, a README claim or a release note gets repeated, and its source goes missing. Model Provenance Validator checks a small JSON envelope that says what the claim is about, where the source came from, when it was retrieved and what validation status you are willing to publish. A batch run turns every problem into an action item, and redacts credential-shaped strings and local paths from its own messages.",
    "uses": [
        ("A source before the claim", "Subject, source, references with retrieval dates, and a published validation status are all required."),
        ("Closed vocabularies", "Source kinds and validation statuses come from fixed lists, so a status like certified is refused."),
        ("Batch to action list", "Malformed files are reported as invalid results, and the run still finishes with a complete list."),
        ("Proof packet", "<code>--proof-packet</code> writes a proof-surface packet for the batch."),
    ],
    "how_intro": "Scroll, or use the step buttons. The panel uses the bundled example envelope and the repository's invalid test fixture. Every line is output from model-provenance-validator at commit 1da6150.",
    "steps": [
        {"title": "An envelope for one claim",
         "paras": ["The bundled example is about a README's release-readiness claim. It names the source and its kind, a reference with a locator and the date it was retrieved, and a validation status of <code>partial</code> with a note that a person still has to review it."],
         "src": L("examples/envelopes/release.provenance.json"),
         "scene": [{"pipe": {"stages": FLOW, "active": 0}},
                   {"table": {"head": ["field", "value"], "rows": [["subject", "public-surface-sweeper README release-readiness claim"], ["source", "public-surface-sweeper README, kind release-note"],
                                                                     ["references", "Repository README, github.com/HarperZ9/public-surface-sweeper, retrieved 2026-06-13"], ["validation", "partial: human review still required"]]}}]},
        {"title": "Validate it",
         "paras": ["The validator checks the five required fields, the allowed values and every nested field. The example is valid and the command exits 0."],
         "src": L("src/model_provenance_validator/validator.py") + ", " + L("src/model_provenance_validator/schema.json"),
         "scene": [{"pipe": {"stages": FLOW, "active": 3}},
                   {"io": {"cmd": "model-provenance-validator examples/envelopes/release.provenance.json", "lines": ["examples/envelopes/release.provenance.json: valid"], "verdict": ["valid", "ok", "exit 0"]}}]},
        {"title": "Every problem, with its path",
         "paras": ["The invalid fixture has an empty subject, an unknown source kind, no references and an extra field inside validation. Each becomes one error with a JSON path, and the command exits 1."],
         "src": L("tests/fixtures/invalid.json"),
         "scene": [{"pipe": {"stages": FLOW, "active": 2}},
                   {"io": {"cmd": "model-provenance-validator tests/fixtures/invalid.json", "lines": ["tests/fixtures/invalid.json: invalid", "  $.subject: expected non-empty string",
                                                                                                 "  $.source.kind: invalid value 'unknown-kind'; expected one of: official-doc, paper, release-note, local-fixture, other",
                                                                                                 "  $.references: expected at least 1 item(s)", "  $.validation.extra: unexpected field"], "verdict": ["invalid", "drift", "exit 1"]}}]},
        {"title": "A status you may publish",
         "paras": ["The validation status is a closed set: verified, partial or unknown. Change the example's status to <code>certified</code> and the envelope is refused."],
         "src": L("src/model_provenance_validator/schema.json"),
         "scene": [{"pipe": {"stages": FLOW, "active": 2}},
                   {"io": {"cmd": "model-provenance-validator cert.provenance.json", "lines": ["cert.provenance.json: invalid", ["  $.validation.status: invalid value 'certified'; expected one of: verified, partial, unknown", "hi"]], "verdict": ["invalid", "drift", "exit 1"]}}]},
        {"title": "A batch becomes an action list, and a packet",
         "paras": ["Run both files with <code>--summary</code> and you get totals and one action item per invalid file. <code>--proof-packet</code> writes a proof-surface packet whose claims and checks carry the counts. Pick each in the panel."],
         "src": L("src/model_provenance_validator/cli.py") + ", " + L("src/model_provenance_validator/packet.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 5}},
                   {"cases": {"label": "Choose an output", "items": [
                       {"label": "--summary", "blocks": [{"io": {"cmd": "model-provenance-validator examples/envelopes/release.provenance.json tests/fixtures/invalid.json --summary", "lines": ["total: 2", "valid: 1", "invalid: 1", "error_count: 4", "action_items:", ["- tests/fixtures/invalid.json: resolve 4 validation error(s)", "hi"]], "verdict": ["exit 1", "drift", "one envelope needs work"]}}]},
                       {"label": "--proof-packet", "blocks": [{"io": {"cmd": "model-provenance-validator examples/envelopes/release.provenance.json --proof-packet", "lines": ['"surface": "model provenance validation"', '"status": "ready"', '"claims": envelopes=1; valid=1, invalid=0; validation errors=0', ['"checks": [{"tool": "model-provenance-validator", "status": "pass", "summary": "valid=1, invalid=0, errors=0"}]', "hi"], '"action_items": []']}}]}]}}]},
    ],
    "try": [
        ("Install from PyPI (Python 3.10 or newer).",
         "$ python -m pip install model-provenance-validator\n$ git clone https://github.com/HarperZ9/model-provenance-validator && cd model-provenance-validator\n$ model-provenance-validator examples/envelopes/release.provenance.json\n<span class=\"out\">examples/envelopes/release.provenance.json: valid</span>"),
    ],
    "try_src": "Output from model-provenance-validator at 1da6150 run from source; version 0.1.1 is the current PyPI release.",
    "limits": [
        "It validates the envelope's shape and the hygiene of its own report. The claim the envelope is about stays uncertified.",
        "A valid envelope means the fields are present and well-formed. Whether the reference supports the claim needs a person.",
        "Redaction applies to the validator's messages. The envelope file you wrote is left as written.",
    ],
    "limits_src": "README.md at 1da6150, \"Current status\" and \"Usage\"",
    "recall": [
        ("What four problems does the invalid fixture have?", "An empty subject, an unknown source kind, no references and an unexpected field inside validation."),
        ("Why is a status of certified refused?", "The status is a closed set of verified, partial and unknown."),
        ("Does a valid envelope prove the claim is true?", "No. It proves the claim carries a well-formed source record."),
    ],
    "license_line": "Model Provenance Validator is released under the MIT license.",
}
