"""The source families tools/build_latex_papers.py typesets, each as name -> (LaTeX, receipt source).

- site_sources: the six philosophy papers in writing/papers/, via tools/paper_latex.py.
- research_sources: seven systems papers and notes read with `git show` at a pinned commit
  of the private research repository.
- corpus_sources: the two archived corpora, read with `git show HEAD:<file>` from their public
  repositories, via tools/corpus_latex.py.
- essay_sources: the long-form essays whose PDFs sit beside their plain-text sources, via
  tools/essay_latex.py.
"""

from __future__ import annotations

import hashlib
import re
import subprocess
from pathlib import Path

from tools import attribution, corpus_latex, essay_latex
from tools.corpus_corrections import CORRECTIONS, CORRECTIONS_OPENING
from tools.corpus_forewords import FOREWORDS
from tools.paper_latex import document
from tools.paper_markdown import front_block
from tools.paper_page import EARLIER_CORRECTIONS
from tools.render_papers import PAPERS

ROOT = Path(__file__).resolve().parents[1]
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
RESEARCH_KIND = "LaTeX in the private research repository, scrubbed and stamped by tools/attribution.py"
CORPUS_KIND = "deposited corpus source, converted by tools/corpus_latex.py"
ESSAY_KIND = "essay Markdown, converted by tools/essay_latex.py"
ESSAYS = {  # PDF name -> where the source, the PDF and the page live, and what the title block says
    "no-receipt-no-accept": {
        "source": "writing/no-receipt-no-accept/no-receipt-no-accept.md",
        "pdf": "writing/no-receipt-no-accept/no-receipt-no-accept.pdf",
        "page": "no-receipt-no-accept.html",
        "kind": "Long-form essay",
        "first_public": "28 July 2026",
        "note": ("This edition is typeset with LaTeX from the plain-text source the web page is rendered "
                 "from. It carries the plain-language revision approved on 25 September 2026 and the dated "
                 "corrections of 3 October 2026, listed at the end. The print of 28 July 2026 stays in the "
                 "public history of the site's repository."),
    },
}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def lf(raw: bytes) -> bytes:
    return raw.replace(b"\r\n", b"\n")


def site_sources() -> dict[str, tuple[bytes, dict]]:
    """name -> (generated LaTeX, receipt source block) for the six site papers."""
    out = {}
    for page, spec in PAPERS.items():
        name = Path(spec["pdf"]).stem
        raw = (ROOT / spec["source"]).read_bytes()
        text, digest = raw.decode("utf-8"), sha(lf(raw))
        tex = document(text, spec, EARLIER_CORRECTIONS.get(page, []), spec["source"])
        tex = attribution.stamp(tex, name, front_block(text)[0]["title"], digest, spec["source"])
        out[name] = (tex.encode("utf-8"), {
            "kind": "site Markdown, converted by tools/paper_latex.py", "path": spec["source"],
            "sha256": digest, "tex": f"papers/tex/{name}.tex", "page": page})
    return out


def research_sources(repo: Path) -> dict[str, tuple[bytes, dict]]:
    """The private sources are scrubbed (tools/attribution.scrub), stamped and published."""
    out = {}
    for name, folder in RESEARCH.items():
        path = f"papers/latex-sources/{folder}/main.tex"
        raw = subprocess.run(["git", "-C", str(repo), "show", f"{RESEARCH_COMMIT}:{path}"],
                             capture_output=True, check=True).stdout
        clean, removed = attribution.scrub(raw.decode("utf-8"), name)
        title = re.search(r"^\\title\{(.*)\}\s*$", clean, re.M).group(1)
        title = re.sub(r"^\\textbf\{(.*)\}$", r"\1", title)
        origin = f"private research repository, {path} at commit {RESEARCH_COMMIT[:12]}"
        tex = attribution.stamp(clean.rstrip("\n") + "\n", name, title, sha(raw), origin).encode("utf-8")
        out[name] = (tex, {"kind": RESEARCH_KIND, "commit": RESEARCH_COMMIT, "path": path, "sha256": sha(raw),
                           "tex": f"papers/tex/{name}.tex", "tex_sha256": sha(tex), "scrubbed": removed})
    return out


def corpus_inputs(page: str) -> dict[str, str]:
    """The site files a corpus PDF adds to its deposit, with their hashes."""
    paths = ["tools/corpus_latex.py", "tools/corpus_corrections.py", "tools/attribution.py"]
    paths += [FOREWORDS[page]] if page in FOREWORDS else []
    return {path: sha(lf((ROOT / path).read_bytes())) for path in paths}


def corpus_sources(workspace: Path) -> dict[str, tuple[bytes, dict]]:
    from tools.render_corpus import CORPORA as PAGES
    out = {}
    for name, (page, repo, file) in CORPORA.items():
        checkout = workspace / "public" / repo
        commit = subprocess.run(["git", "-C", str(checkout), "rev-parse", "HEAD"],
                                capture_output=True, text=True, check=True).stdout.strip()
        raw = subprocess.run(["git", "-C", str(checkout), "show", f"HEAD:{file}"], capture_output=True, check=True).stdout
        # The PDF names the license of the deposit at the DOI, which Zenodo records as CC BY 4.0.
        corpus = {**next(c for c in PAGES if c["out"].name == page), "licence": attribution.LICENSE}
        foreword = (attribution.strip_front_matter((ROOT / FOREWORDS[page]).read_text(encoding="utf-8"))
                    if page in FOREWORDS else "")
        corrections = CORRECTIONS.get(page, [])
        origin = f"github.com/HarperZ9/{repo}, file {file} at commit {commit[:12]}"
        tex = corpus_latex.document(corpus, raw.decode("utf-8"), foreword, corrections,
                                    CORRECTIONS_OPENING if corrections else "", origin)
        tex = attribution.stamp(tex, name, corpus["title"], sha(lf(raw)), origin).encode("utf-8")
        out[name] = (tex, {"kind": CORPUS_KIND, "repository": f"github.com/HarperZ9/{repo}", "commit": commit,
                           "path": file, "sha256": sha(lf(raw)), "tex": f"papers/tex/{name}.tex",
                           "tex_sha256": sha(tex), "page": page, "site_inputs": corpus_inputs(page)})
    return out


def essay_sources() -> dict[str, tuple[bytes, dict]]:
    out = {}
    for name, essay in ESSAYS.items():
        raw = (ROOT / essay["source"]).read_bytes()
        text = attribution.strip_front_matter(raw.decode("utf-8"))
        title = re.match(r"#\s+([^\n]+)", text).group(1).strip()
        tex = attribution.stamp(essay_latex.document(text, essay), name, title, sha(lf(raw)), essay["source"])
        out[name] = (tex.encode("utf-8"), {"kind": ESSAY_KIND, "path": essay["source"], "sha256": sha(lf(raw)),
                                           "tex": f"papers/tex/{name}.tex", "page": essay["page"], "pdf": essay["pdf"]})
    return out
