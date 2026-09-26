"""Contracts for the conclusions layer of the Frontier Safety Briefing: the live page and the schema.

The companion record's persistence (checksum, publication gate, dated record page) is covered in
test_frontier_safety_conclusions_record.py.
"""

from __future__ import annotations

import html
import importlib.util
import json
import re
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
CURRENT = json.loads((ROOT / "frontier-safety" / "data" / "current.json").read_text(encoding="utf-8"))
DATE = CURRENT["edition_date"]
EDITION_PATH = ROOT / "frontier-safety" / "data" / "editions" / f"{DATE}.json"
ADDENDUM_PATH = ROOT / "frontier-safety" / "data" / "conclusions" / f"{DATE}.json"
HEADINGS = {"shows": "The evidence shows", "points_to": "The evidence points to", "grey": "Still grey"}
WORDS = {"shows": "Shows", "points_to": "Points to", "grey": "Still grey"}
SUMMARY = "Evidence and what would change this"
EXPECTED = {
    "e1": ("edition", "shows"), "e2": ("edition", "points_to"), "e3": ("edition", "points_to"),
    "e4": ("edition", "grey"), "e5": ("edition", "points_to"), "e6": ("edition", "grey"),
    "x1": ("cross_edition", "shows"), "x2": ("cross_edition", "points_to"), "x3": ("cross_edition", "shows"),
    "x4": ("cross_edition", "points_to"), "x5": ("cross_edition", "shows"), "x6": ("cross_edition", "shows"),
}


