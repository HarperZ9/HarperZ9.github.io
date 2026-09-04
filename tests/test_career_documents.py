"""The career and dossier documents, and the numbers they state.

Two things are worth failing a build over here. First, a count on a page that
disagrees with the open-source census: those numbers used to be transcribed by
hand with a "counted on" date, and a stale number on a resume is a false claim
rather than a cosmetic bug. Second, the claim language, because the research
record is not peer reviewed and every page has to keep saying so.
"""

import hashlib
import json
import re
import runpy
import subprocess
import sys
from collections.abc import Iterable
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_HOST = "harperz9.github.io"
CENSUS = ROOT / "career" / "open-source-census.json"
MANIFEST = ROOT / "career" / "career-artifacts.json"
DOCS = ("hire.html", "resume.html", "cv.html", "portfolio.html", "cover-letter.html", "dossier.html")
RESUME_PDFS = (
    "career/Zain-Dana-Harper-Resume-Grounds.pdf",
    "career/Zain-Dana-Harper-Resume-Public-Operations.pdf",
    "career/Zain-Dana-Harper-Resume-Support-Developer-Operations-QA.pdf",
    "career/Zain-Dana-Harper-Resume-Evaluation-Tooling-Python-Developer-Tools.pdf",
)
RETIRED_LEGACY_PDFS = (
    "career/Zain-Dana-Harper-Resume.pdf",
    "career/Zain-Dana-Harper-Portfolio.pdf",
    "career/Zain-Dana-Harper-Dossier.pdf",
)
STATUS_BOUNDARY_DOCS = (
    "resume-support-operations.html",
    "resume-evaluation-tooling.html",
    "resume-public-operations.html",
    "resume-grounds.html",
    "cv.html",
)
MARKDOWN_STATUS_BOUNDARY_DOCS = ("resume.md", "cv.md")


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def _local_link_target(page: Path, href: str) -> Path | None:
    parsed = urlsplit(href)
    if parsed.scheme.casefold() not in {"", "http", "https"}:
        return None
    if parsed.netloc and (parsed.hostname or "").casefold() != PUBLIC_HOST:
        return None
    if not parsed.path:
        return None
    path = unquote(parsed.path)
    if parsed.netloc or path.startswith("/"):
        return (ROOT / path.lstrip("/")).resolve()
    return (page.parent / path).resolve()


def _publishable_html_pages(root: Path) -> tuple[Path, ...]:
    result = subprocess.run(
        ["git", "ls-files", "-z", "--", "*.html"],
        cwd=root,
        check=True,
        capture_output=True,
    )
    return tuple(
        root / relative
        for relative in result.stdout.decode("utf-8").split("\0")
        if relative
    )


class _HrefParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.hrefs: list[str] = []

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        del tag
        self.hrefs.extend(
            value
            for name, value in attrs
            if name.casefold() == "href" and value is not None
        )


def _hrefs(source: str) -> tuple[str, ...]:
    parser = _HrefParser()
    parser.feed(source)
    parser.close()
    return tuple(parser.hrefs)


def _resolved_print_targets(out: Path, names: Iterable[str]) -> set[Path]:
    return {(out / name).resolve() for name in names}


def test_every_career_document_exists() -> None:
    for name in DOCS:
        assert (ROOT / name).is_file(), name
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for record in manifest["current_html"] + manifest["artifacts"]:
        assert (ROOT / record["path"]).is_file(), record["path"]
    for retired in manifest["retired_artifacts"]:
        assert not (ROOT / retired).exists(), retired


def test_manifest_has_one_current_row_for_every_career_html_authority() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    actual = [row["path"] for row in manifest["current_html"]]
    expected = set(DOCS) | set(STATUS_BOUNDARY_DOCS)
    assert len(actual) == len(set(actual)), "duplicate current_html path"
    assert set(actual) == expected


def test_retired_legacy_pdfs_cannot_be_shipped_or_printed() -> None:
    """A stale PDF route must stay retired after the current lanes replace it."""
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    retired = {(ROOT / path).resolve() for path in manifest["retired_artifacts"]}
    current = {(ROOT / row["path"]).resolve() for row in manifest["artifacts"]}
    print_module = runpy.run_path(str(ROOT / "tools" / "print_documents.py"))
    print_targets = _resolved_print_targets(
        print_module["OUT"],
        print_module["DOCUMENTS"].values(),
    )
    for relative in RETIRED_LEGACY_PDFS:
        target = (ROOT / relative).resolve()
        assert target in retired, relative
        assert target not in current, relative
        assert target not in print_targets, relative
        assert not target.exists(), relative


