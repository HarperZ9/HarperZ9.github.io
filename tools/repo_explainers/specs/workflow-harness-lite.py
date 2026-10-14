SHA = "5886706509af45dcbee53489ea283ec8e5b40bf1"
B = f"https://github.com/HarperZ9/workflow-harness-lite/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

FLOW = ["config", "run in parallel", "time out", "redact", "report", "receipt"]
CFG = ['{ "name": "local-checks", "tasks": [', '  {"name": "node-version", "command": "node --version"},', '  {"name": "lint", "command": "node -e \\"console.log(\'lint ok\')\\""},',
       '  {"name": "flaky", "command": "...prints a token= line to stderr, exits 2"},', '  {"name": "hang", "command": "node -e \\"setTimeout(()=>{}, 60000)\\""}', ']}']

SPEC = {
    "slug": "workflow-harness-lite", "repo": "workflow-harness-lite", "sha": SHA, "name": "Workflow Harness Lite", "version": "version 0.2.0",
    "description": "An animated walk through Workflow Harness Lite: four local commands run in parallel from a JSON config, a hung task stopped by its timeout, a secret redacted from an output preview, and a bounded-run receipt that holds hashes of commands and output and none of the text. Built from workflow-harness-lite at commit 5886706.",
    "lede": "Run local command workflows in parallel, always terminate, and keep a compact receipt.",
    "for_you": "Release checks and agent workflows need a local runner that finishes predictably and leaves a short report. Workflow Harness Lite reads a JSON list of named commands, runs them in parallel, stops any that run past a timeout, redacts secret-shaped text from the output previews, and exits non-zero if anything failed. It can also write a receipt that records hashes of each command and its output, with no raw text in it.",
    "uses": [
        ("Parallel by default", "Independent tasks run at once; <code>--no-parallel</code> runs them in order."),
        ("Guaranteed to end", "Every task has a timeout, so a hung command cannot hold the run open."),
        ("Redacted previews", "Output previews are capped in length and secret-shaped values are replaced."),
        ("A receipt without the text", "Commands and output appear as SHA-256 hashes, and the privacy fields say so."),
    ],
    "how_intro": "Scroll, or use the step buttons. The panel runs a four-task config written for this page: two commands that pass, one that prints a token-shaped line and fails, and one that hangs. Every line is output from workflow-harness-lite at commit 5886706 under Node 25.",
    "steps": [
        {"title": "A config of named commands",
         "paras": ["A workflow is a name and a list of tasks, each a name and a command. This one checks the Node version, runs a stand-in lint, runs a flaky step that prints a token to stderr and exits 2, and runs a step that waits a minute."],
         "src": "README.md, \"Usage\"",
         "scene": [{"pipe": {"stages": FLOW, "active": 0}}, {"io": {"cmd": "wf.json", "lines": CFG}}]},
        {"title": "Run them, all at once",
         "paras": ["The harness starts the four tasks in parallel and prints one line per task. Two pass and two fail, and the run exits 1."],
         "src": L("src/workflow_harness_lite.js") + ", <code>runWorkflow</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 1}},
                   {"io": {"cmd": "workflow-harness-lite --config wf.json", "lines": ["workflow=local-checks status=fail passed=2 failed=2", "PASS node-version", "PASS lint", ["FAIL flaky", "hi"], ["FAIL hang", "hi"]], "verdict": ["fail", "drift", "exit 1"]}}]},
        {"title": "A hung task is stopped",
         "paras": ["The hang task would wait 60 seconds. Every task has a timeout: 15 seconds by default, and here <code>--timeout 2000</code> sets 2. The task is killed at about 2,018 ms and recorded as a failure, so the run ends.",
                   "The receipt records the bound it ran under: guaranteed termination, the per-task timeout and a maximum of four iterations for four tasks."],
         "src": L("src/workflow_harness_lite.js") + ", <code>runTask</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 2}},
                   {"io": {"cmd": "workflow-harness-lite --config wf.json --json --timeout 2000", "lines": ['hang  fail  code 1  durationMs 2018', 'stderr: Command failed: node -e "setTimeout(()=>{}, 60000)"']}},
                   {"io": {"lines": ['"bounds": {"guaranteed_termination": true, "max_iterations": 4, "parallel": true, "per_task_timeout_ms": 15000, "output_limit_chars": 4000}']}}]},
        {"title": "Secrets out of the preview",
         "paras": ["The flaky task printed a <code>token=</code> line. The JSON report keeps a short preview of each task's output, and the preview shows the token replaced. Previews are capped at 4,000 characters by default."],
         "src": L("src/workflow_harness_lite.js") + ", <code>sanitizeOutput</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 3}},
                   {"io": {"cmd": "workflow-harness-lite --config wf.json --json", "lines": ['flaky  fail  code 2', ["stderr: token=<redacted-secret>", "hi"]]}}]},
        {"title": "A receipt with no commands and no output",
         "paras": ["<code>--telos-receipt</code> writes a bounded-run receipt. Each task appears by name, index, command hash, status, exit code, duration and output hashes. The privacy fields state that no raw command, raw output or absolute working directory is included, and the receipt carries its own hash."],
         "src": L("src/telos_receipt.js") + ", <code>buildTelosReceipt</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 5}},
                   {"io": {"cmd": "workflow-harness-lite --config wf.json --telos-receipt receipt.json", "lines": ['schema           project-telos.bounded-run-receipt/v1', 'terminal_status  error', 'counts           total 4, passed 2, failed 2',
                                                                                                      'flaky            command_hash sha256:8b0faa47b894b99e...  status fail  code 2', '                 stderr_hash  sha256:5e7b8623d7048b91...  raw_output_included false',
                                                                                                      ['privacy          raw_commands_included false, raw_output_included false, absolute_cwd_included false', "hi"], 'receipt_hash     sha256:2ca9c5963543c0cc...']}}]},
    ],
    "try": [
        ("Clone and run (Node 18 or newer, no dependencies).",
         "$ git clone https://github.com/HarperZ9/workflow-harness-lite && cd workflow-harness-lite\n$ npm test\n$ node examples/demo.mjs\n<span class=\"out\">runWorkflow -> status=pass total=2 passed=2 failed=0 skipped=0\nbuildTelosReceipt -> project-telos.bounded-run-receipt/v1 ok</span>\n$ node bin/workflow-harness-lite.js --config workflow.json --telos-receipt receipt.json"),
    ],
    "try_src": "Output from workflow-harness-lite at 5886706 on Windows with Node 25. Hashes in a receipt depend on the commands and their output, so yours will differ.",
    "limits": [
        "It runs local commands only. It is not a CI system and does not sandbox what the commands do.",
        "Redaction of previews is by shape. Output that holds a secret in another form is not caught.",
        "The timeout is one value for the whole run, set with <code>--timeout</code>. A task cannot carry its own.",
        "Every task's side-effect class is recorded as unknown. The harness does not inspect what a command changes.",
    ],
    "limits_src": "README.md at 5886706, \"Current status\" and \"Report\"; the receipt written for this page",
    "recall": [
        ("What stops the hang task?", "The per-task timeout. The task is killed and recorded as a failure, so the run ends."),
        ("What does the JSON report show for the flaky task's stderr?", "token=<redacted-secret>: the preview is redacted."),
        ("What does the receipt keep about each command?", "Its hash, status, exit code, duration and output hashes, with no raw command or output."),
    ],
    "license_line": "Workflow Harness Lite is released under the MIT license.",
}
