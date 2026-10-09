"""Write explainers.html from each film's script, sources, timing and questions.

    python -m tools.explainer.film.page

The transcript, chapter names, sources and the no-script copy of every question come from the
same files the film was rendered from, so the page cannot drift from the video.
"""

from __future__ import annotations

import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FILMS = ["checking-cost", "passing-check", "rederive", "incentives", "visible-reasoning"]
SHORTS = [("cost-to-verify", "The cost to verify", "no-receipt-no-accept.html#explainer-cost-to-verify", "42 s"),
          ("receipt-is-not-a-verdict", "A receipt is not a verdict", "no-receipt-no-accept.html#explainer-receipt-is-not-a-verdict", "43 s"),
          ("receipt-loop", "From a proposed answer to a kept receipt", "flywheel.html#explainer-receipt-loop", "65 s")]
E = html.escape

DESIGN = [
    ("Retrieval, not rereading.", "Each film stops to ask you to recall what it just showed. In a classic study, students who were tested on a passage recalled 56% of it a week later, against 42% for students who reread it; rereading won only on a test five minutes later.",
     "Roediger and Karpicke 2006, Psychological Science", "https://doi.org/10.1111/j.1467-9280.2006.01693.x"),
    ("Questions inside the video.", "Short tests between segments of a recorded lecture raised scores on the last segment from 59% to 84% in one experiment of 32 students.",
     "Szpunar, Khan and Schacter 2013, PNAS", "https://doi.org/10.1073/pnas.1221764110"),
    ("Review after a gap.", "Your answers schedule a review days later. For tests weeks away, the best gap between study sessions was about a fifth of the time to the test, in a study that taught 1,354 learners.",
     "Cepeda et al. 2008, Psychological Science", "https://doi.org/10.1111/j.1467-9280.2008.02209.x"),
    ("Feedback that names the mistake.", "A wrong choice is told which misconception it matches. In a study of 72 students, feedback after a multiple-choice test raised later recall from .31 without feedback to .45 or more with it.",
     "Butler and Roediger 2008, Memory and Cognition", "https://doi.org/10.3758/MC.36.3.604"),
    ("One idea per chapter, signposted.", "Segmenting, signaling and keeping words next to the picture they describe are among the multimedia principles with positive effects in a review of 29 meta-analyses. We read its abstract, not its effect sizes.",
     "Noetel et al. 2022, Review of Educational Research", "https://doi.org/10.3102/00346543211052329"),
    ("Short enough to finish.", "Across 6.9 million viewing sessions, median watching time stayed at six minutes or less however long the video was. That measures attention, not learning, so the films stay under five minutes.",
     "Guo, Kim and Rubin 2014, Learning at Scale", "https://doi.org/10.1145/2556325.2566239"),
]


def load(slug: str) -> dict:
    d = ROOT / "media" / "explainers" / slug
    rd = lambda n: json.loads((d / n).read_text(encoding="utf-8"))
    return {"film": rd("film.json"), "evidence": rd("evidence.json")["sources"], "timing": rd("timing.json"),
            "recall": rd("recall.json"), "receipt": rd("film.receipt.json")}


def clock(s: float) -> str:
    return f"{int(s // 60)}:{int(s % 60):02d}"


def film_section(slug: str) -> str:
    x = load(slug)
    f, ev, rec = x["film"], x["evidence"], x["receipt"]
    folder = f"media/explainers/{slug}"
    secs = rec["seconds"]
    heads = "".join(f'<span hidden data-chapter="{E(s["key"])}">{E(s["heading"])}</span>' for s in f["segments"])
    transcript = "".join(f'<h4>{E(s["heading"])}</h4>' + "".join(f"<p>{E(line)}</p>" for line in s["lines"])
                         for s in f["segments"])
    used = []
    for s in f["segments"]:
        used += [k for k in s.get("sources", []) if k not in used]
    sources = "".join(
        f'<li><p><b>{E(ev[k]["short"])}</b>. {E(ev[k]["citation"])} <a class="inline" href="{E(ev[k]["url"])}" rel="external noopener">{E(ev[k]["url"])}</a></p>'
        f'<p>{E(" ".join(ev[k]["claims"]))} Sample: {E(ev[k]["n"])}. Interval: {E(ev[k]["interval"])}</p>'
        + (f'<p>From the source: "{E(ev[k]["quote"])}"</p>' if ev[k]["quote"] else "")
        + f'<p>What it does not prove: {E(ev[k]["does_not_prove"])}</p></li>' for k in used)
    static_q = "".join(f'<li data-static>{E(i["prompt"])} ' + " / ".join(E(c["text"]) for c in i["choices"]) + "</li>"
                       for i in x["recall"]["items"])
    nar = rec["narration"]["asr_check"]
    return f"""
<section class="mv" id="{slug}" aria-labelledby="{slug}-h">
  <h2 id="{slug}-h">{E(f["title"])}</h2>
  <figure class="film" data-film="{slug}" data-folder="{folder}">
    <video controls preload="metadata" playsinline width="1920" height="1080" poster="{folder}/poster.jpg" aria-describedby="{slug}-transcript"><source src="{folder}/{slug}.mp4" type="video/mp4"><track kind="captions" src="{folder}/{slug}.vtt" srclang="en" label="English"></video>
    {heads}
    <figcaption>{clock(secs)}, with captions (CC button) and a transcript. The narration is a synthesized version of the author's voice, made with a speech model fine-tuned on his own recordings. Each sentence was checked against the script by speech recognition: {nar["sentences"]} sentences, {nar["flagged"]} flagged.</figcaption>
    <div class="fl-recall xl-recall"><h3>Recall questions</h3><ol>{static_q}</ol></div>
  </figure>
  <details id="{slug}-transcript"><summary>Transcript</summary>{transcript}</details>
  <h3 id="{slug}-sources">Sources, with what each one does not prove</h3>
  <ol class="fl-sources">{sources}</ol>
  <p class="fl-receipt">Build record: <a class="inline" href="{folder}/film.receipt.json">film.receipt.json</a> lists the hash of the script, the sources file, the render code and every output.</p>
</section>"""


