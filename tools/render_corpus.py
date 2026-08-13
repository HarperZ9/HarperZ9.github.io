"""Render the two archived corpora into reading pages on this site.

Six of the eight records on publications.html were hosted here as PDFs. The two
archived corpora, Conferred Existence and The Witnessing Spine, were Zenodo
links and nothing else, so the one thing a reader could not do with the longest
pieces of writing on the record was read them here.

Both are the author's own work, MIT and CC BY 4.0 respectively, and both are
deposited publicly. This renders each Markdown source into a page on the shared
document system, which means it also gets the export control and the print
stylesheet: readable in a browser, and takeable as Markdown, text, Word, or PDF
like anything else.

    python tools/render_corpus.py

The Markdown here is deliberately small rather than general. It handles exactly
what these two documents use, which a survey of the sources put at headings,
tables, blockquotes, ordered and unordered lists, rules, links, and emphasis.
Anything it does not recognise is emitted as a paragraph rather than dropped,
so no sentence can go missing without showing up as a stray line.

One house rule is deliberately not applied here. The site's voice standard bans
em-dashes, and these two sources contain 1,330 and 78 of them. They are not
rewritten. A page that claims to reproduce a deposit with a permanent DOI has
to be that deposit, and editing the punctuation of a citable thesis to match a
style guide would make this a different document from the one it cites. The
rule governs prose written for these surfaces, not text quoted onto them.
"""

from __future__ import annotations

import html
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
WORKSPACE = ROOT.parent.parent  # c:/dev

CORPORA = [
    {
        "source": WORKSPACE / "public" / "senses-and-sensibility" / "CONFERRED-EXISTENCE.txt",
        "out": ROOT / "conferred-existence.html",
        "title": "Conferred Existence",
        "role": "An integrated thesis on made minds: what exists on its own footing, what is conferred, and where an authentication verdict stops.",
        "doi": "10.5281/zenodo.20773724",
        "licence": "MIT",
        "blurb": "Archived research corpus, deposited whole. This is the full text as deposited.",
    },
    {
        "source": WORKSPACE / "public" / "witnessing-spine" / "SYNTHESIS-the-witnessing-spine.md",
        "out": ROOT / "witnessing-spine.html",
        "title": "The Witnessing Spine",
        "role": "One gap, witnessed at four altitudes: research, philosophy, algebra, and tool. The capstone of a five-part adversarial-steelman corpus.",
        "doi": "10.5281/zenodo.20778927",
        "licence": "CC BY 4.0",
        "blurb": "Archived research corpus, deposited whole. Stated by its author as a pre-proof synthesis: a bid, not a proof.",
    },
]


# ── inline ────────────────────────────────────────────────────────────────
def inline(text: str) -> str:
    out = html.escape(text, quote=False)
    out = re.sub(r"`([^`]+)`", r"<code>\1</code>", out)
    out = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)",
                 lambda m: f'<a class="inline" href="{html.escape(m.group(2), quote=True)}" rel="noopener">{m.group(1)}</a>',
                 out)
    out = re.sub(r"\*\*\*(.+?)\*\*\*", r"<b><i>\1</i></b>", out)
    out = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", out)
    out = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<i>\1</i>", out)
    # a bare DOI or URL becomes reachable
    out = re.sub(r"(?<![\"(>])\bhttps?://[^\s<)]+", lambda m: f'<a class="inline" href="{m.group(0)}" rel="noopener">{m.group(0)}</a>', out)
    return out


def is_table_row(line: str) -> bool:
    return line.lstrip().startswith("|") and line.count("|") >= 2


def is_divider(line: str) -> bool:
    return bool(re.fullmatch(r"\s*\|?[\s:|-]*-[\s:|-]*\|?\s*", line)) and "-" in line and "|" in line


def cells(line: str) -> list[str]:
    row = line.strip()
    if row.startswith("|"):
        row = row[1:]
    if row.endswith("|"):
        row = row[:-1]
    return [c.strip() for c in row.split("|")]


