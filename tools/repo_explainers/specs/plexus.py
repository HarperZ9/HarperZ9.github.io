SHA = "d889be902e1e293b089266461cffcbe885a401a0"
B = f"https://github.com/HarperZ9/plexus/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

FLOW = ["manifests", "discover", "wire", "plan", "receipt", "verify"]

SPEC = {
    "slug": "plexus", "repo": "plexus", "sha": SHA, "name": "plexus", "version": "release 0.4.0",
    "description": "An animated walk through plexus: tools declare what they emit and consume, plexus wires producer to consumer, names unmet inputs and loops, plans the pipeline that feeds a goal, and pins it to the manifests with a receipt that fails when a manifest changes. Built from plexus at commit d889be9.",
    "lede": "Find what each tool emits and consumes, and wire them together.",
    "for_you": "MCP tells an agent which tools exist. plexus tells it how their outputs plug into each other's inputs. Each tool ships a small manifest; plexus builds the wiring graph, plans the pipeline that feeds the tool you want, and reports what does not connect. A plan carries a receipt tied to the exact manifests it came from, so a changed tool shows up as drift.",
    "uses": [
        ("Wiring from declarations", "An edge A to B forms when B consumes a capability A emits. Each edge cites the producer's own source pointer."),
        ("Honest gaps", "Inputs nothing emits, outputs nothing consumes, feedback loops and duplicate tool ids are all named."),
        ("Plans for a goal", "<code>plexus plan --goal</code> orders the tools that feed one target and names its sources."),
        ("Plans you can re-check", "<code>plexus verify</code> re-derives a plan's receipt from the current manifests and exits 1 on drift."),
    ],
    "how_intro": "Scroll, or use the step buttons. The first steps use two small manifests written for this page, <code>notes</code> and <code>review</code>. The last uses the ten built-in manifests that ship with plexus. Every line is output from plexus at commit d889be9.",
    "steps": [
        {"title": "Two tools declare their ports",
         "paras": ["<code>notes</code> emits <code>notes.summary/1</code>. <code>review</code> consumes <code>notes.summary/1</code> and a <code>style.guide/1</code>, and emits <code>review.verdict/1</code>. Each port names the module behind it, such as <code>src/notes/summary.py:build</code>.",
                   "A manifest is plain JSON. A tool ships one and it joins the mesh."],
         "src": "README.md, \"How a tool plugs in\"; " + L("src/plexus/manifest.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 0}},
                   {"table": {"head": ["tool", "emits", "consumes"], "rows": [["notes", "notes.summary/1", "nothing"], ["review", "review.verdict/1", "notes.summary/1, style.guide/1"]]}}]},
        {"title": "Discover the edge",
         "paras": ["<code>plexus discover</code> matches capability strings. <code>review</code> consumes what <code>notes</code> emits, so one edge forms: notes to review via <code>notes.summary/1</code>.",
                   "The edge is tagged <code>evidence: declared</code>. plexus copies the producer's module pointer into <code>via</code> but never imports or runs it. The citation is a claim for you to check."],
         "src": L("src/plexus/mesh.py") + "; README.md, \"Declared, not probed\"",
         "scene": [{"pipe": {"stages": FLOW, "active": 2}},
                   {"io": {"cmd": "plexus discover --dir m", "lines": ['producer    notes', 'consumer    review', ['capability  notes.summary/1', "hi"], 'self_loop   false', 'via         src/notes/summary.py:build', ['evidence    declared', "hi"]]}}]},
        {"title": "Name what does not connect",
         "paras": ["Nothing in the set emits <code>style.guide/1</code>, so it is an unmet input: an external or human input, or a tool that is not here. Nothing consumes <code>review.verdict/1</code>, so it is a terminal output.",
                   "Both come from the same comparison. An unmet input means only that no manifest in this set produces it."],
         "src": L("src/plexus/mesh.py") + ", <code>orphans</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 2}},
                   {"io": {"lines": ["unmet_inputs        [\"style.guide/1\"]", "unconsumed_outputs  [\"review.verdict/1\"]", "collisions          []"],
                           "verdict": ["1 unmet input", "unv", "reported, never filled in"]}}]},
        {"title": "Plan the pipeline, with a receipt",
         "paras": ["<code>plexus plan --goal review</code> orders the tools that feed review: notes, then review. Its receipt records the SHA-256 of each manifest and a hash over the derived plan, under a method version."],
         "src": L("src/plexus/plan.py") + ", " + L("src/plexus/receipt.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 4}},
                   {"io": {"cmd": "plexus plan --dir m --goal review", "lines": ['order    notes -> review', 'sources  notes', 'cyclic   []',
                                                                            'receipt  plexus.plan-receipt/1, method plexus-plan/1', '  notes   53ab6c24d374afa4...', '  review  0d50accb0759561e...', ['  plan_sha256  aeb01289ea823d89...', "hi"]]}}]},
        {"title": "Verify against the manifests you have now",
         "paras": ["<code>plexus verify</code> re-derives the plan from the current manifests and rebuilds its receipt. Unchanged, it matches and exits 0.",
                   "Now change <code>notes</code> to emit <code>notes.summary/2</code>. The manifest hash changes, the wiring changes, and verify exits 1. Pick each case in the panel."],
         "src": L("src/plexus/receipt.py") + ", <code>verify_plan</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 5}},
                   {"cases": {"label": "Choose the manifests", "items": [
                       {"label": "unchanged", "blocks": [{"io": {"cmd": "plexus verify --plan plan.json --dir m", "lines": ['"verified": true'], "verdict": ["exit 0", "ok", "the receipt re-derives"]}}]},
                       {"label": "notes now emits notes.summary/2", "blocks": [{"io": {"cmd": "plexus verify --plan plan.json --dir m", "lines": ['"verified": false'], "verdict": ["exit 1", "drift", "the manifest moved under the plan"]}}]}]}}]},
        {"title": "The built-in mesh",
         "paras": ["plexus ships manifests for ten tools. Its tour wires them: gather feeds crucible through <code>gather.digest/1</code>, mneme and crucible feed each other replay packs, and the plan for crucible reports its feedback loop as a loop."],
         "src": L("examples/tour.py") + "; " + L("src/plexus/registry.py"),
         "scene": [{"io": {"cmd": "python examples/tour.py", "lines": ["== plan: feed crucible ==", "  order: forum -> gather -> crucible -> index -> learn -> mneme -> telos", "  sources: forum, gather",
                                                                       ["  feedback loop: crucible <-> index <-> learn <-> mneme <-> telos", "hi"], "== route: gather -> crucible ==", "  [gather->crucible via gather.digest/1]"]}}]},
    ],
    "try": [
        ("Install from PyPI (Python 3.11 or newer). Discovery reads manifests and runs no tool.",
         "$ python -m pip install plexus-mesh\n$ plexus route --from gather --to crucible --builtin\n<span class=\"out\">  \"connected\": true,\n  \"hops\": 1,</span>\n$ plexus plan --goal crucible --builtin &gt; plan.json\n$ plexus verify --plan plan.json --builtin"),
    ],
    "try_src": "Output from plexus at d889be9 run from source; plexus-mesh 0.4.0 is the current PyPI release.",
    "limits": [
        "Edges come from declarations. Discovery never runs a tool, so an edge says two manifests agree. Whether the tools work together is a separate test. <code>probe_lane</code> checks that a lane's server is live.",
        "An unmet input means no manifest in the set you gave produces it. plexus reasons about nothing outside that set.",
        "<code>verify</code> checks a saved plan's receipt against one re-derived from the current manifests. Act on the re-derived plan it reports, not on a saved file you have not re-derived.",
        "The built-in manifests are kept in plexus. Their presence does not show that each tool publishes its own manifest.",
    ],
    "limits_src": "README.md at d889be9, \"Declared, not probed\" and \"How a tool plugs in\"; src/plexus/receipt.py",
    "recall": [
        ("When does an edge from A to B form?", "When B consumes a capability that A emits, directly or through A's consumable_as list."),
        ("What does evidence: declared mean on an edge?", "The edge comes from what the manifests say. plexus copied the producer's module pointer but did not follow or run it."),
        ("style.guide/1 shows up as an unmet input. Does that mean no such tool exists?", "No. It means no manifest in the set plexus was given emits it."),
        ("A tool's manifest changes after you saved a plan. What does verify do?", "It re-derives the receipt from the current manifests, the hashes no longer agree, and it exits 1."),
    ],
    "license_line": "plexus is released under FSL-1.1-MIT.",
}
