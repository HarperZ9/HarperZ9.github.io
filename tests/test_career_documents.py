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
DOCS = ("resume.html", "cv.html", "portfolio.html", "cover-letter.html", "dossier.html")


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def test_every_career_document_exists() -> None:
    for name in DOCS:
        assert (ROOT / name).is_file(), name


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
        assert 'class="sheet' in src, name
        # The letter is one continuous piece of writing and correctly has no
        # section headings. Everything else is a document a reader scans.
        if name != "cover-letter.html":
            assert "<h2>" in src, f"{name} has no section headings"
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
