from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
FIGURE_ID = "incident-multilane-timeline"


def _text(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def _timeline_items() -> list[dict[str, object]]:
    companion = json.loads(_text(f"figures/{FIGURE_ID}.json"))
    return companion["figure"]["data"]["items"]


def _group_by_key(root: ElementTree.Element, key: str) -> ElementTree.Element | None:
    return next((element for element in root.iter() if element.attrib.get("data-figure-key") == key), None)


def _flat_text(element: ElementTree.Element) -> str:
    return " ".join(" ".join(element.itertext()).split())


def test_incident_timeline_svg_uses_readable_grouped_sequence() -> None:
    svg = _text(f"figures/{FIGURE_ID}.svg")

    assert "…" not in svg
    assert 'font-size="7"' not in svg
    assert 'font-size="8"' not in svg

    root = ElementTree.fromstring(svg)
    assert root.attrib["data-figure-kind"] == "timeline"
    assert root.attrib["data-layout"] == "grouped-vertical"

    label_sizes = [float(value) for value in re.findall(r'font-size="([0-9.]+)"', svg)]
    assert label_sizes and min(label_sizes) >= 16
    assert "Chronology only" in _flat_text(root)

    for index, item in enumerate(_timeline_items()):
        key = f"timeline:{index}"
        group = _group_by_key(root, key)
        assert group is not None, key
        rendered = _flat_text(group)
        assert item["date"] in rendered, key
        assert item["lane"] in rendered, key
        assert item["label"] in rendered, key
        assert str(item["status"]).title() in rendered, key
        assert ", ".join(item["sourceIds"]) in rendered, key

        aria = group.attrib.get("aria-label", "")
        assert item["date"] in aria, key
        assert item["lane"] in aria, key
        assert item["label"] in aria, key


def test_incident_timeline_renderer_is_deterministic() -> None:
    renderer = ROOT / "scripts" / "render-incident-multilane-timeline.mjs"
    result = subprocess.run(
        ["node", str(renderer), "--check"],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stdout + result.stderr
    assert "incident-multilane-timeline outputs match" in result.stdout
