"""Write guides.html, and the guide blocks other pages share, from tools/guides/data.py.

    python -m tools.guides.page
"""
from __future__ import annotations

import html
import json
from pathlib import Path

from tools.guides.data import FILM_TITLES, GUIDES, VOICE, by_film, live_films

ROOT = Path(__file__).resolve().parents[2]
E = html.escape
V = "20261012-guides-2"
REF = "Hale, R., &amp; Morrow, J. (2019). Signal decay in peer networks. <i>Journal of Applied Inference</i>, 12(3), 44-61."


def film_link(slug: str, prefix: str = "") -> str:
    href = f"{prefix}explainers.html#{slug}"
    return f'<a class="inline" href="{href}">{E(FILM_TITLES[slug])}</a>'


def transcript(g: dict) -> str:
    rows = json.loads((ROOT / "media" / "guides" / g["id"] / "intro.timing.json").read_text(encoding="utf-8"))
    return " ".join(E(r["text"]) for r in rows)


def intro_figure(g: dict, prefix: str = "") -> str:
    m = f"{prefix}media/guides/{g['id']}"
    return (f'<figure class="gd-intro" id="gd-intro-{g["id"]}" hidden>'
            f'<video controls preload="none" playsinline width="1280" height="720" poster="{m}/intro.jpg">'
            f'<source src="{m}/intro.mp4" type="video/mp4"><track kind="captions" src="{m}/intro.vtt" srclang="en" label="English"></video>'
            f'<figcaption>{E(g["name"])}, introduced. {E(VOICE)} Transcript: {transcript(g)}</figcaption></figure>')


def intro_button(g: dict) -> str:
    return (f'<button type="button" class="gd-btn" data-gd-intro aria-controls="gd-intro-{g["id"]}" aria-expanded="false">'
            f'Hear {E(g["name"])} ({g["intro_s"]} s, sound and captions)</button>')


def card(g: dict, prefix: str = "", heading: str = "h3", link: bool = True) -> str:
    m = f"{prefix}media/guides/{g['id']}"
    name = f'<a href="{prefix}guides.html#{g["id"]}">{E(g["name"])}</a>' if link else E(g["name"])
    hosts = " and ".join(film_link(f, prefix) for f in live_films(g))
    return (f'<li class="gd-card" id="{g["id"] if not link else "gd-" + g["id"]}">'
            f'<span class="gd-frame" data-gd-loop="{m}/idle.mp4"><img src="{m}/still.jpg" width="960" height="540" alt="{E(g["alt"])}" loading="lazy" decoding="async"></span>'
            f'<div><{heading}>{name}, {E(g["title"])}</{heading}>'
            f'<p class="gd-role">{E(g["role"])} {E(g["habit"])}</p>'
            f'<p class="gd-meta">Home style: {E(g["style"])}. Hosts {hosts}.</p>'
            f'<div class="gd-actions">{intro_button(g)}</div>{intro_figure(g, prefix)}</div></li>')


def cast(prefix: str = "", heading: str = "h3", link: bool = True) -> str:
    return f'<ul class="gd-cast">{"".join(card(g, prefix, heading, link) for g in GUIDES)}</ul>'


def host_line(slug: str, prefix: str = "") -> str:
    """The host strip at the head of a film or a block of films."""
    g = by_film(slug)
    return (f'<aside class="gd-host" aria-label="Host"><img src="{prefix}media/guides/{g["id"]}/close.jpg" width="480" height="480" alt="{E(g["close_alt"])}" loading="lazy" decoding="async">'
            f'<p>Hosted by <a href="{prefix}guides.html#{g["id"]}">{E(g["name"])}, {E(g["title"])}</a>. {E(g["role"])}</p></aside>')


def your_call(prefix: str = "") -> str:
    r = next(g for g in GUIDES if g["id"] == "rerun")
    choices = "".join(f'<button type="button" class="gd-btn" data-gd-choice="{c}" aria-pressed="false">{c}</button>'
                      for c in ("It exists", "It does not", "I can't tell from the page"))
    return (f'<div class="gd-call" data-gd-call>'
            f'<div><blockquote class="gd-ref"><cite>{REF}</cite></blockquote>'
            f'<p class="gd-call-q">Does this work exist? Your call.</p><div class="gd-actions">{choices}</div>'
            f'<p class="gd-answer" hidden aria-live="polite">Your answer: <span data-gd-said></span>. Rerun knocks, and the shell rings hollow: '
            f'this reference was made up for the first film, and nothing on the page gives that away. Only a search tells. In the study the film '
            f'follows, 55% of GPT-3.5\'s 222 references and 18% of GPT-4\'s 414 did not exist. The first film, hosted by Tallow, shows the search: '
            f'{film_link("checking-cost", prefix)}</p></div>'
            f'<span class="gd-frame" data-gd-action="{prefix}media/guides/rerun/action.mp4"><img src="{prefix}media/guides/rerun/close.jpg" width="480" height="480" '
            f'alt="{E(r["close_alt"])} When you answer, Rerun knocks on a shell and it rings hollow." loading="lazy" decoding="async" style="object-fit:contain"></span></div>')


