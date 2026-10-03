"""The author's name, the license and the dated public record, stamped on every typeset file.

Every paper and essay PDF and its .tex source carry the same attribution: a header comment
in the .tex, Author and Copyright in the PDF information dictionary, and a quiet footer on
every page. The dated public record (the DOI, the commit that first published the work, and
the hashes in the build receipt) is what establishes priority. The visible name is there
for attribution.

Dates come from this table, which the build copies into each receipt, never from the build
clock, so the PDFs stay byte-reproducible. Each first-public date names its evidence: the
Zenodo publication date of the first version for a DOI record, or the commit that first put
the work on this site.
"""

from __future__ import annotations

import re
from datetime import date

AUTHOR = "Zain Dana Harper"
YEAR = "2026"
LICENSE = "CC BY 4.0"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
SITE = "harperz9.github.io"

# PDF name -> (DOI or None, first public date, evidence for that date, page when there is no DOI)
RECORDS: dict[str, tuple[str | None, str, str, str | None]] = {
    "emet-integrity-witness": ("10.5281/zenodo.21230267", "2026-07-07", "Zenodo, first version", None),
    "buildlang-capability-effects": ("10.5281/zenodo.21231253", "2026-07-07", "Zenodo, first version", None),
    "witnessed-independence": ("10.5281/zenodo.21232206", "2026-07-07", "Zenodo, first version", None),
    "proof-packets": ("10.5281/zenodo.21231406", "2026-07-07", "Zenodo, first version", None),
    "personhood-gate-handoff": ("10.5281/zenodo.21234475", "2026-07-07", "Zenodo, first version", None),
    "re-perceived-effects": ("10.5281/zenodo.21231311", "2026-07-07", "Zenodo, first version", None),
    "faithfulness-conserved-quantity": ("10.5281/zenodo.22768398", "2026-09-15", "Zenodo, first version", None),
    "conferred-existence": ("10.5281/zenodo.20773724", "2026-06-20", "Zenodo, first version", None),
    "witnessing-spine": ("10.5281/zenodo.20778927", "2026-06-20", "Zenodo, first version", None),
    "arity-gap": ("10.5281/zenodo.23126117", "2026-09-15", "Zenodo, first version (10.5281/zenodo.22768629)", None),
    "forcing-argument": ("10.5281/zenodo.23126357", "2026-09-15", "Zenodo, first version (10.5281/zenodo.22768809)", None),
    "self-given": ("10.5281/zenodo.23126458", "2026-09-15", "Zenodo, first version (10.5281/zenodo.22768919)", None),
    "conservation-of-faithfulness": ("10.5281/zenodo.23126484", "2026-06-30",
                                     "site commit 450a8c4d, research-conservation-of-faithfulness.html", None),
    "conferred-existence-paper": (None, "2026-06-30", "site commit 450a8c4d, research-conferred-existence.html",
                                  "research-conferred-existence.html"),
    "witness-and-verification": (None, "2026-06-30", "site commit 450a8c4d, research-witness-and-verification.html",
                                 "research-witness-and-verification.html"),
    "no-receipt-no-accept": (None, "2026-07-28", "site commit d9b96b23, no-receipt-no-accept.html",
                             "no-receipt-no-accept.html"),
}
FRONT_MATTER = f"---\nauthor: {AUTHOR}\nlicense: {LICENSE}, {LICENSE_URL}\n---\n"


def record(name: str) -> dict:
    """The attribution block a receipt carries for one PDF."""
    doi, first_public, evidence, page = RECORDS[name]
    return {"author": AUTHOR, "copyright": f"© {YEAR} {AUTHOR}", "license": LICENSE, "license_url": LICENSE_URL,
            "doi": doi, "url": f"https://doi.org/{doi}" if doi else f"https://{SITE}/{page}",
            "first_public": first_public, "first_public_evidence": evidence}


def long_date(iso: str) -> str:
    day = date.fromisoformat(iso)
    return f"{day.day} {day.strftime('%B')} {day.year}"


def strip_front_matter(text: str) -> str:
    """Drop the author and license block from a Markdown source, if it has one."""
    text = text.replace("\r\n", "\n")
    match = re.match(r"\A---\nauthor: [^\n]*\nlicense: [^\n]*\n---\n\n?", text)
    return text[match.end():] if match else text