def load_builder():
    path = ROOT / "tools" / "build_frontier_safety_briefing.py"
    spec = importlib.util.spec_from_file_location("frontier_safety_conclusions_builder", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BUILDER = load_builder()


def record() -> dict:
    return json.loads(EDITION_PATH.read_text(encoding="utf-8"))


def entry(**overrides) -> dict:
    base = {
        "id": "t1",
        "scope": "edition",
        "strength": "points_to",
        "lead": "Every control row rests on the reporting organization's own account.",
        "body": ["Observed: each row cites the organization that runs the control."],
        "evidence": ["item:aisi-2026-08-04-incident"],
        "would_change_it": "A published independent test of any listed control.",
    }
    base.update(overrides)
    return base


def with_conclusions(*entries: dict, date: str | None = None) -> dict:
    edition = record()
    edition["conclusions"] = list(entries)
    if date:
        edition["edition_date"] = date
    return edition


def live_section() -> str:
    page = (ROOT / "frontier-safety.html").read_text(encoding="utf-8")
    return page.split('<section class="mv conclusions"', 1)[1].split("</section>", 1)[0]


def articles(section: str) -> dict[str, str]:
    return dict(re.findall(r'<article class="conclusion" id="conclusion-([^"]+)">(.*?)</article>', section, re.S))


# The live edition.


def test_live_conclusions_are_the_sealed_companion_and_stay_outside_the_digest() -> None:
    addendum = json.loads(ADDENDUM_PATH.read_text(encoding="utf-8"))
    assert CURRENT["conclusions_addendum"] == {"added_on": addendum["added_on"], "conclusions": addendum["conclusions"]}
    assert {c["id"]: (c["scope"], c["strength"]) for c in addendum["conclusions"]} == EXPECTED
    history = json.loads((ROOT / "frontier-safety" / "data" / "history.json").read_text(encoding="utf-8"))
    assert BUILDER.edition_sha256(CURRENT) == history["editions"][-1]["sha256"] == CURRENT["edition_sha256"]
    assert "conclusions" not in record() and "conclusions_addendum" not in record()
    BUILDER.validate_edition(CURRENT)


def test_live_page_places_conclusions_between_the_summary_and_the_lanes() -> None:
    page = (ROOT / "frontier-safety.html").read_text(encoding="utf-8")
    section = live_section()
    assert page.index('<p class="lede">') < page.index('<section class="mv conclusions"')
    assert page.index('<section class="mv conclusions"') < page.index('<section class="mv briefing-overview"')
    assert page.index('<section class="mv conclusions"') < page.index('<section class="mv lane"')
    assert "What this edition lets us conclude</h2>" in section
    here, across = section.split('<div class="conclusions-across"><h3>Across editions</h3>', 1)
    order = [here.index(f"<h3>{HEADINGS[key]}</h3>") for key in ("shows", "points_to", "grey")]
    assert order == sorted(order)
    assert [f"<h4>{HEADINGS[key]}</h4>" in across for key in ("shows", "points_to")] == [True, True]
    assert set(articles(here)) == {key for key, (scope, _) in EXPECTED.items() if scope == "edition"}
    assert set(articles(across)) == {key for key, (scope, _) in EXPECTED.items() if scope == "cross_edition"}
    assert "after this edition&#x27;s record was published" in section


def test_each_conclusion_reads_as_one_bold_sentence_with_its_support_in_a_closed_disclosure() -> None:
    found = articles(live_section())
    entries = CURRENT["conclusions_addendum"]["conclusions"]
    assert set(found) == {item["id"] for item in entries}
    for item in entries:
        article = found[item["id"]]
        head, details = article.split("<details", 1)
        assert len(item["lead"].split()) <= 35, item["id"]
        assert head == (f'<p class="conclusion-lead"><span class="conclusion-strength">{WORDS[item["strength"]]}'
                        f'</span> <strong>{html.escape(item["lead"], quote=True)}</strong></p>'), item["id"]
        assert details.startswith(f' class="conclusion-more"><summary>{SUMMARY}</summary>'), item["id"]
        assert " open" not in details.split(">", 1)[0]
        for paragraph in item["body"]:
            assert f"<p>{html.escape(paragraph, quote=True)}</p>" in details, item["id"]
        assert "<strong>What would change this:</strong>" in details and '<p class="evidence-head">' in details
        assert article.count("<strong>") == 2, item["id"]  # the lead, and the what-would-change label


def test_the_key_defines_each_strength_heading() -> None:
    key = live_section().split('<dl class="conclusions-key">', 1)[1].split("</dl>", 1)[0]
    assert re.findall(r"<dt>([^<]+)</dt>", key) == [HEADINGS[k] for k in ("shows", "points_to", "grey")]


def test_every_evidence_link_lands_on_the_page_or_a_cited_source() -> None:
    page = (ROOT / "frontier-safety.html").read_text(encoding="utf-8")
    section = live_section()
    rest = page.replace(section, "")
    ids = set(re.findall(r'\sid="([^"]+)"', rest))
    external = set(re.findall(r'<a href="(https://[^"]+)" rel="noreferrer">', rest))
    evidence = re.findall(r'<div class="conclusion-evidence">(.*?)</div>', section, flags=re.S)
    links = [href for block in evidence for href in re.findall(r'href="([^"]+)"', block)]
    assert len(links) == sum(len(c["evidence"]) for c in CURRENT["conclusions_addendum"]["conclusions"])
    for href in links:
        if href.startswith("#"):
            assert href[1:] in ids, href
        elif href.startswith("https://"):
            assert href in external, href
        else:
            assert re.fullmatch(r"frontier-safety/archive/\d{4}-\d{2}-\d{2}\.html", href), href
            assert (ROOT / href).exists(), href


def test_addendum_never_reaches_the_dated_artifacts() -> None:
    for path in (
        ROOT / "frontier-safety" / "archive" / f"{DATE}.html",
        ROOT / "frontier-safety" / "data" / "archive" / f"{DATE}.json",
    ):
        text = path.read_text(encoding="utf-8")
        assert "conclusions_addendum" not in text and "What this edition lets us conclude" not in text


# The validator.


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"strength": "likely"}, r"strength 'likely' is not one of: shows, points_to, grey"),
        ({"scope": "lab"}, r"scope 'lab' is not one of"),
        ({"evidence": ["item:no-such-record"]}, r"does not resolve: no item in this edition"),
        ({"evidence": ["control:AISI says something it never said."]}, r"does not resolve: no control in this edition"),
        ({"evidence": ["source:https://openai.com/not-cited"]}, r"does not resolve: no source in this edition"),
        ({"evidence": ["edition:2026-09-30"]}, r"earlier edition with a published dated archive"),
        ({"evidence": ["edition:2026-09-20"]}, r"earlier edition with a published dated archive"),
        ({"evidence": ["aisi-2026-08-04-incident"]}, r"must be a typed reference"),
        ({"evidence": ["note:free text"]}, r"unknown reference kind 'note'"),
        ({"evidence": []}, r"evidence must be a non-empty list"),
        ({"evidence": ["item:aisi-2026-08-04-incident"] * 2}, r"repeats a reference"),
        ({"lead": " ".join(["word"] * 35) + " more."}, r"lead has 36 words; a lead is one sentence of 35"),
        ({"lead": "The record shows one thing. It shows another."}, r"lead must be exactly one sentence"),
        ({"lead": "The record shows one thing"}, r"lead must be exactly one sentence"),
        ({"lead": "Observed \u2014 always."}, r"lead contains an em dash"),
        ({"lead": "The edition_sha256 matches."}, r"lead contains an internal identifier, a snake_case"),
        ({"body": "One paragraph as text."}, r"body must be a non-empty list of paragraphs"),
        ({"body": []}, r"body must be a non-empty list of paragraphs"),
        ({"body": ["Observed \u2014 always."]}, r"body\[0\] contains an em dash"),
        ({"body": ["See C:/dev/public for the record."]}, r"body\[0\] contains a local path"),
        ({"body": ["Read it at /Users/someone/notes."]}, r"body\[0\] contains a local path"),
        ({"body": ["The source-state.json lists 13."]}, r"internal identifier, a file name"),
        ({"body": ["Digest 1567981150b0acc5 matches."]}, r"internal identifier, a hex digest"),
        ({"body": ["As aisi-2026-08-04-incident says."]}, r"record or source identifier"),
        ({"body": ["As aisi-unsanctioned-agent-behaviour says."]}, r"record or source identifier"),
        ({"body": ["Read https://metr.org/blog for it."]}, r"a URL; cite it in evidence"),
        ({"body": ["The page at openai.com refused."]}, r"internal identifier, a hostname"),
        ({"would_change_it": " "}, r"would_change_it must be non-empty text"),
        ({"scope": "cross_edition"}, r"is cross_edition but cites no earlier edition"),
        ({"id": "E 1"}, r"id must be a short lowercase id"),
        ({"note": "extra"}, r"unknown field\(s\) note"),
        ({"claim": "The old single-text field."}, r"unknown field\(s\) claim"),
    ],
)
def test_the_builder_refuses_malformed_conclusions(overrides: dict, message: str) -> None:
    with pytest.raises(BUILDER.EditionError, match=message):
        BUILDER.validate_edition(with_conclusions(entry(**overrides)))


