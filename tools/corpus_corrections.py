"""Dated corrections for the two archived corpora that tools/render_corpus.py renders.

A corpus page reproduces a deposit with a permanent DOI, so its deposited text is never
edited. A correction is site prose instead: a pointer beside the passage it corrects and a
dated note in a Corrections section at the end of the page. Each entry names the
passage by a substring of the rendered block (it must match exactly one block) and gives
the note in the site's correction style. The batch date is set by
tools/correction_batch.py, which rewrites the leading date of these notes.
"""

from __future__ import annotations

NEWLINE = chr(10)

CORRECTIONS_OPENING = (
    " Dated corrections sit beside the passages they correct and are listed at the end."
    " They are site notes, and the deposited text stays as deposited."
)

CORRECTION_POINTER = (
    '<aside class="corpus-correction" aria-label="Correction"><p class="entry-note">'
    'A dated correction to this passage is listed under <a href="#corrections">Corrections</a>.</p></aside>'
)

CORRECTIONS: dict[str, list[dict]] = {
    "conferred-existence.html": [
        {
            "after": (
                "Therefore no one is ever truly, ultimately morally responsible.",
                "(i) You do what you do because of the way you are.",
            ),
            "note": (
                "3 October 2026, correction, the Basic Argument passages: Galen Strawson states the Basic Argument "
                'several times in "The Impossibility of Moral Responsibility" (1994): briefly on p. 5, in ten steps '
                "on pp. 5 to 7, and in a looser restatement on pp. 12 to 15. The five premises given here are a "
                'reconstruction; his numbering differs. In his own short version, "nothing can be causa sui" comes '
                "first. P. F. Strawson's \"Freedom and Resentment\" appeared in <i>Proceedings of the British "
                "Academy</i> 48 (1962): 187 to 211."
            ),
        },
    ],
    "witnessing-spine.html": [
        {
            "after": ("Three traditions that never met",),
            "note": (
                '3 October 2026, correction, section 3: earlier text said three traditions "never met" and reached '
                "the same view independently. That claim had no source, and it is withdrawn. Islam has a long history "
                "in Yorubaland, so contact between two of the three traditions is likely. The narrower claim stands: "
                "serious traditions have held people responsible without requiring them to be their own cause."
            ),
        },
        {
            "after": ("target-fixing vocabulary cannot fix the target of a two-place relation",),
            "note": (
                "3 October 2026, correction, section 3: earlier text said a one-place vocabulary cannot fix the target "
                "of a two-place relation. Behavior control also relates two parties, so that wording was wrong. The "
                "current claim is narrower: the address relation needs a second party who can answer and refuse, and "
                "a description built only from the role of a system to be adjusted has not been shown to fix it."
            ),
        },
    ],
}


def place_corrections(body: str, corrections: list[dict]) -> str:
    """Set a pointer beside each corrected passage and list the dated notes at the end."""
    if not corrections:
        return body
    blocks = body.split(NEWLINE)
    for fix in corrections:
        for needle in fix["after"]:
            hits = [i for i, block in enumerate(blocks) if needle in block]
            if len(hits) != 1:
                raise SystemExit(f"correction anchor must match one block, found {len(hits)}: {needle!r}")
            blocks.insert(hits[0] + 1, CORRECTION_POINTER)
    notes = [f'<p class="lead">{fix["note"]}</p>' for fix in corrections]
    blocks.extend(['<section id="corrections">', "<h2>Corrections</h2>", *notes, "</section>"])
    return NEWLINE.join(blocks)
