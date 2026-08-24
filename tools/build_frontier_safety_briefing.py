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
import re
from copy import deepcopy
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
ALLOWED_SOURCE_HOSTS = {
    "www.aisi.gov.uk",
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
ALLOWED_ROLES = {
    "government report",
    "developer statement",
    "affected-party technical timeline",
    "independent analysis",
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


def _validate_url(url: str, context: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_SOURCE_HOSTS:
        raise EditionError(f"{context} uses an unapproved source URL: {url}")


def validate_edition(edition: dict) -> None:
    if edition.get("schema_version") != 1:
        raise EditionError("schema_version must be 1")
    date = _require_text(edition, "edition_date", "edition")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        raise EditionError("edition_date must be YYYY-MM-DD")
    observed = _require_text(edition, "observed_at", "edition")
    if not observed.endswith("Z"):
        raise EditionError("observed_at must be UTC and end in Z")
    for key in ("title", "change_summary", "methodology"):
        _require_text(edition, key, "edition")

    lanes = edition.get("lanes")
    if not isinstance(lanes, list) or {lane.get("id") for lane in lanes} != ALLOWED_LANES:
        raise EditionError("edition must contain exactly the aisi, anthropic, and industry lanes")
    item_ids: set[str] = set()
    for lane in lanes:
        lane_id = lane["id"]
        _require_text(lane, "label", f"lane[{lane_id}]")
        _require_text(lane, "summary", f"lane[{lane_id}]")
        if lane.get("state") not in ALLOWED_STATES:
            raise EditionError(f"lane[{lane_id}].state is invalid")
        items = lane.get("items")
        if not isinstance(items, list) or not items:
            raise EditionError(f"lane[{lane_id}] must include at least one item")
        for item in items:
            item_id = _require_text(item, "id", f"lane[{lane_id}].item")
            if item_id in item_ids:
                raise EditionError(f"duplicate item id: {item_id}")
            item_ids.add(item_id)
            context = f"item[{item_id}]"
            for key in ("title", "published_at", "event_time", "summary", "does_not_prove"):
                _require_text(item, key, context)
            if item.get("status") not in ALLOWED_STATES:
                raise EditionError(f"{context}.status is invalid")
            if item.get("source_role") not in ALLOWED_ROLES:
                raise EditionError(f"{context}.source_role is invalid")
            if item.get("confidence") not in ALLOWED_CONFIDENCE:
                raise EditionError(f"{context}.confidence is invalid")
            sources = item.get("sources")
            if not isinstance(sources, list) or not sources:
                raise EditionError(f"{context}.sources must be non-empty")
            for index, source in enumerate(sources):
                _require_text(source, "title", f"{context}.sources[{index}]")
                url = _require_text(source, "url", f"{context}.sources[{index}]")
                _validate_url(url, f"{context}.sources[{index}]")

    for index, control in enumerate(edition.get("controls", [])):
        for key in ("claim", "announced_by", "status", "evidence_boundary"):
            _require_text(control, key, f"controls[{index}]")
        for url in control.get("sources", []):
            _validate_url(url, f"controls[{index}]")
    for index, question in enumerate(edition.get("open_questions", [])):
        if not isinstance(question, str) or not question.strip():
            raise EditionError(f"open_questions[{index}] must be non-empty text")
    social = edition.get("social", {})
    x_copy = _require_text(social, "x", "social")
    linkedin = _require_text(social, "linkedin", "social")
    if len(x_copy) > 280:
        raise EditionError("social.x exceeds 280 characters")
    if len(linkedin) > 3000:
        raise EditionError("social.linkedin exceeds 3000 characters")


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


def render_html(edition: dict, *, archive: bool) -> str:
    date = edition["edition_date"]
    if archive:
        root_prefix = "../../"
        css_href = "../frontier-safety.css"
        canonical = f"https://harperz9.github.io/frontier-safety/archive/{date}.html"
        data_href = f"../data/archive/{date}.json"
        page_label = "Dated archive"
    else:
        root_prefix = ""
        css_href = "frontier-safety/frontier-safety.css"
        canonical = "https://harperz9.github.io/frontier-safety.html"
        data_href = "frontier-safety/data/current.json"
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
<link rel="preload" href="{root_prefix}system/fonts/kilon.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{css_href}">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<div id="site-nav" class="site-nav"></div>
<noscript><nav class="site-nav"><a href="{root_prefix}index.html">Home</a> <a href="{root_prefix}research.html">Research</a></nav></noscript>
<script type="module" src="{root_prefix}system/nav.js?v=20260813-export2"></script>

<main id="main">
  <header class="briefing-hero">
    <div class="hero-kicker"><span>Frontier Safety Briefing</span><span>{_e(page_label)}</span></div>
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
    <div class="table-wrap"><table>
      <thead><tr><th>Source</th><th>Reported control</th><th>Evidence status</th></tr></thead>
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


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not content.endswith("\n"):
        content += "\n"
    path.write_text(content, encoding="utf-8", newline="\n")


def _write_json(path: Path, payload: dict | list) -> None:
    _write_text(path, json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=False))


def build(edition_path: Path, output_root: Path = ROOT) -> dict:
    edition = json.loads(edition_path.read_text(encoding="utf-8"))
    validate_edition(edition)
    digest = edition_sha256(edition)
    rendered = deepcopy(edition)
    rendered["edition_sha256"] = digest
    date = rendered["edition_date"]

    fs_root = output_root / "frontier-safety"
    _write_json(fs_root / "data" / "current.json", rendered)
    _write_json(fs_root / "data" / "archive" / f"{date}.json", rendered)
    _write_text(output_root / "frontier-safety.html", render_html(rendered, archive=False))
    _write_text(fs_root / "archive" / f"{date}.html", render_html(rendered, archive=True))
    _write_text(fs_root / "social" / f"{date}-x.txt", rendered["social"]["x"])
    _write_text(fs_root / "social" / f"{date}-linkedin.txt", rendered["social"]["linkedin"])

    history_path = fs_root / "data" / "history.json"
    if history_path.exists():
        history = json.loads(history_path.read_text(encoding="utf-8"))
    else:
        history = {"schema_version": 1, "editions": []}
    entry = {
        "date": date,
        "sha256": digest,
        "state": rendered["edition_state"],
        "html": f"../archive/{date}.html",
        "json": f"archive/{date}.json",
    }
    matches = [index for index, item in enumerate(history["editions"]) if item["date"] == date]
    if len(matches) > 1:
        raise EditionError(f"history contains duplicate date: {date}")
    if matches:
        history["editions"][matches[0]] = entry
    else:
        history["editions"].append(entry)
    history["editions"].sort(key=lambda item: item["date"])
    _write_json(history_path, history)
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
