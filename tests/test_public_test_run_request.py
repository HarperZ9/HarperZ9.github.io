from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INTAKE = ROOT / "test-run-request.html"
ARTICLE = ROOT / "the-summary-is-not-the-record.html"
WRITING = ROOT / "writing.html"
SITEMAP = ROOT / "sitemap.xml"
PUBLIC_URL = "https://harperz9.github.io/test-run-request.html"
CLEANROOM_URL = "https://harperz9.github.io/demos/crucible-cleanroom/"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_public_test_run_request_page_is_discoverable() -> None:
    assert INTAKE.is_file()
    html = read(INTAKE)
    assert "<title>Send A Public Proof-Surface Test Case</title>" in html
    assert f'<link rel="canonical" href="{PUBLIC_URL}">' in html
    assert f'<meta property="og:url" content="{PUBLIC_URL}">' in html
    assert PUBLIC_URL in read(SITEMAP)
    assert 'href="test-run-request.html"' in read(WRITING)
    assert 'href="test-run-request.html"' in read(ARTICLE)


def test_public_test_run_request_page_defines_safe_intake() -> None:
    html = read(INTAKE)
    for phrase in (
        "Good examples",
        "Do not send",
        "Useful format",
        "What I will try to return",
        "No form data is collected on this page",
    ):
        assert phrase in html
    for verdict in ("MATCH", "DRIFT", "UNVERIFIABLE"):
        assert verdict in html
    assert f'href="{CLEANROOM_URL}"' in html


def test_public_test_run_request_page_avoids_sensitive_intake() -> None:
    html = read(INTAKE)
    for phrase in (
        "Secrets, credentials, keys, tokens, cookies, or private URLs",
        "Private logs, customer data, client names",
        "Anything that requires me to access a private account",
    ):
        assert phrase in html
    for marker in (
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
    ):
        assert marker not in html
