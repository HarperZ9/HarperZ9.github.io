"""Undo the ident wrapper so text assertions read the page as they did before it.

Pages wrap advisory IDs and package names in <span class="ident" translate="no">
so a narrow screen keeps each one whole (scripts/ident-tokens.mjs). A check such
as "pip install flywheel-relay==0.4.0" not in page would then pass without
looking, because the wrapper sits inside the phrase. without_idents removes only
that wrapper, so each assertion checks exactly the markup it checked before.
"""

import re

IDENT_WRAPPER = re.compile(r'<span class="ident" translate="no">([^<]*)</span>')


def without_idents(markup: str) -> str:
    return IDENT_WRAPPER.sub(r"\1", markup)
