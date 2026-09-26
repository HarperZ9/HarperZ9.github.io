"""Listing records: works that join the dated publication index without a generated page.

A full record in publications/data/records renders its own article page. Some works
are written by hand or built by another generator: Who Knew First, the open letter,
the Frontier Safety briefing, the incident dossier and the witness essay. A full
record would overwrite those pages. A listing puts such a work into the dated index
on publications.html and writing.html and into the feeds, and never renders its page.

Files: publications/data/listings/<id>.json, one per work. Each listing is validated
with the same public-text rules as full records, its route must exist in the site,
and an optional date_source ("path#field") reads the updated date at build time, so
a recurring briefing lists its current edition with no hand edit.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from tools.publication_model import (
    DATE_PATTERN,
    ID_PATTERN,
    INTERNAL_READER_TERMS,
    LOCAL_PATH_PATTERN,
    OPAQUE_CITATION_PATTERN,
    SECRET_PATTERNS,
    PublicationError,
    canonical_json_bytes,
)

LISTING_FIELDS = {
    "schema_version", "id", "route", "form", "category", "title", "summary",
    "published_at", "updated_at", "date_source", "hubs", "topics", "ai_assistance",
}
HUBS = {"publications", "writing"}
TEXT_FIELDS = ("route", "form", "category", "title", "summary")


def listing_sha256(listing: dict) -> str:
    return hashlib.sha256(canonical_json_bytes(listing)).hexdigest()


def _route_file(root: Path, route: str) -> Path:
    relative = route.lstrip("/")
    target = root / relative
    if relative.endswith("/") or target.is_dir():
        return target / "index.html"
    return target


def _check_text(value: str, context: str) -> None:
    if "—" in value:
        raise PublicationError(f"{context} contains an em dash")
    if LOCAL_PATH_PATTERN.search(value):
        raise PublicationError(f"{context} contains a local path")
    if OPAQUE_CITATION_PATTERN.search(value):
        raise PublicationError(f"{context} contains an opaque citation")
    for pattern in SECRET_PATTERNS:
        if pattern.search(value):
            raise PublicationError(f"{context} contains credential-shaped text")
    if any(term in value.casefold() for term in INTERNAL_READER_TERMS):
        raise PublicationError(f"{context} contains internal workflow vocabulary")


def _validate_date(value: object, context: str) -> str:
    if not isinstance(value, str) or not DATE_PATTERN.match(value):
        raise PublicationError(f"{context} must be a YYYY-MM-DD date")
    return value


def resolve_date_source(root: Path, pointer: str, context: str) -> str:
    """Read "path#field" or "path#a/b" from a JSON file under the site root."""
    path_text, sep, field_path = pointer.partition("#")
    if not sep or not path_text or not field_path:
        raise PublicationError(f"{context}.date_source must be path#field")
    source = root / path_text
    if not source.is_file():
        raise PublicationError(f"{context}.date_source file is missing: {path_text}")
    value: object = json.loads(source.read_text(encoding="utf-8"))
    for key in field_path.split("/"):
        if not isinstance(value, dict) or key not in value:
            raise PublicationError(f"{context}.date_source field is missing: {field_path}")
        value = value[key]
    if isinstance(value, str):
        value = value[:10]
    return _validate_date(value, f"{context}.date_source value")


def validate_listing(data: dict, root: Path, context: str) -> None:
    if not isinstance(data, dict) or set(data) != LISTING_FIELDS:
        raise PublicationError(f"{context} must have exactly the listing fields")
    if data["schema_version"] != 1:
        raise PublicationError(f"{context}.schema_version must be 1")
    if not isinstance(data["id"], str) or not ID_PATTERN.match(data["id"]):
        raise PublicationError(f"{context}.id must be a lowercase slug")
    for key in TEXT_FIELDS:
        if not isinstance(data[key], str) or not data[key].strip():
            raise PublicationError(f"{context}.{key} must be non-empty text")
        _check_text(data[key], f"{context}.{key}")
    _validate_date(data["published_at"], f"{context}.published_at")
    _validate_date(data["updated_at"], f"{context}.updated_at")
    if data["published_at"] > data["updated_at"]:
        raise PublicationError(f"{context}.updated_at precedes published_at")
    hubs = data["hubs"]
    if not isinstance(hubs, list) or not hubs or not set(hubs) <= HUBS or len(set(hubs)) != len(hubs):
        raise PublicationError(f"{context}.hubs must list publications and/or writing")
    topics = data["topics"]
    if not isinstance(topics, list) or not all(isinstance(t, str) and t.strip() for t in topics):
        raise PublicationError(f"{context}.topics must be a list of words")
    for topic in topics:
        _check_text(topic, f"{context}.topics")
    if data["ai_assistance"] is not None:
        if not isinstance(data["ai_assistance"], str) or not data["ai_assistance"].strip():
            raise PublicationError(f"{context}.ai_assistance must be text or null")
        _check_text(data["ai_assistance"], f"{context}.ai_assistance")
    if data["date_source"] is not None and not isinstance(data["date_source"], str):
        raise PublicationError(f"{context}.date_source must be path#field or null")
    if not _route_file(root, data["route"]).is_file():
        raise PublicationError(f"{context}.route does not exist in the site: {data['route']}")


def load_listing(path: Path, root: Path) -> tuple[dict, dict]:
    """Return (listing as rendered, listing as stored). A date_source sets updated_at."""
    stored = json.loads(path.read_text(encoding="utf-8"))
    context = f"listing {path.name}"
    validate_listing(stored, root, context)
    listing = dict(stored)
    if stored["date_source"]:
        listing["updated_at"] = resolve_date_source(root, stored["date_source"], context)
        if listing["updated_at"] < listing["published_at"]:
            raise PublicationError(f"{context}.date_source precedes published_at")
    return listing, stored
