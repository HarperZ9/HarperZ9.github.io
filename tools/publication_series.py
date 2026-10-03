"""Render a series hub page, such as who-knew-first-series.html, from its definition.

The definition (publications/data/series/<id>.json) holds the hub text and the five parts.
A part with an id is published: the hub links it and shows its first publication date.
A part without one is planned: plain text, a "Planned" label, no link and no date.
Publishing a part means adding its id, so the hub and the parts cannot drift apart.
"""
from __future__ import annotations

import html

from tools.publication_sections import human_date

SITE_URL = "https://harperz9.github.io/"
NUMBER_WORDS = ("no", "one", "two", "three", "four", "five", "six")


def _e(value: object) -> str:
    return html.escape(str(value), quote=True)


def _intro(series: dict) -> str:
    anchor = series["anchor"]
    text = _e(series["intro"])
    linked = f'<a href="{_e(anchor["href"])}"><em>{_e(anchor["text"])}</em></a>'
    return text.replace(_e(anchor["text"]), linked, 1)


def _part(index: int, part: dict, items_by_id: dict[str, dict]) -> str:
    item = items_by_id.get(part["id"]) if part["id"] else None
    if part["id"] and not item:
        raise ValueError(f"series part {part['title']} names an unknown piece {part['id']}")
    if item:
        title = f'<a href="{_e(item["route"])}">{_e(part["title"])}</a>'
        status = f'Published <time datetime="{_e(item["published_at"])}">{human_date(item["published_at"])}</time>'
    else:
        title = _e(part["title"])
        status = "Planned"
    return (
        f'<li value="{index}"><h2 class="series-part-title">{title}</h2>'
        f'<p class="series-part-status">{status}</p>'
        f'<p>{_e(part["question"])}</p></li>'
    )


def _opener(series: dict) -> str:
    """The "Start here" line under the hub's lead: the author's own account, read before the evidence."""
    opener = series.get("opener")
    if not opener:
        return ""
    return (f'<p class="series-opener"><strong>Start here:</strong> '
            f'<a href="{_e(opener["href"])}"><em>{_e(opener["text"])}</em></a>. {_e(opener["question"])}</p>'
            + chr(10))


def _table_block(table: str) -> str:
    if not table:
        return ""
    return f"<!-- BEGIN GENERATED SERIES TABLE -->\n{table}\n<!-- END GENERATED SERIES TABLE -->\n"


def render_series_page(series: dict, items_by_id: dict[str, dict], table: str = "") -> str:
    """The hub page. ``table`` is the shared Continue-the-series table (tools/series_table.py)."""
    canonical = SITE_URL + series["route"]
    published = sum(1 for part in series["parts"] if part["id"])
    planned = len(series["parts"])
    parts = "".join(_part(index, part, items_by_id) for index, part in enumerate(series["parts"], start=1))
    related = " · ".join(f'<a href="{_e(link["href"])}">{_e(link["label"])}</a>' for link in series["related"])
    title = _e(series["title"])
    summary = _e(series["summary"])
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · Zain Dana Harper</title>
<meta name="description" content="{summary}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Zain Dana Harper">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{summary}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{SITE_URL}img/og/who-knew-first-series.png">
<meta property="og:image:alt" content="{title}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{summary}">
<meta name="twitter:image" content="{SITE_URL}img/og/who-knew-first-series.png">
<link rel="preload" href="system/fonts/hanken-grotesk.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="system/doc.css?v=20260907-reading-completion">
<link rel="stylesheet" href="system/series.css?v=20261001-series-opener">
<link rel="stylesheet" href="system/series-table.css?v=20261001-series-opener">
</head>
<body class="doc series-hub" data-route-art="off">
<a class="skip-link" href="#main">Skip to content</a>
<div id="site-nav" class="site-nav"></div>
<noscript><nav class="site-nav"><a href="index.html">Home</a> <a href="publications.html">Writing</a> <a href="who-knew-first.html">Who Knew First</a> <a href="research.html">Research</a> <a href="cv.html">About</a></nav></noscript>
<script type="module" src="system/nav.js?v=20260909-pillar-navigation"></script>
<nav class="docnav" aria-label="Where this page sits"><span class="where">Writing · Who Knew First series</span><span class="switch"><a href="publications.html">All writing</a><a href="publications.html#series">More investigations</a><a href="who-knew-first.html">Who Knew First</a></span></nav>
<main id="main">
<article class="sheet series-sheet">
<header class="mast">
<p class="role">Series · {NUMBER_WORDS[planned]} pieces · {NUMBER_WORDS[published]} published</p>
<h1>{title}</h1>
<p class="lead">{_intro(series)}</p>
{_opener(series)}</header>
{_table_block(table)}<ol class="series-parts">{parts}</ol>
<p class="series-closing">{_e(series["closing"])}</p>
<p class="series-related">Related: {related}</p>
</article>
</main>
</body>
</html>
'''
