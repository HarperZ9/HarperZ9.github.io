"""Print the career documents to PDF from the pages themselves.

The downloads used to be separately authored files with their own date in the
filename, so the page and the PDF drifted apart and a reader had no way to tell
which one was current. These are printed from the live pages through the print
stylesheet in system/doc.css, which means the PDF cannot say something the page
does not.

    python tools/print_documents.py

Needs playwright (`pip install playwright && playwright install chromium`).
It serves the checkout on a loopback port first, because a page loaded from
file:// cannot load ES modules or fonts and would print without either.
"""

from __future__ import annotations

import contextlib
import functools
import http.server
import pathlib
import socketserver
import sys
import threading

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "career"
PORT = 8871

DOCUMENTS = {
    "resume.html": "Zain-Dana-Harper-Resume.pdf",
    "cv.html": "Zain-Dana-Harper-CV.pdf",
    "cover-letter.html": "Zain-Dana-Harper-Cover-Letter.pdf",
    "portfolio.html": "Zain-Dana-Harper-Portfolio.pdf",
    "dossier.html": "Zain-Dana-Harper-Dossier.pdf",
}

MIME = {
    ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
    ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2",
    ".wasm": "application/wasm",
}


@contextlib.contextmanager
def serving(root: pathlib.Path, port: int):
    handler = http.server.SimpleHTTPRequestHandler
    handler.extensions_map = {**handler.extensions_map, **MIME}

    class Quiet(handler):  # type: ignore[misc, valid-type]
        def log_message(self, *args):  # noqa: D102
            pass

    socketserver.TCPServer.allow_reuse_address = True
    server = socketserver.TCPServer(("127.0.0.1", port), functools.partial(Quiet, directory=str(root)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{port}/"
    finally:
        server.shutdown()
        server.server_close()


def main() -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright is not installed; skipping PDF generation", file=sys.stderr)
        return 2

    OUT.mkdir(parents=True, exist_ok=True)
    with serving(ROOT, PORT) as base, sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        for source, target in DOCUMENTS.items():
            page.goto(base + source, wait_until="networkidle")
            # The print stylesheet is what defines these documents on paper, so
            # emulate print rather than screen before measuring anything.
            page.emulate_media(media="print")
            page.wait_for_timeout(400)
            path = OUT / target
            page.pdf(
                path=str(path),
                format="Letter",
                print_background=False,
                margin={"top": "14mm", "bottom": "14mm", "left": "13mm", "right": "13mm"},
            )
            size_kb = path.stat().st_size / 1024
            print(f"{target:44} {size_kb:7.0f} kB")
        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
