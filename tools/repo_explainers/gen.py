"""Generate an explainer source page from a spec file in specs/<slug>.py.

A spec defines SPEC, a dict. Prose fields hold trusted HTML written for the page;
scene blocks are data and are rendered as text by kit.js.
"""
import html, importlib.util, json, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import walkthroughs as wt

here = pathlib.Path(__file__).parent


def load(slug):
    p = here / "specs" / f"{slug}.py"
    sp = importlib.util.spec_from_file_location(slug, p)
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
    return m.SPEC


def gh(s, path):
    return f'https://github.com/HarperZ9/{s["repo"]}/blob/{s["sha"]}/{path}'


def page(s):
    slug, repo, sha = s["slug"], s["repo"], s["sha"]
    short = sha[:7]
    tree = f"https://github.com/HarperZ9/{repo}/tree/{sha}"
    esc = html.escape
    uses = "\n".join(f"    <li><b>{b}</b>{t}</li>" for b, t in s["uses"])
    scenes, steps = [], []
    kscenes = {}
    for i, st in enumerate(s["steps"]):
        sid = f"k{i}"
        kscenes[sid] = st["scene"]
        scenes.append(f'        <div class="scene" data-scene="{sid}" aria-hidden="true"><div class="kscene"></div></div>')
        paras = "\n".join(f"        <p>{p}</p>" for p in st["paras"])
        steps.append(f'''      <li class="step" tabindex="-1" data-scene="{sid}" data-state="s"><div class="card">
        <span class="num">{i + 1:02d}</span><h3>{st["title"]}</h3>
{paras}
        <p class="src">Source: {st["src"]}</p>
      </div></li>''')
    tries = "\n".join(
        (f'  <div class="measure"><p>{intro}</p></div>\n' if intro else "") +
        f'<pre class="cmd"><code>{code}</code></pre>' for intro, code in s["try"])
    walk = wt.steps_for(slug, s)
    if walk:
        items = "\n".join(
            f'    <li><h3>{t}</h3><p>{x}</p>\n<pre class="cmd"><code>{c}</code></pre></li>' for t, x, c in walk)
        try_section = (
            '<section class="block wrap" aria-labelledby="walkthrough">\n'
            '  <h2 id="walkthrough">Walkthrough</h2>\n'
            '  <p class="measure">Install it, run it once, then use the main feature. Each command below is real, and so is its output.</p>\n'
            f'  <ol class="walkthrough">\n{items}\n  </ol>\n'
            f'  <p class="src">{s["try_src"]}</p>\n</section>')
    else:
        try_section = (
            '<section class="block wrap" aria-labelledby="try">\n  <h2 id="try">Try it</h2>\n'
            f'{tries}\n  <p class="src">{s["try_src"]}</p>\n</section>')
    watch = wt.watch_html(slug) if slug in wt.WALK else ""
    watch_section = (
        '<section class="block wrap" aria-labelledby="watch">\n  <h2 id="watch">Watch</h2>\n'
        f'  {watch}\n</section>\n\n') if watch else ""
    limits = "\n".join(f"    <li>{x}</li>" for x in s["limits"])
    recall = "\n".join(f"  <details><summary>{q}</summary><p>{a}</p></details>" for q, a in s["recall"])
    data = json.dumps(kscenes, ensure_ascii=True).replace("</", "<\\/")
    return f'''<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>How {esc(s["name"])} works</title>
<meta name="description" content="{esc(s["description"])}">
<link rel="canonical" href="https://harperz9.github.io/repo-explainers/{slug}.html">
<style>
/*CORE_CSS*/
/*KIT_CSS*/
</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top wrap">
  <div class="crumbs"><a href="https://github.com/HarperZ9/{repo}">HarperZ9/{repo}</a><span>Explainer, built from commit <a href="{tree}">{short}</a></span><a href="https://harperz9.github.io/repo-explainers.html">All repository explainers</a><button type="button" class="btn theme" data-theme-toggle>Dark page</button></div>
  <h1>{esc(s["name"])}</h1>
  <p class="lede">{s["lede"]}</p>
</header>
<main id="main">
<section class="block wrap" aria-labelledby="for-you">
  <h2 id="for-you">What it does for you</h2>
  <div class="measure">
    <p>{s["for_you"]}</p>
  </div>
  <ul class="uses">
{uses}
  </ul>
  <p class="src">Source: <a href="{gh(s, "README.md")}">README.md</a> at {short} ({s["version"]})</p>
</section>

{watch_section}<section class="block wrap" aria-labelledby="how">
  <h2 id="how">How it works, one step at a time</h2>
  <p class="measure">{s["how_intro"]}</p>
  <div class="walk">
    <div class="stage-wrap">
      <div class="stage" aria-label="Animated diagram for the current step">
{chr(10).join(scenes)}
      </div>
      <div class="stage-bar">
        <button type="button" class="btn" data-prev>Previous</button>
        <span class="cap" data-cap aria-live="polite"></span>
        <span data-count></span>
        <button type="button" class="btn" data-next>Next</button>
      </div>
    </div>
    <ol class="steps">
{chr(10).join(steps)}
    </ol>
  </div>
</section>

{try_section}

<section class="block wrap" aria-labelledby="limits">
  <h2 id="limits">What it does not do</h2>
  <ul class="limits">
{limits}
  </ul>
  <p class="src">Source: {s["limits_src"]}</p>
</section>

<section class="block wrap recall" aria-labelledby="recall">
  <h2 id="recall">Check what stuck</h2>
  <p class="measure">Answer each one in your head before you open it.</p>
{recall}
</section>
</main>
<footer class="foot wrap">
  <p>Built from <a href="{tree}">HarperZ9/{repo} at {short}</a> ({s["version"]}). The source of this page is <code>docs/explainer/index.html</code> in that repository. {s["license_line"]}</p>
  <p>Zain Dana Harper. <a href="https://harperz9.github.io/repo-explainers.html">More repository explainers</a>.</p>
</footer>
<script>
/*CORE_JS*/
</script>
<script>
window.KSCENES = {data};
</script>
<script>
/*KIT_JS*/
</script>
</body>
</html>
'''


if __name__ == "__main__":
    for slug in sys.argv[1:]:
        s = load(slug)
        (here / "pages" / f"{slug}.src.html").write_text(page(s), encoding="utf-8", newline="\n")
        print("generated", slug, len(s["steps"]), "steps")
