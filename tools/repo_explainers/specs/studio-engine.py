SHA = "24cd0f4c59a1c3007f94904f74f69af689546b50"
B = f"https://github.com/HarperZ9/studio-engine/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

FLOW = ["seed", "critique", "refine", "witness", "shader, sound, motion", "frames"]

SPEC = {
    "slug": "studio-engine", "repo": "studio-engine", "sha": SHA, "name": "studio-engine", "version": "version 0.3.0",
    "description": "An animated walk through studio-engine, a dependency-free Python engine that generates shaders, sound and motion as replayable worlds: a gyroid at seed 7 refined to cohesion 0.8922, one expression emitted as GLSL, a Web Audio synth and a timeline, PNG frames bound to the expression hash, a tampered program refused, and a novelty corpus that changes the result on a second run. Built from studio-engine at commit 24cd0f4.",
    "lede": "Generate replayable shaders, sound and motion, each with a receipt.",
    "for_you": "Generated art usually ends as pixels nobody can inspect. studio-engine keeps the whole recipe: the shader, a sound graph, a motion timeline, the criteria it was judged against, every refinement step and a receipt. You can re-render it, steer it over a local HTTP API, or render PNG frames with no GPU. It runs on the Python standard library alone.",
    "uses": [
        ("One expression, every output", "The same formula becomes the GLSL shader, the scored samples, the timeline and the synth graph."),
        ("Frames without a GPU", "A software rasterizer writes deterministic PNG frames, each hashed into the receipt."),
        ("Tampering is refused", "The rasterizer re-hashes the shipped expression and will not draw a mismatch."),
        ("Ten generators", "Seven fields and three point sets, each one table entry."),
    ],
    "how_intro": "Scroll, or use the step buttons. Every line is output from studio-engine at commit 24cd0f4, from <code>python -m studio_engine --render-frames 7 gyroid</code> and from the engine called in Python with an empty novelty corpus.",
    "steps": [
        {"title": "A seed and a generator",
         "paras": ["Pick the gyroid with seed 7. The seed drives a fixed integer hash, so it sets the starting parameters and a six-colour palette in OKLCh. The gyroid starts at frequency 8.88 and z 0.66."],
         "src": L("studio_engine/engine.py") + ", <code>run</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 0}},
                   {"io": {"cmd": "python -m studio_engine --render-frames 7 gyroid", "lines": ["world 1e1312cf579e9deb | 'Gyroid #7'", "palette=['#7375cb', '#8e7fd8', '#a88ae3', '#c295ec', '#dca1f3', '#f5adf9']"]}}]},
        {"title": "Score, then refine the weakest axis",
         "paras": ["Each step samples the field on a 20 by 20 grid and scores four axes: clean frequency, contrast, complexity and novelty. Cohesion is their harmonic mean. Refinement moves one parameter at a time toward higher cohesion. The frequency jumps to 10, a whole number, then z rises to 0.95, and cohesion climbs from 0.7983 to 0.8922."],
         "src": L("studio_engine/criteria.py") + ", " + L("studio_engine/engine.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 2}},
                   {"table": {"head": ["step", "freq", "z", "cohesion", "weakest"], "rows": [["0", "8.88", "0.66", "0.7983", "contrast"], ["1", "10.0", "0.66", "0.849", "contrast"], ["2 to 6", "10.0", "0.95", "0.8922", "contrast"], ["7 witness", "10.0", "0.95", "0.8922", ""]]}}]},
        {"title": "Short of the target, and an outside check",
         "paras": ["Convergence needs cohesion of 0.9 with every axis at or above the floor. At 0.8922 the run stops as best effort, unconverged. A separate structural-fitness check from coherence-membrane then measures a deviation of 0.108 against a tolerance of 0.4 and verifies the world. Without that package installed, this line reads unverifiable."],
         "src": L("studio_engine/certify.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 3}},
                   {"io": {"lines": ["steps=8 converged=False final_score=0.8922", "certificate  structural-fitness-v1: deviation 0.108 <= tolerance 0.4"], "verdict": ["best effort; certificate verified", "ok", "the two checks are reported separately"]}}]},
        {"title": "One expression, three outputs",
         "paras": ["The field sin(10u)cos(10v) + sin(10v)cos(10t) + sin(10t)cos(10u) is held as a frozen tree. It is emitted as the GLSL <code>field()</code> body, parsed back, and required to evaluate equal to the original within 1e-6. Swept over t it gives a timeline with a period of 0.628 seconds whose loop has no jump. Sonified, it becomes a six-harmonic additive sine synth at 373.7 Hz."],
         "src": L("studio_engine/strand/glsl.py") + ", " + L("studio_engine/temporal.py") + ", " + L("studio_engine/strand/webaudio.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 4}},
                   {"io": {"lines": ["render=glsl-fragment expr_sha=528f4a81a82a6ea2", "timeline period=0.628319 continuity=verified on_criterion=verified", "audio additive-sine, 6 oscillators, base 373.7435 Hz", "receipt artifact_shas 528f4a81a82a6ea2 318e38c3c99a9a8a 0141bd73e3ff4c26"]}}]},
        {"title": "Frames, and a tampered program",
         "paras": ["<code>--render-frames</code> rasterizes eight PNG frames across the loop period and writes a manifest binding each frame's SHA-256 to the expression hash. Before drawing, the rasterizer rebuilds the expression from the shipped tree and re-hashes it. Pick a program in the panel: changing one constant from 10 to 11 makes the hash disagree, and the render is refused."],
         "src": L("studio_engine/raster_renderer.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 5}},
                   {"cases": {"label": "Choose the program", "items": [
                       {"label": "as shipped", "blocks": [{"io": {"lines": ["rendered 8 PNG frame(s) -> studio-out/frames-7/ (+ frames.json)", "f000  expr_sha256 528f4a81a82a6ea2  frame d0c2f3d3653850f2..."], "verdict": ["rendered", "ok"]}}]},
                       {"label": "one constant changed", "blocks": [{"io": {"lines": ["FrameError: expr_sha256 mismatch: shipped expr_ast hashes to '66d2baf11fc710d8'", "but program claims '528f4a81a82a6ea2' (tampered program or receipt)"], "verdict": ["refused", "drift", "nothing is drawn"]}}]}]}}]},
        {"title": "Same input, same world, for a fixed corpus",
         "paras": ["Novelty is measured against a corpus of everything made before, and the corpus grows with every run. With the corpus cleared, seed 7 gives world 1e1312cf579e9deb every time. Run it again without clearing and the new gyroid is a near copy of the last one: novelty falls to 0.08 and the result changes."],
         "src": L("studio_engine/corpus.py") + "; README.md, \"Why it matters\"",
         "scene": [{"cases": {"label": "Choose a run", "items": [
             {"label": "empty corpus", "blocks": [{"io": {"lines": ["world 1e1312cf579e9deb  final_score=0.8922"], "verdict": ["same id each time", "ok"]}}]},
             {"label": "empty corpus, again", "blocks": [{"io": {"lines": ["world 1e1312cf579e9deb  final_score=0.8922"], "verdict": ["same id each time", "ok"]}}]},
             {"label": "second run, corpus kept", "blocks": [{"io": {"lines": ["world 1455056cc992283b  final_score=0.2477", "weakest axis: novelty = 0.084"], "verdict": ["different world", "drift", "the corpus is part of the input"]}}]}]}}]},
    ],
    "try": [
        ("Python 3.10 or newer, no install step. Add <code>--render-frames</code> for PNG frames, or start the API and open <code>handoff/reference-chamber.html</code> to see the shader and hear the synth.",
         "$ git clone https://github.com/HarperZ9/studio-engine && cd studio-engine\n$ python -m studio_engine --render-frames 7 gyroid\n$ python -m studio_engine.server 8777\n$ python -m unittest discover -s tests"),
    ],
    "try_src": "Output from studio-engine at 24cd0f4 with Python 3.12 on Windows. The unittest suite reported 195 tests passing. Ids depend on the novelty corpus, which the CLI keeps at studio_engine/_corpus.json.",
    "limits": [
        "The criteria are coarse aesthetic axes. A score is a measured read of them and makes no claim about beauty.",
        "The engine emits shader programs and synth graphs as data. Browsers, GPUs and audio hosts play them.",
        "Version 0.3.0; the API may still change before 1.0. The native GPU renderer is a separate project, and the bridge says so when it is absent.",
    ],
    "limits_src": "README.md at 24cd0f4, \"Scope and maturity\" and \"Why it matters\"",
    "recall": [
        ("Why does a second run of seed 7 give a different world?", "Novelty is scored against a corpus that grew with the first run."),
        ("What does the rasterizer check before drawing a frame?", "It rebuilds the expression from the shipped tree, re-hashes it, and refuses on a mismatch."),
        ("What happens to the GLSL before it ships?", "It is parsed back and must evaluate equal to the original expression within 1e-6."),
    ],
    "license_line": "studio-engine is released under FSL-1.1-MIT.",
}
