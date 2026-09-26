"""The conclusions layer of the Frontier Safety Briefing: the schema and its validation.

An edition may carry a "conclusions" list: what its record lets a reader conclude,
at the strength the evidence supports. The builder's docstring documents the fields
for edition authors; this module validates them. Rendering lives in
frontier_safety_conclusions_render.py; the companion record (its checksum, its
publication gate and its dated page) in frontier_safety_conclusions_record.py.

Each evidence reference is one typed string that must resolve inside the edition:

    item:<item id>          a record in one of this edition's lanes
    control:<claim>         the exact claim text of one of this edition's control rows
    source:<https URL>      a source URL cited by a record or a control row in this edition
    edition:<YYYY-MM-DD>    an earlier edition with a published dated archive

An edition whose record is already published and frozen cannot take a new field
without changing its digest. Its conclusions go in a companion record,
frontier-safety/data/conclusions/<date>.json, which the builder accepts only when:

  * the edition is published: history.json lists the date with the digest of the
    archived record in data/archive/<date>.json;
  * the file's canonical SHA-256 matches the value sealed in
    data/conclusions/checksums.json (seal a reviewed file with
    `python tools/frontier_safety_conclusions_record.py --seal <date>`).

The builder shows a companion record on the live page while its edition is live,
stores it in current.json under ADDENDUM_KEY, leaves it out of edition_sha256 and
every dated archive, and renders it on its own dated page,
frontier-safety/conclusions/<date>.html, so it survives the next edition.
"""

from __future__ import annotations

import re
from datetime import date as calendar_date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ADDENDUM_KEY = "conclusions_addendum"
ENTRY_FIELDS = ("id", "scope", "strength", "lead", "body", "evidence", "would_change_it")
SCOPES = ("edition", "cross_edition")
# Strength, in reading order, with the heading each group carries on the page.
STRENGTHS = {
    "shows": "The evidence shows",
    "points_to": "The evidence points to",
    "grey": "Still grey",
}
REFERENCE_KINDS = ("item", "control", "source", "edition")
LEAD_MAX_WORDS = 35
ID_PATTERN = re.compile(r"[a-z0-9][a-z0-9-]{0,39}")
DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}")
BARE_SEVERITY = re.compile(r"(?<![A-Za-z0-9_-])T[123](?![A-Za-z0-9_-])")
LOCAL_PATH = re.compile(
    r"\b[A-Za-z]:[\\/]|\\\\[A-Za-z0-9]|file://|\bAppData\b"
    r"|(?:^|[\s(\"'])~?/(?:Users|home|dev|tmp|mnt|var|opt|private|etc)/"
)
INTERNAL_IDENTIFIERS = (
    (re.compile(r"https?://", re.I), "a URL; cite it in evidence"),
    (re.compile(r"\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b"), "a snake_case identifier"),
    (re.compile(r"\b[\w.-]+\.(?:json|py|html|css|m?js|md|txt|ya?ml|toml)\b", re.I), "a file name"),
    (re.compile(r"\b[a-z0-9-]+\.(?:com|org|gov|uk|io|ai|net|dev)\b", re.I), "a hostname"),
    (re.compile(r"\b[a-z0-9]+(?:-[a-z0-9]+){3,}\b"), "a record or source identifier"),
    (re.compile(r"\b[0-9a-f]{12,}\b"), "a hex digest"),
    (re.compile(r"\bturn\d+\w*|contentReference|oaicite", re.I), "an opaque citation marker"),
)
# A second sentence starts after closing punctuation and a space, with a capital or digit.
SECOND_SENTENCE = re.compile(r"[.!?][\"')\]]?\s+[A-Z0-9]")


class ConclusionError(ValueError):
    """Raised when a conclusion or its companion record breaks the publication contract."""


def control_anchor(index: int) -> str:
    """The id of the index-th control row (1-based), shared with the plate's table."""
    return f"control-{index}"


def _published_archive_dates() -> set[str]:
    return {path.stem for path in (ROOT / "frontier-safety" / "archive").glob("*.html")}


def _text(value: object, where: str, item_ids: set[str]) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ConclusionError(f"{where} must be non-empty text")
    if "—" in value:
        raise ConclusionError(f"{where} contains an em dash; use a comma, colon or full stop")
    if BARE_SEVERITY.search(value):
        raise ConclusionError(f"{where} uses an unnamespaced severity label")
    path = LOCAL_PATH.search(value)
    if path:
        raise ConclusionError(f"{where} contains a local path near {path.group(0).strip()!r}")
    for pattern, label in INTERNAL_IDENTIFIERS:
        found = pattern.search(value)
        if found:
            raise ConclusionError(f"{where} contains an internal identifier, {label}: {found.group(0)!r}")
    for item_id in item_ids:
        if item_id in value:
            raise ConclusionError(f"{where} names the record id {item_id!r}; cite it in evidence instead")
    return value


def _lead(value: object, where: str, item_ids: set[str]) -> None:
    """One plain sentence a reader takes in at a glance: 35 words or fewer."""
    text = _text(value, where, item_ids).strip()
    words = len(text.split())
    if words > LEAD_MAX_WORDS:
        raise ConclusionError(f"{where} has {words} words; a lead is one sentence of "
                              f"{LEAD_MAX_WORDS} words or fewer")
    if not text.endswith((".", "?")) or SECOND_SENTENCE.search(text[:-1]):
        raise ConclusionError(f"{where} must be exactly one sentence, ending in a full stop")


def _body(value: object, where: str, item_ids: set[str]) -> None:
    if not isinstance(value, list) or not value:
        raise ConclusionError(f"{where} must be a non-empty list of paragraphs")
    for number, paragraph in enumerate(value):
        _text(paragraph, f"{where}[{number}]", item_ids)


