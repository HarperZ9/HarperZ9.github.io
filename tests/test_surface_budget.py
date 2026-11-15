"""A surface page stays inside its loading budget, and reads without scripts.

Budget per surface (the six-surfaces plan): HTML 120 KB, eager JavaScript 60 KB, eager CSS 80 KB,
eager data 50 KB, in bytes as the files are stored (1 KB is 1024 bytes).

Eager means everything the browser fetches before any press: the document, every stylesheet and
script it names, every module those scripts import statically (followed to the end), every inline
script, and any data the document embeds or preloads. A module brought in by import() and a file
fetched after a press are not eager; the page states their size beside the press.

The shared shell every generated page loads takes 59.6 KB of the 60 KB of JavaScript on its own,
so a surface has under 2 KB of eager script to spend. The test reports each total when it fails.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
KB = 1024
BUDGET = {"html": 120 * KB, "js": 60 * KB, "css": 80 * KB, "data": 50 * KB}
SURFACES = sorted(p.stem for p in (ROOT / "site-src/world/surfaces").glob("*.mjs"))
PAGES = {"playground": "playground/index.html"}

STATIC_IMPORT = re.compile(r"""(?:^|[;\n])\s*(?:import|export)\s+(?:[^'"()]*?\sfrom\s*)?['"]([^'"]+)['"]""")


def local(page: str, ref: str) -> Path | None:
    ref = ref.split("?")[0].split("#")[0]
    if re.match(r"^[a-z]+:", ref) or ref.startswith("//") or not ref:
        return None
    return ROOT / ref.lstrip("/") if ref.startswith("/") else (ROOT / page).parent / ref


def closure(start: Path, seen: set[Path]) -> set[Path]:
    """A module and every module it imports statically."""
    start = start.resolve()
    if start in seen or not start.is_file():
        return seen
    seen.add(start)
    for ref in STATIC_IMPORT.findall(start.read_text(encoding="utf-8", errors="replace")):
        if ref.startswith(("./", "../", "/")):
            closure((ROOT / ref.lstrip("/")) if ref.startswith("/") else start.parent / ref.split("?")[0], seen)
    return seen


def eager(page: str) -> dict[str, int]:
    html = (ROOT / page).read_text(encoding="utf-8")
    scripts: set[Path] = set()
    for src in re.findall(r"<script\b[^>]*\bsrc=\"([^\"]+)\"", html):
        target = local(page, src)
        assert target is not None and target.is_file(), f"{page} names a script that is not in the repository: {src}"
        closure(target, scripts)
    for href in re.findall(r"<link\b[^>]*rel=\"modulepreload\"[^>]*href=\"([^\"]+)\"", html):
        closure(local(page, href), scripts)
    inline = re.findall(r"<script\b([^>]*)>(.*?)</script>", html, re.S)
    inline_js = sum(len(body.encode()) for attrs, body in inline if "src=" not in attrs and "json" not in attrs)
    inline_data = sum(len(body.encode()) for attrs, body in inline if "src=" not in attrs and "json" in attrs)
    sheets = [local(page, h) for h in re.findall(r"<link\b[^>]*rel=\"stylesheet\"[^>]*href=\"([^\"]+)\"", html)]
    assert all(s is not None and s.is_file() for s in sheets), f"{page} names a stylesheet that is not in the repository"
    preloaded = [local(page, h) for h in re.findall(r"<link\b[^>]*rel=\"preload\"[^>]*as=\"fetch\"[^>]*href=\"([^\"]+)\"", html)]
    return {
        "html": len(html.encode()),
        "js": sum(s.stat().st_size for s in scripts) + inline_js,
        "css": sum(s.stat().st_size for s in sheets),
        "data": inline_data + sum(p.stat().st_size for p in preloaded if p),
    }


def test_every_surface_manifest_has_a_page() -> None:
    assert SURFACES, "no surface manifest found"
    assert set(SURFACES) == set(PAGES), "a manifest has no page listed here, or a page has no manifest"


@pytest.mark.parametrize("surface", SURFACES)
def test_surface_is_inside_its_loading_budget(surface: str) -> None:
    totals = eager(PAGES[surface])
    over = {kind: f"{totals[kind]} bytes, budget {BUDGET[kind]}" for kind in BUDGET if totals[kind] > BUDGET[kind]}
    assert not over, f"{PAGES[surface]} is over budget: {over} (all totals: {totals})"
    # the measure reads real files: the shell alone is tens of kilobytes of script and of CSS
    assert totals["js"] > 40 * KB and totals["css"] > 40 * KB and totals["html"] > 8 * KB, totals


def test_the_measure_follows_static_imports_and_not_dynamic_ones() -> None:
    shell = closure(ROOT / "world/ui/shell/shell.js", set())
    assert len(shell) >= 5, "the shell's static imports were not followed"
    start = closure(ROOT / "world/site/surfaces/surface-start.js", set())
    names = {p.name for p in start}
    assert names == {"surface-start.js"}, f"the start script pulls in more than itself before a press: {names}"
    page = closure(ROOT / "world/site/surfaces/surface-page.mjs", set())
    assert {"registry.mjs", "bus.mjs", "bus-kernel.mjs"} <= {p.name for p in page}
    sample = "import a from './a.mjs';\nimport './b.mjs';\nexport { c } from \"./c.mjs\";\nconst d = () => import('./d.mjs');\n"
    assert STATIC_IMPORT.findall(sample) == ["./a.mjs", "./b.mjs", "./c.mjs"]


@pytest.mark.parametrize("surface", SURFACES)
def test_surface_reads_without_scripts(surface: str) -> None:
    html = (ROOT / PAGES[surface]).read_text(encoding="utf-8")
    body = html[html.index('<main id="main"') : html.index("</main>")]
    plain = re.sub(r"<script\b.*?</script>", "", body, flags=re.S)
    plain = re.sub(r"<(\w+)\b[^>]*\shidden(?:=\"\")?[^>]*>.*?</\1>", "", plain, flags=re.S)  # what scripts reveal later
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", plain))
    assert 'class="demo-form"' in plain, "the form label is not in the no-script reading"
    for words in ("The blend table", "Lettering", "Motion curve", "Shown as built", "Instruments and study tools"):
        assert words in text, f"without scripts the page does not say: {words}"
    assert re.search(r"<svg\b[^>]*role=\"img\"[^>]*aria-label=\"[^\"]+\"", plain), "the still's curve has no text alternative"
    assert re.search(r'<button[^>]*id="sx-start"[^>]*hidden', body), "the start press must stay hidden until a script can answer it"
    assert len(re.findall(r'<a href="/', plain)) >= 10, "the places are links in the page itself"
    assert chr(0x2014) not in body  # no em dash
    assert not re.search(r"[A-Z]:[\\/]", text), "a local path is on the page"


def test_surface_pages_match_a_fresh_build() -> None:
    node = shutil.which("node")
    if node is None:
        pytest.skip("node is not installed")
    done = subprocess.run([node, "scripts/build-surfaces.mjs", "--check"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    assert done.returncode == 0, done.stdout + done.stderr
