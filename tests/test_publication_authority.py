"""Repository authority contracts for the public publication funnel."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGES_REPO = "HarperZ9/HarperZ9.github.io"
PROFILE_REPO = "HarperZ9/HarperZ9"
REFERENCE_REPO = "HarperZ9/telos-v2"


def test_pages_readme_names_the_operational_canon() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")

    assert (
        f"`{PAGES_REPO}` is the canonical source and deployment repository"
        in readme
    )
    assert f"`{PROFILE_REPO}` is a derivative GitHub profile index" in readme
    assert f"`{REFERENCE_REPO}` is reference-only" in readme
    assert "telos-v2) is the canonical" not in readme


def test_pages_agent_boundary_forbids_split_publication_state() -> None:
    agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")

    for term in (
        "publication bodies",
        "edition state",
        "feeds",
        "source ledgers",
        "deployment logic",
    ):
        assert term in agents
    assert "profile repository" in agents.lower()
