from __future__ import annotations

import hashlib
import json
import struct
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORLD_DIR = ROOT / "art" / "spatial"
MANIFEST = WORLD_DIR / "folded-light.world.json"
SIDECAR = WORLD_DIR / "folded-light.splats.bin"
BUILDER = WORLD_DIR / "build_scene.py"
EDITIONS = ROOT / "art" / "editions.json"
RECORD_BYTES = 40


def load_manifest() -> dict:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def test_world_package_files_exist() -> None:
    for path in (MANIFEST, SIDECAR, BUILDER, WORLD_DIR / "README.md", EDITIONS):
        assert path.is_file(), path


def test_world_manifest_shape_and_lane() -> None:
    manifest = load_manifest()
    assert manifest["schema"] == "zentropy.world-package/v1"
    assert manifest["lane"] == "authored"
    assert manifest["seed"] == "folded-light-inhabited"
    assert "authored" in manifest["disclosure"].lower()
    camera = manifest["camera"]
    assert 0 < camera["maxX"] <= 1 and 0 < camera["maxY"] <= 1 and 0 < camera["maxDolly"] <= 1
    depths = [layer["depth"] for layer in manifest["layers"]]
    assert all(0 <= d <= 1 for d in depths)


def test_sidecar_matches_manifest_receipt_byte_for_byte() -> None:
    manifest = load_manifest()
    blob = SIDECAR.read_bytes()
    assert len(blob) % RECORD_BYTES == 0
    assert len(blob) // RECORD_BYTES == manifest["splats"]["count"]
    expected = manifest["receipts"][manifest["splats"]["sidecar"]]
    assert hashlib.sha256(blob).hexdigest() == expected

    kinds = set()
    for offset in range(0, len(blob), RECORD_BYTES):
        record = struct.unpack_from("<10f", blob, offset)
        kinds.add(int(record[8]))
        assert 0.0 <= record[7] <= 1.0, "alpha out of range"
    assert kinds <= {0, 1, 2, 3, 4, 5}, "unknown splat kind id in sidecar"


def test_builder_is_deterministic() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(
            [sys.executable, str(BUILDER), "--out", tmp],
            check=True, capture_output=True,
        )
        rebuilt = Path(tmp)
        assert (rebuilt / "folded-light.splats.bin").read_bytes() == SIDECAR.read_bytes()
        assert json.loads((rebuilt / "folded-light.world.json").read_text(encoding="utf-8")) == load_manifest()


def test_editions_ledger_is_honest() -> None:
    ledger = json.loads(EDITIONS.read_text(encoding="utf-8"))
    assert ledger["schema"] == "zentropy.editions/v1"
    assert ledger["policy"]["physical_prints"] is None, (
        "a print route appeared; name it in policy and update this expectation deliberately"
    )
    text = EDITIONS.read_text(encoding="utf-8").lower()
    for fabrication in ("collector", "sold", "price", "wallet", "0x"):
        assert fabrication not in text, f"editions ledger must not fabricate sales language: {fabrication}"
    editions = ledger["editions"]
    assert len(editions) == 20
    assert all(ed["seed"] and ed["provenance"] for ed in editions)
    spatial = [ed for ed in editions if ed["kind"] == "spatial"]
    assert len(spatial) == 1
    assert spatial[0]["run"] == "studio.html?source=spatial"


def test_gallery_serves_the_editions_desk() -> None:
    page = (ROOT / "gallery.html").read_text(encoding="utf-8")
    assert 'id="editions"' in page
    assert "art/editions.json" in page
    assert "The editions desk." in page
    for scarcity in ("collected by", "minted", "sold out"):
        assert scarcity not in page.lower(), f"gallery must not imply sales that did not happen: {scarcity}"


def test_studio_wires_the_spatial_source() -> None:
    page = (ROOT / "studio.html").read_text(encoding="utf-8")
    assert 'data-source="spatial"' in page
    assert 'id="src-spatial"' in page
    assert 'id="sp-verdict"' in page
    studio = (ROOT / "system" / "studio.js").read_text(encoding="utf-8")
    assert './studio-spatial.js' in studio
    assert "spatialStatic" in studio
    loop = (ROOT / "system" / "studio-loop.js").read_text(encoding="utf-8")
    assert '"spatial"' in loop


def test_splat_lab_keeps_its_boundary_and_drops_the_credential_route() -> None:
    page = (ROOT / "gaussian-splats.html").read_text(encoding="utf-8")
    assert "No Gaussian-splat scene is being represented as finished" in page
    assert "credentials" not in page.lower() or "no credentials" in page.lower()
    assert "image-blaster" not in page, "the retired external route must not remain on the page"
    assert "studio.html?source=spatial" in page
    manifest = json.loads((ROOT / "art" / "gaussian-splats" / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["generator"]["route"] == "native"
    assert manifest["status"] == "SOURCE_PREPARED"
    assert manifest["outputs"] == []
