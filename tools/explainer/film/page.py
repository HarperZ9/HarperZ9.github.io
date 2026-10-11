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


def starts(f: dict, timing: list) -> list:
    """Each segment's start in seconds: its first spoken sentence, the title at zero."""
    out = [None] * len(f["segments"])
    for row in timing:
        if out[row["segment"]] is None:
            out[row["segment"]] = row["start"]
    out[0] = 0.0
    return [x if x is not None else 0.0 for x in out]


def spoken_line(slug: str, line: str, rows: list) -> str:
    """One script line as its timed sentences, so the transcript can follow the film and seek it.
    Falls back to the plain line if the timing rows do not join back to it exactly."""
    if not rows or " ".join(r["text"] for r in rows) != line:
        return f'<p class="fl-line">{E(line)}</p>'
    spans = " ".join(f'<span class="fl-s" data-t="{r["start"]:.2f}">{E(r["text"])}</span>' for r in rows)
    return f'<p class="fl-line">{spans}</p>'


def source_card(slug: str, k: str, s: dict, heard: tuple) -> str:
    """One source as an evidence card: what it found, on what sample, with what interval, in its own
    words, and what it does not prove. Every field is the checked text of evidence.json."""
    at, seg = heard
    kind = "Peer reviewed" if s.get("peer_reviewed") else "Not peer reviewed"
    quote = (f'<dt>From the source</dt><dd>"{E(s["quote"])}"</dd>' if s["quote"] else "")
    return (f'<li id="{slug}-src-{E(k)}">'
            f'<p class="fl-src-name"><b>{E(s["short"])}</b><span class="fl-src-kind">{kind}</span></p>'
            f'<p class="fl-src-heard"><a class="fl-seek" href="#{slug}" data-seek="{at:.2f}">Heard at {clock(at)}</a>, in {E(seg)}</p>'
            f'<dl class="fl-src-facts"><dt>Found</dt><dd>{E(" ".join(s["claims"]))}</dd>'
            f'<dt>Sample</dt><dd>{E(s["n"])}</dd><dt>Interval</dt><dd>{E(s["interval"])}</dd>{quote}'
            f'<dt class="fl-null">Does not prove</dt><dd class="fl-null">{E(s["does_not_prove"])}</dd></dl>'
            f'<p class="fl-src-cite">{E(s["citation"])} <a class="inline" href="{E(s["url"])}" rel="external noopener">{E(s["url"])}</a></p></li>')


def sound_note(snd: dict | None) -> str:
    """One sentence on the sound, from a receipt's or manifest's "sound" block."""
    if not snd:
        return ""
    bed = ", with no music under the voice" if snd.get("mix") == "C" else ", with a score held well under the voice"
    return (f" Sound: the narration and a few short cues tied to what changes on screen{bed},"
            f" mastered to {snd['integrated_lufs']:.0f} LUFS.")


def film_section(slug: str) -> str:
    x = load(slug)
    f, ev, rec, timing = x["film"], x["evidence"], x["receipt"], x["timing"]
    folder = f"media/explainers/{slug}"
    secs = rec["seconds"]
    at = starts(f, timing)
    heads = "".join(f'<span hidden data-chapter="{E(s["key"])}" data-sources="{E(" ".join(s.get("sources", [])))}">{E(s["heading"])}</span>'
                    for s in f["segments"])
    by_line: dict = {}
    for r in timing:
        by_line.setdefault((r["segment"], r["line"]), []).append(r)
    used, heard = [], {}
    for i, s in enumerate(f["segments"]):
        for k in s.get("sources", []):
            if k not in used:
                used.append(k)
                heard[k] = (at[i], s["heading"])
    transcript = ""
    for i, s in enumerate(f["segments"]):
        refs = ", ".join(f'<a class="inline" href="#{slug}-src-{E(k)}">{E(ev[k]["short"])}</a>' for k in s.get("sources", []))
        transcript += (f'<h4><a class="fl-seek fl-t-at" href="#{slug}" data-seek="{at[i]:.2f}">{clock(at[i])}</a> {E(s["heading"])}</h4>'
                       + (f'<p class="fl-t-src">Source: {refs}</p>' if refs else "")
                       + "".join(spoken_line(slug, line, by_line.get((i, j))) for j, line in enumerate(s["lines"])))
    sources = "".join(source_card(slug, k, ev[k], heard[k]) for k in used)
    static_q = "".join(f'<li data-static>{E(i["prompt"])} ' + " / ".join(E(c["text"]) for c in i["choices"]) + "</li>"
                       for i in x["recall"]["items"])
    nar = rec["narration"]["asr_check"]
    live = interactive(slug, folder, f["title"])
    return f"""
<section class="mv" id="{slug}" aria-labelledby="{slug}-h">
  <h2 id="{slug}-h">{E(f["title"])}</h2>
  <figure class="film" data-film="{slug}" data-folder="{folder}">
    <video controls preload="metadata" playsinline width="1920" height="1080" poster="{folder}/poster.jpg" aria-describedby="{slug}-transcript"><source src="{folder}/{slug}.mp4" type="video/mp4"><track kind="captions" src="{folder}/{slug}.vtt" srclang="en" label="English"></video>
    {heads}
    <figcaption>{clock(secs)}, with captions (CC button) and a transcript. The narration is a synthesized version of the author's voice, made with a speech model fine-tuned on his own recordings. Each sentence was checked against the script by speech recognition: {nar["sentences"]} sentences, {nar["flagged"]} flagged.{sound_note(rec.get("sound"))}</figcaption>
    <div class="fl-recall xl-recall"><h3>Recall questions</h3><ol>{static_q}</ol></div>
  </figure>{live}
  <details id="{slug}-transcript" class="fl-transcript"><summary>Transcript, timed to the film</summary>{transcript}</details>
  <h3 id="{slug}-sources" class="fl-src-h">Sources, with what each one does not prove</h3>
  <div class="fl-src-wrap"><ol class="fl-sources">{sources}</ol></div>
  <p class="fl-receipt">Build record: <a class="inline" href="{folder}/film.receipt.json">film.receipt.json</a> lists the hash of the script, the sources file, the render code and every output.</p>
</section>"""


