"""The plate shell of the Frontier Safety Briefing.

The live page and every archive dated after the builder's SITE_SHELL_LAST_ARCHIVE_DATE
render here. tools/build_frontier_safety_briefing.py validates the edition and hands in
its digest, the controls caption and the shared asset revisions; the frozen shells of
earlier archives stay in the builder. Layout lives in frontier-safety-edition.css.
"""

from __future__ import annotations

import html
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urlparse

from frontier_safety_conclusions import control_anchor
from frontier_safety_conclusions_render import MONTHS as MONTH_NAMES, human_date
from frontier_safety_conclusions_render import render_section as render_conclusions


# The plate layer's reviewed revision, registered in the site contract's
# REVIEWED_ASSET_REVISIONS (25 September 2026, void-and-bone pass).
FRONTIER_EDITION_CSS_ASSET_VERSION = "20260925-void-plates"
ART_CSS_ASSET_VERSION = "20260925-human-notebook"
COVER_ART_STEM = "art/aperture/cover-frontier-safety"
# Mirrors art/aperture/covers.json, where render-site-art records each cover's alt text.
COVER_ART_ALT = ("A bright core ringed by fifty-two fine tick marks, one of them drawn long "
                 "past the outer rings.")
RECORD_STATUS_NOTES = {
    "changed": "Changed in this edition",
    "correction": "Corrected in this edition",
}
DESCRIPTION = ("A dated, source-grounded record of AISI, Anthropic, and frontier AI industry "
               "safety developments, with explicit evidence limits.")


@dataclass(frozen=True)
class ShellAssets:
    """Cache revisions the plate shares with the frozen shells, set by the builder."""
    nav: str
    reveal: str
    site_css: str


def _e(value: object) -> str:
    return html.escape(str(value), quote=True)


def _human_observed(value: str) -> str:
    moment = datetime.fromisoformat(value).astimezone(timezone.utc)
    return f"{moment.day} {MONTH_NAMES[moment.month - 1]} {moment.year}, {moment:%H:%M} UTC"


def _paths(date: str, *, archive: bool) -> dict[str, str]:
    if archive:
        return {
            "root": "../../",
            "css_dir": "../",
            "canonical": f"https://harperz9.github.io/frontier-safety/archive/{date}.html",
            "data": f"../data/archive/{date}.json",
            "self": f"{date}.html",
            "label": "Dated archive",
        }
    return {
        "root": "",
        "css_dir": "frontier-safety/",
        "canonical": "https://harperz9.github.io/frontier-safety.html",
        "data": "frontier-safety/data/current.json",
        "self": "frontier-safety.html",
        "label": "Current edition",
    }


def _source_links(sources: list[dict]) -> str:
    return " ".join(
        f'<a href="{_e(source["url"])}" rel="noreferrer">{_e(source["title"])}</a>'
        for source in sources
    )


def _render_item(item: dict) -> str:
    """The title leads. One byline follows it: the change note when the record changed,
    then the source role, the dates and the confidence. No label sits above the title."""
    note = RECORD_STATUS_NOTES.get(item["status"])
    change = (
        f'\n            <span class="record-change"><span class="status-mark" aria-hidden="true">'
        f"</span>{_e(note)}</span>"
        if note
        else ""
    )
    return f"""
      <article class="record" id="{_e(item['id'])}" data-status="{_e(item['status'])}">
        <div class="record-body">
          <h3>{_e(item['title'])}</h3>
          <div class="record-meta">{change}
            <span class="record-role">{_e(item['source_role'])}</span>
            <span>published {_e(item['published_at'])}</span>
            <span>event {_e(item['event_time'])}</span>
            <span>confidence {_e(item['confidence'])}</span>
          </div>
          <p>{_e(item['summary'])}</p>
          <div class="record-limits">
            <div class="boundary"><strong>Does not prove</strong><p>{_e(item['does_not_prove'])}</p></div>
            <p class="source-line"><strong>Sources</strong> {_source_links(item['sources'])}</p>
          </div>
        </div>
      </article>"""


def _render_lanes(lanes: list[dict]) -> tuple[str, str]:
    rail = []
    sections = []
    for lane in lanes:
        rail.append(
            f'<a class="rail-mark rail-{_e(lane["state"])}" href="#{_e(lane["id"])}">'
            f'<span class="rail-symbol" aria-hidden="true"></span>'
            f'<span class="rail-label">{_e(lane["label"])}</span>'
            f'<strong>{_e(lane["state"])}</strong></a>'
        )
        items = "".join(_render_item(item) for item in lane["items"])
        sections.append(
            f'<section class="mv lane" id="{_e(lane["id"])}"><header class="lane-head">'
            f'<h2>{_e(lane["label"])}</h2><p class="lane-status">{_e(lane["summary"])}</p></header>'
            f"{items}</section>"
        )
    return "".join(rail), "".join(sections)


