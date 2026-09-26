"""The conclusions companion record: its checksum, its publication gate and its dated page.

A companion record (frontier-safety/data/conclusions/<date>.json) shows on the live
page only while its edition is live, and the edition's dated archive is frozen, so
the builder also renders each companion record on its own page in the plate design:
frontier-safety/conclusions/<date>.html. Record links on that page go to the dated
archive of the edition, and the page carries the edition's control rows so control
links stay on the page. The live page links every record page, so a record stays
reachable after the next edition replaces the live page.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
from pathlib import Path
from typing import Callable

import frontier_safety_conclusions as conclusions
import frontier_safety_plate as plate
from frontier_safety_conclusions_render import human_date, render_section


COMPANION_SCHEMA_VERSION = 2
CHECKSUMS_NAME = "checksums.json"
ROOT_PREFIX = "../../"
SITE = "https://harperz9.github.io/"


def _e(value: object) -> str:
    return html.escape(str(value), quote=True)


def record_path(date: str) -> str:
    return f"frontier-safety/conclusions/{date}.html"


def _head(date: str, assets: plate.ShellAssets) -> str:
    paths = {"root": ROOT_PREFIX, "css_dir": "../", "canonical": f"{SITE}{record_path(date)}"}
    head = plate._render_head(date, paths, assets)
    return head.replace(f"Frontier Safety Briefing · {_e(date)}",
                        f"Conclusions on the Frontier Safety Briefing of {_e(date)}")


def _render_hero(edition: dict, count: int) -> str:
    date = edition["edition_date"]
    added = edition[conclusions.ADDENDUM_KEY]["added_on"]
    cover = f"{ROOT_PREFIX}{plate.COVER_ART_STEM}"
    alt = _e(plate.COVER_ART_ALT)
    return f"""<div class="frame briefing-hero">
  <div class="bar"><span class="nm">Zain Dana Harper</span><span class="rt">Research · Frontier Safety</span></div>
  <div class="mid briefing-intro">
    <h1><span class="title-line">What the record</span> <span class="title-line">lets us conclude.</span> <span class="title-line g">Edition of {_e(human_date(date))}.</span></h1>
    <div class="edition-plate">
      <dl class="edition-readout">
        <div><dt>Edition</dt><dd><time datetime="{_e(date)}">{_e(date)}</time></dd></div>
        <div><dt>Conclusions added</dt><dd><time datetime="{_e(added)}">{_e(human_date(added))}</time></dd></div>
        <div><dt>Conclusions</dt><dd>{count}</dd></div>
      </dl>
    </div>
    <p class="lede">These conclusions were written after the edition of {_e(human_date(date))} was published. This page keeps them once a newer edition replaces the live briefing. Each record link opens that edition's dated archive.</p>
    <figure class="art art-cover briefing-cover">
      <img class="art-light" src="{cover}-light.svg" width="1600" height="800" alt="{alt}" loading="lazy" decoding="async">
      <img class="art-dark" src="{cover}-dark.svg" width="1600" height="800" alt="{alt}" loading="lazy" decoding="async">
    </figure>
  </div>
  <div class="seal">conclusions · evidence links · what would change each one · <a href="../data/conclusions/{_e(date)}.json">machine-readable record</a></div>
</div>"""


def _render_controls(edition: dict, caption: str) -> str:
    rows = plate._render_controls(edition["controls"], plate._control_source_names(edition))
    return f"""<section class="mv wide-section controls">
    <header><h2>Controls in this edition</h2></header>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Controls and evidence-status table"><table class="data data--wide controls-table" role="table">
      {caption}<thead role="rowgroup"><tr role="row"><th role="columnheader">Source</th><th role="columnheader">Reported control</th><th role="columnheader">Evidence status</th></tr></thead>
      <tbody role="rowgroup">{rows}</tbody>
    </table></div>
  </section>"""


def render_record_page(edition: dict, *, caption: str, assets: plate.ShellAssets) -> str:
    """The dated page of one companion record; the edition carries it under ADDENDUM_KEY."""
    date = edition["edition_date"]
    archive = f"{ROOT_PREFIX}frontier-safety/archive/{date}.html"
    count = len(edition[conclusions.ADDENDUM_KEY]["conclusions"])
    section = render_section(edition, ROOT_PREFIX, page=archive, record_link=False,
                             title=f"What the edition of {human_date(date)} lets us conclude")
    return f"""<!DOCTYPE html>
<html lang="en">
{_head(date, assets)}
<body class="inner-clean frame-compact frontier-briefing">
<a class="skip-link" href="#main">Skip to content</a>
<div id="site-nav" class="site-nav"></div>
<noscript><nav class="site-nav"><a href="{ROOT_PREFIX}index.html">Home</a> <a href="{ROOT_PREFIX}research.html">Research</a></nav></noscript>
<script type="module" src="{ROOT_PREFIX}system/nav.js?v={assets.nav}"></script>

{_render_hero(edition, count)}

<main id="main">
  {section}{_render_controls(edition, caption)}
</main>

<footer class="footer-seal" role="contentinfo">
  <p class="seal">Compiled by Zain Dana Harper · Zentropy Labs · <a href="{archive}">Dated archive of this edition</a> · <a href="{ROOT_PREFIX}frontier-safety.html">Current briefing</a> · <a href="{ROOT_PREFIX}research.html">Research index</a></p>
