"""Link targets are part of an HTML source fingerprint (2026-10-14).

Before this, the normalizer kept text nodes only. A cited page that kept its words and
changed where a link pointed fingerprinted as unchanged.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))


def load(name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "tools" / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


checker = load("check_frontier_safety_sources")
WORDS = "The incident report is published in full. " * 10


def page(href: str, words: str = WORDS) -> bytes:
    return (f'<header>chrome</header><div class="content post-content"><p>{words}'
            f'<a href="{href}">the report</a> stands.</p></div>').encode()


def norm(raw: bytes, **kwargs) -> str:
    return checker.normalize_html(raw, profile="metr_blog_article", **kwargs)


def test_swapped_link_target_changes_the_fingerprint() -> None:
    original = norm(page("https://example.org/report"))
    swapped = norm(page("https://example.net/forged"))
    assert original != swapped
    assert "<https://example.org/report>" in original


def test_same_page_still_normalizes_identically() -> None:
    raw = page("https://example.org/report")
    assert norm(raw) == norm(raw)


def test_link_blind_mode_reproduces_the_old_text_only_fingerprint() -> None:
    original = norm(page("https://example.org/report"), link_targets=False)
    swapped = norm(page("https://example.net/forged"), link_targets=False)
    assert original == swapped
    assert "example" not in original


def test_links_in_skipped_subtrees_stay_out() -> None:
    raw = (b'<div class="blog-content"><p>' + WORDS.encode() + b"</p>"
           b'<div class="not-prose"><a href="https://example.org/upvote">Upvote 3</a></div></div>')
    assert "upvote" not in checker.normalize_html(raw, profile="huggingface_blog_article")


def registry() -> dict:
    return {"schema_version": 1, "observed_at": "2026-10-14T00:00:00Z", "sources": [{
        "id": "s1", "url": "https://example.org/a", "status": "available",
        "fingerprint_profile": "metr_blog_article"}]}


def state(sha: str) -> dict:
    return {"schema_version": 1, "observed_at": "2026-10-14T00:00:00Z", "changed_source_ids": [], "error_source_ids": [], "sources": [{
        "id": "s1", "status": "available", "changed": False, "url": "https://example.org/a",
        "sha256": sha, "normalized_characters": 500, "etag": None, "last_modified": None}]}


def _check_against_old_baseline(tmp_path, monkeypatch, text_only_sha256: str) -> dict:
    registry_path, state_path = tmp_path / "registry.json", tmp_path / "state.json"
    registry_path.write_text(json.dumps(registry()), encoding="utf-8")
    state_path.write_text(json.dumps(state("0" * 64)), encoding="utf-8")
    monkeypatch.setattr(checker, "fetch", lambda *args, **kwargs: {
        "url": "https://example.org/a", "sha256": "1" * 64, "normalized_characters": 500,
        "etag": None, "last_modified": None, "normalizer": checker.HTML_NORMALIZER,
        "text_only_sha256": text_only_sha256})
    return checker.check(registry_path, state_path, 1.0)


def test_old_baseline_with_same_words_reads_as_unbaselined(tmp_path, monkeypatch) -> None:
    report = _check_against_old_baseline(tmp_path, monkeypatch, "0" * 64)
    assert report["changed_source_ids"] == []
    assert report["unbaselined_source_ids"] == ["s1"]
    assert report["review_required_source_ids"] == ["s1"]


def test_old_baseline_with_changed_words_still_reads_as_changed(tmp_path, monkeypatch) -> None:
    report = _check_against_old_baseline(tmp_path, monkeypatch, "2" * 64)
    assert report["changed_source_ids"] == ["s1"]
    assert report["unbaselined_source_ids"] == []


def test_renormalize_moves_only_baselines_whose_words_still_match() -> None:
    renorm = load("frontier_safety_renormalize")
    raw = page("https://example.org/report")
    stored = hashlib.sha256(norm(raw, link_targets=False).encode()).hexdigest()

    def fetch_same(url, timeout):
        return raw, {"etag": None, "last_modified": None}

    updated, outcomes = renorm.renormalize(registry(), state(stored), fetch=fetch_same, now="2026-10-14T00:00:00Z")
    record = updated["sources"][0]
    assert outcomes[0]["outcome"] == "renormalized"
    assert record["normalizer"] == checker.HTML_NORMALIZER
    assert record["renormalized_from_sha256"] == stored
    assert record["sha256"] == hashlib.sha256(norm(raw).encode()).hexdigest()
    checker.validate_state(updated)

    edited = page("https://example.org/report", words="Words that changed after review. " * 10)

    def fetch_edited(url, timeout):
        return edited, {"etag": None, "last_modified": None}

    updated, outcomes = renorm.renormalize(registry(), state(stored), fetch=fetch_edited)
    assert outcomes[0]["outcome"] == "words_changed"
    assert updated["sources"][0]["sha256"] == stored
    assert "normalizer" not in updated["sources"][0]
