"""Typeset the two archived corpora as LaTeX, from the same sources their web pages use.

tools/render_corpus.py renders Conferred Existence and The Witnessing Spine into reading
pages from the deposited Markdown. This module turns the same sources into LaTeX, with
the same additions the pages carry: the dated foreword above the Witnessing Spine
(tools/corpus_forewords.py) and the dated corrections (tools/corpus_corrections.py), each
set apart from the deposited text. The deposited text is not edited, so its own dashes
stay. The output is deterministic: the same inputs give the same bytes.

The Latin Modern faces cover every Latin letter in both sources. The few mathematical
signs they lack are set from the math fonts. Hebrew and Arabic words are set right to
left in DejaVu Sans. No font in the pinned bundle has the single-glyph ligature U+FDFA,
so it is set as its Unicode compatibility decomposition, the same words in full.
"""

from __future__ import annotations

import hashlib
import html
import re
import unicodedata

from tools.paper_latex import BREAKABLE_SLASH, SPECIAL
from tools.paper_latex import body as paper_body

CHARS = {**SPECIAL, "\ufeff": "", "\u2074": r"\textsuperscript{4}", "\u2076": r"\textsuperscript{6}",
         "\u2078": r"\textsuperscript{8}", "\u207a": r"\ensuremath{^{+}}", "\u2080": r"\ensuremath{_{0}}",
         "\u2135": r"\ensuremath{\aleph}", "\u2194": r"\ensuremath{\leftrightarrow}",
         "\u2205": r"\ensuremath{\emptyset}", "\u2227": r"\ensuremath{\wedge}", "\u222a": r"\ensuremath{\cup}",
         "\u2260": r"\ensuremath{\neq}", "\u27e8": r"\ensuremath{\langle}", "\u27e9": r"\ensuremath{\rangle}"}
RTL = re.compile(r"[\u0590-\u06ff\ufdfa]+(?:\s+[\u0590-\u06ff\ufdfa]+)*")
LINK = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")
URL = re.compile(r"(?<![\"(>])\bhttps?://[^\s<)]+")
CODE = re.compile(r"`([^`]+)`")
HEADING = re.compile(r"^(#{1,6})\s+(.*)$")
LIST_ITEM = re.compile(r"^(\s*)([-*+]|\d+\.)\s+(.*)$")
SECTION = {2: "section", 3: "subsection", 4: "subsubsection", 5: "paragraph", 6: "subparagraph"}

PREAMBLE = r"""\documentclass[11pt]{article}
\usepackage[a4paper,margin=1in]{geometry}
\usepackage{fontspec}
\setmainfont{lmroman10-regular.otf}[BoldFont=lmroman10-bold.otf,ItalicFont=lmroman10-italic.otf,BoldItalicFont=lmroman10-bolditalic.otf,Ligatures=TeX]
\setmonofont{lmmono10-regular.otf}
\newfontfamily\arabicfont{DejaVuSans.ttf}[Script=Arabic,Scale=0.9]
\newfontfamily\hebrewfont{DejaVuSans.ttf}[Script=Hebrew,Scale=0.9]
\TeXXeTstate=1
\newcommand{\AR}[1]{{\arabicfont\beginR #1\endR}}
\newcommand{\HE}[1]{{\hebrewfont\beginR #1\endR}}
\usepackage{microtype}
\usepackage{longtable,array,booktabs}
\usepackage{enumitem}
\usepackage[hidelinks,bookmarksdepth=3]{hyperref}
\usepackage{url}
\setlist{itemsep=2pt,topsep=4pt}
\setlength{\parskip}{6pt plus 1pt}
\setlength{\parindent}{0pt}
\setlength{\emergencystretch}{3em}
\makeatletter
\renewcommand\paragraph{\@startsection{paragraph}{4}{\z@}{2ex plus 1ex}{0.4ex}{\normalfont\normalsize\bfseries}}
\renewcommand\subparagraph{\@startsection{subparagraph}{5}{\z@}{1.6ex plus 1ex}{0.3ex}{\normalfont\normalsize\itshape}}
\makeatother
\hypersetup{pdftitle={%(title)s},pdfauthor={Zain Dana Harper},pdfsubject={%(subject)s},pdfkeywords={%(keywords)s}}
\begin{document}
"""


def escape(text: str) -> str:
    """Escape LaTeX specials and turn straight quotes into typeset quotes."""
    out = "".join(CHARS.get(ch, ch) for ch in text).replace("--", "-{}-")
    out = re.sub(r'(^|[\s(\[{/])"', r"\1``", out).replace('"', "''")
    return re.sub(r"(^|[\s(\[{/])'", r"\1`", out)


def rtl(run: str) -> str:
    run = unicodedata.normalize("NFKC", run) if "\ufdfa" in run else run
    return (r"\HE{" if re.search(r"[\u0590-\u05ff]", run) else r"\AR{") + run + "}"


