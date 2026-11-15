"""The Zenodo DOIs of the deposited papers, read from one place: papers/deposits.json.

Each paper has one entry there. `version_doi` is the record of the edition the PDF and the
page carry, and it feeds the deposit line, the footer on every PDF page, the .tex header
and the build receipt. `concept_doi` resolves to every version of the record and never goes
stale; it prints beside the deposit line when `all_versions` is true. `edition_note` is
appended to the edition label of the PDF. `replaces` names the earlier Zenodo version of the
same edition and the file's `verified` entry is the Verified line; the page prints both and
the PDF prints neither, since the PDF is the deposited file and cannot report on its own
deposit.

A build for a version that Zenodo has reserved and not yet published must not change the
committed file. It passes the reserved DOI through the environment instead:

    PAPER_VERSION_DOIS=arity-gap=10.5281/zenodo.NNN,self-given=10.5281/zenodo.MMM

Each paper named there takes that version DOI, prints the concept DOI as "All versions",
and marks the edition label as the LaTeX typeset. tools/build_zenodo_versions.py sets the
variable from its command line.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / "papers" / "deposits.json"
ENV = "PAPER_VERSION_DOIS"
TYPESET_NOTE = ", LaTeX typeset"
DOI = re.compile(r"10\.5281/zenodo\.[A-Za-z0-9]+")


def parse(pairs: str) -> dict[str, str]:
    """`name=doi,name=doi` as a dict; a malformed pair stops the build."""
    out: dict[str, str] = {}
    for item in filter(None, (part.strip() for part in pairs.split(","))):
        name, _, doi = item.partition("=")
        if not DOI.fullmatch(doi):
            raise SystemExit(f"{ENV}: {item!r} is not name=10.5281/zenodo.<record>")
        out[name] = doi
    return out


def load(pairs: str | None = None) -> dict[str, dict]:
    """The deposits table, with any reserved version DOIs applied."""
    table = json.loads(PATH.read_text(encoding="utf-8"))
    papers = {name: {**entry, "verified": table.get("verified")} for name, entry in table["papers"].items()}
    for name, doi in parse(os.environ.get(ENV, "") if pairs is None else pairs).items():
        if name not in papers:
            raise SystemExit(f"{ENV}: no paper named {name!r} in papers/deposits.json")
        # a reserved version is not checked yet, and it replaces whatever the table calls current
        papers[name] = {**papers[name], "version_doi": doi, "all_versions": True, "edition_note": TYPESET_NOTE,
                        "verified": None, "replaces": None}
    return papers


DEPOSITS = load()


def version_doi(name: str) -> str:
    return DEPOSITS[name]["version_doi"]


def spec_fields(name: str) -> dict[str, str]:
    """The fields a paper's entry in tools/render_papers.PAPERS takes from its deposit."""
    entry = DEPOSITS[name]
    out = {"doi": entry["version_doi"]}
    if entry.get("all_versions"):
        out["concept_doi"] = entry["concept_doi"]
    if entry.get("edition_note"):
        out["edition_note"] = entry["edition_note"]
    if entry.get("replaces"):
        out["replaces"] = (entry["replaces"]["doi"], entry["replaces"]["label"])
    if entry.get("verified"):
        out["verified"] = (entry["verified"]["date"], entry["verified"]["text"])
    return out
