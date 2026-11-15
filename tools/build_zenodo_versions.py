"""Build the files for a new Zenodo version of a deposited paper. Uploads nothing.

    TECTONIC=path/to/tectonic python tools/build_zenodo_versions.py --out DIR \
        arity-gap=10.5281/zenodo.NNN self-given=10.5281/zenodo.MMM
    python tools/build_zenodo_versions.py --out DIR --tex-only arity-gap=10.5281/zenodo.NNN

Zenodo reserves the DOI of a new version when its draft is created, before anything is
published. Each NAME=DOI pair hands that reserved DOI to the build. The paper is typeset
from the same approved source as the site PDF, with three differences, all on the first
page or in the footer: the deposit line and the footer cite the reserved version DOI, the
deposit line adds the concept DOI as "All versions", and the edition label says the PDF is
the LaTeX typeset. Nothing under papers/ changes; the files land in DIR/NAME/:

    NAME.pdf            typeset twice with the pinned engine and bundle, kept when both runs agree
    NAME.tex            the LaTeX the PDF was built from
    NAME.md, NAME.html  the plain editions of the same source
    NAME.receipt.json   source hash, engine, bundle, PDF hash and the DOI counts found in the PDF
    SHA256SUMS

The build stops when the PDF does not carry the version DOI once in the deposit line and
once in the footer of every page, or carries the concept DOI any number of times but once.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools import deposits

ROOT = Path(__file__).resolve().parents[1]


def plain_editions(name: str) -> dict[str, str]:
    """The Markdown and bare HTML editions, made the way the October 2026 deposit made them."""
    from tools.paper_markdown import front_block, render

    fields, body = front_block((ROOT / "writing" / "papers" / f"{name}.md").read_text(encoding="utf-8"))
    title, byline, note = fields["title"], fields["byline"], fields["revision_note"]
    md = [f"# {title}", ""]
    if fields.get("subtitle"):
        md += [fields["subtitle"], ""]
    md += [f"Zain Dana Harper. {byline}", "", f"Revised 3 October 2026. {note}", "", body.strip(), ""]
    esc = lambda text: html.escape(text, quote=False)  # noqa: E731
    page = (f'<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><title>{esc(title)}</title></head><body>\n'
            f"<h1>{esc(title)}</h1>\n<p>Zain Dana Harper. {esc(byline)}</p>\n"
            f"<p><b>Revised 3 October 2026.</b> {esc(note)}</p>\n{render(body.strip())}\n</body></html>\n")
    return {f"{name}.md": "\n".join(md), f"{name}.html": page}


def doi_counts(pdf: Path, version: str, concept: str) -> dict[str, int]:
    """How often each DOI appears in the PDF text, and the page count. Line breaks are closed first."""
    from pypdf import PdfReader

    pages = [re.sub(r"\s+", "", page.extract_text()) for page in PdfReader(pdf).pages]
    text = "".join(pages)
    return {"pages": len(pages), "version_doi": text.count(version), "concept_doi": text.count(concept),
            "version_doi_in_deposit_line": text.count(f"depositedatZenodo,https://doi.org/{version}"),
            "pages_with_version_doi_footer": sum(f"doi.org/{version}·firstpublic" in page for page in pages)}


def build_one(name: str, tex: bytes, source: dict, out: Path, exe: str | None) -> None:
    from tools import build_latex_papers as latex
    from tools.attribution import record

    out.mkdir(parents=True, exist_ok=True)
    entry = deposits.DEPOSITS[name]
    files = {f"{name}.tex": tex, **{k: v.encode("utf-8") for k, v in plain_editions(name).items()}}
    receipt: dict = {"schema": "zenodo-version-build/v1", "paper": f"{name}.pdf",
                     "source": {"path": source["path"], "sha256": source["sha256"], "page": source["page"]},
                     "deposit": entry, "attribution": record(name)}
    if exe:
        first, second = latex.compile_twice(exe, name, tex, latex.SITE_EPOCH)
        if first != second:
            raise SystemExit(f"{name}: the two runs gave different bytes")
        files[f"{name}.pdf"] = first
        engine = subprocess.run([exe, "--version"], capture_output=True, text=True, check=True).stdout.strip()
        receipt |= {"engine": {"name": engine, "binary_sha256": latex.sha(Path(exe).read_bytes()),
                               "flags": "-X compile --only-cached"},
                    "bundle": latex.BUNDLE, "source_date_epoch": latex.SITE_EPOCH, "runs": 2,
                    "rebuild_identical": True, "pdf_sha256": latex.sha(first), "pdf_bytes": len(first),
                    "rerun": f"SOURCE_DATE_EPOCH={latex.SITE_EPOCH} tectonic -X compile --only-cached {name}.tex"}
    for filename, data in files.items():
        (out / filename).write_bytes(data)
    if exe:
        counts = doi_counts(out / f"{name}.pdf", entry["version_doi"], entry["concept_doi"])
        receipt["doi_counts"] = counts
        expected = {"version_doi": counts["pages"] + 1, "concept_doi": 1, "version_doi_in_deposit_line": 1,
                    "pages_with_version_doi_footer": counts["pages"]}
        wrong = {key: (counts[key], want) for key, want in expected.items() if counts[key] != want}
        if wrong:
            raise SystemExit(f"{name}: DOI counts (found, expected) are off: {wrong}")
    files[f"{name}.receipt.json"] = (json.dumps(receipt, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    (out / f"{name}.receipt.json").write_bytes(files[f"{name}.receipt.json"])
    from tools.latex_sources import sha

    sums = "".join(f"{sha(data)}  {filename}\n" for filename, data in sorted(files.items()))
    (out / "SHA256SUMS").write_bytes(sums.encode("utf-8"))
    print(f"{name:30} {entry['version_doi']}  {'tex only' if not exe else receipt['pdf_sha256'][:16]}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("pairs", nargs="+", metavar="NAME=DOI", help="paper name and its reserved version DOI")
    parser.add_argument("--out", type=Path, required=True, help="folder that receives one subfolder per paper")
    parser.add_argument("--tex-only", action="store_true", help="write the .tex, .md and .html; no engine needed")
    args = parser.parse_args()
    os.environ[deposits.ENV] = ",".join(args.pairs)
    wanted = deposits.parse(os.environ[deposits.ENV])
    deposits.DEPOSITS.update(deposits.load())  # before the modules that read the table are imported
    exe = None if args.tex_only else os.environ.get("TECTONIC") or shutil.which("tectonic")
    if not exe and not args.tex_only:
        raise SystemExit("no Tectonic binary: set TECTONIC or put tectonic on PATH")
    from tools.latex_sources import site_sources

    sources = site_sources()
    for name in wanted:
        tex, source = sources[name]
        build_one(name, tex, source, args.out / name, exe)
    return 0


if __name__ == "__main__":
    sys.exit(main())
