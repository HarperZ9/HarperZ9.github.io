"""Dated public artifacts must belong to a committed edition, so no served page escapes coverage.

The review built a 2026-09-24 edition that cited an unregistered source, then committed only its
archive page, archive JSON and social drafts, with no edition file and no history entry. Every
check passed, because the record rules read only the edition files. These tests replay that
route on a copy of the pinned record. Byte equality between an artifact and its edition is the
reproducibility test's job; these rules bind each artifact and sitemap route to an edition that
the coverage rules check.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from test_frontier_safety_receipts import receipts
from test_frontier_safety_record_lifecycle import (  # noqa: F401  (record is a fixture)
    ROOT, coverage, publish_receipted, record, sitemap_for,
)

NEW_DATE = "2026-09-24"
UNREGISTERED = "https://www.anthropic.com/news/unregistered-claim-page"
DATED = ("frontier-safety/archive/{d}.html", "frontier-safety/data/archive/{d}.json",
         "frontier-safety/social/{d}-x.txt", "frontier-safety/social/{d}-linkedin.txt")
REJECTED = "not an artifact the builder writes for a committed edition"


@pytest.fixture
def published(record: Path) -> Path:  # noqa: F811
    """The pinned record plus the real dated artifacts the builder wrote for each pinned edition."""
    for date in coverage.PINNED_ARCHIVE:
        for pattern in DATED:
            relative = pattern.format(d=date)
            (record / relative).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(ROOT / relative, record / relative)
    return record


def plant(root: Path, relative: str, text: str = f'<a href="{UNREGISTERED}">claim</a>\n') -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def add_route(root: Path, route: str) -> None:
    sitemap = root / "sitemap.xml"
    text = sitemap.read_text(encoding="utf-8")
    sitemap.write_text(text.replace("</urlset>", f"  <url><loc>{route}</loc></url>\n</urlset>"), encoding="utf-8")


def test_pinned_record_with_its_own_dated_artifacts_is_valid(published: Path) -> None:
    coverage.validate_repository(published)


@pytest.mark.parametrize("relative", [
    *(pattern.format(d=NEW_DATE) for pattern in DATED),
    "frontier-safety/archive/preview.html",
    f"frontier-safety/archive/{NEW_DATE}/index.html",
    "frontier-safety/social/2026-09-23-mastodon.txt",
])
def test_dated_artifact_without_a_committed_edition_is_rejected(published: Path, relative: str) -> None:
    plant(published, relative)
    with pytest.raises(receipts.ReceiptError, match=REJECTED):
        coverage.validate_repository(published)


def test_orphan_archive_page_fails_the_validate_command(published: Path) -> None:
    for pattern in DATED:
        plant(published, pattern.format(d=NEW_DATE))
    add_route(published, f"https://harperz9.github.io/frontier-safety/archive/{NEW_DATE}.html")
    result = subprocess.run([sys.executable, str(ROOT / "tools" / "frontier_safety_receipts.py"), "validate",
                             "--root", str(published)], capture_output=True, text=True, check=False)
    assert result.returncode == 1
    assert REJECTED in result.stderr and "Traceback" not in result.stderr


def test_dated_artifacts_of_a_committed_edition_are_accepted(published: Path) -> None:
    publish_receipted(published)
    for pattern in DATED:
        plant(published, pattern.format(d=NEW_DATE), "Built from the committed edition.\n")
    coverage.validate_repository(published)


@pytest.mark.parametrize("route", [
    f"https://harperz9.github.io/frontier-safety/archive/{NEW_DATE}.html",
    "http://harperz9.github.io/frontier-safety/archive/2026-09-23.html",
    "https://harperz9.github.io/frontier-safety/archive/preview.html",
])
def test_sitemap_archive_route_without_a_committed_edition_page_is_rejected(published: Path, route: str) -> None:
    add_route(published, route)
    with pytest.raises(receipts.ReceiptError, match="sitemap route"):
        coverage.validate_repository(published)


def test_sitemap_route_for_a_committed_edition_is_accepted(published: Path) -> None:
    publish_receipted(published)
    (published / "sitemap.xml").write_text(sitemap_for([*coverage.PINNED_ARCHIVE, NEW_DATE]), encoding="utf-8")
    coverage.validate_repository(published)