def faces() -> str:
    """Three portraits under the title, each a link to its guide."""
    return '<ul class="gd-faces">' + "".join(
        f'<li><a href="#{g["id"]}"><img src="media/guides/{g["id"]}/close.jpg" width="480" height="480" alt="{E(g["close_alt"])}" decoding="async"><span>{E(g["name"])}</span></a></li>'
        for g in GUIDES) + "</ul>"


def page() -> str:
    desc = "Tallow, Pylon and Rerun host the explainer films: who they are, what each one stands for, and their introductions."
    sheets = "".join(f'<figure class="gd-sheet"><img src="media/guides/{g["id"]}/sheet.jpg" width="1280" height="720" alt="{E(g["name"])} from every side, in the poses the films use." loading="lazy" decoding="async"></figure>'
                     for g in GUIDES)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The guides: Tallow, Pylon and Rerun</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="https://harperz9.github.io/guides.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Zain Dana Harper">
<meta property="og:title" content="The guides: Tallow, Pylon and Rerun">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="https://harperz9.github.io/guides.html">
<meta property="og:image" content="https://harperz9.github.io/media/guides/pylon/still.jpg">
<meta property="og:image:alt" content="{E(GUIDES[1]["alt"])}">
<meta name="twitter:card" content="summary_large_image">
<meta name="color-scheme" content="dark">
<link rel="stylesheet" href="system/system.css?v=20260927-copy-pass">
<link rel="stylesheet" href="system/hubs.css?v=20260925-void-plates">
<link rel="stylesheet" href="system/guides.css?v={V}">
</head>
<body class="inner-clean hub-plate">
<a class="skip-link" href="#main">Skip to content</a>
<div id="site-nav" class="site-nav"></div>
<noscript><nav class="site-nav"><a href="catalog.html">Catalog</a> <a href="studio.html">The Studio</a> <a href="overview.html">Flagships</a> <a href="research.html">Research</a> <a href="cv.html">About</a></nav></noscript>
<script type="module" src="system/nav.js?v=20260909-pillar-navigation"></script>

<div class="frame">
  <div class="bar"><span class="nm">Zain Dana Harper</span><span class="rt">guides</span></div>
  <div class="mid">
    <h1>The guides. <span class="g">Three hosts for the films.</span></h1>
    <p class="lede">Tallow, Pylon and Rerun host the <a class="inline" href="explainers.html">explainer films</a>. Each one carries an idea from the films in its body, asks what you think before it shows you, and leaves the decision to you.</p>
    {faces()}
  </div>
</div>

<main id="main">
<section class="mv" id="cast" aria-labelledby="cast-h">
  <h2 id="cast-h">Meet them</h2>
  {cast(heading="h3", link=False)}
</section>

<section class="mv" id="your-call" aria-labelledby="your-call-h">
  <h2 id="your-call-h">Your call</h2>
  <p class="body-text">The first film opens with this reference. Decide before you look anything up.</p>
  {your_call()}
</section>

<section class="mv" id="how" aria-labelledby="how-h">
  <h2 id="how-h">How they host</h2>
  <p class="body-text">A guide asks, waits and shows the source. It never makes the call for you. Nothing here keeps score, and nothing plays the next thing on its own.</p>
  <p class="body-text">They introduce and host the films on this site; they do not appear inside the films yet. Each hosts the films closest to its home style: Tallow the ones lit by a single light in the dark, Pylon the ones laid out like a map or a printed page, and Rerun the one built from grids where one dot is one thing. Rerun, whose shell carries its receipts, also hosts the release films, which each release renders from its own output.</p>
  <p class="body-text">Beside each film, its guide also hosts something to play with: <a class="inline" href="explainers.html#checking-cost-play">Night Shift</a>, one night at the claims desk with Tallow; <a class="inline" href="explainers.html#passing-check-play">Check the check</a> with Rerun; <a class="inline" href="explainers.html#rederive-play">Run it again</a> and <a class="inline" href="explainers.html#incentives-play">What gets paid</a> with Pylon; and <a class="inline" href="explainers.html#visible-reasoning-play">Slip in a hint</a> with Tallow. Each loads only when you press it, ends or rests on its own terms, and keeps no score.</p>
  <p class="body-text">They were drawn, rigged and animated with the <a class="inline" href="https://github.com/HarperZ9/raw-native">raw-native</a> engine. {E(VOICE)}</p>
  <div class="gd-sheets">{sheets}</div>
</section>
</main>

<footer class="footer-seal" role="contentinfo">
  <p class="seal">The guides: Tallow, Pylon and Rerun.</p>
</footer>
<script type="module" src="system/guides.mjs?v={V}"></script>
</body>
</html>
"""


def main() -> None:
    (ROOT / "guides.html").write_text(page(), encoding="utf-8", newline="\n")
    from tools.repo_art import site_cards  # point the head tags at the page's own link card
    site_cards.stamp(next(c for c in site_cards.plan() if c["rel"] == "guides.html"))
    print("guides.html written")


if __name__ == "__main__":
    main()
