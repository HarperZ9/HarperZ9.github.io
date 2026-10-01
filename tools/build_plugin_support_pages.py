"""Build the plugin support, privacy and terms pages under plugins/.

Usage:
  python tools/build_plugin_support_pages.py            # render from snapshots
  python tools/build_plugin_support_pages.py --check    # fail if output or snapshots drifted
  python tools/build_plugin_support_pages.py --refresh  # re-download snapshots at the pinned refs

Pinned refs live in plugins/data/plugins.json. --refresh needs network access to
raw.githubusercontent.com; rendering and --check do not.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools import plugin_support_sources as sources  # noqa: E402
from tools.plugin_support_pages import render_all  # noqa: E402


def check(files: dict[str, str]) -> list[str]:
    problems = sources.verify_lock()
    for rel, text in files.items():
        path = sources.ROOT / rel
        current = path.read_text(encoding="utf-8").replace("\r\n", "\n") if path.exists() else None
        if current != text:
            problems.append(f"{rel}: stale or missing; rerun the builder")
    return problems


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args(argv)
    if args.refresh:
        sources.refresh()
    files = render_all(sources.load_tools())
    if args.check:
        problems = check(files)
        for line in problems:
            print(line, file=sys.stderr)
        return 1 if problems else 0
    for rel, text in files.items():
        path = sources.ROOT / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {len(files)} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
