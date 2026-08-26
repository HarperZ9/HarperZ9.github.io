"""Count the pull requests sent into repositories someone else owns.

The career pages state how much of this work has been accepted upstream. Those
numbers used to be transcribed by hand with a "counted on" date beside them,
which is the same as asking a reader to trust them. This asks GitHub instead,
writes the answer to career/open-source-census.json, and stamps the counts back
into the pages. tests/test_open_source_census.py fails if a page and the census
ever disagree, so a stale number is a broken build rather than a quiet lie.

    python tools/pr_census.py            # refresh the census file
    python tools/pr_census.py --apply    # refresh, then stamp the pages
    python tools/pr_census.py --check    # exit 1 if the pages are stale

A "listing" is a pull request that adds one row naming a tool to a public
"awesome" index. It changes no software, so it is counted apart from the
engineering work rather than folded into the same total.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CENSUS = ROOT / "career" / "open-source-census.json"
USER = "HarperZ9"

QUERIES = {
    "merged": f"author:{USER} is:pr is:merged -user:{USER}",
    "open": f"author:{USER} is:pr is:open -user:{USER}",
    "closed_unmerged": f"author:{USER} is:pr is:closed is:unmerged -user:{USER}",
}

# Pages that carry a census number, and the element ids that hold it.
STAMPED = ("hire.html", "portfolio.html", "resume.html", "cv.html", "dossier.html", "cover-letter.html")


def is_listing(repo: str) -> bool:
    return "awesome" in repo.lower()


def search(query: str) -> dict:
    out = subprocess.run(
        ["gh", "api", "-X", "GET", "search/issues", "-f", f"q={query}", "-f", "per_page=100"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if out.returncode != 0:
        raise SystemExit(f"gh search failed for {query!r}:\n{out.stderr.strip()}")
    return json.loads(out.stdout)


def collect() -> dict:
    census: dict = {"user": USER, "buckets": {}}
    for bucket, query in QUERIES.items():
        payload = search(query)
        total = payload.get("total_count", 0)
        items = []
        for item in payload.get("items", []):
            repo = item["repository_url"].split("/repos/", 1)[1]
            items.append(
                {
                    "repo": repo,
                    "title": item["title"],
                    "url": item["html_url"],
                    "listing": is_listing(repo),
                    "closed_at": item.get("closed_at"),
                }
            )
        if total != len(items):
            # The search API pages at 100. Every bucket is well under that today;
            # if one ever passes it, say so rather than publishing a short count.
            raise SystemExit(
                f"{bucket}: GitHub reports {total} but returned {len(items)}. "
                "Paginate the query before trusting this number."
            )
        engineering = [i for i in items if not i["listing"]]
        listings = [i for i in items if i["listing"]]
        census["buckets"][bucket] = {
            "total": total,
            "engineering": len(engineering),
            "listings": len(listings),
            "engineering_repos": len({i["repo"] for i in engineering}),
            "repos": len({i["repo"] for i in items}),
            "items": items,
        }
    b = census["buckets"]
    census["totals"] = {
        "all": sum(v["total"] for v in b.values()),
        "engineering": sum(v["engineering"] for v in b.values()),
        "listings": sum(v["listings"] for v in b.values()),
        "engineering_repos": len(
            {i["repo"] for v in b.values() for i in v["items"] if not i["listing"]}
        ),
    }
    return census


def numbers(census: dict) -> dict[str, str]:
    """The values the pages are allowed to state, keyed by data-census id."""
    b, t = census["buckets"], census["totals"]
    return {
        "all": str(t["all"]),
        "engineering": str(t["engineering"]),
        "listings": str(t["listings"]),
        "engineering-repos": str(t["engineering_repos"]),
        "merged": str(b["merged"]["total"]),
        "merged-engineering": str(b["merged"]["engineering"]),
        "merged-engineering-repos": str(b["merged"]["engineering_repos"]),
        "merged-listings": str(b["merged"]["listings"]),
        "open": str(b["open"]["total"]),
        "open-engineering": str(b["open"]["engineering"]),
        "open-engineering-repos": str(b["open"]["engineering_repos"]),
        "open-listings": str(b["open"]["listings"]),
        "closed": str(b["closed_unmerged"]["total"]),
        "closed-engineering": str(b["closed_unmerged"]["engineering"]),
        "closed-engineering-repos": str(b["closed_unmerged"]["engineering_repos"]),
        "closed-listings": str(b["closed_unmerged"]["listings"]),
    }


# <span data-census="merged">25</span>
SPAN = re.compile(r'(<(?:span|b)\s+data-census="([a-z-]+)"[^>]*>)([^<]*)(</(?:span|b)>)')


def stamp(values: dict[str, str], write: bool) -> list[str]:
    """Rewrite every data-census element. Returns the list of stale ones found."""
    stale: list[str] = []
    for name in STAMPED:
        path = ROOT / name
        if not path.exists():
            continue
        source = path.read_text(encoding="utf-8")

        def sub(m: re.Match) -> str:
            key = m.group(2)
            if key not in values:
                raise SystemExit(f"{name}: unknown census key {key!r}")
            if m.group(3) != values[key]:
                stale.append(f"{name}: {key} says {m.group(3)!r}, census says {values[key]!r}")
            return m.group(1) + values[key] + m.group(4)

        updated = SPAN.sub(sub, source)
        if write and updated != source:
            path.write_text(updated, encoding="utf-8")
    return stale


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="stamp the refreshed counts into the pages")
    ap.add_argument("--check", action="store_true", help="do not call GitHub; compare pages to the stored census")
    args = ap.parse_args()

    if args.check:
        census = json.loads(CENSUS.read_text(encoding="utf-8"))
    else:
        census = collect()
        CENSUS.parent.mkdir(parents=True, exist_ok=True)
        CENSUS.write_text(json.dumps(census, indent=1) + "\n", encoding="utf-8")

    values = numbers(census)
    stale = stamp(values, write=args.apply)

    b = census["buckets"]
    print(f"third-party pull requests: {census['totals']['all']}")
    for bucket in ("merged", "open", "closed_unmerged"):
        v = b[bucket]
        print(
            f"  {bucket:16} {v['total']:>3}   engineering {v['engineering']:>3}"
            f" across {v['engineering_repos']:>3} repos   listings {v['listings']:>3}"
        )
    print(f"  {'engineering only':16} {census['totals']['engineering']:>3}"
          f"   listings {census['totals']['listings']:>3}")

    if stale:
        print("\nstale on the pages:" if not args.apply else "\nrestamped:")
        for line in stale:
            print("  " + line)
        if not args.apply:
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
