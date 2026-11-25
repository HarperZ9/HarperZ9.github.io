"""Contracts for architecture.html and consolidated super-project repository links."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_architecture_page_has_required_platforms_datasets_and_voice() -> None:
    html = (ROOT / "architecture.html").read_text(encoding="utf-8")
    assert "Five Platforms, One Field" in html
    assert "\u2014" not in html, "em dash found in architecture.html"
    assert not re.search(r"[A-Za-z]:[\\/](?:dev|Users|Downloads|wt|SteamLibrary)", html), "local path in architecture.html"
    assert "zentropy" not in html.lower(), "retired name in architecture.html"

    for mark in ("THE PLAYGRND", "BLDLNG", "THE FLYWHEEL", "THE CMMNS", "RSRCH", "ARTIQL8"):
        assert mark in html, f"missing platform mark {mark}"
    for ds_id in ("DS-01", "DS-02", "DS-03", "DS-04", "DS-05", "DS-06", "DS-07"):
        assert ds_id in html, f"missing dataset {ds_id}"

    assert 'class="arch-svg"' in html
    assert 'id="arch-svg-title"' in html and 'id="arch-svg-desc"' in html
    assert 'id="arch-inspector"' in html
    assert "Verified" in html
    assert "pending live" not in html.lower() and "pending shard" not in html.lower()
    for fact in ("7,065", "91/91", "115/115", "91.25%", "89 live own"):
        assert fact in html, f"missing live verified fact {fact}"


def test_consolidated_work_index_entries_point_to_live_super_projects() -> None:
    wi = json.loads((ROOT / "site-src/world/work-index.json").read_text(encoding="utf-8"))
    by_id = {e["id"]: e for e in wi["entries"]}
    expected_prefix = {
        "signal-kernels": "https://github.com/HarperZ9/superframe/tree/main/packages/kernels/",
        "anomaly-kernels": "https://github.com/HarperZ9/superframe/tree/main/packages/kernels/",
        "gpu-trace-validator": "https://github.com/HarperZ9/superframe/tree/main/packages/quality/",
        "open-archives": "https://github.com/HarperZ9/superframe/tree/main/library/",
        "superstack": "https://github.com/HarperZ9/superframe/tree/main/packages/",
        "reconcile": "https://github.com/HarperZ9/superframe/tree/main/packages/",
        "raw-native": "https://github.com/HarperZ9/superframe/tree/main/native",
        "build-universe": "https://github.com/HarperZ9/buildlang/tree/main/universe",
        "build-engine": "https://github.com/HarperZ9/buildlang/tree/main/suite/",
        "build-ui": "https://github.com/HarperZ9/buildlang/tree/main/suite/",
        "build-finance": "https://github.com/HarperZ9/buildlang/tree/main/suite/",
        "build-oracle": "https://github.com/HarperZ9/buildlang/tree/main/suite/",
        "build-ecosystem": "https://github.com/HarperZ9/buildlang/tree/main/suite/",
        "flywheel-receipt-demo": "https://github.com/HarperZ9/flywheel/tree/main/demos/",
        "bootloops-second-checker": "https://github.com/HarperZ9/flywheel/tree/main/demos/",
        "flywheel-evidence-task": "https://github.com/HarperZ9/flywheel/tree/main/demos/",
        "crewai-kickoff-replay-receipt": "https://github.com/HarperZ9/flywheel/tree/main/demos/",
        "vllm-ci-forum-receipt": "https://github.com/HarperZ9/flywheel/tree/main/demos/",
        "witnessing-spine": "https://github.com/HarperZ9/flywheel/tree/main/docs/research/",
        "faithful-transpile": "https://github.com/HarperZ9/flywheel/tree/main/docs/research/",
    }
    for eid, prefix in expected_prefix.items():
        repo = by_id[eid]["repo"]
        assert repo.startswith(prefix), f"{eid}: expected {prefix}, got {repo}"
