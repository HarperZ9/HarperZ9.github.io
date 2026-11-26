from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "gaussian-splats.html"
MANIFEST = ROOT / "art" / "gaussian-splats" / "manifest.json"
README = ROOT / "art" / "gaussian-splats" / "README.md"
VALIDATOR = ROOT / "art" / "gaussian-splats" / "validate_scene.py"
SITEMAP = ROOT / "sitemap.xml"


def test_gaussian_splat_lab_route_and_resources_exist() -> None:
    for path in (PAGE, MANIFEST, README, VALIDATOR, SITEMAP):
        assert path.is_file(), path

    page = PAGE.read_text(encoding="utf-8")
    assert "<title>Gaussian Splat Lab &middot; Zain Dana Harper</title>" in page
    assert 'href="art/gaussian-splats/manifest.json"' in page
    assert 'href="art/gaussian-splats/README.md"' in page
    assert "No Gaussian-splat scene is being represented as finished" in page
    assert "https://harperz9.github.io/gaussian-splats.html" in SITEMAP.read_text(encoding="utf-8")


def test_manifest_does_not_self_promote_an_unbuilt_scene() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert manifest["status"] == "SOURCE_PREPARED"
    # D7, 3 October 2026: only the format line changed, from the planned .spz to .ngsf.
    assert manifest["required_output"]["format"] == "ngsf"
    assert manifest["required_output"]["scene_receipt"] == "sha256"
    assert manifest["required_output"]["generator_receipt_required"] is True
    assert manifest["outputs"] == []
    assert len(manifest["sources"]) == 3
    assert all(source["scene_status"] == "NOT_GENERATED" for source in manifest["sources"])
    assert all(source["scene_path"] is None for source in manifest["sources"])

    hashes = [source["sha256"] for source in manifest["sources"]]
    assert hashes == [
        "7d2f720654c343c7525e4645ffd33396ad5bef03f548a58821d2e909d544bd6c",
        "b739daac9f937a56d3eeb838f9dc32fa393355a4c44051537232e520284ad485",
        "2c5af9d659a255bc77ca3628c1332197aab0ca660d6495f2f1d2e9bd0000531b",
    ]


def test_runbook_preserves_the_real_scene_boundary() -> None:
    text = README.read_text(encoding="utf-8")
    assert "No `.ngsf` scene has been generated or published" in text
    assert "A PNG, screenshot, or video may document a scene, but it is not the scene itself" in text
    assert "not a scan, photogrammetric capture, or measured reconstruction" in text


def test_atlas_scenes_are_shown_only_with_established_provenance() -> None:
    import hashlib
    atlas = ROOT / "art" / "spatial" / "atlas"
    prov = json.loads((atlas / "provenance.json").read_text(encoding="utf-8"))
    assert prov["extraction_source_of_record"]["sha256"] == "a4240c641d7018afb5204db41dca37dfea62aeafaf5a0a7d91003fdab46d24da"
    assert len(prov["scenes"]) == 27
    page = PAGE.read_text(encoding="utf-8")
    for scene in prov["scenes"]:
        model = (atlas / scene["model"]).read_bytes()
        assert model[:4] == b"NGS5", scene["id"]
        assert hashlib.sha256(model).hexdigest() == scene["model_sha256"], scene["id"]
        # A scene is shown only when its generator commit is known.
        assert scene["shown"] is (scene["generator"]["commit"] is not None), scene["id"]
        if not scene["shown"]:
            assert f'data-held="{scene["id"]}"' in page, scene["id"]
    shown = sum(1 for s in prov["scenes"] if s["shown"])
    assert f'<dd data-scene-count>{shown}</dd>' in page
