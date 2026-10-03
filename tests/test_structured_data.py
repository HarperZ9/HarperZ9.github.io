"""Contracts for the search and citation metadata in page heads.

The JSON-LD, citation tags and feed links are generated. These tests check that
the generated block is current, that it parses, and that it says nothing the
page and its source records do not already say.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LD = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def graph(relative: str) -> list[dict]:
    blocks = LD.findall(read(relative))
    assert len(blocks) == 1, f"{relative}: expected one JSON-LD block, found {len(blocks)}"
    payload = json.loads(blocks[0])
    assert payload["@context"] == "https://schema.org"
    return payload["@graph"]


def canonical(relative: str) -> str:
    match = re.search(r'<link\s+rel="canonical"\s+href="([^"]+)"', read(relative))
    assert match, relative
    return match.group(1)


def test_generated_blocks_are_current() -> None:
    result = subprocess.run(
        [sys.executable, "tools/structured_data.py", "--check"],
        cwd=ROOT, capture_output=True, text=True, check=False,
    )
    assert result.returncode == 0, result.stderr


def test_record_pages_and_hand_authored_pages_describe_software_alike() -> None:
    generated = next(n for n in graph("systems/relay.html") if n["@type"] == "SoftwareSourceCode")
    authored = next(n for n in graph("flywheel.html") if n["@type"] == "SoftwareSourceCode")
    assert set(generated) == set(authored)
    assert generated["author"] == authored["author"]


def test_every_block_parses_and_matches_its_canonical_url() -> None:
    pages = [p for p in ROOT.glob("*.html")] + list((ROOT / "systems").glob("*.html"))
    checked = 0
    for page in pages:
        relative = page.relative_to(ROOT).as_posix()
        if not LD.search(read(relative)):
            continue
        url = canonical(relative)
        for node in graph(relative):
            if node["@type"] in {"Article", "ScholarlyArticle", "SoftwareSourceCode"}:
                assert node["url"] == url, relative
                assert node["author"]["name"] == "Zain Dana Harper", relative
        checked += 1
    assert checked >= 60


def test_home_names_the_person_and_profiles() -> None:
    nodes = {node["@type"]: node for node in graph("index.html")}
    person = nodes["Person"]
    assert person["name"] == "Zain Dana Harper"
    assert "https://github.com/HarperZ9" in person["sameAs"]
    assert "https://orcid.org/0009-0001-7175-5393" in person["sameAs"]
    assert nodes["WebSite"]["url"] == "https://harperz9.github.io/"


def test_articles_use_the_page_headline_and_a_dated_record() -> None:
    nodes = {node["@type"]: node for node in graph("no-receipt-no-accept.html")}
    article = nodes["Article"]
    assert article["headline"] == "No Receipt, No Accept"
    assert article["datePublished"] == "2026-07-28"
    crumbs = [item["name"] for item in nodes["BreadcrumbList"]["itemListElement"]]
    assert crumbs == ["Home", "Publications", "No Receipt, No Accept"]


def test_scholarly_records_match_the_dois_the_site_cites() -> None:
    records = json.loads(read("system/scholarly-records.json"))["records"]
    publications = read("publications.html")
    for record in records:
        assert f"https://doi.org/{record['doi']}" in publications, record["doi"]
        assert (ROOT / record["pdf"]).is_file(), record["pdf"]
    listed = {node["identifier"]["value"] for node in graph("publications.html")[0]["hasPart"]}
    assert listed == {record["doi"] for record in records}


def test_doi_landing_pages_carry_highwire_citation_tags() -> None:
    for relative, doi in [
        ("conferred-existence.html", "10.5281/zenodo.20773724"),
        ("witnessing-spine.html", "10.5281/zenodo.20778927"),
    ]:
        html = read(relative)
        assert f'<meta name="citation_doi" content="{doi}">' in html
        assert '<meta name="citation_author" content="Harper, Zain Dana">' in html
        article = next(n for n in graph(relative) if n["@type"] == "ScholarlyArticle")
        assert article["identifier"]["value"] == doi


def test_private_records_are_not_described_as_source_code() -> None:
    registry = json.loads(read("system/systems.json"))["systems"]
    private = {s["href"] for s in registry if s["accessMode"] == "request" and "#" not in s["href"]}
    for relative in private:
        if (ROOT / relative).is_file():
            assert "SoftwareSourceCode" not in read(relative), relative