</footer>
<script src="{ROOT_PREFIX}system/reveal.js?v={assets.reveal}" defer></script>
</body>
</html>
"""


def _edition_with_record(data_dir: Path, date: str, live: dict) -> dict:
    if date == live["edition_date"]:
        return live
    addendum = load_addendum(data_dir, date)
    record = json.loads((data_dir / "archive" / f"{date}.json").read_text(encoding="utf-8"))
    edition = {**record, conclusions.ADDENDUM_KEY: addendum}
    conclusions.validate(edition)
    return edition


def record_pages(data_dir: Path, fs_root: Path, live: dict, *,
                 caption: Callable[[str], str], assets: plate.ShellAssets) -> dict[Path, str]:
    """Validate every companion record in data_dir and render its dated page under fs_root.

    live is the edition being built, already validated with its own companion record. A
    companion newer than live (a rebuild of an older edition) must still be published and
    sealed; its page is written when its own edition is built."""
    pages: dict[Path, str] = {}
    for date in companion_dates(data_dir):
        if date > live["edition_date"]:
            load_addendum(data_dir, date)
            continue
        edition = _edition_with_record(data_dir, date, live)
        if conclusions.ADDENDUM_KEY not in edition:
            raise conclusions.ConclusionError(f"conclusions companion {date}.json did not load")
        pages[fs_root / "conclusions" / f"{date}.html"] = render_record_page(
            edition, caption=caption(date), assets=assets)
    return pages


# Loading, checking and sealing a companion record.


def canonical_sha256(payload: dict) -> str:
    """SHA-256 of the parsed record, so line endings and key order cannot move it."""
    text = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _read_json(path: Path, label: str) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise conclusions.ConclusionError(f"cannot read the {label} {path.name}: {exc}") from exc


def sealed_checksums(data_dir: Path) -> dict[str, str]:
    path = data_dir / "conclusions" / CHECKSUMS_NAME
    if not path.exists():
        return {}
    payload = _read_json(path, "conclusions checksums")
    if not isinstance(payload, dict) or payload.get("schema_version") != 1 \
            or not isinstance(payload.get("records"), dict):
        raise conclusions.ConclusionError(f"{CHECKSUMS_NAME} must hold schema_version 1 and a records object")
    return payload["records"]


def _require_published(data_dir: Path, edition_date: str) -> None:
    history = _read_json(data_dir / "history.json", "history") if (data_dir / "history.json").exists() else {}
    entries = history.get("editions", []) if isinstance(history, dict) else []
    recorded = {entry.get("date"): entry.get("sha256") for entry in entries if isinstance(entry, dict)}
    archived = data_dir / "archive" / f"{edition_date}.json"
    if edition_date not in recorded or not archived.exists():
        raise conclusions.ConclusionError(f"conclusions companion {edition_date}.json belongs to an edition that is not "
                              "published; put conclusions in the edition record itself")
    record = _read_json(archived, "archived edition")
    if not isinstance(record, dict) or record.get("edition_sha256") != recorded[edition_date]:
        raise conclusions.ConclusionError(f"edition {edition_date} archive does not match its history digest")


def load_addendum(data_dir: Path, edition_date: str) -> dict | None:
    """Read data/conclusions/<date>.json beside the editions directory, if it exists."""
    path = data_dir / "conclusions" / f"{edition_date}.json"
    if not path.exists():
        return None
    payload = _read_json(path, "conclusions companion")
    expected = {"schema_version", "edition_date", "added_on", "conclusions"}
    if not isinstance(payload, dict) or set(payload) != expected \
            or payload["schema_version"] != COMPANION_SCHEMA_VERSION:
        raise conclusions.ConclusionError(f"conclusions companion {path.name} must hold exactly: "
                              + ", ".join(sorted(expected))
                              + f" (schema_version {COMPANION_SCHEMA_VERSION})")
    if payload["edition_date"] != edition_date:
        raise conclusions.ConclusionError(f"conclusions companion {path.name} names another edition date")
    _require_published(data_dir, edition_date)
    sealed = sealed_checksums(data_dir).get(edition_date)
    actual = canonical_sha256(payload)
    if sealed != actual:
        raise conclusions.ConclusionError(f"conclusions companion {path.name} does not match its sealed checksum "
                              f"in {CHECKSUMS_NAME}; review it, then run "
                              f"tools/frontier_safety_conclusions_record.py --seal {edition_date}")
    return {"added_on": payload["added_on"], "conclusions": payload["conclusions"]}


def companion_dates(data_dir: Path) -> list[str]:
    """Dates of every companion record in data/conclusions, oldest first."""
    folder = data_dir / "conclusions"
    names = sorted(folder.glob("*.json")) if folder.is_dir() else []
    return [path.stem for path in names if conclusions.DATE_PATTERN.fullmatch(path.stem)]


def seal(data_dir: Path, edition_date: str) -> str:
    """Record the checksum of a reviewed companion record where the builder checks it."""
    payload = _read_json(data_dir / "conclusions" / f"{edition_date}.json", "conclusions companion")
    if not isinstance(payload, dict):
        raise conclusions.ConclusionError("a conclusions companion must hold a JSON object")
    records = dict(sealed_checksums(data_dir))
    records[edition_date] = canonical_sha256(payload)
    body = {"schema_version": 1, "records": dict(sorted(records.items()))}
    path = data_dir / "conclusions" / CHECKSUMS_NAME
    path.write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
    return records[edition_date]


def main() -> int:
    parser = argparse.ArgumentParser(description="Seal a reviewed conclusions companion record.")
    parser.add_argument("--seal", metavar="DATE", required=True, help="edition date of the companion record")
    parser.add_argument("--data-dir", type=Path, default=conclusions.ROOT / "frontier-safety" / "data")
    args = parser.parse_args()
    print(seal(args.data_dir, args.seal))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
