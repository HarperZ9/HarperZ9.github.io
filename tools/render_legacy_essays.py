"""Render legacy Markdown-backed essays into complete static HTML pages."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

ESSAYS: dict[str, tuple[str, tuple[Path, ...]]] = {
    "models-propose-oracles-dispose.html": (
        "essay",
        tuple(
            Path("writing/models-propose-oracles-dispose") / f"{index:02}.md"
            for index in range(1, 5)
        ),
    ),
    "frontier-safety-openai-hugging-face-incident.html": (
        "essay",
        tuple(
            Path("writing/frontier-safety-openai-hugging-face-incident")
            / f"{index:02}.md"
            for index in range(1, 4)
        ),
    ),
    "no-receipt-no-accept.html": (
        "essay",
        tuple(
            Path("writing/no-receipt-no-accept") / f"{index:02}.md"
            for index in range(1, 10)
        ),
    ),
    "pick-the-lock-for-everyone.html": (
        "essay",
        tuple(
            Path("writing/pick-the-lock-for-everyone-v3") / f"{index:02}.md"
            for index in range(1, 14)
        ),
    ),
    "pick-the-lock-for-everyone-talk.html": (
        "talk",
        (
            Path("writing/pick-the-lock-for-everyone-talk/01.md"),
            Path("writing/pick-the-lock-for-everyone-talk/02.md"),
            Path("writing/pick-the-lock-for-everyone-talk/02b.md"),
            Path("writing/pick-the-lock-for-everyone-talk/02c.md"),
            Path("writing/pick-the-lock-for-everyone-talk/02d.md"),
            Path("writing/pick-the-lock-for-everyone-talk/02e.md"),
            Path("writing/pick-the-lock-for-everyone-talk/03.md"),
        ),
    ),
}

BODY_PATTERN = re.compile(
    r'<div class="article-body"[^>]*>.*?</div>',
    re.DOTALL,
)
OBSOLETE_NOSCRIPT_PATTERN = re.compile(
    r"\s*<noscript><p>This edition needs JavaScript.*?</p></noscript>",
    re.DOTALL,
)
LOADER_SCRIPT_PATTERN = re.compile(
    r'\s*<script type="module" src="system/essay-loader\.js[^"\n]*"></script>'
)
WORD_COUNT_PATTERN = re.compile(r"(<span data-word-count>).*?(</span>)")


def _inline(value: str) -> str:
    snippets: list[str] = []
    text = html.escape(value, quote=False)

    def store_code(match: re.Match[str]) -> str:
        token = f"@@CODE{len(snippets)}@@"
        snippets.append(f"<code>{match.group(1)}</code>")
        return token

    text = re.sub(r"`([^`]+)`", store_code, text)
    text = re.sub(
        r"\[([^\]]+)\]\((https?://[^\s)]+)\)",
        r'<a class="inline" href="\2" rel="external noopener">\1</a>',
        text,
    )
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", text)
    for index, snippet in enumerate(snippets):
        text = text.replace(f"@@CODE{index}@@", snippet)
    return text


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9\s-]", "", value.lower()).strip()
    slug = re.sub(r"\s+", "-", slug)
    return re.sub(r"sk-(?=[a-z0-9_-]{20,})", "sk.", slug)


def _strip_document_header(lines: list[str]) -> list[str]:
    work = list(lines)

    def drop_blank() -> None:
        while work and not work[0].strip():
            work.pop(0)

    drop_blank()
    if work and work[0].startswith("# "):
        work.pop(0)
    drop_blank()
    if work and work[0].startswith("## "):
        work.pop(0)
    drop_blank()
    if work and re.fullmatch(r"\*[^*]+\*", work[0].strip()):
        work.pop(0)
    drop_blank()
    return work


def render_markdown(source: str, mode: str) -> str:
    """Render the existing essay Markdown subset without browser JavaScript."""
    if mode not in {"essay", "talk"}:
        raise ValueError(f"unsupported mode: {mode}")

    lines = _strip_document_header(source.replace("\r\n", "\n").split("\n"))
    rendered: list[str] = []
    index = 0

    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
            continue
        if line == "---":
            rendered.append("<hr>")
            index += 1
            continue
        if line.startswith("## "):
            label = line[3:].strip()
            rendered.append(f'<h2 id="{_slug(label)}">{_inline(label)}</h2>')
            index += 1
            continue
        if line.startswith("### "):
            label = line[4:].strip()
            rendered.append(f'<h3 id="{_slug(label)}">{_inline(label)}</h3>')
            index += 1
            continue
        if line.startswith("> "):
            quote: list[str] = []
            while index < len(lines) and lines[index].strip().startswith("> "):
                quote.append(lines[index].strip()[2:])
                index += 1
            rendered.append(
                '<blockquote class="content-note"><p>'
                + _inline(" ".join(quote))
                + "</p></blockquote>"
            )
            continue
        if line.startswith("- "):
            items: list[str] = []
            while index < len(lines) and lines[index].strip().startswith("- "):
                items.append(f"<li>{_inline(lines[index].strip()[2:])}</li>")
                index += 1
            css_class = (
                "source-list"
                if rendered and rendered[-1].startswith('<h2 id="sources"')
                else ""
            )
            rendered.append(f'<ul class="{css_class}">{"".join(items)}</ul>')
            continue

        paragraph = [line]
        index += 1
        while index < len(lines):
            following = lines[index].strip()
            if (
                not following
                or following == "---"
                or following.startswith("## ")
                or following.startswith("### ")
                or following.startswith("> ")
                or following.startswith("- ")
            ):
                break
            paragraph.append(following)
            index += 1
        value = " ".join(paragraph)
        cue = mode == "talk" and value.startswith("[") and value.endswith("]")
        cue_class = ' class="cue"' if cue else ""
        rendered.append(f"<p{cue_class}>{_inline(value)}</p>")

    return "\n".join(rendered)


def render_page(page: Path, parts: tuple[Path, ...], mode: str) -> bytes:
    """Return one complete page with its Markdown body embedded."""
    source = "".join(
        (page.parent / part).read_text(encoding="utf-8") for part in parts
    )
    page_source = page.read_text(encoding="utf-8")
    body = render_markdown(source, mode)
    source_links = "".join(
        '<li><a class="inline" href="'
        + html.escape(part.as_posix(), quote=True)
        + f'">Source part {index}</a></li>'
        for index, part in enumerate(parts, start=1)
    )
    replacement = (
        '<div class="article-body">\n'
        "<!-- BEGIN GENERATED ESSAY BODY -->\n"
        f"{body}\n"
        '<details class="source-parts"><summary>Plain-text source parts</summary>'
        f"<ol>{source_links}</ol></details>\n"
        "<!-- END GENERATED ESSAY BODY -->\n"
        "</div>"
    )
    page_source, replacements = BODY_PATTERN.subn(
        lambda _match: replacement, page_source, count=1
    )
    if replacements != 1:
        raise ValueError(f"{page.name}: expected one article body, found {replacements}")
    page_source = OBSOLETE_NOSCRIPT_PATTERN.sub("", page_source, count=1)
    page_source = LOADER_SCRIPT_PATTERN.sub("", page_source, count=1)
    word_count = len(re.findall(r"\b[\w’'-]+\b", source))
    page_source, counters = WORD_COUNT_PATTERN.subn(
        rf"\g<1>{word_count:,}\g<2>", page_source, count=1
    )
    if counters != 1:
        raise ValueError(f"{page.name}: expected one word counter, found {counters}")
    return page_source.encode("utf-8")


def build(root: Path = ROOT) -> dict[str, str]:
    """Render the explicit legacy set and return stable output hashes."""
    outputs: dict[str, bytes] = {}
    for page_name, (mode, parts) in ESSAYS.items():
        page = root / page_name
        outputs[page_name] = render_page(page, parts, mode)

    for page_name, content in outputs.items():
        destination = root / page_name
        if destination.read_bytes() != content:
            destination.write_bytes(content)

    return {
        page_name: hashlib.sha256(content).hexdigest()
        for page_name, content in sorted(outputs.items())
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    print(json.dumps(build(args.root.resolve()), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
