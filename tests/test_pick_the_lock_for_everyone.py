from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ESSAY = ROOT / "pick-the-lock-for-everyone.html"
TALK = ROOT / "pick-the-lock-for-everyone-talk.html"
LOADER = ROOT / "system" / "essay-loader.js"
WRITING = ROOT / "writing.html"
SITEMAP = ROOT / "sitemap.xml"
ESSAY_URL = "https://harperz9.github.io/pick-the-lock-for-everyone.html"
TALK_URL = "https://harperz9.github.io/pick-the-lock-for-everyone-talk.html"

ESSAY_PARTS = [
    ROOT / "writing" / "pick-the-lock-for-everyone" / name
    for name in ("01.md", "02.md", "03.md", "04.md", "04b.md", "04c.md", "05.md", "06.md")
]
TALK_PARTS = [
    ROOT / "writing" / "pick-the-lock-for-everyone-talk" / name
    for name in ("01.md", "02.md", "02b.md", "02c.md", "03.md")
]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def joined(paths: list[Path]) -> str:
    return "".join(read(path) for path in paths)


def test_pick_the_lock_pages_are_public_and_discoverable() -> None:
    for path in (ESSAY, TALK, LOADER, *ESSAY_PARTS, *TALK_PARTS):
        assert path.is_file(), path

    essay = read(ESSAY)
    talk = read(TALK)
    writing = read(WRITING)
    sitemap = read(SITEMAP)

    assert "<title>Pick the Lock for Everyone · Zain Dana Harper</title>" in essay
    assert "<title>Pick the Lock for Everyone · Spoken Edition</title>" in talk
    assert f'<link rel="canonical" href="{ESSAY_URL}">' in essay
    assert f'<link rel="canonical" href="{TALK_URL}">' in talk
    assert 'href="pick-the-lock-for-everyone.html"' in writing
    assert 'href="pick-the-lock-for-everyone-talk.html"' in writing
    assert ESSAY_URL in sitemap
    assert TALK_URL in sitemap


def test_pick_the_lock_preserves_voice_and_new_infrastructure_argument() -> None:
    essay = joined(ESSAY_PARTS)
    talk = joined(TALK_PARTS)

    for marker in (
        "I have never apologized.",
        "The black box I know best",
        "The graph does not care about your diploma",
        "Art after the archive",
        "A steward, not a thief",
        "That is the time dividend.",
        "Build beside the old world until it becomes unnecessary",
        "Maybe we can all eat if we stop hoarding the food.",
        "What I owe the Mad-Happy Scientist",
        "I will not call this \"human-written\"",
        "independent reconstruction",
    ):
        assert marker in essay

    for marker in (
        "Walk out. Stop. Let the room settle.",
        "Shortcuts are my field.",
        "I want a time dividend.",
        "A creative economy can be built beside it.",
        "Capable of building the table. Capable of hoarding everything on it.",
        "Pick the lock for everyone.",
    ):
        assert marker in talk


def test_pick_the_lock_pages_have_no_private_or_secret_markers() -> None:
    combined = read(ESSAY) + read(TALK) + joined(ESSAY_PARTS) + joined(TALK_PARTS)
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
        assert marker not in combined
