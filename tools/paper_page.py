"""The page around a philosophy paper: masthead, revision note, corrections and footer.

tools/render_papers.py supplies the rendered body. The dated corrections of 3 October 2026
(tools/correction_batch.py) were made to the earlier edition of two papers; they stay on those
pages as their history, beside the edition that now carries the corrected wording.
"""

from __future__ import annotations

import html
try:
    from tools.og_card import card_tags
except ImportError:  # run as a script from tools/
    from og_card import card_tags

EARLIER_CORRECTIONS: dict[str, list[str]] = {
    "research-conferred-existence.html": [
        "3 October 2026, correction, Movement I: an earlier version credited the lamp argument to Candrakirti. "
        "The argument that a lamp does not light itself is Nagarjuna's, in chapter 7 of the "
        "<em>Mulamadhyamakakarika</em>. Candrakirti later pressed the point against self-aware consciousness.",
        "3 October 2026, correction, Movement I: the Qur'an 36:82 quotation named no translation. It now follows "
        "Saheeh International. The <em>Shabbat</em> 55a line now matches the Davidson English in full, and the page "
        "no longer calls it the canonical anchor of the golem legend. The <em>emet</em> and <em>met</em> form of the "
        "legend comes from later folklore: a medieval story of Jeremiah and Ben Sira, and the seventeenth-century "
        "accounts of Elijah of Chelm.",
        "3 October 2026, correction, Movement I: an earlier version called the re-creation of the world at every "
        "instant al-Ghazali's teaching. That cosmology belongs to the Ash'arite school founded by al-Ash'ari. "
        "Al-Ghazali defends occasionalism as one option in the seventeenth discussion of <em>The Incoherence of the "
        "Philosophers</em>, beside an account with secondary causes.",
        "3 October 2026, correction, Movement II: an earlier version credited history written by the victors to "
        "Walter Benjamin. Benjamin does not say this. His seventh thesis on history says the historian who "
        "empathizes with the victor serves whoever rules now. The page now cites that thesis for the image.",
    ],
    "research-conservation-of-faithfulness.html": [
        '3 October 2026, correction, References: an earlier version quoted Bateson as "the difference that makes a '
        'difference". His words are "a difference which makes a difference", from "Form, Substance, and Difference" '
        "in <em>Steps to an Ecology of Mind</em>.",
        '3 October 2026, correction, References: an earlier version glossed Page (1993) as "the Page curve: '
        'information conserved and scrambled". Page assumes black-hole evaporation is unitary and estimates how '
        'slowly information leaves in the radiation. "Scrambling" comes from Sekino and Susskind (2008). Hayden and '
        "Preskill (2007) describe information that stays concealed until the half-way point.",
    ],
}

STYLE = """<style>
  /* The register marks are reader-facing structure: what is stated plainly, what is set
     against its strongest contrary, and what is handed to the reader. They are set in the
     mono face, in ink, so they read as labels and carry no verdict colour. */
  .register{font-family:var(--font-mono);font-size:.8em;letter-spacing:.03em;color:var(--ink-soft)}
  .revision-note{border-left:1px solid var(--rule-strong);padding:.1rem 0 .1rem 1rem;margin:1.2rem 0 1.8rem;max-width:var(--measure)}
  .paper-table{overflow-x:auto;max-width:100%;margin:.4rem 0 1.2rem}
  .paper-rule{border:0;border-top:1px solid var(--rule);margin:2rem 0 1.4rem;max-width:var(--measure)}
  .sheet h2{margin-top:2.2rem}
  .sheet h3{margin-top:1.6rem}
  blockquote{margin:1rem 0 1.2rem;padding:0 0 0 1rem;border-left:1px solid var(--rule-strong);color:var(--ink-muted);max-width:var(--measure)}
</style>"""

HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} &middot; Zain Dana Harper</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="https://harperz9.github.io/{name}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Zain Dana Harper">
<meta property="og:title" content="{title} &middot; Zain Dana Harper">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="https://harperz9.github.io/{name}">
{card}
<meta property="article:modified_time" content="2026-10-03">
<meta name="twitter:title" content="{title} &middot; Zain Dana Harper">
<meta name="twitter:description" content="{desc}">
<link rel="stylesheet" href="system/doc.css?v=20260907-reading-completion">
{style}
</head>
<body class="doc">
<a class="skip-link" href="#main">Skip to content</a>

