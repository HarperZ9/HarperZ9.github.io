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
    for name in (
        "01.md", "02.md", "03.md", "04.md", "04b.md", "04c.md", "04d.md", "05.md", "06.md"
    )
]
TALK_PARTS = [
    ROOT / "writing" / "pick-the-lock-for-everyone-talk" / name
    for name in ("01.md", "02.md", "02b.md", "02c.md", "02d.md", "03.md")
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
    assert "writing/pick-the-lock-for-everyone/04d.md" in essay
    assert "writing/pick-the-lock-for-everyone-talk/02d.md" in talk
    assert ESSAY_URL in sitemap
    assert TALK_URL in sitemap


def test_pick_the_lock_preserves_voice_and_new_infrastructure_argument() -> None:
    essay = joined(ESSAY_PARTS)
    talk = joined(TALK_PARTS)

    for marker in (
        "I have never apologized.",
        "Prestige was not the dream. Acceptance was.",
        "That is not a respectable syllabus. It is the one I had.",
        "the same beautifully lit spirit exists somewhere in each of us.",
        "Culture is part of the explanation. It did not borrow my hands without permission.",
        "Maybe bipolar is the right word for some of that. Maybe it is not.",
        "The least I can do is turn the skills I developed while unlocking, cheating, avoiding, and improvising toward something that lowers a barrier instead of creating another victim.",
        "The black box I know best",
        "The graph does not care about your diploma",
        "Art after the archive",
        'Not "in the style of." A system built to explore the pressure underneath the style.',
        "A steward, not a thief",
        "That is the time dividend.",
        "Build beside the old world until it becomes unnecessary",
        "If we are fucked up, let us fuck up in the open",
        "Open access is not root access.",
        "Nobody should have to become the floor.",
        "Maybe we can all eat if we stop hoarding the food.",
        "What I owe the Mad-Happy Scientist",
        "The promise I can actually make",
        "Mental health belongs in this conversation",
        "I still prefer self-medication more often than I should.",
        "Assistance is not surrender. Autonomy is not immunity.",
        "I do a bit of both.",
        "I have made a home there before. I know the furniture.",
        "I believe everybody deserves redemption.",
        "Otherwise you are just a memory of yesterday.",
        "It should survive me.",
        "I will not call this \"human-written\"",
        "independent reconstruction",
    ):
        assert marker in essay

    for marker in (
        "Walk out. Stop. Let the room settle.",
        "Prestige was not the dream. Acceptance was.",
        "That is not a respectable syllabus. It is the one I had.",
        "the same beautifully lit spirit exists somewhere in each of us.",
        "Culture explains part of it. Culture did not borrow my hands without permission.",
        "Maybe bipolar is the right word for some of that. Maybe it is not.",
        "Shortcuts are my field.",
        'Not "in the style of." A new instrument built around the pressure beneath the style.',
        "I want a time dividend.",
        "A creative economy can be built beside it.",
        "If we are fucked up, let us fuck up in the open.",
        "Open access is not root access.",
        "Nobody should have to become the floor.",
        "Capable of building the table. Capable of hoarding everything on it.",
        "Pick the lock for everyone.",
        "I need to end with something less heroic.",
        "Mental health matters for everybody.",
        "I still prefer self-medication more often than I should.",
        "Help is not surrender. Autonomy is not immunity.",
        "The honest answer is that I do a bit of both.",
        "I have made a home there before. I know the furniture.",
        "I believe everybody deserves redemption.",
        "Otherwise you are just a memory of yesterday.",
        "Sit with it.",
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
