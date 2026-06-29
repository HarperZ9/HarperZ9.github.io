from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PLAN = ROOT / "docs" / "superpowers" / "plans" / "2026-06-28-telos-universal-media-engine.md"


def test_universal_media_engine_plan_exists_and_scopes_organs() -> None:
    src = PLAN.read_text(encoding="utf-8")
    for term in (
        "Node Graph Runtime",
        "Shader and Material Graph",
        "Hardware Render Planner",
        "Scene and Geometry Kernel",
        "Simulation and Physics Kernel",
        "Image, Compositing, and Pixel Lab",
        "Timeline, Sequencer, and State Transport",
        "Audio and Signal Engine",
        "Asset Graph and Import/Export Spine",
        "Canonical Media IR",
        "Format Adapter Contract",
        "Interoperability Matrix",
        "Agent, Provenance, and Receipt Layer",
        "Editor Shell and Interaction Model",
        "Hardware Scaling Contract",
        "Evidence Gates",
    ):
        assert term in src


def test_universal_media_engine_plan_names_competitive_reference_surfaces() -> None:
    src = PLAN.read_text(encoding="utf-8")
    for term in (
        "Blender",
        "Houdini",
        "TouchDesigner",
        "DaVinci Resolve",
        "Gaussian Splatting",
        "WebGPU",
        "WebGL2",
        "OpenUSD",
        "glTF",
        "OBJ",
        "SVG",
        "EXR",
        "WAV",
        "MIDI",
        "CSV",
        "JSON",
    ):
        assert term in src


def test_universal_media_engine_plan_requires_loss_receipts_for_every_format_conversion() -> None:
    src = PLAN.read_text(encoding="utf-8")
    for term in (
        "conversion receipt",
        "conserved fields",
        "dropped fields",
        "fidelity verdict",
        "round-trip test",
        "format adapter",
        "canonical IR",
    ):
        assert term in src


def test_universal_media_engine_plan_has_phased_build_steps() -> None:
    src = PLAN.read_text(encoding="utf-8")
    for term in (
        "Phase 0",
        "Phase 1",
        "Phase 2",
        "Phase 3",
        "Phase 4",
        "Phase 5",
        "Acceptance Criteria",
    ):
        assert term in src
