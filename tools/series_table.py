"""Render the "Continue the series" table from the series definition, and keep every copy current.

One definition (publications/data/series/<id>.json) drives every table: the opener, the anchor
piece, each published part and the series hub carry the same rows, with the current page marked.
The opener is the optional "Start here" row above the anchor: the author's own account of why
the series exists. It has no blade in the aperture; it is the core the blades turn around.
A part with an id is published and linked, with its reading time measured from its page.
A part without an id is planned: plain text, no link, no reading time.

Publishing a part means adding its id to the definition, then running

    python tools/series_table.py            # rewrite the table on every published page
    python tools/build_publications.py ...  # rebuild the hub, which renders the same table

and the test suite runs ``python tools/series_table.py --check`` so no copy can drift.
"""
from __future__ import annotations

import argparse
import html
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.publication_sections import human_date, load_series  # noqa: E402

BEGIN = "<!-- BEGIN GENERATED SERIES TABLE -->"
END = "<!-- END GENERATED SERIES TABLE -->"
WORDS_PER_MINUTE = 230
STYLESHEET = "system/series-table.css?v=20261001-series-opener"


def _e(value: object) -> str:
    return html.escape(str(value), quote=True)


def _strip_collapsed(markup: str) -> str:
    """Drop <details> blocks, innermost first: a reader sees their summary, not their ledger."""
    pattern = re.compile(r"<details\b(?:(?!<details\b).)*?</details>", re.S)
    while True:
        reduced = pattern.sub("", markup)
        if reduced == markup:
            return reduced
        markup = reduced


def reading_words(page: str) -> int:
    """Words a reader meets in the main text: no sources list, collapsed ledgers, figures or this table."""
    main = page[page.index("<main"):page.index("</main>")]
    if BEGIN in main:
        main = main[:main.index(BEGIN)] + main[main.index(END) + len(END):]
    main = re.sub(r"<(script|style|svg|figure)\b.*?</\1>", " ", main, flags=re.S)
    cut = main.find('id="sources"')
    if cut > 0:
        main = main[:cut]
    main = _strip_collapsed(main)
    return len(html.unescape(re.sub(r"<[^>]+>", " ", main)).split())


def reading_minutes(page: str) -> int:
    """Minutes at 230 words a minute; past 15 minutes, rounded to the nearest five so edits do not churn it."""
    minutes = max(1, math.ceil(reading_words(page) / WORDS_PER_MINUTE))
    return minutes if minutes < 15 else int(5 * round(minutes / 5))


def series_rows(series: dict) -> list[dict]:
    """The opener (if any), the anchor, then the parts in order.

    Each row: part label, title, question, route or None. The opener's n is "start", so the
    numbered rows 0 to 5 keep their blades and their hover links.
    """
    anchor = series["anchor"]
    rows = []
    opener = series.get("opener")
    if opener:
        rows.append({"n": "start", "label": "Start here", "title": opener["text"],
                     "question": opener["question"], "route": opener["href"],
                     "id": opener["href"].removesuffix(".html")})
    rows.append({"n": 0, "label": "Anchor", "title": anchor["text"], "question": anchor["question"],
                 "route": anchor["href"], "id": anchor["href"].removesuffix(".html")})
    for number, part in enumerate(series["parts"], start=1):
        rows.append({"n": number, "label": f"Part {number}", "title": part["title"],
                     "question": part["one_line"], "id": part["id"],
                     "route": f'{part["id"]}.html' if part["id"] else None})
    return rows


def carrier_routes(series: dict) -> list[str]:
    """Every page that carries the table: the anchor, each published part and the hub."""
    return [row["route"] for row in series_rows(series) if row["route"]] + [series["route"]]


