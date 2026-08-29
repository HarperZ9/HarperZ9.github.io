import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def test_frontier_safety_brief_is_linked_and_source_bound() -> None:
    page = ROOT / "frontier-safety-openai-hugging-face-incident.html"
    assert page.is_file(), "frontier-safety incident brief page is missing"

    shell = read("frontier-safety-openai-hugging-face-incident.html")
    writing = read("writing.html")
    assert 'href="frontier-safety-openai-hugging-face-incident.html"' in writing
    assert "openai / hugging face incident" in writing.lower()

    expected_parts = [
        "writing/frontier-safety-openai-hugging-face-incident/01.md",
        "writing/frontier-safety-openai-hugging-face-incident/02.md",
        "writing/frontier-safety-openai-hugging-face-incident/03.md",
    ]
    for part in expected_parts:
        assert part in shell, f"{part} is not loaded by the article shell"
        assert (ROOT / part).is_file(), f"{part} is missing"

    source = "\n".join(read(part) for part in expected_parts)
    required_sources = [
        "https://openai.com/index/hugging-face-incident-and-the-road-ahead/",
        "https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf",
        "https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/",
    ]
    for url in required_sources:
        assert url in source, f"missing source URL: {url}"

    for phrase in (
        "warning shot",
        "side-channel coordination",
        "safe exit",
        "reward hacking",
        "Do not publish live bypasses",
    ):
        assert phrase.lower() in source.lower(), phrase


def test_frontier_safety_brief_is_registered_under_research() -> None:
    routes_source = read("system/routes.js")
    match = re.search(r'ROUTE_REGISTRY_JSON = ("(?:[^"\\]|\\.)*");', routes_source)
    assert match, "generated route registry JSON is missing"
    registry = json.loads(json.loads(match.group(1)))

    research = next(family for family in registry["families"] if family["label"] == "Research")
    route = next(
        route
        for route in research["routes"]
        if route["href"] == "frontier-safety-openai-hugging-face-incident.html"
    )
    assert route["label"] == "OpenAI / Hugging Face incident"


def test_frontier_safety_brief_has_accessible_visual_evidence() -> None:
    shell = read("frontier-safety-openai-hugging-face-incident.html")
    diagram = ROOT / "img" / "diagrams" / "frontier-safety-incident-control-plane.svg"

    assert diagram.is_file(), "incident control-plane diagram is missing"
    assert "frontier-safety-incident-control-plane.svg" in shell
    assert "alt=" in shell

    svg = diagram.read_text(encoding="utf-8")
    for phrase in (
        "<title",
        "<desc",
        "Training pressure",
        "Sandbox boundary",
        "External service",
        "Incident response",
    ):
        assert phrase in svg, phrase
