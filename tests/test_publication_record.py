"""The public research record, and every page that counts it.

publications.html said "Six papers" while the CV and the dossier said eight
records, and the CV linked here as the canonical list. Both were internally
consistent and they contradicted each other in front of the reader: the page
was counting papers, the documents were counting everything with a DOI. The
taxonomy is stated now, and these tests keep the number tied to the list
rather than to whatever the prose last happened to say.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# The record, as deposited. Status language is exact and is not upgraded.
RECORD = {
    "10.5281/zenodo.21230267": "systems paper",
    "10.5281/zenodo.21231253": "systems paper",
    "10.5281/zenodo.21232206": "published preprint",
    "10.5281/zenodo.21231406": "published preprint",
    "10.5281/zenodo.21234475": "research note",
    "10.5281/zenodo.21231311": "research note",
    "10.5281/zenodo.20778927": "archived corpus",
    "10.5281/zenodo.20773724": "archived corpus",
}
STATUS_PHRASE = {
    "systems paper": "systems paper",
    "published preprint": "published preprint",
    "research note": "note",
    "archived corpus": "archived research corpus",
}
WORDS = {2: "Two", 6: "Six", 8: "Eight"}


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def dois(source: str) -> set[str]:
    return set(re.findall(r"10\.5281/zenodo\.\d+", source))


def test_publications_lists_the_whole_record() -> None:
    src = read("publications.html")
    assert dois(src) == set(RECORD), "publications.html and the deposited record disagree"


def test_each_doi_keeps_its_exact_record_status() -> None:
    src = read("publications.html")
    rows = re.findall(r'<div class="index-row" role="listitem".*?</div>', src, re.S)

    for doi, status in RECORD.items():
        matching_rows = [row for row in rows if doi in row]
        assert len(matching_rows) == 1, f"{doi} must appear in exactly one record row"
        row_text = " ".join(re.sub(r"<[^>]+>", " ", matching_rows[0]).split()).lower()
        assert STATUS_PHRASE[status] in row_text, f"{doi} lost its {status!r} status"


def test_the_stated_count_matches_the_list() -> None:
    """The heading says a number in words. It has to be the number of things
    below it, or the page is lying in its largest type."""
    src = read("publications.html")
    heading = re.search(r'<h2[^>]*id="research-records-h"[^>]*>([^<]+)</h2>', src)
    assert heading, "no section heading on publications.html"
    said = heading.group(1)
    expected = WORDS[len(RECORD)]
    assert expected.lower() in said.lower(), f"heading says {said!r}, the list holds {len(RECORD)}"
    record_section = src.split('id="research-records"', 1)[1].split("</section>", 1)[0]
    rows = record_section.count('role="listitem"')
    assert rows == len(RECORD), f"{rows} rows for {len(RECORD)} records"


def test_the_taxonomy_adds_up() -> None:
    """Two of each kind. If a future entry breaks that, the prose claiming it
    has to change with the list."""
    src = read("publications.html")
    from collections import Counter
    kinds = Counter(RECORD.values())
    assert set(kinds.values()) == {2}, kinds
    for kind, n in kinds.items():
        phrase = f"{WORDS[n].lower()} {kind}"
        assert phrase in src.lower().replace("corpora", "corpus"), f"page never says {phrase!r}"


def test_every_page_that_counts_the_record_agrees() -> None:
    """The CV and the dossier both state the size of the record and both link
    here. A reader following that link must not find a different number."""
    n = len(RECORD)
    # Prose spells the number, a counted chip uses the numeral. Accept either,
    # but it has to be the size of the record.
    pattern = re.compile(rf"(\b{WORDS[n]}\b|>\s*{n}\s*<)[^.]{{0,40}}records?", re.I)
    for name in ("cv.html", "resume.html", "dossier.html"):
        assert pattern.search(read(name)), f"{name} no longer states the size of the record"


def test_nothing_claims_peer_review() -> None:
    for name in ("publications.html", "cv.html", "resume.html", "dossier.html"):
        src = read(name)
        assert re.search(r"(not|none of (it|this) is|never)[^.]{0,60}peer[ -]reviewed", src, re.I), name


def test_every_record_is_readable_without_leaving_the_site() -> None:
    """All eight are hosted here now: six as PDFs, and the two corpora as
    full-text pages rendered from the deposited sources. A link to a file that
    is not there is the exact failure this site exists to argue against."""
    src = read("publications.html")
    for href in re.findall(r'href="(papers/[^"]+)"', src):
        assert (ROOT / href).is_file(), f"publications.html offers a missing PDF: {href}"
    assert len(re.findall(r'href="papers/', src)) == len(RECORD),         f"expected a local file for all {len(RECORD)} records"
    for page in ("conferred-existence.html", "witnessing-spine.html"):
        assert (ROOT / page).is_file(), f"{page} was never rendered"
        assert f'href="{page}"' in src, f"publications.html does not link {page}"


def test_the_rendered_corpora_carry_their_source() -> None:
    """The pages are generated from the deposited Markdown. If a render ever
    silently drops a section the word count collapses, so hold a floor."""
    import html as H
    for page, floor in (("conferred-existence.html", 60_000), ("witnessing-spine.html", 1_800)):
        src = read(page)
        body = src.split("</header>", 1)[1].split('<p class="note">')[0]
        words = len(H.unescape(re.sub(r"<[^>]+>", " ", body)).split())
        assert words >= floor, f"{page} carries only {words} words, expected at least {floor}"
        assert "doi.org/10.5281/zenodo" in src, f"{page} does not cite its deposit"
        assert 'data-export-slot' in src, f"{page} cannot be taken away"
