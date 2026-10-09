"""Films drawn by raw-native's Motion layer: scene, vendored engine, sound track and page agree.

A film folder with film.scene.mjs is rendered from that scene (tools/explainer/film/motion.py)
and also plays live on explainers.html. These checks hold the pieces together: the scene imports
one vendored engine folder that exists, the receipt hashes the scene code and the sound track the
live version plays, the page offers the live version for exactly those films, and the scene adds
no claim the script does not make.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILMS = sorted(p.parent for p in (ROOT / "media" / "explainers").glob("*/film.scene.mjs"))
PAGE = (ROOT / "explainers.html").read_text(encoding="utf-8")
IMPORT = re.compile(r'"(?:\.\./)+raw-native/(web-[0-9a-f]{7})/motion/[a-z-]+\.mjs"')


def scene_files(folder: Path) -> list[Path]:
    return [folder / "film.scene.mjs", *sorted((folder / "scene").glob("*.mjs"))]


def test_there_is_a_motion_film() -> None:
    assert FILMS, "no film.scene.mjs under media/explainers"


def test_scene_imports_one_vendored_engine_that_exists() -> None:
    for folder in FILMS:
        engines = {m for f in scene_files(folder) for m in IMPORT.findall(f.read_text(encoding="utf-8"))}
        assert len(engines) == 1, f"{folder.name}: scene imports {sorted(engines)}"
        eng = ROOT / "media" / "raw-native" / engines.pop()
        for name in ("raw-gpu.mjs", "threads.mjs", "threads.wgsl", "motion/player.mjs", "motion/renderer.mjs", "motion/capture.html"):
            assert (eng / name).is_file(), f"{eng.name}/{name} is missing"


def test_receipt_covers_scene_code_and_the_live_sound_track() -> None:
    for folder in FILMS:
        rec = json.loads((folder / "film.receipt.json").read_text(encoding="utf-8"))
        code = rec["render_code"]
        for f in scene_files(folder):
            assert str(f.relative_to(ROOT)).replace("\\", "/") in code, f"{f.name} is not in the receipt"
        slug = folder.name
        assert f"{slug}.m4a" in rec["outputs"] and f"{slug}.mp4" in rec["outputs"]
        assert "Motion" in rec["toolchain"]["renderer"]


def test_page_offers_the_live_version_for_motion_films_only() -> None:
    live = set(re.findall(r'data-motion-film data-film="([a-z0-9-]+)"', PAGE))
    assert live == {f.name for f in FILMS}
    assert 'src="system/explainer/motion-film.mjs?v=' in PAGE


def test_scene_text_on_screen_is_from_the_script_or_its_sources() -> None:
    """Every number drawn as text in the scene appears in the film's script or sources."""
    for folder in FILMS:
        film = (folder / "film.json").read_text(encoding="utf-8")
        ev = (folder / "evidence.json").read_text(encoding="utf-8")
        allowed = film + ev
        for f in scene_files(folder):
            body = f.read_text(encoding="utf-8")
            for s in re.findall(r'text\("([^"$`]+)"', body):
                for num in re.findall(r"\d[\d,]*(?:\.\d+)?%?", s):
                    plain = num.replace(",", "")
                    assert num in allowed or plain in allowed, f"{f.name}: {num!r} in {s!r} is in neither the script nor the sources"


def test_no_em_dashes_or_local_paths_in_scene_code() -> None:
    for folder in FILMS:
        for f in [*scene_files(folder), folder / "score.json"]:
            body = f.read_text(encoding="utf-8")
            assert "—" not in body, f"{f.name} has an em dash"
            assert not re.search(r"[A-Z]:[\\/]", body), f"{f.name} has a local path"


def test_score_cues_fall_inside_the_film() -> None:
    for folder in FILMS:
        rec = json.loads((folder / "film.receipt.json").read_text(encoding="utf-8"))
        cues = json.loads((folder / "score.json").read_text(encoding="utf-8"))
        assert all(0 <= t < rec["seconds"] for t in cues["bells"])
        assert all(0 <= a < b <= rec["seconds"] for a, b in cues["swells"])


def test_release_media_on_the_page_exists_and_matches_its_manifest() -> None:
    """Release media (media/releases/<repo>/<tag>/<scene>/) is linked from the page, and every
    file its manifest lists is present with that hash, except the 4K master kept on the release."""
    import hashlib
    folders = sorted(p.parent for p in (ROOT / "media" / "releases").glob("*/*/*/media.json"))
    assert folders, "no release media"
    for folder in folders:
        rel = str(folder.relative_to(ROOT)).replace("\\", "/")
        assert f'href="{rel}/index.html"' in PAGE, rel
        m = json.loads((folder / "media.json").read_text(encoding="utf-8"))
        for name, digest in m["files"].items():
            if name.endswith("-2160p.mp4"):
                continue
            assert hashlib.sha256((folder / name).read_bytes()).hexdigest() == digest, f"{rel}/{name}"