def test_shipped_html_never_links_to_a_retired_career_artifact() -> None:
    """Retiring bytes must also retire every local route that offers those bytes."""
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    retired = {(ROOT / relative).resolve() for relative in manifest["retired_artifacts"]}
    for page in _publishable_html_pages(ROOT):
        source = page.read_text(encoding="utf-8")
        for href in _hrefs(source):
            target = _local_link_target(page, href)
            if target is None:
                continue
            assert target not in retired, f"{page.relative_to(ROOT)} -> {href}"


def test_publishable_html_inventory_excludes_untracked_local_files(
    tmp_path: Path,
) -> None:
    tracked = tmp_path / "tracked.html"
    tracked.write_text("<p>published</p>", encoding="utf-8")
    untracked = tmp_path / "scratch.html"
    untracked.write_text("<p>local only</p>", encoding="utf-8")
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    subprocess.run(["git", "add", "--", tracked.name], cwd=tmp_path, check=True)

    assert set(_publishable_html_pages(tmp_path)) == {tracked}


def test_href_inventory_parses_valid_html_attribute_forms() -> None:
    source = (
        '<a HREF=career/Zain-Dana-Harper-Resume.pdf>resume</a>'
        '<link href = "career/current.pdf?download=1&amp;source=site">'
    )
    assert _hrefs(source) == (
        "career/Zain-Dana-Harper-Resume.pdf",
        "career/current.pdf?download=1&source=site",
    )


def test_print_targets_resolve_against_the_configured_output_root(
    tmp_path: Path,
) -> None:
    names = ("nested/../Zain-Dana-Harper-CV.pdf",)
    assert _resolved_print_targets(tmp_path / "career", names) == {
        (tmp_path / "career" / "Zain-Dana-Harper-CV.pdf").resolve()
    }


def test_absolute_public_origin_links_resolve_into_the_release_tree() -> None:
    href = (
        "https://harperz9.github.io/"
        "career/Zain-Dana-Harper-Resume.pdf"
    )
    expected = (ROOT / "career" / "Zain-Dana-Harper-Resume.pdf").resolve()
    assert _local_link_target(ROOT / "index.html", href) == expected
    assert _local_link_target(
        ROOT / "index.html",
        "https://example.com/career/Zain-Dana-Harper-Resume.pdf",
    ) is None


def test_committed_html_release_rows_bind_current_bytes() -> None:
    """The release manifest must identify the HTML that is actually deployed."""
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for row in manifest["current_html"]:
        payload = (ROOT / row["path"]).read_bytes()
        assert row["byte_length"] == len(payload), row["path"]
        assert row["sha256"] == hashlib.sha256(payload).hexdigest(), row["path"]


def test_experience_dates_use_the_adopted_low_claim_boundary() -> None:
    """Public documents must not imply an unknown current or end status."""
    expected = (
        "Technical Networking Support, Xbox/Microsoft contract | subcontracted through Stream/Convergys | Wilsonville, Oregon | 2014 to 2015",
        "Full-time operations and commercial arboriculture | Legendary Tree (organization label) | April 25, 2015 to June 2, 2026",
        "Freelance Technical Writer, Documentation, and Product Operations | independent practice | started 2017",
        "Independent Systems Engineer | independent practice | started 2023",
    )
    boundary = (
        "The 2017 and 2023 start years do not state current status or an end date; "
        "both remain unspecified."
    )
    arboriculture_boundary = (
        "Legendary Tree is the applicant-provided organization label; no conventional "
        "job title or legal employer of record is asserted."
    )
    for name in STATUS_BOUNDARY_DOCS:
        src = read(name)
        assert "current status unconfirmed" not in src, name
        for line in expected:
            assert line in src, f"{name}: missing {line!r}"
        assert boundary in src, f"{name}: missing explicit status boundary"
        assert arboriculture_boundary in src, name
        assert "Operations and Commercial Arboriculture Lead" not in src, name
        assert "family business" not in src, name
        assert "started 2015" not in src, name


def test_public_markdown_career_sources_preserve_the_same_date_and_employer_boundary() -> None:
    """Raw public Markdown must not contradict the generated application lanes."""
    boundary = (
        "The 2017 and 2023 start years do not state current status or an end date; "
        "both remain unspecified."
    )
    arboriculture_boundary = (
        "Legendary Tree is the applicant-provided organization label; no conventional "
        "job title or legal employer of record is asserted."
    )
    for name in MARKDOWN_STATUS_BOUNDARY_DOCS:
        src = read(name)
        normalized = " ".join(src.split())
        assert "2023-present" not in src, name
        assert "2017-present" not in src, name
        assert "2015-present" not in src, name
        assert "Xbox Division | Microsoft" not in src, name
        assert "Redmond, Washington" not in src, name
        assert "Seattle / remote | started 2023" in src, name
        assert "Remote | started 2017" in src, name
        assert "Legendary Tree (organization label)" in src, name
        assert "April 25, 2015 to June 2, 2026" in src, name
        assert "Operations and Commercial Arboriculture Lead" not in src, name
        assert "family business" not in src, name
        assert "started 2015" not in src, name
        assert arboriculture_boundary in normalized, name
        assert "Technical Networking Support, Xbox/Microsoft contract" in src, name
        assert (
            "Wilsonville, Oregon | 2014 to 2015 | subcontracted through Stream/Convergys"
            in src
        ), name
        assert boundary in src, name


