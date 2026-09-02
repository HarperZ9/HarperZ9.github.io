"""Publication contracts for the Frontier Safety Briefing."""

from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
BASELINE_EDITION_DATE = "2026-08-24"
CURRENT_EDITION_DATE = json.loads(
    (ROOT / "frontier-safety" / "data" / "current.json").read_text(encoding="utf-8")
)["edition_date"]
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

CANONICAL_OPENAI_HUGGING_FACE_BRIEFING = (
    "https://harperz9.github.io/briefings/2026-08-26-openai-hugging-face-incident/"
)


def read_json(rel: str) -> dict | list:
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


def load_builder():
    path = ROOT / "tools" / "build_frontier_safety_briefing.py"
    spec = importlib.util.spec_from_file_location("frontier_safety_builder", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_current_edition_has_three_lanes_and_complete_evidence_boundaries() -> None:
    edition = read_json(f"frontier-safety/data/editions/{CURRENT_EDITION_DATE}.json")
    assert edition["edition_date"] == CURRENT_EDITION_DATE
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
            "publication notice",
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


def test_current_digest_routes_incident_detail_to_the_canonical_briefing() -> None:
    edition = read_json(f"frontier-safety/data/editions/{CURRENT_EDITION_DATE}.json")
    current = read_json("frontier-safety/data/current.json")
    archive = read_json(f"frontier-safety/data/archive/{CURRENT_EDITION_DATE}.json")
    page = (ROOT / "frontier-safety.html").read_text(encoding="utf-8")

    notices = [
        item
        for lane in edition["lanes"]
        for item in lane["items"]
        if item["id"] == "openai-hugging-face-incident-publication-notice"
    ]
    assert len(notices) == 1
    assert all(
        item["id"] != "hugging-face-2026-07-27-timeline"
        for lane in edition["lanes"]
        for item in lane["items"]
    )
    notice = notices[0]
    assert notice["source_role"] == "publication notice"
    assert {source["url"] for source in notice["sources"]} == {
        CANONICAL_OPENAI_HUGGING_FACE_BRIEFING,
    }

    recurring_copy = "\n".join(
        [
            notice["summary"],
            notice["does_not_prove"],
            edition["social"]["x"],
            edition["social"]["linkedin"],
        ]
    )
    for duplicated_metric in (
        "1,200",
        "70,000",
        "700 attacked",
        "95%",
        "5%",
        "17,600",
        "6,280",
    ):
        assert duplicated_metric not in recurring_copy
        assert duplicated_metric not in page
    for incident_term in ("OpenAI", "Hugging Face", "METR", "Redwood", "incident"):
        assert incident_term.lower() not in edition["social"]["x"].lower()
        assert incident_term.lower() not in edition["social"]["linkedin"].lower()

    stale_question = (
        "When will METR and Redwood Research publish the announced case-specific "
        "assessment, and what scope will it cover?"
    )
    assert stale_question not in edition["open_questions"]
    assert "previously watched OpenAI URLs" in edition["change_summary"]
    assert current == archive
    assert CANONICAL_OPENAI_HUGGING_FACE_BRIEFING in page


def test_every_frontier_safety_archive_is_discoverable_from_the_sitemap() -> None:
    history = read_json("frontier-safety/data/history.json")
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")

    for edition in history["editions"]:
        assert (
            f"https://harperz9.github.io/frontier-safety/archive/{edition['date']}.html" in sitemap
        )


def test_public_copy_has_no_opaque_citations_private_paths_or_bare_severity() -> None:
    checked = [
        ROOT / "frontier-safety.html",
        ROOT / "frontier-safety" / "archive" / f"{CURRENT_EDITION_DATE}.html",
        ROOT / "frontier-safety" / "data" / "current.json",
        ROOT / "frontier-safety" / "data" / "archive" / f"{CURRENT_EDITION_DATE}.json",
        ROOT / "frontier-safety" / "social" / f"{CURRENT_EDITION_DATE}-x.txt",
        ROOT / "frontier-safety" / "social" / f"{CURRENT_EDITION_DATE}-linkedin.txt",
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
    archived = read_json(f"frontier-safety/data/archive/{CURRENT_EDITION_DATE}.json")
    history = read_json("frontier-safety/data/history.json")
    builder = load_builder()

    assert current == archived
    assert history["editions"][-1]["date"] == CURRENT_EDITION_DATE
    assert history["editions"][-1]["sha256"] == builder.edition_sha256(current)
    dates = [entry["date"] for entry in history["editions"]]
    assert len(dates) == len(set(dates))


def test_current_edition_records_unposted_social_publication() -> None:
    edition = read_json(f"frontier-safety/data/editions/{CURRENT_EDITION_DATE}.json")
    current = read_json("frontier-safety/data/current.json")
    archived = read_json(f"frontier-safety/data/archive/{CURRENT_EDITION_DATE}.json")
    expected = {
        "x": {"state": "not_posted", "post_url": None},
        "linkedin": {"state": "not_posted", "post_url": None},
    }

    assert edition["social_publication"] == expected
    assert current["social_publication"] == expected
    assert archived["social_publication"] == expected
    assert current == archived
    assert (
        ROOT / "frontier-safety" / "social" / f"{CURRENT_EDITION_DATE}-x.txt"
    ).read_text(encoding="utf-8").strip() == edition["social"]["x"]
    assert (
        ROOT / "frontier-safety" / "social" / f"{CURRENT_EDITION_DATE}-linkedin.txt"
    ).read_text(encoding="utf-8").strip() == edition["social"]["linkedin"]


def test_generator_is_idempotent(tmp_path: Path) -> None:
    builder = load_builder()
    edition_path = ROOT / "frontier-safety" / "data" / "editions" / f"{CURRENT_EDITION_DATE}.json"
    first = builder.build(edition_path, tmp_path)
    second = builder.build(edition_path, tmp_path)
    assert first == second
    assert first["edition_sha256"] == builder.edition_sha256(read_json(str(edition_path.relative_to(ROOT))))


def test_page_metadata_social_copy_and_site_links() -> None:
    page = (ROOT / "frontier-safety.html").read_text(encoding="utf-8")
    archive = (ROOT / "frontier-safety" / "archive" / f"{CURRENT_EDITION_DATE}.html").read_text(encoding="utf-8")
    research = (ROOT / "research.html").read_text(encoding="utf-8")
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    x_copy = (ROOT / "frontier-safety" / "social" / f"{CURRENT_EDITION_DATE}-x.txt").read_text(encoding="utf-8").strip()
    linkedin = (ROOT / "frontier-safety" / "social" / f"{CURRENT_EDITION_DATE}-linkedin.txt").read_text(encoding="utf-8").strip()

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


def test_briefing_uses_the_shared_site_design_canon() -> None:
    page = (ROOT / "frontier-safety.html").read_text(encoding="utf-8")
    archive = (ROOT / "frontier-safety" / "archive" / f"{BASELINE_EDITION_DATE}.html").read_text(encoding="utf-8")
    stylesheet = (ROOT / "frontier-safety" / "frontier-safety-site.css").read_text(encoding="utf-8")

    assert '<body class="inner-clean frame-compact frontier-briefing">' in page
    assert 'class="frame briefing-hero"' in page
    assert 'class="bar"' in page
    assert 'class="mid briefing-intro"' in page
    assert 'class="plate plate--slim briefing-plate"' in page
    assert '<main id="main">' in page
    assert 'class="mv briefing-overview"' in page
    assert 'class="mv lane"' in page
    assert 'class="data data--wide controls-table"' in page
    assert 'class="footer-seal"' in page
    assert "system/reveal.js" in page
    assert "conso-regular.woff2" in page
    assert '<meta name="theme-color" content="#070406">' in page

    # A published dated archive is immutable. Its original document shell and
    # stylesheet remain byte-for-byte reproducible while the live and future
    # editions move to the site's shared presentation.
    assert '<body class="doc frontier-briefing">' in archive
    assert 'href="../frontier-safety.css?v=20260902-creative-chassis"' in archive

    assert '@import url("../system/system.css' in stylesheet
    assert '@import url("../system/doc.css")' not in stylesheet
    assert "Kilon" not in stylesheet
    assert "initial-scan" not in stylesheet


def test_controls_matrix_documents_its_accessible_analysis_contract() -> None:
    page = (ROOT / "frontier-safety.html").read_text(encoding="utf-8")
    archive = (
        ROOT / "frontier-safety" / "archive" / f"{CURRENT_EDITION_DATE}.html"
    ).read_text(encoding="utf-8")

    for document in (page, archive):
        assert f"Source-scope matrix for edition {CURRENT_EDITION_DATE}." in document
        assert "Sources: each row links to its supporting public record." in document
        assert "Unit: one reported control per row." in document
        assert "Transformation: controls are grouped by reporting organization" in document
        assert "Limitations and non-proof:" in document


def test_future_dated_archives_use_the_shared_site_shell_and_nested_paths() -> None:
    builder = load_builder()
    future = read_json(f"frontier-safety/data/editions/{BASELINE_EDITION_DATE}.json")
    future["edition_date"] = "2026-08-26"
    future["observed_at"] = "2026-08-26T16:00:00Z"

    archive = builder.render_html(future, archive=True)

    assert '<body class="inner-clean frame-compact frontier-briefing">' in archive
    assert 'href="../frontier-safety-site.css?v=20260902-creative-chassis"' in archive
    assert 'src="../../system/nav.js?v=20260902-creative-chassis"' in archive
    assert 'href="../data/archive/2026-08-26.json"' in archive
    assert 'href="../../research.html"' in archive
    assert 'class="docnav"' not in archive


def test_briefing_is_discoverable_from_shared_route_surfaces() -> None:
    routes = (ROOT / "system/routes.js").read_text(encoding="utf-8")
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")

    assert "frontier-safety.html" in routes
    assert "https://harperz9.github.io/frontier-safety.html" in sitemap


def test_source_registry_is_current_and_explicit_about_roles() -> None:
    registry = read_json("project-docs/zentropy-import/2026-08-24-source-register.json")
    assert registry["observed_at"].endswith("Z")
    assert len(registry["sources"]) >= 7
    for source in registry["sources"]:
        assert source["status"] in {"available", "pending", "context-only"}
        assert source["role"]
        assert source["does_not_prove"]
        assert urlparse(source["url"]).hostname in ALLOWED_SOURCE_HOSTS
