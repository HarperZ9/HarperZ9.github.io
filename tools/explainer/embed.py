"""The figure a page shows for one explainer, built from its committed receipt.

The video never autoplays and loads nothing until the reader presses play. The poster frame,
the captions track and the transcript carry the whole explainer for a reader who does not
play it, which covers reduced motion as well.
"""

from __future__ import annotations

import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def figure(slug: str, root: Path = ROOT) -> str:
    folder = f"media/explainers/{slug}"
    receipt = json.loads((root / folder / "receipt.json").read_text(encoding="utf-8"))
    title = html.escape(receipt["title"])
    seconds = round(receipt["seconds"])
    transcript = "".join(f"<p>{html.escape(row['text'])}</p>" for row in receipt["timeline"])
    return (
        f'<figure class="explainer" id="explainer-{slug}" style="margin:1.6rem 0 2rem">'
        f'<video controls preload="none" playsinline width="1280" height="720" poster="{folder}/poster.png" '
        f'style="display:block;width:100%;height:auto;background:#060608" '
        f'aria-label="{title}, a {seconds}-second explainer" aria-describedby="explainer-{slug}-transcript">'
        f'<source src="{folder}/{slug}.mp4" type="video/mp4">'
        f'<track kind="captions" src="{folder}/{slug}.vtt" srclang="en" label="English" default>'
        "</video>"
        f'<figcaption><b>{title}</b>, a {seconds}-second explainer with captions and a local voice. '
        f'Its <a class="inline" href="{folder}/receipt.json">build receipt</a> lets anyone rebuild it '
        "and compare the hashes.</figcaption>"
        f'<details id="explainer-{slug}-transcript"><summary>Transcript</summary>{transcript}</details>'
        "</figure>"
    )


def insert_after_section(body: str, anchor: str, block: str) -> str:
    """Place `block` at the end of the section headed by <h2 id="anchor">, before the next h2."""
    start = body.find(f'<h2 id="{anchor}">')
    if start < 0:
        raise ValueError(f"no section {anchor!r} to hold an explainer")
    end = body.find("<h2 ", start + 1)
    end = len(body) if end < 0 else end
    return body[:end] + block + "\n" + body[end:]
