"""Focused shell and accessibility contracts for the static retro evidence pages."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "engine-revival.html": "Engine Revival",
    "brender-archival.html": "BRender Archival",
}
SHELL_STYLESHEET = "system/retro-evidence-pages.css?v=20260902-creative-chassis"
SHELL_SCRIPT = "system/nav.js?v=20260902-creative-chassis"


class _ShellParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.navs: list[dict[str, str | None]] = []
        self.links: list[dict[str, str | None]] = []
        self.stylesheets: list[str] = []
        self.scripts: list[str] = []
        self.descriptions: list[str] = []
        self.site_nav_mounts = 0
        self._noscript_depth = 0
        self._nav_depth = 0
        self._current_link: dict[str, str | None] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        classes = set((values.get("class") or "").split())
        if tag == "noscript":
            self._noscript_depth += 1
        if tag == "div" and values.get("id") == "site-nav" and "site-nav" in classes:
            self.site_nav_mounts += 1
        if tag == "nav":
            self._nav_depth += 1
            self.navs.append({**values, "in_noscript": str(bool(self._noscript_depth))})
        if tag == "a" and self._nav_depth:
            self._current_link = {**values, "text": ""}
            self.links.append(self._current_link)
        if tag == "link" and values.get("rel") == "stylesheet" and values.get("href"):
            self.stylesheets.append(values["href"] or "")
        if tag == "script" and values.get("src"):
            self.scripts.append(values["src"] or "")
        if tag == "meta" and values.get("name") == "description":
            self.descriptions.append(values.get("content") or "")

    def handle_data(self, data: str) -> None:
        if self._current_link is not None:
            self._current_link["text"] = (self._current_link.get("text") or "") + data

    def handle_endtag(self, tag: str) -> None:
        if tag == "a":
            self._current_link = None
        if tag == "nav":
            self._nav_depth -= 1
        if tag == "noscript":
            self._noscript_depth -= 1


def parse_page(relative: str) -> _ShellParser:
    parser = _ShellParser()
    parser.feed((ROOT / relative).read_text(encoding="utf-8"))
    return parser


def test_retro_evidence_pages_use_the_canonical_zentropy_navigation() -> None:
    """Returning the legacy all-caps link strip must break this contract."""
    for relative, current_label in PAGES.items():
        parser = parse_page(relative)

        assert parser.site_nav_mounts == 1, relative
        assert parser.scripts.count(SHELL_SCRIPT) == 1, relative

        fallback = next(
            nav
            for nav in parser.navs
            if nav.get("in_noscript") == "True" and nav.get("class") == "site-nav"
        )
        assert fallback.get("aria-label") == "Primary", relative
        assert not any("retro-lab-nav" in (nav.get("class") or "") for nav in parser.navs), relative

        fallback_links = [link for link in parser.links if link.get("href")]
        assert [link.get("text", "").strip() for link in fallback_links[:5]] == [
            "Zentropy Labs",
            "Hire / work",
            "Systems",
            "Research",
            "Retro Engine",
        ], relative
        current = [link for link in fallback_links if link.get("aria-current") == "page"]
        assert len(current) == 1, relative
        assert current[0].get("text", "").strip() == current_label, relative


def test_retro_evidence_pages_share_one_exclusive_harmonization_layer() -> None:
    """Dropping the page-local canon or reconnecting a broad theme must fail."""
    for relative in PAGES:
        parser = parse_page(relative)
        assert parser.stylesheets.count(SHELL_STYLESHEET) == 1, relative

    users = []
    for page in ROOT.glob("*.html"):
        if SHELL_STYLESHEET in page.read_text(encoding="utf-8"):
            users.append(page.name)
    assert set(users) == set(PAGES)


def test_retro_evidence_metadata_does_not_assign_a_false_flywheel_hierarchy() -> None:
    """A retro project description must not place independent work under Flywheel."""
    for relative in PAGES:
        parser = parse_page(relative)
        assert len(parser.descriptions) == 1, relative
        assert "Flywheel-first" not in parser.descriptions[0], relative


def test_retro_evidence_shell_keeps_sentence_case_and_a_project_rail() -> None:
    """Uppercase tracked controls and the equal generic-card grid are regressions."""
    stylesheet = ROOT / "system" / "retro-evidence-pages.css"
    assert stylesheet.is_file()
    css = stylesheet.read_text(encoding="utf-8")

    assert ".retro-evidence-page .retro-lab-nav" not in css
    assert "text-transform: uppercase" not in css
    assert "letter-spacing: .1em" not in css
    assert "border-radius: 999px" not in css
    assert "repeat(3, minmax(0, 1fr))" not in css
    assert ".retro-evidence-page .retro-lab-grid" in css
    assert "grid-template-columns: minmax(0, .62fr) minmax(0, 1.38fr)" in css
    assert "min-height: 44px" in css
    assert "@media (forced-colors: active)" in css
    assert "@media print" in css
