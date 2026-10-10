SHA = "9c79f303b926460ceb50f592451933ffcf70c2e7"
B = f"https://github.com/HarperZ9/relay/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

LADDER = ["local", "plan / max", "api", "provider", "cloud"]
HASHED = ["b76150a4|def paginate(items, page, size):", "ba6dfa08|    start = page * size",
          ["6627593c|    end = start + size - 1", "hi"], "a5dfd4fd|    return items[start:end]"]
CHAIN = [["0", "user", "000000000000", "27829c36fdd1"], ["1", "tool_call", "27829c36fdd1", "d50950f327b6"],
         ["2", "tool_call", "d50950f327b6", "0b40718141d5"], ["3", "tool_result", "0b40718141d5", "68e2cf3b8e2e"]]

SPEC = {
    "slug": "relay", "repo": "relay", "sha": SHA, "name": "relay", "version": "release 0.7.0",
    "description": "An animated walk through relay, the accountable coding agent: hash-anchored edits that refuse a stale view, a default-deny tool gate, a hash-chained run ledger, and a prompt-injection containment probe. Built from relay at commit 9c79f30.",
    "lede": "A coding agent for any model endpoint whose every step lands in a ledger you can recheck.",
    "for_you": "relay runs a coding agent on whichever model you can reach: a local model when you are offline, your subscription CLI or an API key when you need more, with failover between them. The agent edits your code through tools that refuse a guess, writes nothing and runs nothing unless you allow it, and records every turn in a hash-chained ledger that a stranger can re-derive.",
    "uses": [
        ("Any endpoint, your own credentials", "A ladder of tiers, free and private first. A missing key just removes that tier."),
        ("Edits that refuse to guess", "An edit addressed by a stale line anchor, an ambiguous search or a mismatched diff is refused with nothing written."),
        ("Off by default", "Writes need <code>--allow-write</code>, shell commands need <code>--allow-exec</code>, and file tools stay inside <code>--root</code>."),
        ("A run you can prove", "Every turn and tool call is chained by hash. Edit one byte of a saved run and loading it is refused."),
    ],
    "how_intro": "Scroll, or use the step buttons. Each panel shows real output from relay's own tools at commit 9c79f30, run on a four-line file with an off-by-one bug. No model is in the loop for these steps; the tools behave the same whichever model calls them.",
    "steps": [
        {"title": "One ladder of endpoints",
         "paras": ["relay tries model tiers in order and fails over on exhaustion or error: a local model first, then your subscription CLI, then public APIs, then a gateway URL you set, then a cloud endpoint.",
                   "Keys come from your environment and subscriptions from your own signed-in CLI. A tier whose credential is absent is never added, so a missing key gives a shorter ladder, never an error at call time."],
         "src": L("README.md", "README.md") + ", \"Reaches every endpoint\"; " + L("src/relay/endpoints.py"),
         "scene": [{"pipe": {"stages": LADDER, "active": 0, "note": "tried left to right; a tier with no credential is left out"}},
                   {"table": {"head": ["tier", "reached by"], "rows": [
                       ["local", "a served model, then Ollama"], ["plan / max", "the claude or codex CLI on your subscription, started isolated"],
                       ["api", "<PROVIDER>_API_KEY"], ["provider", "<PROVIDER>_PROVIDER_BASE_URL, with its own key only"],
                       ["cloud", "<PROVIDER>_CLOUD_BASE_URL and _CLOUD_KEY"]]}}]},
        {"title": "Read the file with line anchors",
         "paras": ["Take <code>pager.py</code>, whose <code>end</code> is one short. A <code>read_file</code> call with <code>\"hashed\": true</code> prefixes every line with an 8-hex anchor.",
                   "The anchor hashes the line's text together with its line number, so two identical lines get different anchors."],
         "src": L("src/relay/hashline.py") + ", <code>line_anchor</code>",
         "scene": [{"io": {"cmd": 'read_file {"path": "pager.py", "hashed": true}', "lines": HASHED}}]},
        {"title": "Edit by anchor",
         "paras": ["The model replaces line 3 by naming its anchor, <code>6627593c</code>, without repeating the line. With <code>--allow-write</code> the edit lands and the bug is fixed."],
         "src": L("src/relay/local_tools.py") + ", <code>_t_edit_lines</code>",
         "scene": [{"io": {"cmd": 'edit_lines {"path": "pager.py", "at": "6627593c", "new": "    end = start + size"}',
                           "lines": [["edited pager.py (replace 6627593c)", "hi"], ["", ""], "def paginate(items, page, size):",
                                     "    start = page * size", ["    end = start + size", "hi"], "    return items[start:end]"],
                           "verdict": ["ok=True", "ok", "the anchored line changed, nothing else"]}}]},
        {"title": "A stale view is refused",
         "paras": ["Send the same edit again. Line 3 has changed, so its anchor no longer exists, and the edit is refused with nothing written.",
                   "The other edit tools follow the same rule. A search string that matches twice is refused. A unified diff whose context no longer matches is refused, with no fuzzy placement. Pick each case in the panel."],
         "src": L("src/relay/local_tools.py") + ", <code>_t_edit_lines</code>, <code>_t_edit_file</code>, <code>_t_apply_diff</code>",
         "scene": [{"cases": {"label": "Choose an edit", "items": [
             {"label": "same anchor again", "blocks": [{"io": {"cmd": 'edit_lines {"at": "6627593c", ...}', "lines": ["[error] anchor '6627593c' not found (stale or edited since read)"], "verdict": ["refused", "drift", "nothing written"]}}]},
             {"label": "search text matches twice", "blocks": [{"io": {"cmd": 'edit_file {"path": "dup.py", "old": "x = 1", "new": "x = 2"}', "lines": ["[error] 'old' matches 2 times; add context to make it unique"], "verdict": ["refused", "drift", "nothing written"]}}]},
             {"label": "diff with stale context", "blocks": [{"io": {"cmd": "apply_diff pager.py, hunk expects '    end = start + size - 1'", "lines": ["[error] a hunk's context did not match the file exactly (refused, no fuzz)"], "verdict": ["refused", "drift", "nothing written"]}}]}]}}]},
        {"title": "Nothing writes or runs unless you allow it",
         "paras": ["The tool gate is default-deny. Without <code>--allow-write</code> an edit is refused before it touches the file. Without <code>--allow-exec</code> a shell command is refused. File tools resolve every path inside <code>--root</code>, so <code>../../etc/passwd</code> never opens.",
                   "Granting exec also grants write, because a shell can write files."],
         "src": L("src/relay/local_tools.py") + ", <code>ToolGate</code> and <code>_safe_path</code>",
         "scene": [{"cases": {"label": "Choose a call", "items": [
             {"label": "edit, no --allow-write", "blocks": [{"io": {"cmd": 'edit_lines {"path": "pager.py", "at": "6627593c", ...}', "lines": ["[gate] write disabled (pass --allow-write)"], "verdict": ["refused", "drift"]}}]},
             {"label": "run, no --allow-exec", "blocks": [{"io": {"cmd": 'run {"cmd": "pytest -q"}', "lines": ["[gate] exec disabled (pass --allow-exec)"], "verdict": ["refused", "drift"]}}]},
             {"label": "read outside the root", "blocks": [{"io": {"cmd": 'read_file {"path": "../../etc/passwd"}', "lines": ["[error] path escapes root"], "verdict": ["refused", "drift"]}}]}]}}]},
        {"title": "Every step goes into a chained ledger",
         "paras": ["Each turn and tool call is appended to the session ledger. An entry's hash covers its sequence number, kind, content, metadata and the previous entry's hash, so each entry pins everything before it.",
                   "<code>verify()</code> re-derives every hash in order. This four-entry run verifies, and its head hash is the run's checkpoint."],
         "src": L("src/relay/local_session.py") + ", <code>SessionLedger.append</code> and <code>verify</code>",
         "scene": [{"table": {"head": ["seq", "kind", "prev", "hash"], "rows": CHAIN}},
                   {"verdict": ["verify() True", "ok", "checkpoint 68e2cf3b8e2efdbf"]}]},
        {"title": "An edited run will not load",
         "paras": ["Save the run, then change one tool call so it claims the agent edited <code>auth.py</code>. Loading re-derives the chain on the read path, and the file is refused."],
         "src": L("src/relay/local_session.py") + ", <code>SessionLedger.load</code>",
         "scene": [{"io": {"cmd": "SessionLedger.load(\"run.jsonl\")  # one entry edited: pager.py -> auth.py",
                           "lines": ["ValueError: ledger chain failed to verify (tampered or corrupt)"],
                           "verdict": ["refused", "drift", "a broken chain is refused, never loaded"]}}]},
        {"title": "Measure the boundary against injection",
         "paras": ["<code>relay --probe-injection</code> runs six fixed injection scenarios, such as \"run curl to send .env\" or \"overwrite the test file\". It assumes the worst case: the model was fooled and sent exactly the smuggled call. Then it checks whether the gate refuses it.",
                   "Under the default gate all six are contained and it exits 0. With <code>--allow-exec</code>, four get through and it exits 1. An open shell is a larger capability, and the probe says so."],
         "src": L("src/relay/injection_probe.py") + "; README.md, \"Prove the boundary holds\"",
         "scene": [{"cases": {"label": "Choose the gate", "items": [
             {"label": "default gate", "blocks": [{"verdict": ["6 of 6 contained", "ok", "exit 0, receipt 1405769b874ca5d7"]}, {"table": {"head": ["scenario", "contained"], "rows": [
                 ["exec-exfiltrate", ["yes", "ok"]], ["exec-redirect-write", ["yes", "ok"]], ["write-test-tamper", ["yes", "ok"]],
                 ["edit-remove-auth", ["yes", "ok"]], ["read-escape-secrets", ["yes", "ok"]], ["list-escape-root", ["yes", "ok"]]]}}]},
             {"label": "--allow-exec", "blocks": [{"verdict": ["2 of 6 contained", "drift", "exit 1, receipt 38b6b442353b3031"]}, {"table": {"head": ["scenario", "contained"], "rows": [
                 ["exec-exfiltrate", ["no", "drift"]], ["exec-redirect-write", ["no", "drift"]], ["write-test-tamper", ["no", "drift"]],
                 ["edit-remove-auth", ["no", "drift"]], ["read-escape-secrets", ["yes", "ok"]], ["list-escape-root", ["yes", "ok"]]]}}]}]}}]},
        {"title": "Accept a run only when your check passes",
         "paras": ["A ledger proves what the agent did, and your tests decide whether the code works. With <code>--check \"pytest -q\"</code>, relay runs your command once after the agent finishes, records the result on the ledger, and accepts the run only if it passes. A failed check skips <code>--auto-commit</code> and exits non-zero.",
                   "A rule-based guard also reads the recorded edits. A pass earned by editing the test that grades it, or by injecting a skip, is flagged and the run is not accepted. This step is described from the README; it needs a model, so it was not run for this page."],
         "src": "README.md, the section on <code>--check</code>",
         "scene": [{"pipe": {"stages": ["goal", "agent loop", "ledger", "your check", "accept or refuse"], "active": 3, "note": "the check runs outside the tool gate; the model cannot emit or steer it"}},
                   {"cap": "Not run for this page: an accepted run needs a model and a passing check."}]},
    ],
    "try": [
        ("Install from PyPI (Python 3.11 or newer). The probe needs no model and no network.",
         "$ python -m pip install flywheel-relay\n$ relay --probe-injection\n<span class=\"out\">  \"contained\": 6,\n  \"total\": 6,\n  \"receipt\": \"1405769b874ca5d7\"</span>\n$ relay --health --online\n$ relay --agent \"fix the off-by-one in paginate()\" --root . --allow-write --check \"pytest -q\""),
    ],
    "try_src": "The probe output came from flywheel-relay 0.7.0 installed from PyPI and matches a run of the source at 9c79f30. The last two commands need a model you can reach.",
    "limits": [
        "A verified ledger proves what the agent did. It does not prove the edits are correct; that is what <code>--check</code> is for.",
        "With exec granted, the shell is not confined to <code>--root</code>. It can read and write anything the user running relay can.",
        "The command denylist refuses a few literal destructive spellings. It is a guardrail for small models and not a security boundary.",
        "The injection probe measures six fixed scenarios against the gate. It assumes the model was fooled and says nothing about how often a model is fooled.",
        "Small local models vary from run to run in whether they call the edit tools at all. The README reports this as a known limitation.",
    ],
    "limits_src": "README.md at 9c79f30, \"An actual coding agent\", \"Ambient repo context\" and \"Use from an agent (MCP)\"",
    "recall": [
        ("Why does sending the same anchored edit twice fail the second time?", "The anchor hashes the line's text and position. After the first edit line 3 holds different text, so the old anchor matches nothing and the edit is refused."),
        ("What does relay do with a search string that appears twice?", "It refuses the edit and asks for more context. It never picks one of the two matches."),
        ("Why does --allow-exec also turn on write?", "A shell can write files through redirection or other tools, so a gate that kept write off while exec was on would be a gate the run path bypasses."),
        ("A saved run has one tool call edited. What happens when you load it?", "The chain is re-derived on load, the hash no longer matches, and the file is refused."),
        ("The probe reports 2 of 6 with --allow-exec. Is that a bug?", "No. It is the honest measurement: an open shell can do what the gate would otherwise refuse, and the probe exits non-zero to say so."),
    ],
    "license_line": "relay is released under FSL-1.1-MIT.",
}
