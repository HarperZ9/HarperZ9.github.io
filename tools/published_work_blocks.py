"""Turn career/published-work.json into the CV's "Published Work" group.

The group is plain career blocks (h2, h3, p, li), so the HTML page, the
text and Markdown exports, the ReportLab PDF and DOCX, and the BuildLang
typeset PDF all read the same lines in the same order.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib

GROUP = "published-work"


def when(iso: str) -> str:
    d = dt.date.fromisoformat(iso)
    return f"{d.strftime('%B')} {d.day}, {d.year}"


def bare(url: str) -> str:
    return url.replace("https://", "").replace("www.", "").rstrip("/")


def blocks(data: dict) -> list[dict]:
    b = lambda kind, text: {"kind": kind, "text": text}
    repos = data["repositories"]
    released = [r for r in repos if r["releases"]]
    quiet = [r for r in repos if not r["releases"]]
    site = data["site"]
    out = [
        b("h2", "Published Work"),
        b("p", f"Every public release, package, paper, essay, briefing and packet, read from GitHub, PyPI, npm, "
               f"crates.io, Zenodo and the live site on {when(data['read'])}. Private and unreleased work is not "
               f"listed. Machine-readable copy: harperz9.github.io/career/published-work.json"),
        b("h3", f"Papers, preprints and corpora | {len(data['papers'])} works"),
    ]
    for p in data["papers"]:
        dates = when(p["first"]) if p["first"] == p["latest"] else \
            f"first {when(p['first'])}, latest edition {when(p['latest'])}"
        out.append(b("li", f"{p['title']}. {p['kind']}, {dates}. {bare(p['url'])}"))
    out.append(b("h3", f"Software releases | {sum(r['releases'] for r in released)} releases "
                       f"in {len(released)} repositories"))
    for r in sorted(released, key=lambda r: r["latest"]["date"], reverse=True):
        span = (f"{r['latest']['tag']}, {when(r['latest']['date'])}" if r["releases"] == 1 else
                f"{r['releases']} releases from {r['first']['tag']}, {when(r['first']['date'])}, "
                f"to {r['latest']['tag']}, {when(r['latest']['date'])}")
        flags = "; prereleases only" * r["prerelease_only"] + "; archived" * r["archived"]
        out.append(b("li", f"{r['name']}: {span}{flags}. {bare(r['url'])}/releases"))
    out.append(b("h3", f"Packages | {len(data['packages'])} on PyPI, npm and crates.io"))
    for p in sorted(data["packages"], key=lambda p: (p["registry"], p["name"])):
        out.append(b("li", f"{p['registry']} {p['name']} {p['version']}: first published {when(p['first'])}, "
                           f"this version {when(p['latest'])}. {bare(p['url'])}"))
    out.append(b("h3", f"Public repositories without a release | {len(quiet)}"))
    out.append(b("p", "; ".join(f"{r['name']} ({when(r['created'])}"
                                f"{', archived' if r['archived'] else ''})" for r in quiet)
                 + ". github.com/HarperZ9"))
    for kind, head in (("writing", "Essays, letters and investigations"), ("research note", "Research notes"),
                       ("packet", "Reviewer packets")):
        rows = [s for s in site if s["kind"] == kind]
        out.append(b("h3", f"{head} | {len(rows)}"))
        out += [b("li", f"{s['title']}, {when(s['date'])}. {bare(s['url'])}") for s in rows]
    briefs = [s for s in site if s["kind"] == "briefing"]
    out.append(b("h3", f"Frontier Safety briefing | {len(briefs)} archived editions"))
    out.append(b("p", "Editions of " + "; ".join(when(s["date"]) for s in briefs)
                 + ". harperz9.github.io/frontier-safety.html"))
    out.append(b("h3", "Mods"))
    for m in data["mods"]:
        out.append(b("li", f"{m['title']} on {m['site']}, first uploaded {when(m['first'])}. {bare(m['url'])}"))
    return out


def apply(data: dict, source: pathlib.Path) -> None:
    src = json.loads(source.read_text(encoding="utf-8"))
    src["groups"][GROUP] = blocks(data)
    cv = next(d for d in src["documents"] if d["route"] == "cv.html")
    if {"ref": GROUP} not in cv["blocks"]:
        cv["blocks"].append({"ref": GROUP})
    source.write_text(json.dumps(src, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {len(src['groups'][GROUP])} blocks to the {GROUP} group")
