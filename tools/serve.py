"""A static server with the right MIME types for local verification.

Python's stock http.server can hand back .js as text/plain on some machines,
which stops the browser from loading an ES module. It also answers single byte-range
requests (206), which a browser needs before it can seek a <video>. Every page here is
static, so this is the whole dev server: correct types, ranges, loopback only.

    python tools/serve.py            # serve the checkout on 8848
    python tools/serve.py --port N   # a different port
"""

from __future__ import annotations

import argparse
import http.server
import os
import pathlib
import re
import socketserver

ROOT = pathlib.Path(__file__).resolve().parent.parent
MIME = {
    ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
    ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2",
    ".wasm": "application/wasm", ".webmanifest": "application/manifest+json",
}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--port", type=int, default=8848)
    args = ap.parse_args()

    handler = http.server.SimpleHTTPRequestHandler
    handler.extensions_map = {**handler.extensions_map, **MIME}

    class Handler(handler):  # type: ignore[misc, valid-type]
        def __init__(self, *a, **k):
            super().__init__(*a, directory=str(ROOT), **k)

        def log_message(self, *a):  # keep the console quiet
            pass

        def end_headers(self):
            self.send_header("Accept-Ranges", "bytes")
            super().end_headers()

        def do_GET(self):  # noqa: N802 (the stdlib's name)
            m = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers.get("Range", "").strip())
            path = self.translate_path(self.path)
            if not m or not os.path.isfile(path) or not (m.group(1) or m.group(2)):
                return super().do_GET()
            size = os.path.getsize(path)
            a, b = m.groups()
            start, end = (int(a), int(b) if b else size - 1) if a else (max(0, size - int(b)), size - 1)
            end = min(end, size - 1)
            if start > end or start >= size:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return None
            self.send_response(206)
            self.send_header("Content-Type", self.guess_type(path))
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Content-Length", str(end - start + 1))
            self.end_headers()
            with open(path, "rb") as f:
                f.seek(start)
                left = end - start + 1
                while left > 0:
                    chunk = f.read(min(left, 1 << 16))
                    if not chunk:
                        break
                    try:
                        self.wfile.write(chunk)
                    except (BrokenPipeError, ConnectionResetError):  # the browser cancelled the range
                        return None
                    left -= len(chunk)
            return None

    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", args.port), Handler) as httpd:
        print(f"serving {ROOT} at http://127.0.0.1:{args.port}/")
        httpd.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