def tex_header(name: str, title: str, source_sha: str, source: str) -> str:
    rec = record(name)
    lines = [title, f"Copyright (c) {YEAR} {AUTHOR}. Written by {AUTHOR}.",
             f"License: {LICENSE}, {LICENSE_URL}",
             f"DOI: {rec['doi']}" if rec["doi"] else f"DOI: none; canonical page {rec['url']}",
             f"First public: {rec['first_public']} ({rec['first_public_evidence']})",
             f"Source SHA-256: {source_sha} ({source})"]
    rule = "% " + "-" * 70
    return "\n".join([rule, *("% " + line for line in lines), rule]) + "\n"


def _footer_text(name: str) -> str:
    rec = record(name)
    where = f"doi.org/{rec['doi']}" if rec["doi"] else rec["url"].removeprefix("https://")
    where = where.replace("_", r"\_").replace("/", r"/\allowbreak{}")
    return (rf"\textcopyright{{}} {YEAR} {AUTHOR} \textperiodcentered{{}} {LICENSE} \textperiodcentered{{}} "
            rf"{where} \textperiodcentered{{}} first public {long_date(rec['first_public'])}")


def preamble(name: str) -> str:
    """Footer and metadata, inserted just before \\begin{document}."""
    copyright_info = f"Copyright {YEAR} {AUTHOR}. Licensed under {LICENSE}, {LICENSE_URL}"
    return "\n".join([
        r"\usepackage{xcolor}",
        # A page style written out by hand: the pinned offline bundle carries no fancyhdr.
        r"\makeatletter",
        r"\def\ps@attribution{\let\@mkboth\@gobbletwo\let\@oddhead\@empty\let\@evenhead\@empty"
        r"\def\@oddfoot{\parbox[b]{\dimexpr\textwidth-3em\relax}{\raggedright\scriptsize\color{black!60}"
        + _footer_text(name) + r"}\hfill{\small\thepage}}\let\@evenfoot\@oddfoot}",
        r"\let\ps@plain\ps@attribution",
        r"\makeatother",
        r"\pagestyle{attribution}",
        r"\hypersetup{pdfauthor={" + AUTHOR + "}}",
        r"\AtBeginDocument{\special{pdf:docinfo<</Copyright (" + copyright_info + r")>>}}",
        "",
    ])


def stamp(tex: str, name: str, title: str, source_sha: str, source: str) -> str:
    """Return the .tex with its attribution header and the footer and metadata preamble."""
    marker = "\\begin{document}"
    if tex.count(marker) != 1:
        raise SystemExit(f"{name}: expected one \\begin{{document}}")
    return tex_header(name, title, source_sha, source) + tex.replace(marker, preamble(name) + marker)


SCRUB_FLAGS = {  # patterns that stop a private source from being published until a person reviews it
    "a local path": re.compile(r"[A-Za-z]:[\\/](?:Users|dev|tools)|/(?:home|Users)/\w"),
    "a credential": re.compile(r"(?i)(?:api[_-]?key|secret|password|token)\s*[:=]|-----BEGIN [A-Z ]*PRIVATE KEY"),
    "a private note": re.compile(r"(?i)\\(?:todo|fixme)\b|\b(?:TODO|FIXME|XXX)\b|\\iffalse|\\begin\{comment\}"),
}


def scrub(tex: str, name: str) -> tuple[str, list[str]]:
    """Strip LaTeX comments from a private source and refuse anything that needs a person's review.

    Returns the cleaned text and a list of what was removed. A comment is everything after an
    unescaped % on a line; a line that held only a comment is dropped."""
    removed: list[str] = []
    out: list[str] = []
    for number, line in enumerate(tex.replace("\r\n", "\n").split("\n"), start=1):
        match = re.search(r"(?<!\\)%", line)
        if match:
            removed.append(f"line {number}: comment {line[match.start():].strip()[:60]!r}")
            line = line[:match.start()].rstrip()
            if not line:
                continue
        out.append(line)
    clean = "\n".join(out)
    hits = [label for label, pattern in SCRUB_FLAGS.items() if pattern.search(clean)]
    if hits:
        raise SystemExit(f"{name}: the private source holds {', '.join(hits)}; review it before publishing")
    return clean, removed
