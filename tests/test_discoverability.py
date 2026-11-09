"""Contracts for the tool and video records that feed search and AI-search markup.

discover.json names each tool's current version, system/videos.json each playable
video. The JSON-LD, llms.txt and llms-full.txt are written from them; these tests
check that the three agree and that every file a record points at exists.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://harperz9.github.io"
LD = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)


def tools() -> list[dict]:
    return json.loads((ROOT / "discover.json").read_text(encoding="utf-8"))["tools"]


def nodes(relative: str) -> list[dict]:
    blocks = LD.findall((ROOT / relative).read_text(encoding="utf-8"))
    return [n for b in blocks for n in json.loads(b)["@graph"]]


def test_every_tool_page_states_the_version_discover_json_names() -> None:
    checked = 0
    for tool in tools():
        if not tool.get("page"):
            continue
        apps = [n for n in nodes(tool["page"]) if n["@type"] == "SoftwareApplication"]
        assert len(apps) == 1, tool["page"]
        assert apps[0]["softwareVersion"] == tool["version"], tool["page"]
        assert apps[0]["downloadUrl"] and apps[0]["license"], tool["page"]
        checked += 1
    assert checked >= 6


def test_llms_files_name_every_tool_at_its_version() -> None:
    short = (ROOT / "llms.txt").read_text(encoding="utf-8")
    full = (ROOT / "llms-full.txt").read_text(encoding="utf-8")
    for tool in tools():
        assert f"{tool['name']}" in short, tool["name"]
        section = full.split(f"\n## {tool['name']}\n", 1)
        assert len(section) == 2, f"llms-full.txt has no section for {tool['name']}"
        assert f"Version {tool['version']}" in section[1].split("\n## ", 1)[0], tool["name"]


def test_video_records_point_at_files_the_site_serves() -> None:
    videos = json.loads((ROOT / "system/videos.json").read_text(encoding="utf-8"))["videos"]
    assert len(videos) >= 20
    for video in videos:
        for key in ("contentUrl", "thumbnailUrl"):
            assert video[key].startswith(ORIGIN + "/"), video[key]
            assert (ROOT / video[key][len(ORIGIN) + 1:].split("?")[0]).is_file(), video[key]
        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", video["uploadDate"]), video["contentUrl"]
        on_page = [n for n in nodes(video["page"]) if n["@type"] == "VideoObject"]
        assert video["contentUrl"] in {n["contentUrl"] for n in on_page}, video["page"]


def test_person_links_the_youtube_channel() -> None:
    person = next(n for n in nodes("index.html") if n["@type"] == "Person")
    assert "https://www.youtube.com/@zaindanaharper" in person["sameAs"]
