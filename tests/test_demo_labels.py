"""Every demonstration says what form it takes: live, replay or captured.

The ledger, site-src/world/demos.json, has one row for every demonstration this check knows about.
These tests fail when:

- a demonstration's page has no label, or the label names another form than the ledger;
- a label on a page has no row;
- a replay or a captured demonstration has no evidence record (date, command, file, sha256), the
  file is missing, its hash differs, or the command is not written in the record it names;
- a page that mounts a registry module, or a demo page, has no row;
- a module in world/site/surfaces/registry.mjs has no form.

A captured demonstration whose record is incomplete is pinned in NEEDS_EVIDENCE with the fields it
lacks. Its label says the record is not published. The list can only shrink.

The checks read the pages and the files themselves and do not call scripts/demo-labels.mjs, so a
fault in that script cannot hide a missing label. One test runs its check as well.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
LEDGER = json.loads((ROOT / "site-src/world/demos.json").read_text(encoding="utf-8"))
ROWS = LEDGER["rows"]
BY_ID = {row["id"]: row for row in ROWS}
FORMS = {"live": "Live.", "replay": "Replay.", "captured": "Captured."}
RECORDED = {"replay", "captured"}
FIELDS = ("date", "command", "file", "sha256")

# Captured demonstrations whose evidence record is incomplete today, with the fields each lacks.
# A row leaves this list when its record is complete; a new entry is a reviewed change.
NEEDS_EVIDENCE = {
    "flywheel-surface": ["command", "sha256"],
    "crucible-cleanroom": ["date", "command"],
    "articulate-output": ["file", "sha256"],
}

LABEL = re.compile(r'<p class="demo-form" data-demo="([^"]+)" data-form="([^"]*)">(.*?)</p>', re.S)
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def file_of(page: str) -> Path:
    name = page.split("#")[0].lstrip("/")
    return ROOT / (name + "index.html" if name == "" or name.endswith("/") else name)


def long_date(iso: str) -> str:
    year, month, day = (int(part) for part in iso.split("-"))
    return f"{day} {MONTHS[month - 1]} {year}"


def tracked(pattern: str) -> list[str]:
    out = subprocess.run(["git", "ls-files", "--", pattern], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return [name for name in out.split("\n") if name and (ROOT / name).is_file()]


def evidence_problem(row: dict, root: Path = ROOT) -> str | None:
    """Why a recorded demonstration's evidence does not hold, or None when it does."""
    record = row.get("evidence")
    if not isinstance(record, dict):
        return "no evidence record"
    missing = [field for field in FIELDS if not record.get(field)]
    if missing:
        return f"the record lacks {', '.join(missing)}"
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", record["date"]):
        return "the date is not an ISO day"
    file = root / record["file"]
    if not file.is_file():
        return f"no file at {record['file']}"
    if hashlib.sha256(file.read_bytes()).hexdigest() != record["sha256"]:
        return f"sha256 of {record['file']} differs from the record"
    written_in = root / record.get("commandIn", record["file"])
    if not written_in.is_file() or record["command"] not in written_in.read_text(encoding="utf-8", errors="replace"):
        return "the command is not written in the record it names"
    return None


def registry_modules() -> tuple[set[str], set[str]]:
    """Module ids in the registry: those with an adapter behind them, and those without."""
    source = (ROOT / "world/site/surfaces/registry.mjs").read_text(encoding="utf-8")
    block = source[source.index("export const SURFACES") :]
    block = block[: block.index("\n});") ]
    loaded = set(re.findall(r"^\s+(\w+): S\('", block, re.M))
    empty = set(re.findall(r"^\s+(\w+): Object\.freeze\(\{[^\n]*load: null", block, re.M))
    return loaded, empty


def test_ledger_is_well_formed() -> None:
    assert set(LEDGER["forms"]) == set(FORMS)
    assert len(BY_ID) == len(ROWS), "a demonstration is listed twice"
    for row in ROWS:
        assert re.fullmatch(r"[a-z0-9-]+", row["id"]), row
        assert row["form"] in FORMS, row
        assert row["what"].strip(), row
        assert file_of(row["page"]).is_file(), f"{row['id']}: no page at {row['page']}"
        if row["form"] == "live":
            assert "evidence" not in row, f"{row['id']}: a live demonstration has no evidence record"


def test_every_demonstration_carries_its_label() -> None:
    wrong = []
    for row in ROWS:
        text = file_of(row["page"]).read_text(encoding="utf-8")
        found = [(form, body) for demo, form, body in LABEL.findall(text) if demo == row["id"]]
        if len(found) != 1:
            wrong.append(f"{row['page']}: {len(found)} labels for {row['id']}, expected one")
            continue
        form, body = found[0]
        if form != row["form"] or not body.startswith(f"<b>{FORMS[row['form']]}</b>"):
            wrong.append(f"{row['page']}: {row['id']} is {row['form']} in the ledger, the page says {form}")
        record = row.get("evidence")
        if record and (long_date(record["date"]) not in body or record["sha256"][:16] not in body or f'href="/{record["file"]}"' not in body):
            wrong.append(f"{row['page']}: the label for {row['id']} does not name its record")
        if row["form"] in RECORDED and not record and "not published" not in body:
            wrong.append(f"{row['page']}: {row['id']} has no record and the label does not say so")
        assert chr(0x2014) not in body  # no em dash
    assert not wrong, "\n".join(wrong)