def test_a_lead_is_required() -> None:
    missing = entry()
    missing.pop("lead")
    with pytest.raises(BUILDER.EditionError, match=r"missing field\(s\) lead"):
        BUILDER.validate_edition(with_conclusions(missing))


def test_the_builder_refuses_duplicate_ids_and_both_carriers() -> None:
    with pytest.raises(BUILDER.EditionError, match="repeats the id 't1'"):
        BUILDER.validate_edition(with_conclusions(entry(), entry()))
    both = with_conclusions(entry())
    both["conclusions_addendum"] = {"added_on": "2026-09-25", "conclusions": [entry()]}
    with pytest.raises(BUILDER.EditionError, match="never both"):
        BUILDER.validate_edition(both)
    early = record()
    early["conclusions_addendum"] = {"added_on": "2026-09-01", "conclusions": [entry()]}
    with pytest.raises(BUILDER.EditionError, match="on or after the edition date"):
        BUILDER.validate_edition(early)


def test_every_reference_kind_resolves() -> None:
    edition = record()
    control = edition["controls"][0]["claim"]
    url = edition["controls"][0]["sources"][0]
    BUILDER.validate_edition(with_conclusions(entry(
        scope="cross_edition",
        evidence=["item:aisi-2026-08-04-incident", f"control:{control}", f"source:{url}", "edition:2026-09-16"],
    )))


# The edition field for future editions.


def test_an_edition_field_is_inside_the_digest_and_renders_in_its_archive() -> None:
    plain = record()
    edition = with_conclusions(
        entry(id="a", strength="grey"),
        entry(id="b", strength="shows"),
        entry(id="c", scope="cross_edition", evidence=["edition:2026-09-16"]),
        date="2026-09-30",
    )
    plain["edition_date"] = "2026-09-30"
    assert BUILDER.edition_sha256(edition) != BUILDER.edition_sha256(plain)
    page = BUILDER.render_html(edition, archive=True)
    section = page.split('<section class="mv conclusions"', 1)[1].split("</section>", 1)[0]
    assert section.index("<h3>The evidence shows</h3>") < section.index("<h3>Still grey</h3>")
    assert section.index("<h3>Still grey</h3>") < section.index("<h3>Across editions</h3>")
    assert "<h4>The evidence points to</h4>" in section
    assert 'href="../../frontier-safety/archive/2026-09-16.html"' in section
    assert "record was published" not in section and "Dated record of these conclusions" not in section
    assert section.count(f"<summary>{SUMMARY}</summary>") == 3


def test_an_edition_without_conclusions_renders_no_section() -> None:
    assert '<section class="mv conclusions"' not in BUILDER.render_html(record(), archive=False)
