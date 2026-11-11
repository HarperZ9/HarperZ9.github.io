"""Audit every image, video and loop the site ships, for quality against how it is shown.

Three passes, each cached in a JSON file so a later pass can run alone:

    python tools/media_audit.py inventory   # media files and the pages, sheets and scripts that name them
    python tools/media_audit.py layout      # displayed CSS width of each asset at 1440 and 1920 px viewports
    python tools/media_audit.py metrics     # pixels: size, detail, banding, block artefacts; video: fps, bitrate, seam
    python tools/media_audit.py report      # one row per asset with its findings, as Markdown and JSON

Resolution is checked against the largest box the asset is drawn in: 1x is that CSS width at a 1440 px viewport,
2x is twice it, 4K is twice the CSS width at a 1920 px viewport (a 3840 px wide screen). For a srcset the largest
candidate counts. The pixel measures are plain and stated in the report:

  detail   PSNR (dB) of the picture against itself halved and doubled; above 42 dB the picture holds almost
           nothing finer than half its pixel size, so it is soft or upscaled for its size
  banding  share of the smooth area that sits on one-level steps between flat runs of 16 px or more (8-bit luma)
  blocks   mean step across 8 px block edges over the mean step inside blocks; above 1.5 on a lossy file the codec's
           blocks may show (line art on an 8 px grid scores high too, so each is confirmed by eye)
  seam     for a file a page plays with loop, the last-to-first frame change over the median frame-to-frame change;
           above 3 the jump shows
  2x and 4K are met within 10%: a 1920 px picture in a 1000 CSS px box is not marked

Output: project-docs/media-audit/ (inventory.json, layout.json, metrics.json, report.json, report.md).
"""

from __future__ import annotations

import argparse
import functools
import http.server
import json
import pathlib
import re
import subprocess
import sys
import threading
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "project-docs" / "media-audit"
RASTER = (".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif")
VIDEO = (".mp4", ".webm")
MEDIA = RASTER + VIDEO
SKIP = re.compile(r"^(vendor|node_modules|tests|home/(src|public|node_modules)|\.worktrees|project-docs)/")
TEXT = (".html", ".css", ".js", ".mjs", ".json")
REF = re.compile(r"""[\w./%@+-]*?\.(?:png|jpe?g|webp|avif|gif|mp4|webm)\b""", re.I)


def tracked() -> list[str]:
    out = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split("\n")
    return [p for p in out if p and not SKIP.match(p)]


def save(name: str, data) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def load(name: str):
    return json.loads((OUT / name).read_text(encoding="utf-8"))


# ---- inventory ------------------------------------------------------------------------------------------------
def inventory() -> dict:
    files = tracked()
    media = {p for p in files if p.lower().endswith(MEDIA)}
    refs: dict[str, set[str]] = defaultdict(set)
    by_name = defaultdict(set)
    for m in media:
        by_name[pathlib.PurePosixPath(m).name].add(m)
    for src in files:
        if not src.endswith(TEXT) or src.startswith("media/") and src.endswith(".json") and "MEDIA" not in src:
            continue
        try:
            text = (ROOT / src).read_text(encoding="utf-8", errors="ignore")
        except OSError as e:
            print(f"inventory: cannot read {src}: {e}", file=sys.stderr)
            continue
        base = pathlib.PurePosixPath(src).parent
        for hit in set(REF.findall(text)):
            hit = hit.split("?")[0].replace("%20", " ")
            cands = []
            if hit.startswith("/"):
                cands.append(hit.lstrip("/"))
            elif hit.startswith("http"):
                cands.append(re.sub(r"^https?://harperz9\.github\.io/", "", hit))
            else:
                cands.append(str(base / hit))
                cands.append(hit)
            for c in cands:
                c = str(pathlib.PurePosixPath(*[x for x in pathlib.PurePosixPath(c).parts]))
                norm = []
                for part in c.split("/"):
                    if part == "..":
                        norm and norm.pop()
                    elif part not in ("", "."):
                        norm.append(part)
                c = "/".join(norm)
                if c in media:
                    refs[c].add(src)
                    break
            else:  # a template builds the path ("${n}-${w}.webp"); match the file name stem
                for m in by_name.get(pathlib.PurePosixPath(hit).name, ()):
                    refs[m].add(src)
    inv = {m: sorted(refs.get(m, ())) for m in sorted(media)}
    save("inventory.json", inv)
    print(f"inventory: {len(inv)} media files, {sum(1 for v in inv.values() if not v)} named by no page or script")
    return inv


