"""Apply the art direction to one repository checkout: assets, README header, brand notes.

    python -m tools.repo_art.rollout --render DIR --repo CHECKOUT --name crucible

Copies the rendered hero (dark and light), the social preview, marks and lockups
into docs/art and docs/brand, rewrites the README header to the template in
ART-DIRECTION.md (picture, H1, tagline, install line, at most four badges), and
retires the old brand images that carried the retired lettering. History files
(CHANGELOG, render receipts, the old header and its art.json) are left alone.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path
from urllib.parse import quote

HERE = Path(__file__).resolve().parent
INK, INK_DARK = "e6e1d6", "1a1712"
BADGE_LINE = re.compile(r"^\s*(\[!\[|!\[)[^\n]*(img\.shields\.io|badge\.svg)")
HERO_LINE = re.compile(r'^<p align="center"><img src="docs/art/[^"]*-header\.svg"')
LEAD_LINE = re.compile(r"^\*\*[^*].*\*\*\s*$")
STALE = [(re.compile(r"Brand assets: `[^\n]*`\.?"), "Brand assets: `docs/art/` (hero, social preview) and `docs/brand/` (mark, lockups).")]


def shield(label: str, value: str) -> str:
    enc = lambda s: quote(s.replace("-", "--").replace("_", "__").replace(" ", "_"), safe="")
    return f"https://img.shields.io/badge/{enc(label)}-{enc(value)}-{INK}?style=flat-square&labelColor={INK_DARK}"


def badges(name: str, b: dict, release: str) -> str:
    """The fixed set, in order: package version, CI, licence, runtime floor."""
    target = {"pypi": f"https://pypi.org/project/{b['package']}/",
              "npm": f"https://www.npmjs.com/package/{b['package']}"}.get(
        b["registry"], f"https://github.com/HarperZ9/{name}/releases/latest")
    ver = f"[![version: {release}]({shield('version', release)})]({target})"
    ci = (f"[![CI](https://github.com/HarperZ9/{name}/actions/workflows/ci.yml/badge.svg)]"
          f"(https://github.com/HarperZ9/{name}/actions/workflows/ci.yml)")
    lic = f"[![license]({shield('license', b['license'])})](LICENSE)"
    run_label, _, run_value = b["runtime"].partition(" ")
    rt = f"![{b['runtime']}]({shield(run_label, run_value or run_label)})" if run_value else \
        f"![{b['runtime']}]({shield('language', b['runtime'])})"
    return "\n".join([ver, ci, lic, rt])


def header(name: str, cfg: dict) -> str:
    alt = f'{cfg["wordmark"]}: {cfg["tagline"]} {cfg["figure_alt"]}'.replace('"', "&quot;")
    return "\n".join([
        "<picture>",
        '  <source media="(prefers-color-scheme: dark)" srcset="docs/art/hero-dark.svg">',
        f'  <img src="docs/art/hero-light.svg" alt="{alt}" width="100%">',
        "</picture>",
        "",
        f"# {cfg['wordmark']}",
        "",
        cfg["tagline"],
        "",
        "```bash",
        cfg["command"],
        "```",
        "",
        badges(name, cfg["badges"], cfg["release"]),
        "",
    ])


def rewrite_readme(text: str, name: str, cfg: dict) -> str:
    lines = text.split("\n")
    head_end = next((i for i, l in enumerate(lines) if l.startswith("## ")), min(len(lines), 40))
    keep = []
    for i, line in enumerate(lines):
        if i < head_end:
            if HERO_LINE.match(line) or BADGE_LINE.match(line) or (LEAD_LINE.match(line) and i < 12):
                continue
            if re.match(rf"^#\s+{re.escape(cfg['wordmark'])}\s*$", line, re.I) or re.match(r"^#\s+\S", line) and i < 3:
                continue
        keep.append(line)
    body = "\n".join(keep).lstrip("\n")
    body = re.sub(r"\n{3,}", "\n\n", body)
    for pat, repl in STALE:
        body = pat.sub(repl, body)
    return header(name, cfg) + "\n" + body


def copy_assets(render: Path, repo: Path, name: str) -> list[str]:
    src = render / name
    moves = {
        "hero-dark.svg": "docs/art/hero-dark.svg", "hero-light.svg": "docs/art/hero-light.svg",
        "social-dark.png": "docs/art/social.png",
        "receipts.json": "docs/art/receipts.json",
        "mark-micro-tile.svg": "docs/brand/mark-16.svg", "mark-micro-tile-16.png": "docs/brand/mark-16.png",
        "mark-micro-tile-32.png": "docs/brand/mark-32.png", "mark-full-tile.svg": "docs/brand/mark-tile.svg",
        "mark-full-tile-64.png": "docs/brand/mark-64.png", "mark-full-tile-512.png": "docs/brand/mark-512.png",
        "mark-full-light.svg": "docs/brand/mark-light.svg", "mark-full-dark.svg": "docs/brand/mark-dark.svg",
        "lockup-horizontal-light.svg": "docs/brand/lockup-horizontal-light.svg",
        "lockup-horizontal-dark.svg": "docs/brand/lockup-horizontal-dark.svg",
        "lockup-stacked-light.svg": "docs/brand/lockup-stacked-light.svg",
        "lockup-stacked-dark.svg": "docs/brand/lockup-stacked-dark.svg",
    }
    for a, b in moves.items():
        (repo / b).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src / a, repo / b)
    retired = []
    for old in (f"docs/brand/{name}-hero.png", f"docs/brand/{name}-hero.svg", f"docs/brand/{name}-mark.svg"):
        if (repo / old).exists():
            (repo / old).unlink()
            retired.append(old)
    return retired


BRAND_NOTE = """# {name} brand assets