def _control_source_names(edition: dict) -> dict[str, str]:
    """Name each control source by the reviewed title a record gives the same URL, or
    by its public host when no record cites it. A name never covers two URLs."""
    titles = {
        source["url"]: source["title"]
        for lane in edition["lanes"]
        for item in lane["items"]
        for source in item["sources"]
    }
    names: dict[str, str] = {}
    for url in (url for control in edition["controls"] for url in control["sources"]):
        base = titles.get(url) or f"source ({(urlparse(url).hostname or '').removeprefix('www.')})"
        name, count = base, 1
        while name in names.values() and names.get(url) != name:
            count += 1
            name = f"{base} {count}"
        names.setdefault(url, name)
    return names


def _render_controls(controls: list[dict], names: dict[str, str]) -> str:
    """Rows carry explicit table roles and cell labels, so the phone layout can
    stack each row without losing its table semantics."""
    rows = []
    for row, control in enumerate(controls, start=1):
        links = " ".join(
            f'<a href="{_e(url)}" rel="noreferrer">{_e(names[url])}</a>' for url in control["sources"]
        )
        rows.append(
            f'<tr role="row" id="{control_anchor(row)}">'
            f"<th scope=\"row\" role=\"rowheader\">{_e(control['announced_by'])}</th>"
            f"<td role=\"cell\" data-label=\"Reported control\">{_e(control['claim'])}</td>"
            f"<td role=\"cell\" data-label=\"Evidence status\"><span class=\"status-word\">{_e(control['status'])}</span>"
            f"<br>{_e(control['evidence_boundary'])} "
            f"<span class=\"control-sources\"><strong>Sources</strong> {links}</span></td>"
            "</tr>"
        )
    return "\n".join(rows)


def _render_hero(edition: dict, paths: dict[str, str], digest: str) -> str:
    date = edition["edition_date"]
    cover = f"{paths['root']}{COVER_ART_STEM}"
    return f"""<div class="frame briefing-hero">
  <div class="bar"><span class="nm">Zain Dana Harper</span><span class="rt">Research · Frontier Safety</span></div>
  <div class="mid briefing-intro">
    <h1><span class="title-line">What changed.</span> <span class="title-line">What supports it.</span> <span class="title-line g">What remains unresolved.</span></h1>
    <div class="edition-plate">
      <dl class="edition-readout">
        <div><dt>Edition</dt><dd><time datetime="{_e(date)}">{_e(date)}</time></dd></div>
        <div><dt>Sources observed</dt><dd><time datetime="{_e(edition['observed_at'])}">{_e(_human_observed(edition['observed_at']))}</time></dd></div>
        <div><dt>This edition</dt><dd>{_e(edition['edition_state'])}</dd></div>
      </dl>
      <details class="edition-check" data-print="closed"><summary>Check this edition</summary><p>SHA-256 of the canonical edition JSON: <code>{digest}</code></p></details>
    </div>
    <p class="lede">{_e(edition['change_summary'])}</p>
    <figure class="art art-cover briefing-cover">
      <img class="art-light" src="{cover}-light.svg" width="1600" height="800" alt="{_e(COVER_ART_ALT)}" loading="lazy" decoding="async">
      <img class="art-dark" src="{cover}-dark.svg" width="1600" height="800" alt="{_e(COVER_ART_ALT)}" loading="lazy" decoding="async">
    </figure>
  </div>
  <div class="seal">reported facts · source roles · explicit non-claims · <a href="{paths['data']}">machine-readable edition</a></div>
</div>"""


