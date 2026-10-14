"""Watch and Walkthrough data for the repository explainers.

FILMS are the concept films published on explainers.html. WALK maps a page slug
to the film that fits it (or None) and to walkthrough steps. A step's command
and output are either written out (copied from the page's own Try block, which
records real runs) or pulled by path from an io block in the spec's scenes, so
no output here is typed from memory.
"""
import html
import json
import os
import pathlib
import re

SITE = "https://harperz9.github.io"

# Release media (raw-native ADR 0012) lands in the site at media/releases/<repo>/<tag>/<scene>/,
# each with a media.json. A repository's Watch section shows its latest release's films, read
# from a site checkout, so a repo gains films here the moment its release media is on the site.
SITE_CHECKOUT = pathlib.Path(os.environ.get("SITE_CHECKOUT", pathlib.Path(__file__).resolve().parents[2]))


def _version(tag):
    return tuple(int(x) for x in re.findall(r"\d+", tag))


def release_films(slug):
    """(tag, [(scene, media.json dict, folder url)]) for the latest release on the site, or (None, [])."""
    d = SITE_CHECKOUT / "media" / "releases" / slug
    tags = [p.name for p in d.iterdir() if p.is_dir()] if d.is_dir() else []
    if not tags:
        return None, []
    tag = max(tags, key=_version)
    films = []
    for sd in sorted((d / tag).iterdir()):
        mj = sd / "media.json"
        if mj.is_file():
            m = json.loads(mj.read_text(encoding="utf-8"))
            if any(f.endswith("-1080p.mp4") for f in m["files"]):
                films.append((sd.name, m, f"{SITE}/media/releases/{slug}/{tag}/{sd.name}"))
    return tag, films


def length(seconds):
    s = int(seconds)
    return f"{s} s" if s < 60 else (f"{s // 60} min {s % 60} s" if s % 60 else f"{s // 60} min")

FILMS = {
    "checking-cost": ("Claiming got cheap. Checking did not.", "2 min 57 s"),
    "passing-check": ("A passing check can still be wrong", "2 min 24 s"),
    "rederive": ("Re-derive it. Don't take it on trust.", "2 min 5 s"),
    "incentives": ("Models do what training pays for", "2 min"),
    "visible-reasoning": ("What a model's written reasoning can and cannot show", "1 min 49 s"),
}

# Why each film fits, in one sentence, shown under the player.
FIT = {
    "flywheel": ("rederive", "Flywheel is built on the idea in this film: accept a result only when it can be re-derived."),
    "relay": ("incentives", "Relay accepts a run only when your own check passes, which is the guard this film argues for."),
    "mneme": ("rederive", "Every Mneme recall carries a receipt you can re-run, the habit this film describes."),
    "crucible": ("passing-check", "Crucible steelmans each claim before it measures, because a pass alone can hide a weak check."),
    "gather": ("checking-cost", "Gather keeps a receipt for every source it pulls, so checking a citation stays cheap."),
    "forum": ("rederive", "Forum's ledger can be replayed and verified after the run, the practice this film describes."),
    "index-graph": ("rederive", "Index re-derives its sealed wiki from the code and says when the two disagree."),
    "telos": ("passing-check", "Telos scores a render against a criterion the loop did not write, so a pass has to be earned."),
    "superstack": ("rederive", "superstack checks every language against the same vectors, byte for byte."),
    "emet": ("rederive", "EMET re-derives whether the bytes still match their source, and seals the answer."),
    "proof-surface": ("passing-check", "Proof Surface refuses a packet whose claim outruns its measurement."),
}


def _text(line):
    return line[0] if isinstance(line, list) else line


def _io_at(spec, path):
    i, rest = path[0], path[1:]
    blocks = spec["steps"][i]["scene"]
    node = None
    while rest:
        j, rest = rest[0], rest[1:]
        node = blocks[j]
        if rest and rest[0] == "c":
            blocks = node["cases"]["items"][rest[1]]["blocks"]
            rest = rest[2:]
    return node["io"]


def from_scene(spec, path, prompt="$ "):
    io = _io_at(spec, path)
    out = "\n".join(html.escape(_text(l)) for l in io.get("lines", []))
    cmd = f"{prompt}{html.escape(io['cmd'])}" if io.get("cmd") else ""
    return cmd + (f'\n<span class="out">{out}</span>' if out else "")


