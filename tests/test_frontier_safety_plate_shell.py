"""Reading contracts for the plate shell of the Frontier Safety Briefing.

The markup checks run everywhere. The rendered checks need Playwright and a local
Chromium browser and skip without them; they catch what a markup check cannot see,
such as text drawn over the grain veil or print rules that clear a status mark.
"""

from __future__ import annotations

import functools
import http.server
import importlib.util
import json
import os
import re
import threading
from copy import deepcopy
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
CURRENT_EDITION_DATE = json.loads(
    (ROOT / "frontier-safety" / "data" / "current.json").read_text(encoding="utf-8")
)["edition_date"]
SYNTHETIC_ROUTE = "frontier-safety-plate-synthetic.html"


def load_builder():
    path = ROOT / "tools" / "build_frontier_safety_briefing.py"
    spec = importlib.util.spec_from_file_location("frontier_safety_plate_builder", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def current_edition() -> dict:
    path = ROOT / "frontier-safety" / "data" / "editions" / f"{CURRENT_EDITION_DATE}.json"
    return json.loads(path.read_text(encoding="utf-8"))


def changed_and_corrected_edition() -> dict:
    """One changed lane and one corrected lane, each with one matching record."""
    edition = deepcopy(current_edition())
    for lane, state in zip(edition["lanes"], ("correction", "unchanged", "changed")):
        lane["state"] = state
        for index, item in enumerate(lane["items"]):
            item["status"] = state if index == 0 else "unchanged"
    return edition


# Markup contracts.


def test_every_record_opens_on_its_title_with_the_byline_under_it() -> None:
    page = (ROOT / "frontier-safety.html").read_text(encoding="utf-8")
    bodies = re.findall(r'<div class="record-body">(.*?)</article>', page, flags=re.S)
    assert bodies
    for body in bodies:
        assert body.lstrip().startswith("<h3>"), body[:80]
        assert body.index("</h3>") < body.index('class="record-meta"') < body.index("<p>")
        assert 'class="record-status"' not in body
    changed = re.findall(r'data-status="changed">.*?</article>', page, flags=re.S)
    assert changed
    for record in changed:
        meta = record.split('class="record-meta">', 1)[1].lstrip()
        assert meta.startswith('<span class="record-change"><span class="status-mark"')


def assert_control_links_are_distinct(page: str) -> None:
    table = page.split('<tbody role="rowgroup">', 1)[1].split("</tbody>", 1)[0]
    links = re.findall(r'<a href="([^"]+)" rel="noreferrer">([^<]+)</a>', table)
    assert links
    names: dict[str, str] = {}
    for url, name in links:
        assert name.strip().lower() != "source"
        assert names.setdefault(name, url) == url, f"{name!r} names two different sources"


def test_control_source_links_name_what_they_open() -> None:
    assert_control_links_are_distinct((ROOT / "frontier-safety.html").read_text(encoding="utf-8"))


def test_uncited_control_sources_on_one_host_keep_distinct_names() -> None:
    edition = deepcopy(current_edition())
    edition["controls"][0]["sources"] = ["https://openai.com/one", "https://openai.com/two"]
    edition["controls"][1]["sources"] = ["https://openai.com/one"]
    page = load_builder().render_html(edition, archive=False)
    assert_control_links_are_distinct(page)
    assert ">source (openai.com)</a>" in page and ">source (openai.com) 2</a>" in page


def test_brand_and_browser_bar_follow_the_site() -> None:
    page = (ROOT / "frontier-safety.html").read_text(encoding="utf-8")
    assert "ZentropyLabs" not in page
    assert "Compiled by Zain Dana Harper · Zentropy Labs ·" in page
    assert (
        '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ebe5d8">'
        in page
    )
    assert (
        '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#060608">'
        in page
    )


def test_a_corrected_lane_draws_a_hollow_mark_beside_the_changed_one() -> None:
    html = load_builder().render_html(changed_and_corrected_edition(), archive=False)
    rail = html.split('<nav class="delta-rail"', 1)[1].split("</nav>", 1)[0]
    assert rail.count("rail-changed") == 1
    assert rail.count("rail-correction") == 1
    assert 'data-status="correction"' in html
    assert "Corrected in this edition" in html


# Rendered contracts.


class _Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".woff2": "font/woff2",
        ".svg": "image/svg+xml",
    }

    def log_message(self, *args) -> None:  # keep test output quiet
        pass