def _orb(n: int | str, state: str) -> str:
    """A small aperture glyph: rings of fine line for a published piece, one broken ring for a planned one."""
    if state == "planned":
        rings = '<circle r="9" class="sc-ring sc-ring-open"/>'
    else:
        rings = "".join(f'<circle r="{r}" class="sc-ring"/>' for r in (3, 6, 9, 12))
        rings += '<circle r="1.6" class="sc-core"/>'
    return (f'<svg class="sc-orb sc-orb-{state}" viewBox="-14 -14 28 28" width="28" height="28" '
            f'aria-hidden="true" focusable="false"><g style="--i:{n}">{rings}</g></svg>')


def _blade(n: int, state: str) -> str:
    """One aperture blade: a fan of fine lines, so the series reads as an iris that opens as parts publish."""
    angle = n * 60 - 90
    lines = []
    for k in range(9):
        spread = -18 + k * 4.5
        a = math.radians(angle + spread)
        r0, r1 = 20 + abs(spread) * 0.35, 54 - abs(spread) * 0.55
        lines.append(f'M{r0 * math.cos(a):.2f} {r0 * math.sin(a):.2f}L{r1 * math.cos(a):.2f} {r1 * math.sin(a):.2f}')
    lo, hi = math.radians(angle - 29), math.radians(angle + 29)
    hit = (f'M{16 * math.cos(lo):.2f} {16 * math.sin(lo):.2f}L{58 * math.cos(lo):.2f} {58 * math.sin(lo):.2f}'
           f'A58 58 0 0 1 {58 * math.cos(hi):.2f} {58 * math.sin(hi):.2f}'
           f'L{16 * math.cos(hi):.2f} {16 * math.sin(hi):.2f}Z')
    return (f'<path class="sc-blade sc-blade-{state}" data-part="{n}" d="{" ".join(lines)}"/>'
            f'<path class="sc-hit" data-part="{n}" d="{hit}"/>')


def _aperture(states: list[str], core: str = "published") -> str:
    """Six blades for the anchor and the five parts. The core is the opener: hot on its own page."""
    blades = "".join(_blade(n, state) for n, state in enumerate(states))
    halo = "".join(f'<circle r="{r}" class="sc-halo"/>' for r in (6, 10, 14, 58))
    core_class = "sc-core sc-core-current" if core == "current" else "sc-core"
    return (f'<svg class="sc-aperture" viewBox="-60 -60 120 120" aria-hidden="true" focusable="false">'
            f'{halo}{blades}<circle r="2.4" class="{core_class}"/></svg>')


def _row(row: dict, state: str, items_by_id: dict[str, dict], minutes: dict[str, int]) -> str:
    n, current = row["n"], state == "current"
    if row["route"]:
        item = items_by_id[row["id"]]
        date = f'<time datetime="{_e(item["published_at"])}">{human_date(item["published_at"])}</time>'
        title = _e(row["title"]) if current else f'<a href="{_e(row["route"])}">{_e(row["title"])}</a>'
        status = f'Published {date}'
        if current:
            status += ' <span class="sc-here">You are here</span>'
        time = f'{minutes[row["route"]]} min'
    else:
        title, status, time = _e(row["title"]), "Planned", '<span class="sc-none">Not yet</span>'
    opener = " sc-opener" if n == "start" else ""
    attrs = f' data-part="{n}" class="sc-row sc-{state}{opener}"' + (' aria-current="page"' if current else "")
    return (f'<tr{attrs}><td class="sc-part" data-label="Part">{_orb(n, "planned" if state == "planned" else "lit")}'
            f'<span>{_e(row["label"])}</span></td>'
            f'<th scope="row" class="sc-title">{title}</th>'
            f'<td class="sc-question" data-label="Question">{_e(row["question"])}</td>'
            f'<td class="sc-status" data-label="Status">{status}</td>'
            f'<td class="sc-time" data-label="Reading time">{time}</td></tr>')


def _states(rows: list[dict], current_route: str | None) -> list[str]:
    return ["current" if row["route"] and row["route"] == current_route
            else "published" if row["route"] else "planned" for row in rows]


