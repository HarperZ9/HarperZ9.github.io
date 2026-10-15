"""Night School's pages, written from the lesson files so the words and numbers on the page are the
film's own: night-school.html (the school and its lessons) and night-school-attention.html (the
pilot lesson: the film, the lab, the full transcript and the sources).

    python -m tools.school.page
"""

from __future__ import annotations

import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCHOOL = ROOT / "media" / "school"
V = "20261015-school-1"
E = html.escape
GUIDE = {"tallow": "Tallow", "pylon": "Pylon", "rerun": "Rerun"}
NUM = {2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten", 11: "Eleven", 12: "Twelve", 13: "Thirteen", 14: "Fourteen", 15: "Fifteen", 16: "Sixteen", 17: "Seventeen", 18: "Eighteen", 19: "Nineteen", 20: "Twenty"}
STATUS = {"ready": "ready", "draft": "film and lab live; narration not recorded yet", "planned": "planned, not made yet"}


def head(rel: str, title: str, desc: str, card: str, alt: str) -> str:
    url = f"https://harperz9.github.io/{rel}"
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Zain Dana Harper">
<meta property="og:title" content="{E(title)}">
<meta property="og:description" content="{E(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="https://harperz9.github.io/{card}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{E(alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://harperz9.github.io/{card}">
<meta name="twitter:image:alt" content="{E(alt)}">
<meta name="color-scheme" content="dark">
<link rel="stylesheet" href="system/system.css?v=20260927-copy-pass">
<link rel="stylesheet" href="system/hubs.css?v=20260925-void-plates">
<link rel="stylesheet" href="system/lessons/lessons.css?v=20261014-lessons">
<link rel="stylesheet" href="system/school/school.css?v={V}">
</head>
<body class="inner-clean hub-plate">
<a class="skip-link" href="#main">Skip to content</a>
<div id="site-nav" class="site-nav"></div>
<noscript><nav class="site-nav"><a href="catalog.html">Catalog</a> <a href="studio.html">The Studio</a> <a href="overview.html">Flagships</a> <a href="research.html">Research</a> <a href="cv.html">About</a></nav></noscript>
<script type="module" src="system/nav.js?v=20260909-pillar-navigation"></script>
"""


def foot(seal: str) -> str:
    return f"""<footer class="footer-seal" role="contentinfo">
  <p class="seal">{E(seal)}</p>
</footer>
<script type="module" src="system/school/launch.mjs?v={V}"></script>
</body>
</html>
"""


def lesson_list(cur: dict) -> str:
    out = []
    for tr in cur["tracks"]:
        items = []
        for le in (x for x in cur["lessons"] if x["track"] == tr["id"]):
            name = f'<a class="inline" href="{le["href"]}">{E(le["title"])}</a>' if le.get("href") else E(le["title"])
            needs = f' <span class="sc-needs">after {", ".join(le["needs"])}</span>' if le["needs"] else ""
            items.append(f'<li class="sc-lesson sc-{le["status"]}"><span class="sc-id">{le["id"]}</span> {name}{needs} <span class="sc-status">{STATUS[le["status"]]}</span></li>')
        out.append(f'<section class="sc-track" aria-labelledby="t-{tr["id"]}"><h3 id="t-{tr["id"]}">{E(tr["title"])}</h3>'
                   f'<p class="sc-place">{E(tr["place"])}, with {GUIDE[tr["guide"]]}</p><ol class="sc-lessons">{"".join(items)}</ol></section>')
    return "\n".join(out)


def school_page(cur: dict, facts: dict) -> str:
    desc = "Night School teaches how AI works, from gradients to GPU kernels, in animated films and labs that run real models in your browser."
    n = len(cur["lessons"])
    k = sum(1 for le in cur["lessons"] if le["status"] != "planned")
    live = "One lesson is" if k == 1 else f"{NUM.get(k, k)} lessons are"
    body = f"""<div class="frame">
  <div class="bar"><span class="nm">Zain Dana Harper</span><span class="rt">night school</span></div>
  <div class="mid">
    <h1>Night School. <span class="g">How AI works, taught on a coast at night.</span></h1>
    <p class="lede">Each lesson is a place on one stretch of coast, with a guide who works there. You watch a short film, then you open the same place in your browser and run the real thing: a tiny model trains in front of you, and every number you see is computed as you watch.</p>
  </div>
</div>

<main id="main">
<section class="mv" id="start" aria-labelledby="start-h">
  <h2 id="start-h">Start here</h2>
  <p class="body-text">New to the maths? Begin with Pylon on the hill above the harbour: <a class="inline" href="night-school-vectors.html">Vectors: a list of numbers is a place</a>, then <a class="inline" href="night-school-matrices.html">Matrices move space</a>, <a class="inline" href="night-school-gradients.html">Gradients</a>, <a class="inline" href="night-school-backprop.html">Backpropagation</a>, <a class="inline" href="night-school-optimisers.html">Optimisers</a> and <a class="inline" href="night-school-heldout.html">The held-out set</a>. All six come back to the attention lesson's small language model, so its numbers carry over.</p>
  <p class="body-text">Then down to the dock, where language models start: <a class="inline" href="night-school-tokens.html">Tokens: cutting text into crates</a> with Pylon, and <a class="inline" href="night-school-embeddings.html">Embeddings: every token gets coordinates</a> with Tallow in the lamp room. Then Tallow's wheel: <a class="inline" href="night-school-nextword.html">Next-word prediction and the loss</a>, and <a class="inline" href="night-school-decoding.html">Decoding: temperature, top-k, top-p</a>. Then the whole machine: <a class="inline" href="night-school-block.html">The transformer block</a> in Tallow's tower, and <a class="inline" href="night-school-trainloop.html">The training loop</a> on Pylon's dock.</p>
  <p class="body-text"><a class="inline" href="night-school-attention.html">Attention: how a language model decides what matters</a>. Tallow keeps the lamp at the top of the lighthouse. A word shines its question back along the sentence, and the earlier words that answer it best get the light. In the lab you train a {facts["nLayers"]}-layer model with {facts["params"]:,} numbers on sentences from the coast and watch its heads learn where to look.</p>
</section>

<section class="mv" id="lessons" aria-labelledby="lessons-h">
  <h2 id="lessons-h">The lessons</h2>
  <p class="body-text">{n} lessons in six tracks, from vectors to fused attention kernels. "After" names the lessons that help first; nothing is locked. {live} live so far; the rest are planned and listed so you can see where this is going.</p>
  {lesson_list(cur)}
</section>

<section class="mv" id="how" aria-labelledby="how-h">
  <h2 id="how-h">How it works</h2>
  <p class="body-text">The films are drawn by the <a class="inline" href="https://github.com/HarperZ9/raw-native">raw-native</a> engine, live in your browser or rendered to video, from the same scene files. The labs train real models in plain JavaScript on your own computer; nothing is sent anywhere. Every claim in a film has its source listed beside the lesson, and every number about a model comes from the trained model's own file.</p>
  <p class="body-text">There are no points, streaks or badges here, and nothing plays the next lesson on its own. Come when you want, learn a thing, and go.</p>
</section>
</main>
"""
    return head("night-school.html", "Night School: how AI works", desc, "img/og/p/night-school.jpg",
                "Night School, by Zain Dana Harper. Fine threads of light arc from one word back to an earlier word along a sentence.") + body + foot("Night School.")


def transcript(film: dict) -> str:
    out = []
    for i, sg in enumerate(film["segments"]):
        qs = {tuple(p["after"]): p["question"] for p in sg.get("predict", [])}
        lines = []
        for j, ln in enumerate(sg["lines"]):
            lines.append(f"<p>{E(ln)}</p>")
            for (lj, _), q in qs.items():
                if lj == j:
                    lines.append(f'<p class="sc-ask">{E(q)} <span>(the film pauses here)</span></p>')
        out.append(f'<h3>{E(sg["heading"])}</h3>{"".join(lines)}')
    return "\n".join(out)


def sources(ev: dict) -> str:
    items = []
    for key, s in ev["sources"].items():
        link = f' <a class="inline" href="{E(s["url"])}">{E(s["url"])}</a>' if s.get("url", "").startswith("http") else ""
        items.append(f'<li><p><strong>{E(s["short"])}.</strong> {E(s["citation"])}{link}</p>'
                     f'<p>Used for: {E(" ".join(s["claims"]))}</p><p class="sc-dnp">Does not prove: {E(s["does_not_prove"])}</p></li>')
    return f'<ul class="sc-sources">{"".join(items)}</ul>'
