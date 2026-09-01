"""Public-ready publication record validation and hashing contracts."""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from tools.publication_model import (
    PublicationError,
    idempotency_key,
    record_sha256,
    validate_record,
)


FIXTURE = Path(__file__).parent / "fixtures" / "publication-record.json"


def valid_record() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def test_complete_publication_record_is_valid() -> None:
    validate_record(valid_record())


def test_record_requires_the_canonical_author_name() -> None:
    record = valid_record()
    record["author"] = "Unknown author"

    with pytest.raises(PublicationError, match="author"):
        validate_record(record)


def test_record_requires_known_claim_sources() -> None:
    record = valid_record()
    record["claims"][0]["source_ids"] = ["missing"]

    with pytest.raises(PublicationError, match="unknown source"):
        validate_record(record)


def test_record_hash_ignores_key_order_but_not_claim_text() -> None:
    first = valid_record()
    reordered = dict(reversed(list(copy.deepcopy(first).items())))

    assert record_sha256(first) == record_sha256(reordered)
    reordered["claims"][0]["text"] = "A different claim."
    assert record_sha256(first) != record_sha256(reordered)


def test_idempotency_key_binds_observation_route_and_record() -> None:
    first = valid_record()
    changed_route = copy.deepcopy(first)
    changed_route["route"] = "changed.html"
    changed_observation = copy.deepcopy(first)
    changed_observation["observed_at"] = "2026-09-01T18:00:00Z"

    assert len(idempotency_key(first)) == 64
    assert idempotency_key(first) != idempotency_key(changed_route)
    assert idempotency_key(first) != idempotency_key(changed_observation)


@pytest.mark.parametrize(
    ("mutation", "message"),
    [
        (lambda record: record["opening"].pop("limit"), "opening.limit"),
        (lambda record: record.update(route="../escape.html"), "route"),
        (lambda record: record["sources"][0].update(url="http://example.org"), "HTTPS"),
        (lambda record: record["claims"][0].update(doesNotProve=""), "doesNotProve"),
        (lambda record: record["figures"][0].update(denominator=""), "denominator"),
        (lambda record: record["sections"][0]["paragraphs"].append("Local Q:/private-note"), "local path"),
        (lambda record: record["sections"][0]["paragraphs"].append("Opaque turn12search4 marker"), "opaque citation"),
        (lambda record: record["summary"] + " — overstated", "em dash"),
    ],
)
def test_record_rejects_invalid_public_boundaries(mutation, message: str) -> None:
    record = valid_record()
    result = mutation(record)
    if isinstance(result, str):
        record["summary"] = result

    with pytest.raises(PublicationError, match=message):
        validate_record(record)


@pytest.mark.parametrize("collection", ["sections", "sources", "claims", "figures"])
def test_record_rejects_duplicate_ids(collection: str) -> None:
    record = valid_record()
    record[collection].append(copy.deepcopy(record[collection][0]))

    with pytest.raises(PublicationError, match=f"duplicate {collection}"):
        validate_record(record)


def test_first_person_public_claim_requires_adoption() -> None:
    record = valid_record()
    record["sections"][0]["paragraphs"] = ["I observed this directly."]

    with pytest.raises(PublicationError, match="personal voice"):
        validate_record(record)

    record["personal_voice_adopted"] = True
    validate_record(record)


def test_published_social_derivative_requires_exact_receipt() -> None:
    record = valid_record()
    record["social"] = {
        "x": {"state": "published", "post_url": None, "published_at": None}
    }

    with pytest.raises(PublicationError, match="published social"):
        validate_record(record)
