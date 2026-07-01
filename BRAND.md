# Project Telos brand

This is the canonical brand for Project Telos. It applies to **every flagship repo, every
private-line tool, and this website**. One brand, one card, one accent. Read
[`DESIGN-RULES.md`](DESIGN-RULES.md) for the site's broader design rules; this file is the
single source of truth for the flagship identity and its hero artwork.

## The universal mark: the flagship card

Every flagship and repo hero is the same **flagship card** (see `gather-hero.png` for the
reference). It is deliberately clean and uniform:

- **Ceramic card on a dark mat** — light card face, rounded corners, generous margins.
- **One iris accent only.** No second color. (The card renders iris; the site tokens live in
  `DESIGN-RULES.md`.)
- **Eyebrow (mono):** `PROJECT TELOS / {ROLE}` with the `/` in iris.
- **Headline (sans, bold, black):** one or two short lines, the product promise.
- **Pipeline line (mono, muted):** the stage sequence, e.g. `SOURCE / RECEIPT / DIGEST / VERIFY / CORPUS`.
- **Ghost wordmark:** the product name, oversized and faint, bottom-left.
- **One glyph** from the shared library, top-right, with a single iris dot.

Do **not** hand-author bespoke heroes, retro-CGI/busy renders, or per-repo font choices. The
older `telos/tools/render_flagship_heroes.py` retro-CGI style and any hand-rolled bitmap-font PNG
are **retired**. If a hero does not look like the flagship card, it is off-brand.

## The card system

- Template: [`img/og/_card.html`](img/og/_card.html) — renders one 1200x630 card. `?f=<key>`
  selects the entry.
- Data: [`img/og/cards-data.js`](img/og/cards-data.js) (`window.CARD_DATA`) plus a fallback
  `DATA` object inside `_card.html`. Each entry is:
  ```js
  "<key>": { role:"…", word:"…", headline:"…", pipeline:"… / …", glyph:"…" }
  ```
- Glyph library: `aperture, braces, bracket, diamond, graph, intake, layers, ledger, seal,
  shield, spark, triad, waveform`.

## Adding / regenerating a flagship hero

1. Add a `<key>` entry to `img/og/cards-data.js` (and the fallback `DATA` in `_card.html`).
2. Serve the site locally and capture the card to a 2400x1260 PNG with headless Chrome:
   ```bash
   python -m http.server 8811 &
   "C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu \
     --hide-scrollbars --force-device-scale-factor=2 --window-size=1200,630 \
     --virtual-time-budget=3500 --screenshot="img/og/<key>.png" \
     "http://localhost:8811/img/og/_card.html?f=<key>"
   ```
3. The **same PNG** serves two roles: the social card at `img/og/<key>.png` (referenced by the
   page's `og:image`/`twitter:image`) **and** the repo hero at that repo's
   `docs/brand/<name>-hero.png` (referenced by its README).
4. Each repo's `docs/brand/README.md` records this as its rendering receipt.

Verification: a fresh capture of an existing card is byte-identical to its committed hero, so the
brand is fully reproducible.

## Where it is applied

Public flagships (gather, crucible, index, forum, telos, emet, buildlang) and `learn`, plus the
private-line product cards (Gate, Runtime, and the rest) all use this card. Private repos keep the
card as their hero but stay private; only their high-level card/page is public where safe.