def test_downloadable_resume_assets_are_pdf_documents() -> None:
    """A failed binary transplant once replaced the PDFs with extracted text."""
    for name in RESUME_PDFS:
        payload = (ROOT / name).read_bytes()
        assert payload.startswith(b"%PDF-"), f"{name} has no PDF file signature"
        assert b"%%EOF" in payload[-1024:], f"{name} has no PDF end marker"


def test_census_file_is_present_and_complete() -> None:
    data = json.loads(CENSUS.read_text(encoding="utf-8"))
    for bucket in ("merged", "open", "closed_unmerged"):
        b = data["buckets"][bucket]
        assert b["total"] == len(b["items"]), f"{bucket} count and item list disagree"
        assert b["total"] == b["engineering"] + b["listings"]
    assert data["totals"]["all"] == sum(
        data["buckets"][k]["total"] for k in ("merged", "open", "closed_unmerged")
    )


def test_page_counts_match_the_census() -> None:
    """tools/pr_census.py --check compares every data-census element on every
    page against the stored census. It does not call GitHub, so this stays
    offline and deterministic; refreshing the census is a separate step."""
    proc = subprocess.run(
        [sys.executable, str(ROOT / "tools" / "pr_census.py"), "--check"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=ROOT,
    )
    assert proc.returncode == 0, f"a page disagrees with the census:\n{proc.stdout}\n{proc.stderr}"


def test_every_stamped_number_is_a_known_census_key() -> None:
    data = json.loads(CENSUS.read_text(encoding="utf-8"))
    sys.path.insert(0, str(ROOT / "tools"))
    import pr_census  # noqa: E402

    known = set(pr_census.numbers(data))
    for name in DOCS:
        for key in re.findall(r'data-census="([a-z-]+)"', read(name)):
            assert key in known, f"{name}: unknown census key {key!r}"


def test_research_status_language_stays_honest() -> None:
    """The record carries DOIs and no peer review. Any page that lists the
    research says which it is, and no page upgrades the status."""
    negated = re.compile(r"(not|none of (it|this) is|never)[^.]{0,60}peer[ -]reviewed", re.I)
    for name in ("resume.html", "cv.html", "dossier.html"):
        src = read(name)
        assert "doi.org/10.5281/zenodo" in src, f"{name} lists no DOI"
        assert negated.search(src), (
            f"{name} lists research without stating that it is not peer reviewed"
        )
    for name in DOCS:
        assert "peer-reviewed paper" not in read(name).lower()


def test_the_misses_stay_on_the_record() -> None:
    """A merged count only means something if the declined work is published
    next to it."""
    for name in ("resume.html", "cv.html", "portfolio.html"):
        assert "closed without merge" in read(name), name
    assert "Open is not accepted" in read("portfolio.html")


def test_dossier_holds_back_the_private_material() -> None:
    """The dossier is drawn from a package that also covers health, benefits,
    transcripts, and family. None of that belongs on a public page, and the
    page says so rather than leaving the omission silent."""
    src = read("dossier.html")
    assert "What is held back" in src
    for banned in ("GPA", "1.7", "WIC", "Paid Leave", "childcare", "disability benefits"):
        assert banned not in src, f"dossier leaks private material: {banned!r}"


def test_documents_use_the_shared_document_system() -> None:
    for name in DOCS:
        src = read(name)
        assert 'href="system/doc.css' in src, name
        if name == "hire.html":
            assert 'class="hire-sheet"' in src, name
        else:
            assert 'class="sheet' in src, name
        # The letter is one continuous piece of writing and correctly has no
        # section headings. Everything else is a document a reader scans.
        if name != "cover-letter.html":
            assert "<h2>" in src, f"{name} has no section headings"
            if name != "hire.html":
                assert 'class="sheet doc-rail"' in src, f"{name} does not use the heading rail"


def test_no_em_dashes_on_the_public_documents() -> None:
    for name in DOCS:
        src = read(name)
        assert "—" not in src, f"{name} contains an em dash"
        assert "&mdash;" not in src, f"{name} contains an em dash entity"


def test_contact_fields_are_separate_elements() -> None:
    """The old markup ran location, availability, and email together in one
    text node, so the email address landed jammed against the sentence before
    it. Each field is its own element now and the separator is drawn."""
    for name in DOCS:
        src = read(name)
        m = re.search(r'<p class="contact[^"]*">(.*?)</p>', src, re.S)
        assert m, f"{name} has no contact line"
        assert "contact--fields" in m.group(0), name
        assert m.group(1).count("<span") >= 3, f"{name} contact line is not split into fields"


def test_portfolio_names_retro_work_without_stale_download_claims() -> None:
    """The new career funnel names retro-system work as project evidence, but
    does not depend on stale off-site download counters in the first impression."""
    portfolio = read("portfolio.html")
    assert "Brender Archival" in portfolio
    assert "Engine Revival" in portfolio
    assert "900,000" not in portfolio
    assert "936,657" not in portfolio
    for name in ("resume.html", "cv.html", "cover-letter.html"):
        src = read(name)
        assert "900,000" not in src, f"{name} still states a figure two readings out of date"


def test_hiring_page_leads_with_two_technical_lanes_and_a_field_campaign() -> None:
    src = read("hire.html")
    assert "Zain Dana Harper" in src
    assert "Two measured technical lanes, one separate field campaign." in src
    assert len(re.findall(r'class="hire-route-band(?:\s|\")', src)) == 2
    for marker in (
        'id="support-operations-qa"',
        'id="evaluation-python-tools"',
        "Technical support, developer operations, and QA",
        "Evaluation tooling and Python developer tools",
        "Separate field campaign",
        "ports, utilities, fire-support, parks, and field-safety",
    ):
        assert marker in src
    assert "zaindharper@gmail.com" in src
    assert '<body class="doc" data-route-art="off">' in src
    assert "private-client material" not in src


def test_hiring_document_marks_the_local_career_switch_current() -> None:
    src = read("hire.html")
    assert '<a href="hire.html" aria-current="page">Hire</a>' in src
    assert 'src="system/nav.js?v=20260902-creative-chassis"' in src


def test_hiring_paths_use_one_column_at_mobile_and_readable_action_targets() -> None:
    page = read("hire.html")
    css = read("system/hire.css")
    assert 'system/hire.css?v=20260902-creative-chassis' in page
    assert ".hire-route-band" in css
    assert "min-height:44px" in css
    assert "@media (max-width:760px)" in css
    mobile = css.split("@media (max-width:760px)", 1)[1]
    assert ".hire-route-band{grid-template-columns:1fr" in mobile


def test_home_source_connects_the_product_brand_to_the_hiring_route() -> None:
    src = (ROOT / "home" / "src" / "App.tsx").read_text(encoding="utf-8")
    studio = src.index('<h1 className="hero-title">Zentropy Labs</h1>')
    practice = src.index("Product studio, systems engineering, graphics, security tooling, and public research.")
    builder = src.index("Zain Dana Harper is the builder behind Zentropy Labs.")
    products = src.index('id="products"')
    flywheel = src.index("Featured platform: Flywheel")
    hiring = src.index("Hiring, contracting, and collaboration")
    hiring_route = src.index('href="/hire.html"')
    assert studio < practice < builder
    assert products < flywheel
    assert hiring_route < hiring

    main = re.search(r'<main id="main">(?P<body>.*?)</main>', src, re.S)
    assert main
    order = re.findall(r"<([A-Z][A-Za-z0-9]*)\s*/>", main.group("body"))
    assert order[:5] == [
        "IdentityHero",
        "ProductSelection",
        "FeaturedFlywheel",
        "HiringRoutes",
        "EvidenceBoard",
    ]


def test_resume_keeps_projects_inside_zentropy_experience() -> None:
    src = read("resume.html")
    accepted = src.index("Technical support, developer operations, and QA")
    owned = src.index("Flywheel")
    boundary = src.index("Identity and date boundary")
    assert accepted < owned < boundary


def test_primary_resume_and_public_letter_are_bounded_first_impressions() -> None:
    resume_words = re.findall(r"\b[\w'-]+\b", re.sub(r"<[^>]+>", " ", read("resume.html")))
    letter_words = re.findall(r"\b[\w'-]+\b", re.sub(r"<[^>]+>", " ", read("cover-letter.html")))
    assert len(resume_words) <= 900
    assert 250 <= len(letter_words) <= 350


def test_public_hiring_surfaces_do_not_upgrade_private_hub_staging() -> None:
    for name in ("hire.html", "resume.html", "portfolio.html", "cover-letter.html"):
        src = read(name)
        assert "Published on Prime Intellect" not in src
        assert "public Hub release" not in src
