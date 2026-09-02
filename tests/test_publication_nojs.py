"""Initial-response reading contracts for legacy long-form pages."""

from __future__ import annotations

import html
import re
from pathlib import Path

from tools.render_legacy_essays import render_page


ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "models-propose-oracles-dispose.html": (
        1_200,
        "A better proposer is a better proposer.",
    ),
    "frontier-safety-openai-hugging-face-incident.html": (
        1_000,
        "A safety briefing that does not change the workbench is just commentary.",
    ),
    "no-receipt-no-accept.html": (
        18_000,
        "Somebody should check this too.",
    ),
    "pick-the-lock-for-everyone.html": (
        20_000,
        "Sincerity is not a receipt.",
    ),
    "pick-the-lock-for-everyone-talk.html": (
        6_000,
        "Culture did not borrow my hands without permission.",
    ),
}
SECRET_SHAPES = re.compile(
    r"sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}"
)


def visible_text(source: str) -> str:
    without_scripts = re.sub(
        r"<(script|style)\b[^>]*>.*?</\1>",
        " ",
        source,
        flags=re.IGNORECASE | re.DOTALL,
    )
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", without_scripts)).split())


def test_legacy_articles_ship_complete_initial_html() -> None:
    """Replacing a static body with the former loading shell must fail."""
    for page, (minimum_words, closing_marker) in PAGES.items():
        source = (ROOT / page).read_text(encoding="utf-8")
        text = visible_text(source)

        assert len(text.split()) >= minimum_words, page
        assert closing_marker in text, page
        assert "Loading the plain-text" not in source, page
        assert "needs JavaScript to typeset" not in source, page
        assert "data-markdown-parts" not in source, page


def test_static_renderer_treats_source_backslashes_as_content(tmp_path: Path) -> None:
    """A regex example in prose must not become a replacement-template escape."""
    page = tmp_path / "article.html"
    part = tmp_path / "part.md"
    page.write_text(
        '<span data-word-count>…</span><div class="article-body" '
        'data-markdown-parts="part.md"><p>Loading the plain-text essay source…</p>'
        '</div><noscript><p>This edition needs JavaScript to typeset the source.'
        '</p></noscript><script type="module" '
        'src="system/essay-loader.js?v=test"></script>',
        encoding="utf-8",
    )
    part.write_text("# Example\n\n## Body\n\nThe pattern is `\\d+`.\n", encoding="utf-8")

    rendered = render_page(page, (Path("part.md"),), "essay").decode("utf-8")

    assert "<code>\\d+</code>" in rendered


def test_static_renderer_does_not_create_credential_shaped_anchors() -> None:
    """A heading slug must not trip the public secret scanner."""
    for page in PAGES:
        source = (ROOT / page).read_text(encoding="utf-8")
        assert not SECRET_SHAPES.search(source), page
