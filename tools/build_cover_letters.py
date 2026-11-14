"""Build the cover letter PDF and DOCX files with the career artifact writers.

Two letters, each from its own reviewed source:

- cover-letter.html                  -> career/Zain-Dana-Harper-Cover-Letter.{pdf,docx}
- career/cover-letter-evaluation.md  -> career/Zain-Dana-Harper-Cover-Letter-Evaluation.{pdf,docx}

The writers are the ones build_career_artifacts.py uses for the resumes, so a
rebuild from the same source bytes and pinned dependencies gives the same bytes.
The rows for the first letter in career/career-artifacts.json are refreshed in
place. The template copy with placeholders (cover-letter-evaluation-template.md)
is never built.

    python tools/build_cover_letters.py            # build both
    python tools/build_cover_letters.py --check    # exit 1 if committed files differ
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import build_career_artifacts as B  # noqa: E402

MANIFEST = ROOT / "career" / "career-artifacts.json"
PAGE_STEM = "Zain-Dana-Harper-Cover-Letter"
EVAL_SOURCE = ROOT / "career" / "cover-letter-evaluation.md"
EVAL_STEM = "Zain-Dana-Harper-Cover-Letter-Evaluation"
WORD_LIMIT = 300


def markdown_blocks(path: Path) -> tuple[B.Block, ...]:
    """A heading line, then one paragraph per blank-line-separated block."""
    blocks = []
    for chunk in path.read_text(encoding="utf-8").replace("\r\n", "\n").split("\n\n"):
        text = " ".join(chunk.split())
        if not text:
            continue
        if text.startswith("# "):
            blocks.append(B.Block("h1", text[2:]))
        elif " | " in text and not blocks[1:]:
            blocks.append(B.Block("contact", text))
        else:
            blocks.append(B.Block("p", text))
    if not blocks or blocks[0].kind != "h1":
        raise ValueError(f"{path.name} has no heading")
    for banned in ("[COMPANY]", "[ROLE]", "—", "@"):
        if any(banned in block.text for block in blocks):
            raise ValueError(f"{path.name} contains {banned!r}")
    body = [b.text for b in blocks if b.kind == "p"]
    start = next(i for i, text in enumerate(body) if text.startswith("Dear "))
    end = next(i for i, text in enumerate(body) if text == "Zain Dana Harper")
    words = sum(len(text.split()) for text in body[start:end + 1])
    if words >= WORD_LIMIT:
        raise ValueError(f"{path.name} letter runs to {words} words; the limit is under {WORD_LIMIT}")
    return tuple(blocks)


def build(output: Path) -> dict[str, dict]:
    fixed = datetime.fromtimestamp(B.SOURCE_EPOCH, timezone.utc)
    rows = {}
    for stem, blocks in ((PAGE_STEM, B._read_blocks(ROOT / "cover-letter.html")),
                         (EVAL_STEM, markdown_blocks(EVAL_SOURCE))):
        B._build_pdf(output / f"{stem}.pdf", blocks)
        B._build_docx(output / f"{stem}.docx", blocks, fixed)
        for suffix in ("pdf", "docx"):
            path = output / f"{stem}.{suffix}"
            payload = path.read_bytes()
            text, pages = B._artifact_text(path)
            if pages is not None and pages != 1:
                raise ValueError(f"{path.name} runs to {pages} pages")
            rows[f"career/{path.name}"] = {
                "byte_length": len(payload), "sha256": B._sha256(payload), "page_count": pages,
                "extraction_sha256": B._sha256(B._normalized_extraction(text).encode("utf-8")),
            }
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        with tempfile.TemporaryDirectory() as tmp:
            rows = build(Path(tmp))
            stale = [name for name in rows
                     if (ROOT / name).read_bytes() != (Path(tmp) / Path(name).name).read_bytes()]
        for name in stale:
            print(f"stale: {name}", file=sys.stderr)
        print(f"Checked {len(rows)} cover letter files.")
        return 1 if stale else 0
    rows = build(ROOT / "career")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for row in manifest["artifacts"]:
        if row["path"] in rows:
            row.update(rows[row["path"]])
    B._write_json_atomic(MANIFEST, manifest)
    for name, row in rows.items():
        print(f"{name}: {row['byte_length']} bytes, sha256 {row['sha256'][:16]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