def page() -> str:
    films = "".join(film_section(s) for s in FILMS)
    shorts = "".join(f'<li><a class="inline" href="{E(href)}">{E(title)}</a>, {E(length)}</li>' for _, title, href, length in SHORTS)
    design = "".join(f'<li><p><b>{E(h)}</b> {E(t)} <a class="inline" href="{E(u)}" rel="external noopener">{E(c)}</a>.</p></li>'
                     for h, t, c, u in DESIGN)
    desc = "Short narrated films on the ideas behind the work, with every number sourced on screen and recall questions with spaced review."
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Explainers, films that show their sources</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="https://harperz9.github.io/explainers.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Zain Dana Harper">
<meta property="og:title" content="Explainers, films that show their sources">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="https://harperz9.github.io/explainers.html">
<meta property="og:image" content="https://harperz9.github.io/media/explainers/checking-cost/poster.jpg">
<meta property="og:image:alt" content="A frame from the film: two grids of dots, one per chatbot, with the references that do not exist marked.">
<meta name="twitter:card" content="summary_large_image">
<meta name="color-scheme" content="dark">
<link rel="stylesheet" href="system/system.css?v=20260927-copy-pass">
<link rel="stylesheet" href="system/hubs.css?v=20260925-void-plates">
<link rel="stylesheet" href="system/explainer/explainer.css?v=20261003-explainers">
<link rel="stylesheet" href="system/explainer/film.css?v=20261004-films">
</head>
<body class="inner-clean hub-plate">
<a class="skip-link" href="#main">Skip to content</a>
<div id="site-nav" class="site-nav"></div>
<noscript><nav class="site-nav"><a href="catalog.html">Catalog</a> <a href="studio.html">The Studio</a> <a href="overview.html">Flagships</a> <a href="research.html">Research</a> <a href="cv.html">About</a></nav></noscript>
<script type="module" src="system/nav.js?v=20260909-pillar-navigation"></script>

<div class="frame">
  <div class="bar"><span class="nm">Zain Dana Harper</span><span class="rt">explainers</span></div>
  <div class="mid">
    <h1>Explainers. <span class="g">Every number has a source.</span></h1>
    <p class="lede">Short films on the ideas behind the work. Each one teaches one idea through a concrete case, puts every number it says on screen with its source, and stops to ask you to recall what you saw.</p>
  </div>
</div>

<main id="main">
{films}
<section class="mv" id="how" aria-labelledby="how-h">
  <h2 id="how-h">How the films are built to stick</h2>
  <p class="body-text">Each choice below follows a published result. The sizes come from the papers; the combination of all of them in one film has not itself been tested.</p>
  <ul class="fl-design">{design}</ul>
  <p class="body-text">Your answers and review dates stay in this browser and are never sent anywhere.</p>
</section>

<section class="mv" id="shorts" aria-labelledby="shorts-h">
  <h2 id="shorts-h">Shorter explainers</h2>
  <ul class="fl-shorts">{shorts}</ul>
</section>
</main>

<footer class="footer-seal" role="contentinfo">
  <p class="seal">Explainers: narrated films with their sources and recall questions.</p>
</footer>
<script type="module" src="system/explainer/film.mjs?v=20261004-films"></script>
</body>
</html>
"""


def main() -> None:
    (ROOT / "explainers.html").write_text(page(), encoding="utf-8", newline="\n")
    from tools.repo_art import site_cards  # point the head tags at the page's own link card
    site_cards.stamp(next(c for c in site_cards.plan() if c["rel"] == "explainers.html"))
    print("explainers.html written")


if __name__ == "__main__":
    main()
