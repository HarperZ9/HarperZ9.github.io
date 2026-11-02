"""Typeset the designed resumes and CV through BuildLang's BuildTeX path.

The ATS files (PDF, DOCX, text, Markdown) come from build_career_artifacts.py.
This script reads the same reviewed source, career/resume-source.json, writes
each document as buildlang.doc/v0, and sets it with the BuildTeX `press` theme:
the name blind-debossed and the aperture blind-embossed with a foil core,
lit on a paper ground, with the full text layer kept for search and copy.

    python tools/build_career_typeset.py --buildlang PATH/TO/buildlang

PATH/TO/buildlang is a checkout of HarperZ9/buildlang that has typeset/buildtex.
Outputs go to career/designed/: <stem>.pdf and <stem>.buildtex.json, the build
receipt with the layout facts (page count, overfull lines, embedded fonts,
reading order) and the external programs the build started.
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "career" / "resume-source.json"
OUT = ROOT / "career" / "designed"
FIT = [(9.6, 13.0), (9.3, 12.4), (9.0, 12.0)]  # body size and leading in points, theme size first
sys.path.insert(0, str(ROOT / "tools"))
from render_career_pages import expand  # noqa: E402


def ir_text(title: str, blocks: list[dict]) -> str:
    clean = lambda s: " ".join(s.replace("{", "{{").replace("}", "}}").split())
    lines = ["#buildlang.doc/v0", f"meta\ttitle\t{clean(title)}", "meta\tauthor\tZain Dana Harper", "theme\tpress"]
    for b in blocks:
        lines.append("block\tpagebreak\t" if b["kind"] == "pagebreak" else f"block\t{b['kind']}\t{clean(b['text'])}")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--buildlang", default=os.environ.get("BUILDLANG_CHECKOUT"), required=False)
    ap.add_argument("--only", help="one document stem")
    a = ap.parse_args()
    if not a.buildlang:
        ap.error("--buildlang PATH (or BUILDLANG_CHECKOUT) is required")
    typeset = pathlib.Path(a.buildlang) / "typeset"
    sys.path.insert(0, str(typeset))
    from buildtex.build import build  # noqa: E402

    src = json.loads(SOURCE.read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    failed = 0
    for doc in src["documents"]:
        if a.only and doc["stem"] != a.only:
            continue
        blocks = expand(doc["blocks"], src["groups"])
        ir = OUT / f"{doc['stem']}.doc.tsv"
        ir.write_text(ir_text(f"Zain Dana Harper | {doc['title']}", blocks), encoding="utf-8", newline="\n")
        try:
            # A one-page resume steps the body size down until it fits; the CV keeps the theme size.
            for size, lead in FIT if doc.get("page_target") == 1 else FIT[:1]:
                sets = [f"base.size={size}", f"base.leading={lead}"]
                r = build(str(ir), str(OUT / doc["stem"]), "press", sets, html=False)
                if r["facts"]["pages"] <= (doc.get("page_target") or 99):
                    break
        finally:
            ir.unlink()
        r["source"] = {"path": "career/resume-source.json", "document": doc["id"],
                       "sha256": __import__("hashlib").sha256(SOURCE.read_bytes().replace(b"\r\n", b"\n")).hexdigest()}
        r["outputs"] = {k: v for k, v in r["outputs"].items() if k.endswith(".pdf")}
        (OUT / f"{doc['stem']}.layout.json").unlink(missing_ok=True)
        (OUT / f"{doc['stem']}.buildtex.json").write_text(json.dumps(r, indent=1, ensure_ascii=False) + "\n",
                                                          encoding="utf-8", newline="\n")
        f = r["facts"]
        print(f"{doc['stem']}: {f['pages']} page(s), {len(f['overfull'])} overfull, "
              f"{len(f['fonts'])} fonts embedded={all(x['embedded'] for x in f['fonts'])}, "
              f"reading order {f['reading_order']}, external programs {r['external_programs'] or 'none'}")
        for bad in r["failed"]:
            print("  FAILED:", bad, file=sys.stderr)
        failed += bool(r["failed"])
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
