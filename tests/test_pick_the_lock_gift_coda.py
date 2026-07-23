from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ESSAY = ROOT / "writing" / "pick-the-lock-for-everyone" / "06.md"
TALK = ROOT / "writing" / "pick-the-lock-for-everyone-talk" / "03.md"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_gift_coda_keeps_transformation_and_accountability_together() -> None:
    essay = read(ESSAY)
    talk = read(TALK)

    for marker in (
        "## The gift I want to leave",
        "Environment is the medium.",
        "I believe in you.",
        "I am not announcing an exit. I am here.",
        "The middleman can be a regular man too.",
        "Sincerity is not a receipt.",
        "That is what I want to leave behind.",
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
