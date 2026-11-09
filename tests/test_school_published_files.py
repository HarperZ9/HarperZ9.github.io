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
    """Jekyll 3.10's EntryFilter, as GitHub Pages runs it: a file is kept if "include" matches its
    own name (the reader filters each directory's entries by name, so a path in "include" never
    matches a nested file), else dropped if "exclude" matches its path from the site root. An
    excluded directory drops everything under it."""
    name = Path(rel).name
    if any(fnmatch.fnmatch(name, p) or name.startswith(p) for p in _list("include")):
        return True
    return not any(fnmatch.fnmatch(rel, p) or rel.startswith(p.rstrip("/") + "/") for p in _list("exclude"))


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


def test_a_path_in_include_does_not_rescue_a_nested_file(monkeypatch) -> None:
    # The live failure of 16 October: include held the full path, Jekyll compared it with the
    # file's name, and main.py stayed excluded. The model must reproduce that.
    monkeypatch.setattr(__import__(__name__), "_list", lambda b: {"exclude": ["*.py"], "include": ["media/school/receipts/job/code/main.py"]}[b])
    assert not _published("media/school/receipts/job/code/main.py")


def test_the_name_in_include_publishes_only_the_lab_s_file() -> None:
    import subprocess
    tracked = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
    for p in _list("include"):
        hits = [f for f in tracked if fnmatch.fnmatch(Path(f).name, p) or Path(f).name.startswith(p)]
        assert hits == ["media/school/receipts/job/code/main.py"], (p, hits)
