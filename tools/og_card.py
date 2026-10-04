"""The link-preview tags for a page, for every generator that writes a head.

One source of truth: tools/repo_art/site_cards.py. This shim loads it by path so
generators run as scripts (python tools/x.py) and as modules (tools.x) alike.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "repo_art_site_cards", Path(__file__).resolve().parent / "repo_art" / "site_cards.py")
_site_cards = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_site_cards)

card_tags = _site_cards.card_tags
card_url = _site_cards.card_url