def film_index() -> str:
    """The shelf under the title: every film with its length, chapters and sources, so a reader
    can choose one before scrolling past five."""
    items = []
    for n, slug in enumerate(FILMS, 1):
        x = load(slug)
        f = x["film"]
        used = {k for s in f["segments"] for k in s.get("sources", [])}
        chapters = len(f["segments"]) - 1
        items.append(f'<li><a href="#{slug}"><img src="media/explainers/{slug}/poster.jpg" alt="" width="320" height="180" loading="lazy" decoding="async">'
                     f'<span class="fl-ix-n">{n:02d}</span><span class="fl-ix-t">{E(f["title"])}</span>'
                     f'<span class="fl-ix-m">{clock(x["receipt"]["seconds"])}, {chapters} chapters, {len(used)} sources</span></a></li>')
    return f'<nav class="fl-index" aria-label="The films"><ol>{"".join(items)}</ol></nav>'


def interactive(slug: str, folder: str, title: str) -> str:
    """The live version, for a film drawn by raw-native's Motion layer (film.scene.mjs)."""
    import re
    scene = ROOT / folder / "film.scene.mjs"
    if not scene.is_file():
        return ""
    m = re.search(r'"\.\./\.\./raw-native/(web-[\w-]+)/motion/', scene.read_text(encoding="utf-8"))
    engine = f"media/raw-native/{m.group(1)}"
    return f"""
  <div class="mf" data-motion-film data-film="{slug}" data-folder="{folder}" data-engine="{engine}" data-label="Interactive film: {E(title)}">
    <h3>Interactive version</h3>
    <p class="body-text">The same film, drawn live in your browser by the <a class="inline" href="https://github.com/HarperZ9/raw-native">raw-native</a> engine from the scene file the video was rendered from. Pause on any frame, scrub, and step one frame at a time. It needs a browser with WebGPU.</p>
  </div>"""


# Media rendered by a repository's release (raw-native ADR 0012): media/releases/<repo>/<tag>/<scene>/,
# copied from the release's media bundle. Each folder holds the video, poster, captions, the facts it
# was drawn from, and an interactive index.html with the engine beside it.
RELEASES = [("raw-native", "v0.6.0", ["ao-check", "first-run"])]


def release_section() -> str:
    items = []
    for repo, tag, scenes in RELEASES:
        for sid in scenes:
            folder = f"media/releases/{repo}/{tag}/{sid}"
            m = json.loads((ROOT / folder / "media.json").read_text(encoding="utf-8"))
            video = next(f for f in m["files"] if f.endswith("-1080p.mp4"))
            vtt = next((f for f in m["files"] if f.endswith(".vtt")), None)
            track = f'<track kind="captions" src="{folder}/{vtt}" srclang="en" label="English">' if vtt else ""
            voice = ("Narrated in a synthesized version of the author's voice." if m.get("narrated")
                     else "Captions only; no narration yet.") + sound_note(m.get("sound"))
            items.append(f"""
  <figure class="film rm">
    <h3>{E(m["title"])}</h3>
    <video controls preload="none" playsinline width="1920" height="1080" poster="{folder}/poster.jpg"><source src="{folder}/{video}" type="video/mp4">{track}</video>
    <figcaption>{clock(m["duration"])}. Rendered by the <a class="inline" href="https://github.com/HarperZ9/{repo}/releases/tag/{tag}">{E(repo)} {E(tag)}</a> release from values read at its commit {E(m["commit"][:7])}: <a class="inline" href="{folder}/facts.json">facts.json</a>. {voice} <a class="inline" href="{folder}/index.html">Open it live</a> to scrub it frame by frame in your browser.</figcaption>
  </figure>""")
    return f"""
<section class="mv" id="release-media" aria-labelledby="release-media-h">
  <h2 id="release-media-h">From the latest releases</h2>
  <p class="body-text">Each release renders its own short films and walkthroughs from its own output, so a number on screen is the number that release produced.</p>{"".join(items)}
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
<link rel="stylesheet" href="system/explainer/film.css?v=20261009-motion">
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
  {film_index()}
</div>

<main id="main">
{films}
<section class="mv" id="how" aria-labelledby="how-h">
  <h2 id="how-h">How the films are built to stick</h2>
  <p class="body-text">Each choice below follows a published result. The sizes come from the papers; the combination of all of them in one film has not itself been tested.</p>
  <ul class="fl-design">{design}</ul>
  <p class="body-text">Your answers and review dates stay in this browser and are never sent anywhere.</p>
</section>

{release_section()}

<section class="mv" id="shorts" aria-labelledby="shorts-h">
  <h2 id="shorts-h">Shorter explainers</h2>
  <ul class="fl-shorts">{shorts}</ul>
</section>
</main>

<footer class="footer-seal" role="contentinfo">
  <p class="seal">Explainers: narrated films with their sources and recall questions.</p>
</footer>
<script type="module" src="system/explainer/film.mjs?v=20261004-films"></script>
<script type="module" src="system/explainer/motion-film.mjs?v=20261009-motion"></script>
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
