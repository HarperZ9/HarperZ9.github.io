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
    ROOT / "writing" / "pick-the-lock-for-everyone-v3" / f"{index:02d}.md"
    for index in range(1, 14)
]
TALK_PARTS = [
    ROOT / "writing" / "pick-the-lock-for-everyone-talk" / name
    for name in ("01.md", "02.md", "02b.md", "02c.md", "02d.md", "02e.md", "03.md")
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
    for part in ESSAY_PARTS:
        assert part.relative_to(ROOT).as_posix() in essay
    for part in TALK_PARTS:
        assert part.relative_to(ROOT).as_posix() in talk
    assert ESSAY_URL in sitemap
    assert TALK_URL in sitemap


def test_canonical_essay_preserves_the_expanded_argument() -> None:
    essay = joined(ESSAY_PARTS)

    for marker in (
        "## The sentence that would not come out",
        "I have spent most of my life trying to finish that sentence.",
        "Shel Silverstein did not write toward me",
        "The breakbeat is a memory reorganized into motion.",
        "I have never apologized.",
        "The drinking and the drugs are not the center of this story.",
        "## The day the Earth Fair ended",
        "The Earth Fair was closed.",
        "## A childhood built as somebody else's stage",
        "My first encounter with anything sexual was abuse. I was five.",
        "The house came to school with me.",
        "## What travels",
        "It is *plasticity*.",
        "## The inheritance is yours too",
        "What adaptation are you still calling your personality?",
        "## The unconformity",
        "Geology is the archive after the author has lost the right of reply.",
        "The matter changes custody.",
        "I am not the source of the source of me.",
        "I am still one of the sources of what leaves me.",
        "## Forgiveness without deletion",
        "Forgiveness is not deleting the receipt.",
        "Self-destruction removes the person who owes the work.",
        "## The river",
        "the dream did not make disappearance beautiful.",
        "## The flywheel turned inward",
        "A model has weights, not a childhood.",
        "## The robe and the farm",
        "## The bundle breaks",
        "I call that review debt.",
        "## The graph and the poem",
        "## Build the instrument, not the imitation",
        "## What I owe the Mad-Happy Scientist",
        "## The promise I can actually make",
        "## The clock keeps moving",
        "Are you preparing for the coming world, or defending the last arrangement in which your identity still made sense?",
        "## What remains",
        "Will you be leaving behind something you would have wanted someone to leave behind for you?",
        "Pick the lock for everyone.",
        "Let the walls rot into soil.",
        "Open the fair.",
        "## Source and process note",
        "## Artistic, literary, musical, scientific, historical, and geological sources",
    ):
        assert marker in essay

    assert len(essay.split()) > 20_000
    # The profanity budget is deliberate, and it is now five rather than one. Four of the five
    # arrive together in a single passage that is ABOUT the word: it quotes the line the author
    # inherited ("ima fuck yo bitch"), names the property claim inside it, and then spends the
    # word three times redirecting it away from a person and onto the monopoly, the gate, and the
    # label. Removing them removes the argument, not the profanity. The fifth is the original
    # "Fuck the little pipe." The number stays pinned so a sixth use has to be argued for, and
    # the redirect lines are asserted below so the budget cannot be quietly respent elsewhere.
    assert essay.lower().count("fuck") == 5
    for redirect in (
        "Fuck the monopoly, not the woman.",
        "Fuck the gate, not the person trapped beside it.",
        "Fuck the little pipe.",
        "So I want to keep the defiance and kill the possession.",
    ):
        assert redirect in essay, redirect
    assert essay.lower().count("shit") <= 3
    assert "—" not in essay
    assert "–" not in essay


def test_old_style_reader_face_and_revision_metadata_are_public() -> None:
    essay = read(ESSAY)
    assert 'font-family:"Times New Roman",Tinos' in essay
    assert "img/og/telos.png" in essay
    assert 'content="2026-07-24"' in essay
    loader = read(LOADER)
    assert 'line.startsWith("### ")' in loader
    assert '<h3 id="${slug(label)}">' in loader
    assert ".article-body h3" in essay
    assert "Revised July 24, 2026" in essay


def test_art_follows_the_complete_essay_as_a_coda() -> None:
    essay = read(ESSAY)
    assert "Visual coda · chronological" in essay
    assert "The images follow the argument." in essay
    assert "visual sequence" in essay.lower()
    assert essay.index('class="article-body"') < essay.index("data-current-story-rail")


def test_spoken_edition_preserves_its_existing_delivery_markers() -> None:
    talk = joined(TALK_PARTS)
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
        "PRIVATE KEY", "api_key", "password:", "token:",
        "secret:", "authenticity_token", "fnid", "fnop",
    ):
        assert marker not in combined
