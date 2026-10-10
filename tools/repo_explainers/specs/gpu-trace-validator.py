SHA = "b205bd4bdea45d1b1e5c80cde2c75e439ab78afc"
B = f"https://github.com/HarperZ9/gpu-trace-validator/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

FLOW = ["trace", "schema", "source", "events", "assertions", "verdicts", "expectation", "exit code"]

SPEC = {
    "slug": "gpu-trace-validator", "repo": "gpu-trace-validator", "sha": SHA, "name": "GPU Trace Validator", "version": "version 0.2.0",
    "description": "An animated walk through GPU Trace Validator: a renderer's trace checked against a bundled JSON schema, its assertion verdicts counted, a fixture that fails on purpose matched against an expected count in both directions, and a redacted JSON receipt. Built from gpu-trace-validator at commit b205bd4.",
    "lede": "Check a GPU trace against its schema and its expected failures, with a redacted receipt.",
    "for_you": "Renderers need more than screenshots. GPU Trace Validator checks a recorded trace of frames, resources and events against a bundled schema, counts the assertion verdicts in it, and tells you whether the number of failures matches what you expected. It prints a short summary or one JSON receipt with private values redacted, so a demo or a CI job can carry evidence without exposing payloads.",
    "uses": [
        ("A closed schema", "Six required root fields, and an unexpected property is named with its path anywhere in the trace."),
        ("Counts, not vibes", "Each assertion carries pass, fail, unknown or not applicable, and the failures and unknowns are counted."),
        ("Failure on purpose", "A fixture recorded to fail passes only when the failures equal the number you supplied."),
        ("Redacted receipts", "Each failure is summarised in nine named fields, with secrets and absolute paths removed."),
    ],
    "how_intro": "Scroll, or use the step buttons. The panel uses the two fixtures shipped in <code>tests/fixtures/</code>. Every line is output from gpu-trace-validator at commit b205bd4.",
    "steps": [
        {"title": "A trace is one JSON object",
         "paras": ["The passing fixture records one frame, one 64 by 64 RGBA texture and one event: an assertion named <code>frame_count</code> in the decode stage, with the verdict pass. The source says it is a hand-written fixture."],
         "src": L("tests/fixtures/trace_pass.json"),
         "scene": [{"pipe": {"stages": FLOW, "active": 0}},
                   {"io": {"lines": ['trace_id        trace-ok', 'source.kind     manual-fixture', 'frames          [{frame_id: 1, present_seq: 1}]', 'resources       [{r1, texture, rgba8, 64 x 64}]',
                                     ['events          [{assertion frame_count, stage decode, verdict pass}]', "hi"]]}}]},
        {"title": "Validate it",
         "paras": ["The bundled schema checks every field, then the assertions are counted. One assertion, no failures, no unknowns: pass, exit 0."],
         "src": L("src/gpu_trace_validator/validator.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 5}},
                   {"io": {"cmd": "gpu-trace-validator tests/fixtures/trace_pass.json", "lines": ["gpu_trace_validation: pass", "trace_id: trace-ok", "assertions: 1 total, 0 fail, 0 unknown"], "verdict": ["pass", "ok", "exit 0"]}}]},
        {"title": "An unexpected field is named, wherever it sits",
         "paras": ["Add a field the schema does not define, such as <code>approved</code> inside a frame. The trace fails and the error gives the path."],
         "src": L("src/gpu_trace_validator/schemas") + "; README.md, the trace lane",
         "scene": [{"pipe": {"stages": FLOW, "active": 1}},
                   {"io": {"cmd": "gpu-trace-validator extra.json", "lines": ["gpu_trace_validation: fail", ["error: frames/0: Additional properties are not allowed ('approved' was unexpected)", "hi"]], "verdict": ["fail", "drift", "exit 1"]}}]},
        {"title": "A fixture that fails on purpose",
         "paras": ["The failing fixture carries two assertions, <code>frame_count</code> and <code>checksum</code>, both fail. Run with no expectation and the run fails. Tell it to expect 2 and it passes. Expect 1 or 3 and it fails: fewer failures than expected is refused as firmly as more. Pick each case in the panel."],
         "src": L("tests/fixtures/trace_fail.json") + "; README.md, the expectation lane",
         "scene": [{"pipe": {"stages": FLOW, "active": 6}},
                   {"cases": {"label": "Choose the expectation", "items": [
                       {"label": "none", "blocks": [{"io": {"cmd": "gpu-trace-validator tests/fixtures/trace_fail.json", "lines": ["assertions: 2 total, 2 fail, 0 unknown", "error: observed 2 assertion failure(s)"], "verdict": ["fail", "drift", "exit 1"]}}]},
                       {"label": "--expect-failures 2", "blocks": [{"io": {"cmd": "gpu-trace-validator --expect-failures 2 tests/fixtures/trace_fail.json", "lines": ["gpu_trace_validation: pass", "assertions: 2 total, 2 fail, 0 unknown"], "verdict": ["pass", "ok", "exit 0: the failures were expected"]}}]},
                       {"label": "--expect-failures 1", "blocks": [{"io": {"cmd": "gpu-trace-validator --expect-failures 1 tests/fixtures/trace_fail.json", "lines": ["error: expected 1 assertion failure(s), observed 2"], "verdict": ["fail", "drift", "exit 1"]}}]},
                       {"label": "--expect-failures 3", "blocks": [{"io": {"cmd": "gpu-trace-validator --expect-failures 3 tests/fixtures/trace_fail.json", "lines": ["error: expected 3 assertion failure(s), observed 2"], "verdict": ["fail", "drift", "exit 1: fewer is refused too"]}}]}]}}]},
        {"title": "The receipt",
         "paras": ["With <code>--json</code> the run prints one object: the expectation and its status, the assertion counts, and each failure summarised by sequence, frame, pass, stage, slot, resource, assertion, verdict and provenance. No buffer or payload is carried out, and every string goes through the redactor first."],
         "src": L("src/gpu_trace_validator/cli.py") + "; README.md, the expectation lane",
         "scene": [{"pipe": {"stages": FLOW, "active": 7}},
                   {"io": {"cmd": "gpu-trace-validator --expect-failures 2 --json tests/fixtures/trace_fail.json",
                           "lines": ['"assertion_expectation": {"expected_failures": 2, "observed_failures": 2, "status": "pass"}', '"assertion_count": 2, "failure_count": 2, "unknown_count": 0',
                                     '{"seq": 1, "frame_id": 1, "pass_id": "p1", "stage": "decode", "slot": "0", "resource_id": "r1", "assertion": "frame_count", "verdict": "fail", "provenance": "gpu"}',
                                     '{"seq": 2, "frame_id": 2, "pass_id": "p2", "stage": "decode", "slot": "1", "resource_id": "r2", "assertion": "checksum", "verdict": "fail", "provenance": "gpu"}', ['"status": "pass"', "hi"]]}}]},
    ],
    "try": [
        ("Install from a checkout (Python 3.10 or newer); it is not on PyPI.",
         "$ git clone https://github.com/HarperZ9/gpu-trace-validator && cd gpu-trace-validator\n$ python -m pip install -e \".[test]\"\n$ gpu-trace-validator tests/fixtures/trace_pass.json\n<span class=\"out\">gpu_trace_validation: pass\ntrace_id: trace-ok\nassertions: 1 total, 0 fail, 0 unknown</span>\n$ gpu-trace-validator --expect-failures 2 --json tests/fixtures/trace_fail.json"),
    ],
    "try_src": "Output from gpu-trace-validator at b205bd4 on Windows with Python 3.12.",
    "limits": [
        "It validates traces produced elsewhere. It does not capture GPU work.",
        "A pass says the trace matches the schema and the expected failure count. It does not certify that the renderer is correct.",
        "An unknown verdict is reported, and the run can still exit 0, because unknown is a reading about the trace and not a refusal of it.",
        "Summaries are truncated at 240 characters after redaction.",
    ],
    "limits_src": "README.md at b205bd4, \"Current status\", \"Notes\" and the status table",
    "recall": [
        ("Why does a fixture that fails on purpose pass with --expect-failures 2?", "Its two failures equal the number supplied, which is what the run checks."),
        ("Expect 3 failures when 2 occur. What happens?", "The run fails: fewer failures than expected is refused as firmly as more."),
        ("What does the receipt carry for each failure?", "Nine named fields: sequence, frame, pass, stage, slot, resource, assertion, verdict and provenance. No raw payload."),
    ],
    "license_line": "GPU Trace Validator is released under FSL-1.1-MIT from version 0.2.0.",
}
