"""Inventory everything Zain Dana Harper has published, from primary sources only.

Sources, each read directly:
  GitHub      gh api: public, non-fork repositories under HarperZ9, their releases and tags
  PyPI        pypi.org/pypi/<name>/json, kept only when the project links to HarperZ9
  npm         registry.npmjs.org, kept only when the maintainer or repository is HarperZ9
  crates.io   crates.io/api/v1/crates/<name>, kept only when the repository is HarperZ9
  Zenodo      zenodo.org/api/records by ORCID 0009-0001-7175-5393, grouped by concept DOI
  Live site   each page URL must answer 200 on harperz9.github.io; dates come from the
              page's own datePublished, or from the commit that added it to the site

Nothing unpublished is listed: private repositories, drafts, forks and unreleased work stay out.

    python tools/published_work_inventory.py            # refresh career/published-work.json
    python tools/published_work_inventory.py --apply    # refresh, then write the CV group
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "career" / "published-work.json"
SOURCE = ROOT / "career" / "resume-source.json"
USER, ORCID, SITE = "HarperZ9", "0009-0001-7175-5393", "https://harperz9.github.io/"
NAME = "Harper, Zain Dana"
UA = {"User-Agent": "harperz9-published-work-inventory (github.com/HarperZ9)"}
SKIP_REPOS = {".github", "HarperZ9"}  # community defaults and the profile README
CRATES = ["buildlang"]
NPM = ["@harperz9/learn", "project-telos-mcp", "workflow-harness-lite", "buildlang"]
# Site pages that the Writing page lists as essays, letters, investigations and briefings.
WRITING = [
    "verified-is-not-trustworthy", "conferred-existence-essay", "why", "the-summary-is-not-the-record",
    "pick-the-lock-for-everyone", "pick-the-lock-for-everyone-talk", "current-story", "no-receipt-no-accept",
    "models-propose-oracles-dispose", "frontier-safety-openai-hugging-face-incident", "availability-is-not-reach",
    "the-second-hearing", "what-the-label-changes", "growth-needs-a-before", "a-witness-should-not-become-a-ruler",
    "ltj-bukem-the-man-behind-the-atmosphere", "borrowed-ground", "the-sandbox-was-never-just-a-box",
    "checking-the-machines", "who-knew-first", "support-has-more-than-one-record",
    "the-scene-the-song-did-not-tell-you", "the-timestamp-is-not-the-order", "what-the-formula-counts",
    "the-number-has-a-vintage", "the-terms-for-telling", "who-pays-the-referees", "who-knew-first-series",
    "why-i-do-this", "a-check-it-cannot-predict", "the-maker-is-part-of-the-story", "who-kept-the-books",
]
PACKETS = ["metr-count-odds-reviewer-packet.html"]
# Papers on the site with no DOI record, titled as the Writing page titles them.
SITE_PAPERS = {
    "papers/conferred-existence-paper.pdf":
        "Conferred Existence: Ontological Nihilism, the Speech-Act of Being, and the Standing of Made Minds",
    "papers/witness-and-verification.pdf": "Witness and Verification Under Bounded Rationality",
}


def get_json(url: str):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=40) as fh:
            return json.load(fh)
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return None
        print(f"inventory: {url} answered {exc.code}", file=sys.stderr)
        raise


def live(path: str) -> bool:
    req = urllib.request.Request(SITE + path, headers=UA, method="HEAD")
    try:
        with urllib.request.urlopen(req, timeout=40) as fh:
            return fh.status == 200
    except urllib.error.HTTPError:
        return False


def gh(path: str) -> list:
    proc = subprocess.run(["gh", "api", "--paginate", path], capture_output=True, text=True, encoding="utf-8")
    if proc.returncode:
        raise RuntimeError(f"gh api {path}: {proc.stderr.strip()}")
    return json.loads(proc.stdout.replace("][", ",") or "[]")


def day(stamp: str | None) -> str:
    return (stamp or "")[:10]


def repositories() -> list[dict]:
    repos = [r for r in gh(f"users/{USER}/repos?per_page=100&type=owner")
             if not r["private"] and not r["fork"] and r["name"] not in SKIP_REPOS]
    out = []
    for r in sorted(repos, key=lambda r: r["created_at"]):
        rel = sorted((x for x in gh(f"repos/{USER}/{r['name']}/releases?per_page=100") if not x["draft"]),
                     key=lambda x: x["published_at"] or "")
        tags = gh(f"repos/{USER}/{r['name']}/tags?per_page=100")
        out.append({"name": r["name"], "created": day(r["created_at"]), "archived": r["archived"],
                    "url": r["html_url"], "description": r["description"] or "",
                    "releases": len(rel), "tags": len(tags),
                    "prerelease_only": bool(rel) and all(x["prerelease"] for x in rel),
                    "first": {"tag": rel[0]["tag_name"], "date": day(rel[0]["published_at"])} if rel else None,
                    "latest": {"tag": rel[-1]["tag_name"], "date": day(rel[-1]["published_at"]),
                               "url": rel[-1]["html_url"]} if rel else None})
    return out


def pypi_names() -> list[str]:
    names = set()
    for r in gh(f"users/{USER}/repos?per_page=100&type=owner"):
        if r["private"] or r["fork"]:
            continue
        for f in ("pyproject.toml", "python/pyproject.toml"):
            proc = subprocess.run(["gh", "api", f"repos/{USER}/{r['name']}/contents/{f}", "-H",
                                   "Accept: application/vnd.github.raw"], capture_output=True, text=True,
                                  encoding="utf-8")
            m = re.search(r'^\[project\][^\[]*?^name\s*=\s*"([^"]+)"', proc.stdout, re.M | re.S)
            if proc.returncode == 0 and m:
                names.add(m.group(1))
    return sorted(names | {"flywheel-verify"})


def packages() -> list[dict]:
    out = []
    for name in pypi_names():
        d = get_json(f"https://pypi.org/pypi/{name}/json")
        if not d:
            continue
        info = d["info"]
        links = json.dumps(info.get("project_urls") or {}) + (info.get("home_page") or "")
        # Ours when the project links to HarperZ9, or names the author and matches one of our
        # repositories' pyproject names (some early uploads carry no project URLs).
        if USER.lower() not in links.lower() and info.get("author") != "Zain Dana Harper":
            continue  # a different project holds this name
        uploads = sorted(f["upload_time_iso_8601"] for fs in d["releases"].values() for f in fs)
        latest = min((f["upload_time_iso_8601"] for f in d["releases"].get(info["version"], [])), default="")
        out.append({"registry": "PyPI", "name": name, "version": info["version"], "first": day(uploads[0]),
                    "latest": day(latest), "url": f"https://pypi.org/project/{name}/"})
    for name in NPM:
        d = get_json("https://registry.npmjs.org/" + urllib.parse.quote(name, safe="@"))
        if not d or USER.lower() not in json.dumps([d.get("repository"), d.get("maintainers")]).lower():
            continue
        v = d["dist-tags"]["latest"]
        out.append({"registry": "npm", "name": name, "version": v, "first": day(d["time"]["created"]),
                    "latest": day(d["time"][v]), "url": f"https://www.npmjs.com/package/{name}"})
    for name in CRATES:
        d = get_json(f"https://crates.io/api/v1/crates/{name}")
        if not d or USER.lower() not in (d["crate"].get("repository") or "").lower():
            continue
        c = d["crate"]
        v = c["max_stable_version"] or c["max_version"]
        when = next((x["created_at"] for x in d["versions"] if x["num"] == v), c["updated_at"])
        out.append({"registry": "crates.io", "name": name, "version": v, "first": day(c["created_at"]),
                    "latest": day(when), "url": f"https://crates.io/crates/{name}"})
    return out


def papers() -> list[dict]:
    recs = {}
    # The ORCID query misses a record deposited without the ORCID link; the exact creator name finds it.
    for query in (f'creators.orcid:"{ORCID}"', f'creators.name:"{NAME}"'):
        page, seen = 1, 0
        while True:
            q = urllib.parse.urlencode({"q": query, "size": 25, "page": page, "all_versions": "true"})
            d = get_json("https://zenodo.org/api/records?" + q)
            for h in d["hits"]["hits"]:
                if any(c.get("name") == NAME for c in h["metadata"]["creators"]):
                    recs[h["id"]] = h
            seen += len(d["hits"]["hits"])
            if seen >= d["hits"]["total"] or not d["hits"]["hits"]:
                break
            page += 1
    recs = list(recs.values())
    works: dict[str, dict] = {}
    for h in recs:
        m, key = h["metadata"], h.get("conceptdoi") or h["doi"]
        w = works.setdefault(key, {"versions": []})
        w["versions"].append((m["publication_date"], h["doi"], m["title"], m["resource_type"]))
    out = []
    for concept, w in works.items():
        v = sorted(w["versions"])
        rt = v[-1][3]
        title = rt.get("title")
        kind = (title.get("en") if isinstance(title, dict) else title) or rt.get("subtype") or rt.get("type")
        kind = str(kind).capitalize()
        out.append({"title": v[-1][2], "kind": kind, "first": v[0][0], "latest": v[-1][0],
                    "versions": len(v), "doi": v[-1][1], "concept_doi": concept,
                    "url": f"https://doi.org/{v[-1][1]}"})
    for path, title in SITE_PAPERS.items():
        if live(path):
            out.append({"title": title, "kind": "Paper on the site", "first": _added(path),
                        "latest": _added(path), "versions": 1, "doi": "", "concept_doi": "", "url": SITE + path})
    return sorted(out, key=lambda p: (p["first"], p["title"]))


def _added(path: str) -> str:
    proc = subprocess.run(["git", "log", "--diff-filter=A", "--format=%as", "--", path], cwd=ROOT,
                          capture_output=True, text=True)
    return (proc.stdout.split() or [""])[-1]


def site_pages() -> list[dict]:
    out = []
    pages = [(p + ".html", "writing") for p in WRITING] + [(p, "packet") for p in PACKETS]
    pages += [(p.name, "research note") for p in sorted(ROOT.glob("research-*.html"))]
    pages += [(f"frontier-safety/archive/{p.name}", "briefing")
              for p in sorted((ROOT / "frontier-safety" / "archive").glob("*.html"))]
    for path, kind in pages:
        text = (ROOT / path).read_text(encoding="utf-8")
        title = re.search(r"<title>([^<]+)</title>", text).group(1)
        title = re.split(r"\s+(?:·|&middot;|\|)\s+", title.replace("&amp;", "&"))[0].strip()
        m = (re.match(r"frontier-safety/archive/(\d{4}-\d{2}-\d{2})", path)
             or re.search(r'"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})', text)
             or re.search(r'article:published_time" content="(\d{4}-\d{2}-\d{2})', text)
             or re.search(r'<time[^>]*datetime="(\d{4}-\d{2}-\d{2})', text))
        date = m.group(1) if m else _added(path)
        if not live(path):
            print(f"inventory: {path} is not live; left out", file=sys.stderr)
            continue
        out.append({"kind": kind, "title": title, "date": date, "date_source": "page" if m else "site commit",
                    "url": SITE + path})
    return sorted(out, key=lambda p: (p["date"], p["title"]))


def build() -> dict:
    return {"schema": "harperz9-published-work/v1", "read": dt.date.today().isoformat(),
            "sources": ["GitHub API (gh)", "PyPI JSON API", "npm registry", "crates.io API",
                        f"Zenodo API, ORCID {ORCID}", "harperz9.github.io (HTTP 200 per page)"],
            "repositories": repositories(), "packages": packages(), "papers": papers(), "site": site_pages(),
            "mods": [{"title": "Elder ENB", "site": "Nexus Mods", "first": "2024-04-21",
                      "url": "https://www.nexusmods.com/skyrimspecialedition/mods/117327",
                      "note": "Counts read October 23, 2026; the page refused a scripted read on November 2, 2026."}]}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="also write the CV group from the inventory")
    a = ap.parse_args()
    data = build()
    OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(data['repositories'])} repositories, {len(data['packages'])} packages, "
          f"{len(data['papers'])} papers, {len(data['site'])} site pages -> {OUT.relative_to(ROOT)}")
    if a.apply:
        from published_work_blocks import apply
        apply(data, SOURCE)
