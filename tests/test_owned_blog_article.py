from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ARTICLE = ROOT / "the-summary-is-not-the-record.html"
WRITING = ROOT / "writing.html"
SITEMAP = ROOT / "sitemap.xml"
PUBLIC_URL = "https://harperz9.github.io/the-summary-is-not-the-record.html"
CLEANROOM_URL = "https://harperz9.github.io/demos/crucible-cleanroom/"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_owned_blog_article_is_public_and_discoverable() -> None:
    assert ARTICLE.is_file()
    html = read(ARTICLE)
    assert "<title>The Summary Is Not The Record</title>" in html
    assert f'<link rel="canonical" href="{PUBLIC_URL}">' in html
    assert f'<meta property="og:url" content="{PUBLIC_URL}">' in html
    assert "Proof-surface tooling for AI-assisted work" in html
    assert f'href="{CLEANROOM_URL}"' in html
    assert PUBLIC_URL in read(SITEMAP)
    assert 'href="the-summary-is-not-the-record.html"' in read(WRITING)


def test_owned_blog_article_preserves_review_boundaries() -> None:
    html = read(ARTICLE)
    for verdict in ("MATCH", "DRIFT", "UNVERIFIABLE"):
        assert verdict in html
    for boundary in (
        "not a safety certification",
        "not a compliance claim",
        "not an audit",
        "not an affiliation claim with Anthropic or AE Studio",
    ):
        assert boundary in html
    for prompt in (
        "I am looking for failure cases",
        "what exactly was checked",
        "Build with a model. Take nothing on faith.",
    ):
        assert prompt in html


def test_owned_blog_article_has_no_private_or_secret_markers() -> None:
    html = read(ARTICLE)
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
