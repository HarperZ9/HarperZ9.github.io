from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STUDIO = ROOT / "studio.html"
STUDIO_JS = ROOT / "system" / "studio.js"


def studio_source() -> str:
    return STUDIO.read_text(encoding="utf-8")


def studio_js() -> str:
    return STUDIO_JS.read_text(encoding="utf-8")


def test_studio_surfaces_project_telos_feature_stack() -> None:
    src = studio_source()
    assert 'id="project-telos-features"' in src
    for term in (
        "Five-flagship spine",
        "project-telos.context-envelope/v1",
        "loop ledger",
        "action receipts",
        "admission decisions",
        "display calibration",
        "Revival registry",
        "Universal media engine",
        "Canonical Media IR",
        "Format Adapter Contract",
    ):
        assert term in src
    for href in (
        "gather.html",
        "index-graph.html",
        "forum.html",
        "crucible.html",
        "https://github.com/HarperZ9/telos",
        "docs/superpowers/plans/2026-06-28-telos-universal-media-engine.md",
    ):
        assert f'href="{href}"' in src


def test_studio_has_menuized_renderer_manipulation_controls() -> None:
    src = studio_source()
    for section in ("Make", "Bring", "Measure", "Model transforms", "Palette &amp; detail", "4D+ rotation"):
        assert section in src
    for control_id in (
        "studio-transforms",
        "model-transform-panel",
        "model-scale",
        "model-rx",
        "model-ry",
        "model-rz",
        "ndim-rotation",
        "fractal-palettes",
        "mc-form",
        "mc-detect",
        "engine-statusbar",
        "engine-status-backend",
        "engine-status-tier",
        "engine-status-particles",
        "engine-status-splats",
        "engine-status-media",
    ):
        assert f'id="{control_id}"' in src


def test_studio_wires_effects_mesh_and_ndim_rotation() -> None:
    js = studio_js()
    for marker in (
        'from "./studio-effects.js"',
        'from "./mesh-transform.js"',
        "TRANSFORM_GROUPS",
        "renderMeshTransform",
        "_activeNDimRotation",
        "applyFractalRenderControls",
        "connectDetectedLocalModel",
        'params.get("autodetect") !== "1"',
        'from "./engine/capability.js"',
        'from "./engine/render-plan.js"',
        'from "./media/ir.js"',
        'from "./media/studio-adapters.js"',
        'from "./graph/nodes/media-nodes.js"',
        'from "./graph/package.js"',
        "bootEngineStatus",
        "CANONICAL_MEDIA_KINDS",
        "createStudioMediaAdapters",
        "createMediaNodeRegistry",
        "createGraphPackage",
        "__studioMediaAdapters",
        "__studioMediaNodeRegistry",
        "__studioCreateGraphPackage",
        "engine-status-media",
    ):
        assert marker in js
