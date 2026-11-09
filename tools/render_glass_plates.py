"""Render the rendered plates for glass-water.html from the live field.

Each space on glass-water.html shows a plate first (media/world/glass-water/<space>-{1920,960}.webp) and keeps it
where WebGL2 cannot run. The plate is the same renderer as the live page: glass-water.html?still=1 asks the field
for one accumulated still (n jittered frames averaged), and this script captures it, so a change to a space's
word or light is one command away from a matching plate.

    python tools/render_glass_plates.py low-sun          # one space
    python tools/render_glass_plates.py low-sun noon --n 32

The page is served from the repository root on a loopback port. The capture is 3840 x 2160 and the plates are
downsampled from it with Lanczos, then written as WebP at the quality the existing plates use.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import pathlib
import sys
import threading
from io import BytesIO

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "media" / "world" / "glass-water"
SIZES = {1920: 86, 960: 84}


class Quiet(http.server.SimpleHTTPRequestHandler):
    # Windows maps .mjs to text/plain, and browsers refuse a module served that way
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript", ".js": "text/javascript", ".wasm": "application/wasm"}

    def log_message(self, *args) -> None:  # the server's request log is noise here
        pass


def serve() -> tuple[http.server.ThreadingHTTPServer, int]:
    handler = functools.partial(Quiet, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


def capture(page, port: int, space: str, n: int) -> Image.Image:
    url = f"http://127.0.0.1:{port}/glass-water.html?space={space}&still=1&w=3840&h=2160&n={n}"
    page.goto(url)
    page.wait_for_function("window.__stillDone === true", timeout=600_000)
    page.wait_for_timeout(500)
    # only the field: the page's words and the plates below it stay out of the picture
    page.add_style_tag(content=".gw-words, .gw-plates, .site-nav, header, footer { visibility: hidden !important; }")
    shot = page.locator("canvas.gw-field").screenshot()
    return Image.open(BytesIO(shot)).convert("RGB")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("spaces", nargs="+")
    ap.add_argument("--n", type=int, default=32, help="frames averaged into the still")
    args = ap.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright is not installed", file=sys.stderr)
        return 2
    srv, port = serve()
    try:
        with sync_playwright() as p:
            gpu = ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"]
            try:
                browser = p.chromium.launch(args=gpu)
            except Exception as exc:  # no Playwright build here: the installed Chrome does the same job
                if "Executable doesn't exist" not in str(exc):
                    raise
                browser = p.chromium.launch(channel="chrome", args=gpu)
            page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=2)
            for space in args.spaces:
                img = capture(page, port, space, args.n)
                for w, q in SIZES.items():
                    out = OUT / f"{space}-{w}.webp"
                    img.resize((w, round(w * img.height / img.width)), Image.LANCZOS).save(out, "WEBP", quality=q, method=6)
                    print(f"  {out.relative_to(ROOT).as_posix():44} {out.stat().st_size / 1024:>6.0f} kB")
            browser.close()
    finally:
        srv.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
