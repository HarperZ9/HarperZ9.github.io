"""The findings pages and their research records (scripts/record-findings.mjs, scripts/build-findings.mjs).

Each published finding has a research record that fits research-record/1, a page built from it, and its PDF and
BuildTeX source offered as downloads. Every claim mark on a page opens a trace that exists; every term's first use
links to its glossary entry, and the entry links back; every link to a finding carries its standing flag; a refuted
or retracted finding redirects; the index counts the honest nulls. No generated page carries an em dash or a local
path. The schema is checked here by a reader written apart from the builder's own (scripts/findings-schema.mjs), so a
bug in one does not pass a record in both.
"""

import hashlib
import json
import re
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
F = ROOT / "findings"
PAGES = json.loads((F / "pages.json").read_text("utf-8"))["pages"]
FINDINGS = [p for p in PAGES if p.get("id")]
RECORDS = {p.name.removesuffix(".json"): json.loads(p.read_text("utf-8")) for p in (F / "records").glob("F*.json")}
LEDGER = json.loads((F / "data" / "ledger.json").read_text("utf-8"))
LOCAL = re.compile(r"(?<![A-Za-z{])[A-Za-z]:[\\/](?![\\/])|/Users/|mission-control|\.scratch")
SEVERITY = ["retracted", "refuted", "questioned", "narrowed", "superseded", "extended", "held"]
WORD = {"held": "held", "extended": "extended", "narrowed": "narrowed in part", "questioned": "questioned",
        "refuted": "refuted", "retracted": "retracted", "superseded": "superseded", "none": "no later treatment"}


def page(entry: dict) -> str:
    return (ROOT / entry["path"]).read_text("utf-8")


def check(schema: dict, value, root: dict, where: str, errs: list) -> None:
    """A JSON Schema reader for the keywords research-record/1 uses."""
    if "$ref" in schema:
        return check(root["$defs"][schema["$ref"].split("/")[-1]], value, root, where, errs)
    kinds = {"object": dict, "array": list, "string": str, "integer": int, "boolean": bool}
    if "type" in schema and not (isinstance(value, kinds[schema["type"]]) and not (schema["type"] == "integer" and isinstance(value, bool))):
        errs.append(f"{where}: not {schema['type']}")
        return None
    if "const" in schema and value != schema["const"]:
        errs.append(f"{where}: not {schema['const']}")
    if "enum" in schema and value not in schema["enum"]:
        errs.append(f"{where}: {value!r} not allowed")
    if "pattern" in schema and not re.search(schema["pattern"], value):
        errs.append(f"{where}: {value!r} does not match")
    if isinstance(value, dict):
        errs.extend(f"{where}: missing {k}" for k in schema.get("required", []) if k not in value)
        for k, v in value.items():
            if k in schema.get("properties", {}):
                check(schema["properties"][k], v, root, f"{where}.{k}", errs)
            elif schema.get("additionalProperties") is False:
                errs.append(f"{where}: unexpected {k}")
    if isinstance(value, list) and "items" in schema:
        for i, v in enumerate(value):
            check(schema["items"], v, root, f"{where}[{i}]", errs)
    return None


def standing(fid: str) -> str:
    rel = [r for r in LEDGER["relations"] if r["to"] == fid]
    return min(rel, key=lambda r: SEVERITY.index(r["type"]))["type"] if rel else "none"


def test_every_record_has_a_page_and_every_page_a_record() -> None:
    assert len(FINDINGS) == len(RECORDS) >= 30
    for entry in FINDINGS:
        assert entry["id"] in RECORDS, entry
        assert (ROOT / entry["path"]).is_file(), entry["path"]
    for src in (F / "src").iterdir():
        assert src.name in RECORDS, f"{src.name} has public inputs and no record"


def test_every_record_fits_the_schema() -> None:
    schema = json.loads((F / "data" / "research-record.schema.json").read_text("utf-8"))
    gschema = json.loads((F / "data" / "glossary.schema.json").read_text("utf-8"))
    for fid, rec in RECORDS.items():
        errs: list = []
        check(schema, rec, schema, fid, errs)
        assert not errs, errs[:5]
        assert rec["document"]["id"] == fid
    errs = []
    gl = json.loads((F / "records" / "glossary.json").read_text("utf-8"))
    check(gschema, gl, gschema, "glossary", errs)
    assert not errs, errs[:5]


def test_a_broken_record_fails_the_schema_reader() -> None:
    """The reader above must refuse what the schema refuses, or the test above proves nothing."""
    schema = json.loads((F / "data" / "research-record.schema.json").read_text("utf-8"))
    rec = json.loads(json.dumps(next(iter(RECORDS.values()))))
    rec["document"]["tier"] = "Z"
    rec["claims"][0]["basis"] = "felt"
    rec["surprise"] = 1
    errs: list = []
    check(schema, rec, schema, "broken", errs)
    assert len(errs) == 3, errs


def test_records_carry_no_internal_paths() -> None:
    for fid, rec in RECORDS.items():
        text = json.dumps(rec, ensure_ascii=False)
        assert not LOCAL.search(text), f"{fid}: {LOCAL.search(text).group(0)}"
        assert "_internal" not in text and '"inputs"' not in text, fid


