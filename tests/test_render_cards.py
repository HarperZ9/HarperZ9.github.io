"""Regression tests for deterministic social-card browser selection."""

import pytest

from tools.render_cards import launch_browser


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
