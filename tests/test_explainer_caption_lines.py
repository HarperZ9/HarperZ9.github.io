"""Film captions fit a 1280 px player without re-wrapping, and say exactly the narrated words.

Every cue of every film's VTT and SRT holds at most two lines of at most 42 characters, no line
of one or two words unless that is the whole sentence, and the words of all cues, in order, are
the words of timing.json byte for byte. The committed files are what the generator writes.

Controls feed the earlier 84-character layout and a one-word edit through the same checks and
require them to fail, so a passing run is not vacuous.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from tools.explainer.film import captions, render

ROOT = Path(__file__).resolve().parents[1]

def _live(folder: Path) -> bool:
    """A film folder whose film.json says "draft": true is scene code in review, with no narration,
    captions, receipt or page yet; the checks on shipped films skip it until it ships."""
    f = folder / "film.json"
    return not (f.is_file() and json.loads(f.read_text(encoding="utf-8")).get("draft") is True)


FILMS = sorted(p.parent for p in (ROOT / "media" / "explainers").glob("*/film.json") if _live(p.parent))
STAMP = re.compile(r"^(\d\d):(\d\d):(\d\d)[.,](\d\d\d) --> (\d\d):(\d\d):(\d\d)[.,](\d\d\d)$")


def seconds(h: str, m: str, s: str, ms: str) -> float:
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


def parse(text: str) -> list[tuple[float, float, list[str]]]:
    """(start, end, lines) for every cue of a VTT or SRT file."""
    out = []
    for block in text.replace("\r\n", "\n").strip().split("\n\n"):
        rows = block.split("\n")
        at = next((k for k, r in enumerate(rows) if STAMP.match(r)), None)
        if at is None:
            continue
        g = STAMP.match(rows[at]).groups()
        out.append((seconds(*g[:4]), seconds(*g[4:]), rows[at + 1:]))
    return out


def problems(cues: list[tuple[float, float, list[str]]], timing: list[dict]) -> list[str]:
    out = []
    sentences = {r["text"] for r in timing}
    for a, b, lines in cues:
        if not 1 <= len(lines) <= captions.LINES:
            out.append(f"{a:.2f}: {len(lines)} lines")
        for line in lines:
            if len(line) > captions.WIDTH:
                out.append(f"{a:.2f}: {len(line)} characters: {line!r}")
            if len(line.split()) < captions.MIN_WORDS and line not in sentences:
                out.append(f"{a:.2f}: orphan line {line!r}")
        if b <= a:
            out.append(f"{a:.2f}: empty span")
    said = " ".join(w for _, _, lines in cues for line in lines for w in line.split())
    spoken = " ".join(w for r in timing for w in r["text"].split())
    if said.encode("utf-8") != spoken.encode("utf-8"):
        out.append("caption words differ from the narration")
    for (a1, b1, _), (a2, _, _) in zip(cues, cues[1:]):
        if a2 < b1 - 0.0005:
            out.append(f"{a2:.2f}: overlaps the cue before")
    first, last = timing[0]["start"], timing[-1]["end"]
    if cues and (cues[0][0] < first - 0.0005 or cues[-1][1] > last + 0.0005):
        out.append("cues fall outside the narration")
    return out


def load(folder: Path):
    slug = json.loads((folder / "film.json").read_text(encoding="utf-8"))["slug"]
    timing = json.loads((folder / "timing.json").read_text(encoding="utf-8"))
    return slug, timing


def test_five_films() -> None:
    assert {f.name for f in FILMS} >= {"checking-cost", "passing-check", "rederive", "incentives", "visible-reasoning"}


def test_committed_captions_fit_and_keep_every_word() -> None:
    for folder in FILMS:
        slug, timing = load(folder)
        for ext in ("vtt", "srt"):
            cues = parse((folder / f"{slug}.{ext}").read_text(encoding="utf-8"))
            assert cues, f"{slug}.{ext}"
            found = problems(cues, timing)
            assert found == [], (f"{slug}.{ext}", found[:5])


def test_committed_captions_are_what_the_generator_writes(tmp_path) -> None:
    for folder in FILMS:
        slug, timing = load(folder)
        render.write_captions(tmp_path, slug, timing)
        for ext in ("vtt", "srt"):
            assert (tmp_path / f"{slug}.{ext}").read_bytes() == (folder / f"{slug}.{ext}").read_bytes(), f"{slug}.{ext}"


def test_vtt_and_srt_carry_the_same_cues() -> None:
    for folder in FILMS:
        slug, _ = load(folder)
        vtt = parse((folder / f"{slug}.vtt").read_text(encoding="utf-8"))
        srt = parse((folder / f"{slug}.srt").read_text(encoding="utf-8"))
        assert vtt == srt, slug


def test_a_split_sentence_shares_its_own_span() -> None:
    """Cues cut from one sentence start at its start, end at its end and meet edge to edge."""
    for folder in FILMS:
        _, timing = load(folder)
        cues = captions.cues(timing)
        k = 0
        for row in timing:
            parts = captions.layout(row["text"], row["end"] - row["start"])
            mine = cues[k:k + len(parts)]
            k += len(parts)
            assert abs(mine[0][0] - row["start"]) < 1e-9 and abs(mine[-1][1] - row["end"]) < 1e-9
            assert all(abs(x[1] - y[0]) < 1e-9 for x, y in zip(mine, mine[1:]))
        assert k == len(cues)


def test_number_phrases_stay_in_one_cue() -> None:
    lay = captions.layout("Soroush Vosoughi, Deb Roy and Sinan Aral followed about a hundred and twenty-six "
                          "thousand rumor cascades on Twitter, from 2006 to 2017.", 10.0)
    assert any("a hundred and twenty-six thousand" in line for cue in lay for line in cue), lay


def old_cues(timing: list[dict], width: int = 84) -> list[tuple[float, float, list[str]]]:
    """The layout these films shipped with before 2026-10-11: 84-character lines, even time split."""
    out = []
    for row in timing:
        parts, cur = [], ""
        for w in row["text"].split():
            if len(cur) + len(w) + 1 > width and cur:
                parts.append(cur)
                cur = w
            else:
                cur = f"{cur} {w}".strip()
        parts.append(cur)
        groups = [parts[k:k + 2] for k in range(0, len(parts), 2)]
        span = (row["end"] - row["start"]) / len(groups)
        out += [(row["start"] + k * span, row["start"] + (k + 1) * span, g) for k, g in enumerate(groups)]
    return out


def test_control_the_old_layout_fails() -> None:
    for folder in FILMS:
        _, timing = load(folder)
        found = problems(old_cues(timing), timing)
        assert any("characters" in p for p in found), folder.name


def test_control_an_orphan_line_fails() -> None:
    _, timing = load(FILMS[0])
    cues = [(a, b, lines.split("\n")) for a, b, lines in captions.cues(timing)]
    a, b, lines = next(c for c in cues if len(c[2]) == 2)
    words = " ".join(lines).split()
    bad = [c if c[2] is not lines else (a, b, [" ".join(words[:-1]), words[-1]]) for c in cues]
    assert any("orphan" in p for p in problems(bad, timing))


def test_control_a_changed_word_fails() -> None:
    _, timing = load(FILMS[0])
    cues = [(a, b, lines.split("\n")) for a, b, lines in captions.cues(timing)]
    a, b, lines = cues[3]
    cues[3] = (a, b, [lines[0].replace(lines[0].split()[0], lines[0].split()[0].upper(), 1)] + lines[1:])
    assert "caption words differ from the narration" in problems(cues, timing)
