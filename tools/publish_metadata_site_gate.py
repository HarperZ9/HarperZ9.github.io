"""Run Flywheel's publish metadata gate with this site's contact allowlist.

The author, 2026-11-09: "The emails can stay on the work and the CV panels. It's
my lab site. All my personal information and contact information can stay."

The gate counts every consumer mail address as a personal-email finding. This
wrapper keeps that pattern and every other check, and skips only the exact
addresses listed in .github/publish-metadata-allow.json. An address in a
User-Agent or another fetch field is still blocked (the checker's fetch-header
rule is untouched). Usage, from the site root, with the checker checked out at
.publish-metadata-checker:

    python tools/publish_metadata_site_gate.py . --baseline .github/publish-metadata-baseline.json
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
CHECKER = SITE / ".publish-metadata-checker" / "scripts"
ALLOW = SITE / ".github" / "publish-metadata-allow.json"


def allowlisted_pattern(rx: re.Pattern, addresses: list[str]) -> re.Pattern:
    """The same address pattern, never matching inside a word or on an allowlisted address."""
    skip = "|".join(re.escape(a) for a in addresses)
    return re.compile(r"(?<![A-Za-z0-9._%+-])(?!(?:" + skip + r")(?![A-Za-z0-9.-]))" + rx.pattern, rx.flags)


def main(argv: list[str]) -> int:
    sys.path.insert(0, str(CHECKER))
    import publish_metadata_gate as G  # noqa: E402  (the pinned checker)

    addresses = json.loads(ALLOW.read_text(encoding="utf-8")).get("personal_email", [])
    if addresses:
        rows = G.C.T.GENERIC
        for i, (rx, cat, label) in enumerate(rows):
            if cat == "personal-email":
                rows[i] = (allowlisted_pattern(rx, addresses), cat, label + " (site allowlist applied)")
        print(f"site allowlist: {len(addresses)} address(es) skipped for personal-email")
    return G.main(argv)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
