SHA = "51eccfb21bf01975d7159feeb35d98a3649d8019"
B = f"https://github.com/HarperZ9/public-surface-sweeper/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

FLOW = ["repo", "required files", "README delivery", "text hygiene", "secret shapes", "score", "packet"]

SPEC = {
    "slug": "public-surface-sweeper", "repo": "public-surface-sweeper", "sha": SHA, "name": "Public Surface Sweeper", "version": "version 0.1.3",
    "description": "An animated walk through Public Surface Sweeper: a repository's public surface checked for required files, delivery material, text hygiene and secret-shaped values, scored, and turned into action items and a proof-surface packet. Built from public-surface-sweeper at commit 51eccfb.",
    "lede": "Check a repository's public surface before it asks anyone to trust it.",
    "for_you": "Small public repositories fail on simple things: a missing license, a README that does not say what the tool does, a credential-shaped string left in a note. Public Surface Sweeper checks those quickly and the same way every time, scores the repository, lists what to fix, and can scan every GitHub-facing repository in a workspace at once.",
    "uses": [
        ("Required files", "A license, a README, a changelog and the other files a visitor expects."),
        ("Secret shapes", "Values shaped like cloud keys and tokens are reported with the file and line."),
        ("A score and a status", "Errors block, warnings are counted, and the run exits 1 on errors by default."),
        ("A workspace matrix", "<code>--workspace</code> sweeps every repository with a GitHub remote, with no network calls and no writes."),
    ],
    "how_intro": "Scroll, or use the step buttons. The panel uses the bundled <code>examples/clean-repo</code> and a copy of it with two problems added. Every line is output from public-surface-sweeper at commit 51eccfb.",
    "steps": [
        {"title": "A clean repository",
         "paras": ["The bundled fixture has the files a public repository should carry: a license, a README, a usage guide, a changelog, contributing notes, an authors file, agent instructions and a CI folder. The sweep finds nothing, scores 100 and reports ready."],
         "src": L("examples/clean-repo") + "; README.md, \"Try it\"",
         "scene": [{"pipe": {"stages": FLOW, "active": 5}},
                   {"io": {"cmd": "public-surface-sweeper examples/clean-repo --summary", "lines": ["score: 100", "status: ready", "total_findings: 0", "errors: 0", "warnings: 0", "action_items:", "- none"], "verdict": ["ready", "ok", "exit 0"]}}]},
        {"title": "Break it twice",
         "paras": ["Copy the fixture, delete its LICENSE, and add a note holding a value shaped like an AWS access key: AKIA followed by sixteen capitals. Sweep again. Both are errors, each with where it is."],
         "src": L("src/public_surface_sweeper/sweeper.py") + ", " + L("src/public_surface_sweeper/text_hygiene.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 4}},
                   {"io": {"cmd": "public-surface-sweeper ./repo", "lines": [["ERROR LICENSE required-file: missing required file: LICENSE", "hi"], ["ERROR notes.txt:1 aws-access-key: AWS access key shaped value", "hi"]], "verdict": ["blocked", "drift", "exit 1"]}}]},
        {"title": "A score and a list of fixes",
         "paras": ["<code>--summary</code> turns the findings into a score, a status and one action item per finding. Two errors take the score to 50 and the status to blocked."],
         "src": L("src/public_surface_sweeper/summary.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 5}},
                   {"io": {"cmd": "public-surface-sweeper ./repo --summary", "lines": ["score: 50", "status: blocked", "total_findings: 2", "errors: 2", "warnings: 0", "action_items:", "- LICENSE: missing required file: LICENSE", "- notes.txt:1: AWS access key shaped value"]}}]},
        {"title": "Evidence for the next tool",
         "paras": ["<code>--proof-packet</code> writes a proof-surface packet. Its claims carry the counts behind each check: one required-file finding, one secret-shaped finding, no em-dash findings, no delivery findings. The check reads fail at score 50."],
         "src": L("src/public_surface_sweeper/cli.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 6}},
                   {"io": {"cmd": "public-surface-sweeper ./repo --proof-packet", "lines": ['"surface": "repo public release surface"', '"status": "blocked"', 'Required public release files are visible.   required-file findings=1',
                                                                                   'Secret-shaped values are surfaced before publication.   secret-shaped findings=1', 'Public text hygiene is checkable.   em-dash findings=0',
                                                                                   'Public and developer delivery are inspectable.   delivery findings=0', ['check: public-surface-sweeper  fail  score=50, findings=2', "hi"]]}}]},
        {"title": "Choose what fails the run",
         "paras": ["By default the run exits 1 on errors. <code>--fail-on warning</code> fails on warnings too, and <code>--fail-on none</code> prints findings and always exits 0. In workspace mode, a discovery that finds no repositories also fails, so an empty matrix never passes as a clean one."],
         "src": "README.md, \"Usage\"",
         "scene": [{"table": {"head": ["flag", "exits 1 when"], "rows": [["(default)", "any error"], ["--fail-on warning", "any warning or error"], ["--fail-on none", "never"], ["--workspace", "any error, or discovery is empty or unverifiable"]]}}]},
    ],
    "try": [
        ("Install the reviewed wheel from a GitHub Release, or from a checkout (Python 3.10 or newer).",
         "$ git clone https://github.com/HarperZ9/public-surface-sweeper && cd public-surface-sweeper\n$ python -m pip install -e \".[test]\"\n$ public-surface-sweeper examples/clean-repo\n<span class=\"out\">No findings.</span>\n$ public-surface-sweeper . --summary"),
    ],
    "try_src": "Output from public-surface-sweeper at 51eccfb on Windows with Python 3.12. The broken copy deletes LICENSE and adds one note.",
    "limits": [
        "It is a release-hygiene gate. It is not a full security scanner or a certification.",
        "Secret detection is by shape. A credential that does not look like one is not found.",
        "Workspace mode reads local Git metadata only and makes no network call.",
    ],
    "limits_src": "README.md at 51eccfb, \"Current status\" and \"Usage\"",
    "recall": [
        ("What two findings did the broken copy get?", "A missing LICENSE and an AWS-access-key-shaped value in notes.txt, line 1."),
        ("What score and status follow from two errors?", "50 and blocked."),
        ("Why does an empty workspace discovery fail?", "So a matrix of zero repositories never passes as a clean portfolio."),
    ],
    "license_line": "Public Surface Sweeper is released under the MIT license.",
}