@pytest.fixture(scope="module")
def browser_page():
    playwright = pytest.importorskip(
        "playwright.sync_api",
        reason="rendered briefing contracts require the optional Playwright dependency",
    )
    candidates = [
        Path(os.environ.get("PROGRAMFILES", "C:/Program Files")) / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", "C:/Program Files (x86)")) / "Microsoft/Edge/Application/msedge.exe",
    ]
    browser_path = next((path for path in candidates if path.exists()), None)
    if browser_path is None:
        pytest.skip("rendered briefing contracts require a local Chromium browser")
    server = http.server.ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(_Handler, directory=str(ROOT))
    )
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    with playwright.sync_playwright() as runtime:
        browser = runtime.chromium.launch(executable_path=str(browser_path), headless=True)

        def open_page(route: str, *, width: int, scheme: str = "light", html: str | None = None):
            page = browser.new_page(viewport={"width": width, "height": 900}, color_scheme=scheme)
            if html is not None:
                page.route(f"{base}/{route}", lambda r: r.fulfill(body=html, content_type="text/html"))
            page.goto(f"{base}/{route}", wait_until="load")
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(300)
            return page

        yield open_page
        browser.close()
    server.shutdown()


FIRST_OPAQUE_GROUND = """() => {
  const texts = [...document.querySelectorAll(
    'main p, main li, main td, main h2, main h3, .frame h1, .frame p, .frame dd, footer p')]
    .filter(e => e.getBoundingClientRect().height > 0 && e.innerText.trim().length > 3);
  const onField = [];
  for (const e of texts) {
    let q = e;
    while (q && q !== document.body && q !== document.documentElement) {
      const bg = getComputedStyle(q).backgroundColor;
      if (bg !== 'rgba(0, 0, 0, 0)' && !/, 0\\)$/.test(bg)) break;
      q = q.parentElement;
    }
    if (!q || q === document.body || q === document.documentElement) onField.push(e.innerText.slice(0, 48));
  }
  return {count: texts.length, onField};
}"""


@pytest.mark.parametrize("scheme", ["light", "dark"])
@pytest.mark.parametrize("width", [390, 1280])
def test_every_text_line_sits_on_a_flat_ground(browser_page, width: int, scheme: str) -> None:
    page = browser_page("frontier-safety.html", width=width, scheme=scheme)
    grounds = page.evaluate(FIRST_OPAQUE_GROUND)
    page.close()
    assert grounds["count"] > 40
    assert grounds["onField"] == [], "text over the grain veil and registration field"


def test_print_keeps_the_filled_mark_and_the_type_ladder(browser_page) -> None:
    page = browser_page("frontier-safety.html", width=1280)
    page.emulate_media(media="print")
    measured = page.evaluate(
        """() => {
          const style = s => getComputedStyle(document.querySelector(s));
          const size = s => parseFloat(style(s).fontSize);
          const filled = s => style(s).backgroundColor !== 'rgba(0, 0, 0, 0)' || style(s).backgroundImage !== 'none';
          return {
            railFilled: filled('.rail-changed .rail-symbol'),
            recordFilled: filled('.record[data-status="changed"] .status-mark'),
            ladder: [size('.briefing-intro h1'), size('.edition-readout > div:first-child dd'),
                     size('main h2'), size('.record-body h3'), size('.record-body > p')],
          };
        }"""
    )
    page.close()
    assert measured["railFilled"] and measured["recordFilled"]
    ladder = measured["ladder"]
    assert ladder == sorted(ladder, reverse=True) and len(set(ladder)) == len(ladder), ladder


def test_the_rail_holds_one_filled_mark_when_a_lane_is_corrected(browser_page) -> None:
    html = load_builder().render_html(changed_and_corrected_edition(), archive=False)
    page = browser_page(SYNTHETIC_ROUTE, width=1280, html=html)
    marks = page.evaluate(
        """() => {
          const fill = e => getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)';
          const corrected = document.querySelector('.record[data-status="correction"] .status-mark');
          return {
            railFilled: [...document.querySelectorAll('.delta-rail .rail-symbol')].filter(fill).length,
            correctedFilled: fill(corrected),
            correctedRound: getComputedStyle(corrected).borderTopLeftRadius,
          };
        }"""
    )
    page.close()
    assert marks["railFilled"] == 1
    assert marks["correctedFilled"] is False
    assert marks["correctedRound"] == "50%"