# Each step: (title, text, code) where code is HTML for a <pre class="cmd">, or
# ("scene", path, prompt) to pull a real io block from the spec.
WALK = {
    "relay": [
        ("Install", "Install from PyPI. Python 3.11 or newer.", "$ python -m pip install flywheel-relay"),
        ("First run: probe the boundary", "Before relay touches a model, run its built-in injection probes against the permission boundary. All six were contained.",
         '$ relay --probe-injection\n<span class="out">  "contained": 6,\n  "total": 6,\n  "receipt": "1405769b874ca5d7"</span>'),
        ("Read with line anchors", "The agent reads a file with a short hash on each line, so a later edit can name exactly the line it saw.", ("scene", (1, 0), "")),
        ("Edit by anchor", "An edit names the anchor it read. If the file changed since, the anchor no longer matches and the edit is refused.", ("scene", (2, 0), "")),
        ("Run a task, accepted only by your check", "Point relay at a model and a repository. Writes need <code>--allow-write</code>, and the run counts as done only when your check passes.",
         '$ relay --agent "fix the off-by-one in paginate()" --root . --allow-write --check "pytest -q"'),
    ],
    "mneme": [
        ("Install", "Install from PyPI, or clone to run the tour. Python 3.11 or newer; no model and no network.",
         "$ python -m pip install flywheel-mneme\n$ git clone https://github.com/HarperZ9/mneme && cd mneme"),
        ("First run: the tour", "The tour stores a short conversation, recalls from it with a receipt, and shows a stale memory flagging itself.",
         '$ python examples/tour.py\n<span class="out">== 2. recall &#8212; with a receipt a third party can re-run ==\n    [1.783] I prefer tea over coffee and I work in data science.\n  re-ran the scorer: identical ranking (the recall is re-derivable)\n\n== 3. drift &#8212; a memory whose source changes flags itself ==\n  before: MATCH\n  after a source changed: DRIFT (stale memory says so, it is not silently served)</span>'),
        ("Recall with a receipt", "In your own code, a recall returns the ranked facts and a receipt that records how they were ranked.", ("scene", (2, 0), ">>> ")),
        ("Forget, with a receipt", "Forgetting erases the text and leaves a tombstone that records what was removed and why.", ("scene", (6, 0), ">>> ")),
    ],
    "crucible": [
        ("Install", "Install from PyPI. Python 3.11 or newer.", "$ pip install crucible-bench"),
        ("First run: write the example inputs", "The package ships a thesis and its measurements. This writes them into a folder you can read.",
         "$ crucible examples --out crucible-examples"),
        ("Test a thesis", "Run the thesis against its measurements. Each claim is steelmanned first, then measured against its tolerance, and the verdicts are sealed into a registry.",
         '$ crucible run crucible-examples/thesis-binary-search.json --measurements crucible-examples/measurements-binary-search.json --registry .crucible-registry\n<span class="out">ran thesis bd7404c02eb2036e: 3 claim(s)\n  steelman refutations: 3\n  MATCH 1  DRIFT 1  UNVERIFIABLE 1</span>'),
        ("Catch a flipped verdict", "From a checkout, the demo flips one sealed verdict and rechecks it. The recheck fails.", ("scene", (5, 1), "$ ")),
    ],
    "gather": [
        ("Install", "Install from a checkout to run the demo. Python 3.11 or newer; none of this needs the network.",
         "$ git clone https://github.com/HarperZ9/gather && cd gather\n$ pip install -e ."),
        ("First run: the demo", "The demo builds a sealed digest of three receipts, then tampers with one and shows the digest no longer verifies.",
         '$ python examples/demo.py\n<span class="out">witnessed digest: 3 receipts, seal 7da7dc456b11..., verified True\n\nafter tampering one receipt, digest verifies: False  &lt;- caught</span>'),
        ("Extract a page", "Pull a saved page into structured blocks, each with its source position.", ("scene", (0, 0), "$ ")),
        ("Store your notes and re-check them", "Store a folder by content hash, then verify the corpus later. A clean corpus exits 0.",
         "$ gather docs ./notes --store ./corpus\n$ gather corpus verify ./corpus"),
    ],
    "forum": [
        ("Install", "Install from PyPI. Python 3.11 or newer; routing needs no model.", "$ pip install forum-engine"),
        ("First run: route a request", "Forum scores a request against its team profiles and names the one that should take it.",
         '$ forum route "build the auth endpoint and the database schema"\n<span class="out">  "decided": "backend",\n  "confidence": 0.6,</span>'),
        ("Run it on a model", "Submit the request with any command that runs a model. Forum plans it into waves, runs them, and records every step in a ledger.",
         '$ forum submit "ship a login API" --cmd "ollama run llama3"'),
        ("Verify the ledger", "Check the recorded ledger afterwards.", "$ forum ledger verify"),
    ],
    "learn": [
        ("Install", "Install with npm. Node 20 or newer.", "$ npm install -g @harperz9/learn@2.3.0"),
        ("First run: plan a session", "Name a topic and the objectives you want to master.", ("scene", (0, 1), "$ ")),
        ("Record what you answered", "Record each attempt with your own answer and whether it was right.", ("scene", (1, 1), "$ ")),
        ("Ask what to study next", "Learn schedules review from your attempts and names what is due.",
         '$ learn tutor study mysession --now 2026-06-30T00:00:00Z\n<span class="out">tutor study mysession: 1 due, 0 misconception(s), mastery not yet\n  due: chain-rule</span>'),
    ],
    "index-graph": [
        ("Install", "Install from PyPI. Python 3.11 or newer; everything runs offline.", "$ pip install index-graph"),
        ("First run: write a sealed wiki", "Map one repository into an offline wiki whose pages and edges are sealed.", ("scene", (3, 0), "$ ")),
        ("Verify it against the code", "Later, verify the wiki against the code as it is now.", ("scene", (3, 1), "$ ")),
        ("Ask who calls a function", "Every edge cites the file and line it came from.", ("scene", (2, 0), "$ ")),
    ],
    "telos": [
        ("Install", "Run the MCP server without cloning, or clone to run the demos. Node 20 or newer, no dependencies.",
         "$ npx -y project-telos-mcp\n$ git clone https://github.com/HarperZ9/telos.git && cd telos"),
        ("First run: two renders", "The demo checks an honest render and a broken one against a criterion the loop did not write.",
         '$ node demo/run.mjs\n<span class="out">  RUN A (honest render)  : CERTIFIED      recheck=true\n  RUN B (broken render)  : UNVERIFIABLE   recheck=true</span>'),
        ("Make a proof packet and verify it", "Write a packet for an agent action, then verify it from the packet alone.",
         '$ node demo/proof.mjs agent-action --demo --json &gt; packet.json\n$ node demo/proof.mjs verify packet.json\n<span class="out">verdict       MATCH\nwitness       unavailable / UNVERIFIABLE</span>'),
        ("An edited packet is named", "Change the packet and verify again.", ("scene", (5, 1, "c", 0, 0), "$ ")),
    ],
    "plexus": [
        ("Install", "Install from PyPI. Python 3.11 or newer; discovery runs no tool.", "$ python -m pip install plexus-mesh"),
        ("First run: is there a route?", "Ask whether one tool's output can reach another's input through the built-in manifests.",
         '$ plexus route --from gather --to crucible --builtin\n<span class="out">  "connected": true,\n  "hops": 1,</span>'),
        ("Discover your own tools", "Point plexus at a folder of manifests to see each tool's ports.", ("scene", (1, 1), "$ ")),
        ("Plan and verify a pipeline", "Plan a pipeline toward a goal, then verify the plan against the manifests you have now.", ("scene", (3, 1), "$ ")),
    ],
    "canon": [
        ("Install", "Install from PyPI. Python 3.11 or newer; no network call and no model.", "$ python -m pip install flywheel-canon\n$ cd your-repo"),
        ("First run: record the focus", "Tell canon what you are working on.",
         '$ canon workspace focus --goal "Ship the JSON export" --area src/export\n<span class="out">focus set: workspace-focus focus: Ship the JSON export</span>'),
        ("Hand off to another agent", "Write a brief for the next agent from what canon holds.", ("scene", (3, 1), "$ ")),
        ("Switch tools", "Write the same record into another tool's instruction file, between markers canon owns.",
         '$ canon switch --to codex --create\n<span class="out">Codex CLI: created AGENTS.md</span>'),
    ],
    "superstack": [
        ("Get it", "Clone the repository. Python 3.11 or newer and Node 20 or newer; no install step.",
         "$ git clone https://github.com/HarperZ9/superstack && cd superstack"),
        ("First run: the shared vectors", "Run the same 383 checks in each language.",
         '$ python tests/run_vectors.py\n<span class="out">python: 383/383 checks passed</span>\n$ node tests/run_vectors.mjs\n<span class="out">javascript: 383/383 checks passed</span>'),
        ("Seal a receipt", "In Python, seal a receipt over quantized audio samples.", ("scene", (3, 1), ">>> ")),
        ("The proof scene", "Run every example with its controls.", ("scene", (5, 0), "$ ")),
    ],
    "emet": [
        ("Install", "Install from PyPI, or run from a checkout. Python 3.8 or newer, no dependencies.", "$ pip install emet\n$ emet selftest"),
        ("First run: anchor and verify a file", "Anchor a file, then verify it.",
         '$ printf \'hello world\\n\' &gt; report.md\n$ emet anchor report.md\n$ emet verify report.md\n<span class="out">MATCH report.md want=a948904f2f0f479b got=a948904f2f0f479b</span>'),
        ("Seal the verdict", "Turn the verdict into a receipt and check it.", ("scene", (2, 2), "$ ")),
        ("Report authority claims", "Scan a prompt for text that claims authority. EMET reports each marker and obeys none.", ("scene", (4, 0), "$ ")),
    ],
    "proof-surface": [
        ("Install", "Install from a checkout. Python 3.10 or newer.",
         '$ git clone https://github.com/HarperZ9/proof-surface && cd proof-surface\n$ python -m pip install -e ".[test]"'),
        ("First run: the demo", "The demo gates the same action with and without a budget.",
         '$ python examples/demo.py\n<span class="out">with budget       : allow\nwithout budget    : needs-human</span>'),
        ("Build a proof packet from a measurement", "Turn a real measurement into a packet with a stated claim and scope.", ("scene", (4, 0), "$ ")),
    ],
    "chorus": [
        ("Install", "Install from a checkout. Python 3.10 or newer; no service key and no model.",
         "$ git clone https://github.com/HarperZ9/chorus && cd chorus\n$ pip install -e ."),
        ("First run: digest a thread", "Score, weight and cluster the sample comments, then verify the digest.",
         '$ chorus run examples/discourse-sample.json --verify\n<span class="out">  "contested": [ ... "term": "battery", "contested": 0.5386 ... ]</span>'),
        ("Re-derive the digest", "In Python, verify a digest against the scored comments. An edited digest is rejected.", ("scene", (5, 1, "c", 1, 0), ">>> ")),
    ],
}


