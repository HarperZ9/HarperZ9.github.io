"""A static server for the browser tests (10 October 2026).

python -m http.server listens with a backlog of 5. When a browser opens its
parallel connections, or two browsers load at once, the extra connections
were refused, a module import failed without a word, and the page never
booted. The tests then timed out. This is the same server with a backlog of
256 and the module types the site needs. Usage: python tests/lib/serve.py PORT [ROOT]
"""
import functools
import http.server
import sys

Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map.update({".mjs": "text/javascript", ".js": "text/javascript", ".wasm": "application/wasm",
                               ".json": "application/json", ".svg": "image/svg+xml", ".wgsl": "text/plain"})


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 256
    daemon_threads = True


if __name__ == "__main__":
    port = int(sys.argv[1])
    root = sys.argv[2] if len(sys.argv) > 2 else "."
    Server(("127.0.0.1", port), functools.partial(Handler, directory=root)).serve_forever()
