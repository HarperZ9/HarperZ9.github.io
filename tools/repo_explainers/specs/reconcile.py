SHA = "ba20136e330e489bf36d6ed9334d15ae87e7e77b"
B = f"https://github.com/HarperZ9/reconcile/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

FLOW = ["generate", "critique", "refine", "render program", "timeline", "receipt"]

SPEC = {
    "slug": "reconcile", "repo": "reconcile", "sha": SHA, "name": "reconcile", "version": "version 0.2.0",
    "description": "An animated walk through reconcile, a zero-dependency engine that turns creative generators into replayable worlds: a gyroid at seed 7 scored on four axes, refined toward its weakest one over ten recorded steps, labelled best-effort when it stops short of the target, emitted as a GLSL program with a timeline, palette and receipt, and reproduced to the same id on a second run. Built from reconcile at commit ba20136.",
    "lede": "Turn creative generators into replayable browser worlds.",
    "for_you": "A generated image is easier to trust when you can see how it was made and make it again. reconcile runs a generator, scores the result against criteria the generator did not write, adjusts its parameters toward the weakest score, and writes everything into one World record: the shader program, the refinement path, a motion timeline, a palette and a receipt. The same generator and seed give the same World in Node and in the browser.",
    "uses": [
        ("Ten generators", "Seven field generators emit closed-form expressions; three form generators emit point recipes."),
        ("Refinement you can read", "Every step records its parameters, scores and the weakest axis it moved toward."),
        ("Honest labels", "A result short of the target is labelled best-effort, never verified."),
        ("No dependencies", "Node 18 or newer, or a browser that imports the same module."),
    ],
    "how_intro": "Scroll, or use the step buttons. Every line is output from <code>node cli.js</code> at commit ba20136, mostly from <code>create gyroid --seed 7</code> and the World JSON it wrote.",
    "steps": [
        {"title": "Pick a generator and a seed",
         "paras": ["The library has ten generators. Seven describe a field as a formula over u, v and t: gyroid, quasicrystal, flowfield, turbulence, metaballs, rings and moire. Three produce point sets: phyllotaxis, attractor and harmonograph. Every one has the same interface, so the engine treats them alike.",
                   "The walk-through uses the gyroid with seed 7."],
         "src": L("src/organs") + ", " + L("src/organ.js"),
         "scene": [{"pipe": {"stages": FLOW, "active": 0}},
                   {"table": {"head": ["kind", "generators"], "rows": [["field (formula)", "gyroid, quasicrystal, flowfield, turbulence, metaballs, rings, moire"], ["form (points)", "phyllotaxis, attractor, harmonograph"]]}}]},
        {"title": "Score it on every axis",
         "paras": ["The gyroid is sampled and scored from 0 to 1 on axes it did not author: how close its frequency sits to a whole number, its contrast, its complexity, and its novelty against earlier results. The overall cohesion is the harmonic mean, so one weak axis pulls the whole score down.",
                   "At the seed's starting point, with frequency 6.928, cohesion is 0.8237 and contrast is the weakest axis."],
         "src": L("src/criteria.js") + ", " + L("src/refine.js") + ", <code>evaluate</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 1}},
                   {"io": {"lines": ["step 0   freq 6.928  z 0.178", ["cohesion 0.8237   weakest contrast", "hi"]]}}]},
        {"title": "Refine toward the weakest axis",
         "paras": ["Refinement tries moving each parameter up and down, keeps the move that raises cohesion most, and halves its step when nothing helps. Each step is recorded. Over ten steps the frequency falls from 6.928 to 2, a whole number, and z rises to 0.28. Cohesion climbs to 0.8624."],
         "src": L("src/refine.js") + ", <code>refine</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 2}},
                   {"table": {"head": ["step", "freq", "z", "cohesion"], "rows": [["0", "6.928", "0.178", "0.8237"], ["2", "5.058", "0.178", "0.8372"], ["4", "4.029", "0.178", "0.8485"], ["5", "3.001", "0.178", "0.8546"], ["6", "2", "0.178", "0.8603"], ["7 to 9", "2", "0.28", "0.8624"]]}}]},
        {"title": "Short of the target is best-effort",
         "paras": ["The target is a cohesion of 0.9 with every axis at 0.6 or above. The gyroid stops at 0.8624, so the result is labelled unverifiable, best-effort, and the record says it did not converge. Contrast at 0.73 is still the weakest axis.",
                   "Skipping refinement with <code>--no-refine</code> gives a one-step trajectory at 0.8237 and a different World id."],
         "src": L("src/criteria.js") + ", <code>tag</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 2}},
                   {"io": {"cmd": "node cli.js create gyroid --seed 7 --out out", "lines": ["reasoning: 10 steps · cohesion 0.8624", "margins: clean_freq=1.00 contrast=0.73 complexity=0.79 novelty=1.00"], "verdict": ["unverifiable", "unv", "best-effort: 0.8624 is under the 0.9 target"]}}]},
        {"title": "Emit a program, a timeline and a receipt",
         "paras": ["The World carries the shader as data: a GLSL fragment program for the field sin(2u)cos(2v) + sin(2v)cos(2t) + sin(2t)cos(2u), with the refined frequency of 2. A motion timeline with a period of pi seconds is checked for a loop with no jump and for staying on criterion. A six-colour palette and a receipt with the seed, generator, content hash and witness close the record."],
         "src": L("src/world.js") + ", " + L("src/temporal.js") + ", " + L("src/expr.js"),
         "scene": [{"pipe": {"stages": FLOW, "active": 5}},
                   {"io": {"lines": ["layers: gyroid·glsl", "timeline: period 3.141593s · continuity verified · on-criterion verified", "palette: #287425 #2f9546 #39b576 #51c8aa #72d1d2 #92c8dd", ["receipt: seed 7 · witness 1bde4e6783a2a5", "hi"]]}}]},
        {"title": "Same input, same World",
         "paras": ["Run the same command again and the World id and witness are identical. Change the seed or the refinement setting and both change. Pick each run in the panel."],
         "src": "README.md, \"What to test first\"",
         "scene": [{"cases": {"label": "Choose a run", "items": [
             {"label": "seed 7", "blocks": [{"io": {"lines": ["world 0ccddf32f6535e · 10 steps · cohesion 0.8624"], "verdict": ["same id on a second run", "ok"]}}]},
             {"label": "seed 7, --no-refine", "blocks": [{"io": {"lines": ["world 0fcae661b381a6 · 1 step · cohesion 0.8237"]}}]},
             {"label": "seed 8", "blocks": [{"io": {"lines": ["world 00ebeea2717aa6 · 8 steps · cohesion 0.863"]}}]},
             {"label": "gyroid + phyllotaxis", "blocks": [{"io": {"cmd": "node cli.js compose gyroid,phyllotaxis --seed 7", "lines": ["composition: 0.5829 (depth_complementarity=0.425, contrast_balance=0.9273)"], "verdict": ["refuted", "drift", "the layers do not complement in depth"]}}]}]}}]},
    ],
    "try": [
        ("Node 18 or newer, no install step. Open <code>web/index.html</code> to run the same engine in a browser and see the shader rendered in WebGL.",
         "$ git clone https://github.com/HarperZ9/reconcile && cd reconcile\n$ node cli.js create gyroid --seed 7 --out out\n<span class=\"out\">world 0ccddf32f6535e · Gyroid #7</span>\n$ python -m http.server\n$ npm test"),
    ],
    "try_src": "Output from cli.js at ba20136 with Node on Windows. npm test reported 25 tests passing.",
    "limits": [
        "The criteria are coarse aesthetic axes. A high cohesion is a measured read of those axes and makes no claim about beauty or quality.",
        "The content hash is cyrb53, a fast digest for identity and tamper evidence. It is not cryptographic.",
        "The engine emits shader programs and point recipes as data and checks them on the CPU. Rendering and audio belong to the host.",
    ],
    "limits_src": "README.md at ba20136, \"Honest scope\" and \"Current status\"",
    "recall": [
        ("Why does one weak axis pull cohesion down so far?", "Cohesion is the harmonic mean of the axis scores."),
        ("The gyroid stops at 0.8624. What label does it get?", "Unverifiable, best-effort: it is under the 0.9 target."),
        ("What happens to the World id if you rerun seed 7?", "It stays the same: 0ccddf32f6535e."),
    ],
    "license_line": "reconcile is released under FSL-1.1-MIT.",
}
