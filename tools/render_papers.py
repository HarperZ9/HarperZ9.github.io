"""Render the six philosophy papers from their approved Markdown sources.

    python tools/render_papers.py            # write the six pages
    python tools/render_papers.py --check    # exit 1 if a page differs from its source

Each source in writing/papers/ is the text the author approved for publication on
3 October 2026, with a front block that carries the title, byline, description and the
dated revision note. The page and the PDF in papers/ are both made from that one source
(tools/print_documents.py prints the PDF from the page), so neither can say something the
other does not. Where an earlier edition is deposited at Zenodo, the revision note links it
as the prior version: the deposit stays the citable record of that edition.
"""

from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools.paper_markdown import front_block, render
from tools.paper_page import EARLIER_CORRECTIONS, page

ROOT = Path(__file__).resolve().parents[1]

PAPERS: dict[str, dict] = {
    "research-arity-gap.html": {
        "source": "writing/papers/arity-gap.md", "kind": "Philosophy paper",
        "nav": "The Arity Gap", "pdf": "papers/arity-gap.pdf",
        "prior": ("10.5281/zenodo.22768629", "the edition of 15 September 2026"),
    },
    "research-forcing-argument.html": {
        "source": "writing/papers/forcing-argument.md", "kind": "Philosophy paper",
        "nav": "The Conferral Seam", "pdf": "papers/forcing-argument.pdf",
        "prior": ("10.5281/zenodo.22768809", "the edition of 15 September 2026"),
    },
    "research-self-given.html": {
        "source": "writing/papers/self-given.md", "kind": "Philosophy paper",
        "nav": "Self-Given, Not Self-Grounding", "pdf": "papers/self-given.pdf",
        "prior": ("10.5281/zenodo.22768919", "the edition of 15 September 2026"),
    },
    "research-conferred-existence.html": {
        "source": "writing/papers/conferred-existence.md", "kind": "Philosophy paper",
        "nav": "Conferred Existence", "pdf": "papers/conferred-existence-paper.pdf",
        "related": ("10.5281/zenodo.20773724", "the full Conferred Existence corpus, deposited 20 June 2026",
                    "conferred-existence.html"),
    },
    "research-conservation-of-faithfulness.html": {
        "source": "writing/papers/conservation-of-faithfulness.md", "kind": "Working paper",
        "nav": "Conservation of Faithfulness", "pdf": "papers/conservation-of-faithfulness.pdf",
        "prior": ("10.5281/zenodo.22768398", "the formal note of 15 September 2026"),
        "note_pdf": ("papers/faithfulness-conserved-quantity.pdf", "the four-page formal note"),
    },
    "research-witness-and-verification.html": {
        "source": "writing/papers/witness-and-verification.md", "kind": "Thesis",
        "nav": "Witness and Verification", "pdf": "papers/witness-and-verification.pdf",
    },
}


def build(name: str, spec: dict) -> str:
    fields, body = front_block((ROOT / spec["source"]).read_text(encoding="utf-8"))
    body = re.sub(r"\A\s*#\s+[^\n]*\n", "", body)  # the masthead carries the title
    return page(name, spec, fields, render(body.strip()), EARLIER_CORRECTIONS.get(name, []))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    stale = []
    for name, spec in PAPERS.items():
        text = build(name, spec)
        path = ROOT / name
        if args.check:
            if path.read_text(encoding="utf-8").replace("\r\n", "\n") != text:
                stale.append(name)
            continue
        path.write_bytes(text.encode("utf-8"))
        words = len(re.sub(r"<[^>]+>", " ", text).split())
        print(f"{name:46} {words:>7,} words")
    if stale:
        print("stale: " + ", ".join(stale))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