def _index(edition: dict) -> dict:
    """What an evidence reference may resolve to in this edition."""
    items = {item["id"]: item for lane in edition["lanes"] for item in lane["items"]}
    controls = {control["claim"].strip(): index
                for index, control in enumerate(edition["controls"], start=1)}
    sources: dict[str, str | None] = {}
    for item in items.values():
        for source in item["sources"]:
            sources.setdefault(source["url"], source["title"])
    for control in edition["controls"]:
        for url in control["sources"]:
            sources.setdefault(url, None)
    return {"item": items, "control": controls, "source": sources}


def _resolve(reference: object, where: str, index: dict, edition_date: str, archives: set[str]) -> str:
    if not isinstance(reference, str) or ":" not in reference:
        raise ConclusionError(f"{where} must be a typed reference such as 'item:<id>'; kinds: "
                              + ", ".join(REFERENCE_KINDS))
    kind, value = reference.split(":", 1)
    if kind not in REFERENCE_KINDS:
        raise ConclusionError(f"{where} has unknown reference kind {kind!r}; kinds: "
                              + ", ".join(REFERENCE_KINDS))
    if kind == "edition":
        if not DATE_PATTERN.fullmatch(value) or value not in archives or value >= edition_date:
            raise ConclusionError(f"{where} {reference!r} does not resolve to an earlier edition "
                                  "with a published dated archive")
    elif value not in index[kind]:
        raise ConclusionError(f"{where} {reference!r} does not resolve: no {kind} in this edition matches it")
    return kind


def _validate_fields(entry: dict, where: str) -> None:
    unknown = sorted(set(entry) - set(ENTRY_FIELDS))
    missing = [key for key in ENTRY_FIELDS if key not in entry]
    if unknown:
        raise ConclusionError(f"{where} has unknown field(s) {', '.join(unknown)}; "
                              f"allowed: {', '.join(ENTRY_FIELDS)}")
    if missing:
        raise ConclusionError(f"{where} is missing field(s) {', '.join(missing)}")
    if entry["scope"] not in SCOPES:
        raise ConclusionError(f"{where}.scope {entry['scope']!r} is not one of: {', '.join(SCOPES)}")
    if entry["strength"] not in STRENGTHS:
        raise ConclusionError(f"{where}.strength {entry['strength']!r} is not one of: "
                              + ", ".join(STRENGTHS))


def _validate_entry(entry: object, position: int, context: str, index: dict,
                    edition_date: str, archives: set[str]) -> str:
    where = f"{context}[{position}]"
    if not isinstance(entry, dict):
        raise ConclusionError(f"{where} must be an object")
    entry_id = entry.get("id")
    if not isinstance(entry_id, str) or not ID_PATTERN.fullmatch(entry_id):
        raise ConclusionError(f"{where}.id must be a short lowercase id such as 'e1'")
    where = f"{context}[{entry_id}]"
    _validate_fields(entry, where)
    item_ids = set(index["item"])
    _lead(entry["lead"], f"{where}.lead", item_ids)
    _body(entry["body"], f"{where}.body", item_ids)
    _text(entry["would_change_it"], f"{where}.would_change_it", item_ids)
    evidence = entry["evidence"]
    if not isinstance(evidence, list) or not evidence:
        raise ConclusionError(f"{where}.evidence must be a non-empty list of references")
    if len(set(map(str, evidence))) != len(evidence):
        raise ConclusionError(f"{where}.evidence repeats a reference")
    kinds = {_resolve(ref, f"{where}.evidence[{n}]", index, edition_date, archives)
             for n, ref in enumerate(evidence)}
    if entry["scope"] == "cross_edition" and "edition" not in kinds:
        raise ConclusionError(f"{where} is cross_edition but cites no earlier edition")
    return entry_id


def entries_and_context(edition: dict) -> tuple[object, str] | None:
    """The edition's conclusions and where they sit, or None when it has none."""
    has_field, has_addendum = "conclusions" in edition, ADDENDUM_KEY in edition
    if has_field and has_addendum:
        raise ConclusionError(f"an edition carries conclusions or {ADDENDUM_KEY}, never both")
    if has_field:
        return edition["conclusions"], "conclusions"
    if not has_addendum:
        return None
    addendum = edition[ADDENDUM_KEY]
    if not isinstance(addendum, dict) or set(addendum) != {"added_on", "conclusions"}:
        raise ConclusionError(f"{ADDENDUM_KEY} must contain exactly added_on and conclusions")
    added = addendum["added_on"]
    if not isinstance(added, str) or not DATE_PATTERN.fullmatch(added) or added < edition["edition_date"]:
        raise ConclusionError(f"{ADDENDUM_KEY}.added_on must be a YYYY-MM-DD date on or after the edition date")
    try:
        calendar_date.fromisoformat(added)
    except ValueError as exc:
        raise ConclusionError(f"{ADDENDUM_KEY}.added_on must be a valid calendar date") from exc
    return addendum["conclusions"], f"{ADDENDUM_KEY}.conclusions"


def validate(edition: dict, archive_dates: set[str] | None = None) -> None:
    """Check the optional conclusions of an edition whose record is already valid."""
    found = entries_and_context(edition)
    if found is None:
        return
    entries, context = found
    if not isinstance(entries, list) or not entries:
        raise ConclusionError(f"{context} must be a non-empty list; omit the field when there are none")
    archives = _published_archive_dates() if archive_dates is None else archive_dates
    index = _index(edition)
    seen: set[str] = set()
    for position, entry in enumerate(entries):
        entry_id = _validate_entry(entry, position, context, index, edition["edition_date"], archives)
        if entry_id in seen:
            raise ConclusionError(f"{context} repeats the id {entry_id!r}")
        seen.add(entry_id)
