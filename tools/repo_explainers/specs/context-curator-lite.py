SHA = "1f8de376d3ff7d970d8d02f641c3d3306bedf570"
B = f"https://github.com/HarperZ9/context-curator-lite/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

FLOW = ["scan", "classify", "scrub", "bundle", "envelope"]
NOTES = ["# Plan notes", "todo: next action is to finish the migration and push the branch", "blocker: the integration test failed on the worktree",
         "architecture: design invariant for the curator whitepaper", "contact me at jane.doe@example.com or token=demo-secret-value",
         "just a plain chatter line with nothing useful to extract here"]

SPEC = {
    "slug": "context-curator-lite", "repo": "context-curator-lite", "sha": SHA, "name": "Context Curator Lite", "version": "version 0.2.0",
    "description": "An animated walk through Context Curator Lite: planning fragments pulled out of local notes and sessions, sorted into next actions, blockers and ideas, scrubbed of emails and secret shapes, and written as a small bundle and a Telos context envelope whose source refs let the next agent re-read the originals. Built from context-curator-lite at commit 1f8de37.",
    "lede": "Turn a messy workspace into a small context bundle the next agent can trust.",
    "for_you": "A model cannot read a large workspace every session. Context Curator Lite scans your local notes and session logs for the lines that matter, such as next actions, blockers and ideas, scrubs emails and secret-shaped values, and writes a compact bundle. Each item keeps a reference to its source file, and an optional envelope adds content hashes and a command to expand it, so the next agent can go back to the original and check it.",
    "uses": [
        ("Only the lines that matter", "Keyword rules keep planning fragments and drop chatter."),
        ("Scrubbed before it is written", "Emails and secret-shaped values are replaced, and raw transcripts are never copied."),
        ("Relative paths only", "Bundles name sources by relative path and hash the roots, with no absolute local paths."),
        ("Replayable by reference", "The Telos envelope gives each source a content hash and an expansion command."),
    ],
    "how_intro": "Scroll, or use the step buttons. The panel follows the two sample files in <code>examples/demo.py</code>: a notes file and a short session log. Every line is output from context-curator-lite at commit 1f8de37.",
    "steps": [
        {"title": "Two files from a working session",
         "paras": ["The notes file has a heading, a next action, a blocker, an architecture idea, a line with an email address and a token, and a line of chatter. The session log has a user turn asking to resume a handoff and an assistant turn with nothing in it."],
         "src": L("examples/demo.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 0}}, {"io": {"cmd": "notes.md", "lines": NOTES}},
                   {"io": {"cmd": "session.jsonl", "lines": ['{"role": "user", "text": "resume the handoff: continue the roadmap for the repo"}', '{"role": "assistant", "text": "no keywords on this line, pure chatter"}']}}]},
        {"title": "Classify by keyword",
         "paras": ["Each line is matched against keyword rules, checked in order. Blocker, blocked, error or failed makes a blocker. Todo, next, resume, continue or handoff makes a next action. Architecture, design, invariant, whitepaper, research or idea makes an idea. Lines that match no keyword are dropped.",
                   "Five lines matched a keyword before scrubbing; four survive as curated records."],
         "src": L("src/context_curator_lite/curator.py") + ", <code>classify</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 1}},
                   {"table": {"head": ["kind", "text", "source"], "rows": [["next-action", "resume the handoff: continue the roadmap for the repo", "session.jsonl"], ["next-action", "todo: next action is to finish the migration and push the branch", "notes.md"],
                                                                          ["blocker", "blocker: the integration test failed on the worktree", "notes.md"], ["idea", "architecture: design invariant for the curator whitepaper", "notes.md"]]}},
                   {"verdict": ["4 records", "ink", "from 5 keyword matches in 2 files"]}]},
        {"title": "Scrub what should not travel",
         "paras": ["<code>scrub</code> replaces email addresses and secret-shaped values. A line holding an email and a GitHub-shaped token comes back as placeholders. The line in the notes with an email and a token does not reach the bundle."],
         "src": L("src/context_curator_lite/curator.py") + ", <code>scrub</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 2}},
                   {"io": {"cmd": 'scrub("reach me at jane@example.com token=ghp_AAAA...A")', "lines": [["reach me at <email> <redacted-secret>", "hi"]]}}]},
        {"title": "A small bundle, with its own checks",
         "paras": ["The run writes four files: a Markdown summary, a JSONL bundle, a manifest and the envelope. The manifest states that no absolute paths were included and no raw transcripts were copied, and gives the counts by kind."],
         "src": L("src/context_curator_lite/curator.py") + ", <code>main</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 3}},
                   {"io": {"cmd": "context-curator-lite --root ./proj --out-dir ./artifacts --telos-envelope", "lines": ['"source_files_scanned": 2', '"raw_keyword_matches": 5', '"curated_records": 4',
                                                                                                                       '"counts": {"next-action": 2, "blocker": 1, "idea": 1}', ['"absolute_paths_included": false', "hi"], ['"raw_transcripts_copied": false', "hi"]]}}]},
        {"title": "An envelope that points back to the source",
         "paras": ["The Telos envelope lists each source with its SHA-256 and an expansion command, and ties every claim to the source it came from. The next agent can re-read <code>notes.md</code> and check its hash; it does not have to trust the summary.",
                   "Its quality gates say what was checked: readability, freshness and privacy read MATCH, and test evidence reads UNVERIFIABLE, because nothing in the notes was a test result."],
         "src": L("src/context_curator_lite/telos_envelope.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 4}},
                   {"io": {"lines": ['src_001  session.jsonl  sha256:82a869b7f1f44413...  gather docs session.jsonl --json', 'src_002  notes.md       sha256:b09fdd889cf3d0a0...  gather docs notes.md --json',
                                     'claims   4, each with source_ref_ids', ['quality_gates  readability MATCH, freshness MATCH, privacy MATCH, test_evidence UNVERIFIABLE', "hi"], 'compression    heuristic_keyword_extract_with_hash_refs, lossless_by_ref true']}}]},
    ],
    "try": [
        ("Install from a checkout (Python 3.10 or newer), or install the v0.2.0 wheel from GitHub Releases after checking its SHA-256 as the README shows.",
         "$ git clone https://github.com/HarperZ9/context-curator-lite.git && cd context-curator-lite\n$ python -m pip install -e \".[test]\"\n$ python examples/demo.py\n$ context-curator-lite --root . --out-dir ./artifacts --telos-envelope"),
    ],
    "try_src": "Output from context-curator-lite at 1f8de37 on Windows with Python 3.12.",
    "limits": [
        "Classification is by keyword. A line that matters but uses none of the keywords is dropped.",
        "Redaction is heuristic. The bundle still needs a person to review it before it is shared.",
        "It is not a security boundary. It helps prepare bounded context and replaces no review.",
        "The short source hash in the bundle identifies the file by its relative path; the envelope carries the content hash.",
    ],
    "limits_src": "README.md at 1f8de37, \"Current status\" and \"Existing technical notes\"; src/context_curator_lite/curator.py",
    "recall": [
        ("Why does the chatter line not reach the bundle?", "It contains no keyword, so classification drops it."),
        ("How does the next agent check that a claim came from notes.md?", "The envelope gives the file's SHA-256 and a command to re-read it, and each claim names its source ref."),
        ("Why does test evidence read UNVERIFIABLE?", "Nothing in the curated sources was a test result, so it could not be checked."),
    ],
    "license_line": "Context Curator Lite is released under the MIT license.",
}
