"""Contracts for the plugin support, privacy and terms pages under plugins/."""

from __future__ import annotations

import html
import json
import re
import shutil
from pathlib import Path

import pytest

from tools import build_plugin_support_pages as builder
from tools import plugin_support_sources as sources

ROOT = Path(__file__).resolve().parents[1]
FLAGSHIPS = {"articulate", "canon", "crucible", "forum", "gather", "index",
             "learn", "mneme", "plexus", "relay", "telos"}
PAGES = ("support", "privacy", "terms")


def page_text(rel: str) -> str:
    raw = (ROOT / rel).read_text(encoding="utf-8")
    body = raw.split('<main id="main">', 1)[1].split("</main>", 1)[0]
    body = re.sub(r"</?(p|li|ul|ol|h[1-6]|section|div|tr|td|th)[^>]*>", " ", body)
    return " ".join(html.unescape(re.sub(r"<[^>]+>", "", body)).split())


def flat(markdown: str) -> str:
    text = re.sub(r"`([^`]+)`", r"\1", markdown).replace("**", "")
    return " ".join(text.split())


def test_every_flagship_plugin_has_all_three_pages() -> None:
    slugs = {tool["slug"] for tool in sources.load_spec()["tools"]}
    assert slugs == FLAGSHIPS
    for slug in FLAGSHIPS:
        for page in PAGES:
            assert (ROOT / "plugins" / slug / f"{page}.html").is_file(), f"{slug}/{page}"


def test_pages_and_snapshots_are_fresh() -> None:
    assert builder.main(["--check"]) == 0


def test_privacy_pages_reproduce_every_source_paragraph() -> None:
    for tool in sources.load_tools():
        rendered = page_text(f"plugins/{tool.slug}/privacy.html")
        for block in re.split(r"\n\s*\n", tool.privacy.strip()):
            if block.startswith("#"):
                continue
            assert flat(block) in rendered, f"{tool.slug}: missing {block[:60]!r}"


def test_terms_pages_quote_the_license_verbatim() -> None:
    for tool in sources.load_tools():
        rendered = page_text(f"plugins/{tool.slug}/terms.html")
        license_flat = flat(tool.license)
        assert "no separate terms-of-service document" in rendered
        if "sections" in tool.license_quote:
            disclaimer = flat(sources_subsection(tool.license, "Disclaimer"))
            assert disclaimer in rendered and disclaimer in license_flat
        else:
            for prefix in tool.license_quote["paragraphs"]:
                para = next(b for b in re.split(r"\n\s*\n", tool.license) if b.startswith(prefix))
                assert flat(para) in rendered


def sources_subsection(text: str, heading: str) -> str:
    from tools.plugin_support_markdown import subsection
    return subsection(text, heading)


def test_support_pages_name_the_issue_tracker_and_readme_prompts() -> None:
    for tool in sources.load_tools():
        rendered = page_text(f"plugins/{tool.slug}/support.html")
        assert f"github.com/{tool.repo}/issues" in rendered
        prompts = sources.try_it(tool.readme)
        assert len(prompts) >= 3
        for prompt in prompts:
            assert flat(prompt) in rendered


def test_index_json_lists_every_url_the_directory_asks_for() -> None:
    data = json.loads((ROOT / "plugins" / "plugins.json").read_text(encoding="utf-8"))
    assert {e["tool"].lower() for e in data["plugins"]} == FLAGSHIPS
    for entry in data["plugins"]:
        slug = entry["tool"].lower()
        for page in PAGES:
            assert entry[f"{page}_url"] == f"https://harperz9.github.io/plugins/{slug}/{page}.html"
        assert entry["support_contact"].endswith("/issues")


def test_pages_keep_the_house_voice_and_carry_no_local_paths() -> None:
    for page in sorted((ROOT / "plugins").rglob("*.html")):
        text = page.read_text(encoding="utf-8")
        assert "—" not in text, f"{page.name}: em dash"
        assert not re.search(r"[A-Z]:\\\\|[A-Z]:/(?:dev|Users)|/Users/", text), f"{page}: local path"


def test_drifted_snapshot_is_caught(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    data = tmp_path / "data"
    shutil.copytree(sources.DATA, data)
    monkeypatch.setattr(sources, "DATA", data)
    monkeypatch.setattr(sources, "SPEC", data / "plugins.json")
    monkeypatch.setattr(sources, "LOCK", data / "sources.lock.json")
    assert sources.verify_lock() == []
    target = data / "forum" / "PRIVACY.md"
    target.write_text(target.read_text(encoding="utf-8") + "\nAn added sentence.\n", encoding="utf-8")
    problems = sources.verify_lock()
    assert len(problems) == 1 and problems[0].startswith("forum/privacy")