def steps_for(slug, spec):
    out = []
    for title, text, code in WALK.get(slug, []):
        if isinstance(code, tuple) and code[0] == "scene":
            code = from_scene(spec, code[1], code[2])
        out.append((title, text, code))
    return out


def release_html(slug):
    tag, films = release_films(slug)
    out = []
    for scene, m, base in films:
        mp4 = next(f for f in m["files"] if f.endswith("-1080p.mp4"))
        vtt = next((f for f in m["files"] if f.endswith(".vtt")), None)
        track = f'\n      <track kind="captions" src="{base}/{vtt}" srclang="en" label="English">' if vtt else ""
        kind = ", ".join(x for x in ("narrated" if m.get("narrated") else "", "captioned" if vtt else "") if x)
        voice = " The narration is a synthesized version of the author's voice." if m.get("narrated") else ""
        out.append(f'''<figure class="film">
    <video controls preload="none" playsinline crossorigin="anonymous" width="1920" height="1080" poster="{base}/poster.jpg">
      <source src="{base}/{mp4}" type="video/mp4">{track}
    </video>
    <figcaption><b>{html.escape(m["title"])}</b> ({length(m["duration"])}{", " + kind if kind else ""}). Rendered by the {html.escape(slug)} {html.escape(tag)} release from values read at its commit {m["commit"][:7]}: <a href="{base}/facts.json">facts.json</a>.{voice} <a href="{base}/index.html">Open it live</a> to scrub it frame by frame.</figcaption>
  </figure>''')
    return tag, out


