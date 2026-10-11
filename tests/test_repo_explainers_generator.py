"""The repository-explainer generator (tools/repo_explainers) reproduces what the site serves.

- Building every source page gives, byte for byte, the copy under repo-explainers/ for each page
  the site publishes, so the published pages cannot drift from their sources.
- Regenerating each spec-built page from specs/ gives its source page, apart from the Watch
  section, which follows the current release media.
- The generator never promises a video: no Watch section says "coming with the next release",
  and a repository with neither release films nor a fitting concept film gets no Watch section.
- Release films come from the latest tag under media/releases/<repo>/.
"""

import importlib.util
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "repo_explainers"
sys.path.insert(0, str(TOOL))



def _load(name: str):
    spec = importlib.util.spec_from_file_location(f"repo_explainers_{name}", TOOL / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


build = _load("build")
gen = _load("gen")
wt = sys.modules["walkthroughs"]  # the module gen.py imported, so patches here reach it

SOURCES = sorted((TOOL / "pages").glob("*.src.html"))
WATCH = re.compile(r'<section class="block wrap" aria-labelledby="watch">.*?</section>\n*', re.S)


def slug(p: Path) -> str:
    return p.name.replace(".src.html", "")


def test_there_are_sources_and_specs() -> None:
    assert len(SOURCES) >= 30
    assert len(list((TOOL / "specs").glob("*.py"))) >= 25


@pytest.mark.parametrize("src", SOURCES, ids=slug)
def test_build_reproduces_the_published_page(src: Path) -> None:
    target = build.published(slug(src))
    if not target.exists():
        pytest.skip(f"{slug(src)} is not published on the site yet")
    assert build.built(src) == target.read_bytes(), f"{target.name} differs from its source; rebuild with build.py --publish"


@pytest.mark.parametrize("spec", sorted((TOOL / "specs").glob("*.py")), ids=lambda p: p.stem)
def test_specs_regenerate_their_source_pages(spec: Path) -> None:
    page = gen.page(gen.load(spec.stem))
    src = (TOOL / "pages" / f"{spec.stem}.src.html").read_text(encoding="utf-8")
    assert WATCH.sub("", page) == WATCH.sub("", src), spec.stem


@pytest.mark.parametrize("spec", sorted((TOOL / "specs").glob("*.py")), ids=lambda p: p.stem)
def test_the_generator_promises_no_video(spec: Path) -> None:
    page = gen.page(gen.load(spec.stem))
    assert "coming with the next release" not in page
    assert "No concept film fits this tool closely yet" not in page


def test_no_films_means_no_watch_section(monkeypatch) -> None:
    monkeypatch.setattr(wt, "release_films", lambda s: (None, []))
    assert "nothing-here" not in wt.FIT
    assert wt.watch_html("nothing-here") == ""


def test_release_films_come_from_the_latest_tag(tmp_path, monkeypatch) -> None:
    import json
    for tag in ("v0.9.0", "v0.10.0"):
        d = tmp_path / "media" / "releases" / "demo" / tag / "scene"
        d.mkdir(parents=True)
        (d / "media.json").write_text(json.dumps({"title": f"t {tag}", "duration": 61.9, "commit": "abcdef0123", "narrated": True,
                                                 "files": {"scene-1080p.mp4": "", "scene.vtt": ""}}), encoding="utf-8")
    monkeypatch.setattr(wt, "SITE_CHECKOUT", tmp_path)
    tag, films = wt.release_films("demo")
    assert tag == "v0.10.0" and films[0][1]["title"] == "t v0.10.0"
    html = wt.watch_html("demo")
    assert "v0.10.0" in html and "1 min 1 s" in html and "synthesized version of the author" in html
    assert "scene.vtt" in html and "abcdef0" in html


def test_raw_native_shows_its_release_films() -> None:
    tag, films = wt.release_films("raw-native")
    assert tag and {s for s, _, _ in films} >= {"ao-check", "first-run"}


def test_tool_has_no_local_paths_or_em_dashes() -> None:
    for p in TOOL.rglob("*"):
        if p.is_file() and p.suffix in {".py", ".html", ".css", ".js", ".md", ".sh"} and "out" not in p.parts:
            text = p.read_text(encoding="utf-8")
            assert not re.search(r"\b[A-Z]:[\\/]", text), f"{p.relative_to(ROOT)} has a local path"
            # capture/ holds sample inputs for the writing checker, which contain em dashes on purpose.
            if "capture" not in p.parts:
                assert "—" not in text, f"{p.relative_to(ROOT)} has an em dash"
