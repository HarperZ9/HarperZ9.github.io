SHA = "a3abd8c6f263e0f0523c634034cade201488425e"
B = f"https://github.com/HarperZ9/learn/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

LOOP = ["plan", "record", "study", "mastery", "receipt"]
RUN = ["navigate", "waitFor", "click", "capture", "assess", "complete"]

SPEC = {
    "slug": "learn", "repo": "learn", "sha": SHA, "name": "learn", "version": "version 2.3.0",
    "description": "An animated walk through learn, a study loop built from your own attempts: spaced review, misconception tracking, a mastery gate that only your scored attempts can move, a receipt that re-derives the verdict, and a course engine that halts at every graded step. Built from learn at commit a3abd8c.",
    "lede": "Turn your own material into a study loop that never takes the test for you.",
    "for_you": "learn turns what you are studying into a loop: it schedules reviews, tracks what you keep getting wrong, orders practice, and tells you when you are ready, all from attempts you recorded yourself. Its readiness verdict can be re-derived from a receipt. A second engine automates course logistics and stops at every graded step, so the graded work stays yours.",
    "uses": [
        ("One plan from your attempts", "<code>learn tutor study</code> puts together what is due, your misconceptions, a practice order and the mastery verdict."),
        ("A gate only you can move", "Mastery reads only your scored attempts: at least 3 per objective and 80% accuracy by default."),
        ("A receipt that re-derives", "<code>tutor reverify</code> recomputes the hash chain and the verdict, and names CHAIN_BROKEN or VERDICT_MISMATCH."),
        ("Logistics that halt at graded work", "<code>learn run</code> stops at every step tagged <code>assess</code> and waits for you."),
    ],
    "how_intro": "Scroll, or use the step buttons. The panel follows a derivatives session through the <code>learn tutor</code> commands, then the bundled course workflow. Every line is output from learn at commit a3abd8c, run with Node and no network.",
    "steps": [
        {"title": "Plan a session",
         "paras": ["A session names a topic and its objectives. Here the topic is derivatives, with two objectives: the power rule and the chain rule."],
         "src": L("src/tutor/session.mjs") + "; README.md, \"Quickstart\"",
         "scene": [{"pipe": {"stages": LOOP, "active": 0}},
                   {"io": {"cmd": 'learn tutor plan mysession --topic "derivatives" --objectives "power-rule,chain-rule"', "lines": [["tutor plan mysession: 2 objective(s)", "hi"]]}}]},
        {"title": "Record an attempt, then ask what to study",
         "paras": ["You answer <code>d/dx x^3</code> with <code>3x^2</code> and record it as correct. <code>tutor study</code> then builds the plan: the chain rule is due because you have not practised it, the order mixes both, and both are unlocked because neither has a prerequisite.",
                   "Times are passed in with <code>--now</code>, so the same log always gives the same schedule."],
         "src": L("src/tutor/study.mjs") + ", " + L("src/tutor/schedule.mjs"),
         "scene": [{"pipe": {"stages": LOOP, "active": 2}},
                   {"io": {"cmd": 'learn tutor record mysession --objective power-rule --prompt "d/dx x^3" --answer "3x^2" --correct true', "lines": ["tutor record mysession: 1 practice attempt(s)"]}},
                   {"io": {"cmd": "learn tutor study mysession --now 2026-06-30T00:00:00Z", "lines": ["tutor study mysession: 1 due, 0 misconception(s), mastery not yet",
                                                                                                    ["  due: chain-rule", "hi"], "  order: power-rule, chain-rule", "  readiness: power-rule:unlocked, chain-rule:unlocked"]}}]},
        {"title": "A wrong answer becomes a misconception",
         "paras": ["Answer <code>d/dx sin(x^2)</code> with <code>cos(x^2)</code>, mark it wrong, and note why: you forgot the inner derivative. learn groups wrong attempts and your own feedback by objective and ranks them by count, so the next session spends time there."],
         "src": L("src/tutor/misconception.mjs"),
         "scene": [{"pipe": {"stages": LOOP, "active": 1}},
                   {"io": {"cmd": 'learn tutor record mysession --objective chain-rule --prompt "d/dx sin(x^2)" --answer "cos(x^2)" --correct false --feedback "forgot the inner derivative 2x"',
                           "lines": ["tutor record mysession: 2 practice attempt(s)"]}},
                   {"io": {"cmd": "learn tutor misconceptions mysession", "lines": ["tutor misconceptions mysession: 1 objective(s)", ["  chain-rule (1x): forgot the inner derivative 2x", "hi"]]}}]},
        {"title": "The mastery gate",
         "paras": ["Mastery is ready only when every objective has at least 3 attempts at 80% accuracy or better. One perfect attempt is not enough, and a 50% objective holds the whole session back. The command exits 1 until the gate opens.",
                   "Pick the state of the log in the panel. The scheduler can suggest what to practise, but it cannot move this line: only your scored attempts can."],
         "src": L("src/tutor/session.mjs") + ", <code>mastery</code>",
         "scene": [{"pipe": {"stages": LOOP, "active": 3}},
                   {"cases": {"label": "Choose the attempt log", "items": [
                       {"label": "after 3 attempts", "blocks": [{"io": {"cmd": "learn tutor mastery mysession", "lines": ["  [keep going] power-rule: 1/1 (100%)", ["  [keep going] chain-rule: 1/2 (50%)", "hi"]], "verdict": ["not yet", "drift", "exit 1: too few attempts and too low accuracy"]}}]},
                       {"label": "3 correct each", "blocks": [{"io": {"cmd": "learn tutor mastery s", "lines": ["  [ready] power-rule: 3/3 (100%)", "  [ready] chain-rule: 3/3 (100%)"], "verdict": ["READY", "ok", "exit 0: every objective clears 3 attempts at 80%"]}}]}]}}]},
        {"title": "A receipt you can re-derive",
         "paras": ["<code>tutor study-receipt</code> writes the plan with its practice entries in a hash chain and the mastery verdict with the policy that produced it. <code>tutor reverify</code> recomputes the chain and re-derives the verdict from the receipt's own entries.",
                   "Edit one recorded attempt and the chain breaks, and the verdict no longer follows from the entries. Edit only the verdict and it no longer matches what the entries give. Pick each case in the panel."],
         "src": L("src/tutor/reverify.mjs"),
         "scene": [{"pipe": {"stages": LOOP, "active": 4}},
                   {"cases": {"label": "Choose an edit", "items": [
                       {"label": "untouched", "blocks": [{"io": {"cmd": "learn tutor reverify s", "lines": ["  [VERIFIED] s.study-receipt.json", "    witnessed: 6 entries, mastery READY re-derived"], "verdict": ["VERIFIED", "ok", "exit 0"]}}]},
                       {"label": "one attempt flipped to wrong", "blocks": [{"io": {"cmd": "learn tutor reverify s", "lines": [["CHAIN_BROKEN @entry seq=0: hash chain does not recompute at entry seq 0", "hi"], ["VERDICT_MISMATCH: stored mastery verdict (ready=true) does not re-derive from the receipt's own 6 recorded practice entries (re-derived ready=false)", "hi"]], "verdict": ["NOT VERIFIED", "drift", "exit 1"]}}]},
                       {"label": "verdict set to not ready", "blocks": [{"io": {"cmd": "learn tutor reverify s", "lines": [["VERDICT_MISMATCH: stored mastery verdict (ready=false) does not re-derive from the receipt's own 6 recorded practice entries (re-derived ready=true)", "hi"]], "verdict": ["NOT VERIFIED", "drift", "exit 1"]}}]}]}}]},
        {"title": "Course logistics halt at the graded step",
         "paras": ["The second engine runs a declarative course workflow. The bundled example navigates to a course, waits for module 1, clicks start and captures the page. Step 4 is tagged <code>assess</code>, a quiz, so the engine halts there and waits for you.",
                   "Once you resume, it completes and the run's ledger verifies. A step tagged <code>assess</code> never completes on its own."],
         "src": L("examples/course.json") + ", " + L("examples/demo.mjs") + "; README.md, \"Credential-logistics engine\"",
         "scene": [{"pipe": {"stages": RUN, "active": 4, "note": "the engine stops at assess"}},
                   {"io": {"cmd": "node examples/demo.mjs", "lines": ['workflow "Intro to Accountable Automation" (fake adapter): 6 steps, seal sha256:783761b489e8...',
                                                                     ['status: halted-assess @ step 4 (assess: "Quiz 1: what the engine may automate")', "hi"],
                                                                     "the engine will not touch the graded step. it waits for the operator.",
                                                                     "resumed -> status: completed", "ledger verify: chain ok"],
                           "verdict": ["halted at assess", "ok", "the quiz is yours"]}}]},
    ],
    "try": [
        ("Install with npm (Node 20 or newer). Nothing here needs the network once installed.",
         "$ npm install -g @harperz9/learn@2.3.0\n$ learn tutor plan mysession --topic \"derivatives\" --objectives \"power-rule,chain-rule\"\n$ learn tutor record mysession --objective power-rule --prompt \"d/dx x^3\" --answer \"3x^2\" --correct true\n$ learn tutor study mysession --now 2026-06-30T00:00:00Z\n<span class=\"out\">tutor study mysession: 1 due, 0 misconception(s), mastery not yet\n  due: chain-rule</span>"),
    ],
    "try_src": "Output from learn at a3abd8c run from a clone; @harperz9/learn 2.3.0 is the current npm release.",
    "limits": [
        "learn grades nothing for you. An attempt is marked correct or wrong by you, and the mastery gate reads those marks.",
        "The adaptive scheduler is a hint. It can reorder practice; it never changes the mastery verdict.",
        "The course engine recognises a graded page only when the workflow tags it <code>assess</code>. An untagged submit or fee runs as an ordinary step, so read a workflow from someone else before you run it.",
        "A verified receipt shows the verdict follows from the recorded attempts. It does not show the attempts were honest.",
    ],
    "limits_src": "README.md at a3abd8c, \"Features\"; src/tutor/session.mjs and src/tutor/reverify.mjs",
    "recall": [
        ("Why does one perfect attempt not open the mastery gate?", "The default gate needs at least 3 attempts per objective as well as 80% accuracy."),
        ("Can the scheduler move a session to READY?", "No. Only your scored attempts can. The scheduler only suggests what to practise next."),
        ("You flip one recorded attempt inside a receipt. Which two failures does reverify report?", "CHAIN_BROKEN, because the hash chain no longer recomputes, and VERDICT_MISMATCH, because the stored verdict no longer follows from the entries."),
        ("What does the course engine do at a step tagged assess?", "It halts and waits for you. It never completes that step itself."),
    ],
    "license_line": "learn is released under its Fair Source License.",
}
