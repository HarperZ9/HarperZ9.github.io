"""The live explainers: recall items are valid, Learn is the pinned copy, and nothing phones home.

The live stage and its recall checks run in the reader's browser. These checks need only the
repository and Node: recall items pass Learn's own validator and quote their published source
word for word, the vendored Learn files match the commit they were copied from, the live code
asks the network only for the explainer's own files, and spaced review touches localStorage only
inside try/catch.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
FOLDERS = sorted(p.parent for p in (ROOT / "media" / "explainers").glob("*/spec.json"))
LIVE = [ROOT / "system/explainer/live.mjs", ROOT / "system/explainer/recall.mjs", ROOT / "system/explainer/state.mjs",
        ROOT / "system/explainer/dom.mjs",
        ROOT / "system/media-engine/plugins/explainer.mjs"]
VENDOR = ROOT / "system/vendor/learn"
NODE = shutil.which("node")


def page_text(page: str) -> str:
    raw = (ROOT / page).read_text(encoding="utf-8")
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", raw)))


def test_every_explainer_has_recall_checks_tied_to_its_scenes() -> None:
    for folder in FOLDERS:
        spec = json.loads((folder / "spec.json").read_text(encoding="utf-8"))
        recall = json.loads((folder / "recall.json").read_text(encoding="utf-8"))
        keys = [s["key"] for s in spec["scenes"]]
        ids = [i["id"] for i in recall["items"]]
        assert recall["schema"] == "learn-items/1" and recall["explainer"] == folder.name
        placed = [i for c in recall["checks"] for i in c["items"]]
        assert sorted(placed) == sorted(ids), folder.name  # every item asked once
        afters = [keys.index(c["after"]) for c in recall["checks"]]
        assert afters == sorted(afters) and afters[-1] == len(keys) - 1, folder.name
        assert all(2 <= len(c["items"]) <= 3 for c in recall["checks"]), folder.name


def test_recall_quotes_are_word_for_word_from_the_published_page() -> None:
    for folder in FOLDERS:
        recall = json.loads((folder / "recall.json").read_text(encoding="utf-8"))
        for item in recall["items"]:
            page, _, anchor = item["source"]["ref"].partition("#")
            text = page_text(page)
            assert item["source"]["quote"] in text, (folder.name, item["id"])
            assert f'id="{anchor}"' in (ROOT / page).read_text(encoding="utf-8"), (folder.name, item["id"])


def test_no_misconception_note_quotes_its_keyed_answer() -> None:
    for folder in FOLDERS:
        for item in json.loads((folder / "recall.json").read_text(encoding="utf-8"))["items"]:
            key = next(c["text"] for c in item["choices"] if c["id"] == item["answer"])
            for m in item["misconceptions"].values():
                assert key.lower() not in m["note"].lower(), (folder.name, item["id"])


@pytest.mark.skipif(NODE is None, reason="node is not on PATH")
def test_recall_items_pass_learns_own_validator() -> None:
    script = ("import * as L from './system/vendor/learn/browser.mjs';import fs from 'node:fs';"
              "for (const f of process.argv.slice(1)) L.validateItemSet(JSON.parse(fs.readFileSync(f,'utf8')));"
              "console.log('ok')")
    files = [str((f / "recall.json").relative_to(ROOT)) for f in FOLDERS]
    out = subprocess.run([NODE, "--input-type=module", "-e", script, *files], cwd=ROOT, capture_output=True, text=True)
    assert out.returncode == 0 and out.stdout.strip() == "ok", out.stderr


def test_vendored_learn_matches_its_pinned_hashes_and_imports_nothing_else() -> None:
    meta = json.loads((VENDOR / "VENDOR.json").read_text(encoding="utf-8"))
    assert re.fullmatch(r"[0-9a-f]{40}", meta["commit"])
    on_disk = {p.relative_to(VENDOR).as_posix() for p in VENDOR.rglob("*") if p.is_file()} - {"VENDOR.json"}
    assert on_disk == set(meta["files"])
    for name, digest in meta["files"].items():
        assert hashlib.sha256((VENDOR / name).read_bytes()).hexdigest() == digest, name
    for path in VENDOR.rglob("*.mjs"):
        for spec in re.findall(r'from\s+"([^"]+)"', path.read_text(encoding="utf-8")):
            assert spec.startswith("./") or spec.startswith("../"), (path.name, spec)
            assert (path.parent / spec).resolve().is_relative_to(VENDOR.resolve()), (path.name, spec)


def test_live_code_asks_the_network_only_for_its_own_files() -> None:
    banned = re.compile(r"sendBeacon|XMLHttpRequest|WebSocket|EventSource|navigator\.connection|https?://|"
                        r"document\.cookie|indexedDB|sessionStorage|import\(")
    for path in LIVE:
        code = re.sub(r"//.*", "", path.read_text(encoding="utf-8"))
        assert not banned.search(code), (path.name, banned.search(code).group(0))
        calls = re.findall(r"\bfetch\(", code)
        if path.name == "live.mjs":
            assert len(calls) == 1  # one call site, inside own(), which takes only the explainer folder
            assert re.search(r'media\\/explainers\\/\[a-z0-9-\]\+\$', code)
            assert 'FILES = ["spec.json", "receipt.json", "recall.json"]' in code
        else:
            assert not calls, path.name


def test_local_storage_is_only_touched_inside_try() -> None:
    code = (ROOT / "system/explainer/recall.mjs").read_text(encoding="utf-8")
    uses = [m.start() for m in re.finditer(r"localStorage\.", code)]
    assert len(uses) == 3
    for at in uses:
        before = code[:at]
        assert before.rfind("try {") > before.rfind("catch"), code[at:at + 40]  # inside an open try
        assert "catch" in code[at:at + 400], code[at:at + 40]
    others = [p for p in LIVE if p.name != "recall.mjs"]
    assert not any("localStorage" in p.read_text(encoding="utf-8") for p in others)


def test_stage_risk_colours_are_the_engine_tokens() -> None:
    css = (ROOT / "system/explainer/explainer.css").read_text(encoding="utf-8")
    # The tokens live in the vendored superstack contract; colour.mjs re-exports them.
    colour = (ROOT / "system/media-engine/contracts.mjs").read_text(encoding="utf-8")
    for pole in ("light", "dark"):
        block = re.search(pole + r": Object\.freeze\(\{([^}]*)\}", colour).group(1)
        tokens = dict(re.findall(r"""(\w+): ["'](#[0-9a-f]{6})["']""", block))
        for level in ("low", "moderate", "elevated", "high"):
            assert f'.xl[data-pole="{pole}"] [data-risk="{level}"][data-risk-hot]{{color:{tokens[level]}}}' in css


def test_each_live_page_carries_the_figure_hooks() -> None:
    from tools.explainer.embed import HAND_PLACED
    from tools.render_legacy_essays import EXPLAINERS
    placed = {slug: page for page, sections in EXPLAINERS.items() for slug in sections.values()}
    placed.update(HAND_PLACED)
    for folder in FOLDERS:
        text = (ROOT / placed[folder.name]).read_text(encoding="utf-8")
        assert f'data-explainer="{folder.name}" data-folder="media/explainers/{folder.name}"' in text, folder.name
        assert 'src="system/explainer/live.mjs' in text, folder.name
