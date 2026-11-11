"""The card checker must refuse the faults it exists to catch.

Each test hands it one made-up fault: a title that runs into an upright plate, two lines that
cross, type on a bright ground, type outside the safe area, a title too small for a preview.
A checker that passed any of these would pass a broken card. Widths come from a stand-in
measure, so the tests need no font files.
"""

import pytest

from tools.repo_art import card_check as cc


@pytest.fixture(autouse=True)
def fixed_width(monkeypatch):
    monkeypatch.setattr(cc, "measure", lambda text, face, size, tracking=0.0: 0.5 * size * len(text))


def line(text="Title", size=48, x=72, y=140, fill="#e6e1d6", role="title"):
    return {"text": text, "face": "grotesk-semibold", "size": size, "x": x, "y": y, "fill": fill,
            "tracking": 0.0, "role": role}


def dark(_box):
    return [0.001] * 50


def test_a_clean_card_has_no_faults():
    runs = [line(), line("Byline", 26, y=538, role="byline")]
    assert cc.check(runs, None, dark)["faults"] == []


def test_a_title_that_reaches_the_plate_is_a_fault():
    long = line("Dore-munchausen-illustration.")          # 29 letters at 48 px: 696 px wide from x 72
    assert cc.geometry_faults([long], None) == []          # fits a card with no plate
    faults = cc.geometry_faults([long], 500)               # a 500 px plate leaves a column to x 676
    assert len(faults) == 1 and "past its column" in faults[0]


def test_two_lines_that_cross_are_a_fault():
    faults = cc.geometry_faults([line(y=140), line("Dek", 26, y=150, role="dek")], None)
    assert any("cross" in f for f in faults)


def test_type_outside_the_safe_area_is_a_fault():
    assert any("safe area" in f for f in cc.geometry_faults([line(y=620)], None))


def test_type_on_a_bright_ground_is_a_fault():
    faults, lowest = cc.contrast_faults([line()], lambda _box: [0.5] * 50)
    assert len(faults) == 1 and lowest < cc.FLOOR


def test_one_stray_bright_pixel_does_not_decide_contrast():
    faults, _ = cc.contrast_faults([line()], lambda _box: [0.001] * 999 + [1.0])
    assert faults == []


def test_a_bright_patch_under_the_type_does_decide_contrast():
    faults, _ = cc.contrast_faults([line()], lambda _box: [0.001] * 900 + [1.0] * 100)
    assert len(faults) == 1


def test_contrast_matches_the_wcag_end_points():
    assert cc.contrast(cc.luminance((255, 255, 255)), cc.luminance((0, 0, 0))) == pytest.approx(21.0)
    assert cc.contrast(cc.luminance((119, 119, 119)), cc.luminance((255, 255, 255))) == pytest.approx(4.48, abs=0.01)


def test_a_title_too_small_for_a_preview_is_a_fault():
    assert cc.thumb_faults([line(size=28)]) != []
    assert cc.thumb_faults([line(size=44)]) == []


def test_two_pictures_that_differ_by_a_small_part_are_flagged_as_the_same():
    base = bytes([10] * 300)
    near = bytes([10] * 290 + [200] * 10)          # one small part changed: about 2.5 percent
    far = bytes([10] * 150 + [200] * 150)          # half the picture changed
    family = {"a": "plot", "b": "plot", "c": "plot"}
    pairs = cc.sameness({"a": base, "b": near, "c": far}, family)
    assert [p["cards"] for p in pairs] == [["a", "b"]]
    assert 2.0 < pairs[0]["difference"] < cc.SAME


def test_the_same_picture_in_two_families_is_not_flagged():
    same = bytes([40] * 300)
    assert cc.sameness({"a": same, "b": same}, {"a": "plot", "b": "strip"}) == []
    assert cc.sameness({"a": same, "b": same}, {"a": "plot", "b": "plot"})[0]["difference"] == 0


def test_nearest_reports_the_closest_pair_in_each_family():
    halves = {"a": bytes([0] * 100), "b": bytes([255] * 100), "c": bytes([0] * 50 + [255] * 50)}
    assert cc.nearest(halves, {"a": "map", "b": "map", "c": "map"}) == {"map": 50.0}
