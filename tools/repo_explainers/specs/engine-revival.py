SHA = "e86d2171f8f525e0d10c3d8b4f0dadee48b36782"
B = f"https://github.com/HarperZ9/engine-revival/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

FLOW = ["lead", "sources", "rights", "record", "validate", "audit", "directory"]

SPEC = {
    "slug": "engine-revival", "repo": "engine-revival", "sha": SHA, "name": "engine-revival", "version": "version 0.2.0",
    "description": "An animated walk through engine-revival, tooling that triages lost game engines into evidence-backed revival records: 29 targets with a stated rights posture, a validator that rejects a renamed id or an unknown target, a public-clean audit that refuses restricted material marked publishable, a priority index, and a rung ladder where 28 of 29 targets claim only the first rung. Built from engine-revival at commit e86d217.",
    "lede": "Triage lost game engines into evidence-backed revival records.",
    "for_you": "Old game engines, SDKs and renderers disappear behind dead links and unclear rights. engine-revival keeps one JSON record per lead with its sources, its rights posture and what has been shown so far, and checks the whole archive before anything is published. A project someone still maintains is linked, not forked. A lead with unresolved rights stays a dossier. It publishes metadata and evidence only: no proprietary SDKs, leaked source or game assets.",
    "uses": [
        ("One record per lead", "382 JSON records across 12 kinds, each id matching its filename."),
        ("Rights before revival", "Every target states a posture: open, clean-room only, restricted, rights-holder needed and more."),
        ("A public-clean guard", "audit-public refuses restricted material marked publishable."),
        ("Claims by rung", "Each rung names the claim it earns and nothing above it."),
    ],
    "how_intro": "Scroll, or use the step buttons. Every line is output from the engine-revival CLI at commit e86d217, run in a scratch checkout. The refusals came from editing one record at a time in that checkout and putting it back.",
    "steps": [
        {"title": "A lead becomes a record",
         "paras": ["Each target is one JSON file whose id matches its filename. The BRender record names its platforms, a priority of 89, an open rights posture, and its revival lane: a critical edition backed by imported release evidence.",
                   "Across the archive, 85 sources are cited, 68 rated high confidence, 16 moderate and 1 low."],
         "src": L("targets/brender.json") + ", " + L("src/engine_revival/records.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 3}},
                   {"io": {"cmd": "targets/brender.json", "lines": ['"id": "brender"', '"name": "Argonaut BRender"', '"platforms": ["DOS", "Windows", "PlayStation", "OS/2"]', '"priority": 89', ['"rights_posture": "open"', "hi"], '"revival_lane": "critical-edition"']}}]},
        {"title": "Validate the whole archive",
         "paras": ["<code>validate</code> loads every record, checks it against its schema, and resolves every reference from one record to another. A clean archive prints nothing and exits 0. Pick an edit in the panel: renaming BRender's id breaks its filename match and orphans every record that points at it."],
         "src": L("src/engine_revival/validate.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 4}},
                   {"cases": {"label": "Choose the archive", "items": [
                       {"label": "as committed", "blocks": [{"io": {"cmd": "engine-revival validate", "lines": ["(no output)"], "verdict": ["exit 0", "ok"]}}]},
                       {"label": "brender id renamed", "blocks": [{"io": {"cmd": "engine-revival validate", "lines": ["targets\\brender.json: target id must match filename stem: brender-x != brender", "artifacts\\brender-v132-source.json: unknown target_id: brender", "tasks\\brender-triage.json: unknown target_id: brender", "..."], "verdict": ["exit 1", "drift"]}}]},
                       {"label": "artifact points nowhere", "blocks": [{"io": {"cmd": "engine-revival validate", "lines": ["artifacts\\alias-autodesk-acquisition-record.json: unknown target_id: no-such-engine"], "verdict": ["rejected", "drift"]}}]}]}}]},
        {"title": "Rights decide the posture",
         "paras": ["Before anything is rebuilt, each target states who holds the rights. Of 29 targets in 19 categories, 8 are open and 8 are public reference only. The rest are unresolved, need the rights holder, allow clean-room work only, or are restricted, and those stay dossiers."],
         "src": L("targets") + "; README.md, \"How a lead is triaged\"",
         "scene": [{"pipe": {"stages": FLOW, "active": 2}},
                   {"table": {"head": ["rights posture", "targets"], "rows": [["open", "8"], ["public-reference-only", "8"], ["unresolved", "6"], ["rights-holder-needed", "3"], ["clean-room-only", "2"], ["restricted", "2"]]}}]},
        {"title": "The public-clean guard",
         "paras": ["<code>audit-public</code> runs before publishing. It refuses an artifact marked do-not-redistribute or restricted whose access level is publishable, and flags wording such as leaked source. Pick a state in the panel: the LithTech Jupiter archive item is metadata only, and marking it public fails the audit."],
         "src": L("src/engine_revival/audit.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 5}},
                   {"cases": {"label": "Choose the artifact", "items": [
                       {"label": "metadata-only", "blocks": [{"io": {"cmd": "engine-revival audit-public", "lines": ["redistribution do-not-redistribute, access metadata-only", "(no output)"], "verdict": ["exit 0", "ok"]}}]},
                       {"label": "access set to public", "blocks": [{"io": {"cmd": "engine-revival audit-public", "lines": ["artifacts\\lithtech-jupiter-build51-archive-item.json: restricted material cannot be publishable"], "verdict": ["exit 1", "drift", "a release hold"]}}]}]}}]},
        {"title": "A priority index",
         "paras": ["<code>index</code> ranks the targets by priority with their rights, revival lane, and counts of artifacts, accessions, tasks and milestones. BRender leads at 89, followed by the PS1 Programmer's Tool at 84, which is clean-room only."],
         "src": L("src/engine_revival/indexer.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 6}},
                   {"table": {"head": ["priority", "target", "rights", "lane"], "rows": [["89", "Argonaut BRender", "open", "critical-edition"], ["84", "PS1 Programmer's Tool / Net Yaroze", "clean-room-only", "clean-room-api-compatible"], ["82", "RenderWare PS2", "restricted", "compatibility-reimplementation"], ["80", "GOOL and GOAL", "clean-room-only", "tooling-only-legal-copy-assets"], ["79", "LithTech Jupiter", "rights-holder-needed", "user-supplied-reproduction"]]}}]},
        {"title": "Claims by rung",
         "paras": ["The ladder has eight rungs, the first a dossier and the last a recovered title, and each names only the claim it earns. Twenty-eight of the 29 targets sit at the first rung. BRender carries evidence imported from the pinned BRender Archival v0.1.1 release: 21 of 21 CTest targets passing under Visual Studio Win32 Debug. That build was not rerun for this page.",
                   "Nothing here claims a remaster pass or a recovered title."],
         "src": L("docs/REMASTER-LANE.md") + ", " + L("docs/BRENDER-ARCHIVAL.md"),
         "scene": [{"pipe": {"stages": ["dossier", "source secured", "build ladder", "render parity", "asset pipeline", "game shell", "remaster pass", "lost-game recovery"], "active": 0}},
                   {"table": {"head": ["targets", "standing"], "rows": [["28", "first rung: dossier"], ["1 (BRender)", "imported 21-target release evidence"]]}},
                   {"verdict": ["133 tests pass", "ok", "pytest at e86d217"]}]},
    ],
    "try": [
        ("Python 3.11 or newer. The seed command writes only the repository's synthetic fixtures and fetches nothing.",
         "$ git clone https://github.com/HarperZ9/engine-revival && cd engine-revival\n$ python -m pip install -e \".[test]\"\n$ engine-revival validate\n$ engine-revival audit-public\n$ engine-revival index\n$ python -m pytest"),
    ],
    "try_src": "Output from the CLI at e86d217 with Python 3.12 on Windows; pytest reported 133 tests passing. Counts were read from the committed records.",
    "limits": [
        "The repository publishes metadata, schemas and evidence. It holds no proprietary SDKs, leaked source, game assets or upstream source snapshots.",
        "The BRender packet does not claim textured output, x64 readiness, production readiness, adoption or endorsement.",
        "The local portable materializer produces scaffold metadata; it is not the 21-target release, which lives in BRender Archival.",
        "A source's confidence rating is a judgment recorded with it. The validator checks structure and references, not historical truth.",
    ],
    "limits_src": "README.md at e86d217, \"Current Public Boundary\" and \"Non-Claims\"",
    "recall": [
        ("What happens to a lead whose rights are unresolved?", "It stays a dossier; nothing buildable is claimed."),
        ("Someone marks a do-not-redistribute artifact as public. Which command stops it?", "engine-revival audit-public, which reports restricted material cannot be publishable."),
        ("How many of the 29 targets claim more than the first rung?", "One, BRender, through imported evidence from a pinned external release."),
    ],
    "license_line": "engine-revival is released under FSL-1.1-MIT.",
}