def test_every_label_on_a_page_has_a_row() -> None:
    stray = []
    for name in tracked("*.html"):
        for demo, _form, _body in LABEL.findall((ROOT / name).read_text(encoding="utf-8", errors="replace")):
            row = BY_ID.get(demo)
            if row is None or file_of(row["page"]) != ROOT / name:
                stray.append(f"{name}: label for {demo}")
    assert not stray, "labels with no row for that page:\n" + "\n".join(stray)


def test_a_recorded_demonstration_has_its_evidence() -> None:
    recorded = [row for row in ROWS if row["form"] in RECORDED]
    assert recorded, "the ledger lists no replay or captured demonstration"
    problems = {row["id"]: evidence_problem(row) for row in recorded}
    unexpected = {demo: why for demo, why in problems.items() if why and demo not in NEEDS_EVIDENCE}
    assert not unexpected, "recorded demonstrations without evidence:\n" + "\n".join(f"{d}: {w}" for d, w in unexpected.items())
    healed = [demo for demo in NEEDS_EVIDENCE if demo not in problems or problems[demo] is None]
    assert not healed, f"these now have a full record; remove them from NEEDS_EVIDENCE: {healed}"
    for demo, lacks in NEEDS_EVIDENCE.items():
        row = BY_ID[demo]
        assert row.get("evidence") is None and row["needs"] == lacks, f"{demo}: the row and this list disagree on what is missing"
        assert not set(row.get("has", {})) & set(lacks), f"{demo}: a field is both held and missing"


def test_the_check_refuses_a_made_up_record(tmp_path: Path) -> None:
    record = tmp_path / "record.txt"
    record.write_bytes(b"$ tool run --seed 7\nok\n")
    good = {"date": "2026-01-02", "command": "tool run --seed 7", "file": "record.txt", "sha256": hashlib.sha256(record.read_bytes()).hexdigest()}
    assert evidence_problem({"evidence": good}, tmp_path) is None
    assert evidence_problem({"evidence": None}, tmp_path) == "no evidence record"
    assert evidence_problem({}, tmp_path) == "no evidence record"
    assert "lacks command" in evidence_problem({"evidence": {**good, "command": ""}}, tmp_path)
    assert "differs" in evidence_problem({"evidence": {**good, "sha256": "0" * 64}}, tmp_path)
    assert "no file" in evidence_problem({"evidence": {**good, "file": "absent.txt"}}, tmp_path)
    assert "not written" in evidence_problem({"evidence": {**good, "command": "tool run --seed 8"}}, tmp_path)
    assert "ISO day" in evidence_problem({"evidence": {**good, "date": "2 January 2026"}}, tmp_path)


def test_pages_that_show_a_demonstration_have_a_row() -> None:
    loaded, _empty = registry_modules()
    labelled = {file_of(row["page"]) for row in ROWS}
    later = {file_of(item["page"]) for item in LEDGER["notYetLabelled"]}
    missing = []
    for name in tracked("*.html"):
        if name.startswith(("world/", "tests/", "home/")):
            continue  # imported pieces and fixtures are not this repository's pages
        text = (ROOT / name).read_text(encoding="utf-8", errors="replace")
        if 'http-equiv="refresh"' in text:
            continue
        mounts = {n for m in re.findall(r'data-surface="([^"]+)"', text) for n in m.split()} | set(re.findall(r'\bmount\([^,()]*(?:\([^()]*\))?[^,()]*,\s*"(\w+)"', text))
        mounts &= loaded
        is_demo_page = re.fullmatch(r"demo-[\w-]+\.html", name) is not None or name.startswith("demos/")
        if (mounts or is_demo_page) and ROOT / name not in labelled:
            missing.append(name)
        named = {module for row in ROWS if file_of(row["page"]) == ROOT / name for module in row.get("modules", [])}
        assert mounts <= named, f"{name} mounts {sorted(mounts - named)}, which its row does not list"
    assert not missing, "pages that show a demonstration and have no row:\n" + "\n".join(missing)
    for page in later:
        assert page.is_file(), page
        assert page not in labelled or page == ROOT / "index.html", f"{page.name} is labelled; take it off notYetLabelled"


def test_every_registry_module_has_a_form() -> None:
    loaded, empty = registry_modules()
    assert len(loaded) >= 14 and "sound" in empty, "the registry did not parse"
    assert set(LEDGER["modules"]) == loaded, "the ledger's modules and the registry's differ"
    assert set(LEDGER["modulesWithoutDemo"]) == empty
    assert set(LEDGER["modules"].values()) <= set(FORMS)
    for row in ROWS:
        for module in row.get("modules", []):
            assert LEDGER["modules"][module] == row["form"], f"{row['id']}: {module} is {LEDGER['modules'][module]}, the row says {row['form']}"


def test_label_script_agrees() -> None:
    node = shutil.which("node")
    if node is None:
        pytest.skip("node is not installed")
    done = subprocess.run([node, "scripts/demo-labels.mjs", "--check"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    assert done.returncode == 0, done.stdout + done.stderr
