"""Cross-surface checks for advisory facts and the newest release states.

The registry records each advisory once. The security plate, the Flywheel relations
and the release states restate parts of those records, so each check here compares a
restatement with the record it came from. None of these checks reads the network: the
live GitHub and PyPI sweep stays a manual step of every facts pass.
"""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
NUMBER_WORDS = {1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six"}
REGISTRY_RANGE = re.compile(
    r"^(High|Medium|Low|Critical) severity security advisory, .*? Affected: (\S+) "
    r"(.+?)(?:, when [^.]*)?\. Fixed in ([0-9.]+)[.;]"
)
PLATE_ROW = re.compile(
    r'<span class="index-term"><a href="[^"]+">([^<]+)</a> &middot; (\w+)</span>\s*'
    r'<span class="index-gloss">(.*?)</span>\s*</div>',
    re.S,
)
# 2026-09-27 copy pass: the package and the advisory ID carry class="ident", which
# keeps each one whole on narrow screens.
PLATE_RANGE = re.compile(
    r'Affected: <code class="ident" translate="no">(\S+)</code> (.+?)\. Fixed in ([0-9.]+)\. '
    r'<a [^>]*>Advisory <span class="ident" translate="no">(GHSA(?:-[a-z0-9]{4}){3})</span>'
)


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def version(text: str) -> tuple[int, ...]:
    return tuple(int(part) for part in text.split("."))


def covers(affected: str, candidate: str) -> bool:
    """Read the registry's affected-range wording as a version predicate."""
    v = version(candidate)
    if m := re.fullmatch(r"before ([0-9.]+)", affected):
        return v < version(m.group(1))
    if m := re.fullmatch(r"([0-9.]+) and later releases before ([0-9.]+)", affected):
        return version(m.group(1)) <= v < version(m.group(2))
    if m := re.fullmatch(r"([0-9.]+) only", affected):
        return v == version(m.group(1))
    if m := re.fullmatch(r"([0-9.]+) and earlier", affected):
        return v <= version(m.group(1))
    raise AssertionError(f"unreadable affected range: {affected}")


def advisories() -> dict[str, dict[str, str]]:
    registry = json.loads(read("system/systems.json"))
    found = {}
    for system in registry["systems"]:
        for item in system["evidence"]:
            if item["type"] != "advisory":
                continue
            ghsa = re.search(r"GHSA(?:-[a-z0-9]{4}){3}", item["href"]).group(0)
            match = REGISTRY_RANGE.match(item["summary"])
            assert match, f"{ghsa}: the registry summary does not state severity, range and fix"
            severity, package, affected, fixed = match.groups()
            found[ghsa] = {
                "system": system["name"], "severity": severity.lower(),
                "package": package, "affected": affected, "fixed": fixed,
            }
    return found


def test_each_plate_row_matches_its_registry_record() -> None:
    recorded = advisories()
    rows = PLATE_ROW.findall(read("security.html"))
    assert len(rows) == len(recorded) == 12
    for name, severity, gloss in rows:
        match = PLATE_RANGE.search(gloss)
        assert match, f"{name}: the plate row does not state range, fix and advisory"
        package, affected, fixed, ghsa = match.groups()
        record = recorded[ghsa]
        assert (name, severity) == (record["system"], record["severity"]), ghsa
        assert (package, affected, fixed) == (record["package"], record["affected"], record["fixed"]), ghsa
        assert not covers(affected, fixed), f"{ghsa}: the fixed release sits inside its own range"


def test_flywheel_relations_count_the_advisories_that_cover_each_pin() -> None:
    recorded = advisories()
    registry = json.loads(read("system/systems.json"))
    checked = 0
    for relation in registry["relations"]:
        text = relation["claimScope"]
        pin = re.search(r"pinned to (\S+) ([0-9.]+)\.", text)
        if relation["source"] != "flywheel" or not pin:
            continue
        package, pinned = pin.groups()
        own = {g: r for g, r in recorded.items() if r["package"] == package}
        if not own:
            continue
        checked += 1
        inside = {g for g, r in own.items() if covers(r["affected"], pinned)}
        name = next(iter(own.values()))["system"]
        if "listed on the Security page" in text:
            total = NUMBER_WORDS[len(own)]
            if inside == set(own):
                assert f"inside the ranges of the {total} {name} advisories listed on the Security page" in text
            else:
                assert len(inside) == 1, package
                assert f"inside the range of one of the {total} {name} advisories listed on the Security page" in text
            later = re.search(r"and ([0-9.]+) and later are outside (?:all \w+|both)", text)
            assert later, package
            assert not any(covers(r["affected"], later.group(1)) for r in own.values()), package
        elif "is outside" in text:
            assert not inside, f"{package} {pinned} is inside an advisory range"
        else:
            assert set(re.findall(r"GHSA(?:-[a-z0-9]{4}){3}", text)) == inside, package
    assert checked == 5, "gather, crucible, forum, relay and mneme relations carry a pin"


def test_bulletin_names_its_newest_release_and_live_contract() -> None:
    registry = json.loads(read("system/systems.json"))
    bulletin = next(s for s in registry["systems"] if s["id"] == "bulletin")
    evidence = {item["id"]: item for item in bulletin["evidence"]}
    # 2026-09-27: GitHub release v0.5.0 is Latest, and the deployed contract and OpenAPI
    # both report 0.5.0. The v0.4.0 and v0.3.1 records stay as history.
    assert bulletin["releaseState"] == "GitHub release v0.5.0; deployed board contract 0.5.0"
    assert bulletin["evidence"][0]["id"] == "bulletin-release-v0-5-0"
    release = evidence["bulletin-release-v0-5-0"]
    assert release["href"] == "https://github.com/HarperZ9/bulletin/releases/tag/v0.5.0"
    assert "does not escrow, collect, settle or verify payments" in release["summary"]
    contract = evidence["bulletin-deployed-board-contract"]
    assert "reported version 0.5.0" in contract["summary"]
    assert "0.4.0" not in contract["summary"]
    for page in ("bulletin.html", "join.html"):
        source = read(page)
        assert "&middot; Bulletin 0.5.0</span>" in source, page
        assert "https://github.com/HarperZ9/bulletin/releases/tag/v0.5.0" in source, page
        assert "v0.4.0" not in source, page
        assert "Bulletin 0.4.0" not in source, page
    assert 'Bulletin <span id="board-version">0.5.0</span>' in read("join.html")


def test_buildlang_separates_the_github_release_from_the_crates_io_version() -> None:
    registry = json.loads(read("system/systems.json"))
    buildlang = next(s for s in registry["systems"] if s["id"] == "buildlang")
    # 2026-09-27: GitHub's latest release is v1.4.0, a source release with no registry
    # artifact; crates.io still serves 1.2.0, which is what cargo install fetches.
    assert buildlang["releaseState"] == (
        "GitHub release v1.4.0; buildlang 1.2.0 on crates.io; non-C backends experimental"
    )
    ids = [item["id"] for item in buildlang["evidence"]]
    assert ids[:3] == ["buildlang-release-v1-4-0", "buildlang-crates-v1-2-0", "buildlang-release-v1-2-0"]
    release = buildlang["evidence"][0]
    assert "no package registry artifact" in release["summary"]
    assert buildlang["entryCommand"].startswith("cargo install buildlang;")
    for page in ("catalog.html", "overview.html", "site-index.html"):
        source = read(page)
        assert "GitHub release v1.4.0; buildlang 1.2.0 on crates.io" in source, page
        assert "stable v1.2.0" not in source, page
    assert "buildlang 1.2.0 on crates.io" in read("buildlang.html")
