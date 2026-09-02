"""Validation and canonical hashing for reviewed public publication records."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlparse


class PublicationError(ValueError):
    """A public-ready record violates its publication boundary."""


REQUIRED_TOP_LEVEL = {
    "schema_version",
    "id",
    "route",
    "category",
    "form",
    "title",
    "summary",
    "author",
    "published_at",
    "updated_at",
    "observed_at",
    "thesis",
    "opening",
    "sections",
    "sources",
    "claims",
    "figures",
    "corrections",
    "ai_assistance",
}
OPTIONAL_TOP_LEVEL = {"personal_voice_adopted", "social"}
CLAIM_STATUSES = {"verified", "inferred", "unknown", "correction"}
SOCIAL_STATES = {"prepared", "not_posted", "published"}
ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIMESTAMP_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
LOCAL_PATH_PATTERN = re.compile(
    r"(?:(?<![A-Za-z0-9+.-])[A-Za-z]:[\\/]|(?:^|[\s(])/(?:Users|home|private|tmp)/)",
    re.IGNORECASE,
)
OPAQUE_CITATION_PATTERN = re.compile(
    r"chatgpt-content-reference|turn\d+(?:search|view|fetch)", re.IGNORECASE
)
SECRET_PATTERNS = (
    re.compile(r"sk-[A-Za-z0-9_-]{20,}"),
    re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"xox[baprs]-[A-Za-z0-9-]{20,}"),
    re.compile(r"BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY"),
)
PUBLICATION_AUTOMATION_ID = "daily-editorial-research-atlas"
PERSONAL_VOICE_PATTERN = re.compile(
    r"(?<![\w'])I(?![\w'])|(?<![\w'])(?:I'm|I've|I'd|I'll|my|mine|me)(?![\w'])",
    re.IGNORECASE,
)
INTERNAL_READER_TERMS = (
    "public-ready packet",
    "automation id",
    "private worktree",
    "collision ledger",
)


def canonical_json_bytes(value: dict | list) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")


def record_sha256(record: dict) -> str:
    return hashlib.sha256(canonical_json_bytes(record)).hexdigest()


def idempotency_key(record: dict) -> str:
    material = (
        f"{PUBLICATION_AUTOMATION_ID}\n{record['observed_at']}\n{record['route']}\n"
        f"{record_sha256(record)}\n"
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def load_record(path: Path) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise PublicationError(f"cannot load publication record {path.name}: {error}") from error
    if not isinstance(payload, dict):
        raise PublicationError(f"{path.name}: publication record must be an object")
    validate_record(payload)
    return payload


def _require_text(container: dict, key: str, context: str) -> str:
    value = container.get(key)
    if not isinstance(value, str) or not value.strip():
        raise PublicationError(f"{context}.{key} must be nonempty text")
    return value


def _require_list(container: dict, key: str, context: str) -> list:
    value = container.get(key)
    if not isinstance(value, list):
        raise PublicationError(f"{context}.{key} must be a list")
    return value


def _validate_date(value: str, context: str) -> None:
    if not DATE_PATTERN.fullmatch(value):
        raise PublicationError(f"{context} must be YYYY-MM-DD")
    try:
        date.fromisoformat(value)
    except ValueError as error:
        raise PublicationError(f"{context} is not a real date") from error


def _validate_timestamp(value: str, context: str) -> None:
    if not TIMESTAMP_PATTERN.fullmatch(value):
        raise PublicationError(f"{context} must be an exact UTC timestamp")
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise PublicationError(f"{context} is not a real timestamp") from error


def _validate_unique_ids(items: list, label: str) -> set[str]:
    identifiers: list[str] = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise PublicationError(f"{label}[{index}] must be an object")
        identifier = _require_text(item, "id", f"{label}[{index}]")
        identifiers.append(identifier)
    if len(identifiers) != len(set(identifiers)):
        raise PublicationError(f"duplicate {label} ids")
    return set(identifiers)


def _walk_strings(value: object):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for child in value.values():
            yield from _walk_strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_strings(child)


def _reader_text(record: dict):
    for key in ("title", "summary", "thesis", "opening", "sections"):
        yield from _walk_strings(record[key])


def _validate_public_text(record: dict) -> None:
    for value in _walk_strings(record):
        if "—" in value:
            raise PublicationError("public record contains an em dash")
        if LOCAL_PATH_PATTERN.search(value):
            raise PublicationError("public record contains a local path")
        if OPAQUE_CITATION_PATTERN.search(value):
            raise PublicationError("public record contains an opaque citation")
        for pattern in SECRET_PATTERNS:
            if pattern.search(value):
                raise PublicationError("public record contains credential-shaped text")
    for value in _reader_text(record):
        lowered = value.casefold()
        if any(term in lowered for term in INTERNAL_READER_TERMS):
            raise PublicationError("reader-facing copy contains internal workflow vocabulary")
    if not record.get("personal_voice_adopted", False):
        if any(PERSONAL_VOICE_PATTERN.search(value) for value in _reader_text(record)):
            raise PublicationError("personal voice requires explicit adoption")


def _validate_sections(record: dict) -> None:
    sections = _require_list(record, "sections", "record")
    if not sections:
        raise PublicationError("record.sections must not be empty")
    _validate_unique_ids(sections, "sections")
    for index, section in enumerate(sections):
        context = f"sections[{index}]"
        if not ID_PATTERN.fullmatch(section["id"]):
            raise PublicationError(f"{context}.id must be a stable slug")
        _require_text(section, "heading", context)
        paragraphs = _require_list(section, "paragraphs", context)
        if not paragraphs or not all(isinstance(item, str) and item.strip() for item in paragraphs):
            raise PublicationError(f"{context}.paragraphs must contain nonempty text")


def _validate_sources(record: dict) -> set[str]:
    sources = _require_list(record, "sources", "record")
    if not sources:
        raise PublicationError("record.sources must not be empty")
    source_ids = _validate_unique_ids(sources, "sources")
    for index, source in enumerate(sources):
        context = f"sources[{index}]"
        for key in ("publisher", "title", "role"):
            _require_text(source, key, context)
        url = _require_text(source, "url", context)
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.netloc:
            raise PublicationError(f"{context}.url must use HTTPS")
        _validate_date(_require_text(source, "published_at", context), f"{context}.published_at")
        _validate_date(_require_text(source, "observed_at", context), f"{context}.observed_at")
    return source_ids


def _validate_claims(record: dict, source_ids: set[str]) -> None:
    claims = _require_list(record, "claims", "record")
    if not claims:
        raise PublicationError("record.claims must not be empty")
    _validate_unique_ids(claims, "claims")
    for index, claim in enumerate(claims):
        context = f"claims[{index}]"
        for key in ("text", "scope", "uncertainty", "doesNotProve"):
            _require_text(claim, key, context)
        status = _require_text(claim, "status", context)
        if status not in CLAIM_STATUSES:
            raise PublicationError(f"{context}.status is unsupported")
        references = _require_list(claim, "source_ids", context)
        if not references or not all(isinstance(item, str) for item in references):
            raise PublicationError(f"{context}.source_ids must contain source ids")
        unknown = sorted(set(references) - source_ids)
        if unknown:
            raise PublicationError(f"{context} references unknown source: {', '.join(unknown)}")


def _validate_figures(record: dict, source_ids: set[str]) -> None:
    figures = _require_list(record, "figures", "record")
    _validate_unique_ids(figures, "figures")
    for index, figure in enumerate(figures):
        context = f"figures[{index}]"
        for key in (
            "title",
            "claim",
            "type",
            "scope",
            "units",
            "denominator",
            "date",
            "transformation",
            "uncertainty",
            "limitations",
            "doesNotProve",
            "alt",
        ):
            _require_text(figure, key, context)
        columns = _require_list(figure, "columns", context)
        rows = _require_list(figure, "rows", context)
        if not columns or not all(isinstance(item, str) and item.strip() for item in columns):
            raise PublicationError(f"{context}.columns must contain labels")
        if not rows:
            raise PublicationError(f"{context}.rows must not be empty")
        for row_index, row in enumerate(rows):
            if not isinstance(row, list) or len(row) != len(columns):
                raise PublicationError(f"{context}.rows[{row_index}] must match columns")
            if not all(isinstance(item, str) and item.strip() for item in row):
                raise PublicationError(f"{context}.rows[{row_index}] must contain text")
        provenance = _require_list(figure, "provenance", context)
        unknown = sorted(set(provenance) - source_ids)
        if not provenance or unknown:
            detail = f": {', '.join(unknown)}" if unknown else ""
            raise PublicationError(f"{context}.provenance references unknown source{detail}")


def _validate_social(record: dict) -> None:
    social = record.get("social")
    if social is None:
        return
    if not isinstance(social, dict):
        raise PublicationError("record.social must be an object")
    for channel, derivative in social.items():
        if not isinstance(derivative, dict):
            raise PublicationError(f"social.{channel} must be an object")
        state = derivative.get("state")
        if state not in SOCIAL_STATES:
            raise PublicationError(f"social.{channel}.state is unsupported")
        if state == "published":
            url = derivative.get("post_url")
            published_at = derivative.get("published_at")
            if (
                not isinstance(url, str)
                or urlparse(url).scheme != "https"
                or not isinstance(published_at, str)
            ):
                raise PublicationError("published social derivative requires exact receipt")
            _validate_timestamp(published_at, f"social.{channel}.published_at")


def validate_record(record: dict) -> None:
    if not isinstance(record, dict):
        raise PublicationError("publication record must be an object")
    missing = sorted(REQUIRED_TOP_LEVEL - set(record))
    if missing:
        raise PublicationError(f"record missing required fields: {', '.join(missing)}")
    unknown = sorted(set(record) - REQUIRED_TOP_LEVEL - OPTIONAL_TOP_LEVEL)
    if unknown:
        raise PublicationError(f"record contains unsupported fields: {', '.join(unknown)}")
    if record["schema_version"] != 1:
        raise PublicationError("record.schema_version must equal 1")
    for key in ("id", "category"):
        value = _require_text(record, key, "record")
        if not ID_PATTERN.fullmatch(value):
            raise PublicationError(f"record.{key} must be a stable slug")
    route = _require_text(record, "route", "record")
    if Path(route).name != route or not route.endswith(".html") or ".." in route:
        raise PublicationError("record.route must be one HTML basename")
    for key in ("form", "title", "summary", "author", "thesis", "ai_assistance"):
        _require_text(record, key, "record")
    if record["author"] != "Zain Dana Harper":
        raise PublicationError("record.author must be Zain Dana Harper")
    _validate_date(_require_text(record, "published_at", "record"), "record.published_at")
    _validate_date(_require_text(record, "updated_at", "record"), "record.updated_at")
    _validate_timestamp(_require_text(record, "observed_at", "record"), "record.observed_at")
    opening = record.get("opening")
    if not isinstance(opening, dict):
        raise PublicationError("record.opening must be an object")
    for key in ("question", "finding", "evidence", "limit"):
        _require_text(opening, key, "opening")
    _validate_sections(record)
    source_ids = _validate_sources(record)
    _validate_claims(record, source_ids)
    _validate_figures(record, source_ids)
    corrections = _require_list(record, "corrections", "record")
    if not all(isinstance(item, str) and item.strip() for item in corrections):
        raise PublicationError("record.corrections must contain nonempty text")
    if "personal_voice_adopted" in record and not isinstance(
        record["personal_voice_adopted"], bool
    ):
        raise PublicationError("record.personal_voice_adopted must be boolean")
    _validate_social(record)
    _validate_public_text(record)