def _render_main(edition: dict, paths: dict[str, str], controls_caption: str, records: tuple[str, ...]) -> str:
    rail, lanes = _render_lanes(edition["lanes"])
    kept = "".join(f' · <a href="{paths["root"]}frontier-safety/conclusions/{d}.html">Conclusions on the edition of {human_date(d)}</a>' for d in records)
    questions = "".join(f"<li>{_e(q)}</li>" for q in edition["open_questions"])
    corrections = edition.get("corrections") or ["No corrections recorded for this edition."]
    correction_items = "".join(f"<li>{_e(item)}</li>" for item in corrections)
    return f"""<main id="main">
  {render_conclusions(edition, paths['root'])}<section class="mv briefing-overview">
    <h2>Three monitored lanes. One claim discipline.</h2>
    <p class="body-text">Words and shapes carry status. Color is secondary. Each lane separates the public record from the conclusions that record cannot support.</p>
    <nav class="delta-rail" aria-label="Briefing lanes">{rail}</nav>
    <p class="briefing-links"><a href="{paths['root']}research.html">Research index</a> · <a href="{paths['self']}" aria-current="page">{_e(paths['label'])}</a> · <a href="{paths['data']}">JSON edition</a>{kept}</p>
  </section>

  {lanes}

  <section class="mv wide-section controls">
    <header><h2>Controls and their status</h2></header>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Controls and evidence-status table"><table class="data data--wide controls-table" role="table">
      {controls_caption}<thead role="rowgroup"><tr role="row"><th role="columnheader">Source</th><th role="columnheader">Reported control</th><th role="columnheader">Evidence status</th></tr></thead>
      <tbody role="rowgroup">{_render_controls(edition['controls'], _control_source_names(edition))}</tbody>
    </table></div>
  </section>

  <section class="mv wide-section questions">
    <header><h2>Open questions</h2></header>
    <ol>{questions}</ol>
  </section>

  <section class="mv wide-section method">
    <header><h2>Method, corrections, and limits</h2></header>
    <div class="method-grid">
      <div><h3>Method</h3><p>{_e(edition['methodology'])}</p></div>
      <div><h3>Corrections</h3><ul>{correction_items}</ul></div>
      <div><h3>Does not prove</h3><p>This edition does not prove source completeness, model intent, incident prevalence, control effectiveness, or independent endorsement. It records the strongest current public claims within the monitored set and names their limits.</p></div>
    </div>
  </section>
</main>"""


def _render_head(date: str, paths: dict[str, str], assets: ShellAssets) -> str:
    root = paths["root"]
    return f"""<head>
<meta charset="utf-8">
<link rel="icon" href="{root}favicon.svg" type="image/svg+xml">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ebe5d8">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#060608">
<title>Frontier Safety Briefing · {_e(date)} · Zain Dana Harper</title>
<meta name="description" content="{DESCRIPTION}">
<link rel="canonical" href="{paths['canonical']}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Zain Dana Harper">
<meta property="og:title" content="Frontier Safety Briefing · {_e(date)}">
<meta property="og:description" content="{DESCRIPTION}">
<meta property="og:url" content="{paths['canonical']}">
<meta property="og:image" content="https://harperz9.github.io/img/og/telos.png">
<meta property="og:image:alt" content="A procedural Zentropy Labs artwork card used for the Frontier Safety Briefing.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Frontier Safety Briefing · {_e(date)}">
<meta name="twitter:description" content="{DESCRIPTION}">
<meta name="twitter:image" content="https://harperz9.github.io/img/og/telos.png">
<link rel="preload" href="{root}system/fonts/hanken-grotesk.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{root}system/fonts/conso-regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{paths['css_dir']}frontier-safety-site.css?v={assets.site_css}">
<link rel="stylesheet" href="{root}system/art.css?v={ART_CSS_ASSET_VERSION}">
<link rel="stylesheet" href="{paths['css_dir']}frontier-safety-edition.css?v={FRONTIER_EDITION_CSS_ASSET_VERSION}">
</head>"""


def render_plate_html(
    edition: dict,
    *,
    archive: bool,
    digest: str,
    controls_caption: str,
    assets: ShellAssets,
    records: tuple[str, ...] = (),
) -> str:
    """Render one edition in the plate shell. The caller has validated it. records lists
    the dates of dated conclusions pages the live page links to; archives pass none."""

    date = edition["edition_date"]
    paths = _paths(date, archive=archive)
    root = paths["root"]
    return f"""<!DOCTYPE html>
<html lang="en">
{_render_head(date, paths, assets)}
<body class="inner-clean frame-compact frontier-briefing">
<a class="skip-link" href="#main">Skip to content</a>
<div id="site-nav" class="site-nav"></div>
<noscript><nav class="site-nav"><a href="{root}index.html">Home</a> <a href="{root}research.html">Research</a></nav></noscript>
<script type="module" src="{root}system/nav.js?v={assets.nav}"></script>

{_render_hero(edition, paths, digest)}

{_render_main(edition, paths, controls_caption, records)}

<footer class="footer-seal" role="contentinfo">
  <p class="seal">Compiled by Zain Dana Harper · Zentropy Labs · <a href="{root}research.html">Research index</a> · <a href="{paths['data']}">JSON edition</a> · <a href="{root}frontier-safety/archive/{_e(date)}.html">Dated archive</a></p>
</footer>
<script src="{root}system/reveal.js?v={assets.reveal}" defer></script>
</body>
</html>
"""
