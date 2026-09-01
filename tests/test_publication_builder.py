"""Deterministic static publication rendering contracts."""

from __future__ import annotations

import copy
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

from tools.build_publications import build, render_article, render_figure_svg
from tools.publication_model import PublicationError


ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests" / "fixtures" / "publication-record.json"
BRIEFING_URL = (
    "https://harperz9.github.io/briefings/"
    "2026-08-26-openai-hugging-face-incident/"
)


def fixture_site(tmp_path: Path) -> Path:
    root = tmp_path / "site"
    records = root / "publications" / "data" / "records"
    records.mkdir(parents=True)
    (records / "example-work.json").write_bytes(FIXTURE.read_bytes())
    (root / "publications.html").write_text(
        '<div data-publication-ledger>\n'
        '<!-- BEGIN GENERATED EDITORIAL PUBLICATIONS -->\n'
        '<!-- END GENERATED EDITORIAL PUBLICATIONS -->\n'
        '</div><p data-publication-result-count>0 published items shown.</p>\n',
        encoding="utf-8",
    )
    (root / "writing.html").write_text(
        '<main><!-- BEGIN GENERATED EDITORIAL ESSAYS -->\n'
        '<!-- END GENERATED EDITORIAL ESSAYS --></main>\n',
        encoding="utf-8",
    )
    (root / "sitemap.xml").write_text(
        '<urlset><!-- BEGIN GENERATED EDITORIAL ROUTES -->\n'
        '<!-- END GENERATED EDITORIAL ROUTES --></urlset>\n',
        encoding="utf-8",
    )
    (root / "feed.json").write_text(
        json.dumps(
            {
                "version": "https://jsonfeed.org/version/1.1",
                "title": "Zain Dana Harper research briefings",
                "home_page_url": "https://harperz9.github.io/briefings/",
                "feed_url": "https://harperz9.github.io/feed.json",
                "items": [
                    {
                        "id": BRIEFING_URL,
                        "url": BRIEFING_URL,
                        "title": "Five evidence lanes, one incident",
                        "content_text": "A canonical bounded briefing.",
                        "date_published": "2026-08-26T00:00:00Z",
                        "date_modified": "2026-08-27T00:00:00Z",
                    }
                ],
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    (root / "feed.xml").write_text("<feed/>\n", encoding="utf-8")
    return root


def snapshot(root: Path) -> dict[str, bytes]:
    return {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def load_fixture() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def write_record(root: Path, name: str, record: dict) -> Path:
    path = root / "publications" / "data" / "records" / name
    path.write_text(
        json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return path


def test_build_is_transactional_and_deterministic(tmp_path: Path) -> None:
    """A repeated build must not change any byte or receipt hash."""
    root = fixture_site(tmp_path)
    record_path = root / "publications/data/records/example-work.json"

    first = build([record_path], root)
    first_bytes = {path: (root / path).read_bytes() for path in first["outputs"]}
    second = build([record_path], root)

    assert first == second
    assert first_bytes == {path: (root / path).read_bytes() for path in second["outputs"]}
    assert "publications/build.json" not in first["outputs"]


def test_duplicate_route_leaves_site_unchanged(tmp_path: Path) -> None:
    """A route collision must be rejected before any public byte changes."""
    root = fixture_site(tmp_path)
    duplicate = copy.deepcopy(load_fixture())
    duplicate["id"] = "another-id"
    write_record(root, "duplicate.json", duplicate)
    before = snapshot(root)

    with pytest.raises(PublicationError, match="duplicate route"):
        build(sorted((root / "publications/data/records").glob("*.json")), root)

    assert snapshot(root) == before


def test_article_contains_complete_body_evidence_and_semantic_figure(tmp_path: Path) -> None:
    root = fixture_site(tmp_path)
    build([root / "publications/data/records/example-work.json"], root)
    article = (root / "example-work.html").read_text(encoding="utf-8")

    for literal in (
        "What was measured?",
        "One bounded result was observed.",
        "Evidence and limit.",
        "Primary source",
        "The bounded claim.",
        "General validity",
        "One observed value of one.",
        "AI assisted with research organization",
    ):
        assert literal in article
    assert "<table" in article
    assert "<script" not in article


def test_figure_data_has_parity_across_json_svg_html_and_article(tmp_path: Path) -> None:
    root = fixture_site(tmp_path)
    build([root / "publications/data/records/example-work.json"], root)
    figure = json.loads((root / "figures/example-figure.json").read_text(encoding="utf-8"))
    svg = (root / "figures/example-figure.svg").read_text(encoding="utf-8")
    figure_html = (root / "figures/example-figure.html").read_text(encoding="utf-8")
    article = (root / "example-work.html").read_text(encoding="utf-8")

    for row in figure["rows"]:
        for value in row:
            assert value in svg
            assert value in figure_html
            assert value in article
    svg_root = ET.fromstring(svg)
    namespace = {"svg": "http://www.w3.org/2000/svg"}
    title = svg_root.find("svg:title", namespace)
    description = svg_root.find("svg:desc", namespace)
    assert title is not None and title.text == "Example figure"
    assert description is not None and description.text == "One observed value of one."
    assert svg_root.attrib["aria-labelledby"].split() == [
        title.attrib["id"],
        description.attrib["id"],
    ]


def test_feed_preserves_canonical_briefing_and_adds_editorial_record(tmp_path: Path) -> None:
    root = fixture_site(tmp_path)
    build([root / "publications/data/records/example-work.json"], root)
    feed = json.loads((root / "feed.json").read_text(encoding="utf-8"))

    assert [item["url"] for item in feed["items"]] == [
        "https://harperz9.github.io/example-work.html",
        BRIEFING_URL,
    ]
    assert "example-work.html" in (root / "publications.html").read_text(encoding="utf-8")
    assert "example-work.html" in (root / "writing.html").read_text(encoding="utf-8")
    assert "example-work.html" in (root / "sitemap.xml").read_text(encoding="utf-8")


def test_missing_marker_fails_before_writes(tmp_path: Path) -> None:
    root = fixture_site(tmp_path)
    (root / "writing.html").write_text("<main></main>\n", encoding="utf-8")
    before = snapshot(root)

    with pytest.raises(PublicationError, match="marker"):
        build([root / "publications/data/records/example-work.json"], root)

    assert snapshot(root) == before


def test_documented_direct_cli_invocation_loads_repository_modules() -> None:
    result = subprocess.run(
        [sys.executable, str(ROOT / "tools/build_publications.py"), "--help"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert "--records-dir" in result.stdout


def test_svg_wraps_long_cells_and_allocates_nonoverlapping_rows() -> None:
    figure = json.loads(FIXTURE.read_text(encoding="utf-8"))["figures"][0]
    figure["columns"] = ["Study", "Scope and denominator", "Reported result"]
    figure["rows"] = [
        [
            "S1",
            "Forty participants across two cohorts and twelve excerpts",
            "The reported result remains bounded by the study design",
        ],
        [
            "S2",
            "Ninety-six recruited participants with two exclusions",
            "No cross-study magnitude comparison is supported",
        ],
    ]

    svg = render_figure_svg(figure)
    root = ET.fromstring(svg)
    namespace = {"svg": "http://www.w3.org/2000/svg"}
    text = " ".join(
        part.strip() for part in root.itertext() if part and part.strip()
    )
    data_rows = [
        element
        for element in root.findall("svg:rect", namespace)
        if element.attrib.get("class") == "data-row"
    ]

    assert len(root.findall(".//svg:tspan", namespace)) > 6
    assert "Forty participants across two cohorts and twelve excerpts" in text
    assert len(data_rows) == 2
    first_bottom = float(data_rows[0].attrib["y"]) + float(data_rows[0].attrib["height"])
    assert first_bottom <= float(data_rows[1].attrib["y"])


def test_article_namespaces_figure_anchors_away_from_section_ids() -> None:
    record = json.loads(FIXTURE.read_text(encoding="utf-8"))
    record["figures"][0]["id"] = record["sections"][0]["id"]

    article = render_article(record)
    identifiers = re.findall(r'\bid="([^"]+)"', article)

    assert len(identifiers) == len(set(identifiers))
    assert f'figure-{record["figures"][0]["id"]}' in identifiers
