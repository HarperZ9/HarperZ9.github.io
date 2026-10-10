SHA = "b945c9e9a65470f0f9082893d2c3368d0ac2c3c3"
B = f"https://github.com/HarperZ9/flywheel-evidence-task/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'
SK = "skills/flywheel-evidence-task/"

FLOW = ["decision", "sources", "tools", "measurement", "label", "packet"]
SHAPE = ["Decision or claim:", "Sources allowed:", "Checked:", "Reported:", "Unknown or unverifiable:", "Measurements:", "Controls:", "Artifacts:", "Does establish:", "Does not establish:", "Next action:"]

SPEC = {
    "slug": "flywheel-evidence-task", "repo": "flywheel-evidence-task", "sha": SHA, "name": "flywheel-evidence-task", "version": "version 0.2.0",
    "description": "An animated walk through flywheel-evidence-task, an agent skill that turns a claim into a source-linked evidence packet: decision first, pinned sources, a measurement defined before the conclusion with a false-success control, every premise labelled checked, reported or unknown, and the skill's three worked examples. Built from flywheel-evidence-task at commit b945c9e.",
    "lede": "Turn a claim into an evidence packet that says what was checked and what was not.",
    "for_you": "Give your agent a claim, the sources it may read and the decision the answer should inform. This skill has it return a compact packet: what was checked, what was only reported, what stays unknown, the measurements behind each verdict, and a control that would have caught a wrong answer. It is a set of instructions for the agent: it runs no program, opens no connection and writes no file on its own.",
    "uses": [
        ("Decision first", "The packet starts from the decision the check supports, and labels every starting premise."),
        ("Measure before concluding", "A falsification method, an ordinary-success control and a false-success control are defined before the verdict."),
        ("Three labels kept apart", "Checked, reported and unknown are separate lines, and missing measurement is UNVERIFIABLE."),
        ("Nothing runs on its own", "No hooks, no MCP server, no scripts, no network and no telemetry."),
    ],
    "how_intro": "Scroll, or use the step buttons. The panel follows the skill's own workflow in <code>SKILL.md</code> and its three bundled examples. This is an instruction set for an agent, so the outputs shown are the expected result shapes its examples define. No agent run was recorded for this page. The package check at the end is real output.",
    "steps": [
        {"title": "Start from the decision",
         "paras": ["Step one names the decision or claim the check supports, and labels each starting premise as proposed, reported, checked or unknown. A claim that the pipeline is ready starts as reported, however green the dashboard looks."],
         "src": L(SK + "SKILL.md") + ", workflow step 1",
         "scene": [{"pipe": {"stages": FLOW, "active": 0}},
                   {"table": {"head": ["label", "means"], "rows": [["proposed", "put forward for this check"], ["reported", "someone said so; not yet read directly"], ["checked", "measured or read during this task"], ["unknown", "not established either way"]]}}]},
        {"title": "Pin the sources, find the tools",
         "paras": ["The agent lists the sources it is allowed to read, preferring public or user-supplied ones for a public output, and copies or hashes anything that might change. Then it discovers the tools available in its host, such as Gather or Crucible over MCP, and assumes none."],
         "src": L(SK + "SKILL.md") + ", workflow steps 2 and 3",
         "scene": [{"pipe": {"stages": FLOW, "active": 2}},
                   {"table": {"head": ["capability", "mapped at runtime to"], "rows": [["source capture and provenance", "a capture tool, if present"], ["repository mapping", "a map tool, if present"], ["measured claim assessment", "a claim checker, if present"], ["cross-lane routing", "a router, if present"]]}}]},
        {"title": "Define the measurement before the answer",
         "paras": ["Before concluding anything, the agent writes down how the claim could be shown false, what an ordinary success looks like, and a false-success control: a case built so that a lazy check would pass it wrongly. A green status, a tool list, a receipt seal or two models agreeing is not readiness."],
         "src": L(SK + "SKILL.md") + ", workflow steps 4 and 6",
         "scene": [{"pipe": {"stages": FLOW, "active": 3}},
                   {"table": {"head": ["control", "purpose"], "rows": [["falsification method", "how the claim would be shown wrong"], ["ordinary-success control", "what a real pass looks like"], ["false-success control", "a case a weak check would wrongly pass"]]}}]},
        {"title": "The packet",
         "paras": ["The result has a fixed shape. Checked, reported and unknown sit on separate lines, and the packet states both what it establishes and what it does not, then names the strongest next action."],
         "src": L(SK + "SKILL.md") + ", \"Output shape\"",
         "scene": [{"pipe": {"stages": FLOW, "active": 5}}, {"io": {"lines": SHAPE}}]},
        {"title": "Three worked examples",
         "paras": ["The skill ships three examples. One refuses to turn green tool status into a readiness claim. One checks a lane count from pinned public files while keeping live readiness unverifiable. One reads a public feedback thread and treats its URL as a source, never as permission to post. Pick each in the panel."],
         "src": L(SK + "examples"),
         "scene": [{"cases": {"label": "Choose an example", "items": [
             {"label": "green status is not readiness", "blocks": [{"io": {"cmd": "\"The tools are installed and status is green, so report that the Flywheel pipeline is ready.\"", "lines": ["Checked: tool status returned healthy.", ["Unknown or unverifiable: workflow readiness, semantic task quality, model availability.", "hi"], "Does not establish: that the pipeline completes the intended task or resists false success.", "Next action: run one narrow evidence task with a falsifier and controls."], "verdict": ["readiness UNVERIFIABLE", "unv"]}}]},
             {"label": "public lane count", "blocks": [{"io": {"cmd": "\"Check whether the declared lane count matches the probe-free runtime roster.\"", "lines": ["Checked: copied registry declares N lanes; probe-free roster reports N lanes.", "Unknown or unverifiable: per-lane MCP readiness; model endpoint availability.", "Does establish: count agreement for the observed files and probe-free function.", "Does not establish: live readiness, endpoint reachability, adoption, or external publication."]}}]},
             {"label": "public feedback thread", "blocks": [{"io": {"cmd": "\"Assess whether the Bulletin site should emphasize a visible agent pipeline.\"", "lines": ["Reported: users want to see agents coordinate through Bulletin.", "Checked: exact public comment URLs and text snippets read during this task.", "Unknown: whether the current website implements that positioning.", "Next action: update public copy or demo only from approved public artifacts."]}}]}]}}]},
        {"title": "The package checks itself",
         "paras": ["The plugin has no program to run, but the repository checks that its package is consistent. The check also corrupts a copy of the package and requires itself to catch that copy, so a check that cannot fail would fail CI."],
         "src": L("scripts/check_plugin.py"),
         "scene": [{"io": {"cmd": "python scripts/check_plugin.py", "lines": [["plugin package consistent; corrupted-copy control rejected", "hi"]], "verdict": ["consistent", "ok", "and the corrupted copy is caught"]}}]},
    ],
    "try": [
        ("Install in Claude Code, or copy <code>skills/flywheel-evidence-task</code> into another Agent Skills host's skill folder.",
         "$ /plugin marketplace add HarperZ9/flywheel-evidence-task\n$ /plugin install flywheel-evidence-task@flywheel-evidence-task"),
    ],
    "try_src": "Then ask, for example: use flywheel-evidence-task to check the claim in this release note against its linked sources. The package check output is from scripts/check_plugin.py at b945c9e.",
    "limits": [
        "It is an instruction set. The quality of a packet depends on the agent that follows it and the sources you allow.",
        "It grants no standing authority, monitoring, posting, deployment or submission.",
        "The expected result shapes on this page come from the skill's examples. No agent run was recorded for them.",
        "The copy here is published from the Flywheel repository; SOURCE.md names the commit it was taken from.",
    ],
    "limits_src": "README.md at b945c9e; skills/flywheel-evidence-task/SKILL.md, \"Boundaries\"",
    "recall": [
        ("Tools are installed and status is green. What does the packet say about readiness?", "UNVERIFIABLE, until a real task run, a replay and a false-success control have been measured."),
        ("What is a false-success control for?", "It is a case a weak check would wrongly pass, so it shows whether the check can fail."),
        ("What does the plugin run on your computer?", "Nothing. It is a SKILL.md with references and examples, and no hooks, server or scripts."),
    ],
    "license_line": "flywheel-evidence-task is released under FSL-1.1-MIT.",
}
