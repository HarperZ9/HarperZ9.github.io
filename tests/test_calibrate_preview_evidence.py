"""Contracts for current, truthful Calibrate Pro public evidence."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PREVIEW = "media/demos/calibrate-pro/calibrate-pro-native-preview.png"


def test_build_products_uses_current_native_preview() -> None:
    page = (ROOT / "build-products.html").read_text(encoding="utf-8")
    for value in (
        "native workbench on current main",
        PREVIEW,
        "Simulated preview",
        "no hardware access",
        "no display changes",
        "https://github.com/HarperZ9/calibrate-pro/pull/12",
        "8ed0175",
        "https://harperz9.github.io/img/og/calibrate-pro.png",
    ):
        assert value in page

    assert "legacy interface" not in page.lower()
    assert "legacy visual design" not in page.lower()


def test_calibrate_preview_asset_is_a_1440_by_900_png() -> None:
    import hashlib

    from PySide6.QtGui import QImage

    image_path = ROOT / PREVIEW
    payload = image_path.read_bytes()
    assert payload[:8] == b"\x89PNG\r\n\x1a\n"
    assert hashlib.sha256(payload).hexdigest() == (
        "a693ed0150513209e683d44077c18e1260f730c85a35dadad421e45f00ca0792"
    )
    image = QImage(str(image_path))
    assert not image.isNull()
    assert (image.width(), image.height()) == (1440, 900)
    receipt = image_path.with_name("README.md").read_text(encoding="utf-8")
    assert "8ed017577b34c7a6d2bfe04a17a254f377ad7b7c" in receipt
    assert "A693ED0150513209E683D44077C18E1260F730C85A35DADAD421E45F00CA0792" in receipt


def test_overview_and_card_data_no_longer_advertise_legacy_ui() -> None:
    overview = (ROOT / "overview.html").read_text(encoding="utf-8")
    cards = (ROOT / "img" / "og" / "cards-data.js").read_text(encoding="utf-8")

    assert "native dark-room workbench" in overview
    assert "Legacy interface; modernization pending." not in overview
    assert '"role": "DISPLAY CALIBRATION / SAFE PREVIEW"' in cards
    assert "interface modernization is pending" not in cards.lower()


def test_calibrate_social_card_is_present() -> None:
    from PySide6.QtGui import QImage

    image_path = ROOT / "img" / "og" / "calibrate-pro.png"
    assert image_path.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"
    assert image_path.stat().st_size > 100_000
    image = QImage(str(image_path))
    assert not image.isNull()
    assert (image.width(), image.height()) == (1200, 630)