# ---- layout ---------------------------------------------------------------------------------------------------
class Quiet(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript", ".js": "text/javascript", ".wasm": "application/wasm"}

    def log_message(self, *a) -> None:
        pass


PROBE = r"""() => {
  const out = [], url = (u) => { try { return new URL(u, location.href).pathname.replace(/^\//, '') } catch { return null } };
  const cands = (el) => { const s = new Set(); const add = (u) => { const p = u && url(u.trim().split(/\s+/)[0]); if (p) s.add(decodeURI(p)); };
    for (const a of ['src', 'data-src', 'poster', 'currentSrc']) add(el[a] || el.getAttribute?.(a));
    for (const a of ['srcset', 'data-srcset']) (el.getAttribute(a) || '').split(',').forEach(add);
    if (el.dataset?.poster) for (const sfx of ['-poster.webp', '-poster-640.webp']) add(el.dataset.poster + sfx);
    for (const so of el.querySelectorAll?.('source') || []) { add(so.getAttribute('src')); (so.getAttribute('srcset') || '').split(',').forEach(add); }
    const pic = el.closest?.('picture'); if (pic) for (const so of pic.querySelectorAll('source')) (so.getAttribute('srcset') || so.getAttribute('data-srcset') || '').split(',').forEach(add);
    return [...s]; };
  for (const el of document.querySelectorAll('img, video')) {
    const r = el.getBoundingClientRect(); if (r.width < 2) continue;
    out.push({ w: r.width, h: r.height, files: cands(el) });
  }
  for (const el of document.querySelectorAll('body *')) {
    const bg = getComputedStyle(el).backgroundImage; if (!bg || bg === 'none' || !bg.includes('url(')) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2) continue;
    const files = [...bg.matchAll(/url\("?([^")]+)"?\)/g)].map((m) => url(m[1])).filter(Boolean);
    out.push({ w: r.width, h: r.height, files, bg: true });
  }
  return out;
}"""


def layout() -> dict:
    inv = load("inventory.json")
    pages = sorted({p for refs in inv.values() for p in refs if p.endswith(".html")})
    from playwright.sync_api import sync_playwright
    handler = functools.partial(Quiet, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    port = srv.server_address[1]
    best: dict[str, dict] = defaultdict(lambda: {"w1440": 0.0, "w1920": 0.0, "pages": []})
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(channel="chrome")
            for vw, key in ((1440, "w1440"), (1920, "w1920")):
                pg = b.new_page(viewport={"width": vw, "height": 900 if vw == 1440 else 1080})
                for n, page in enumerate(pages):
                    try:
                        pg.goto(f"http://127.0.0.1:{port}/{page}", wait_until="domcontentloaded", timeout=30000)
                        pg.wait_for_timeout(600)
                        for item in pg.evaluate(PROBE):
                            for f in item["files"]:
                                if f.lower().endswith(MEDIA):
                                    rec = best[f]
                                    if item["w"] > rec[key]:
                                        rec[key] = round(item["w"], 1)
                                    if page not in rec["pages"]:
                                        rec["pages"].append(page)
                    except Exception as e:  # one page failing is a finding, not the end of the audit
                        print(f"layout: {page} at {vw}: {e}", file=sys.stderr)
                    if n % 50 == 0:
                        print(f"layout {vw}: {n}/{len(pages)}", flush=True)
                pg.close()
            b.close()
    finally:
        srv.shutdown()
    save("layout.json", best)
    print(f"layout: {len(best)} assets drawn on {len(pages)} pages")
    return best


# ---- metrics --------------------------------------------------------------------------------------------------
def ffmpeg() -> str:
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def image_metrics(arr) -> dict:
    import numpy as np
    from PIL import Image
    h, w = arr.shape[:2]
    rgb = arr[..., :3].astype(np.float32)
    y = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    out = {}
    # detail: the picture against itself halved and doubled
    if w >= 64 and h >= 64:
        im = Image.fromarray(np.clip(y, 0, 255).astype(np.uint8))
        back = np.asarray(im.resize((w // 2, h // 2), Image.LANCZOS).resize((w, h), Image.LANCZOS), np.float32)
        mse = float(np.mean((back - y) ** 2))
        out["detail_db"] = round(99.0 if mse < 1e-9 else 10 * np.log10(255 ** 2 / mse), 1)
    # banding: one-level steps between long flat runs, inside smooth areas
    q = np.round(y).astype(np.int16)
    dx = np.diff(q, axis=1)
    flat = dx == 0
    run = np.zeros_like(q, dtype=np.int32)
    acc = np.zeros(h, np.int32)
    for x in range(dx.shape[1]):
        acc = np.where(flat[:, x], acc + 1, 0)
        run[:, x + 1] = acc
    step = np.abs(dx) == 1
    long_before = run[:, :-1] >= 15
    smooth = np.abs(dx) <= 2
    s = int(smooth.sum())
    out["banding"] = round(float((step & long_before).sum()) / s, 4) if s else 0.0
    # block artefacts across 8 px edges
    d = np.abs(np.diff(y, axis=1))
    if d.shape[1] > 16:
        edge = d[:, 7::8].mean()
        inner = np.delete(d, np.s_[7::8], axis=1).mean()
        out["blocks"] = round(float(edge / inner), 3) if inner > 0.05 else 1.0
    return out


def decode_image(path: pathlib.Path):
    import numpy as np
    from PIL import Image
    try:
        with Image.open(path) as im:
            im.seek(0)
            return np.asarray(im.convert("RGB")), im.size
    except Exception:
        # AVIF without a Pillow plugin: let ffmpeg decode it
        raw = subprocess.run([ffmpeg(), "-v", "error", "-i", str(path), "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"],
                             capture_output=True, check=True).stdout
        import io
        with Image.open(io.BytesIO(raw)) as im:
            return np.asarray(im.convert("RGB")), im.size


def video_metrics(path: pathlib.Path) -> dict:
    import numpy as np
    probe = subprocess.run([ffmpeg(), "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    m = re.search(r"Video: ([^,]+).*?, (\d{2,5})x(\d{2,5})", probe)
    fps = re.search(r"([\d.]+) fps", probe)
    dur = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe)
    br = re.search(r"bitrate: (\d+) kb/s", probe)
    out = {"codec": m.group(1).split()[0] if m else None, "w": int(m.group(2)) if m else 0, "h": int(m.group(3)) if m else 0,
           "fps": float(fps.group(1)) if fps else None, "kbps": int(br.group(1)) if br else None,
           "seconds": round(int(dur.group(1)) * 3600 + int(dur.group(2)) * 60 + float(dur.group(3)), 2) if dur else None}
    if out["w"] and out["seconds"] and out["seconds"] <= 120:
        sw = 320
        sh = max(2, round(out["h"] * sw / out["w"] / 2) * 2)
        raw = subprocess.run([ffmpeg(), "-v", "error", "-i", str(path), "-vf", f"scale={sw}:{sh}", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                             capture_output=True).stdout
        n = len(raw) // (sw * sh)
        if n >= 3:
            f = np.frombuffer(raw[: n * sw * sh], np.uint8).reshape(n, sh, sw).astype(np.float32)
            steps = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
            med = float(np.median(steps))
            seam = float(np.abs(f[-1] - f[0]).mean())
            out["seam"] = round(seam / med, 2) if med > 0.05 else (0.0 if seam < 0.05 else 99.0)
            out["motion_jitter"] = round(float(np.std(steps) / (np.mean(steps) or 1)), 2)
        mid = subprocess.run([ffmpeg(), "-v", "error", "-ss", str(out["seconds"] / 2), "-i", str(path), "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"],
                             capture_output=True).stdout
        if mid:
            import io
            from PIL import Image
            with Image.open(io.BytesIO(mid)) as im:
                out.update({f"frame_{k}": v for k, v in image_metrics(np.asarray(im.convert("RGB"))).items()})
    return out


def metrics() -> dict:
    inv = load("inventory.json")
    old = load("metrics.json") if (OUT / "metrics.json").exists() else {}
    res = {}
    for n, f in enumerate(inv):
        p = ROOT / f
        st = p.stat()
        key = f"{st.st_size}:{int(st.st_mtime)}"
        if old.get(f, {}).get("key") == key:
            res[f] = old[f]
            continue
        rec = {"key": key, "bytes": st.st_size}
        try:
            if f.lower().endswith(VIDEO):
                rec.update(video_metrics(p))
            else:
                arr, (w, h) = decode_image(p)
                rec.update({"w": w, "h": h}, **image_metrics(arr))
        except Exception as e:
            rec["error"] = str(e)[:200]
            print(f"metrics: {f}: {e}", file=sys.stderr)
        res[f] = rec
        if n % 100 == 0:
            print(f"metrics: {n}/{len(inv)}", flush=True)
            save("metrics.json", res)
    save("metrics.json", res)
    return res


# ---- report ---------------------------------------------------------------------------------------------------
FAMILIES = [
    (r"^img/og/", "Link cards (fixed 1200 x 630 by the Open Graph size)"),
    (r"^world/exhibit/.*(thumb|refs?)/|^world/ui/assets/refs?/|thumbs/", "Reference thumbnails of other people's work (shipped small by rule)"),
    (r"^media/world/lettering/", "Home lettering"),
    (r"^media/world/glass-water/", "Glass and water plates"),
    (r"^media/world/", "World media"),
    (r"^media/explainers/|^media/films/", "Films and explainers"),
    (r"^media/school/", "Night School films"),
    (r"^media/", "Other media"),
    (r"^art/", "Art archive"),
    (r"^world/", "World pieces"),
    (r"^plugins/", "Plugin icons"),
    (r"", "Everything else"),
]


def family(f: str) -> str:
    for rx, name in FAMILIES:
        if re.search(rx, f):
            return name
    return "Everything else"


SIZE_TOKEN = re.compile(r"(-(poster))?(-\d{3,4}w?|-(portrait|ground)(-\d{3,4})?)?$")


def stem(f: str) -> str:
    """A set of sizes of one picture shares a stem: name-1920.webp, name-960.avif and name.webm all give 'name'."""
    p = pathlib.PurePosixPath(f)
    return str(p.parent / SIZE_TOKEN.sub("", p.stem))


def looped(f: str, refs: list[str]) -> bool:
    """True when a page plays the file in a <video loop>: only loops are checked for a seam."""
    name = re.escape(pathlib.PurePosixPath(f).stem.split("-640")[0])
    for page in refs:
        if not page.endswith(".html"):
            continue
        text = (ROOT / page).read_text(encoding="utf-8", errors="ignore")
        for tag in re.findall(r"<video[^>]*>[\s\S]*?</video>", text):
            if re.search(r"loop", tag.split(">")[0]) and re.search(name, tag):
                return True
        if re.search(r"data-loop|kind: \"loop\"", text) and re.search(name, text):
            return True
    return False


def findings(f: str, m: dict, lay: dict | None, best_w: int = 0, loop: bool = False) -> tuple[list[str], str]:
    issues, fix = [], ""
    vid = f.lower().endswith(VIDEO)
    w = max(m.get("w", 0) or 0, best_w)
    fam = family(f)
    if m.get("error"):
        return [f"unreadable: {m['error']}"], "re-export through its generator"
    if lay:
        need1, need2, need4k = lay["w1440"], 2 * lay["w1440"], 2 * lay["w1920"]
        if w and w < need1 * 0.98:
            issues.append(f"{w} px wide, drawn {need1:.0f} CSS px at 1x: upscaled on every screen")
        elif w and w < need2 * 0.9:   # within 10% of 2x reads as sharp; the step from 1.8x to 2x is not visible
            issues.append(f"{w} px wide, below 2x ({need2:.0f} px)")
        elif w and w < need4k * 0.9:
            issues.append(f"{w} px wide, below 4K ({need4k:.0f} px)")
    detail = m.get("detail_db", m.get("frame_detail_db"))
    if detail is not None and detail > 42 and not f.lower().endswith(".svg"):
        issues.append(f"soft for its size (detail {detail} dB)")
    band = m.get("banding", m.get("frame_banding", 0)) or 0
    if band > 0.02:
        issues.append(f"banding ({band:.3f})")
    blk = m.get("blocks", m.get("frame_blocks", 1)) or 1
    if blk > 1.5 and f.lower().endswith((".jpg", ".jpeg", ".webp", ".avif") + VIDEO):
        issues.append(f"codec blocks ({blk}), to confirm by eye: drawn line art on an 8 px grid also scores high")
    if vid:
        if loop and m.get("seam") is not None and m["seam"] > 3:
            issues.append(f"loop seam ({m['seam']}x a normal frame step)")
        if m.get("fps") and m["fps"] < 23:
            issues.append(f"{m['fps']} fps")
    if not issues:
        return [], ""
    if fam.startswith("Link cards"):
        fix = "re-render the card from its generator (tools/render_cards.py or tools/repo_art/site_cards.py)"
    elif fam.startswith("Reference thumbnails"):
        fix = "none: third-party thumbnails ship small by rule"
    elif "below 2x" in " ".join(issues) or "below 4K" in " ".join(issues) or "upscaled" in " ".join(issues):
        fix = "re-render at the 2x or 4K width from its generator and serve it through srcset"
    elif any(x.startswith(("banding", "codec")) for x in issues):
        fix = "re-encode from the master with dither and a higher quality setting"
    elif any(x.startswith("loop seam") for x in issues):
        fix = "re-render on a closed clock or crossfade the tail into the head"
    else:
        fix = "re-render from its generator at a higher resolution"
    return issues, fix


def report() -> None:
    inv, met = load("inventory.json"), load("metrics.json")
    lay = load("layout.json") if (OUT / "layout.json").exists() else {}
    rows = []
    # the largest picture in each size set: a phone-only 640 px file is judged with its 1920 px sibling, since the
    # browser picks between them by the screen (the layout pass records a candidate for every box it may fill)
    widest: dict[tuple[str, bool], int] = defaultdict(int)
    for f in inv:
        k = (stem(f), f.lower().endswith(VIDEO))
        widest[k] = max(widest[k], met.get(f, {}).get("w", 0) or 0)
    for f, refs in inv.items():
        m = met.get(f, {})
        L = lay.get(f)
        vid = f.lower().endswith(VIDEO)
        issues, fix = findings(f, m, L, widest[(stem(f), vid)], vid and looped(f, refs))
        if not refs and not L:
            issues = ["named by no page or script (orphan)"] + issues
            fix = fix or "none needed while unused; delete or wire in"
        rows.append({"set_width": widest[(stem(f), vid)], "file": f, "family": family(f), "bytes": m.get("bytes"), "w": m.get("w"), "h": m.get("h"),
                     "drawn_1440": L and L["w1440"], "drawn_1920": L and L["w1920"], "issues": issues, "fix": fix,
                     "metrics": {k: v for k, v in m.items() if k not in ("key",)}})
    save("report.json", rows)
    lines = ["| File | Size | Drawn (CSS px, 1440 / 1920) | Issue | Fix |", "|---|---|---|---|---|"]
    for fam in [n for _, n in FAMILIES]:
        group = [r for r in rows if r["family"] == fam]
        if not group:
            continue
        bad = [r for r in group if r["issues"]]
        lines.append(f"| **{fam}** | {len(group)} files | | {len(bad)} with a finding | |")
        for r in group:
            size = f"{r['w']}x{r['h']}" if r.get("w") else "?"
            drawn = f"{r['drawn_1440'] or 0:.0f} / {r['drawn_1920'] or 0:.0f}" if r["drawn_1440"] is not None else "not drawn"
            lines.append(f"| `{r['file']}` | {size}, {(r['bytes'] or 0) // 1024} kB | {drawn} | {'; '.join(r['issues']) or 'none found'} | {r['fix']} |")
    (OUT / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    n = sum(1 for r in rows if r["issues"])
    print(f"report: {len(rows)} assets, {n} with a finding")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("step", choices=["inventory", "layout", "metrics", "report", "all"])
    a = ap.parse_args()
    for step in (["inventory", "layout", "metrics", "report"] if a.step == "all" else [a.step]):
        globals()[step]()
    return 0


if __name__ == "__main__":
    sys.exit(main())
