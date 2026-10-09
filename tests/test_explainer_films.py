"""The long explainer films: receipts, captions, sources, questions and page all agree.

Each film folder (media/explainers/<slug>/film.json) must carry its receipt, captions, timing,
sources and recall questions, and explainers.html must show the transcript, every source and
every question's quote word for word, so the page and the video cannot drift apart.
"""

import html
import json
import re
from pathlib import Path

from tools.explainer.film import render

ROOT = Path(__file__).resolve().parents[1]
FILMS = sorted(p.parent for p in (ROOT / "media" / "explainers").glob("*/film.json"))
PAGE = (ROOT / "explainers.html").read_text(encoding="utf-8")
TEXT = html.unescape(re.sub(r"<[^>]+>", " ", PAGE))
TEXT = re.sub(r"\s+", " ", TEXT)


def load(folder: Path, name: str):
    return json.loads((folder / name).read_text(encoding="utf-8"))


def test_there_are_films() -> None:
    assert FILMS, "no film.json under media/explainers"


def test_every_film_receipt_matches_its_files() -> None:
    for folder in FILMS:
        assert render.check(folder) == [], folder.name


def test_a_receipt_check_can_fail(tmp_path) -> None:
    folder = FILMS[0]
    rec = load(folder, "film.receipt.json")
    rec["outputs"][next(iter(rec["outputs"]))] = "0" * 64
    copy = tmp_path / folder.name
    copy.mkdir()
    for p in folder.iterdir():
        if p.is_file() and p.suffix != ".mp4":
            (copy / p.name).write_bytes(p.read_bytes())
    (copy / "film.receipt.json").write_text(json.dumps(rec), encoding="utf-8")
    assert render.check(copy), "a changed output hash must fail the check"


def test_captions_cover_every_sentence_in_order() -> None:
    for folder in FILMS:
        slug = load(folder, "film.json")["slug"]
        vtt = (folder / f"{slug}.vtt").read_text(encoding="utf-8")
        assert vtt.startswith("WEBVTT")
        spoken = " ".join(r["text"] for r in load(folder, "timing.json"))
        cues = " ".join(b.split("\n", 1)[1].replace("\n", " ") for b in vtt.split("\n\n")[1:] if "-->" in b)
        assert re.sub(r"\s+", " ", cues).strip() == re.sub(r"\s+", " ", spoken).strip(), slug


def test_timing_covers_the_script_and_flags_are_honest() -> None:
    for folder in FILMS:
        film, timing = load(folder, "film.json"), load(folder, "timing.json")
        script = " ".join(line for s in film["segments"] for line in s["lines"])
        assert " ".join(r["text"] for r in timing) == script
        rec = load(folder, "film.receipt.json")
        assert rec["narration"]["asr_check"]["flagged"] == sum(not r["accepted"] for r in timing)
        assert rec["narration"]["reproducible"] is False


def test_page_carries_transcript_sources_and_quotes() -> None:
    for folder in FILMS:
        film, ev = load(folder, "film.json"), load(folder, "evidence.json")["sources"]
        assert f'id="{film["slug"]}"' in PAGE
        for seg in film["segments"]:
            for line in seg["lines"]:
                assert line in TEXT, f"transcript line missing: {line[:50]}"
            for sid in seg.get("sources", []):
                assert ev[sid]["url"] in PAGE and ev[sid]["does_not_prove"] in TEXT, sid
        for item in load(folder, "recall.json")["items"]:
            assert item["source"]["ref"].startswith("explainers.html#")
            assert item["source"]["quote"] in TEXT, item["id"]
            key = next(c["text"] for c in item["choices"] if c["id"] == item["answer"])
            for m in item.get("misconceptions", {}).values():
                assert key.lower() not in m["note"].lower(), f"{item['id']}: a note gives the answer away"


def test_narration_is_labelled_as_synthesized() -> None:
    assert "synthesized version of the author's voice" in TEXT


def test_no_em_dashes_or_local_paths() -> None:
    for folder in FILMS:
        for name in ("film.json", "evidence.json", "recall.json"):
            body = (folder / name).read_text(encoding="utf-8")
            assert "—" not in body, f"{folder.name}/{name} has an em dash"
            assert not re.search(r"[A-Z]:[\\/]", body), f"{folder.name}/{name} has a local path"
    assert "—" not in PAGE
