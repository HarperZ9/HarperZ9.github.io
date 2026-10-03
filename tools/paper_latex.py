"""Typeset a philosophy paper source as LaTeX.

The papers in writing/papers/ are written in the small Markdown dialect that
tools/paper_markdown.py turns into the web page. This module turns the same source
into a LaTeX document, so the PDF is typeset from the approved text instead of being
printed from the page. It handles the same constructs as the page renderer: a front
block, headings, paragraphs, ordered and unordered lists, pipe tables, blockquotes,
emphasis, bare URLs and the register marks [PLAIN], [STEELMAN] and [OPEN]. The output
is deterministic: the same source gives the same bytes.
"""

from __future__ import annotations

import hashlib
import html
import re

from tools.paper_markdown import HEADING, LIST_ITEM, REGISTER, cells, front_block, is_divider, is_table_row

URL = re.compile(r"https?://[^\s<>\]]+?(?=[.,;:)]?(?:\s|$))")
SPECIAL = {"\\": r"\textbackslash{}", "{": r"\{", "}": r"\}", "$": r"\$", "&": r"\&", "#": r"\#",
           "^": r"\textasciicircum{}", "_": r"\_", "~": r"\textasciitilde{}", "%": r"\%",
           # The Latin Modern text faces lack these four, so they are set from the math fonts.
           "′": r"\ensuremath{'}", "φ": r"\ensuremath{\varphi}", "ρ": r"\ensuremath{\rho}",
           "≈": r"\ensuremath{\approx}"}

BREAKABLE_SLASH = r"/\allowbreak{}"  # a long path or bare domain may wrap after a slash

PREAMBLE = r"""\documentclass[11pt]{article}
\usepackage[a4paper,margin=1in]{geometry}
\usepackage{fontspec}
\setmainfont{lmroman10-regular.otf}[BoldFont=lmroman10-bold.otf,ItalicFont=lmroman10-italic.otf,BoldItalicFont=lmroman10-bolditalic.otf,Ligatures=TeX]
\setmonofont{lmmono10-regular.otf}
\usepackage{microtype}
\usepackage{longtable,array,booktabs}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{url}
\setlist{itemsep=2pt,topsep=4pt}
\setlength{\parskip}{6pt plus 1pt}
\setlength{\parindent}{0pt}
\setlength{\emergencystretch}{3em}
\hypersetup{pdftitle={%(title)s},pdfauthor={Zain Dana Harper},pdfsubject={%(subject)s},pdfkeywords={%(keywords)s}}
\newcommand{\register}[1]{{\ttfamily\small #1}}
\begin{document}
"""


def escape(text: str) -> str:
    """Escape LaTeX specials and turn straight quotes into typeset quotes."""
    out = "".join(SPECIAL.get(ch, ch) for ch in text)
    out = out.replace("--", "-{}-")
    out = re.sub(r'(^|[\s(\[{/])"', r"\1``", out)
    out = out.replace('"', "''")
    out = re.sub(r"(^|[\s(\[{/])'", r"\1`", out)
    return out


def inline(text: str) -> str:
    """Escape one run of text, then apply URLs, register marks and emphasis."""
    parts, last = [], 0
    for match in URL.finditer(text):
        parts.append(escape(text[last:match.start()]).replace("/", BREAKABLE_SLASH))
        url = match.group(0).replace("%", r"\%").replace("#", r"\#")
        parts.append(r"\url{" + url + "}")
        last = match.end()
    parts.append(escape(text[last:]).replace("/", BREAKABLE_SLASH))
    out = "".join(parts)
    out = REGISTER.sub(lambda m: r"\register{[" + m.group(2) + m.group(3) + "]}", out)
    out = re.sub(r"\*\*\*(.+?)\*\*\*", r"\\textbf{\\emph{\1}}", out)
    out = re.sub(r"\*\*(.+?)\*\*", r"\\textbf{\1}", out)
    out = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"\\emph{\1}", out)
    return out


def from_html(fragment: str) -> str:
    """The revision and correction notes carry a little HTML: emphasis and entities."""
    marked = re.sub(r"</?(em|i)>", "*", fragment)
    return inline(html.unescape(re.sub(r"<[^>]+>", "", marked)))


def table(lines: list[str], i: int, out: list[str]) -> int:
    head = cells(lines[i])
    rows: list[list[str]] = []
    i += 2
    while i < len(lines) and is_table_row(lines[i]):
        rows.append((cells(lines[i]) + [""] * len(head))[:len(head)])
        i += 1
    weight = [max(max(len(r[c]) for r in [head] + rows) ** 0.7 + 4, 2.2 * len(head[c]) + 4) for c in range(len(head))]
    usable = 1.0 - 0.04 * len(head)  # each column also carries its own padding
    spec = "".join(r">{\raggedright\arraybackslash}p{%.3f\linewidth}" % (usable * w / sum(weight)) for w in weight)
    out.append(r"{\small\begin{longtable}{" + spec + "}")
    out.append(r"\toprule")
    out.append(" & ".join(r"\textbf{" + inline(c) + "}" for c in head) + r" \\ \midrule\endhead")
    out.extend(" & ".join(inline(c) for c in row) + r" \\" for row in rows)
    out.append(r"\bottomrule\end{longtable}}")
    return i


