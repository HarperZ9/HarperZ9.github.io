"""A small Markdown subset renderer for the plugin policy snapshots.

It handles what the tools' PRIVACY.md and LICENSE files use: headings,
paragraphs, bulleted and numbered lists, fenced code blocks, bold, inline code
and bare URLs.
Everything else is escaped as text.
"""

from __future__ import annotations

import html
import re

URL = re.compile(r"https://[^\s<>()]+[^\s<>().,;:]")


def inline(text: str) -> str:
    """Escape text, then mark up code spans, bold runs and bare URLs."""
    out = []
    for index, part in enumerate(re.split(r"(`[^`]+`)", text)):
        if index % 2:
            out.append(f'<code translate="no">{html.escape(part[1:-1], quote=False)}</code>')
            continue
        escaped = html.escape(part, quote=False)
        escaped = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)
        escaped = URL.sub(lambda m: f'<a href="{m.group(0)}" rel="noopener">{m.group(0)}</a>', escaped)
        out.append(escaped)
    return "".join(out)


def blocks(markdown: str) -> list[str]:
    return [b for b in re.split(r"\n\s*\n", markdown.replace("\r\n", "\n").strip()) if b.strip()]


def _list_items(block: str, marker: re.Pattern[str]) -> list[str]:
    items: list[str] = []
    for line in block.splitlines():
        if marker.match(line):
            items.append(marker.sub("", line, count=1).strip())
        elif items:
            items[-1] += " " + line.strip()
    return items


BULLET = re.compile(r"^\s*-\s+")
NUMBER = re.compile(r"^\s*\d+\.\s+")


def render_block(block: str, heading_level: int) -> str:
    first = block.splitlines()[0]
    if first.startswith("```"):
        lines = block.splitlines()[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        code = html.escape("\n".join(lines), quote=False)
        return f'<pre class="policy-code"><code translate="no">{code}</code></pre>'
    if first.startswith("#"):
        title = first.lstrip("#").strip()
        return f"<h{heading_level}>{inline(title)}</h{heading_level}>"
    if BULLET.match(first):
        items = "".join(f"<li>{inline(i)}</li>" for i in _list_items(block, BULLET))
        return f'<ul class="policy-list">{items}</ul>'
    if NUMBER.match(first):
        items = "".join(f"<li>{inline(i)}</li>" for i in _list_items(block, NUMBER))
        return f'<ol class="policy-list">{items}</ol>'
    text = " ".join(line.strip() for line in block.splitlines())
    return f'<p class="body-text">{inline(text)}</p>'


def merged_blocks(markdown: str) -> list[str]:
    """Join list items, and indented paragraphs that continue them, into one list block."""
    out: list[str] = []
    for block in blocks(markdown):
        first = block.splitlines()[0]
        previous = out[-1].splitlines()[0] if out else ""
        numbered = NUMBER.match(first) and NUMBER.match(previous)
        bulleted = BULLET.match(first) and BULLET.match(previous)
        # An indented paragraph after a list item continues that item.
        continued = first[:1].isspace() and (NUMBER.match(previous) or BULLET.match(previous))
        if numbered or bulleted or continued:
            out[-1] += "\n" + block
        else:
            out.append(block)
    return out


def render(markdown: str, heading_level: int = 3) -> str:
    return "\n  ".join(render_block(b, heading_level) for b in merged_blocks(markdown))


def sections(markdown: str) -> list[tuple[str | None, str]]:
    """Split on level-two headings. The level-one title is dropped."""
    out: list[tuple[str | None, list[str]]] = [(None, [])]
    for block in blocks(markdown):
        first = block.splitlines()[0]
        if first.startswith("# "):
            continue
        if first.startswith("## "):
            out.append((first[3:].strip(), []))
            continue
        out[-1][1].append(block)
    return [(title, "\n\n".join(body)) for title, body in out if body]


def subsection(markdown: str, heading: str) -> str:
    """Return the body under an exact heading of any level, up to the next heading."""
    pattern = rf"^#{{2,4}} {re.escape(heading)}\n(.*?)(?=^#{{1,4}} |\Z)"
    match = re.search(pattern, markdown, flags=re.M | re.S)
    if not match:
        raise ValueError(f"heading not found: {heading}")
    return match.group(1).strip()
