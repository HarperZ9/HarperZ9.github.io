"""Contracts for withholding Calibrate Pro from public promotion."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
def test_build_products_withholds_calibrate_from_promotion() -> None:
    page = (ROOT / "build-products.html").read_text(encoding="utf-8")
    for value in (
        "Calibrate Pro: experimental, and excluded from promotion.",
        "some menu options are known not to work",
        "appearance only, not workflow readiness",
        "Do not rely on prior",
    ):
        assert value in page

    for value in (
        "native workbench on current main",
        "media/demos/calibrate-pro/calibrate-pro-native-preview.png",
        "https://harperz9.github.io/img/og/calibrate-pro.png",
        "Calibrate Pro v1.1.0",
    ):
        assert value not in page


def test_overview_and_card_data_mark_calibrate_experimental() -> None:
    overview = (ROOT / "overview.html").read_text(encoding="utf-8")
    cards = (ROOT / "img" / "og" / "cards-data.js").read_text(encoding="utf-8")

    assert "some menu options are known not to work" in overview
    assert ">Experimental</span>" in overview
    assert '"role": "EXPERIMENTAL / NOT PROMOTED"' in cards
    assert "End-to-end behavior and menu actions are not yet verified." in cards


def test_calibrate_social_card_is_not_referenced_by_public_pages() -> None:
    reference = "img/og/calibrate-pro.png"
    for page in ROOT.glob("*.html"):
        assert reference not in page.read_text(encoding="utf-8")
