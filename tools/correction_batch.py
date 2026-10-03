"""One date for one batch of dated corrections.

The reference corrections of October 2026 touch fourteen pages. Each note opens with the
date the fix goes live, and that date must agree across the notes, the listings, the page
metadata, the feeds and the publication index. BATCH_DATE below is the single place it is
set. If the batch goes live on a different day, move every note to that day with:

    python tools/correction_batch.py --to 2026-10-03

The command rewrites the leading date of each note in the files listed here, the listing
and record dates, and the page metadata, and then updates BATCH_DATE in this file. It
then re-renders the Markdown-backed essays. Run the generators it prints afterwards so the
feeds, index, registry and home bundle follow.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

BATCH_DATE = "2026-10-03"

# Files whose notes open with the batch date, in the forms the site already uses:
# "2 October 2026, correction, ..." in essays and papers, "October 2, 2026: ..." in
# Who Knew First, and "Update, 2 October 2026: ..." beside a passage.
NOTE_FILES = (
    "who-pays-the-referees.html",
    "the-terms-for-telling.html",
    "who-knew-first.html",
    "no-receipt-no-accept.html",
    "writing/no-receipt-no-accept/09.md",
    "writing/no-receipt-no-accept/no-receipt-no-accept.md",
    "writing/pick-the-lock-for-everyone-v3/13.md",
    "writing/pick-the-lock-for-everyone/03.md",
    "writing/models-propose-oracles-dispose/03.md",
    "writing/models-propose-oracles-dispose/04.md",
    "research-conferred-existence.html",
    "research-conservation-of-faithfulness.html",
    "conferred-existence-essay.html",
    "conferred-existence.html",
    "witnessing-spine.html",
    "tools/corpus_corrections.py",
    "publications/data/records/the-number-has-a-vintage.json",
)
# Listings and records whose updated_at is the batch date.
DATED_JSON = (
    "publications/data/listings/who-knew-first.json",
    "publications/data/listings/who-pays-the-referees.json",
    "publications/data/listings/the-terms-for-telling.json",
    "publications/data/listings/no-receipt-no-accept.json",
    "publications/data/listings/pick-the-lock-for-everyone.json",
    "publications/data/listings/models-propose-oracles-dispose.json",
    "publications/data/listings/conferred-existence-essay.json",
    "publications/data/listings/conferred-existence.json",
    "publications/data/listings/witnessing-spine.json",
    "publications/data/records/the-number-has-a-vintage.json",
)
# Pages whose article:modified_time is the batch date.
MODIFIED_META = (
    "who-knew-first.html",
    "who-pays-the-referees.html",
    "the-terms-for-telling.html",
    "pick-the-lock-for-everyone.html",
)
GENERATORS = (
    "python tools/build_publications.py --records-dir publications/data/records",
    "node scripts/render-route-registry.mjs",
    "node scripts/render-site-index.mjs",
    "npm --prefix home run build (then re-pin the bundle and release fingerprint tests)",
)


def day_month_year(day: dt.date) -> str:
    return f"{day.day} {day:%B %Y}"


def month_day_year(day: dt.date) -> str:
    return f"{day:%B} {day.day}, {day.year}"


def note_patterns(day: dt.date) -> list[tuple[str, str]]:
    """Return (prefix, suffix) pairs that mark a note of this batch."""
    dmy, mdy = day_month_year(day), month_day_year(day)
    pairs = [(dmy, f", {kind}") for kind in ("correction", "clarification", "update", "smaller fixes")]
    pairs += [(f"Update, {dmy}", ":"), (f"<p>{mdy}", ":")]
    return pairs


def notes_in(text: str, day: dt.date) -> int:
    return sum(text.count(prefix + suffix) for prefix, suffix in note_patterns(day))


def move_notes(text: str, old: dt.date, new: dt.date) -> str:
    for (old_prefix, suffix), (new_prefix, _) in zip(note_patterns(old), note_patterns(new)):
        text = text.replace(old_prefix + suffix, new_prefix + suffix)
    return text


def rewrite(path: Path, change) -> None:
    text = path.read_bytes().decode("utf-8").replace("\r\n", "\n")
    path.write_bytes(change(text).encode("utf-8"))


def check(day: dt.date) -> list[str]:
    """Return the problems that would leave this batch on two dates."""
    problems = []
    for rel in NOTE_FILES:
        if notes_in((ROOT / rel).read_text(encoding="utf-8"), day) == 0:
            problems.append(f"{rel}: no note dated {day}")
    for rel in DATED_JSON:
        if json.loads((ROOT / rel).read_text(encoding="utf-8"))["updated_at"] != day.isoformat():
            problems.append(f"{rel}: updated_at is not {day}")
    for rel in MODIFIED_META:
        if f'<meta property="article:modified_time" content="{day.isoformat()}">' not in (ROOT / rel).read_text(encoding="utf-8"):
            problems.append(f"{rel}: article:modified_time is not {day}")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--to", help="move the batch to this date (YYYY-MM-DD)")
    parser.add_argument("--check", action="store_true", help="report notes or dates off the batch date")
    args = parser.parse_args()
    old = dt.date.fromisoformat(BATCH_DATE)
    if args.check or not args.to:
        problems = check(old)
        print("\n".join(problems) or f"every note and date in the batch reads {BATCH_DATE}")
        return 1 if problems else 0
    new = dt.date.fromisoformat(args.to)
    for rel in NOTE_FILES:
        rewrite(ROOT / rel, lambda text: move_notes(text, old, new))
    for rel in DATED_JSON:
        rewrite(ROOT / rel, lambda text: text.replace(f'"updated_at": "{old.isoformat()}"', f'"updated_at": "{new.isoformat()}"'))
    for rel in MODIFIED_META:
        rewrite(ROOT / rel, lambda text: text.replace(
            f'<meta property="article:modified_time" content="{old.isoformat()}">',
            f'<meta property="article:modified_time" content="{new.isoformat()}">'))
    rewrite(Path(__file__), lambda text: text.replace(f'BATCH_DATE = "{old.isoformat()}"', f'BATCH_DATE = "{new.isoformat()}"', 1))
    for page in ("pick-the-lock-for-everyone.html", "models-propose-oracles-dispose.html"):
        subprocess.run([sys.executable, str(ROOT / "tools/render_legacy_essays.py"), "--page", page], check=True, cwd=ROOT)
    print(f"moved the batch from {old} to {new}. Now run:")
    print("\n".join(f"  {command}" for command in GENERATORS))
    problems = check(new)
    print("\n".join(problems) or "check passed")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
