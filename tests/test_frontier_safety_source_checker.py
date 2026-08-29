"""Source-fingerprint contracts for the Frontier Safety Briefing."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from urllib.error import URLError

import pytest


ROOT = Path(__file__).resolve().parents[1]


def load_checker():
    path = ROOT / "tools" / "check_frontier_safety_sources.py"
    spec = importlib.util.spec_from_file_location("frontier_safety_source_checker", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload), encoding="utf-8")


def fetched(url: str, sha256: str) -> dict:
    return {
        "url": url,
        "sha256": sha256,
        "normalized_characters": 500,
        "etag": None,
        "last_modified": None,
    }


def registry_payload(sources: list[dict]) -> dict:
    return {
        "schema_version": 1,
        "observed_at": "2026-08-24T00:00:00Z",
        "sources": sources,
    }


def state_payload(sources: list[dict]) -> dict:
    return {
        "schema_version": 1,
        "observed_at": "2026-08-24T00:00:00Z",
        "sources": sources,
        "changed_source_ids": [],
        "error_source_ids": [],
    }


def valid_registry_source(source_id: str = "source") -> dict:
    return {
        "id": source_id,
        "url": f"https://example.test/{source_id}",
        "status": "available",
        "fingerprint_profile": "openai_news_article",
    }


def valid_state_source(source_id: str = "source") -> dict:
    return {
        "id": source_id,
        "url": f"https://example.test/{source_id}",
        "status": "available",
        "changed": False,
        "sha256": "a" * 64,
        "normalized_characters": 500,
        "etag": None,
        "last_modified": None,
    }


def test_hugging_face_profile_ignores_engagement_and_discussion_churn() -> None:
    checker = load_checker()
    article = "Verified incident account. " * 20
    first = b"""
        <main><div class="blog-content prose">
          <h1>Incident timeline</h1>
          <div class="not-prose">Upvote 478</div>
          <div class="relative overflow-clip"><p>ARTICLE_TEXT</p></div>
        </div><div><h3>Community</h3><p>First comment</p></div></main>
    """.replace(b"ARTICLE_TEXT", article.encode())
    second = b"""
        <main><div class="blog-content prose">
          <h1>Incident timeline</h1>
          <div class="not-prose">Upvote 480</div>
          <div class="relative overflow-clip"><p>ARTICLE_TEXT</p></div>
        </div><div><h3>Community</h3><p>New comment</p></div></main>
    """.replace(b"ARTICLE_TEXT", article.encode())

    assert checker.normalize_html(first, profile="huggingface_blog_article") == checker.normalize_html(
        second, profile="huggingface_blog_article"
    )


def test_hugging_face_profile_detects_substantive_article_edits() -> None:
    checker = load_checker()
    before = ("Verified incident account before review. " * 20).encode()
    after = ("Verified incident account after review. " * 20).encode()

    assert checker.normalize_html(
        b'<div class="blog-content prose"><p>' + before + b"</p></div>",
        profile="huggingface_blog_article",
    ) != checker.normalize_html(
        b'<div class="blog-content prose"><p>' + after + b"</p></div>",
        profile="huggingface_blog_article",
    )


@pytest.mark.parametrize(
    ("profile", "open_tag", "close_tag"),
    [
        ("aisi_report_article", '<div data-content="main" class="rtf-cms">', "</div>"),
        (
            "anthropic_news_article",
            '<div class="Body-module-scss-module__hash__body">',
            "</div>",
        ),
        ("openai_news_article", '<article class="flex min-w-0">', "</article>"),
        ("metr_blog_article", '<div class="content post-content">', "</div>"),
        ("nvd_vulnerability_detail", '<div id="vulnDetailPanel">', "</div>"),
        (
            "sysdig_blog_article",
            '<div fs-toc-element="contents" class="rich-text w-richtext">',
            "</div>",
        ),
    ],
)
def test_html_profiles_extract_only_the_expected_substantive_container(
    profile: str, open_tag: str, close_tag: str
) -> None:
    checker = load_checker()
    article = "Substantive source sentence. " * 20
    raw = f"<header>dynamic chrome</header>{open_tag}<p>{article}</p>{close_tag}<footer>dynamic footer</footer>".encode()

    normalized = checker.normalize_html(raw, profile=profile)

    assert article.strip() in normalized
    assert "dynamic chrome" not in normalized
    assert "dynamic footer" not in normalized


@pytest.mark.parametrize(
    ("raw", "message"),
    [
        (b"<main><p>no article container</p></main>", "container not found"),
        (b'<div class="blog-content"></div>', "minimum content"),
        (
            b'<div class="blog-content"><p>' + b"substantive text " * 20 + b"</p>",
            "unclosed target container",
        ),
        (
            b'<div class="blog-content"><div class="not-prose">' + b"dynamic " * 40,
            "unclosed skipped container",
        ),
        (
            b'<div class="blog-content"><p>'
            + b"first article " * 20
            + b'</p></div><div class="blog-content"><p>'
            + b"second article " * 20
            + b"</p></div>",
            "exactly one completed target",
        ),
    ],
)
def test_html_profile_fails_closed_for_invalid_target_structure(raw: bytes, message: str) -> None:
    checker = load_checker()

    with pytest.raises(ValueError, match=message):
        checker.normalize_html(raw, profile="huggingface_blog_article")


def test_unknown_fingerprint_profile_errors() -> None:
    checker = load_checker()

    with pytest.raises(ValueError, match="unknown fingerprint profile"):
        checker.normalize_html(b"substantive content " * 20, profile="unknown-profile")


def test_markdown_profile_normalizes_stable_source_content() -> None:
    checker = load_checker()
    raw = ("# Incident timeline\r\n\r\nSubstantive technical finding.  \r\n" * 12).encode()

    normalized = checker.normalize_html(raw, profile="markdown_document")

    assert "\r" not in normalized
    assert "# Incident timeline" in normalized


def test_pdf_profile_fingerprints_the_exact_document_bytes(monkeypatch) -> None:
    checker = load_checker()
    raw = b"%PDF-1.7\n" + b"A" * 400

    class FakeResponse:
        headers = {"ETag": '"pdf-etag"', "Last-Modified": "Fri, 14 Aug 2026 17:41:18 GMT"}

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self, limit: int) -> bytes:
            assert limit > len(raw)
            return raw

        def geturl(self) -> str:
            return "https://cdn.example.test/report.pdf"

    monkeypatch.setattr(checker, "urlopen", lambda _request, timeout: FakeResponse())

    result = checker.fetch("https://example.test/report", timeout=1, profile="pdf_document")

    assert result == {
        "url": "https://cdn.example.test/report.pdf",
        "sha256": "1a3b47f2ba613cd4cad70b5590451453c6e7ec31bcd6c3562e87fcec9d39ba24",
        "normalized_characters": 409,
        "etag": '"pdf-etag"',
        "last_modified": "Fri, 14 Aug 2026 17:41:18 GMT",
    }


def test_pdf_profile_rejects_non_pdf_content(monkeypatch) -> None:
    checker = load_checker()
    raw = b"<html>not a PDF</html>" * 20

    class FakeResponse:
        headers = {"ETag": None, "Last-Modified": None}

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self, _limit: int) -> bytes:
            return raw

        def geturl(self) -> str:
            return "https://example.test/report"

    monkeypatch.setattr(checker, "urlopen", lambda _request, timeout: FakeResponse())

    with pytest.raises(ValueError, match="PDF header"):
        checker.fetch("https://example.test/report", timeout=1, profile="pdf_document")


def test_registered_active_sources_have_known_explicit_profiles() -> None:
    checker = load_checker()
    registry = json.loads(
        (ROOT / "project-docs" / "zentropy-import" / "2026-08-24-source-register.json").read_text(
            encoding="utf-8"
        )
    )

    active = [source for source in registry["sources"] if source["status"] != "pending"]

    assert active
    assert all(source.get("fingerprint_profile") in checker.FINGERPRINT_PROFILES for source in active)


def test_new_active_source_is_unbaselined_and_review_required(tmp_path: Path, monkeypatch) -> None:
    checker = load_checker()
    registry_path = tmp_path / "registry.json"
    state_path = tmp_path / "state.json"
    write_json(
        registry_path,
        registry_payload(
            [
                {
                    "id": "new-source",
                    "url": "https://example.test/article",
                    "status": "available",
                    "fingerprint_profile": "openai_news_article",
                }
            ]
        ),
    )
    write_json(state_path, state_payload([]))
    monkeypatch.setattr(checker, "fetch", lambda url, timeout, profile: fetched(url, "new-sha"))

    report = checker.check(registry_path, state_path, timeout=1)

    assert report["sources"][0]["status"] == "unbaselined"
    assert report["sources"][0]["review_required"] is True
    assert report["sources"][0]["changed"] is False
    assert report["unbaselined_source_ids"] == ["new-source"]
    assert report["review_required_source_ids"] == ["new-source"]


def test_prior_record_without_sha_is_rejected_before_fetch(tmp_path: Path, monkeypatch) -> None:
    checker = load_checker()
    registry_path = tmp_path / "registry.json"
    state_path = tmp_path / "state.json"
    source = {
        "id": "source",
        "url": "https://example.test/article",
        "status": "available",
        "fingerprint_profile": "openai_news_article",
    }
    write_json(registry_path, registry_payload([source]))
    write_json(
        state_path,
        state_payload(
            [
                {
                    "id": "source",
                    "url": "https://example.test/article",
                    "status": "available",
                    "changed": False,
                }
            ]
        ),
    )
    fetch_calls = 0

    def must_not_fetch(url: str, timeout: float, profile: str) -> dict:
        nonlocal fetch_calls
        fetch_calls += 1
        return fetched(url, "new-sha")

    monkeypatch.setattr(checker, "fetch", must_not_fetch)

    with pytest.raises(ValueError, match="state"):
        checker.check(registry_path, state_path, timeout=1)

    assert fetch_calls == 0


def test_fetch_error_is_reported_without_claiming_a_change(tmp_path: Path, monkeypatch) -> None:
    checker = load_checker()
    registry_path = tmp_path / "registry.json"
    state_path = tmp_path / "state.json"
    source = {
        "id": "source",
        "url": "https://example.test/article",
        "status": "available",
        "fingerprint_profile": "openai_news_article",
    }
    write_json(registry_path, registry_payload([source]))
    prior = valid_state_source()
    prior["url"] = source["url"]
    write_json(state_path, state_payload([prior]))

    def fail_fetch(url: str, timeout: float, profile: str) -> dict:
        raise URLError("network unavailable")

    monkeypatch.setattr(checker, "fetch", fail_fetch)

    report = checker.check(registry_path, state_path, timeout=1)

    assert report["sources"][0]["status"] == "fetch_error"
    assert report["sources"][0]["changed"] is False
    assert "network unavailable" in report["sources"][0]["error"]
    assert report["error_source_ids"] == ["source"]


def test_cache_key_includes_fingerprint_profile(tmp_path: Path, monkeypatch) -> None:
    checker = load_checker()
    registry_path = tmp_path / "registry.json"
    shared_url = "https://example.test/shared"
    write_json(
        registry_path,
        registry_payload(
            [
                {
                    "id": "html-source",
                    "url": shared_url,
                    "status": "available",
                    "fingerprint_profile": "openai_news_article",
                },
                {
                    "id": "markdown-source",
                    "url": shared_url,
                    "status": "available",
                    "fingerprint_profile": "markdown_document",
                },
            ]
        ),
    )
    calls: list[tuple[str, str]] = []

    def profile_fetch(url: str, timeout: float, profile: str) -> dict:
        calls.append((url, profile))
        return fetched(url, f"sha-for-{profile}")

    monkeypatch.setattr(checker, "fetch", profile_fetch)

    report = checker.check(registry_path, None, timeout=1)

    assert calls == [
        (shared_url, "openai_news_article"),
        (shared_url, "markdown_document"),
    ]
    assert [item["sha256"] for item in report["sources"]] == [
        "sha-for-openai_news_article",
        "sha-for-markdown_document",
    ]


def test_official_fingerprint_url_is_fetched_but_public_url_is_reported(
    tmp_path: Path, monkeypatch
) -> None:
    checker = load_checker()
    registry_path = tmp_path / "registry.json"
    public_url = "https://example.test/article"
    fingerprint_url = "https://raw.example.test/article.md"
    write_json(
        registry_path,
        registry_payload(
            [
                {
                    "id": "source",
                    "url": public_url,
                    "fingerprint_url": fingerprint_url,
                    "status": "available",
                    "fingerprint_profile": "markdown_document",
                }
            ]
        ),
    )

    def route_fetch(url: str, timeout: float, profile: str) -> dict:
        assert url == fingerprint_url
        return fetched(url, "stable-sha")

    monkeypatch.setattr(checker, "fetch", route_fetch)

    report = checker.check(registry_path, None, timeout=1)

    assert report["sources"][0]["url"] == public_url
    assert report["sources"][0]["fingerprint_url"] == fingerprint_url


def test_reviewed_merge_updates_only_approved_success_and_preserves_prior_records() -> None:
    checker = load_checker()
    prior = {
        "schema_version": 1,
        "observed_at": "2026-08-23T00:00:00Z",
        "sources": [
            {"id": "approved", "status": "available", "sha256": "old-approved", "changed": False},
            {"id": "fetch-error", "status": "available", "sha256": "old-error", "changed": False},
            {"id": "pending", "status": "available", "sha256": "old-pending", "changed": False},
            {"id": "unreviewed", "status": "available", "sha256": "old-unreviewed", "changed": False},
            {"id": "not-in-report", "status": "available", "sha256": "old-retained", "changed": False},
        ],
        "changed_source_ids": [],
        "error_source_ids": [],
    }
    report = {
        "schema_version": 1,
        "observed_at": "2026-08-24T00:00:00Z",
        "sources": [
            {
                "id": "approved",
                "url": "https://example.test/approved",
                "status": "available",
                "sha256": "new-approved",
                "changed": True,
                "review_required": True,
            },
            {
                "id": "fetch-error",
                "url": "https://example.test/error",
                "status": "fetch_error",
                "changed": False,
                "error": "URLError: unavailable",
            },
            {"id": "pending", "url": "https://example.test/pending", "status": "pending", "changed": False},
            {
                "id": "unreviewed",
                "url": "https://example.test/unreviewed",
                "status": "available",
                "sha256": "new-unreviewed",
                "changed": True,
                "review_required": True,
            },
            {
                "id": "new-unreviewed",
                "url": "https://example.test/new",
                "status": "unbaselined",
                "sha256": "new-source-sha",
                "changed": False,
                "review_required": True,
            },
        ],
        "changed_source_ids": ["approved", "unreviewed"],
        "error_source_ids": ["fetch-error"],
        "unbaselined_source_ids": ["new-unreviewed"],
        "review_required_source_ids": ["approved", "unreviewed", "new-unreviewed"],
    }

    merged = checker.merge_reviewed_state(prior, report, ["approved"])
    merged_by_id = {item["id"]: item for item in merged["sources"]}

    assert merged["observed_at"] == report["observed_at"]
    assert merged_by_id["approved"]["sha256"] == "new-approved"
    assert merged_by_id["approved"]["status"] == "available"
    assert merged_by_id["approved"]["changed"] is False
    assert "review_required" not in merged_by_id["approved"]
    assert merged_by_id["fetch-error"]["sha256"] == "old-error"
    assert merged_by_id["pending"]["sha256"] == "old-pending"
    assert merged_by_id["unreviewed"]["sha256"] == "old-unreviewed"
    assert merged_by_id["not-in-report"]["sha256"] == "old-retained"
    assert "new-unreviewed" not in merged_by_id
    assert merged["changed_source_ids"] == []
    assert merged["error_source_ids"] == []


def test_reviewed_merge_baselines_an_approved_new_source() -> None:
    checker = load_checker()
    prior = {"schema_version": 1, "observed_at": "old", "sources": []}
    report = {
        "schema_version": 1,
        "observed_at": "new",
        "sources": [
            {
                "id": "new-source",
                "url": "https://example.test/new",
                "status": "unbaselined",
                "sha256": "reviewed-sha",
                "normalized_characters": 500,
                "changed": False,
                "review_required": True,
            }
        ],
    }

    merged = checker.merge_reviewed_state(prior, report, ["new-source"])

    assert merged["sources"] == [
        {
            "id": "new-source",
            "url": "https://example.test/new",
            "status": "available",
            "sha256": "reviewed-sha",
            "normalized_characters": 500,
            "changed": False,
        }
    ]


@pytest.mark.parametrize("status", ["fetch_error", "pending"])
def test_reviewed_merge_rejects_non_successful_observation(status: str) -> None:
    checker = load_checker()
    prior = {"schema_version": 1, "sources": [{"id": "source", "sha256": "prior"}]}
    report = {"schema_version": 1, "observed_at": "new", "sources": [{"id": "source", "status": status}]}

    with pytest.raises(ValueError, match="approved source does not have a successful fingerprint"):
        checker.merge_reviewed_state(prior, report, ["source"])

    assert prior["sources"][0]["sha256"] == "prior"


def test_cli_accept_reviewed_writes_merged_baseline(tmp_path: Path, monkeypatch, capsys) -> None:
    checker = load_checker()
    registry_path = tmp_path / "registry.json"
    state_path = tmp_path / "state.json"
    report_path = tmp_path / "report.json"
    write_json(registry_path, registry_payload([]))
    write_json(
        state_path,
        state_payload([valid_state_source("retained")]),
    )
    live_report = {
        "schema_version": 1,
        "observed_at": "new",
        "sources": [
            {
                "id": "new-source",
                "url": "https://example.test/new",
                "status": "unbaselined",
                "sha256": "reviewed-sha",
                "changed": False,
                "review_required": True,
            }
        ],
        "changed_source_ids": [],
        "error_source_ids": [],
        "unbaselined_source_ids": ["new-source"],
        "review_required_source_ids": ["new-source"],
    }
    monkeypatch.setattr(checker, "check", lambda registry, state, timeout: live_report)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "check_frontier_safety_sources.py",
            "--registry",
            str(registry_path),
            "--state",
            str(state_path),
            "--report",
            str(report_path),
            "--accept-reviewed",
            "new-source",
        ],
    )

    assert checker.main() == 0
    saved = json.loads(state_path.read_text(encoding="utf-8"))
    summary = json.loads(capsys.readouterr().out)

    assert {item["id"] for item in saved["sources"]} == {"retained", "new-source"}
    assert next(item for item in saved["sources"] if item["id"] == "new-source")["status"] == "available"
    assert json.loads(report_path.read_text(encoding="utf-8")) == live_report
    assert summary["accepted_reviewed"] == ["new-source"]


def test_state_writer_keeps_each_source_on_one_line(tmp_path: Path) -> None:
    checker = load_checker()
    state_path = tmp_path / "state.json"
    payload = {
        "schema_version": 1,
        "observed_at": "now",
        "sources": [
            {"id": "one", "status": "available", "sha256": "sha-one"},
            {"id": "two", "status": "pending", "changed": False},
        ],
        "changed_source_ids": [],
        "error_source_ids": [],
    }

    checker.write_state_json(state_path, payload)
    text = state_path.read_text(encoding="utf-8")

    assert json.loads(text) == payload
    assert len([line for line in text.splitlines() if '"id"' in line]) == 2
    assert all(line.strip().startswith("{") and line.strip().endswith(("},", "}")) for line in text.splitlines() if '"id"' in line)


@pytest.mark.parametrize(
    "payload",
    [
        [],
        {"schema_version": 999, "observed_at": "now", "sources": []},
        {"schema_version": True, "observed_at": "now", "sources": []},
        {"observed_at": "now", "sources": []},
        {"schema_version": 1, "sources": []},
        {"schema_version": 1, "observed_at": 7, "sources": []},
        {"schema_version": 1, "observed_at": "now"},
        {"schema_version": 1, "observed_at": "now", "sources": "not-a-list"},
        registry_payload(["not-an-object"]),
        registry_payload([{"url": "https://example.test/source", "status": "available", "fingerprint_profile": "openai_news_article"}]),
        registry_payload([{"id": 7, "url": "https://example.test/source", "status": "available", "fingerprint_profile": "openai_news_article"}]),
        registry_payload([{"id": "source", "status": "available", "fingerprint_profile": "openai_news_article"}]),
        registry_payload([{"id": "source", "url": 7, "status": "available", "fingerprint_profile": "openai_news_article"}]),
        registry_payload([{"id": "source", "url": "https://example.test/source", "fingerprint_profile": "openai_news_article"}]),
        registry_payload([{"id": "source", "url": "https://example.test/source", "status": 7, "fingerprint_profile": "openai_news_article"}]),
        registry_payload([{**valid_registry_source(), "status": "disabled"}]),
        registry_payload([valid_registry_source("duplicate"), valid_registry_source("duplicate")]),
        registry_payload([{key: value for key, value in valid_registry_source().items() if key != "fingerprint_profile"}]),
        registry_payload([{**valid_registry_source(), "fingerprint_profile": "unknown-profile"}]),
        registry_payload([{**valid_registry_source(), "url": "http://example.test/source"}]),
        registry_payload([{**valid_registry_source(), "url": "https:///missing-host"}]),
        registry_payload([{**valid_registry_source(), "url": "https://example.test/source#fragment"}]),
        registry_payload([{**valid_registry_source(), "fingerprint_url": "http://example.test/raw.md"}]),
        registry_payload([{**valid_registry_source(), "fingerprint_url": 42}]),
    ],
    ids=[
        "root-not-object",
        "wrong-schema",
        "boolean-schema",
        "missing-schema",
        "missing-observed-at",
        "observed-at-wrong-type",
        "missing-sources",
        "sources-not-list",
        "row-not-object",
        "missing-id",
        "id-wrong-type",
        "missing-url",
        "url-wrong-type",
        "missing-status",
        "status-wrong-type",
        "unsupported-status",
        "duplicate-ids",
        "missing-profile",
        "unknown-profile",
        "non-https-url",
        "missing-url-host",
        "url-fragment",
        "non-https-fingerprint-url",
        "fingerprint-url-wrong-type",
    ],
)
def test_invalid_registry_is_rejected_before_fetch(tmp_path: Path, monkeypatch, payload: dict) -> None:
    checker = load_checker()
    registry_path = tmp_path / "registry.json"
    write_json(registry_path, payload)
    fetch_calls = 0

    def must_not_fetch(url: str, timeout: float, profile: str) -> dict:
        nonlocal fetch_calls
        fetch_calls += 1
        return fetched(url, "unexpected")

    monkeypatch.setattr(checker, "fetch", must_not_fetch)

    with pytest.raises(ValueError, match="registry"):
        checker.check(registry_path, None, timeout=1)

    assert fetch_calls == 0


@pytest.mark.parametrize(
    "payload",
    [
        [],
        {**state_payload([]), "schema_version": 999},
        {**state_payload([]), "schema_version": True},
        {key: value for key, value in state_payload([]).items() if key != "schema_version"},
        {key: value for key, value in state_payload([]).items() if key != "observed_at"},
        {**state_payload([]), "observed_at": 7},
        {key: value for key, value in state_payload([]).items() if key != "sources"},
        {**state_payload([]), "sources": "not-a-list"},
        {key: value for key, value in state_payload([]).items() if key != "changed_source_ids"},
        {key: value for key, value in state_payload([]).items() if key != "error_source_ids"},
        state_payload(["not-an-object"]),
        state_payload([valid_state_source("duplicate"), valid_state_source("duplicate")]),
        state_payload([{key: value for key, value in valid_state_source().items() if key != "id"}]),
        state_payload([{**valid_state_source(), "id": 7}]),
        state_payload([{key: value for key, value in valid_state_source().items() if key != "url"}]),
        state_payload([{**valid_state_source(), "url": 7}]),
        state_payload([{key: value for key, value in valid_state_source().items() if key != "status"}]),
        state_payload([{**valid_state_source(), "status": 7}]),
        state_payload([{**valid_state_source(), "status": "disabled"}]),
        state_payload([{**valid_state_source(), "url": "http://example.test/source"}]),
        state_payload([{key: value for key, value in valid_state_source().items() if key != "changed"}]),
        state_payload([{**valid_state_source(), "changed": "false"}]),
        state_payload([{key: value for key, value in valid_state_source().items() if key != "sha256"}]),
        state_payload([{**valid_state_source(), "sha256": "not-a-sha"}]),
        state_payload([{key: value for key, value in valid_state_source().items() if key != "normalized_characters"}]),
        state_payload([{**valid_state_source(), "normalized_characters": "500"}]),
        state_payload([{key: value for key, value in valid_state_source().items() if key != "etag"}]),
        state_payload([{**valid_state_source(), "etag": 7}]),
        state_payload([{key: value for key, value in valid_state_source().items() if key != "last_modified"}]),
        state_payload([{**valid_state_source(), "last_modified": 7}]),
        state_payload([{**valid_state_source(), "fingerprint_url": "http://example.test/raw.md"}]),
        {**state_payload([]), "changed_source_ids": "source"},
        {**state_payload([]), "error_source_ids": [7]},
    ],
    ids=[
        "root-not-object",
        "wrong-schema",
        "boolean-schema",
        "missing-schema",
        "missing-observed-at",
        "observed-at-wrong-type",
        "missing-sources",
        "sources-not-list",
        "missing-changed-ids",
        "missing-error-ids",
        "row-not-object",
        "duplicate-ids",
        "missing-id",
        "id-wrong-type",
        "missing-url",
        "url-wrong-type",
        "missing-status",
        "status-wrong-type",
        "unsupported-status",
        "non-https-url",
        "missing-changed",
        "changed-wrong-type",
        "missing-sha",
        "malformed-sha",
        "missing-characters",
        "characters-wrong-type",
        "missing-etag",
        "etag-wrong-type",
        "missing-last-modified",
        "last-modified-wrong-type",
        "non-https-fingerprint-url",
        "changed-ids-wrong-type",
        "error-ids-item-wrong-type",
    ],
)
def test_invalid_state_is_rejected_before_fetch(tmp_path: Path, monkeypatch, payload: dict) -> None:
    checker = load_checker()
    registry_path = tmp_path / "registry.json"
    state_path = tmp_path / "state.json"
    write_json(registry_path, registry_payload([valid_registry_source()]))
    write_json(state_path, payload)
    fetch_calls = 0

    def must_not_fetch(url: str, timeout: float, profile: str) -> dict:
        nonlocal fetch_calls
        fetch_calls += 1
        return fetched(url, "unexpected")

    monkeypatch.setattr(checker, "fetch", must_not_fetch)

    with pytest.raises(ValueError, match="state"):
        checker.check(registry_path, state_path, timeout=1)

    assert fetch_calls == 0
