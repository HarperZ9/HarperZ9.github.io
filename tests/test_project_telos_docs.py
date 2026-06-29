from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RESEARCH = ROOT / "docs" / "superpowers" / "research" / "2026-06-28-project-telos-current-state-and-research-os.md"
PLAN = ROOT / "docs" / "superpowers" / "plans" / "2026-06-28-telos-universal-media-engine.md"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_project_telos_research_os_dossier_names_current_boundaries() -> None:
    src = read(RESEARCH)
    for term in (
        "rights-clean",
        "metadata spine",
        "KV cache",
        "context envelope",
        "quality-tool boundary",
        "five flagship",
        "Calibrate Pro",
        "Quanta Color",
        "QuantaLang",
        "studio-engine",
        "reconcile",
        "Crucible",
        "MATCH",
        "DRIFT",
        "UNVERIFIABLE",
    ):
        assert term in src


def test_engine_plan_reflects_media_graph_package_progress() -> None:
    src = read(PLAN)
    assert "- [x] Emit `media.graph` project package outputs for saved/editable graphs." in src
    assert "system/graph/package.js" in src
    assert "system/graph/package.test.mjs" in src
    assert "Expose existing `media.graph` project save/load packages" in src
