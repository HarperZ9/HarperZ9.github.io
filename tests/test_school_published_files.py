"""Every file a Night School lab fetches at run time must be on the published site.

GitHub Pages builds the site with Jekyll, and _config.yml excludes some patterns (for
example *.py). A local server serves everything, so a lab can pass locally and break live.
This reads the exclusions and inclusions and checks the receipts lab's bundle against them.
"""

from __future__ import annotations

import fnmatch
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _list(block: str) -> list[str]:
    text = (ROOT / "_config.yml").read_text(encoding="utf-8")
    m = re.search(rf"^{block}:\n((?:\s+-\s.*\n?)+)", text, re.M)
    return [re.sub(r"\s+#.*$", "", line.strip()[2:]).strip().strip('"') for line in m.group(1).splitlines()] if m else []


def _published(rel: str) -> bool:
    excluded = any(fnmatch.fnmatch(rel, p) or fnmatch.fnmatch(Path(rel).name, p) or rel.startswith(p.rstrip("/") + "/") for p in _list("exclude"))
    return not excluded or rel in _list("include")


def test_the_receipts_bundle_is_published() -> None:
    src = (ROOT / "system" / "school" / "receipts-verify.mjs").read_text(encoding="utf-8")
    files = re.findall(r'"([^"]+)"', re.search(r"BUNDLE_FILES = Object\.freeze\(\[([^\]]+)\]", src).group(1))
    assert "job/code/main.py" in files
    for f in files:
        rel = f"media/school/receipts/{f}"
        assert (ROOT / rel).is_file(), rel
        assert _published(rel), f"{rel} is excluded from the published site by _config.yml"


def test_the_check_sees_an_excluded_file() -> None:
    assert not _published("tools/school/page.py")
