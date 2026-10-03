"""Typeset the published papers with LaTeX, twice each, and write a build receipt per paper.

    TECTONIC=path/to/tectonic python tools/build_latex_papers.py            # the six site papers
    TECTONIC=... python tools/build_latex_papers.py --research PATH          # and the seven LaTeX papers
    TECTONIC=... python tools/build_latex_papers.py --corpus-workspace PATH  # and the two corpora
    python tools/build_latex_papers.py --check                               # no engine needed

Four source families, collected in tools/latex_sources.py, feed papers/ (the essay PDFs sit
beside their sources in writing/):
- The six philosophy papers in writing/papers/. tools/paper_latex.py turns each approved
  source into papers/tex/<name>.tex, which anyone can rebuild.
- Seven systems papers and notes whose LaTeX sources live in a private research repository.
  Each is read with `git show` at the pinned commit, so no branch is switched. Since
  3 October 2026 each is scrubbed (tools/attribution.scrub strips comments and refuses a
  local path, a credential or a private note), stamped and published as papers/tex/<name>.tex.
- The two archived corpora, Conferred Existence and The Witnessing Spine. Their deposited
  sources live in their own public repositories; each is read with `git show HEAD:<file>`
  from a workspace that holds both checkouts, and the receipt names the repository, commit
  and source hash. tools/corpus_latex.py adds the dated foreword and corrections the web
  pages carry. The .tex file is committed, so the PDF can be rebuilt without the workspace.
- The long-form essays. tools/essay_latex.py turns the single-file plain-text edition, the
  same text the web page is rendered from, into papers/tex/<name>.tex. These build with the
  site papers.

Every build runs Tectonic offline (`--only-cached`) against one pinned bundle, with
SOURCE_DATE_EPOCH fixed, two times in separate folders. The PDF is written only when both
runs give the same bytes. The receipt names the source hash, the engine and its binary hash,
the bundle digest, the epoch and the PDF hash. Every .tex and PDF carries the author's
name, the license, the DOI or page and the first-public date from tools/attribution.py, and
each receipt records that attribution. `--check` confirms that every committed
receipt still matches its source, its .tex file and its PDF, which is what CI runs.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools.attribution import record as attribution_record
from tools.latex_sources import (CORPORA, CORPUS_KIND, RESEARCH_KIND, ESSAY_KIND, ESSAYS, RESEARCH, RESEARCH_COMMIT,  # noqa: F401
                                 corpus_inputs, corpus_sources, essay_sources, research_sources, sha,
                                 site_sources)

ROOT = Path(__file__).resolve().parents[1]
RECEIPTS = ROOT / "papers" / "receipts"
TEX = ROOT / "papers" / "tex"
BUNDLE = {"name": "default_bundle_v33.tar",
          "digest": "6ffe055852f8faf66c0acbe1a7fb27f87b869a90bad1204f3bf4d9683f597c7c"}
SITE_EPOCH = "1790985600"  # 2026-10-03T00:00:00Z, the edition date
RESEARCH_EPOCH = "1782864000"  # 2026-07-01T00:00:00Z, the month the papers were deposited
PRIORITY = ("The dated public record, the DOI or the commit that first published the work and the hashes in "
            "this receipt, is what establishes priority. The name on every page is there for attribution.")
DOES_NOT_PROVE = ("Two identical builds show that this PDF follows from this source, engine and bundle. "
                  "They do not show that the paper's claims are true, and a different engine or bundle "
                  "may give different bytes.")


def compile_twice(exe: str, name: str, tex: bytes, epoch: str) -> tuple[bytes, bytes]:
    pdfs = []
    env = dict(os.environ, SOURCE_DATE_EPOCH=epoch)
    for run in ("run1", "run2"):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / run
            work.mkdir()
            (work / f"{name}.tex").write_bytes(tex)
            result = subprocess.run([exe, "-X", "compile", "--only-cached", "--outdir", str(work),
                                     str(work / f"{name}.tex")], capture_output=True, text=True, env=env)
            if result.returncode:
                print(result.stdout[-3000:], result.stderr[-3000:], sep="\n", file=sys.stderr)
                raise SystemExit(f"{name}: tectonic failed in {run}")
            if "Missing character" in result.stdout + result.stderr:
                raise SystemExit(f"{name}: a glyph is missing from the font; see the Tectonic log")
            pdfs.append((work / f"{name}.pdf").read_bytes())
    return pdfs[0], pdfs[1]


def build(exe: str, sources: dict[str, tuple[bytes, dict]], epoch: str) -> int:
    engine = subprocess.run([exe, "--version"], capture_output=True, text=True, check=True).stdout.strip()
    engine_sha = sha(Path(exe).read_bytes())
    RECEIPTS.mkdir(parents=True, exist_ok=True)
    failed = 0
    for name, (tex, source) in sources.items():
        first, second = compile_twice(exe, name, tex, epoch)
        same = first == second
        print(f"{name:34} {'identical' if same else 'DIFFERENT'} {sha(first)[:16]}")
        if not same:
            failed += 1
            continue
        if "tex" in source:
            TEX.mkdir(parents=True, exist_ok=True)
            (ROOT / source["tex"]).write_bytes(tex)
        pdf_path = source.get("pdf", f"papers/{name}.pdf")
        (ROOT / pdf_path).write_bytes(first)
        receipt = {
            "schema": "paper-build-receipt/v1", "paper": pdf_path, "source": source,
            "engine": {"name": engine, "binary_sha256": engine_sha, "flags": "-X compile --only-cached"},
            "bundle": BUNDLE, "source_date_epoch": epoch, "runs": 2, "rebuild_identical": True,
            "pdf_sha256": sha(first), "pdf_bytes": len(first), "attribution": attribution_record(name),
            "rerun": (f"SOURCE_DATE_EPOCH={epoch} tectonic -X compile --only-cached {source['tex']}"
                      if "tex" in source else "The source is private; its commit and hash identify it."),
            "priority": PRIORITY,
            "does_not_prove": DOES_NOT_PROVE,
        }
        (RECEIPTS / f"{name}.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8", newline="\n")
    return 1 if failed else 0


def check() -> int:
    """Every receipt matches its PDF, and every site receipt matches its source and .tex."""
    problems = []
    site = {**site_sources(), **essay_sources()}
    for path in sorted(RECEIPTS.glob("*.json")):
        receipt = json.loads(path.read_text(encoding="utf-8"))
        pdf = ROOT / receipt["paper"]
        if not pdf.is_file() or sha(pdf.read_bytes()) != receipt["pdf_sha256"]:
            problems.append(f"{path.name}: PDF hash differs from the receipt")
        if path.stem in site:
            tex, source = site[path.stem]
            if source["sha256"] != receipt["source"]["sha256"]:
                problems.append(f"{path.name}: the Markdown source changed since the build")
            if (ROOT / source["tex"]).read_bytes() != tex:
                problems.append(f"{path.name}: papers/tex is stale against its converter")
        if receipt.get("attribution") != attribution_record(path.stem):
            problems.append(f"{path.name}: the attribution differs from tools/attribution.py")
        if receipt["source"].get("kind") in {CORPUS_KIND, RESEARCH_KIND}:
            source = receipt["source"]
            tex_path = ROOT / source["tex"]
            if not tex_path.is_file() or sha(tex_path.read_bytes()) != source["tex_sha256"]:
                problems.append(f"{path.name}: papers/tex differs from the receipt")
            if source["kind"] == CORPUS_KIND and corpus_inputs(source["page"]) != source["site_inputs"]:
                problems.append(f"{path.name}: the converter, a foreword or a correction changed since the build")
    missing = sorted((set(site) | set(CORPORA) | set(RESEARCH)) - {p.stem for p in RECEIPTS.glob("*.json")})
    problems += [f"{name}: no receipt" for name in missing]
    for line in problems:
        print(line)
    print(f"{len(list(RECEIPTS.glob('*.json')))} receipts checked, {len(problems)} problems")
    return 1 if problems else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--research", type=Path, help="checkout of the private research repository")
    parser.add_argument("--corpus-workspace", type=Path, help="workspace holding public/<corpus repository>")
    parser.add_argument("--only", nargs="*", help="build only these PDF names")
    args = parser.parse_args()
    if args.check:
        return check()
    exe = os.environ.get("TECTONIC") or shutil.which("tectonic")
    if not exe:
        raise SystemExit("no Tectonic binary: set TECTONIC or put tectonic on PATH")
    def chosen(sources: dict) -> dict:
        return {k: v for k, v in sources.items() if not args.only or k in args.only}

    status = build(exe, chosen({**site_sources(), **essay_sources()}), SITE_EPOCH)
    if args.research:
        status |= build(exe, chosen(research_sources(args.research)), RESEARCH_EPOCH)
    if args.corpus_workspace:
        status |= build(exe, chosen(corpus_sources(args.corpus_workspace)), SITE_EPOCH)
    return status


if __name__ == "__main__":
    sys.exit(main())
