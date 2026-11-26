#!/usr/bin/env python3
"""Lossless content harvester for the Wave 16A unified 42-page site.

Extracts substantive content, metadata, DOIs, repo links, verified lines,
and clean inner HTML from every legacy HTML page into assets/data/unified/
and builds legacy_route_map.json before retiring redundant thin pages.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from html import unescape
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "data" / "unified"

# Exact 42 tracked HTML files retained in the unified Wave 16A architecture:
# 36 flagship interactive pages + 6 SHA256SUMS-sealed embedded WebGPU/WASM frames.
KEEP_HTML: set[str] = {
    # Core Identity & Overview (6)
    "index.html",
    "person.html",
    "portfolio.html",
    "architecture.html",
    "dossier.html",
    "credits.html",
    # Shared Multimedia & Playground Studio (7, incl. elements.html for surfaces bench CI)
    "playground/index.html",
    "playground/distill.html",
    "raw.html",
    "low-water.html",
    "studio.html",
    "elements.html",
    "media/index.html",
    # Flagship Systems & Local Frontier Model Lab (6)
    "buildlang.html",
    "flywheel.html",
    "models.html",
    "cmmns.html",
    "demos.html",
    "tools.html",
    # Unified Research, World & Knowledge Surfaces (7)
    "world/index.html",
    "studies/index.html",
    "findings/index.html",
    "essays.html",
    "frontier-safety/index.html",
    "security.html",
    "night-school.html",
    # Career Pack & All-Format Downloads (9)
    "hire.html",
    "cv.html",
    "cover-letter.html",
    "resume.html",
    "resume-evaluation-tooling.html",
    "resume-graphics-developer-tools.html",
    "resume-grounds.html",
    "resume-public-operations.html",
    "resume-support-operations.html",
    # Smart Route Resolver (1)
    "404.html",
    # Sealed/Embedded WebGPU/WASM Viewer & Capture Payloads (8: 6 SHA256SUMS + 2 live frames)
    "media/low-water/walk.html",
    "media/low-water/world-cac3416/walk/index.html",
    "media/low-water/world-cac3416/walk/flora/atlas.html",
    "media/raw-native/live/index.html",
    "media/raw-native/tree-ada041f/web/motion/capture.html",
    "media/raw-native/tree-c6b114d/web/motion/capture.html",
    "media/raw-native/viewer-0.8.0/web/viewer/index.html",
    "media/raw-native/web-23ec93f/motion/capture.html",
}

WORLD_ROOT_PAGES = {
    "accession.html", "brender-archival.html", "build-color.html", "elder-enb.html",
    "enb-runtime-core.html", "engine-revival.html", "estuary.html", "fonts.html",
    "gallery.html", "gaussian-splats.html", "glass-water.html", "loom.html",
    "retro.html", "skyrimbridge.html", "superframe.html", "swatches.html",
    "truth-enb.html", "type-forge.html", "typeface.html",
}

DEMO_ROOT_PAGES = {
    "demo-crucible.html", "demo-emet.html", "demo-flywheel.html",
    "demo-forum.html", "demo-gather.html", "demo-index.html",
    "demos/crucible-cleanroom/index.html",
}

TOOL_ROOT_PAGES = {
    "accountable-engine.html", "accountable-machines.html", "accountable-surface.html",
    "aleph.html", "array.html", "articulate.html", "atelier.html", "bounds.html",
    "bulletin.html", "canon.html", "catalog.html", "chorus.html",
    "coherence-membrane.html", "crucible.html", "emet-sample.html", "emet.html",
    "explainers.html", "flywheel-pilot.html", "forum.html", "gather.html",
    "index-graph.html", "isomorph.html", "kun.html", "learn.html",
    "metr-count-odds-reviewer-packet.html", "phantom.html", "playground/fourier.html",
    "proof-index-sample.html", "proof-surface-sample.html", "proof-surface.html",
    "provenance-sensorium.html", "public-surface-sweeper-sample.html",
    "repo-explainers.html", "security-toolkit.html", "seed.html", "sofer.html",
    "warden.html", "witnessing-spine.html",
}

DOI_RE = re.compile(r"https?://(?:doi\.org|zenodo\.org)/[^\s\"'<>)]+|10\.\d{4,9}/[-._;()/:A-Za-z0-9]+")
REPO_RE = re.compile(r"https://github\.com/HarperZ9/[A-Za-z0-9_.-]+(?:/[^\s\"'<>)]*)?")
SKIP_TAGS = {"script", "style", "noscript", "header", "dialog", "footer"}


def slugify(rel: str) -> str:
    s = rel.replace("/index.html", "").replace(".html", "")
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "home"


def route_for(rel: str) -> tuple[str, str, str]:
    """Return (pack_name, target_url, category) for any legacy HTML relative path."""
    slug = slugify(rel)
    if rel.startswith("night-school-") and rel.endswith(".html"):
        lesson = rel[len("night-school-"):-len(".html")]
        return "tools_plugins_demos", f"/night-school.html?lab={lesson}#lab", "night-school"
    if rel == "raw-dx12.html":
        return "world_atlas", "/raw.html", "engine"
    if rel in DEMO_ROOT_PAGES:
        short = slug.replace("demo-", "").replace("demos-", "")
        return "tools_plugins_demos", f"/demos.html#{short}", "demo"
    if rel.startswith("world/") or rel in WORLD_ROOT_PAGES:
        sub = rel.split("/")[1] if rel.startswith("world/") else "surface"
        return "world_atlas", f"/world/#{slug}", f"world-{sub}"
    if rel.startswith("studies/"):
        return "studies_findings", f"/studies/#{slug}", "study"
    if rel.startswith("findings/"):
        return "studies_findings", f"/findings/#{slug}", "finding"
    if rel.startswith("analytics/") or rel in ("experiments/index.html", "glossary.html"):
        return "studies_findings", f"/studies/#{slug}", "analytics"
    if rel.startswith("figures/") or rel.startswith("media/") or rel == "img/og/_card.html":
        return "media_figures", f"/media/#{slug}", "figure" if rel.startswith("figures/") else "media"
    if rel.startswith("frontier-safety/") or rel in ("frontier-safety.html", "frontier-safety-openai-hugging-face-incident.html") or rel.startswith("briefings/"):
        return "essays_writings", f"/frontier-safety/#{slug}", "frontier-safety"
    if rel.startswith("tools/") or rel.startswith("plugins/") or rel.startswith("repo-explainers/") or rel.startswith("systems/") or rel.startswith("system/") or rel in TOOL_ROOT_PAGES:
        cat = rel.split("/")[0] if "/" in rel else "tool"
        return "tools_plugins_demos", f"/tools.html#{slug}", cat
    if rel in ("work-with-me.html", "join.html", "test-run-request.html"):
        return "essays_writings", "/hire.html", "career"
    if rel in ("home/index.html", "overview.html", "floor.html", "site-index.html", "workshop.html"):
        return "essays_writings", f"/essays.html#{slug}", "overview"
    return "essays_writings", f"/essays.html#{slug}", "essay"


class ContentExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.in_title = False
        self.title_parts: list[str] = []
        self.description = ""
        self.in_main = False
        self.main_depth = 0
        self.in_body = False
        self.skip_depth = 0
        self.svg_depth = 0
        self.main_chunks: list[str] = []
        self.body_chunks: list[str] = []
        self.headings: list[str] = []
        self.cur_h: list[str] | None = None
        self.text_parts: list[str] = []

    def _target(self) -> list[str] | None:
        if self.skip_depth > 0 or self.svg_depth > 0:
            return None
        if self.in_main:
            return self.main_chunks
        if self.in_body:
            return self.body_chunks
        return None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        t = tag.lower()
        ad = dict(attrs)
        if t == "title":
            self.in_title = True
        elif t == "meta" and (ad.get("name") or "").lower() == "description" and ad.get("content"):
            self.description = ad["content"].strip()
        elif t == "body":
            self.in_body = True
        elif t == "main" and not self.in_main:
            self.in_main = True
            self.main_depth = 1
            return
        elif self.in_main:
            self.main_depth += 1

        cls = ad.get("class") or ""
        if t in SKIP_TAGS or "gw-backdrop" in cls or "o-hand" in cls or "site-foot" in cls or "o-crumb" in cls:
            self.skip_depth += 1
            return
        if t == "svg":
            self.svg_depth += 1
            return
        if self.skip_depth > 0 or self.svg_depth > 0:
            return
        if t in ("h1", "h2", "h3"):
            self.cur_h = []
        buf = self._target()
        if buf is not None and t in {
            "h1", "h2", "h3", "h4", "p", "ul", "ol", "li", "dl", "dt", "dd",
            "table", "thead", "tbody", "tr", "th", "td", "blockquote", "pre",
            "code", "a", "strong", "em", "b", "i", "small", "figure", "figcaption",
            "img", "section", "article", "details", "summary", "br", "hr", "span", "div",
        }:
            keep_attrs = []
            for k, v in attrs:
                kl = k.lower()
                if kl in ("href", "src", "alt", "id", "title", "loading") and v is not None:
                    if not (kl == "src" and v.startswith("data:")):
                        keep_attrs.append(f'{kl}="{v}"')
            attr_s = (" " + " ".join(keep_attrs)) if keep_attrs else ""
            buf.append(f"<{t}{attr_s}>")

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t == "title":
            self.in_title = False
        elif t == "body":
            self.in_body = False
        if self.svg_depth > 0:
            if t == "svg":
                self.svg_depth -= 1
            return
        if self.skip_depth > 0:
            if t in SKIP_TAGS or t in ("div", "nav", "footer", "header"):
                self.skip_depth = max(0, self.skip_depth - 1)
            return
        if self.cur_h is not None and t in ("h1", "h2", "h3"):
            h = re.sub(r"\s+", " ", "".join(self.cur_h)).strip()
            if h:
                self.headings.append(h)
            self.cur_h = None
        buf = self._target()
        if buf is not None and t in {
            "h1", "h2", "h3", "h4", "p", "ul", "ol", "li", "dl", "dt", "dd",
            "table", "thead", "tbody", "tr", "th", "td", "blockquote", "pre",
            "code", "a", "strong", "em", "b", "i", "small", "figure", "figcaption",
            "section", "article", "details", "summary", "span", "div",
        }:
            buf.append(f"</{t}>")
        if self.in_main:
            self.main_depth -= 1
            if self.main_depth <= 0:
                self.in_main = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)
        if self.skip_depth > 0 or self.svg_depth > 0:
            return
        if self.cur_h is not None:
            self.cur_h.append(data)
        buf = self._target()
        if buf is not None:
            buf.append(data)
            self.text_parts.append(data)

    def handle_entityref(self, name: str) -> None:
        ent = f"&{name};"
        if self.in_title:
            self.title_parts.append(unescape(ent))
        if self.skip_depth == 0 and self.svg_depth == 0:
            buf = self._target()
            if buf is not None:
                buf.append(ent)
                self.text_parts.append(unescape(ent))

    def handle_charref(self, name: str) -> None:
        ent = f"&#{name};"
        if self.in_title:
            self.title_parts.append(unescape(ent))
        if self.skip_depth == 0 and self.svg_depth == 0:
            buf = self._target()
            if buf is not None:
                buf.append(ent)
                self.text_parts.append(unescape(ent))


def clean_prose(s: str) -> str:
    s = s.replace("\u2014", " - ").replace("\u2013", "-")
    return re.sub(r"\s+", " ", s).strip()


def rewrite_links(html: str, route_map: dict[str, str]) -> str:
    def repl(m: re.Match[str]) -> str:
        href = m.group(1)
        if href.startswith(("http://", "https://", "mailto:", "#", "javascript:")):
            return m.group(0)
        base, _, frag = href.partition("#")
        path_only = base.split("?")[0]
        if not path_only:
            return m.group(0)
        norm = path_only if path_only.startswith("/") else "/" + path_only.lstrip("./")
        if norm in route_map:
            return f'href="{route_map[norm]}"'
        if norm.endswith("/") and (norm + "index.html") in route_map:
            return f'href="{route_map[norm + "index.html"]}"'
        return m.group(0)
    return re.sub(r'href="([^"]+)"', repl, html)


def extract_record(rel: str, route_map: dict[str, str]) -> tuple[str, dict]:
    raw = (ROOT / rel).read_text(encoding="utf-8", errors="replace")
    parser = ContentExtractor()
    parser.feed(raw)
    pack, target, category = route_for(rel)
    title = clean_prose("".join(parser.title_parts).replace("| Zain Dana Harper", ""))
    if not title and parser.headings:
        title = clean_prose(parser.headings[0])
    if not title:
        title = slugify(rel).replace("-", " ").title()
    desc = clean_prose(parser.description)
    plain = clean_prose("".join(parser.text_parts))
    if not desc:
        desc = plain[:220]
    body_html = "".join(parser.main_chunks or parser.body_chunks)
    body_html = re.sub(r"\s{2,}", " ", body_html).strip()
    body_html = body_html.replace("\u2014", " - ").replace("\u2013", "-")
    body_html = rewrite_links(body_html, route_map)
    # Strip any accidental local Windows drive paths
    body_html = re.sub(r"[A-Za-z]:\\[^\s\"'<>]+", "[local-path]", body_html)
    plain = re.sub(r"[A-Za-z]:\\[^\s\"'<>]+", "[local-path]", plain)
    dois = sorted(set(DOI_RE.findall(raw)))[:12]
    repos = sorted(set(REPO_RE.findall(raw)))[:12]
    vm = re.search(r"Verified[:\s]+([^<\n]{12,240})", plain)
    verified = clean_prose(vm.group(1)) if vm else ""
    rec = {
        "slug": slugify(rel),
        "old_path": "/" + rel,
        "target": target,
        "title": title[:160],
        "description": desc[:320],
        "category": category,
        "headings": [clean_prose(h) for h in parser.headings[:10]],
        "verified": verified,
        "dois": dois,
        "repos": repos,
        "excerpt": plain[:360],
        "word_count": len(plain.split()),
        "body_html": body_html[:48000],
    }
    return pack, rec


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    all_html = sorted(
        subprocess.check_output(
            ["git", "-C", str(ROOT), "ls-files", "*.html"], text=True
        ).splitlines()
    )
    legacy = [f for f in all_html if f not in KEEP_HTML]
    route_map: dict[str, str] = {"/raw-dx12.html": "/raw.html"}
    for rel in legacy:
        _, target, _ = route_for(rel)
        route_map["/" + rel] = target
        if rel.endswith("/index.html"):
            route_map["/" + rel[:-len("index.html")]] = target

    packs: dict[str, list[dict]] = {
        "world_atlas": [],
        "studies_findings": [],
        "essays_writings": [],
        "tools_plugins_demos": [],
        "media_figures": [],
    }
    for rel in legacy:
        pack, rec = extract_record(rel, route_map)
        packs[pack].append(rec)

    for name, items in packs.items():
        items.sort(key=lambda r: (r["category"], r["title"].lower()))
        out_path = OUT_DIR / f"{name}.json"
        payload = {"schema": "unified-pack/1", "pack": name, "count": len(items), "items": items}
        out_path.write_text(json.dumps(payload, ensure_ascii=True, separators=(",", ":")), encoding="utf-8")
        print(f"  {out_path.name}: {len(items)} items ({out_path.stat().st_size // 1024} KB)")

    map_path = OUT_DIR / "legacy_route_map.json"
    map_payload = {
        "schema": "legacy-route-map/1",
        "before_html_count": len(all_html),
        "kept_html_count": len(KEEP_HTML),
        "retired_html_count": len(legacy),
        "routes": dict(sorted(route_map.items())),
    }
    map_path.write_text(json.dumps(map_payload, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    print(f"HARVEST COMPLETE: {len(all_html)} total -> {len(KEEP_HTML)} kept, {len(legacy)} harvested into {len(packs)} JSON packs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