def watch_html(slug):
    """The Watch section's body: the latest release's own films, then the concept film that fits.
    Empty when there is neither, and the page then has no Watch section: nothing is promised."""
    tag, rel = release_html(slug)
    parts = []
    if rel:
        parts.append(f'<p class="measure">Rendered by this repository&#x27;s {html.escape(tag)} release from its own output, so every number on screen is one that release produced.</p>')
        parts += rel
    fit = FIT.get(slug)
    if fit:
        key, why = fit
        title, length_ = FILMS[key]
        base = f"{SITE}/media/explainers/{key}"
        parts.append(f'''<figure class="film">
    <video controls preload="none" playsinline crossorigin="anonymous" width="1920" height="1080" poster="{base}/poster.jpg">
      <source src="{base}/{key}.mp4" type="video/mp4">
      <track kind="captions" src="{base}/{key}.vtt" srclang="en" label="English">
    </video>
    <figcaption><b>{html.escape(title)}</b> ({length_}, narrated, captioned). {why} <a href="{SITE}/explainers.html#{key}-h">Transcript, sources and recall questions</a>.</figcaption>
  </figure>''')
    return "\n  ".join(parts)


from walk2 import FIT2 as _F2, WALK2 as _W2
FIT.update(_F2)
WALK.update(_W2)