def listing(lines: list[str], i: int, out: list[str]) -> int:
    ordered = bool(re.match(r"\d+\.", LIST_ITEM.match(lines[i]).group(2)))
    items: list[str] = []
    while i < len(lines):
        match = LIST_ITEM.match(lines[i])
        if not match:
            if items and lines[i].strip() and lines[i].startswith((" ", "\t")):
                items[-1] += " " + lines[i].strip()
                i += 1
                continue
            break
        if bool(re.match(r"\d+\.", match.group(2))) != ordered:
            break
        items.append(match.group(3).strip())
        i += 1
    env = "enumerate" if ordered else "itemize"
    out.append(rf"\begin{{{env}}}")
    out.extend(r"\item " + inline(x) for x in items)
    out.append(rf"\end{{{env}}}")
    return i


SECTION = {1: "section", 2: "section", 3: "subsection", 4: "subsubsection", 5: "paragraph", 6: "paragraph"}


def body(text: str) -> str:
    """Convert the body of a paper source, block by block."""
    lines = text.split("\n")
    out: list[str] = []
    para: list[str] = []
    i = 0

    def flush() -> None:
        joined = " ".join(x.strip() for x in para if x.strip())
        if joined:
            out.extend([inline(joined), ""])
        para.clear()

    while i < len(lines):
        line, stripped = lines[i], lines[i].strip()
        match = HEADING.match(stripped)
        is_rule = bool(re.fullmatch(r"-{3,}|\*{3,}", stripped))
        is_table = is_table_row(line) and i + 1 < len(lines) and is_divider(lines[i + 1])
        if not stripped or match or is_rule or stripped.startswith(">") or LIST_ITEM.match(line) or is_table:
            flush()
        if not stripped:
            i += 1
        elif match:
            out.extend([rf"\{SECTION[len(match.group(1))]}*{{{inline(match.group(2).strip())}}}", ""])
            i += 1
        elif is_rule:
            out.extend([r"\medskip\noindent\rule{\linewidth}{0.3pt}\medskip", ""])
            i += 1
        elif is_table:
            i = table(lines, i, out)
        elif stripped.startswith(">"):
            quote = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip().lstrip(">").strip())
                i += 1
            out.extend([r"\begin{quote}", inline(" ".join(q for q in quote if q)), r"\end{quote}", ""])
        elif LIST_ITEM.match(line):
            i = listing(lines, i, out)
        else:
            para.append(line)
            i += 1
    flush()
    return "\n".join(out)


def document(source: str, spec: dict, corrections: list[str], source_path: str) -> str:
    """The whole LaTeX document for one paper, including the revision note and corrections."""
    source = source.replace("\r\n", "\n")
    digest = hashlib.sha256(source.encode("utf-8")).hexdigest()
    fields, text = front_block(source)
    text = re.sub(r"\A\s*#\s+[^\n]*\n", "", text)
    title = inline(fields["title"])
    meta = {"title": title, "subject": "Typeset from " + escape(source_path),
            "keywords": "source sha256 " + digest}
    head = [PREAMBLE % meta, r"\begin{center}", r"{\LARGE\bfseries " + title + r"\par}", r"\medskip"]
    subtitle = fields.get("subtitle", "").strip().strip("*")
    if subtitle:
        head += [r"{\large\emph{" + inline(subtitle) + r"}\par}", r"\medskip"]
    head += [r"Zain Dana Harper\par", r"{\small " + spec["kind"] + " \u00b7 edition of 3 October 2026\\par}",
             r"{\small " + inline(fields["byline"]) + r"\par}", r"\end{center}", ""]
    note = [r"\textbf{Revised 3 October 2026.} " + inline(fields["revision_note"])]
    if "doi" in spec:
        note.append(rf"This edition is deposited at Zenodo, \url{{https://doi.org/{spec['doi']}}}.")
    if "supplement" in spec:
        doi, label = spec["supplement"]
        note.append(f"It builds on {inline(label)}, which stays citable at its own Zenodo record, "
                    rf"\url{{https://doi.org/{doi}}}.")
    if "prior" in spec:
        doi, label = spec["prior"]
        note.append(f"The prior version, {inline(label)}, stays citable at its Zenodo record, "
                    rf"\url{{https://doi.org/{doi}}}.")
    if "related" in spec:
        doi, label, _route = spec["related"]
        note.append(f"This paper argues from {inline(label)}, \\url{{https://doi.org/{doi}}}.")
    head += [r"\begin{quote}\small", " ".join(note), r"\end{quote}", ""]
    tail = []
    if corrections:
        tail += [r"\section*{Corrections}", "These corrections were made to the earlier edition on "
                 "3 October 2026. This edition carries the corrected wording.", ""]
        tail += [from_html(c) + "\n" for c in corrections]
    tail += [r"\vfill{\footnotesize Typeset with LaTeX from the approved source \texttt{" + escape(source_path)
             + r"}. The web page is rendered from the same source.\newline SHA-256 of the source: \texttt{" + digest + r"}\par}",
             r"\end{document}", ""]
    return "\n".join(head) + body(text.strip()) + "\n" + "\n".join(tail)