<div id="site-nav" class="site-nav"></div>
<noscript><nav class="site-nav"><a href="catalog.html">Catalog</a> <a href="studio.html">The Studio</a> <a href="overview.html">Flagships</a> <a href="research.html">Research</a> <a href="resume.html">Resume</a> <a href="portfolio.html">Portfolio</a> <a href="cover-letter.html">Cover Letter</a> <a href="cv.html">About</a></nav></noscript>
<script type="module" src="system/nav.js?v=20260909-pillar-navigation"></script>

<div class="docnav">
  <span class="where">Research &middot; {kind_lower}</span>
  <span class="switch"><a href="research.html">Research program</a><a href="publications.html#research">All notes and papers</a><a href="{name}" aria-current="page">{nav}</a></span>
</div>

<main id="main">
<article class="sheet">

  <header class="mast">
    <p class="role" style="margin-bottom:.55rem">{kind} &middot; edition of 3 October 2026</p>
    <h1>{title}</h1>
{subtitle}    <p class="contact">
      <span>Zain Dana Harper</span><span class="sep">/</span>
      <span>{byline}</span><span class="sep">/</span>
      <a class="inline" href="{pdf}">Download PDF</a>
    </p>
  </header>
"""


def doi_link(doi: str) -> str:
    return f'<a class="inline" href="https://doi.org/{doi}" rel="noopener" translate="no">doi:{doi}</a>'


def revision(spec: dict, note: str) -> str:
    parts = [f"<b>Revised 3 October 2026.</b> {html.escape(note, quote=False)}"]
    if "doi" in spec:
        parts.append(f"This edition is deposited at Zenodo, {doi_link(spec['doi'])}.")
    if "supplement" in spec:
        doi, label = spec["supplement"]
        parts.append(f"It builds on {label}, which stays citable at its own Zenodo record, {doi_link(doi)}.")
    if "prior" in spec:
        doi, label = spec["prior"]
        parts.append(f"The prior version, {label}, stays citable at its Zenodo record, {doi_link(doi)}.")
    if "note_pdf" in spec:
        path, label = spec["note_pdf"]
        parts.append(f'The PDF of {label} is <a class="inline" href="{path}">here</a>.')
    if "related" in spec:
        doi, label, route = spec["related"]
        parts.append(f'This paper argues from <a class="inline" href="{route}">{label}</a>, {doi_link(doi)}.')
    return f'  <aside class="revision-note" id="revision"><p class="entry-note">{" ".join(parts)}</p></aside>\n'


def corrections(notes: list[str]) -> str:
    if not notes:
        return ""
    opening = ("<p>These corrections were made to the earlier edition on 3 October 2026. "
               "This edition carries the corrected wording.</p>")
    items = "\n".join(f'    <p class="lead">{note}</p>' for note in notes)
    return f'  <section id="corrections">\n    <h2>Corrections</h2>\n    {opening}\n{items}\n  </section>\n'


def page(name: str, spec: dict, fields: dict[str, str], body: str, notes: list[str]) -> str:
    esc = lambda text: html.escape(text, quote=True)  # noqa: E731
    subtitle = fields.get("subtitle", "").strip().strip("*")
    sub_html = (f'    <p class="role" style="color:var(--ink-soft);text-transform:none;letter-spacing:.01em;'
                f'font-size:.92rem;margin:.55rem 0 .85rem">{html.escape(subtitle, quote=False)}</p>\n'
                if subtitle else "")
    head = HEAD.format(
        title=esc(fields["title"]), desc=esc(fields["description"]), name=name, style=STYLE,
        kind=spec["kind"], kind_lower=spec["kind"].lower(), nav=esc(spec["nav"]),
        subtitle=sub_html, byline=html.escape(fields["byline"], quote=False), pdf=spec["pdf"],
        card=card_tags(name, fields["title"]),
    )
    source = spec["source"]
    stem = spec["pdf"].removeprefix("papers/").removesuffix(".pdf")
    footer = (f'  <p class="note">Rendered from the approved source <span translate="no">{source}</span> by '
              '<span translate="no">tools/render_papers.py</span>. The PDF is typeset with LaTeX from the same '
              f'source, so the two carry the same text. Its <a class="inline" href="papers/tex/{stem}.tex">LaTeX '
              f'file</a> and <a class="inline" href="papers/receipts/{stem}.json">build receipt</a> let anyone '
              'rebuild it and compare the hash. '
              '<a class="inline" href="research.html">Back to the research program</a>.</p>\n')
    return (head + "\n" + revision(spec, fields["revision_note"]) + "\n" + body + "\n\n"
            + corrections(notes) + "\n" + footer + "\n</article>\n</main>\n</body>\n</html>\n")
