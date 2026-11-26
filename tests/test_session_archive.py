from __future__ import annotations

import ast
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "art" / "session-archive" / "manifest.json"
PAGE = ROOT / "session-archive.html"
SCRIPT = ROOT / "system" / "session-archive.js"


def manifest() -> dict:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def test_the_archive_publishes_the_whole_body_of_work() -> None:
    """The sequence page shows seventeen chosen works. This shows all of them.

    Publishing only the chosen ones makes the choosing invisible, and the choosing is most of the
    authorship, so the archive is published whole rather than curated down.
    """
    assert PAGE.is_file() and SCRIPT.is_file()
    m = manifest()
    works = m["works"]
    assert len(works) == m["counts"]["works"] > 100, "the archive is the whole body, not a selection"
    ids = [w["id"] for w in works]
    assert len(set(ids)) == len(ids), "no work appears twice"
    kinds = {w["kind"] for w in works}
    assert kinds <= {"single", "collage"}


def test_every_work_carries_the_hash_of_what_it_came_from() -> None:
    """The chain from the session archive to this page has to be checkable, not trusted."""
    m = manifest()
    for w in m["works"]:
        src = w["source_asset"]
        for key in ("name", "archive", "png_sha256", "png_bytes"):
            assert src.get(key), f"{w['id']}: source_asset.{key} missing"
        assert len(src["png_sha256"]) == 64

        thumb = ROOT / w["thumb"]
        assert thumb.is_file(), w["thumb"]
        assert hashlib.sha256(thumb.read_bytes()).hexdigest() == w["thumb_sha256"], \
            f"{w['thumb']} drifted from its recorded hash"

        full = ROOT / w["full"]
        assert full.is_file(), w["full"]
        # Works that are also Current Story plates reuse that file rather than shipping the same
        # pixels twice, so they carry no separate hash of their own here.
        if "full_sha256" in w:
            assert hashlib.sha256(full.read_bytes()).hexdigest() == w["full_sha256"], \
                f"{w['full']} drifted from its recorded hash"
        else:
            assert w.get("also_published_as"), f"{w['id']}: reused file must say where it is published"


def test_the_reference_collage_is_excluded_and_the_exclusion_is_stated() -> None:
    """One generated collage reproduces the inspiration images supplied to the session.

    Those are other people's artwork. It is excluded, and the manifest says which file and why,
    because a silent omission from an archive that calls itself whole is a false claim.
    """
    m = manifest()
    assert m["counts"]["excluded"] >= 1
    excluded = m["excluded_items"]
    assert excluded and all(e.get("name") and e.get("why") for e in excluded)
    assert any("inspiration" in e["why"] or "third-party" in e["why"] for e in excluded)
    names = {w["source_asset"]["name"] for w in m["works"]}
    for e in excluded:
        assert e["name"] not in names, f"{e['name']} is excluded but still published"
    page = PAGE.read_text(encoding="utf-8")
    assert "other" in page and "people" in page, "the page states the exclusion in its own words"


def test_the_page_stays_cheap_for_a_hundred_and_sixty_five_works() -> None:
    """58MB of full-size work must not arrive because someone opened the page."""
    js = SCRIPT.read_text(encoding="utf-8")
    assert 'loading = "lazy"' in js or 'im.loading = "lazy"' in js, "thumbnails load lazily"
    # The grid must render thumbnails, never the full copies. Checked against the cell builder
    # itself, which is the only place a grid image is assigned a source.
    cell = js[js.index("function cellFor"):js.index("function layout")]
    assert "im.src = w.thumb" in cell, "the grid draws thumbnails"
    assert "w.full" not in cell, "the grid must not load full copies"
    m = manifest()
    thumbs = sum(w["thumb_bytes"] for w in m["works"])
    assert thumbs < 12 * 1024 * 1024, f"thumbnail payload too heavy: {thumbs/1024/1024:.1f}MB"
    for w in m["works"]:
        assert max(w["thumb_dimensions"]) <= 420, f"{w['id']}: thumbnail is not a thumbnail"


