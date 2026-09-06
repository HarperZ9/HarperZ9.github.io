"""Regression tests for deterministic social-card browser selection."""

import pytest
from pathlib import Path

from tools.render_cards import launch_browser


def test_card_art_keeps_useful_copy_without_decorative_text_rails() -> None:
    template = (Path(__file__).resolve().parents[1] / "img/og/_card.html").read_text(encoding="utf-8")
    assert 'id="word"' in template
    assert 'id="headline"' in template
    for obsolete in ('class="metadata"', 'id="role"', 'id="pipeline"', 'class="site"'):
        assert obsolete not in template


class FakeChromium:
    def __init__(self, first_error: Exception | None = None) -> None:
        self.first_error = first_error
        self.calls: list[dict] = []

    def launch(self, **kwargs):
        self.calls.append(kwargs)
        if len(self.calls) == 1 and self.first_error is not None:
            raise self.first_error
        return "browser"


def test_launch_browser_falls_back_to_installed_chrome_when_bundle_is_absent() -> None:
    chromium = FakeChromium(RuntimeError("Executable doesn't exist at bundled path"))

    assert launch_browser(chromium) == "browser"
    assert chromium.calls == [{}, {"channel": "chrome"}]


def test_launch_browser_does_not_hide_unrelated_errors() -> None:
    chromium = FakeChromium(RuntimeError("profile is locked"))

    with pytest.raises(RuntimeError, match="profile is locked"):
        launch_browser(chromium)

    assert chromium.calls == [{}]
