#!/usr/bin/env python3
"""Validate and render a Frontier Safety Briefing edition.

The renderer consumes reviewed JSON. It never synthesizes claims from fetched
web pages. Source-change detection is handled by a separate script.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import shutil
import tempfile
from copy import deepcopy
from datetime import date as calendar_date
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
CURRENT_NAV_ASSET_VERSION = "20260902-creative-chassis"
ARCHIVE_NAV_ASSET_VERSIONS = {
    "2026-08-24": "20260902-creative-chassis",
    "2026-08-25": "20260902-creative-chassis",
}
ALLOWED_SOURCE_HOSTS = {
    "cdn.openai.com",
    "harperz9.github.io",
    "www.aisi.gov.uk",
    "www.alabamaag.gov",
    "www.anthropic.com",
    "openai.com",
    "huggingface.co",
    "metr.org",
    "www.nist.gov",
    "nvd.nist.gov",
    "www.sysdig.com",
}
ALLOWED_LANES = {"aisi", "anthropic", "industry"}
ALLOWED_STATES = {"baseline", "changed", "unchanged", "correction"}
ALLOWED_SOCIAL_PUBLICATION_STATES = {"not_posted", "posted"}
LEGACY_OPTIONAL_SOCIAL_PUBLICATION_DATES = {"2026-08-24"}
X_SOCIAL_POST_HOSTS = {"x.com", "www.x.com", "twitter.com", "www.twitter.com"}
LINKEDIN_SOCIAL_POST_HOSTS = {"linkedin.com", "www.linkedin.com"}
X_FINAL_STATUS_PATH = re.compile(r"^/[A-Za-z0-9_]{1,15}/status/[0-9]+/?$")
LINKEDIN_FINAL_UPDATE_PATH = re.compile(
    r"^/feed/update/urn:li:(activity|share):[0-9]+/?$"
)
LINKEDIN_FINAL_POST_PATH = re.compile(r"^/posts/[^/]+/?$")
ALLOWED_ROLES = {
    "government report",
    "developer statement",
    "affected-party technical timeline",
    "independent analysis",
    "publication notice",
}
ALLOWED_CONFIDENCE = {"high", "moderate", "low"}
BARE_SEVERITY = re.compile(r"(?<![A-Za-z0-9_-])T[123](?![A-Za-z0-9_-])")


class EditionError(ValueError):
    """Raised when reviewed edition data violates the publication contract."""


def _canonical_payload(edition: dict) -> bytes:
    payload = deepcopy(edition)
    payload.pop("edition_sha256", None)
    return json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def edition_sha256(edition: dict) -> str:
    return hashlib.sha256(_canonical_payload(edition)).hexdigest()


def _require_text(mapping: dict, key: str, context: str) -> str:
    value = mapping.get(key)
    if not isinstance(value, str) or not value.strip():
        raise EditionError(f"{context}.{key} must be non-empty text")
    if "—" in value:
        raise EditionError(f"{context}.{key} contains an em dash")
    if BARE_SEVERITY.search(value):
        raise EditionError(f"{context}.{key} uses an unnamespaced severity label")
    return value.strip()


def _require_choice(mapping: dict, key: str, allowed: set[str], context: str) -> str:
    value = mapping.get(key)
    if not isinstance(value, str) or value not in allowed:
        raise EditionError(f"{context}.{key} is invalid")
    return value


def _validate_url(url: str, context: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_SOURCE_HOSTS:
        raise EditionError(f"{context} uses an unapproved source URL: {url}")


def _validate_social_publication(edition: dict) -> None:
    publication = edition.get("social_publication")
    if not isinstance(publication, dict):
        if (
            edition.get("edition_date") in LEGACY_OPTIONAL_SOCIAL_PUBLICATION_DATES
            and publication is None
        ):
            return
        raise EditionError("edition.social_publication must be an object")
    if set(publication) != {"x", "linkedin"}:
        raise EditionError("edition.social_publication must contain x and linkedin")
    for channel in ("x", "linkedin"):
        record = publication[channel]
        if not isinstance(record, dict):
            raise EditionError(f"social_publication.{channel} must be an object")
        if set(record) != {"state", "post_url"}:
            raise EditionError(
                f"social_publication.{channel} must contain state and post_url"
            )
        state = _require_choice(
            record,
            "state",
            ALLOWED_SOCIAL_PUBLICATION_STATES,
            f"social_publication.{channel}",
        )
        post_url = record.get("post_url")
        if state == "not_posted":
            if post_url is not None:
                raise EditionError(
                    f"social_publication.{channel}.post_url must be null when not_posted"
                )
            continue
        if not isinstance(post_url, str) or not post_url.strip():
            raise EditionError(
                f"social_publication.{channel}.post_url must be a final {channel} post URL when posted"
            )
        _validate_social_post_url(channel, post_url)


def _validate_social_post_url(channel: str, post_url: str) -> None:
    parsed = urlparse(post_url)
    hostname = (parsed.hostname or "").lower()
    has_clean_url_suffix = not parsed.params and not parsed.fragment
    is_final_post = False
    if channel == "x":
        is_final_post = (
            parsed.scheme == "https"
            and hostname in X_SOCIAL_POST_HOSTS
            and has_clean_url_suffix
            and X_FINAL_STATUS_PATH.fullmatch(parsed.path) is not None
        )
    elif channel == "linkedin":
        is_final_post = (
            parsed.scheme == "https"
            and hostname in LINKEDIN_SOCIAL_POST_HOSTS
            and has_clean_url_suffix
            and (
                LINKEDIN_FINAL_UPDATE_PATH.fullmatch(parsed.path) is not None
                or LINKEDIN_FINAL_POST_PATH.fullmatch(parsed.path) is not None
            )
        )
    if not is_final_post:
        raise EditionError(
            f"social_publication.{channel}.post_url must be a final {channel} post URL when posted"
        )


def validate_edition(edition: dict) -> None:
    if not isinstance(edition, dict):
        raise EditionError("edition must be an object")
    if edition.get("schema_version") != 1:
        raise EditionError("schema_version must be 1")
    date = _require_text(edition, "edition_date", "edition")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        raise EditionError("edition_date must be YYYY-MM-DD")
    try:
        calendar_date.fromisoformat(date)
    except ValueError as exc:
        raise EditionError("edition_date must be a valid calendar date") from exc
    observed = _require_text(edition, "observed_at", "edition")
    try:
        observed_time = datetime.fromisoformat(observed)
    except ValueError as exc:
        raise EditionError("observed_at must be a valid ISO-8601 timestamp") from exc
    if observed_time.tzinfo is None or observed_time.utcoffset() != timedelta(0):
        raise EditionError("observed_at must be timezone-aware UTC")
    for key in ("title", "change_summary", "methodology"):
        _require_text(edition, key, "edition")
    _require_choice(edition, "edition_state", ALLOWED_STATES, "edition")

    lanes = edition.get("lanes")
    if (
        not isinstance(lanes, list)
        or len(lanes) != len(ALLOWED_LANES)
        or any(not isinstance(lane, dict) for lane in lanes)
    ):
        raise EditionError("edition must contain exactly the aisi, anthropic, and industry lanes")
    lane_ids = {_require_text(lane, "id", "lane") for lane in lanes}
    if lane_ids != ALLOWED_LANES:
        raise EditionError("edition must contain exactly the aisi, anthropic, and industry lanes")
    item_ids: set[str] = set()
    for lane in lanes:
        lane_id = lane["id"]
        _require_text(lane, "label", f"lane[{lane_id}]")
        _require_text(lane, "summary", f"lane[{lane_id}]")
        _require_choice(lane, "state", ALLOWED_STATES, f"lane[{lane_id}]")
        items = lane.get("items")
        if not isinstance(items, list) or not items:
            raise EditionError(f"lane[{lane_id}] must include at least one item")
        for item in items:
            if not isinstance(item, dict):
                raise EditionError(f"lane[{lane_id}].items must contain objects")
            item_id = _require_text(item, "id", f"lane[{lane_id}].item")
            if item_id in item_ids:
                raise EditionError(f"duplicate item id: {item_id}")
            item_ids.add(item_id)
            context = f"item[{item_id}]"
            for key in ("title", "published_at", "event_time", "summary", "does_not_prove"):
                _require_text(item, key, context)
            _require_choice(item, "status", ALLOWED_STATES, context)
            _require_choice(item, "source_role", ALLOWED_ROLES, context)
            _require_choice(item, "confidence", ALLOWED_CONFIDENCE, context)
            sources = item.get("sources")
            if not isinstance(sources, list) or not sources:
                raise EditionError(f"{context}.sources must be non-empty")
            for index, source in enumerate(sources):
                if not isinstance(source, dict):
                    raise EditionError(f"{context}.sources[{index}] must be an object")
                _require_text(source, "title", f"{context}.sources[{index}]")
                url = _require_text(source, "url", f"{context}.sources[{index}]")
                _validate_url(url, f"{context}.sources[{index}]")

    controls = edition.get("controls")
    if not isinstance(controls, list):
        raise EditionError("edition.controls must be a list")
    for index, control in enumerate(controls):
        if not isinstance(control, dict):
            raise EditionError(f"controls[{index}] must be an object")
        for key in ("claim", "announced_by", "status", "evidence_boundary"):
            _require_text(control, key, f"controls[{index}]")
        sources = control.get("sources")
        if not isinstance(sources, list):
            raise EditionError(f"controls[{index}].sources must be a list")
        for source_index, url in enumerate(sources):
            url = _require_text(
                {"url": url}, "url", f"controls[{index}].sources[{source_index}]"
            )
            _validate_url(url, f"controls[{index}]")
    questions = edition.get("open_questions")
    if not isinstance(questions, list):
        raise EditionError("edition.open_questions must be a list")
    for index, question in enumerate(questions):
        _require_text({"question": question}, "question", f"open_questions[{index}]")
    corrections = edition.get("corrections", [])
    if not isinstance(corrections, list):
        raise EditionError("edition.corrections must be a list")
    for index, correction in enumerate(corrections):
        _require_text({"correction": correction}, "correction", f"corrections[{index}]")
    social = edition.get("social")
    if not isinstance(social, dict):
        raise EditionError("edition.social must be an object")
    x_copy = _require_text(social, "x", "social")
    linkedin = _require_text(social, "linkedin", "social")
    if len(x_copy) > 280:
        raise EditionError("social.x exceeds 280 characters")
    if len(linkedin) > 3000:
        raise EditionError("social.linkedin exceeds 3000 characters")
    _validate_social_publication(edition)


def _e(value: object) -> str:
    return html.escape(str(value), quote=True)


def _source_links(sources: list[dict]) -> str:
    return " ".join(
        f'<a href="{_e(source["url"])}" rel="noreferrer">{_e(source["title"])}</a>'
        for source in sources
    )


def _render_item(item: dict, number: int) -> str:
    return f"""
      <article class="record" id="{_e(item['id'])}">
        <div class="record-index" aria-hidden="true">{number:02d}</div>
        <div class="record-body">
          <div class="record-meta">
            <span>{_e(item['source_role'])}</span>
            <span>published {_e(item['published_at'])}</span>
            <span>event {_e(item['event_time'])}</span>
            <span>confidence {_e(item['confidence'])}</span>
          </div>
          <h3>{_e(item['title'])}</h3>
          <p>{_e(item['summary'])}</p>
          <div class="boundary"><strong>Does not prove</strong><p>{_e(item['does_not_prove'])}</p></div>
          <p class="source-line"><strong>Sources</strong> {_source_links(item['sources'])}</p>
        </div>
      </article>"""


def _render_controls(controls: list[dict]) -> str:
    rows = []
    for control in controls:
        links = " ".join(
            f'<a href="{_e(url)}" rel="noreferrer">source</a>' for url in control["sources"]
        )
        rows.append(
            "<tr>"
            f"<th scope=\"row\">{_e(control['announced_by'])}</th>"
            f"<td>{_e(control['claim'])}</td>"
            f"<td><span class=\"status-word\">{_e(control['status'])}</span><br>{_e(control['evidence_boundary'])} {links}</td>"
            "</tr>"
        )
    return "\n".join(rows)


def _render_controls_caption(edition_date: str) -> str:
    if edition_date < "2026-08-27":
        return ""
    return (
        '<caption class="analysis-note">'
        f'<strong>Source-scope matrix for edition {_e(edition_date)}.</strong> '
        'Sources: each row links to its supporting public record. '
        'Unit: one reported control per row. '
        'Transformation: controls are grouped by reporting organization and assigned '
        'the evidence status stated in the reviewed edition. '
        'Limitations and non-proof: row count is not a severity measure and does not '
        'establish control coverage or effectiveness.'
        '</caption>\n      '
    )


def _render_legacy_html(edition: dict, *, archive: bool) -> str:
    date = edition["edition_date"]
    if archive:
        root_prefix = "../../"
        css_href = f"../frontier-safety.css?v={CURRENT_NAV_ASSET_VERSION}"
        canonical = f"https://harperz9.github.io/frontier-safety/archive/{date}.html"
        data_href = f"../data/archive/{date}.json"
        self_href = f"{date}.html"
        page_label = "Dated archive"
    else:
        root_prefix = ""
        css_href = f"frontier-safety/frontier-safety.css?v={CURRENT_NAV_ASSET_VERSION}"
        canonical = "https://harperz9.github.io/frontier-safety.html"
        data_href = "frontier-safety/data/current.json"
        self_href = "frontier-safety.html"
        page_label = "Current edition"

    rail = []
    records = []
    number = 1
    for lane in edition["lanes"]:
        rail.append(
            f'<a class="rail-mark rail-{_e(lane["state"])}" href="#{_e(lane["id"])}">'
            f'<span class="rail-symbol" aria-hidden="true"></span><span>{_e(lane["label"])}</span>'
            f'<strong>{_e(lane["state"])}</strong></a>'
        )
        lane_items = []
        for item in lane["items"]:
            lane_items.append(_render_item(item, number))
            number += 1
        records.append(
            f'<section class="lane" id="{_e(lane["id"])}"><header class="lane-head">'
            f'<p>{_e(lane["summary"])}</p><h2>{_e(lane["label"])}</h2></header>'
            f'{"".join(lane_items)}</section>'
        )

    questions = "".join(f"<li>{_e(q)}</li>" for q in edition["open_questions"])
    corrections = edition.get("corrections") or ["No corrections recorded for this edition."]
    correction_items = "".join(f"<li>{_e(item)}</li>" for item in corrections)
    digest = edition_sha256(edition)
    description = "A dated, source-grounded record of AISI, Anthropic, and frontier AI industry safety developments, with explicit evidence limits."

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="icon" href="{root_prefix}favicon.svg" type="image/svg+xml">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#070406">
<title>Frontier Safety Briefing · {_e(date)} · Zain Dana Harper</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Zain Dana Harper">
<meta property="og:title" content="Frontier Safety Briefing · {_e(date)}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="https://harperz9.github.io/img/og/telos.png">
<meta property="og:image:alt" content="A procedural ZentropyLabs research plate used for the Frontier Safety Briefing.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Frontier Safety Briefing · {_e(date)}">
<meta name="twitter:description" content="{description}">
<meta name="twitter:image" content="https://harperz9.github.io/img/og/telos.png">
<link rel="preload" href="{root_prefix}system/fonts/hanken-grotesk.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{root_prefix}system/fonts/conso-regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{css_href}">
</head>
<body class="doc frontier-briefing">
<a class="skip-link" href="#main">Skip to content</a>
<div id="site-nav" class="site-nav"></div>
<noscript><nav class="site-nav"><a href="{root_prefix}index.html">Home</a> <a href="{root_prefix}research.html">Research</a></nav></noscript>
<script type="module" src="{root_prefix}system/nav.js?v={CURRENT_NAV_ASSET_VERSION}"></script>

<div class="docnav">
  <span class="where">Research · Frontier Safety</span>
  <span class="switch"><a href="{root_prefix}research.html">Research index</a><a href="{self_href}" aria-current="page">{_e(page_label)}</a></span>
</div>

<main id="main" class="sheet briefing-sheet">
  <header class="mast briefing-mast">
    <div class="edition-context"><span>Frontier Safety Briefing</span><span>{_e(page_label)}</span></div>
    <h1>What changed.<br>What supports it.<br><em>What remains unresolved.</em></h1>
    <p class="hero-summary">{_e(edition['change_summary'])}</p>
    <dl class="edition-readout">
      <div><dt>Edition</dt><dd>{_e(date)}</dd></div>
      <div><dt>Observed</dt><dd>{_e(edition['observed_at'])}</dd></div>
      <div><dt>State</dt><dd>{_e(edition['edition_state'])}</dd></div>
      <div><dt>SHA-256</dt><dd title="{digest}">{digest[:16]}…</dd></div>
    </dl>
  </header>

  <div class="briefing-grid">
    <aside class="delta-rail" aria-label="Briefing lanes">
      <h2>Delta rail</h2>
      <p>Words and shapes carry status. Color is secondary.</p>
      <nav>{''.join(rail)}</nav>
      <a class="machine-link" href="{data_href}">Machine-readable edition</a>
    </aside>

    <div class="record-stack">
      {''.join(records)}
    </div>
  </div>

  <section class="wide-section controls">
    <header><p>Claim discipline</p><h2>Controls and their status</h2></header>
    <div class="table-wrap"><table class="data data--wide controls-table">
      {_render_controls_caption(edition['edition_date'])}<thead><tr><th>Source</th><th>Reported control</th><th>Evidence status</th></tr></thead>
      <tbody>{_render_controls(edition['controls'])}</tbody>
    </table></div>
  </section>

  <section class="wide-section questions">
    <header><p>Watch list</p><h2>Open questions</h2></header>
    <ol>{questions}</ol>
  </section>

  <section class="wide-section method">
    <header><p>Publication contract</p><h2>Method, corrections, and limits</h2></header>
    <div class="method-grid">
      <div><h3>Method</h3><p>{_e(edition['methodology'])}</p></div>
      <div><h3>Corrections</h3><ul>{correction_items}</ul></div>
      <div><h3>Does not prove</h3><p>This edition does not prove source completeness, model intent, incident prevalence, control effectiveness, or independent endorsement. It records the strongest current public claims within the monitored set and names their limits.</p></div>
    </div>
  </section>

  <footer class="briefing-footer">
    <p>Compiled by Zain Dana Harper · ZentropyLabs · <a href="{root_prefix}research.html">Research index</a></p>
    <p><a href="{data_href}">JSON edition</a> · <a href="{root_prefix}frontier-safety/archive/{_e(date)}.html">Dated archive</a></p>
  </footer>
</main>
</body>
</html>
"""


