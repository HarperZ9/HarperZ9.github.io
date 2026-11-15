"""The deposit DOIs of the four October papers come from papers/deposits.json, and a reserved
version DOI changes only the lines that name the deposit.

15 November 2026: the LaTeX typeset of each paper is prepared as a new Zenodo version. Zenodo
reserves the version DOI before publication, so the build takes it from the command line and
leaves the committed PDFs, sources and receipts alone until the version is published.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

from tools import attribution, deposits
from tools.render_papers import PAPERS

ROOT = Path(__file__).resolve().parents[1]
PENDING = "10.5281/zenodo.PENDING"


def test_the_committed_table_feeds_the_page_spec_and_the_attribution() -> None:
    table = deposits.load("")
    assert set(table) == {"arity-gap", "forcing-argument", "self-given", "conservation-of-faithfulness"}
    for spec in PAPERS.values():
        name = Path(spec["pdf"]).stem
        if name in table:
            assert spec["doi"] == table[name]["version_doi"] == attribution.RECORDS[name][0]
            assert ("concept_doi" in spec) == bool(table[name]["all_versions"])
            assert table[name]["concept_doi"] != table[name]["version_doi"]
        else:
            assert "doi" not in spec


def test_a_reserved_doi_turns_on_the_all_versions_line_and_the_typeset_label() -> None:
    entry = deposits.load(f"self-given={PENDING}")["self-given"]
    assert entry["version_doi"] == PENDING and entry["all_versions"] is True
    assert entry["edition_note"] == ", LaTeX typeset"
    assert deposits.load(f"self-given={PENDING}")["arity-gap"] == deposits.load("")["arity-gap"]
    for bad in ("self-given", "self-given=10.1234/other.1", f"no-such-paper={PENDING}"):
        with pytest.raises(SystemExit):
            deposits.load(bad)


def test_a_version_build_changes_only_the_lines_that_name_the_deposit(tmp_path: Path) -> None:
    """False-success control: the build must not touch the body, and must not leave the
    October DOI anywhere in the new source."""
    name = "arity-gap"
    old_doi = deposits.load("")[name]["version_doi"]
    concept = deposits.load("")[name]["concept_doi"]
    subprocess.run([sys.executable, "tools/build_zenodo_versions.py", "--out", str(tmp_path), "--tex-only",
                    f"{name}={PENDING}"], cwd=ROOT, check=True, capture_output=True)
    new = (tmp_path / name / f"{name}.tex").read_text(encoding="utf-8").split("\n")
    old = (ROOT / "papers" / "tex" / f"{name}.tex").read_text(encoding="utf-8").split("\n")
    assert len(new) == len(old)
    changed = [(a, b) for a, b in zip(old, new) if a != b]
    # the header comment, the footer definition, the edition label and the revision note
    assert len(changed) == 4
    for before, after in changed:
        restored = after.replace("zenodo.PENDING", old_doi.rsplit("/", 1)[1]).replace(", LaTeX typeset", "")
        assert restored.replace(rf" All versions: \url{{https://doi.org/{concept}}}.", "") == before
    text = "\n".join(new)
    assert old_doi.rsplit("/", 1)[1] not in text
    # the footer breaks the DOI after its slash, so count the record part
    assert text.count("zenodo.PENDING") == 3 and text.count(concept) == 1 and text.count("LaTeX typeset") == 1
    assert sorted(p.name for p in (tmp_path / name).iterdir()) == [
        "SHA256SUMS", f"{name}.html", f"{name}.md", f"{name}.receipt.json", f"{name}.tex"]
