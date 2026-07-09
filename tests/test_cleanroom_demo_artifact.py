from hashlib import sha256
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "demos" / "crucible-cleanroom"
EXPECTED_ZIP_SHA256 = "2D4E819E4032F07E3A54D35AF2DC78161C1D2F04C43F89C26B56878D6377D1F1"
PUBLIC_URL = "https://harperz9.github.io/demos/crucible-cleanroom/"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_cleanroom_demo_is_staged_as_public_site_artifact() -> None:
    assert (DEMO / "index.html").is_file()
    assert (DEMO / "README.md").is_file()
    assert (DEMO / "crucible-cleanroom-demo.zip").is_file()
    assert (DEMO / "crucible-cleanroom-demo" / "bundle" / "spec.json").is_file()
    assert (DEMO / "crucible-cleanroom-demo" / "bundle" / "run.json").is_file()
    assert (DEMO / "crucible-cleanroom-demo" / "bundle" / "report.md").is_file()
    assert (DEMO / "crucible-cleanroom-demo" / "bundle" / "review.md").is_file()

    zip_hash = sha256((DEMO / "crucible-cleanroom-demo.zip").read_bytes()).hexdigest().upper()
    assert zip_hash == EXPECTED_ZIP_SHA256

    html = read(DEMO / "index.html")
    assert EXPECTED_ZIP_SHA256 in html
    assert "MATCH" in html
    assert "DRIFT" in html
    assert "UNVERIFIABLE" in html
    assert PUBLIC_URL in read(ROOT / "sitemap.xml")
    assert "demos/crucible-cleanroom/" in read(ROOT / "crucible.html")


def test_cleanroom_demo_has_no_private_or_secret_markers() -> None:
    markers = (
        "C:\\",
        "C:/",
        "Users\\",
        "PRIVATE KEY",
        "api_key",
        "password:",
        "token:",
        "secret:",
        "authenticity_token",
        "fnid",
        "fnop",
    )
    scanned_suffixes = {".html", ".md", ".json"}
    for path in DEMO.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in scanned_suffixes:
            continue
        text = read(path)
        for marker in markers:
            assert marker not in text, f"{marker!r} leaked in {path.relative_to(ROOT)}"
