"""Typeset the published papers with LaTeX, twice each, and write a build receipt per paper.

    TECTONIC=path/to/tectonic python tools/build_latex_papers.py            # the six site papers
    TECTONIC=... python tools/build_latex_papers.py --research PATH          # and the seven LaTeX papers
    TECTONIC=... python tools/build_latex_papers.py --corpus-workspace PATH  # and the two corpora
    python tools/build_latex_papers.py --check                               # no engine needed

Three source families feed papers/:
- The six philosophy papers in writing/papers/. tools/paper_latex.py turns each approved
  source into papers/tex/<name>.tex, which anyone can rebuild.
- Seven systems papers and notes whose LaTeX sources live in a private research repository.
  Each is read with `git show` at the pinned commit below, so no branch is switched.
- The two archived corpora, Conferred Existence and The Witnessing Spine. Their deposited
  sources live in their own public repositories; each is read with `git show HEAD:<file>`
  from a workspace that holds both checkouts, and the receipt names the repository, commit
  and source hash. tools/corpus_latex.py adds the dated foreword and corrections the web
  pages carry. The .tex file is committed, so the PDF can be rebuilt without the workspace.

Every build runs Tectonic offline (`--only-cached`) against one pinned bundle, with
SOURCE_DATE_EPOCH fixed, two times in separate folders. The PDF is written only when both
runs give the same bytes. The receipt names the source hash, the engine and its binary hash,
the bundle digest, the epoch and the PDF hash. `--check` confirms that every committed
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

from tools import corpus_latex
from tools.corpus_corrections import CORRECTIONS, CORRECTIONS_OPENING
from tools.corpus_forewords import FOREWORDS
from tools.paper_latex import document
from tools.paper_page import EARLIER_CORRECTIONS
from tools.render_papers import PAPERS

ROOT = Path(__file__).resolve().parents[1]
RECEIPTS = ROOT / "papers" / "receipts"
TEX = ROOT / "papers" / "tex"
BUNDLE = {"name": "default_bundle_v33.tar",
          "digest": "6ffe055852f8faf66c0acbe1a7fb27f87b869a90bad1204f3bf4d9683f597c7c"}
SITE_EPOCH = "1790985600"  # 2026-10-03T00:00:00Z, the edition date
RESEARCH_EPOCH = "1782864000"  # 2026-07-01T00:00:00Z, the month the papers were deposited
RESEARCH_COMMIT = "b76c70ba00e8e3a535f3def286650f08318c6c46"
RESEARCH = {  # site PDF name -> source folder under papers/latex-sources/
    "emet-integrity-witness": "emet-paper",
    "buildlang-capability-effects": "buildlang-paper",
    "witnessed-independence": "witnessed-independence-paper",
    "proof-packets": "proof-packets-paper",
    "personhood-gate-handoff": "personhood-gate-note",
    "re-perceived-effects": "actuator-certificate-note",
    "faithfulness-conserved-quantity": "faithfulness-conservation-note",
}
CORPORA = {  # site PDF name -> (web page, public repository, deposited file)
    "conferred-existence": ("conferred-existence.html", "senses-and-sensibility", "CONFERRED-EXISTENCE.txt"),
    "witnessing-spine": ("witnessing-spine.html", "witnessing-spine", "SYNTHESIS-the-witnessing-spine.md"),
}
CORPUS_KIND = "deposited corpus source, converted by tools/corpus_latex.py"
DOES_NOT_PROVE = ("Two identical builds show that this PDF follows from this source, engine and bundle. "
                  "They do not show that the paper's claims are true, and a different engine or bundle "
                  "may give different bytes.")


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def site_sources() -> dict[str, tuple[bytes, dict]]:
    """name -> (generated LaTeX, receipt source block) for the six site papers."""
    out = {}
    for page, spec in PAPERS.items():
        name = Path(spec["pdf"]).stem
        raw = (ROOT / spec["source"]).read_bytes()
        tex = document(raw.decode("utf-8"), spec, EARLIER_CORRECTIONS.get(page, []), spec["source"])
        out[name] = (tex.encode("utf-8"), {
            "kind": "site Markdown, converted by tools/paper_latex.py", "path": spec["source"],
            "sha256": sha(raw.replace(b"\r\n", b"\n")), "tex": f"papers/tex/{name}.tex", "page": page})
    return out


def research_sources(repo: Path) -> dict[str, tuple[bytes, dict]]:
    out = {}
    for name, folder in RESEARCH.items():
        path = f"papers/latex-sources/{folder}/main.tex"
        tex = subprocess.run(["git", "-C", str(repo), "show", f"{RESEARCH_COMMIT}:{path}"],
                             capture_output=True, check=True).stdout
        out[name] = (tex, {"kind": "LaTeX in the private research repository", "commit": RESEARCH_COMMIT,
                           "path": path, "sha256": sha(tex)})
    return out


def corpus_inputs(page: str) -> dict[str, str]:
    """The site files a corpus PDF adds to its deposit, with their hashes."""
    paths = ["tools/corpus_latex.py", "tools/corpus_corrections.py"] + ([FOREWORDS[page]] if page in FOREWORDS else [])
    return {path: sha((ROOT / path).read_bytes().replace(b"\r\n", b"\n")) for path in paths}


def corpus_sources(workspace: Path) -> dict[str, tuple[bytes, dict]]:
    from tools.render_corpus import CORPORA as PAGES
    out = {}
    for name, (page, repo, file) in CORPORA.items():
        checkout = workspace / "public" / repo
        commit = subprocess.run(["git", "-C", str(checkout), "rev-parse", "HEAD"],
                                capture_output=True, text=True, check=True).stdout.strip()
        raw = subprocess.run(["git", "-C", str(checkout), "show", f"HEAD:{file}"], capture_output=True, check=True).stdout
        corpus = next(c for c in PAGES if c["out"].name == page)
        foreword = (ROOT / FOREWORDS[page]).read_text(encoding="utf-8") if page in FOREWORDS else ""
        corrections = CORRECTIONS.get(page, [])
        origin = f"github.com/HarperZ9/{repo}, file {file} at commit {commit[:12]}"
        tex = corpus_latex.document(corpus, raw.decode("utf-8"), foreword, corrections,
                                    CORRECTIONS_OPENING if corrections else "", origin).encode("utf-8")
        out[name] = (tex, {"kind": CORPUS_KIND, "repository": f"github.com/HarperZ9/{repo}", "commit": commit,
                           "path": file, "sha256": sha(raw.replace(b"\r\n", b"\n")), "tex": f"papers/tex/{name}.tex",
                           "tex_sha256": sha(tex), "page": page, "site_inputs": corpus_inputs(page)})
    return out


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
        (ROOT / "papers" / f"{name}.pdf").write_bytes(first)
        receipt = {
            "schema": "paper-build-receipt/v1", "paper": f"papers/{name}.pdf", "source": source,
            "engine": {"name": engine, "binary_sha256": engine_sha, "flags": "-X compile --only-cached"},
            "bundle": BUNDLE, "source_date_epoch": epoch, "runs": 2, "rebuild_identical": True,
            "pdf_sha256": sha(first), "pdf_bytes": len(first),
            "rerun": (f"SOURCE_DATE_EPOCH={epoch} tectonic -X compile --only-cached {source['tex']}"
                      if "tex" in source else "The source is private; its commit and hash identify it."),
            "does_not_prove": DOES_NOT_PROVE,
        }
        (RECEIPTS / f"{name}.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8", newline="\n")
    return 1 if failed else 0


def check() -> int:
    """Every receipt matches its PDF, and every site receipt matches its source and .tex."""
    problems = []
    site = site_sources()
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
                problems.append(f"{path.name}: papers/tex is stale against tools/paper_latex.py")
        if receipt["source"].get("kind") == CORPUS_KIND:
            source = receipt["source"]
            tex_path = ROOT / source["tex"]
            if not tex_path.is_file() or sha(tex_path.read_bytes()) != source["tex_sha256"]:
                problems.append(f"{path.name}: papers/tex differs from the receipt")
            if corpus_inputs(source["page"]) != source["site_inputs"]:
                problems.append(f"{path.name}: the converter, a foreword or a correction changed since the build")
    missing = sorted((set(site) | set(CORPORA)) - {p.stem for p in RECEIPTS.glob("*.json")})
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

    status = build(exe, chosen(site_sources()), SITE_EPOCH)
    if args.research:
        status |= build(exe, chosen(research_sources(args.research)), RESEARCH_EPOCH)
    if args.corpus_workspace:
        status |= build(exe, chosen(corpus_sources(args.corpus_workspace)), SITE_EPOCH)
    return status


if __name__ == "__main__":
    sys.exit(main())