def inline(text: str) -> str:
    """One run of corpus text: code, links, bare URLs, right-to-left words, then emphasis."""
    kept: list[str] = []

    def keep(latex: str) -> str:
        kept.append(latex)
        return f"\x00{len(kept) - 1}\x00"

    text = CODE.sub(lambda m: keep(r"\texttt{" + escape(m.group(1)) + "}"), text)
    text = LINK.sub(lambda m: keep(r"\href{" + _url(m.group(2)) + "}{" + inline(m.group(1)) + "}"), text)
    text = URL.sub(lambda m: keep(r"\url{" + _url(m.group(0)) + "}"), text)
    text = RTL.sub(lambda m: keep(rtl(m.group(0))), text)
    out = escape(text).replace("/", BREAKABLE_SLASH)
    out = re.sub(r"\*\*\*(.+?)\*\*\*", r"\\textbf{\\emph{\1}}", out)
    out = re.sub(r"\*\*(.+?)\*\*", r"\\textbf{\1}", out)
    out = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"\\emph{\1}", out)
    while "\x00" in out:
        out = re.sub(r"\x00(\d+)\x00", lambda m: kept[int(m.group(1))], out)
    return out


def _url(url: str) -> str:
    return url.replace("\\", "/").replace("%", r"\%").replace("#", r"\#")


def is_table_row(line: str) -> bool:
    return line.lstrip().startswith("|") and line.count("|") >= 2


def is_divider(line: str) -> bool:
    return bool(re.fullmatch(r"\s*\|?[\s:|-]*-[\s:|-]*\|?\s*", line)) and "-" in line and "|" in line


def cells(line: str) -> list[str]:
    row = line.strip().removeprefix("|").removesuffix("|")
    return [c.strip() for c in row.split("|")]


def table(head: list[str], rows: list[list[str]]) -> str:
    rows = [(r + [""] * len(head))[:len(head)] for r in rows]
    weight = [max(max(len(r[c]) for r in [head] + rows) ** 0.7 + 4, 2.2 * len(head[c]) + 4) for c in range(len(head))]
    usable = 1.0 - 0.04 * len(head)
    spec = "".join(r">{\raggedright\arraybackslash}p{%.3f\linewidth}" % (usable * w / sum(weight)) for w in weight)
    out = [r"{\small\begin{longtable}{" + spec + "}", r"\toprule",
           " & ".join(r"\textbf{" + inline(c) + "}" for c in head) + r" \\ \midrule\endhead"]
    out += [" & ".join(inline(c) for c in row) + r" \\" for row in rows]
    return "\n".join(out + [r"\bottomrule\end{longtable}}"])


def blocks(md: str) -> list[tuple[str, str]]:
    """(plain text, LaTeX) per block, following tools/render_corpus.render line for line."""
    lines = md.replace("\r\n", "\n").split("\n")
    depths = [len(m.group(1)) for m in (re.match(r"^(#{1,6})\s+\S", ln.strip()) for ln in lines) if m]
    top = min(depths) if depths else 1
    out: list[tuple[str, str]] = []
    para: list[str] = []
    seen_section = False
    i = 0

    def flush() -> None:
        text = " ".join(x.strip() for x in para if x.strip())
        if text:
            out.append((text, inline(text)))
        para.clear()

    while i < len(lines):
        line, stripped = lines[i], lines[i].strip()
        heading = HEADING.match(stripped)
        if not stripped:
            flush(); i += 1
        elif heading:
            flush(); i += 1
            level, title = min(len(heading.group(1)) - top + 2, 6), heading.group(2).strip()
            if level > 2 and not seen_section:
                out.append((title, r"{\large\emph{" + inline(title) + r"}\par}"))
                continue
            seen_section = seen_section or level == 2
            command = SECTION[level]
            entry = rf"\addcontentsline{{toc}}{{{command}}}{{{inline(title)}}}" if level <= 3 else ""
            out.append((title, rf"\{command}*{{{inline(title)}}}{entry}"))
        elif re.fullmatch(r"-{3,}|\*{3,}|_{3,}", stripped):
            flush(); i += 1
            out.append(("", r"\medskip\noindent\rule{\linewidth}{0.3pt}\medskip"))
        elif is_table_row(line) and i + 1 < len(lines) and is_divider(lines[i + 1]):
            flush()
            head, rows, i = cells(line), [], i + 2
            while i < len(lines) and is_table_row(lines[i]):
                rows.append(cells(lines[i])); i += 1
            out.append((" ".join(head + [c for r in rows for c in r]), table(head, rows)))
        elif stripped.startswith(">"):
            flush()
            quote = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip().lstrip(">").strip()); i += 1
            text = " ".join(q for q in quote if q)
            out.append((text, r"\begin{quote}" + "\n" + inline(text) + "\n" + r"\end{quote}"))
        elif LIST_ITEM.match(line):
            flush()
            ordered = bool(re.match(r"\d+\.", LIST_ITEM.match(line).group(2)))
            items: list[str] = []
            while i < len(lines):
                item = LIST_ITEM.match(lines[i])
                if not item:
                    if items and lines[i].strip() and lines[i].startswith((" ", "\t")):
                        items[-1] += " " + lines[i].strip(); i += 1
                        continue
                    break
                if bool(re.match(r"\d+\.", item.group(2))) != ordered:
                    break
                items.append(item.group(3).strip()); i += 1
            env = "enumerate" if ordered else "itemize"
            out.append((" ".join(items), "\n".join([rf"\begin{{{env}}}", *(r"\item " + inline(x) for x in items),
                                                   rf"\end{{{env}}}"])))
        else:
            para.append(line); i += 1
    flush()
    return out


