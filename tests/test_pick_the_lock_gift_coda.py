from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ESSAY_PARTS = [
    ROOT / "writing" / "pick-the-lock-for-everyone-v3" / f"{index:02d}.md"
    for index in range(1, 14)
]
TALK = ROOT / "writing" / "pick-the-lock-for-everyone-talk" / "03.md"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_gift_coda_keeps_transformation_and_accountability_together() -> None:
    essay = "".join(read(path) for path in ESSAY_PARTS)
    talk = read(TALK)

    for marker in (
        "## The promise I can actually make",
        "I am done using annihilation as evidence that I understand the harm.",
        "I am not asking to be seen as good.",
        "I am trying to become answerable.",
        "Environment is the medium.",
        "I believe in people who cannot currently believe in themselves.",
        "Redemption means the record does not have to become the rest of a life.",
        "As a handrail.",
        "It should survive me.",
        "## The clock keeps moving",
        "The clock keeps ticking.",
    ):
        assert marker in essay

    for marker in (
        "[Stay plain. This is not a savior speech.]",
        "Environment is the medium, not an acquittal.",
        "I believe in you.",
        "I am not announcing an exit. I am here.",
        "The middleman can be a regular man too.",
        "Sincerity is not a receipt.",
        "The gift is the structure, not the suffering.",
    ):
        assert marker in talk