Current assets, rendered on 4 October 2026 from the shared art direction:

- `docs/art/hero-dark.svg`, `docs/art/hero-light.svg`: the README hero, 1280 x 480, text outlined from Hanken Grotesk and Conso.
- `docs/art/social.png`: the GitHub social preview, 1280 x 640.
- The mark: `docs/brand/mark-16.png`, `docs/brand/mark-32.png` and `docs/brand/mark-16.svg` (favicon sizes),
  `docs/brand/mark-64.png`, `docs/brand/mark-512.png` and `docs/brand/mark-tile.svg` (app and listing icons),
  `docs/brand/mark-light.svg` and `docs/brand/mark-dark.svg` (on a page, no tile).
- The lockups: `docs/brand/lockup-horizontal-light.svg`, `docs/brand/lockup-horizontal-dark.svg`,
  `docs/brand/lockup-stacked-light.svg` and `docs/brand/lockup-stacked-dark.svg`.
- `docs/art/receipts.json`: a `superstack.receipt/1` for every PNG, with the seed, the scene hash and the font hashes.

The seed is the repository name. The same seed gives the same SVG bytes.
{previous}
The record below describes the previous brand render and stays as it was written.

"""


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--render", required=True, type=Path)
    ap.add_argument("--repo", required=True, type=Path)
    ap.add_argument("--name", required=True)
    a = ap.parse_args(argv)
    cfg = json.loads((HERE / "repos.json").read_text("utf-8"))["repos"][a.name]
    retired = copy_assets(a.render, a.repo, a.name)
    readme = a.repo / "README.md"
    readme.write_text(rewrite_readme(readme.read_text("utf-8"), a.name, cfg), "utf-8", newline="\n")
    brand = a.repo / "docs" / "brand" / "README.md"
    old = brand.read_text("utf-8") if brand.exists() else ""
    if "Current assets, rendered on 4 October 2026" not in old:
        body = re.sub(r"^# .*\n+", "", old, count=1)
        header = a.repo / "docs" / "art" / f"{a.name}-header.svg"
        previous = (f"\nThe previous README header, `docs/art/{a.name}-header.svg`, stays in the repository with its "
                    f"`docs/art/{a.name}.art.json` record.\n") if header.exists() else ""
        brand.write_text(BRAND_NOTE.format(name=a.name, previous=previous) + (("## Previous render\n\n" + body) if body else ""),
                         "utf-8", newline="\n")
    print(a.name, "retired:", retired or "none")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
