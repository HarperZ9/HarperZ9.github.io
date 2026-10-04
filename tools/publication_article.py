"""The generated article page for a full publication record.

Moved out of build_publications.py so the builder stays a builder. The page mounts the
shared site menu (system/nav.js) like every hand-written page, and carries the back-link
line from publications/data/sections.json under it, so a rebuild keeps both.
"""

from __future__ import annotations

import html
try:
    from tools.og_card import card_tags
except ImportError:  # run as a script from tools/
    from og_card import card_tags
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE_URL = "https://harperz9.github.io/"
ASSET_REVISION = "20260925-void-plates"
COVER_ALT_PATH = ROOT / "art" / "aperture" / "covers.json"


def _cover_figure(record_id: str) -> str:
    """The record's aperture cover, when the art family has one, with its shared alt text."""
    slug = f"cover-{record_id}"
    if not (ROOT / "art" / "aperture" / f"{slug}-light.svg").is_file() or not COVER_ALT_PATH.is_file():
        return ""
    alt = json.loads(COVER_ALT_PATH.read_text(encoding="utf-8"))["alt"].get(slug)
    if not alt:
        return ""
    alt = html.escape(alt, quote=True)
    return (
        '<figure class="art art-cover">'
        f'<img class="art-light" src="art/aperture/{slug}-light.svg" width="1600" height="800" alt="{alt}" loading="lazy" decoding="async">'
        f'<img class="art-dark" src="art/aperture/{slug}-dark.svg" width="1600" height="800" alt="{alt}" loading="lazy" decoding="async">'
        "</figure>"
    )


def _table_cell(figure: dict, index: int, value: str) -> str:
    """One body cell: the row key as a row header, every other cell labelled by its column."""
    label = html.escape(figure["columns"][index], quote=True)
    result = ' data-result=""' if figure["columns"][index] == figure.get("resultColumn") else ""
    tag = 'th scope="row"' if index == 0 else "td"
    close = "th" if index == 0 else "td"
    return f'<{tag} data-label="{label}"{result}>{html.escape(value)}</{close}>'


def _render_table(figure: dict) -> str:
    """The figure's data table, marked up so a phone can stack it into labelled records.

    Every cell carries its column as data-label; the table carries data-stack. A table whose
    row keys are all four characters or fewer (S2, S7) is marked data-key="short", and the
    column the record names as resultColumn carries data-result.
    """
    result_column = figure.get("resultColumn")
    result_mark = ' data-result=""'
    headings = "".join(
        f'<th scope="col"{result_mark if value == result_column else ""}>{html.escape(value)}</th>'
        for value in figure["columns"]
    )
    rows = "".join(
        "<tr>" + "".join(_table_cell(figure, index, value) for index, value in enumerate(row)) + "</tr>"
        for row in figure["rows"]
    )
    short = all(len(row[0]) <= 4 for row in figure["rows"])
    key = ' data-key="short"' if short else ""
    return (
        '<div class="publication-table-wrap" role="region" tabindex="0" aria-label="Figure data">'
        f'<table class="publication-figure-table" data-stack{key}>'
        f"<caption>{html.escape(figure['title'])}. {html.escape(figure['claim'])}</caption>"
        f"<thead><tr>{headings}</tr></thead><tbody>{rows}</tbody></table></div>"
    )


def _render_figure_metadata(figure: dict) -> str:
    """The record under the table. What the figure does not prove comes first and is named."""
    pairs = (
        ("Scope", figure["scope"]),
        ("Units", figure["units"]),
        ("Denominator", figure["denominator"]),
        ("Date", figure["date"]),
        ("Transformation", figure["transformation"]),
        ("Uncertainty", figure["uncertainty"]),
        ("Limitations", figure["limitations"]),
    )
    does_not_prove = html.escape(figure["doesNotProve"])
    return (
        '<dl class="publication-evidence">'
        '<dt data-term="does-not-prove">Does not prove</dt>'
        f'<dd data-term="does-not-prove">{does_not_prove}</dd>'
        + "".join(f"<dt>{html.escape(label)}</dt><dd>{html.escape(value)}</dd>" for label, value in pairs)
        + "</dl>"
    )

def _source_publication_label(source: dict) -> str:
    published_at = source["published_at"]
    if published_at is None:
        return "Publication date unavailable"
    return f"Published {published_at}"

def _render_figure_in_article(figure: dict) -> str:
    return (
        f'<section class="publication-figure" id="figure-{html.escape(figure["id"])}">'
        f'<h2>{html.escape(figure["title"])}</h2>'
        f'<p>{html.escape(figure["claim"])}</p>'
        f'<img src="figures/{html.escape(figure["id"])}.svg" alt="{html.escape(figure["alt"], quote=True)}">'
        f'<p class="publication-figure-limit"><strong>What this cannot show.</strong> {html.escape(figure["doesNotProve"])}</p>'
        '<details class="publication-figure-detail"><summary>Read the data and method</summary>'
        + _render_table(figure)
        + _render_figure_metadata(figure)
        + f'<p><a href="figures/{html.escape(figure["id"])}.html">Open the figure and its sources</a></p>'
        + "</details></section>"
    )


NAV_SCRIPT = "system/nav.js?v=20260909-pillar-navigation"
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December")


def _human_date(value: str) -> str:
    year, month, day = value.split("-")
    return f"{int(day)} {MONTHS[int(month) - 1]} {year}"


def _dateline(record: dict) -> str:
    line = f'By {html.escape(record["author"])} · Published <time datetime="{record["published_at"]}">{_human_date(record["published_at"])}</time>'
    if record["updated_at"] != record["published_at"]:
        line += f' · Updated <time datetime="{record["updated_at"]}">{_human_date(record["updated_at"])}</time>'
    return line


