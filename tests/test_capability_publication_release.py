"""Selective-release contract for the reviewed capability/publication spine."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]

RELEASE_PATHS = (
    "assets/index-B9IQuAmM.js",
    "assets/index-BxIHiu3n.css",
    "accountable-surface.html",
    "availability-is-not-reach.html",
    "analytics/benchmark-evidence-status.html",
    "analytics/benchmark-evidence-status.json",
    "analytics/current-cross-harness-pilot.html",
    "analytics/current-cross-harness-pilot.json",
    "analytics/current-cross-harness-pilot.svg",
    "analytics/exploratory-stack-comparison.html",
    "analytics/exploratory-stack-comparison.json",
    "analytics/exploratory-stack-comparison.svg",
    "analytics/market-baseline-plan.json",
    "analytics/model-pass-at-1-comparison.html",
    "analytics/model-pass-at-1-comparison.json",
    "analytics/model-pass-at-1-comparison.svg",
    "analytics/portfolio-analytics.json",
    "analytics/portfolio-source-inventory.html",
    "analytics/portfolio-source-inventory.json",
    "analytics/source/current-cross-harness-pilot-source.json",
    "brender-archival.html",
    "briefings/2026-08-26-openai-hugging-face-incident/build.json",
    "briefings/2026-08-26-openai-hugging-face-incident/claims.json",
    "briefings/2026-08-26-openai-hugging-face-incident/figures.json",
    "briefings/2026-08-26-openai-hugging-face-incident/index.html",
    "briefings/2026-08-26-openai-hugging-face-incident/publication.json",
    "briefings/2026-08-26-openai-hugging-face-incident/social/linkedin.txt",
    "briefings/2026-08-26-openai-hugging-face-incident/social/x.txt",
    "briefings/2026-08-26-openai-hugging-face-incident/sources.json",
    "briefings/index.html",
    "career/career-artifacts.json",
    "career/career-build-receipt.json",
    "career/open-source-census.json",
    "career/Zain-Dana-Harper-CV.docx",
    "career/Zain-Dana-Harper-CV.pdf",
    "career/Zain-Dana-Harper-Cover-Letter.docx",
    "career/Zain-Dana-Harper-Cover-Letter.pdf",
    "career/Zain-Dana-Harper-Portfolio-Brief.docx",
    "career/Zain-Dana-Harper-Portfolio-Brief.pdf",
    "career/Zain-Dana-Harper-Resume-Evaluation-Tooling-Python-Developer-Tools.docx",
    "career/Zain-Dana-Harper-Resume-Evaluation-Tooling-Python-Developer-Tools.pdf",
    "career/Zain-Dana-Harper-Resume-Grounds.docx",
    "career/Zain-Dana-Harper-Resume-Grounds.pdf",
    "career/Zain-Dana-Harper-Resume-Public-Operations.docx",
    "career/Zain-Dana-Harper-Resume-Public-Operations.pdf",
    "career/Zain-Dana-Harper-Resume-Support-Developer-Operations-QA.docx",
    "career/Zain-Dana-Harper-Resume-Support-Developer-Operations-QA.pdf",
    "catalog.html",
    "cover-letter.html",
    "cv.html",
    "cv.md",
    "dossier.html",
    "feed.json",
    "feed.xml",
    "figures/availability-is-not-reach.html",
    "figures/availability-is-not-reach.json",
    "figures/availability-is-not-reach.svg",
    "figures/claim-provenance-panel.html",
    "figures/claim-provenance-panel.json",
    "figures/claim-provenance-panel.svg",
    "figures/control-boundary-flow.html",
    "figures/control-boundary-flow.json",
    "figures/control-boundary-flow.svg",
    "figures/graphics-retro-capability-map.html",
    "figures/graphics-retro-capability-map.json",
    "figures/graphics-retro-capability-map.svg",
    "figures/incident-multilane-timeline.html",
    "figures/incident-multilane-timeline.json",
    "figures/incident-multilane-timeline.svg",
    "figures/label-is-a-lens.html",
    "figures/label-is-a-lens.json",
    "figures/label-is-a-lens.svg",
    "figures/motive-sample-nonexclusive.html",
    "figures/motive-sample-nonexclusive.json",
    "figures/motive-sample-nonexclusive.svg",
    "figures/recovered-actions-by-day.html",
    "figures/recovered-actions-by-day.json",
    "figures/recovered-actions-by-day.svg",
    "figures/security-capability-map.html",
    "figures/security-capability-map.json",
    "figures/security-capability-map.svg",
    "figures/source-scope-matrix.html",
    "figures/source-scope-matrix.json",
    "figures/source-scope-matrix.svg",
    "figures/system-capability-map.html",
    "figures/system-capability-map.json",
    "figures/system-capability-map.svg",
    "figures/task-overrepresentation.html",
    "figures/task-overrepresentation.json",
    "figures/task-overrepresentation.svg",
    "figures/the-second-hearing-evidence-map.html",
    "figures/the-second-hearing-evidence-map.json",
    "figures/the-second-hearing-evidence-map.svg",
    "figures/verification-capability-map.html",
    "figures/verification-capability-map.json",
    "figures/verification-capability-map.svg",
    "hire.html",
    "engine-revival.html",
    "elder-enb.html",
    "enb-runtime-core.html",
    "flywheel.html",
    "frontier-safety-openai-hugging-face-incident.html",
    "img/og/behavior-transform.png",
    "img/og/availability-is-not-reach.png",
    "img/og/brender-archival.png",
    "img/og/elder-enb.png",
    "img/og/engine-revival.png",
    "img/og/plexus.png",
    "img/og/portfolio-home.png",
    "img/og/profile.png",
    "img/og/private-practice.png",
    "img/og/publications.png",
    "img/og/security-toolkit.png",
    "img/og/truth-enb.png",
    "img/og/the-second-hearing.png",
    "img/og/what-the-label-changes.png",
    "img/og/cards-data.js",
    "index.html",
    "media/retro-systems-lab/evidence-manifest.json",
    "media/retro-systems-lab/identity/brender-verify.svg",
    "media/retro-systems-lab/identity/crossover.svg",
    "media/retro-systems-lab/identity/engine-preserve.svg",
    "media/retro-systems-lab/identity/retro-play.svg",
    "media/retro-systems-lab/manifest.json",
    "models-propose-oracles-dispose.html",
    "no-receipt-no-accept.html",
    "overview.html",
    "pick-the-lock-for-everyone-talk.html",
    "pick-the-lock-for-everyone.html",
    "publications.html",
    "publications/build.json",
    "publications/data/index.json",
    "publications/data/records/availability-is-not-reach.json",
    "publications/data/records/the-second-hearing.json",
    "publications/data/records/what-the-label-changes.json",
    "publications/schema/publication-record.schema.json",
    "private-practice.html",
    "security-toolkit.html",
    "security-tools.json",
    "system/figure.css",
    "system/figure.js",
    "system/figure.test.mjs",
    "system/hire.css",
    "system/home-art.js",
    "system/publication-article.css",
    "system/publications.css",
    "system/publications.js",
    "system/retro-systems-lab.css",
    "system/routes.js",
    "system/systems.js",
    "system/systems.json",
    "retro.html",
    "research.html",
    "resume.html",
    "resume.md",
    "resume-evaluation-tooling.html",
    "resume-grounds.html",
    "resume-public-operations.html",
    "resume-support-operations.html",
    "sitemap.xml",
    "systems/behavior-transform.html",
    "systems/mneme.html",
    "systems/plexus.html",
    "systems/relay.html",
    "systems/studio-engine.html",
    "systems/telos.html",
    "the-second-hearing.html",
    "truth-enb.html",
    "what-the-label-changes.html",
    "writing.html",
)

REVIEWED_RELEASE_SHA256 = "7def2e11fb88babfba7bae5397a9353dcbcece22d799895b9ac1ca2cc5ea1b52"

BRIEFING_FIGURES = (
    "claim-provenance-panel",
    "control-boundary-flow",
    "incident-multilane-timeline",
    "motive-sample-nonexclusive",
    "recovered-actions-by-day",
    "source-scope-matrix",
    "task-overrepresentation",
)

BRIEFING_EVIDENCE_FIGURES = tuple(
    path.stem
    for path in sorted((ROOT / "figures").glob("*.json"))
    if "figure" in json.loads(path.read_text(encoding="utf-8"))
)

PUBLIC_MARKERS = (
    re.compile(r"(?i)(?<![a-z0-9])[a-z]:[/\\]+(?:users|dev|program files)[/\\]+"),
    re.compile(r"(?i)file:///(?:[a-z]:[/\\]+|users/|home/)"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"\bghp_[A-Za-z0-9]{30,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{40,}\b"),
    re.compile(r"(?<![A-Za-z0-9_-])sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
)


def _text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def _release_fingerprint() -> str:
    records = []
    for relative in sorted(RELEASE_PATHS):
        payload = (ROOT / relative).read_bytes()
        if Path(relative).suffix.lower() not in {".pdf", ".png"}:
            payload = payload.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
        records.append(f"{relative}\t{hashlib.sha256(payload).hexdigest()}")
    return hashlib.sha256(("\n".join(records) + "\n").encode()).hexdigest()


def _local_target(href: str) -> tuple[Path, str]:
    parsed = urlsplit(href)
    relative = parsed.path.lstrip("/") or "index.html"
    if relative.endswith("/"):
        relative += "index.html"
    return ROOT / relative, parsed.fragment


def _route_registry() -> dict[str, object]:
    source = _text("system/routes.js")
    match = re.search(r'ROUTE_REGISTRY_JSON = ("(?:[^"\\]|\\.)*");', source)
    assert match, "generated route registry JSON is missing"
    return json.loads(json.loads(match.group(1)))


def test_release_fingerprint_is_stable_across_text_line_endings(
    tmp_path: Path, monkeypatch
) -> None:
    artifact = tmp_path / "artifact.html"
    monkeypatch.setattr(__import__(__name__), "ROOT", tmp_path)
    monkeypatch.setattr(__import__(__name__), "RELEASE_PATHS", ("artifact.html",))

    artifact.write_bytes(b"alpha\nbeta\n")
    lf_fingerprint = _release_fingerprint()
    artifact.write_bytes(b"alpha\r\nbeta\r\n")

    assert _release_fingerprint() == lf_fingerprint


def test_release_spine_matches_the_reviewed_artifact_fingerprint() -> None:
    missing = [path for path in RELEASE_PATHS if not (ROOT / path).is_file()]
    assert not missing, f"release files missing: {missing}"

    for directory in ("analytics", "briefings", "figures", "systems"):
        actual = {
            path.relative_to(ROOT).as_posix()
            for path in (ROOT / directory).rglob("*")
            if path.is_file()
        }
        expected = {path for path in RELEASE_PATHS if path.startswith(f"{directory}/")}
        assert actual == expected, f"{directory} release tree drifted"

    assert _release_fingerprint() == REVIEWED_RELEASE_SHA256


def test_home_uses_only_the_reviewed_atomic_bundle_pair() -> None:
    source = _text("index.html")
    obsolete_js = "index-B_" + "tbCD5Q.js"
    obsolete_css = "index-D3" + "HRo6Wc.css"
    previous_js = "index-Dwp-qWEt.js"
    previous_css = "index-ktAZgEPv.css"
    retired_js = "index-B3zWbYkK.js"
    retired_css = "index-CiruV1jn.css"
    previous_task_js = "index-FyYdKcDU.js"
    previous_fix_js = "index-BCyg-ZCA.js"
    previous_fix_css = "index-Bh3pWSfE.css"
    previous_art_js = "index-BPBDYusx.js"
    previous_art_css = "index-D6A4RL1P.css"
    previous_publications_js = "index-DDkK7Yu0.js"
    previous_plain_language_js = "index-DFJMXR3Q.js"
    current_js = "index-B9IQuAmM.js"
    current_css = "index-BxIHiu3n.css"
    previous_security_js = "index-BnUu1wyw.js"
    prior_reviewed_js = "index-C_1S2nb6.js"
    prior_reviewed_css = "index-XLAt4tDw.css"
    assert f'src="/assets/{current_js}"' in source
    assert f'href="/assets/{current_css}"' in source
    assert (ROOT / "assets" / current_js).is_file()
    assert (ROOT / "assets" / current_css).is_file()
    assert previous_security_js not in source
    assert not (ROOT / "assets" / previous_security_js).exists()
    assert prior_reviewed_js not in source
    assert prior_reviewed_css not in source
    assert not (ROOT / "assets" / prior_reviewed_js).exists()
    assert not (ROOT / "assets" / prior_reviewed_css).exists()
    assert obsolete_js not in source
    assert obsolete_css not in source
    assert not (ROOT / "assets" / obsolete_js).exists()
    assert not (ROOT / "assets" / obsolete_css).exists()
    assert previous_js not in source
    assert previous_css not in source
    assert not (ROOT / "assets" / previous_js).exists()
    assert not (ROOT / "assets" / previous_css).exists()
    assert retired_js not in source
    assert retired_css not in source
    assert not (ROOT / "assets" / retired_js).exists()
    assert not (ROOT / "assets" / retired_css).exists()
    assert previous_task_js not in source
    assert not (ROOT / "assets" / previous_task_js).exists()
    assert previous_publications_js not in source
    assert not (ROOT / "assets" / previous_publications_js).exists()
    assert previous_plain_language_js not in source
    assert not (ROOT / "assets" / previous_plain_language_js).exists()
    assert previous_fix_js not in source
    assert previous_fix_css not in source
    assert not (ROOT / "assets" / previous_fix_js).exists()
    assert not (ROOT / "assets" / previous_fix_css).exists()
    assert previous_art_js not in source
    assert previous_art_css not in source
    assert not (ROOT / "assets" / previous_art_js).exists()
    assert not (ROOT / "assets" / previous_art_css).exists()


def test_six_briefing_figures_keep_semantic_nonvisual_fallbacks() -> None:
    for stem in BRIEFING_FIGURES:
        source = _text(f"figures/{stem}.html")
        assert '<figure class="evidence-figure"' in source, stem
        assert "<figcaption" in source, stem
        table = re.search(
            r'<table\b[^>]*class="[^"]*\bfigure-table\b[^"]*"[^>]*>(.*?)</table>',
            source,
            re.DOTALL,
        )
        assert table, stem
        assert "data-figure-row" in table.group(1), stem
        assert '<svg role="img"' in source, stem
        assert "aria-labelledby=" in source, stem
        assert re.search(r'data-figure-kind="(?:relationship|timeline|matrix|bar)"', source), stem


def test_recovered_actions_bar_fits_the_desktop_viewport() -> None:
    source = _text("figures/recovered-actions-by-day.html")
    styles = _text("system/figure.css")
    assert 'class="figure-svg-scroll figure-svg-scroll--fit"' in source
    assert re.search(
        r"\.figure-svg-scroll--fit\s+svg\s*\{[^}]*min-width:\s*0",
        styles,
        re.DOTALL,
    )


def test_every_evidence_plate_has_readable_labels_and_explicit_scope() -> None:
    required = {
        "title",
        "claim",
        "doesNotProve",
        "retrievedAt",
        "units",
        "transformations",
        "uncertainty",
        "sources",
    }
    for stem in BRIEFING_EVIDENCE_FIGURES:
        companion = json.loads(_text(f"figures/{stem}.json"))["figure"]
        assert required <= set(companion), stem
        assert companion["sources"], stem
        assert companion["transformations"], stem

        html = _text(f"figures/{stem}.html")
        svg = _text(f"figures/{stem}.svg")
        ElementTree.fromstring(svg)
        assert re.search(r'class="[^"]*\bfigure-finding\b', html), stem
        assert re.search(r'class="[^"]*\bfigure-scope\b', html), stem
        assert re.search(r'class="[^"]*\bfigure-limitations\b', html), stem
        assert svg in html, f"{stem}: inline and standalone SVG drifted"

        root = ElementTree.fromstring(svg)
        view_box = [float(value) for value in root.attrib["viewBox"].split()]
        intrinsic_width = float(root.attrib.get("width", view_box[2]))
        display_scale = intrinsic_width / view_box[2]
        label_sizes = [float(value) for value in re.findall(r'font-size="([0-9.]+)"', svg)]
        effective_labels = [value * display_scale for value in label_sizes]
        assert effective_labels and min(effective_labels) >= 16, (
            stem,
            min(effective_labels, default=None),
        )

        point_groups = re.findall(
            r'<g\b[^>]*data-figure-point="true"[^>]*>(.*?)</g>',
            svg,
            re.DOTALL,
        )
        assert point_groups, stem
        for group in point_groups:
            marks = re.findall(
                r'<(?:rect|path|line|circle)\b(?=[^>]*stroke="(?!transparent)[^"]+")[^>]*>',
                group,
            )
            effective_strokes = []
            for mark in marks:
                width = re.search(r'stroke-width="([0-9.]+)"', mark)
                effective_strokes.append(float(width.group(1)) * display_scale if width else display_scale)
            assert effective_strokes and max(effective_strokes) >= 2, stem


def test_incident_briefing_uses_readable_embedded_evidence_plates() -> None:
    page = _text("briefings/2026-08-26-openai-hugging-face-incident/index.html")
    styles = _text("system/system.css")
    assert 'class="inner-clean frame-compact briefing-document"' in page
    assert len(re.findall(r"<iframe\b", page)) == 7
    assert ".briefing-document iframe" in styles
    assert re.search(r"inline-size:\s*100%", styles)
    assert re.search(r"min-block-size:\s*", styles)


def test_briefing_archive_and_feeds_resolve_to_the_permanent_record() -> None:
    route = "/briefings/2026-08-26-openai-hugging-face-incident/"
    archive = _text("briefings/index.html")
    assert f'href="{route}"' in archive
    assert 'href="/feed.json"' in archive
    assert 'href="/feed.xml"' in archive

    feed = json.loads(_text("feed.json"))
    assert feed["home_page_url"].endswith("/publications.html")
    routes = [urlsplit(item["url"]).path for item in feed["items"]]
    assert routes.count(route) == 1
    assert "/the-second-hearing.html" in routes
    assert "/availability-is-not-reach.html" in routes
    assert "/what-the-label-changes.html" in routes
    page = _text("briefings/2026-08-26-openai-hugging-face-incident/index.html")
    updated = re.search(r'<time datetime="(\d{4}-\d{2}-\d{2})">Updated ', page)
    assert updated
    expected_updated = f"{updated.group(1)}T00:00:00Z"
    briefing_item = next(item for item in feed["items"] if urlsplit(item["url"]).path == route)
    assert briefing_item["date_modified"] == expected_updated

    atom = ElementTree.fromstring(_text("feed.xml"))
    namespace = {"atom": "http://www.w3.org/2005/Atom"}
    entries = atom.findall("atom:entry", namespaces=namespace)
    briefing_entry = next(
        entry
        for entry in entries
        if entry.findtext("atom:id", namespaces=namespace).endswith(route)
    )
    assert atom.findtext("atom:updated", namespaces=namespace) == max(
        item["date_modified"] for item in feed["items"]
    )
    assert briefing_entry.findtext("atom:updated", namespaces=namespace) == expected_updated
    target, fragment = _local_target(route)
    assert target.is_file() and not fragment


def test_incident_build_receipt_matches_every_generated_output() -> None:
    build = json.loads(
        _text("briefings/2026-08-26-openai-hugging-face-incident/build.json")
    )
    assert build["settings"]["lineEnding"] == "LF"

    drifted = []
    for output in build["outputs"]:
        payload = (ROOT / output["path"]).read_bytes()
        payload = payload.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
        actual = hashlib.sha256(payload).hexdigest()
        if actual != output["sha256"]:
            drifted.append(output["path"])

    assert not drifted, f"incident build outputs drifted: {drifted}"


def test_every_generated_capability_and_hiring_route_resolves() -> None:
    registry = _route_registry()
    routes = [route for family in registry["families"] for route in family["routes"]]
    hrefs = {route["href"] for route in routes}
    assert {
        "hire.html#engineering-path",
        "hire.html#technical-operations-path",
        "hire.html#public-service-field-path",
        "catalog.html",
        "systems/behavior-transform.html",
        "systems/mneme.html",
        "systems/plexus.html",
        "systems/relay.html",
        "systems/studio-engine.html",
    } <= hrefs

    for href in sorted(hrefs):
        target, fragment = _local_target(href)
        assert target.is_file(), f"route target missing: {href}"
        if fragment:
            source = target.read_text(encoding="utf-8")
            assert re.search(rf'\bid=["\']{re.escape(fragment)}["\']', source), href

    systems = json.loads(_text("system/systems.json"))["systems"]
    assert systems, "capability registry is empty"
    for system in systems:
        target, fragment = _local_target(system["href"])
        assert target.is_file(), f"capability target missing: {system['id']} -> {system['href']}"
        if fragment:
            assert re.search(
                rf'\bid=["\']{re.escape(fragment)}["\']',
                target.read_text(encoding="utf-8"),
            ), system["id"]


def test_release_spine_contains_no_owner_local_paths_or_secret_markers() -> None:
    findings = []
    for relative in RELEASE_PATHS:
        source = (ROOT / relative).read_bytes().decode("utf-8", errors="ignore")
        normalized = re.sub(r"\\{2,}", r"\\", source)
        if any(pattern.search(candidate) for pattern in PUBLIC_MARKERS for candidate in (source, normalized)):
            findings.append(relative)
    assert not findings, f"public boundary markers found in: {findings}"
