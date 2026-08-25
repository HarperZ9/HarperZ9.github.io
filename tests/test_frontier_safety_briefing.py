"""Publication contracts for the Frontier Safety Briefing."""

from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
EDITION_DATE = "2026-08-24"
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


def read_json(rel: str) -> dict | list:
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


def load_builder():
    path = ROOT / "tools" / "build_frontier_safety_briefing.py"
    spec = importlib.util.spec_from_file_location("frontier_safety_builder", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_first_edition_has_three_lanes_and_complete_evidence_boundaries() -> None:
    edition = read_json(f"frontier-safety/data/editions/{EDITION_DATE}.json")
    assert edition["edition_date"] == EDITION_DATE
    assert edition["observed_at"].endswith("Z")
    assert {lane["id"] for lane in edition["lanes"]} == {"aisi", "anthropic", "industry"}

    items = [item for lane in edition["lanes"] for item in lane["items"]]
    assert items
    for item in items:
        assert item["title"]
        assert item["status"] in {"baseline", "changed", "unchanged", "correction"}
        assert item["source_role"] in {
            "government report",
            "developer statement",
            "affected-party technical timeline",
            "independent analysis",
        }
        assert item["published_at"]
        assert item["event_time"]
        assert item["confidence"] in {"high", "moderate", "low"}
        assert item["summary"]
        assert item["does_not_prove"]
        assert item["sources"]
        for source in item["sources"]:
            assert urlparse(source["url"]).hostname in ALLOWED_SOURCE_HOSTS
            assert source["title"]


def test_public_copy_has_no_opaque_citations_private_paths_or_bare_severity() -> None:
    checked = [
        ROOT / "frontier-safety.html",
        ROOT / "frontier-safety" / "archive" / f"{EDITION_DATE}.html",
        ROOT / "frontier-safety" / "data" / "current.json",
        ROOT / "frontier-safety" / "data" / "archive" / f"{EDITION_DATE}.json",
        ROOT / "frontier-safety" / "social" / f"{EDITION_DATE}-x.txt",
        ROOT / "frontier-safety" / "social" / f"{EDITION_DATE}-linkedin.txt",
    ]
    for path in checked:
        source = path.read_text(encoding="utf-8")
        assert "turn137" not in source
        assert "chatgpt-content-reference" not in source
        assert "C:/dev" not in source and "C:\\dev" not in source
        assert not re.search(r"(?<![A-Za-z0-9_-])T[123](?![A-Za-z0-9_-])", source)
        assert "—" not in source


def test_current_archive_and_history_are_hash_consistent() -> None:
    current = read_json("frontier-safety/data/current.json")
    archived = read_json(f"frontier-safety/data/archive/{EDITION_DATE}.json")
    history = read_json("frontier-safety/data/history.json")
    builder = load_builder()

    assert current == archived
    assert history["editions"][-1]["date"] == EDITION_DATE
    assert history["editions"][-1]["sha256"] == builder.edition_sha256(current)
    dates = [entry["date"] for entry in history["editions"]]
    assert len(dates) == len(set(dates))


def test_generator_is_idempotent(tmp_path: Path) -> None:
    builder = load_builder()
    edition_path = ROOT / "frontier-safety" / "data" / "editions" / f"{EDITION_DATE}.json"
    first = builder.build(edition_path, tmp_path)
    second = builder.build(edition_path, tmp_path)
    assert first == second
    assert first["edition_sha256"] == builder.edition_sha256(read_json(str(edition_path.relative_to(ROOT))))


def test_page_metadata_social_copy_and_site_links() -> None:
    page = (ROOT / "frontier-safety.html").read_text(encoding="utf-8")
    archive = (ROOT / "frontier-safety" / "archive" / f"{EDITION_DATE}.html").read_text(encoding="utf-8")
    research = (ROOT / "research.html").read_text(encoding="utf-8")
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    x_copy = (ROOT / "frontier-safety" / "social" / f"{EDITION_DATE}-x.txt").read_text(encoding="utf-8").strip()
    linkedin = (ROOT / "frontier-safety" / "social" / f"{EDITION_DATE}-linkedin.txt").read_text(encoding="utf-8").strip()

    for html in (page, archive):
        assert html.count("<h1") == 1
        assert '<meta property="og:image" content="https://harperz9.github.io/img/og/telos.png">' in html
        assert "does not prove" in html.lower()
        assert "frontier-safety/data/current.json" in html or "../data/archive/" in html
    assert 'href="frontier-safety.html"' in research
    assert "https://harperz9.github.io/frontier-safety.html" in sitemap
    assert len(x_copy) <= 280
    assert 200 <= len(linkedin) <= 3000
    assert "https://harperz9.github.io/frontier-safety.html" in x_copy
    assert "https://harperz9.github.io/frontier-safety.html" in linkedin


def test_briefing_uses_the_shared_document_design_canon() -> None:
    page = (ROOT / "frontier-safety.html").read_text(encoding="utf-8")
    archive = (ROOT / "frontier-safety" / "archive" / f"{EDITION_DATE}.html").read_text(encoding="utf-8")
    stylesheet = (ROOT / "frontier-safety" / "frontier-safety.css").read_text(encoding="utf-8")

    for html in (page, archive):
        assert '<body class="doc frontier-briefing">' in html
        assert 'class="docnav"' in html
        assert 'class="sheet briefing-sheet"' in html
        assert 'class="mast briefing-mast"' in html
        assert 'class="data data--wide controls-table"' in html
        assert "kilon.woff2" not in html
        assert "conso-regular.woff2" in html

    assert '@import url("../system/doc.css")' in stylesheet
    assert "Kilon" not in stylesheet
    assert "initial-scan" not in stylesheet


def test_briefing_is_discoverable_from_the_catalog_index() -> None:
    catalog = (ROOT / "catalog.html").read_text(encoding="utf-8")

    assert 'href="frontier-safety.html"' in catalog


def test_source_registry_is_current_and_explicit_about_roles() -> None:
    registry = read_json("project-docs/zentropy-import/2026-08-24-source-register.json")
    assert registry["observed_at"].endswith("Z")
    assert len(registry["sources"]) >= 7
    for source in registry["sources"]:
        assert source["status"] in {"available", "pending", "context-only"}
        assert source["role"]
        assert source["does_not_prove"]
        assert urlparse(source["url"]).hostname in ALLOWED_SOURCE_HOSTS
