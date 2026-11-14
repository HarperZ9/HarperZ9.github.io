"""Write the contribution record on portfolio.html from the census.

career/open-source-census.json holds every pull request sent to a repository
someone else owns, as GitHub reports it (tools/pr_census.py refreshes it).
career/open-source-notes.json holds one plain line for each of them. This joins
the two and writes the merged, open and closed lists between two markers on the
page, so the page lists what the census lists and no more.

    python tools/render_contribution_record.py            # rewrite the page
    python tools/render_contribution_record.py --check    # exit 1 if stale
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
from html import escape

ROOT = pathlib.Path(__file__).resolve().parent.parent
CENSUS = ROOT / "career" / "open-source-census.json"
NOTES = ROOT / "career" / "open-source-notes.json"
PAGE = ROOT / "portfolio.html"
START = "<!-- contribution-record:start -->"
END = "<!-- contribution-record:end -->"

# bucket -> (heading, census key for the count, date field, word before the date)
GROUPS = (
    ("merged", "Merged", "merged", "closed_at", "merged"),
    ("open", "Open", "open", "created_at", "opened"),
    ("closed_unmerged", "Closed without merge", "closed", "closed_at", "closed"),
)


def stamp(key: str, value: object) -> str:
    return f'<span data-census="{key}">{value}</span>'


def entry(item: dict, notes: dict, field: str, word: str) -> str:
    url = item["url"]
    if url not in notes:
        raise SystemExit(f"no plain line for {url} in {NOTES.name}")
    number = url.rsplit("/", 1)[1]
    date = (item.get(field) or "")[:10]
    if not date:
        raise SystemExit(f"{url}: census has no {field}")
    label = escape(f"{item['repo']} #{number}")
    return (
        f'      <li><a class="inline" href="{escape(url)}" rel="noopener">{label}</a>, '
        f"{word} {date}. {escape(notes[url]['line'])}</li>"
    )


def render(census: dict, notes: dict) -> str:
    b, t = census["buckets"], census["totals"]
    out = [
        START,
        "    <p>I have sent "
        + stamp("all", t["all"])
        + " pull requests to "
        + stamp("repos", t["repos"])
        + " projects I do not own. Maintainers merged "
        + stamp("merged", b["merged"]["total"])
        + ", "
        + stamp("open", b["open"]["total"])
        + " are open, and "
        + stamp("closed", b["closed_unmerged"]["total"])
        + " were closed without merge. Of the merged, "
        + stamp("merged-engineering", b["merged"]["engineering"])
        + " change code, tests or documentation and "
        + stamp("merged-listings", b["merged"]["listings"])
        + " add one line to a public tool list. Read from the GitHub API on "
        + stamp("read-on", census["read_on"])
        + " (UTC).</p>",
    ]
    for bucket, heading, key, field, word in GROUPS:
        items = sorted(
            b[bucket]["items"],
            key=lambda i: ((i.get(field) or ""), i["url"].lower()),
            reverse=True,
        )
        out.append(f"    <h3>{heading} ({stamp(key, len(items))})</h3>")
        out.append('    <ol class="bul">')
        out.extend(entry(i, notes, field, word) for i in items)
        out.append("    </ol>")
    out.append("    " + END)
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="exit 1 if the page is stale")
    args = ap.parse_args()

    census = json.loads(CENSUS.read_text(encoding="utf-8"))
    notes = json.loads(NOTES.read_text(encoding="utf-8"))["notes"]
    listed = {i["url"] for v in census["buckets"].values() for i in v["items"]}
    extra = sorted(set(notes) - listed)
    if extra:
        raise SystemExit(f"{NOTES.name} names pull requests the census does not: {extra}")

    source = PAGE.read_text(encoding="utf-8")
    if source.count(START) != 1 or source.count(END) != 1:
        raise SystemExit(f"{PAGE.name} needs exactly one pair of contribution-record markers")
    head, rest = source.split(START, 1)
    tail = rest.split(END, 1)[1]
    updated = head + render(census, notes) + tail
    if updated == source:
        return 0
    if args.check:
        print(f"{PAGE.name}: the contribution record does not match the census and notes")
        return 1
    PAGE.write_text(updated, encoding="utf-8", newline="\n")
    print(f"rewrote the contribution record on {PAGE.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