def test_every_page_offers_its_pdf_and_buildtex_source() -> None:
    for entry in FINDINGS:
        fid, html = entry["id"], page(entry)
        for ext in (".pdf", ".bld", ".buildtex.json"):
            f = F / "papers" / f"{fid}{ext}"
            assert f.is_file() and f.stat().st_size > 0, f
            assert f'href="/findings/papers/{fid}{ext}"' in html, f"{fid}: no link to {fid}{ext}"
        receipt = json.loads((F / "papers" / f"{fid}.buildtex.json").read_text("utf-8"))
        assert hashlib.sha256((F / "papers" / f"{fid}.pdf").read_bytes()).hexdigest() == receipt["outputs"][f"{fid}.pdf"], fid
        assert hashlib.sha256((F / "papers" / f"{fid}.bld").read_bytes()).hexdigest() == receipt["source"]["sha256"], fid
    assert (F / "papers" / "doc.bld").is_file()


def test_every_claim_mark_resolves() -> None:
    for entry in FINDINGS:
        fid, html = entry["id"], page(entry)
        marks = re.findall(r'<a class="cm b-\w+" href="#t-(c\d+)" data-claim="(c\d+)"', html)
        assert marks, f"{fid}: no claim marks"
        for href, cid in marks:
            assert href == cid
            assert f'<details class="trace b-' in html and f'id="t-{cid}"' in html, f"{fid}: no trace for {cid}"
        for c in RECORDS[fid]["claims"]:
            assert f'id="{c["id"]}"' in html and f'id="t-{c["id"]}"' in html, f"{fid}: claim {c['id']} not on its page"
            for eid in c.get("evidence", []):
                assert any(e["id"] == eid for e in RECORDS[fid]["evidence"]), f"{fid}: {c['id']} names missing {eid}"
        assert len(re.findall(r'id="t-(c\d+)"', html)) == len(RECORDS[fid]["claims"]), f"{fid}: a trace twice or missing"


def test_every_glossary_use_links_to_its_entry_and_back() -> None:
    gpage = (F / "glossary.html").read_text("utf-8")
    entries = set(re.findall(r'<div class="gl-def" id="([^"]+)"', gpage))
    total = 0
    for entry in FINDINGS:
        fid, html = entry["id"], page(entry)
        uses = re.findall(r'<a class="gt" id="(use-[^"]+)" href="/findings/glossary\.html#([^"]+)">', html)
        marks = re.findall(r"\{g:([a-z0-9-]+)\}", (F / "src" / fid / "paper.txt").read_text("utf-8"))
        assert len(uses) == len(marks), f"{fid}: {len(marks)} first uses marked, {len(uses)} on the page"
        for use, anchor in uses:
            assert anchor in entries, f"{fid}: {use} points at a missing entry {anchor}"
            assert f'{entry["path"].split("/")[-1]}#{use}"' in gpage, f"{fid}: glossary does not link back to {use}"
            assert re.search(rf'id="{use}"[^>]*>.*?</a><span class="gd" role="note">', html), f"{fid}: {use} has no definition beside it"
        total += len(uses)
    assert total == len(re.findall(r'<a href="/findings/F\d+-[^"#]+#use-', gpage))


def test_no_em_dashes_or_local_paths_in_generated_pages() -> None:
    for f in sorted(F.glob("*.html")) + sorted(F.glob("records/*.json")):
        text = f.read_text("utf-8")
        assert "—" not in text and "–" not in text, f"{f.name}: em or en dash"
        assert not LOCAL.search(text), f"{f.name}: local path {LOCAL.search(text).group(0)}"
        assert "\x08" not in text, f"{f.name}: a control character"


def test_every_link_to_a_finding_carries_its_standing_flag() -> None:
    hrefs = {"/" + p["path"]: p["id"] for p in FINDINGS}
    flagged = 0
    for f in sorted(F.glob("*.html")):
        html = re.sub(r"<svg\b.*?</svg>", "", f.read_text("utf-8"), flags=re.S)
        for m in re.finditer(r'<a (?![^>]*class="sflag)[^>]*href="(/findings/F\d+-[a-z0-9-]+\.html)(?:#[^"]*)?"[^>]*>.*?</a>(.{0,600})', html, re.S):
            fid = hrefs.get(m.group(1))
            if not fid:
                continue
            nxt = m.group(2)
            assert nxt.startswith(f'<a class="sflag s-{standing(fid)}" data-flag="{fid}"'), f"{f.name}: link to {fid} has no current flag"
            assert f"<span>{WORD[standing(fid)]}</span>" in nxt
            flagged += 1
    assert flagged >= 60


def test_index_counts_honest_nulls_and_lists_every_finding() -> None:
    html = (F / "index.html").read_text("utf-8")
    nulls = sum(1 for r in RECORDS.values() if r["document"]["tier"] == "D")
    assert f"<b>{nulls} of them are honest nulls</b>" in html
    assert len(re.findall(r'<li class="xc fd-item" id="f\d+" data-tier="null"', html)) == nulls
    for fid in RECORDS:
        assert f'id="{fid.lower()}"' in html, f"{fid} missing from the index"
    for t in ("candidate", "strong", "signal", "null"):
        assert len(re.findall(rf'data-tier="{t}" aria-pressed', html)) <= 1


def test_refuted_findings_redirect_and_pages_json_agrees() -> None:
    for entry in FINDINGS:
        st = standing(entry["id"])
        assert entry["standing"] == st
        if st in ("refuted", "retracted"):
            assert entry["id"] in LEDGER["redirects"], f"{entry['id']} is {st} with no redirect target"
            html = page(entry)
            assert '<meta http-equiv="refresh"' in html and entry["redirect"] in html
            assert not entry["indexable"]
        else:
            assert "redirect" not in entry and entry["indexable"]


@pytest.mark.parametrize("script", ["record-findings.mjs", "build-findings.mjs", "finding-flags.mjs"])
def test_generated_files_match_a_fresh_build(script: str) -> None:
    run = subprocess.run(["node", f"scripts/{script}", "--check"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    assert run.returncode == 0, run.stderr or run.stdout