def _source_details(record: dict, review_materials: tuple[str, ...]) -> str:
    """Machine records for checking sit in one closed disclosure at the foot of the page."""
    links = [
        f'<a href="publications/data/records/{html.escape(record["id"], quote=True)}.json">Publication record (JSON)</a>'
    ]
    for name, label in (("essay.md", "Manuscript"), ("source-map.json", "Source map")):
        if name in review_materials:
            links.append(f'<a href="writing/{html.escape(record["id"], quote=True)}/{name}">{label}</a>')
    return (
        '<details class="publication-source-record" data-print="closed"><summary>Source record for checking</summary>'
        "<p>The structured record this page is built from: every claim, source and figure value, "
        "in a form a reader can check by machine.</p>"
        '<nav aria-label="Review material">' + " · ".join(links) + "</nav></details>"
    )


def render_article(
    record: dict,
    *,
    review_materials: tuple[str, ...] = (),
    placement: dict | None = None,
) -> str:
    """placement carries the back-link line, kind word and topic from sections.json."""
    placement = placement or {}
    kind = placement.get("kind") or record["form"]
    topic = placement.get("topic") or record["category"].replace("-", " ")
    canonical = SITE_URL + record["route"]
    contents = "".join(
        f'<li><a href="#{html.escape(section["id"], quote=True)}">{html.escape(section["heading"])}</a></li>'
        for section in record["sections"]
    )
    opening = "".join(
        f'<p class="publication-opening-{key}"><strong>{label}.</strong> {html.escape(record["opening"][key])}</p>'
        for key, label in (
            ("question", "Question"),
            ("finding", "Finding"),
            ("evidence", "Evidence"),
            ("limit", "Limit"),
        )
    )
    sections = "".join(
        f'<section id="{html.escape(section["id"])}"><h2>{html.escape(section["heading"])}</h2>'
        + "".join(f"<p>{html.escape(paragraph)}</p>" for paragraph in section["paragraphs"])
        + "</section>"
        for section in record["sections"]
    )
    figures = "".join(_render_figure_in_article(figure) for figure in record["figures"])
    sources = "".join(
        f'<li id="source-{html.escape(source["id"])}"><a href="{html.escape(source["url"], quote=True)}" rel="external noopener">{html.escape(source["title"])}</a>. '
        f'{html.escape(source["publisher"])}. {html.escape(source["role"])}. {html.escape(_source_publication_label(source))}; observed {html.escape(source["observed_at"])}.</li>'
        for source in record["sources"]
    )
    claim_notes = "".join(
        f'<li><p><strong>{html.escape(claim["text"])}</strong></p>'
        f'<p class="publication-meta">{html.escape(claim["id"])} · {html.escape(claim["status"])}</p>'
        '<p>Sources: '
        + ", ".join(f'<a href="#source-{html.escape(source_id, quote=True)}">{html.escape(source_id)}</a>' for source_id in claim["source_ids"])
        + f'</p><dl class="publication-evidence"><dt>Scope</dt><dd>{html.escape(claim["scope"])}</dd>'
        f'<dt>Uncertainty</dt><dd>{html.escape(claim["uncertainty"])}</dd>'
        f'<dt>Does not prove</dt><dd>{html.escape(claim["doesNotProve"])}</dd></dl></li>'
        for claim in record["claims"]
    )
    corrections = (
        "<ul>" + "".join(f"<li>{html.escape(value)}</li>" for value in record["corrections"]) + "</ul>"
        if record["corrections"]
        else "<p>No corrections recorded.</p>"
    )
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(record["title"]) } · Zain Dana Harper</title>
<meta name="description" content="{html.escape(record["summary"], quote=True)}"><link rel="canonical" href="{canonical}">
<meta property="og:type" content="article"><meta property="og:title" content="{html.escape(record["title"], quote=True)}">
<meta property="og:description" content="{html.escape(record["summary"], quote=True)}"><meta property="og:url" content="{canonical}">
{card_tags(canonical, record["title"])}
<link rel="stylesheet" href="system/publication-article.css?v={ASSET_REVISION}"><script type="module" src="system/theme-entry.js?v=20260907-theme-preferences"></script></head>
<body class="publication-page"><a class="skip-link" href="#main">Skip to content</a>
<div id="site-nav" class="site-nav"></div>
<noscript><nav class="publication-static-nav" aria-label="Site"><a class="publication-home" href="index.html">Zain Dana Harper</a><a href="publications.html">Writing</a><a href="research.html">Research</a><a href="who-knew-first.html">Who Knew First</a><a href="site-index.html">Site index</a></nav></noscript>
<script type="module" src="{NAV_SCRIPT}"></script>
{placement.get("docnav", "")}
<main id="main" class="publication-article"><article><header><p class="publication-kicker">{html.escape(kind)} · {html.escape(topic)}</p>
<h1>{html.escape(record["title"])}</h1><p class="publication-thesis">{html.escape(record["thesis"])}</p>
<p class="publication-meta">{_dateline(record)}</p></header>
{_cover_figure(record["id"])}
<details class="publication-contents"><summary>In this article</summary><nav aria-label="Article sections"><ol>{contents}<li><a href="#sources">Sources</a></li></ol></nav></details>
<details class="publication-opening"><summary>Research summary and limits</summary>{opening}</details>
{sections}{figures}
<section id="sources"><h2>Sources</h2><ol>{sources}</ol></section>
<details class="publication-claim-notes" id="claim-ledger"><summary>Claim notes and limitations</summary><ol class="publication-claims">{claim_notes}</ol></details>
<section id="corrections"><h2>Corrections</h2>{corrections}</section>
<footer><h2>Authorship and process</h2><p>{html.escape(record["ai_assistance"])}</p>{_source_details(record, review_materials)}</footer>
</article></main></body></html>
'''

