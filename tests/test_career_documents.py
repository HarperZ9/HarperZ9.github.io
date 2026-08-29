"""The career and dossier documents, and the numbers they state.

Two things are worth failing a build over here. First, a count on a page that
disagrees with the open-source census: those numbers used to be transcribed by
hand with a "counted on" date, and a stale number on a resume is a false claim
rather than a cosmetic bug. Second, the claim language, because the research
record is not peer reviewed and every page has to keep saying so.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CENSUS = ROOT / "career" / "open-source-census.json"
MANIFEST = ROOT / "career" / "career-artifacts.json"
DOCS = ("hire.html", "resume.html", "cv.html", "portfolio.html", "cover-letter.html", "dossier.html")
RESUME_PDFS = (
    "career/Zain-Dana-Harper-Resume-Grounds.pdf",
    "career/Zain-Dana-Harper-Resume-Public-Operations.pdf",
    "career/Zain-Dana-Harper-Resume-Support-Developer-Operations-QA.pdf",
    "career/Zain-Dana-Harper-Resume-Evaluation-Tooling-Python-Developer-Tools.pdf",
)


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def test_every_career_document_exists() -> None:
    for name in DOCS:
        assert (ROOT / name).is_file(), name
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for record in manifest["current_html"] + manifest["artifacts"]:
        assert (ROOT / record["path"]).is_file(), record["path"]
    for retired in manifest["retired_artifacts"]:
        assert not (ROOT / retired).exists(), retired


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


def test_hiring_page_leads_with_name_role_and_four_recognizable_work_paths() -> None:
    src = read("hire.html")
    assert "Zain Dana Harper" in src
    assert "Systems engineering, AI evaluation, security tooling, technical operations, and public-service work." in src
    assert len(re.findall(r'<article class="hire-path(?: [^"]+)?"', src)) == 4
    assert all(
        re.search(rf'\bid="{re.escape(anchor)}"', src)
        for anchor in (
            "engineering-path",
            "security-defense-path",
            "public-service-field-path",
            "collaboration-path",
        )
    )
    for heading in (
        "Software engineering and AI evaluation",
        "Security and high-consequence systems",
        "Public service and field work",
        "Open-source and research collaboration",
    ):
        assert heading in src
    for stale_scaffold in (
        "Lane A",
        "Lane B",
        "Two measured technical lanes",
        "Separate field campaign",
        "Choose lane",
    ):
        assert stale_scaffold not in src
    assert "zaindharper@gmail.com" in src
    assert '<body class="doc" data-route-art="off">' in src
    assert "private-client material" not in src


def test_hiring_document_delegates_current_page_state_to_shared_navigation() -> None:
    src = read("hire.html")
    assert 'aria-current="page"' not in src
    assert 'class="docnav-link is-current"' in src


def test_hiring_paths_use_one_column_at_mobile_and_readable_action_targets() -> None:
    page = read("hire.html")
    css = read("system/hire.css")
    assert 'system/hire.css?v=20260828-site-design' in page
    assert ".hire-route-kicker" not in css
    assert ".hire-path" in css
    assert "min-height:44px" in css
    assert "@media (max-width:760px)" in css
    mobile = css.split("@media (max-width:760px)", 1)[1]
    assert ".hire-path{grid-template-columns:1fr" in mobile


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
