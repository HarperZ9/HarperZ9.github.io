"""A static server with the right MIME types for local verification.

Python's stock http.server can hand back .js as text/plain on some machines,
which stops the browser from loading an ES module. Every page here is static,
so this is the whole dev server: correct types, one thread, loopback only.

    python tools/serve.py            # serve the checkout on 8848
    python tools/serve.py --port N   # a different port
"""

from __future__ import annotations

import argparse
import http.server
import pathlib
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

    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", args.port), Handler) as httpd:
        print(f"serving {ROOT} at http://127.0.0.1:{args.port}/")
        httpd.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