def render_html(edition: dict, *, archive: bool) -> str:
    """Render the live shared-site shell while preserving published archives.

    The inaugural 2026-08-24 archive shipped with the document shell. Its HTML
    is an immutable publication artifact, so it continues through the legacy
    renderer. The live page and every later archive use the site-wide
    shared site presentation.
    """

    date = edition["edition_date"]
    if archive and date == "2026-08-24":
        return _render_legacy_html(edition, archive=True)

    if archive:
        root_prefix = "../../"
        css_href = f"../frontier-safety-site.css?v={CURRENT_NAV_ASSET_VERSION}"
        canonical = f"https://harperz9.github.io/frontier-safety/archive/{date}.html"
        data_href = f"../data/archive/{date}.json"
        self_href = f"{date}.html"
        page_label = "Dated archive"
    else:
        root_prefix = ""
        css_href = f"frontier-safety/frontier-safety-site.css?v={CURRENT_NAV_ASSET_VERSION}"
        canonical = "https://harperz9.github.io/frontier-safety.html"
        data_href = "frontier-safety/data/current.json"
        self_href = "frontier-safety.html"
        page_label = "Current edition"

    rail = []
    records = []
    number = 1
    for lane in edition["lanes"]:
        rail.append(
            f'<a class="rail-mark rail-{_e(lane["state"])}" href="#{_e(lane["id"])}">'
            f'<span class="rail-symbol" aria-hidden="true"></span><span>{_e(lane["label"])}</span>'
            f'<strong>{_e(lane["state"])}</strong></a>'
        )
        lane_items = []
        for item in lane["items"]:
            lane_items.append(_render_item(item, number))
            number += 1
        records.append(
            f'<section class="mv lane" id="{_e(lane["id"])}"><header class="lane-head">'
            f'<p class="lane-status">{_e(lane["summary"])}</p><h2>{_e(lane["label"])}</h2></header>'
            f'{"".join(lane_items)}</section>'
        )

    questions = "".join(f"<li>{_e(q)}</li>" for q in edition["open_questions"])
    corrections = edition.get("corrections") or ["No corrections recorded for this edition."]
    correction_items = "".join(f"<li>{_e(item)}</li>" for item in corrections)
    digest = edition_sha256(edition)
    description = "A dated, source-grounded record of AISI, Anthropic, and frontier AI industry safety developments, with explicit evidence limits."
    nav_asset_version = (
        ARCHIVE_NAV_ASSET_VERSIONS.get(date, CURRENT_NAV_ASSET_VERSION)
        if archive
        else CURRENT_NAV_ASSET_VERSION
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="icon" href="{root_prefix}favicon.svg" type="image/svg+xml">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#070406">
<title>Frontier Safety Briefing · {_e(date)} · Zain Dana Harper</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Zain Dana Harper">
<meta property="og:title" content="Frontier Safety Briefing · {_e(date)}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="https://harperz9.github.io/img/og/telos.png">
<meta property="og:image:alt" content="A procedural ZentropyLabs research plate used for the Frontier Safety Briefing.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Frontier Safety Briefing · {_e(date)}">
<meta name="twitter:description" content="{description}">
<meta name="twitter:image" content="https://harperz9.github.io/img/og/telos.png">
<link rel="preload" href="{root_prefix}system/fonts/hanken-grotesk.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{root_prefix}system/fonts/conso-regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{css_href}">
</head>
<body class="inner-clean frame-compact frontier-briefing">
<a class="skip-link" href="#main">Skip to content</a>
<div id="site-nav" class="site-nav"></div>
<noscript><nav class="site-nav"><a href="{root_prefix}index.html">Home</a> <a href="{root_prefix}research.html">Research</a></nav></noscript>
<script type="module" src="{root_prefix}system/nav.js?v={nav_asset_version}"></script>

<div class="frame briefing-hero">
  <div class="bar"><span class="nm">Zain Dana Harper</span><span class="rt">Research · Frontier Safety</span></div>
  <div class="mid briefing-intro">
    <h1>What changed. What supports it. <span class="g">What remains unresolved.</span></h1>
    <p class="lede">{_e(edition['change_summary'])}</p>
    <figure class="plate plate--slim briefing-plate">
      <canvas data-specimen="frontier-safety-{_e(date)}" data-specimen-layers="obsidian-burst" aria-hidden="true"></canvas>
      <figcaption><span class="plate-no">Edition {_e(date)}</span><span class="plate-caption">A source record drawn at the size of its evidence, with every unresolved boundary left visible.</span></figcaption>
    </figure>
    <dl class="edition-readout">
      <div><dt>Edition</dt><dd>{_e(date)}</dd></div>
      <div><dt>Observed</dt><dd>{_e(edition['observed_at'])}</dd></div>
      <div><dt>State</dt><dd>{_e(edition['edition_state'])}</dd></div>
      <div><dt>SHA-256</dt><dd title="{digest}">{digest[:16]}…</dd></div>
    </dl>
  </div>
  <div class="seal">reported facts · source roles · explicit non-claims · <a href="{data_href}">machine-readable edition</a></div>
</div>

<main id="main">
  <section class="mv briefing-overview">
    <h2>Three monitored lanes. One claim discipline.</h2>
    <p class="body-text">Words and shapes carry status. Color is secondary. Each lane separates the public record from the conclusions that record cannot support.</p>
    <nav class="delta-rail" aria-label="Briefing lanes">{''.join(rail)}</nav>
    <p class="briefing-links"><a href="{root_prefix}research.html">Research index</a> · <a href="{self_href}" aria-current="page">{_e(page_label)}</a> · <a href="{data_href}">JSON edition</a></p>
  </section>

  {''.join(records)}

  <section class="mv wide-section controls">
    <header><h2>Controls and their status</h2></header>
    <div class="table-wrap"><table class="data data--wide controls-table">
      {_render_controls_caption(edition['edition_date'])}<thead><tr><th>Source</th><th>Reported control</th><th>Evidence status</th></tr></thead>
      <tbody>{_render_controls(edition['controls'])}</tbody>
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
</main>

<footer class="footer-seal" role="contentinfo">
  <p class="seal">Compiled by Zain Dana Harper · ZentropyLabs · <a href="{root_prefix}research.html">Research index</a> · <a href="{data_href}">JSON edition</a> · <a href="{root_prefix}frontier-safety/archive/{_e(date)}.html">Dated archive</a></p>
</footer>
<script src="{root_prefix}system/reveal.js?v={CURRENT_NAV_ASSET_VERSION}" defer></script>
</body>
</html>
"""


def _text_bytes(content: str) -> bytes:
    if not content.endswith("\n"):
        content += "\n"
    return content.encode("utf-8")


def _json_bytes(payload: dict | list) -> bytes:
    return _text_bytes(
        json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=False)
    )


def _load_history(path: Path) -> dict:
    if not path.exists():
        return {"schema_version": 1, "editions": []}
    try:
        history = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise EditionError(f"cannot read valid history: {path}") from exc
    if not isinstance(history, dict) or history.get("schema_version") != 1:
        raise EditionError("history.schema_version must be 1")
    entries = history.get("editions")
    if not isinstance(entries, list):
        raise EditionError("history.editions must be a list")
    seen_dates: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise EditionError(f"history.editions[{index}] must be an object")
        for key in ("date", "sha256", "state", "html", "json"):
            _require_text(entry, key, f"history.editions[{index}]")
        if entry["date"] in seen_dates:
            raise EditionError(f"history contains duplicate date: {entry['date']}")
        seen_dates.add(entry["date"])
    return history


def _validate_archive_collision(
    *,
    date: str,
    digest: str,
    history: dict,
    dated_outputs: dict[Path, bytes],
) -> None:
    matches = [entry for entry in history["editions"] if entry["date"] == date]
    existing_dated = [path for path in dated_outputs if path.exists()]
    if matches:
        if matches[0]["sha256"] != digest:
            raise EditionError(
                f"edition_date {date} is already published with different content; "
                "use a new edition or correction identifier"
            )
        missing = [path for path in dated_outputs if not path.exists()]
        if missing:
            raise EditionError(f"published edition {date} has an incomplete archive")
        mismatched = [
            path for path, expected in dated_outputs.items() if path.read_bytes() != expected
        ]
        if mismatched:
            raise EditionError(
                f"edition_date {date} dated archive bytes differ at {mismatched[0]}; "
                "use a new edition or correction identifier"
            )
        return
    if existing_dated:
        raise EditionError(
            f"edition_date {date} already has archive artifacts without a history entry; "
            "use a new edition or correction identifier"
        )


def _publish_atomically(outputs: dict[Path, bytes], output_root: Path) -> None:
    changed = {
        path: content
        for path, content in outputs.items()
        if not path.exists() or path.read_bytes() != content
    }
    if not changed:
        return

    root_created = not output_root.exists()
    output_root.mkdir(parents=True, exist_ok=True)
    transaction = Path(tempfile.mkdtemp(prefix=".frontier-safety-publish-", dir=output_root))
    staged: dict[Path, Path] = {}
    backups: dict[Path, Path] = {}
    created_directories: set[Path] = set()
    committed: list[Path] = []
    cleanup_transaction = False
    try:
        for index, (destination, content) in enumerate(changed.items()):
            staged_path = transaction / f"staged-{index}"
            staged_path.write_bytes(content)
            staged[destination] = staged_path
            if destination.exists():
                backup_path = transaction / f"backup-{index}"
                shutil.copy2(destination, backup_path)
                backups[destination] = backup_path

        for destination, staged_path in staged.items():
            missing_parents = []
            parent = destination.parent
            while not parent.exists():
                missing_parents.append(parent)
                parent = parent.parent
            destination.parent.mkdir(parents=True, exist_ok=True)
            created_directories.update(missing_parents)
            os.replace(staged_path, destination)
            committed.append(destination)
        cleanup_transaction = True
    except BaseException as publish_error:
        rollback_errors: list[OSError] = []
        for destination in reversed(committed):
            try:
                backup = backups.get(destination)
                if backup is None:
                    destination.unlink(missing_ok=True)
                else:
                    os.replace(backup, destination)
            except OSError as exc:
                rollback_errors.append(exc)
        for directory in sorted(created_directories, key=lambda path: len(path.parts), reverse=True):
            try:
                directory.rmdir()
            except OSError:
                pass
        if rollback_errors:
            raise RuntimeError(
                "publication failed and rollback was incomplete; "
                f"recovery artifacts retained at {transaction}"
            ) from publish_error
        cleanup_transaction = True
        raise
    finally:
        if cleanup_transaction:
            shutil.rmtree(transaction, ignore_errors=True)
            if root_created:
                try:
                    output_root.rmdir()
                except OSError:
                    pass


def build(edition_path: Path, output_root: Path = ROOT) -> dict:
    edition = json.loads(edition_path.read_text(encoding="utf-8"))
    validate_edition(edition)
    digest = edition_sha256(edition)
    rendered = deepcopy(edition)
    rendered["edition_sha256"] = digest
    date = rendered["edition_date"]

    fs_root = output_root / "frontier-safety"
    history_path = fs_root / "data" / "history.json"
    archive_json_path = fs_root / "data" / "archive" / f"{date}.json"
    dated_outputs = {
        archive_json_path: _json_bytes(rendered),
        fs_root / "archive" / f"{date}.html": _text_bytes(
            render_html(rendered, archive=True)
        ),
        fs_root / "social" / f"{date}-x.txt": _text_bytes(rendered["social"]["x"]),
        fs_root / "social" / f"{date}-linkedin.txt": _text_bytes(
            rendered["social"]["linkedin"]
        ),
    }
    outputs = {
        fs_root / "data" / "current.json": _json_bytes(rendered),
        output_root / "frontier-safety.html": _text_bytes(
            render_html(rendered, archive=False)
        ),
        **dated_outputs,
    }
    history = _load_history(history_path)
    entry = {
        "date": date,
        "sha256": digest,
        "state": rendered["edition_state"],
        "html": f"../archive/{date}.html",
        "json": f"archive/{date}.json",
    }
    proposed_history = deepcopy(history)
    matching_history = [
        index
        for index, item in enumerate(proposed_history["editions"])
        if item["date"] == date
    ]
    if matching_history:
        proposed_history["editions"][matching_history[0]] = entry
    else:
        proposed_history["editions"].append(entry)
        proposed_history["editions"].sort(key=lambda item: item["date"])
    outputs[history_path] = _json_bytes(proposed_history)

    _validate_archive_collision(
        date=date,
        digest=digest,
        history=history,
        dated_outputs=dated_outputs,
    )

    _publish_atomically(outputs, output_root)
    return {"edition_date": date, "edition_sha256": digest}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("edition", type=Path, help="Reviewed edition JSON")
    parser.add_argument("--output-root", type=Path, default=ROOT)
    args = parser.parse_args()
    result = build(args.edition, args.output_root)
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
