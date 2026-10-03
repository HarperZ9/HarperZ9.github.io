"""Typeset a long-form essay as LaTeX, from the plain-text source its web page uses.

tools/render_legacy_essays.py renders the essay page from its Markdown parts. The
single-file edition in the same folder carries the same text, and this module turns it
into a LaTeX document, so the PDF is typeset from the approved text instead of being
printed from a browser. The block and inline rules are the corpus converter's
(tools/corpus_latex.py): headings, paragraphs, lists, quotes, links and emphasis. The
output is deterministic: the same source gives the same bytes.
"""

from __future__ import annotations

import hashlib
import re

from tools.corpus_latex import PREAMBLE, blocks, escape, inline


def _header(source: str) -> tuple[str, str, str]:
    """Split the title, the lead line and the body off the essay source."""
    match = re.match(r"\A#\s+(?P<title>[^\n]+)\n+##\s+(?P<lead>[^\n]+)\n+\*[^*\n]+\*\n", source)
    if not match:
        raise SystemExit("essay source must open with a title, a lead line and a byline")
    return match["title"].strip(), match["lead"].strip(), source[match.end():]


def document(source: str, essay: dict) -> str:
    """The whole LaTeX document for one essay. `essay` names the source, page and dates."""
    source = source.replace("\r\n", "\n")
    digest = hashlib.sha256(source.encode("utf-8")).hexdigest()
    title, lead, text = _header(source)
    meta = {"title": escape(title), "subject": escape(lead), "keywords": "source sha256 " + digest}
    head = [PREAMBLE % meta, r"\begin{center}", r"{\LARGE\bfseries " + inline(title) + r"\par}", r"\medskip",
            r"{\large\emph{" + inline(lead) + r"}\par}", r"\medskip", r"Zain Dana Harper\par",
            r"{\small " + escape(essay["kind"]) + r" \textperiodcentered{} first published "
            + escape(essay["first_public"]) + r"\par}", r"\end{center}", "",
            r"\begin{quote}\small", inline(essay["note"]), r"\end{quote}", ""]
    tail = [r"\vfill{\footnotesize Typeset with LaTeX from the plain-text source \texttt{" + escape(essay["source"])
            + r"}. The web page is rendered from the same text.\newline SHA-256 of the source: \texttt{"
            + digest + r"}\par}", r"\end{document}", ""]
    body = "\n\n".join(latex for _text, latex in blocks(text.strip()))
    return "\n".join(head) + "\n" + body + "\n\n" + "\n".join(tail)