POINTER = (r"\begin{quote}\small\emph{A dated correction to this passage is listed under "
           r"\hyperref[corrections]{Corrections}.}\end{quote}")


def plain(text: str) -> str:
    """What a reader sees of a block, for matching a correction anchor."""
    return re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text).replace("*", "").replace("`", "")


def place(parts: list[tuple[str, str]], corrections: list[dict]) -> list[str]:
    out = [latex for _text, latex in parts]
    anchors: list[int] = []
    for fix in corrections:
        for needle in fix["after"]:
            hits = [n for n, (text, _latex) in enumerate(parts) if needle in plain(text)]
            if len(hits) != 1:
                raise SystemExit(f"correction anchor must match one block, found {len(hits)}: {needle!r}")
            anchors.append(hits[0])
    for n in sorted(anchors, reverse=True):
        out.insert(n + 1, POINTER)
    return out


def from_html(fragment: str) -> str:
    marked = re.sub(r"</?(em|i)>", "*", fragment)
    return inline(html.unescape(re.sub(r"<[^>]+>", "", marked)))


def document(corpus: dict, source: str, foreword: str, corrections: list[dict], opening: str, origin: str) -> str:
    """The whole LaTeX document for one corpus. `origin` names the source for the colophon."""
    source = source.replace("\r\n", "\n")
    digest = hashlib.sha256(source.encode("utf-8")).hexdigest()
    md, subtitle = source, ""
    first = re.match(r"\A#\s+(.*?)\n", md)
    if first:
        subtitle = re.sub(r"^" + re.escape(corpus["title"]), "", first.group(1).strip()).strip(" .,:;-\u2013\u2014")
        md = md[first.end():]
    parts = blocks(md)
    if subtitle:
        parts.insert(0, (subtitle, r"{\large\emph{" + inline(subtitle) + r"}\par}"))
    title = escape(corpus["title"])
    head = [PREAMBLE % {"title": title, "subject": escape(corpus["role"]), "keywords": "source sha256 " + digest},
            r"\begin{center}", r"{\LARGE\bfseries " + title + r"\par}", r"\medskip",
            r"{\large\emph{" + inline(corpus["role"]) + r"}\par}", r"\medskip",
            r"Zain Dana Harper\par",
            r"{\small ORCID \href{https://orcid.org/0009-0001-7175-5393}{0009-0001-7175-5393} \textperiodcentered{} "
            rf"DOI \href{{https://doi.org/{corpus['doi']}}}{{{corpus['doi']}}} \textperiodcentered{{}} "
            + escape(corpus["licence"]) + r"\par}", r"\end{center}", "",
            r"\begin{quote}\small", inline(corpus["blurb"] + " Nothing here is peer reviewed. The deposited version at "
                                           "the DOI above is the citable one; this copy carries the same text, "
                                           "typeset with LaTeX." + opening), r"\end{quote}", ""]
    if foreword:
        head += [r"\pdfbookmark[1]{Foreword}{foreword}", paper_body(foreword.replace("\r\n", "\n").strip()),
                 r"\medskip\noindent\rule{\linewidth}{0.6pt}\medskip", ""]
    tail = []
    if corrections:
        tail += [r"\section*{Corrections}\label{corrections}\addcontentsline{toc}{section}{Corrections}", ""]
        tail += [from_html(fix["note"]) + "\n" for fix in corrections]
    ligature = (" The ligature U+FDFA is set as its Unicode decomposition, because no font in the pinned bundle "
                "carries that glyph.") if "\ufdfa" in source else ""
    tail += [r"\vfill{\footnotesize Typeset with LaTeX from the deposited source, " + escape(origin)
             + ". The web page is rendered from the same source. The deposited text is reproduced as deposited, "
             "including its own punctuation." + ligature + r"\newline SHA-256 of the source: \texttt{" + digest + r"}\par}",
             r"\end{document}", ""]
    return "\n".join(head) + "\n\n" + "\n\n".join(place(parts, corrections)) + "\n\n" + "\n".join(tail)
