"""The small Markdown dialect the philosophy papers are written in.

The papers in writing/papers/ are approved texts. This turns one into the body of a page and
handles exactly what those texts use: a front block, headings, paragraphs, ordered and
unordered lists, pipe tables, blockquotes, emphasis, and the reader-facing register marks
[PLAIN], [STEELMAN] and [OPEN]. A line it does not recognise becomes a paragraph, so no
sentence can go missing without showing up as a stray line.
"""

from __future__ import annotations

import html
import re

REGISTER = re.compile(r"(\*\*)?\[(PLAIN|STEELMAN|OPEN)((?:[^\[\]]|\[[^\[\]]*\])*)\](?(1)\*\*)")
HEADING = re.compile(r"^(#{1,6})\s+(.*)$")
LIST_ITEM = re.compile(r"^(\s*)([-*+]|\d+\.)\s+(.*)$")


def front_block(text: str) -> tuple[dict[str, str], str]:
    """Split the leading key: value block from the body."""
    text = text.replace("\r\n", "\n")
    match = re.match(r"\A---\n(.*?)\n---\n", text, re.S)
    if not match:
        raise SystemExit("paper source has no front block")
    fields: dict[str, str] = {}
    for line in match.group(1).split("\n"):
        if line.strip():
            key, _, value = line.partition(":")
            fields[key.strip()] = value.strip()
    return fields, text[match.end():]


def slugify(text: str) -> str:
    plain = re.sub(r"<[^>]+>", "", text)
    plain = html.unescape(plain).lower()
    plain = re.sub(r"[^a-z0-9]+", "-", plain)
    return plain.strip("-")[:80] or "section"


def inline(text: str) -> str:
    """Escape the text, then apply register marks and emphasis."""
    out = html.escape(text, quote=False)

    def register(match: re.Match) -> str:
        kind = match.group(2)
        return f'<span class="register register--{kind.lower()}">[{kind}{match.group(3)}]</span>'

    out = REGISTER.sub(register, out)
    out = re.sub(r"\*\*\*(.+?)\*\*\*", r"<b><i>\1</i></b>", out)
    out = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", out)
    out = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<i>\1</i>", out)
    return out


def is_table_row(line: str) -> bool:
    return line.lstrip().startswith("|") and line.count("|") >= 2


def is_divider(line: str) -> bool:
    return "-" in line and bool(re.fullmatch(r"\s*\|?[\s:|-]*-[\s:|-]*\|?\s*", line))


def cells(line: str) -> list[str]:
    row = line.strip().removeprefix("|").removesuffix("|")
    return [cell.strip() for cell in row.split("|")]


def table(lines: list[str], i: int, out: list[str]) -> int:
    head = cells(lines[i])
    i += 2
    out.append('<div class="paper-table"><table class="data data--wide">')
    out.append("<thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead><tbody>")
    while i < len(lines) and is_table_row(lines[i]):
        row = cells(lines[i]) + [""] * len(head)
        out.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in row[:len(head)]) + "</tr>")
        i += 1
    out.append("</tbody></table></div>")
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
    tag = "ol" if ordered else "ul"
    out.append(f'<{tag} class="bul">' + "".join(f"<li>{inline(x)}</li>" for x in items) + f"</{tag}>")
    return i


def heading(match: re.Match, out: list[str], used: set[str]) -> None:
    level = min(len(match.group(1)), 6)
    level = max(level, 2)
    text = inline(match.group(2).strip())
    anchor = slugify(text)
    while anchor in used:
        anchor += "-x"
    used.add(anchor)
    out.append(f'<h{level} id="{anchor}">{text}</h{level}>')


def render(body: str) -> str:
    """Render the body of a paper source to HTML."""
    lines = body.split("\n")
    out: list[str] = []
    para: list[str] = []
    used: set[str] = set()
    i = 0

    def flush() -> None:
        text = " ".join(x.strip() for x in para if x.strip())
        if text:
            out.append(f"<p>{inline(text)}</p>")
        para.clear()

    while i < len(lines):
        line, stripped = lines[i], lines[i].strip()
        match = HEADING.match(stripped)
        if not stripped or match or re.fullmatch(r"-{3,}|\*{3,}", stripped) or stripped.startswith(">") \
                or LIST_ITEM.match(line) or (is_table_row(line) and i + 1 < len(lines) and is_divider(lines[i + 1])):
            flush()
        if not stripped:
            i += 1
        elif match:
            heading(match, out, used)
            i += 1
        elif re.fullmatch(r"-{3,}|\*{3,}", stripped):
            out.append('<hr class="paper-rule">')
            i += 1
        elif is_table_row(line) and i + 1 < len(lines) and is_divider(lines[i + 1]):
            i = table(lines, i, out)
        elif stripped.startswith(">"):
            quote = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip().lstrip(">").strip())
                i += 1
            out.append(f'<blockquote><p>{inline(" ".join(q for q in quote if q))}</p></blockquote>')
        elif LIST_ITEM.match(line):
            i = listing(lines, i, out)
        else:
            para.append(line)
            i += 1
    flush()
    return "\n".join(out)