# ── blocks ────────────────────────────────────────────────────────────────
def render(md: str) -> tuple[str, int]:
    lines = md.replace("\r\n", "\n").split("\n")
    out: list[str] = []
    i = 0
    headings = 0

    # The page masthead is the h1, so the source's own top level becomes h2.
    # Mapping by hash-count alone made the first real section an h3 and left a
    # gap in the heading order, which is a genuine navigation fault for anyone
    # moving through a 72,000-word document by heading. Find the shallowest
    # heading actually present and anchor that to h2.
    depths = [len(m.group(1)) for m in
              (re.match(r"^(#{1,6})\s+\S", ln.strip()) for ln in lines) if m]
    top = min(depths) if depths else 1
    seen_section = False

    def flush_para(buf: list[str]) -> None:
        text = " ".join(x.strip() for x in buf if x.strip())
        if text:
            out.append(f'<p class="lead">{inline(text)}</p>')

    para: list[str] = []
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            flush_para(para); para = []
            i += 1
            continue

        m = re.match(r"^(#{1,6})\s+(.*)$", stripped)
        if m:
            flush_para(para); para = []
            level = min(len(m.group(1)) - top + 2, 6)
            # Both sources open with a deeper heading used as a subtitle, before
            # any section starts. Emitting it as a heading put an h3 directly
            # under the h1 and left a level skipped. It is a subtitle, so it is
            # set as one.
            if level > 2 and not seen_section:
                out.append(f'<p class="entry-note">{inline(m.group(2).strip())}</p>')
                i += 1
                continue
            if level == 2:
                seen_section = True
            headings += 1
            out.append(f"<h{level}>{inline(m.group(2).strip())}</h{level}>")
            i += 1
            continue

        if re.fullmatch(r"-{3,}|\*{3,}|_{3,}", stripped):
            flush_para(para); para = []
            out.append('<hr class="corpus-rule">')
            i += 1
            continue

        if is_table_row(line) and i + 1 < len(lines) and is_divider(lines[i + 1]):
            flush_para(para); para = []
            head = cells(line)
            i += 2
            body = []
            while i < len(lines) and is_table_row(lines[i]):
                body.append(cells(lines[i])); i += 1
            out.append('<div class="corpus-table-wrap"><table class="data data--wide">')
            out.append("<thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead><tbody>")
            for row in body:
                row = row + [""] * (len(head) - len(row))
                out.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in row[:len(head)]) + "</tr>")
            out.append("</tbody></table></div>")
            continue

        if stripped.startswith(">"):
            flush_para(para); para = []
            quote = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip().lstrip(">").strip()); i += 1
            out.append(f'<blockquote>{inline(" ".join(q for q in quote if q))}</blockquote>')
            continue

        m = re.match(r"^(\s*)([-*+]|\d+\.)\s+(.*)$", line)
        if m:
            flush_para(para); para = []
            ordered = bool(re.match(r"\d+\.", m.group(2)))
            items = []
            while i < len(lines):
                mm = re.match(r"^(\s*)([-*+]|\d+\.)\s+(.*)$", lines[i])
                if not mm:
                    # a wrapped continuation line belongs to the item above it
                    if items and lines[i].strip() and lines[i].startswith((" ", "\t")):
                        items[-1] += " " + lines[i].strip(); i += 1; continue
                    break
                if bool(re.match(r"\d+\.", mm.group(2))) != ordered:
                    break
                items.append(mm.group(3).strip()); i += 1
            tag = "ol" if ordered else "ul"
            out.append(f'<{tag} class="bul">' + "".join(f"<li>{inline(x)}</li>" for x in items) + f"</{tag}>")
            continue

        para.append(line)
        i += 1

    flush_para(para)
    return "\n".join(out), headings


PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} &middot; Zain Dana Harper</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="https://harperz9.github.io/{slug}.html">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Zain Dana Harper">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="https://harperz9.github.io/{slug}.html">
<meta property="og:image" content="https://harperz9.github.io/img/og/profile.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="https://harperz9.github.io/img/og/profile.png">
<link rel="preload" href="system/fonts/hanken-grotesk.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="system/doc.css?v=20260813-document">
<style>
  /* A corpus is long, so the rules between its movements do more work than
     usual and the headings need more air above them than beside them. */
  .corpus-rule{{border:0;border-top:1px solid var(--rule);margin:2.2rem 0 1.6rem;max-width:var(--measure)}}
  .corpus-table-wrap{{overflow-x:auto;max-width:100%;margin:.4rem 0 1.2rem}}
  .sheet h2{{margin-top:2.2rem}}
  .sheet h3{{margin-top:1.6rem}}
  blockquote{{margin:1rem 0 1.2rem;padding:0 0 0 1rem;border-left:1px solid var(--rule-strong);
    color:var(--ink-muted);max-width:var(--measure)}}
</style>
</head>
<body class="doc" data-route-art="off">
<a class="skip-link" href="#main">Skip to content</a>

<div id="site-nav" class="site-nav"></div>
<noscript><nav class="site-nav"><a href="catalog.html">Catalog</a> <a href="research.html">Research</a> <a href="publications.html">Publications</a> <a href="writing.html">Writing</a> <a href="cv.html">Full CV</a></nav></noscript>
<script type="module" src="system/nav.js?v=20260813-export2"></script>

<div class="docnav">
  <span class="where">Archived research corpus</span>
  <span class="switch"><a href="publications.html">All publications</a><a href="research.html">Research</a><a href="writing.html">Writing</a></span>
</div>

<main id="main">
<article class="sheet">
  <header class="mast">
    <h1>{title}</h1>
    <p class="role">{role}</p>
    <p class="contact contact--fields">
      <span>Zain Dana Harper</span>
      <span>ORCID <a href="https://orcid.org/0009-0001-7175-5393" translate="no">0009-0001-7175-5393</a></span>
      <span>DOI <a href="https://doi.org/{doi}" rel="noopener" translate="no">{doi}</a></span>
      <span>{licence}</span>
    </p>
  </header>

  <section>
    <p class="opening">{blurb} Nothing here is peer reviewed. The deposited version at the DOI above is the citable one; this page carries the same text so it can be read, searched, and taken away without leaving the site.</p>
    <p class="entry-note">Take this page in any format below, or download the typeset copy: <a href="papers/{slug}.pdf" download>{title} PDF</a>.</p>
    <div data-export-slot></div>
  </section>

{body}

  <p class="note">Rendered from the deposited source by <span translate="no">tools/render_corpus.py</span>, so this page cannot drift from the corpus it reproduces. Generated {generated} words of text across {headings} sections.</p>
</article>
</main>
</body>
</html>
"""


def main() -> int:
    for c in CORPORA:
        src = c["source"]
        if not src.is_file():
            print(f"missing source: {src}", file=sys.stderr)
            return 1
        md = src.read_text(encoding="utf-8")
        # The source opens with its own title line, which the page masthead
        # already carries. Strip it, but keep anything it says beyond the
        # title: the spine's line reads "The Witnessing Spine, A Grand Bridge"
        # and dropping the whole line lost the subtitle, which a word-level
        # comparison against the source caught.
        first = re.match(r"\A#\s+(.*?)\n", md)
        subtitle = ""
        if first:
            head = first.group(1).strip()
            extra = re.sub(r"^" + re.escape(c["title"]), "", head).strip(" .,:;-–—")
            if extra:
                subtitle = extra
            md = md[first.end():]
        body, headings = render(md)
        if subtitle:
            body = f'<p class="entry-note">{inline(subtitle)}</p>\n' + body
        slug = c["out"].stem
        words = len(re.sub(r"<[^>]+>", " ", body).split())
        page = PAGE.format(
            title=html.escape(c["title"], quote=True),
            desc=html.escape(c["role"], quote=True),
            role=html.escape(c["role"], quote=False),
            doi=c["doi"], licence=c["licence"],
            blurb=html.escape(c["blurb"], quote=False),
            slug=slug, body=body, headings=headings, generated=f"{words:,}",
        )
        c["out"].write_text(page, encoding="utf-8")
        print(f"{c['out'].name:30} {words:>7,} words   {headings:>3} sections   {len(page)/1024:>6.0f} kB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