def render_table(series: dict, items_by_id: dict[str, dict], minutes: dict[str, int],
                 current_route: str | None = None) -> str:
    rows = series_rows(series)
    states = _states(rows, current_route)
    numbered = [(row, state) for row, state in zip(rows, states) if row["n"] != "start"]
    opener = [(row, state) for row, state in zip(rows, states) if row["n"] == "start"]
    published = sum(1 for row, _state in numbered if row["route"])
    body = "".join(_row(row, state, items_by_id, minutes) for row, state in zip(rows, states))
    hub = "" if current_route == series["route"] else (
        f' <a href="{_e(series["route"])}">The series hub</a> explains how the pieces connect.')
    start = ""
    if opener and current_route != series["route"]:  # the hub names the opener under its own lead
        row, state = opener[0]
        start = (f' <em>{_e(row["title"])}</em> opens it: who is asking the questions, and why.'
                 if state == "current" else
                 f' Start with <a href="{_e(row["route"])}"><em>{_e(row["title"])}</em></a>: '
                 f'who is asking the questions, and why.')
    return (
        f'<section class="series-continue" id="continue-the-series" aria-labelledby="continue-the-series-h">'
        f'<div class="sc-head">{_aperture([state for _row_, state in numbered], opener[0][1] if opener else "published")}'
        f'<div><h2 id="continue-the-series-h">Continue the series</h2>'
        f'<p class="sc-lede"><em>{_e(series["anchor"]["text"])}</em> and the five pieces that each test one '
        f'question it raises. {published} of {len(numbered)} are published; the rest are named without links '
        f'until they are.{start}{hub}</p></div></div>'
        f'<div class="sc-wrap"><table class="sc-table"><caption class="sc-caption">Reading order for the '
        f'{_e(series["anchor"]["text"])} series</caption><thead><tr><th scope="col">Part</th>'
        f'<th scope="col">Title</th><th scope="col">The question it answers</th><th scope="col">Status</th>'
        f'<th scope="col">Reading time</th></tr></thead><tbody>{body}</tbody></table></div>'
        f'<p class="sc-note">Reading time counts the main text at {WORDS_PER_MINUTE} words a minute, '
        f'without the sources or the collapsed ledgers.</p></section>'
    )


def load_context(root: Path, series_id: str) -> tuple[dict, dict[str, dict], dict[str, int]]:
    series = load_series(root, series_id)
    index = json.loads((root / "publications/data/index.json").read_text(encoding="utf-8"))
    items_by_id = {item["id"]: item for item in index["records"] + index["listings"]}
    minutes = {row["route"]: reading_minutes((root / row["route"]).read_text(encoding="utf-8"))
               for row in series_rows(series) if row["route"]}
    return series, items_by_id, minutes


def replace_block(page: str, block: str) -> str:
    if page.count(BEGIN) != 1 or page.count(END) != 1:
        raise ValueError("page must carry exactly one series-table marker pair")
    head, rest = page.split(BEGIN, 1)
    return head + BEGIN + "\n" + block + "\n" + END + rest.split(END, 1)[1]


def sync(root: Path, series_id: str, check: bool) -> list[str]:
    """Rewrite (or, with check, compare) the table on every carrier page except the generated hub."""
    series, items_by_id, minutes = load_context(root, series_id)
    stale = []
    for route in carrier_routes(series)[:-1]:
        path = root / route
        page = path.read_text(encoding="utf-8")
        updated = replace_block(page, render_table(series, items_by_id, minutes, route))
        if updated != page:
            stale.append(route)
            if not check:
                path.write_bytes(updated.encode("utf-8"))
    return stale


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if any table differs from the definition")
    parser.add_argument("--series", default="who-knew-first")
    args = parser.parse_args()
    stale = sync(ROOT, args.series, args.check)
    if args.check and stale:
        print("series table out of date on: " + ", ".join(stale), file=sys.stderr)
        return 1
    print(("stale: " if args.check else "updated: ") + (", ".join(stale) or "none"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
