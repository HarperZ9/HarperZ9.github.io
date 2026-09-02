"""Build reviewed publication records into deterministic static site artifacts."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import sys
import tempfile
import textwrap
from pathlib import Path
from urllib.parse import urlparse
from xml.sax.saxutils import escape as xml_escape

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools.publication_model import (
    PublicationError,
    canonical_json_bytes,
    idempotency_key,
    load_record,
    record_sha256,
)


ROOT = Path(__file__).resolve().parents[1]
SITE_URL = "https://harperz9.github.io/"
ASSET_REVISION = "20260902-creative-chassis"
PUBLICATIONS_MARKER = "GENERATED EDITORIAL PUBLICATIONS"
WRITING_MARKER = "GENERATED EDITORIAL ESSAYS"
SITEMAP_MARKER = "GENERATED EDITORIAL ROUTES"
RESULT_COUNT_PATTERN = re.compile(
    r"(<p[^>]*data-publication-result-count[^>]*>).*?(</p>)", re.DOTALL
)


def _json_bytes(value: dict | list) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _text_bytes(value: str) -> bytes:
    return value.replace("\r\n", "\n").encode("utf-8")


def _sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def replace_marker_block(text: str, name: str, rendered: str) -> str:
    begin = f"<!-- BEGIN {name} -->"
    end = f"<!-- END {name} -->"
    if text.count(begin) != 1 or text.count(end) != 1:
        raise PublicationError(f"expected exactly one {name} marker block")
    before, remainder = text.split(begin, 1)
    _old, after = remainder.split(end, 1)
    body = rendered.strip()
    middle = f"\n{body}\n" if body else "\n"
    return before + begin + middle + end + after


def load_existing_briefings(root: Path) -> list[dict]:
    path = root / "feed.json"
    if not path.is_file():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise PublicationError(f"cannot read existing briefing feed: {error}") from error
    items = payload.get("items")
    if not isinstance(items, list):
        raise PublicationError("existing feed items must be a list")
    briefings: list[dict] = []
    for item in items:
        if not isinstance(item, dict):
            raise PublicationError("existing feed item must be an object")
        url = item.get("url")
        if not isinstance(url, str) or "/briefings/" not in urlparse(url).path:
            continue
        required = (
            "id",
            "url",
            "title",
            "content_text",
            "date_published",
            "date_modified",
        )
        if any(not isinstance(item.get(key), str) or not item[key] for key in required):
            raise PublicationError("canonical briefing feed item is incomplete")
        briefings.append({key: item[key] for key in required})
    return briefings


def _render_table(figure: dict) -> str:
    headings = "".join(f"<th scope=\"col\">{html.escape(value)}</th>" for value in figure["columns"])
    rows = "".join(
        "<tr>"
        + "".join(
            (
                f"<th scope=\"row\">{html.escape(value)}</th>"
                if index == 0
                else f"<td>{html.escape(value)}</td>"
            )
            for index, value in enumerate(row)
        )
        + "</tr>"
        for row in figure["rows"]
    )
    return (
        '<div class="publication-table-wrap"><table class="publication-figure-table">'
        f"<caption>{html.escape(figure['title'])}. {html.escape(figure['claim'])}</caption>"
        f"<thead><tr>{headings}</tr></thead><tbody>{rows}</tbody></table></div>"
    )


def _render_figure_metadata(figure: dict) -> str:
    pairs = (
        ("Scope", figure["scope"]),
        ("Units", figure["units"]),
        ("Denominator", figure["denominator"]),
        ("Date", figure["date"]),
        ("Transformation", figure["transformation"]),
        ("Uncertainty", figure["uncertainty"]),
        ("Limitations", figure["limitations"]),
        ("Does not prove", figure["doesNotProve"]),
    )
    return '<dl class="publication-evidence">' + "".join(
        f"<dt>{html.escape(label)}</dt><dd>{html.escape(value)}</dd>"
        for label, value in pairs
    ) + "</dl>"


def _svg_lines(value: str, width: int) -> list[str]:
    return textwrap.wrap(
        value,
        width=max(8, width),
        break_long_words=False,
        break_on_hyphens=False,
    ) or [value]


def _svg_text(
    lines: list[str],
    *,
    x: float,
    y: float,
    class_name: str,
    line_height: int,
    anchor: str = "middle",
) -> str:
    spans = []
    for index, line in enumerate(lines):
        position = f'y="{y:.1f}"' if index == 0 else f'dy="{line_height}"'
        spans.append(f'<tspan x="{x:.1f}" {position}>{xml_escape(line)}</tspan>')
    return (
        f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="{anchor}" '
        f'class="{class_name}">{"".join(spans)}</text>'
    )


def render_figure_svg(figure: dict) -> str:
    width = 1200
    margin = 24
    table_width = width - margin * 2
    column_width = table_width / max(1, len(figure["columns"]))
    wrap_width = max(8, int((column_width - 24) / 8.2))

    title_lines = _svg_lines(figure["title"], 68)
    claim_lines = _svg_lines(figure["claim"], 106)
    title_y = 42
    claim_y = title_y + (len(title_lines) - 1) * 32 + 34
    header_top = claim_y + (len(claim_lines) - 1) * 21 + 30
    header_lines = [_svg_lines(value, wrap_width) for value in figure["columns"]]
    header_height = max(52, max(map(len, header_lines)) * 20 + 22)
    row_top = float(header_top + header_height)

    column_labels = "".join(
        _svg_text(
            lines,
            x=margin + column_width * (index + 0.5),
            y=header_top + 23,
            class_name="head",
            line_height=20,
        )
        for index, lines in enumerate(header_lines)
    )
    rendered_rows: list[str] = []
    for row_index, row in enumerate(figure["rows"]):
        wrapped = [_svg_lines(value, wrap_width) for value in row]
        row_height = max(54, max(map(len, wrapped)) * 19 + 24)
        fill = "#f1eee8" if row_index % 2 == 0 else "#ffffff"
        rendered_rows.append(
            f'<rect class="data-row" x="{margin}" y="{row_top:.1f}" '
            f'width="{table_width}" height="{row_height}" rx="5" fill="{fill}"/>'
        )
        for column_index, lines in enumerate(wrapped):
            rendered_rows.append(
                _svg_text(
                    lines,
                    x=margin + column_width * (column_index + 0.5),
                    y=row_top + 24,
                    class_name="cell",
                    line_height=19,
                )
            )
        row_top += row_height

    height = int(row_top + 28)
    title_text = _svg_text(
        title_lines,
        x=margin,
        y=title_y,
        class_name="title",
        line_height=32,
        anchor="start",
    )
    claim_text = _svg_text(
        claim_lines,
        x=margin,
        y=claim_y,
        class_name="cell",
        line_height=21,
        anchor="start",
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">
<title id="title">{xml_escape(figure["title"])}</title>
<desc id="desc">{xml_escape(figure["alt"])}</desc>
<style>.title{{font:700 27px system-ui,sans-serif;fill:#161412}}.head{{font:650 17px ui-monospace,monospace;fill:#3f3a34}}.cell{{font:16px system-ui,sans-serif;fill:#161412}}</style>
<rect width="1200" height="{height}" fill="#fbfaf7"/>
{title_text}
{claim_text}
{column_labels}
{"".join(rendered_rows)}
</svg>
'''


def render_figure_html(figure: dict) -> str:
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(figure["title"])}</title><link rel="stylesheet" href="../system/publication-article.css?v={ASSET_REVISION}"></head>
<body><nav class="publication-static-nav" aria-label="Publication"><a href="../publications.html">Publications</a></nav><main class="publication-article"><h1>{html.escape(figure["title"])}</h1>
<p class="publication-thesis">{html.escape(figure["claim"])}</p>
{_render_table(figure)}{_render_figure_metadata(figure)}</main></body></html>
'''


def _render_figure_in_article(figure: dict) -> str:
    return (
        f'<section class="publication-figure" id="figure-{html.escape(figure["id"])}">'
        f'<h2>{html.escape(figure["title"])}</h2>'
        f'<p>{html.escape(figure["claim"])}</p>'
        f'<img src="figures/{html.escape(figure["id"])}.svg" alt="{html.escape(figure["alt"], quote=True)}">'
        + _render_table(figure)
        + _render_figure_metadata(figure)
        + "</section>"
    )


def render_article(record: dict) -> str:
    canonical = SITE_URL + record["route"]
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
        f'{html.escape(source["publisher"])}. {html.escape(source["role"])}. Published {html.escape(source["published_at"])}; observed {html.escape(source["observed_at"])}.</li>'
        for source in record["sources"]
    )
    claim_rows = "".join(
        "<tr>"
        f'<th scope="row">{html.escape(claim["id"])}</th>'
        f'<td>{html.escape(claim["text"])}</td>'
        f'<td>{html.escape(claim["status"])}</td>'
        f'<td>{html.escape(", ".join(claim["source_ids"]))}</td>'
        f'<td>{html.escape(claim["scope"])}</td>'
        f'<td>{html.escape(claim["uncertainty"])}</td>'
        f'<td>{html.escape(claim["doesNotProve"])}</td>'
        "</tr>"
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
<meta property="og:image" content="{SITE_URL}img/og/{html.escape(record["id"], quote=True)}.png">
<link rel="stylesheet" href="system/publication-article.css?v={ASSET_REVISION}"></head>
<body><a class="skip-link" href="#main">Skip to content</a><nav class="publication-static-nav" aria-label="Publication"><a href="publications.html">Publications</a><a href="writing.html">Writing</a><a href="cv.html">About</a></nav>
<main id="main" class="publication-article"><article><header><p class="publication-kicker">{html.escape(record["form"])} · {html.escape(record["category"])}</p>
<h1>{html.escape(record["title"])}</h1><p class="publication-thesis">{html.escape(record["thesis"])}</p>
<p class="publication-meta">Published {html.escape(record["published_at"])} · Updated {html.escape(record["updated_at"])}</p></header>
<section class="publication-opening" aria-label="Question, finding, evidence, and limit">{opening}</section>
{sections}{figures}
<section id="sources"><h2>Sources</h2><ol>{sources}</ol></section>
<section id="claim-ledger"><h2>Claim ledger</h2><div class="publication-table-wrap"><table><thead><tr><th>Claim</th><th>Text</th><th>Status</th><th>Sources</th><th>Scope</th><th>Uncertainty</th><th>Does not prove</th></tr></thead><tbody>{claim_rows}</tbody></table></div></section>
<section id="corrections"><h2>Corrections</h2>{corrections}</section>
<footer><h2>Authorship and process</h2><p>{html.escape(record["ai_assistance"])}</p></footer>
</article></main></body></html>
'''


def _render_publication_entry(record: dict) -> str:
    topics = html.escape((record["category"] + " " + record["form"]).replace("-", " "))
    return (
        f'<article data-publication-entry data-topics="{topics}">'
        f'<p class="publication-meta">{html.escape(record["form"].title())} · {html.escape(record["updated_at"])}</p>'
        f'<h3><a href="{html.escape(record["route"])}">{html.escape(record["title"])}</a></h3>'
        f'<p>{html.escape(record["summary"])}</p></article>'
    )


def _render_writing_entry(record: dict) -> str:
    return (
        f'<article class="sheet essay generated-editorial" id="{html.escape(record["id"])}">'
        f'<p class="role">{html.escape(record["form"])} · {html.escape(record["category"])}</p>'
        f'<h2><a href="{html.escape(record["route"])}">{html.escape(record["title"])}</a></h2>'
        f'<p>{html.escape(record["summary"])}</p></article>'
    )


def _feed_item(record: dict) -> dict:
    url = SITE_URL + record["route"]
    return {
        "id": url,
        "url": url,
        "title": record["title"],
        "content_text": record["summary"],
        "date_published": record["published_at"] + "T00:00:00Z",
        "date_modified": record["updated_at"] + "T00:00:00Z",
    }


def _render_atom(items: list[dict]) -> str:
    updated = max((item["date_modified"] for item in items), default="1970-01-01T00:00:00Z")
    entries = "".join(
        "<entry>"
        f'<id>{xml_escape(item["id"])}</id><title>{xml_escape(item["title"])}</title>'
        f'<link href="{xml_escape(item["url"])}"/><published>{xml_escape(item["date_published"])}</published>'
        f'<updated>{xml_escape(item["date_modified"])}</updated><summary>{xml_escape(item["content_text"])}</summary>'
        "</entry>"
        for item in items
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<feed xmlns="http://www.w3.org/2005/Atom"><id>https://harperz9.github.io/publications.html</id>'
        '<title>Zain Dana Harper publications</title><author><name>Zain Dana Harper</name></author>'
        f'<updated>{updated}</updated><link rel="self" href="https://harperz9.github.io/feed.xml"/>'
        '<link href="https://harperz9.github.io/publications.html"/>' + entries + "</feed>\n"
    )


def _validate_record_set(records: list[dict]) -> None:
    ids = [record["id"] for record in records]
    routes = [record["route"] for record in records]
    keys = [idempotency_key(record) for record in records]
    if len(ids) != len(set(ids)):
        raise PublicationError("duplicate publication id")
    if len(routes) != len(set(routes)):
        raise PublicationError("duplicate route")
    if len(keys) != len(set(keys)):
        raise PublicationError("duplicate publication idempotency key")


def planned_outputs(records: list[dict], root: Path) -> dict[str, bytes]:
    _validate_record_set(records)
    publications_source = (root / "publications.html").read_text(encoding="utf-8")
    writing_source = (root / "writing.html").read_text(encoding="utf-8")
    sitemap_source = (root / "sitemap.xml").read_text(encoding="utf-8")
    existing_briefings = load_existing_briefings(root)

    records = sorted(records, key=lambda record: (record["updated_at"], record["route"]), reverse=True)
    publication_entries = "\n".join(_render_publication_entry(record) for record in records)
    writing_entries = "\n".join(_render_writing_entry(record) for record in records)
    route_entries = "\n".join(
        f"  <url><loc>{SITE_URL}{html.escape(record['route'])}</loc></url>" for record in records
    )
    publications_source = replace_marker_block(publications_source, PUBLICATIONS_MARKER, publication_entries)
    writing_source = replace_marker_block(writing_source, WRITING_MARKER, writing_entries)
    sitemap_source = replace_marker_block(sitemap_source, SITEMAP_MARKER, route_entries)
    count = publications_source.count("data-publication-entry")
    publications_source, count_replacements = RESULT_COUNT_PATTERN.subn(
        lambda match: f"{match.group(1)}{count} published {'item' if count == 1 else 'items'} shown.{match.group(2)}",
        publications_source,
        count=1,
    )
    if count_replacements != 1:
        raise PublicationError("publication result-count marker is missing")

    outputs: dict[str, bytes] = {
        "publications.html": _text_bytes(publications_source),
        "writing.html": _text_bytes(writing_source),
        "sitemap.xml": _text_bytes(sitemap_source),
    }
    index_records: list[dict] = []
    for record in records:
        outputs[record["route"]] = _text_bytes(render_article(record))
        index_records.append(
            {
                "id": record["id"],
                "route": record["route"],
                "category": record["category"],
                "form": record["form"],
                "published_at": record["published_at"],
                "updated_at": record["updated_at"],
                "record_sha256": record_sha256(record),
                "idempotency_key": idempotency_key(record),
            }
        )
        for figure in record["figures"]:
            prefix = f"figures/{figure['id']}"
            outputs[prefix + ".svg"] = _text_bytes(render_figure_svg(figure))
            outputs[prefix + ".json"] = _json_bytes(figure)
            outputs[prefix + ".html"] = _text_bytes(render_figure_html(figure))

    index = {"schema_version": 1, "records": sorted(index_records, key=lambda item: item["route"])}
    outputs["publications/data/index.json"] = _json_bytes(index)
    feed_items = existing_briefings + [_feed_item(record) for record in records]
    feed_items.sort(key=lambda item: (item["date_modified"], item["url"]), reverse=True)
    outputs["feed.json"] = _json_bytes(
        {
            "version": "https://jsonfeed.org/version/1.1",
            "title": "Zain Dana Harper publications",
            "home_page_url": SITE_URL + "publications.html",
            "feed_url": SITE_URL + "feed.json",
            "items": feed_items,
        }
    )
    outputs["feed.xml"] = _text_bytes(_render_atom(feed_items))
    return outputs


def _publish_atomically(outputs: dict[str, bytes], root: Path) -> None:
    backups: dict[str, bytes | None] = {}
    with tempfile.TemporaryDirectory(prefix="publication-build-", dir=root) as temp_name:
        temp_root = Path(temp_name)
        for relative, content in outputs.items():
            staged = temp_root / relative
            staged.parent.mkdir(parents=True, exist_ok=True)
            staged.write_bytes(content)
        replaced: list[str] = []
        try:
            for relative in sorted(outputs):
                destination = root / relative
                backups[relative] = destination.read_bytes() if destination.is_file() else None
                destination.parent.mkdir(parents=True, exist_ok=True)
                os.replace(temp_root / relative, destination)
                replaced.append(relative)
        except Exception:
            for relative in reversed(replaced):
                destination = root / relative
                previous = backups[relative]
                if previous is None:
                    destination.unlink(missing_ok=True)
                else:
                    destination.write_bytes(previous)
            raise


def build(record_paths: list[Path], output_root: Path = ROOT) -> dict:
    root = output_root.resolve()
    paths = [path.resolve() for path in record_paths]
    records = [load_record(path) for path in paths]
    outputs = planned_outputs(records, root)
    latest = max(record["updated_at"] for record in records)
    receipt = {
        "schema_version": 1,
        "built_at": latest + "T00:00:00Z",
        "inputs": {
            path.relative_to(root).as_posix(): record_sha256(record)
            for path, record in sorted(zip(paths, records), key=lambda pair: pair[0].as_posix())
        },
        "outputs": {relative: _sha256(content) for relative, content in sorted(outputs.items())},
    }
    all_outputs = dict(outputs)
    all_outputs["publications/build.json"] = _json_bytes(receipt)
    _publish_atomically(all_outputs, root)
    return receipt


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--records-dir", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, default=ROOT)
    args = parser.parse_args()
    paths = sorted(args.records_dir.glob("*.json"))
    if not paths:
        raise SystemExit("No publication records found.")
    print(json.dumps(build(paths, args.output_root), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