def test_the_archive_and_the_sequence_point_at_each_other() -> None:
    """Someone landing on either page should be able to find the other."""
    page = PAGE.read_text(encoding="utf-8")
    assert "current-story.html" in page
    m = manifest()
    shared = [w for w in m["works"] if w.get("also_published_as")]
    assert shared, "works published in both places say so"
    for w in shared:
        assert w["full"].startswith("art/current-story/"), "a shared work reuses the sequence's file"


TONES = ("dark", "mid", "luminous")
FAMILIES = ("monochrome", "warm", "cool")


def percentile(values: list[float], p: float) -> float:
    """Linear-interpolated percentile, matching the convention the measuring pass used."""
    s = sorted(values)
    k = (len(s) - 1) * p / 100
    lo = int(k)
    hi = min(lo + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def test_every_work_carries_its_own_measurement() -> None:
    """Publishing all 165 makes the count honest; it does not make the range visible.

    Every work is measured on the pixels actually delivered here, so the orderings sort on a
    number rather than on a feeling, and so a visitor can recompute any of it from the manifest.
    """
    m = manifest()
    for w in m["works"]:
        ms = w.get("measure")
        assert ms, f"{w['id']}: not measured"
        assert 0.0 <= ms["lightness"] <= 1.0, f"{w['id']}: lightness out of range"
        assert 0.0 <= ms["contrast"] <= 1.0, f"{w['id']}: contrast out of range"
        assert ms["chroma"] >= 0.0
        assert 0.0 <= ms["hue"] < 360.0
        assert ms["tone"] in TONES and ms["family"] in FAMILIES


def test_the_stated_range_is_what_the_measurements_say() -> None:
    """The range readout is a claim about the corpus. It has to survive recomputation."""
    m = manifest()
    r = m["range"]
    light = [w["measure"]["lightness"] for w in m["works"]]
    chroma = [w["measure"]["chroma"] for w in m["works"]]
    assert r["lightness"]["min"] == round(min(light), 4)
    assert r["lightness"]["max"] == round(max(light), 4)
    assert r["lightness"]["median"] == round(percentile(light, 50), 4)
    assert r["chroma"]["min"] == round(min(chroma), 2)
    assert r["chroma"]["max"] == round(max(chroma), 2)
    for tone in TONES:
        counted = sum(1 for w in m["works"] if w["measure"]["tone"] == tone)
        assert r["tone_counts"][tone] == counted, f"{tone} band count is not what the works say"
    for fam in FAMILIES:
        counted = sum(1 for w in m["works"] if w["measure"]["family"] == fam)
        assert r["family_counts"][fam] == counted, f"{fam} count is not what the works say"
    assert sum(r["tone_counts"].values()) == sum(r["family_counts"].values()) == m["counts"]["works"]


def test_the_bands_are_the_corpus_own_terciles() -> None:
    """55 dark, 55 mid, 55 luminous is a result, not a target.

    The cuts are terciles of measured lightness. If a future pass replaces them with chosen
    numbers, the bands stop being a measurement and this fails.
    """
    m = manifest()
    r = m["range"]
    light = [w["measure"]["lightness"] for w in m["works"]]
    assert abs(r["lightness"]["dark_below"] - percentile(light, 33)) < 5e-4
    assert abs(r["lightness"]["luminous_above"] - percentile(light, 67)) < 5e-4
    lo, hi = r["lightness"]["dark_below"], r["lightness"]["luminous_above"]
    for w in m["works"]:
        ms = w["measure"]
        want = "dark" if ms["lightness"] < lo else ("luminous" if ms["lightness"] > hi else "mid")
        assert ms["tone"] == want, f"{w['id']}: banded {ms['tone']}, measures {want}"
        assert ms["family"] == ("monochrome" if ms["chroma"] < r["chroma"]["monochrome_below"]
                               else ms["family"])
    assert r.get("method"), "the range has to say how it was measured"


def test_the_page_shows_the_range_not_only_the_count() -> None:
    """A count says how much there is. The range says how far it goes, which is the harder claim."""
    page = PAGE.read_text(encoding="utf-8")
    js = SCRIPT.read_text(encoding="utf-8")
    assert "data-archive-range" in page, "the range readout needs somewhere to land"
    assert "data-archive-order" in page, "the ordering controls need somewhere to land"
    assert "renderRange" in js and "function ribbon" in js
    for key in ("spectrum", "tone", "colour", "kind", "archived"):
        assert f"{key}:" in js, f"the {key} ordering is missing"
    # A band heading states its own count, so the grid beneath it can be counted against it.
    assert "buckets.get(k).length" in js
    # The ramp runs from near-black to near-white, so the curve over it needs a halo to stay
    # legible at both ends. Without it the low third of the range reads as an empty strip.
    assert "arc-ribbon-halo" in js and "arc-ribbon-halo" in page


def test_the_published_measurements_can_be_recomputed_from_the_pixels() -> None:
    """The range is only a receipt if the pass that produced it ships and still agrees.

    This asserts the tool exists and that its thresholds are the ones the manifest reports. The
    pixel-level recomputation itself is ``python tools/measure_archive.py --check``, which needs
    numpy and pillow and so runs on demand rather than in CI.
    """
    tool = ROOT / "tools" / "measure_archive.py"
    assert tool.is_file(), "the measuring pass has to ship with the numbers it produced"
    # Read the constants out of the source rather than importing it: the tool needs numpy and
    # pillow, and this check has to run wherever pytest does.
    consts: dict[str, object] = {}
    for node in ast.parse(tool.read_text(encoding="utf-8")).body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 \
                and isinstance(node.targets[0], ast.Name):
            try:
                consts[node.targets[0].id] = ast.literal_eval(node.value)
            except ValueError:
                pass
    r = manifest()["range"]
    assert consts["MONOCHROME_BELOW"] == r["chroma"]["monochrome_below"]
    assert consts["DARK_PERCENTILE"] == 33 and consts["LUMINOUS_PERCENTILE"] == 67
    assert consts["METHOD"] == r["method"], \
        "the manifest's stated method must be the method the tool implements"


def test_the_grid_container_is_not_itself_a_grid() -> None:
    """layout() puts one or more .arc-grid children into this element.

    When the container also carried .arc-grid the inner grids became single grid items and the
    whole archive rendered as one column, so this stays asserted rather than remembered.
    """
    page = PAGE.read_text(encoding="utf-8")
    i = page.index("data-archive-grid")
    tag = page[page.rindex("<", 0, i):page.index(">", i) + 1]
    assert "arc-grid" not in tag, f"the grid container must not be a grid itself: {tag}"


def test_the_viewer_walks_the_order_on_screen() -> None:
    """Sorting by light and then arrowing into an unrelated work contradicts the chosen ordering."""
    js = SCRIPT.read_text(encoding="utf-8")
    assert "viewer.setSequence(shown)" in js, "layout must hand the display order to the viewer"
    assert "viewer.open(position)" in js, "a cell opens at its position in the display order"


def test_manifest_fetches_are_version_stamped() -> None:
    """A force-cache fetch with no version stamp is a permanent stale read.

    Both manifests are fetched with ``cache: "force-cache"``, which is right for a file that
    rarely changes and wrong the moment it does: a visitor who loaded the page before the plates
    were recovered keeps their cached manifest and never sees the higher-resolution copies. This
    repo already applies the same rule to the stylesheet; a data manifest that changes shape
    earns it too.
    """
    for script, path in ((SCRIPT, "art/session-archive/manifest.json"),
                         (ROOT / "system" / "current-story.js", "art/current-story/manifest.json")):
        js = script.read_text(encoding="utf-8")
        assert "force-cache" in js, f"{script.name}: expected a cached manifest fetch"
        assert f'{path}?v=' in js, f"{script.name}: the manifest fetch needs a version stamp"
