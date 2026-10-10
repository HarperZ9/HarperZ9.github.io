SHA = "e6503f0a0529d55bafa5e4a3f261a93ed0e9e43b"
B = f"https://github.com/HarperZ9/secret-redact-io/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

FLOW = ["call", "do the IO", "redact", "hash", "receipt", "return"]
RULES = [["private_key", "a PEM private key block"], ["openai_api_key", "sk- followed by 32 or more letters and digits"], ["github_token", "ghp_, gho_, ghu_, ghs_ or ghr_ and 20 more"],
         ["aws_access_key", "AKIA and 16 capitals or digits"], ["jwt", "three base64url parts starting eyJ"], ["bearer_token", "Bearer and 20 or more token characters"],
         ["credential_field", "password, secret, token or api_key followed by = or :"]]

SPEC = {
    "slug": "secret-redact-io", "repo": "secret-redact-io", "sha": SHA, "name": "Secret Redact IO", "version": "version 0.1.0",
    "description": "An animated walk through Secret Redact IO: guarded file, fetch and subprocess IO that redacts seven secret shapes before anything is returned or written, and leaves a receipt of hashes and counts with no raw values. Built from secret-redact-io at commit e6503f0.",
    "lede": "Guarded file, fetch and exec IO that strips secrets and keeps hash-only receipts.",
    "for_you": "Agents need to read files, run commands and fetch pages, and raw output can carry credentials into logs and model context. Secret Redact IO wraps those calls: what comes back is redacted, a guarded write stores the redacted text, and each call leaves a receipt of hashes, byte counts and rule counts that never archives the secret itself.",
    "uses": [
        ("Redacted before it returns", "File reads, writes, fetches and subprocess output all pass through the same seven rules."),
        ("A dry run first", "A guarded write can show its redacted text and receipt before anything reaches disk."),
        ("Receipts without the secret", "Input and output are recorded as SHA-256 digests and byte counts, with a count per rule that fired."),
        ("Stdlib only", "A small Python SDK and CLI with no dependencies."),
    ],
    "how_intro": "Scroll, or use the step buttons. The inputs are the fake tokens from the repository's own <code>examples/demo.py</code>, such as <code>ghp_</code> followed by 36 copies of b. Every line is output from secret-redact-io at commit e6503f0.",
    "steps": [
        {"title": "Seven shapes, and no more",
         "paras": ["The default policy has seven rules. Each matches a shape: a PEM block, a key with a known prefix, a JWT, a bearer header, or a value written beside a word like password or token. A match is replaced with a label naming the rule."],
         "src": L("src/secret_redact_io/redaction.py") + ", <code>GuardrailPolicy.default</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 2}}, {"table": {"head": ["rule", "matches"], "rows": RULES}}]},
        {"title": "Redact text in memory",
         "paras": ["<code>redact_text</code> runs the rules over a string. A GitHub token and a password field both go, and the result counts each rule that fired."],
         "src": L("examples/demo.py") + ", <code>redact_text</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 2}},
                   {"io": {"cmd": 'policy.redact_text("token=ghp_bbbb...b\\npassword=hunter2")', "lines": [["token=[REDACTED:github_token] | password=[REDACTED:credential_field]", "hi"], "counts: {'github_token': 1, 'credential_field': 1}", "total:  2"]}}]},
        {"title": "Guarded reads, writes and commands",
         "paras": ["The same rules guard real IO. A file holding an OpenAI-shaped key reads back redacted. A dry-run write shows the redacted text it would store and writes nothing. A subprocess that prints a token returns redacted stdout. Pick each call in the panel."],
         "src": L("src/secret_redact_io/file_io.py") + ", " + L("src/secret_redact_io/exec_io.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 1}},
                   {"cases": {"label": "Choose a call", "items": [
                       {"label": "read_text_guarded", "blocks": [{"io": {"cmd": "read_text_guarded(\"sample.env\")  # OPENAI_API_KEY=sk-aaaa...a", "lines": ["text:      OPENAI_API_KEY=[REDACTED:openai_api_key]", "redactions: {'openai_api_key': 1}"], "verdict": ["redacted", "ok"]}}]},
                       {"label": "write_text_guarded, dry run", "blocks": [{"io": {"cmd": "write_text_guarded(target, \"api_key: ...\", dry_run=True)", "lines": ["text:     api_key: [REDACTED:credential_field]", "operation: write.dry_run", "written:  False", "file exists on disk: False"], "verdict": ["nothing written", "ok"]}}]},
                       {"label": "run_guarded", "blocks": [{"io": {"cmd": "run_guarded([\"python\", \"-c\", \"print('token=ghp_bbbb...b')\"])", "lines": ["returncode: 0", "stdout:     token=[REDACTED:github_token]", "redactions: {'github_token': 1}"], "verdict": ["redacted", "ok"]}}]}]}}]},
        {"title": "A receipt with no secret in it",
         "paras": ["The receipt for the subprocess call records the operation, the program name with its arguments dropped, the SHA-256 and length of the raw output and of the redacted output, and how many times each rule fired. The token itself appears nowhere.",
                   "One field, <code>metadata</code>, holds what the caller passed in, and nothing redacts it."],
         "src": L("src/secret_redact_io/receipts.py") + "; README.md, \"What a receipt records\"",
         "scene": [{"pipe": {"stages": FLOW, "active": 4}},
                   {"io": {"lines": ['operation        exec', 'target           python.exe', 'raw_bytes        49', 'input_sha256     18381d5e7ece4a8e...', 'redacted_bytes   32', 'redacted_sha256  cbed1b1d8c0b040b...',
                                     ["redactions       {'github_token': 1}", "hi"], 'metadata         {argv_count: 3, returncode: 0}']}}]},
        {"title": "What has no shape survives",
         "paras": ["The rules match shapes. A secret written as ordinary prose has none, so it passes through untouched and no rule fires. That is why the receipt reports which rules fired; it never claims the text is clean. Pick each input in the panel."],
         "src": "README.md, \"Boundary\"",
         "scene": [{"cases": {"label": "Choose an input", "items": [
             {"label": "a bearer header", "blocks": [{"io": {"cmd": 'redact_text("Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456")', "lines": ["Authorization: Bearer [REDACTED:bearer_token]", "{'bearer_token': 1}"], "verdict": ["redacted", "ok"]}}]},
             {"label": "a combination in words", "blocks": [{"io": {"cmd": 'redact_text("the vault combination is four four seven two")', "lines": ["the vault combination is four four seven two", "{}"], "verdict": ["unmatched", "unv", "no shape, no rule, no claim of clean"]}}]}]}}]},
    ],
    "try": [
        ("Install the pinned release from GitHub (Python 3.10 or newer); it is not on PyPI.",
         "$ python -m pip install \"secret-redact-io @ git+https://github.com/HarperZ9/secret-redact-io.git@v0.1.0\"\n$ secret-redact-io write out.txt --content \"note=hello\" --dry-run --json\n$ secret-redact-io exec --json -- python -c \"print('hello')\""),
    ],
    "try_src": "Output from examples/demo.py and the policy at e6503f0 on Windows with Python 3.12.",
    "limits": [
        "Seven patterns, matched by shape. A credential that reads as ordinary prose survives.",
        "The caller-supplied <code>metadata</code> field is stored as given and is not redacted.",
        "A redacted write stores the redacted text, so the original value is gone from that file by design.",
        "It is a guardrail for IO an agent performs. It does not scan a repository or rotate a leaked key.",
    ],
    "limits_src": "README.md at e6503f0, \"What a receipt records\" and \"Boundary\"",
    "recall": [
        ("What does a guarded dry-run write do on disk?", "Nothing. It returns the redacted text and a receipt, and the file is not created."),
        ("Which receipt field can still hold sensitive text?", "metadata, because it holds what the caller passed in and nothing redacts it."),
        ("Why does a combination written in words pass through?", "The rules match shapes, and plain prose has no shape to match."),
    ],
    "license_line": "Secret Redact IO is released under the MIT license.",
}
