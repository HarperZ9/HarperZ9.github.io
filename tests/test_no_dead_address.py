"""No address the site has published may go dead.

The ledger, site-src/world/addresses.json, has one row for every address the site has published.
These tests fail when:

- a row's page is missing, or a redirect row's stub does not lead to a page;
- a row that is on origin/main's copy of the ledger is missing from the working copy, or its
  path was changed (the ledger is append-only);
- a served page has no row;
- an absolute https://harperz9.github.io/... link on one of the site's pages leads to nothing.

The checks read the pages themselves and do not call scripts/build-addresses.mjs, so a fault
in the builder's own check cannot hide a dead address. One test runs the builder's check as
well, so the two cannot drift apart unseen.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlsplit

import pytest

ROOT = Path(__file__).resolve().parents[1]
LEDGER_PATH = "site-src/world/addresses.json"
LEDGER = json.loads((ROOT / LEDGER_PATH).read_text(encoding="utf-8"))
ROWS = LEDGER["rows"]
BY_PATH = {row["path"]: row for row in ROWS}
HOST = "https://harperz9.github.io"

# Project sites. Other repositories (cmmns, flywheel, buildlang) publish their own pages under
# /<repository>/ on the same host. Those addresses are live, and none of their files are in this
# repository, so a link or a redirect into one cannot be checked here and is accepted. The list
# is kept in the ledger's head ("projectSites") so the 404 page and the Node checks read the
# same copy; this test pins it, so adding a prefix is a reviewed change to both files.
PROJECT_SITES = ("/cmmns/", "/flywheel/", "/buildlang/")

# Absolute links that lead nowhere today and are not small fixes. Each entry is a link target and
# the reason it is still dead. An entry that starts answering fails the test below, so this list
# can only shrink.
KNOWN_DEAD = {
    "/repo-explainers/buildlang.html": "canonical link in tools/repo_explainers/pages/buildlang.src.html; the explainer page has not been built",
    "/repo-explainers/calibrate-pro.html": "canonical link in tools/repo_explainers/pages/calibrate-pro.src.html; the explainer page has not been built",
}

KINDS = {"surface", "leaf", "record", "redirect", "gone"}
SURFACES = {"playground", "commons", "flywheel", "articulate", "buildlang", "research", "door", "unassigned"}
SIX_AND_THE_DOOR = {
    "/playground/": "playground", "/cmmns.html": "commons", "/flywheel.html": "flywheel",
    "/articulate.html": "articulate", "/buildlang.html": "buildlang", "/research.html": "research", "/": "door",
}
REFRESH = re.compile(r'<meta[^>]+http-equiv="refresh"[^>]+content="\s*\d+\s*;\s*url=([^"]+)"', re.I)
# Tracked files GitHub Pages does not serve (_config.yml): they are not addresses.
NOT_SERVED = re.compile(r"^(?:home|tests|docs)/|^img/og/_card\.html$|(?:^|/)[_.][^/]*|(?:^|/)node_modules/")


def file_of(address: str) -> Path:
    page = address.split("#")[0].lstrip("/")
    return ROOT / (page + "index.html" if page == "" or page.endswith("/") else page)


def page_text(address: str) -> str | None:
    """The page at an address, with any part it loads after opening (the ledger's lateParts)."""
    page = address.split("#")[0]
    if not file_of(page).is_file():
        return None
    parts = [file_of(page)] + [ROOT / late for late in LEDGER.get("lateParts", {}).get(page, [])]
    return "\n".join(part.read_text(encoding="utf-8", errors="replace") for part in parts)


def has_place(text: str, fragment: str) -> bool:
    return re.search(rf"""\b(?:id|name)=["']{re.escape(fragment)}["']""", text) is not None


def as_address(href: str, base: str) -> str | None:
    """A link seen on the page at `base`, as an address on this host; None for another host."""
    from urllib.parse import urljoin

    parts = urlsplit(urljoin(HOST + base, href.strip()))
    if f"{parts.scheme}://{parts.netloc}" != HOST:
        return None
    path = re.sub(r"/index\.html$", "/", unquote(parts.path))
    return path + (f"#{parts.fragment}" if parts.fragment else "")


def in_project_site(address: str) -> bool:
    return address.startswith(PROJECT_SITES)


def dead_reason(address: str, hops: int = 0) -> str | None:
    """Why an address on this site does not answer, or None when it does."""
    if in_project_site(address):
        return None
    page, _, fragment = address.partition("#")
    text = page_text(page)
    if text is None:
        return f"no page at {page}"
    target = REFRESH.search(text)
    if target:
        if hops >= 5:
            return "redirect chain longer than five hops"
        onward = as_address(target.group(1), page)
        if onward is None:
            return f"redirect leaves the site for {target.group(1)}"
        reason = dead_reason(onward, hops + 1)
        return f"redirects to {onward}: {reason}" if reason else None
    if fragment and not has_place(text, fragment):
        return f"{page} has no place named {fragment}"
    return None


def served_pages() -> list[str]:
    listed = subprocess.run(["git", "ls-files", "--", "*.html"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split("\n")
    return sorted(name for name in listed if name and not NOT_SERVED.search(name) and name != "404.html" and (ROOT / name).is_file())


def test_ledger_rows_are_well_formed_and_unique() -> None:
    assert LEDGER["projectSites"] == list(PROJECT_SITES)
    assert len(BY_PATH) == len(ROWS), "a path is listed twice"
    for row in ROWS:
        assert row["path"].startswith("/"), row
        assert row["kind"] in KINDS, row
        assert row["surface"] in SURFACES, row
        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", row["since"]), row
        assert ("to" in row) == (row["kind"] == "redirect"), f"{row['path']}: only a redirect row has a target"
        if row["kind"] == "gone":
            assert re.fullmatch(r"[0-9a-f]{7,40}", row.get("removed", "")), f"{row['path']}: a gone row names the commit that removed it"
    for path, surface in SIX_AND_THE_DOOR.items():
        assert BY_PATH[path]["kind"] == "surface" and BY_PATH[path]["surface"] == surface


def test_every_ledger_address_answers() -> None:
    dead = []
    for row in ROWS:
        if row["kind"] == "gone":
            continue
        reason = dead_reason(row["path"])
        if reason:
            dead.append(f"{row['path']}: {reason}")
            continue
        text = page_text(row["path"])
        stub = REFRESH.search(text) if "#" not in row["path"] else None
        if row["kind"] == "redirect":
            leads = as_address(stub.group(1), row["path"]) if stub else None
            if leads != row["to"]:
                dead.append(f"{row['path']}: the row says it leads to {row['to']}, the page leads to {leads}")
        elif stub:
            dead.append(f"{row['path']}: the row says {row['kind']}, the page is a redirect stub")
    assert not dead, "addresses that no longer answer:\n" + "\n".join(dead)


def test_a_gone_address_has_no_page_and_is_rare() -> None:
    gone = [row for row in ROWS if row["kind"] == "gone"]
    for row in gone:
        assert not file_of(row["path"]).exists(), f"{row['path']} has a page again: give the row its kind back"
    # a gone row is a decision the author made about one address, not a way to pass the check above
    assert not gone, "a gone row needs the author's decision; list it here once he has made it"


def test_every_served_page_has_a_row() -> None:
    missing = [name for name in served_pages() if "/" + re.sub(r"(^|/)index\.html$", r"\1", name) not in BY_PATH]
    assert not missing, "served pages with no row (run node scripts/build-addresses.mjs):\n" + "\n".join(missing)


def test_no_row_on_main_is_missing_or_moved() -> None:
    shown = subprocess.run(["git", "show", f"origin/main:{LEDGER_PATH}"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    if shown.returncode != 0:
        pytest.skip("origin/main has no address ledger yet, or origin/main is not fetched")
    lost = [row["path"] for row in json.loads(shown.stdout)["rows"] if row["path"] not in BY_PATH]
    assert not lost, "rows on origin/main that the working copy dropped:\n" + "\n".join(lost)


def absolute_links() -> dict[str, str]:
    """Each absolute link to this host found in a served page's href, with one page that has it."""
    found: dict[str, str] = {}
    for name in served_pages() + ["404.html"]:
        text = (ROOT / name).read_text(encoding="utf-8", errors="replace")
        for href in re.findall(rf'href="({re.escape(HOST)}[^"]*)"', text):
            address = as_address(href.replace("&amp;", "&"), "/" + name)
            if address is not None:
                found.setdefault(address, name)
    return found


GONE = "the address is gone"


def link_problem(address: str) -> str | None:
    if in_project_site(address) or address == "/404.html":  # the not-found page names itself and has no row
        return None
    page = address.split("#")[0]
    row = BY_PATH.get(address) or BY_PATH.get(page)
    if row is not None:
        return GONE if row["kind"] == "gone" else dead_reason(address)
    if not page.endswith((".html", "/")) and file_of(page).is_file():
        return None  # a file that is not a page (a PDF, an image, a data file) and is in the repository
    return "no row in the address ledger and no such file"


def test_absolute_links_to_this_host_resolve() -> None:
    links = absolute_links()
    assert len(links) > 300, "the scan found too few links to be reading the pages"
    broken = {address: f"{link_problem(address)} (on {page})" for address, page in links.items() if link_problem(address)}
    unexpected = {a: why for a, why in broken.items() if a.split("#")[0] not in KNOWN_DEAD}
    assert not unexpected, "absolute links that lead nowhere:\n" + "\n".join(f"{a}: {why}" for a, why in sorted(unexpected.items()))
    healed = [a for a in KNOWN_DEAD if a not in {b.split("#")[0] for b in broken}]
    assert not healed, f"these now answer or are no longer linked; remove them from KNOWN_DEAD: {healed}"


def test_the_check_catches_a_dead_address() -> None:
    assert dead_reason("/no-such-page-anywhere.html") == "no page at /no-such-page-anywhere.html"
    assert dead_reason("/flywheel.html#no-such-place-on-the-page") is not None
    assert dead_reason("/flywheel.html") is None
    # a synthetic gone row: a link to a withdrawn address is a dead link
    fixture = {"path": "/fixture-withdrawn.html", "kind": "gone", "surface": "unassigned", "since": "2026-01-01", "removed": "0123abc"}
    BY_PATH[fixture["path"]] = fixture
    try:
        assert link_problem("/fixture-withdrawn.html") == GONE
    finally:
        del BY_PATH[fixture["path"]]
    assert link_problem("/no-such-file.pdf") is not None
    assert link_problem("/cmmns/install.html") is None


def test_not_found_page_reads_without_scripts() -> None:
    page = (ROOT / "404.html").read_text(encoding="utf-8")
    plain = re.sub(r"<script\b.*?</script>", "", page, flags=re.S)
    for path in list(SIX_AND_THE_DOOR) + ["/site-index.html"]:
        assert f'href="{path}"' in plain, f"404.html does not list {path} without scripts"
    assert f'fetch("/{LEDGER_PATH}")' in page
    assert '<meta name="robots" content="noindex">' in page
    # the page is served for any depth of address, so nothing on it may be relative
    relative = [m for m in re.findall(r'(?:href|src)="([^"]+)"', page) if not m.startswith(("/", "#", "https://"))]
    assert not relative, relative
    assert chr(0x2014) not in page  # no em dash


def test_builder_check_agrees() -> None:
    node = shutil.which("node")
    if node is None:
        pytest.skip("node is not installed")
    done = subprocess.run([node, "scripts/build-addresses.mjs", "--check"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    assert done.returncode == 0, done.stdout + done.stderr
