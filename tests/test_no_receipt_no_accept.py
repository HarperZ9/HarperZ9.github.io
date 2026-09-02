from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ESSAY = ROOT / "no-receipt-no-accept.html"
WRITING = ROOT / "writing.html"
SITEMAP = ROOT / "sitemap.xml"
LOADER = ROOT / "system" / "essay-loader.js"
PARTS_DIR = ROOT / "writing" / "no-receipt-no-accept"
ESSAY_PARTS = [PARTS_DIR / f"{index:02d}.md" for index in range(1, 10)]
SINGLE_MD = PARTS_DIR / "no-receipt-no-accept.md"
PDF = PARTS_DIR / "no-receipt-no-accept.pdf"
ESSAY_URL = "https://harperz9.github.io/no-receipt-no-accept.html"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def joined(paths: list[Path]) -> str:
    return "".join(read(path) for path in paths)


def test_no_receipt_pages_are_public_and_discoverable() -> None:
    for path in [ESSAY, WRITING, SITEMAP, LOADER, SINGLE_MD, PDF, *ESSAY_PARTS]:
        assert path.is_file(), path

    essay_shell = read(ESSAY)
    writing = read(WRITING)
    sitemap = read(SITEMAP)

    assert "<title>No Receipt, No Accept · Zain Dana Harper</title>" in essay_shell
    assert f'<link rel="canonical" href="{ESSAY_URL}">' in essay_shell
    assert f'<meta property="og:url" content="{ESSAY_URL}">' in essay_shell
    for part in ESSAY_PARTS:
        assert part.relative_to(ROOT).as_posix() in essay_shell
    assert "writing/no-receipt-no-accept/no-receipt-no-accept.pdf" in essay_shell
    assert "writing/no-receipt-no-accept/no-receipt-no-accept.md" in essay_shell
    assert 'href="no-receipt-no-accept.html"' in writing
    assert ESSAY_URL in sitemap

    # The article face follows the July 24 typographic revision.
    assert '"Times New Roman",Tinos,"Nimbus Roman No9 L","Liberation Serif",serif' in essay_shell

    # PDF is a real PDF, not a placeholder.
    assert PDF.read_bytes()[:5] == b"%PDF-"


def test_no_receipt_preserves_argument_and_voice() -> None:
    essay = joined(ESSAY_PARTS)

    for marker in (
        "a system is not trustworthy because the person who built it says it works.",
        "no receipt, no accept",
        "finding integration through abstraction",
        "I call it review debt",
        "ask for the witness, not the confidence",
        "verified, drift, or unverifiable",
        "The search boundary moved.",
        "The proof boundary did not move.",
        "A graph can kill a conjecture.",
        "when the machine makes the work ten times more productive, who gets the other nine",
        "keep the lineage, lose the label",
        "the planet is the ultimate external verifier",
        "fuck the little pipe",
        "I never climbed.",
        "the very real frustration that comes with working with family",
        "Ya boi is still broke.",
        "low-background steel",
        "no uplift claimed",
        "Selection is the new brushstroke",
        "the purpose of a tool is to return people to their time",
        "secure, not anxious",
        "count together",
        "who writes the rules, who profits from the verdict, who is allowed to check",
        "Verification without mercy is just surveillance with better epistemics",
        "The work should be able to condemn the worker.",
        "Somebody should check this too.",
        "I developed it with Claude Opus 4.8.",
    ):
        assert marker in essay, marker

    # The engines are named.
    for engine in ("gather", "crucible", "Mneme", "QuantaLang", "EMET"):
        assert engine in essay, engine

    # The register holds: no em-dashes anywhere in the published text.
    assert "\u2014" not in essay

    # Single-file edition carries the identical section set.
    single = read(SINGLE_MD)
    for heading in (
        "## 1. The rule",
        "## 13. The record eats itself",
        "## 25. Check this too",
        "## Process note",
    ):
        assert heading in essay and heading in single, heading


def test_no_receipt_pages_have_no_private_or_secret_markers() -> None:
    combined = read(ESSAY) + joined(ESSAY_PARTS) + read(SINGLE_MD)
    for marker in (
        "C:\\",
        "C:/",
        "Users\\",
        "PRIVATE KEY",
        "api_key",
        "password:",
        "token:",
        "secret:",
    ):
        assert marker not in combined
