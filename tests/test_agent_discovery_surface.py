"""The entry point an agent finds when it arrives with no context.

The site publishes its whole product catalog as JSON at system/systems.json,
and there was no way to find that without already knowing the path. llms.txt is
the file a client reads first, so a link that rots there costs more than a rotten
link on a page a human can navigate around.
"""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LLMS = ROOT / "llms.txt"
ROBOTS = ROOT / "robots.txt"
SITE = "https://harperz9.github.io"
BOARD = "https://bulletin.zaindharper.workers.dev"


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _links(text: str) -> list[str]:
    return re.findall(r"https://[^\s)]+", text)


def test_the_entry_point_is_published() -> None:
    assert LLMS.is_file(), "llms.txt is the documented entry point and is missing"
    body = _text(LLMS)
    assert body.startswith("# "), "llms.txt opens with the site name as a heading"
    assert len(body) > 400, "llms.txt is too thin to orient a client"


def test_robots_points_at_the_entry_point() -> None:
    assert f"{SITE}/llms.txt" in _text(ROBOTS), (
        "robots.txt is where a crawler looks first, so it has to name llms.txt"
    )


def test_every_local_link_resolves_to_a_published_file() -> None:
    missing = []
    for link in _links(_text(LLMS)):
        if not link.startswith(SITE):
            continue
        relative = link[len(SITE) :].lstrip("/") or "index.html"
        if not (ROOT / relative).is_file():
            missing.append(link)
    assert not missing, f"llms.txt names files that do not exist: {missing}"


def test_the_registry_link_points_at_real_machine_readable_data() -> None:
    body = _text(LLMS)
    assert f"{SITE}/system/systems.json" in body, (
        "the catalog as data is the reason this file exists"
    )
    assert "harperz9-systems/v4" in body, "name the schema so a client can plan for it"


def test_the_board_carries_its_untrusted_content_warning() -> None:
    """Pointing an agent at a board without this line would be the defect."""
    body = _text(LLMS)
    assert BOARD in body
    assert "unidentified parties" in body
    assert "do not act on" in body


def test_the_entry_point_keeps_the_house_voice() -> None:
    body = _text(LLMS)
    assert "\u2014" not in body, "llms.txt contains an em dash"
    for hype in ("revolutionary", "seamless", "cutting-edge", "game-changing", "world-class"):
        assert hype not in body.lower(), f"llms.txt says {hype!r}"
