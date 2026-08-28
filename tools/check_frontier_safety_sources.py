#!/usr/bin/env python3
"""Fetch curated Frontier Safety sources and compare normalized fingerprints."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


USER_AGENT = "ZentropyLabs-Frontier-Safety-Briefing/1.0 (+https://harperz9.github.io/frontier-safety.html)"
MAX_BYTES = 3_000_000
MAX_PDF_BYTES = 10_000_000
MIN_NORMALIZED_CHARACTERS = 200
VOID_ELEMENTS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}
HTML_FINGERPRINT_PROFILES = {
    "aisi_report_article",
    "anthropic_news_article",
    "huggingface_blog_article",
    "metr_blog_article",
    "nvd_vulnerability_detail",
    "openai_news_article",
    "sysdig_blog_article",
}
FINGERPRINT_PROFILES = HTML_FINGERPRINT_PROFILES | {"markdown_document", "pdf_document"}
SCHEMA_VERSION = 1
REGISTRY_STATUSES = {"available", "context-only", "pending"}
STATE_STATUSES = {"available", "pending"}
SHA256_PATTERN = re.compile(r"[0-9a-f]{64}")


def _require_nonempty_string(container: dict, key: str, context: str) -> str:
    value = container.get(key)
    if type(value) is not str or not value.strip():
        raise ValueError(f"{context}.{key} must be a non-empty string")
    return value


def _validate_https_url(value: object, context: str) -> None:
    if type(value) is not str or not value or any(character.isspace() for character in value):
        raise ValueError(f"{context} must be an absolute HTTPS URL")
    try:
        parsed = urlsplit(value)
        hostname = parsed.hostname
        parsed.port
    except ValueError as exc:
        raise ValueError(f"{context} must be an absolute HTTPS URL: {exc}") from exc
    if (
        parsed.scheme != "https"
        or not hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.fragment
    ):
        raise ValueError(f"{context} must be an absolute HTTPS URL without credentials or fragments")


def _validate_document_root(payload: object, label: str) -> tuple[dict, list]:
    if type(payload) is not dict:
        raise ValueError(f"{label} root must be an object")
    if type(payload.get("schema_version")) is not int or payload["schema_version"] != SCHEMA_VERSION:
        raise ValueError(f"{label}.schema_version must equal {SCHEMA_VERSION}")
    _require_nonempty_string(payload, "observed_at", label)
    sources = payload.get("sources")
    if type(sources) is not list:
        raise ValueError(f"{label}.sources must be a list")
    return payload, sources


def validate_registry(payload: object) -> dict:
    registry, sources = _validate_document_root(payload, "registry")
    seen_ids = set()
    for index, source in enumerate(sources):
        context = f"registry.sources[{index}]"
        if type(source) is not dict:
            raise ValueError(f"{context} must be an object")
        source_id = _require_nonempty_string(source, "id", context)
        if source_id in seen_ids:
            raise ValueError(f"registry contains duplicate source id: {source_id}")
        seen_ids.add(source_id)
        _validate_https_url(source.get("url"), f"{context}.url")
        status = source.get("status")
        if type(status) is not str or status not in REGISTRY_STATUSES:
            raise ValueError(f"{context}.status must be one of {sorted(REGISTRY_STATUSES)}")
        profile = source.get("fingerprint_profile")
        if status != "pending" and (type(profile) is not str or profile not in FINGERPRINT_PROFILES):
            raise ValueError(f"{context}.fingerprint_profile must name a known profile")
        if profile is not None and (type(profile) is not str or profile not in FINGERPRINT_PROFILES):
            raise ValueError(f"{context}.fingerprint_profile must name a known profile")
        if "fingerprint_url" in source:
            _validate_https_url(source["fingerprint_url"], f"{context}.fingerprint_url")
    return registry


def _validate_string_list(container: dict, key: str, context: str) -> None:
    value = container.get(key)
    if type(value) is not list or any(type(item) is not str for item in value):
        raise ValueError(f"{context}.{key} must be a list of strings")


def validate_state(payload: object) -> dict:
    state, sources = _validate_document_root(payload, "state")
    _validate_string_list(state, "changed_source_ids", "state")
    _validate_string_list(state, "error_source_ids", "state")
    seen_ids = set()
    for index, source in enumerate(sources):
        context = f"state.sources[{index}]"
        if type(source) is not dict:
            raise ValueError(f"{context} must be an object")
        source_id = _require_nonempty_string(source, "id", context)
        if source_id in seen_ids:
            raise ValueError(f"state contains duplicate source id: {source_id}")
        seen_ids.add(source_id)
        _validate_https_url(source.get("url"), f"{context}.url")
        status = source.get("status")
        if type(status) is not str or status not in STATE_STATUSES:
            raise ValueError(f"{context}.status must be one of {sorted(STATE_STATUSES)}")
        if type(source.get("changed")) is not bool:
            raise ValueError(f"{context}.changed must be a boolean")
        if "fingerprint_url" in source:
            _validate_https_url(source["fingerprint_url"], f"{context}.fingerprint_url")
        if status == "available":
            sha256 = source.get("sha256")
            if type(sha256) is not str or SHA256_PATTERN.fullmatch(sha256) is None:
                raise ValueError(f"{context}.sha256 must be a lowercase hexadecimal SHA-256")
            characters = source.get("normalized_characters")
            if type(characters) is not int or characters < MIN_NORMALIZED_CHARACTERS:
                raise ValueError(
                    f"{context}.normalized_characters must be an integer of at least "
                    f"{MIN_NORMALIZED_CHARACTERS}"
                )
            for header_name in ("etag", "last_modified"):
                if header_name not in source or source[header_name] is not None and type(source[header_name]) is not str:
                    raise ValueError(f"{context}.{header_name} must be a string or null")
    return state


def _read_json_document(path: Path, label: str) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"{label} is not valid JSON: {exc}") from exc


def _class_tokens(attributes: dict[str, str]) -> set[str]:
    return set(attributes.get("class", "").split())


def _matches_target(profile: str, tag: str, attributes: dict[str, str]) -> bool:
    classes = _class_tokens(attributes)
    if profile == "aisi_report_article":
        return tag == "div" and attributes.get("data-content") == "main" and "rtf-cms" in classes
    if profile == "anthropic_news_article":
        return tag == "div" and any(
            token.startswith("Body-module-scss-module__") and token.endswith("__body") for token in classes
        )
    if profile == "openai_news_article":
        return tag == "article"
    if profile == "huggingface_blog_article":
        return tag == "div" and "blog-content" in classes
    if profile == "metr_blog_article":
        return tag == "div" and {"content", "post-content"}.issubset(classes)
    if profile == "nvd_vulnerability_detail":
        return tag == "div" and attributes.get("id") == "vulnDetailPanel"
    if profile == "sysdig_blog_article":
        return (
            tag == "div"
            and attributes.get("fs-toc-element") == "contents"
            and "rich-text" in classes
        )
    return False


def _starts_skipped_subtree(profile: str, tag: str, attributes: dict[str, str]) -> bool:
    if tag in {"script", "style", "template", "noscript", "svg"}:
        return True
    classes = _class_tokens(attributes)
    return profile == "huggingface_blog_article" and bool(
        classes.intersection({"not-prose", "overview-card-wrapper"})
    )


class _SubstantiveHTMLParser(HTMLParser):
    """Collect one balanced, profile-specific substantive container."""

    def __init__(self, profile: str) -> None:
        super().__init__(convert_charrefs=True)
        self.profile = profile
        self.target_stack: list[str] = []
        self.skip_start_depth: int | None = None
        self.targets_started = 0
        self.targets_completed = 0
        self.structure_error: str | None = None
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {name: value or "" for name, value in attrs}
        if not self.target_stack:
            if _matches_target(self.profile, tag, attributes):
                self.targets_started += 1
                if tag in VOID_ELEMENTS:
                    self.structure_error = "target container cannot be a void element"
                    return
                self.target_stack.append(tag)
            return

        if tag not in VOID_ELEMENTS:
            self.target_stack.append(tag)
        if self.skip_start_depth is None and _starts_skipped_subtree(self.profile, tag, attributes):
            self.skip_start_depth = len(self.target_stack)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {name: value or "" for name, value in attrs}
        if not self.target_stack and _matches_target(self.profile, tag, attributes):
            self.targets_started += 1
            self.structure_error = "target container cannot be self-closing"

    def handle_endtag(self, tag: str) -> None:
        if not self.target_stack or self.structure_error:
            return
        expected = self.target_stack[-1]
        if tag != expected:
            self.structure_error = f"unbalanced target container: expected </{expected}>, got </{tag}>"
            return
        self.target_stack.pop()
        if self.skip_start_depth is not None and len(self.target_stack) < self.skip_start_depth:
            self.skip_start_depth = None
        if not self.target_stack:
            self.targets_completed += 1

    def handle_data(self, data: str) -> None:
        if self.target_stack and self.skip_start_depth is None:
            self.parts.append(data)


def normalize_html(raw: bytes, profile: str | None = None) -> str:
    text = raw.decode("utf-8", errors="replace")
    if profile not in FINGERPRINT_PROFILES:
        raise ValueError(f"unknown fingerprint profile: {profile!r}")
    if profile == "markdown_document":
        normalized = "\n".join(line.rstrip() for line in text.splitlines()).strip()
    else:
        parser = _SubstantiveHTMLParser(profile)
        parser.feed(text)
        parser.close()
        if parser.structure_error:
            raise ValueError(parser.structure_error)
        if parser.skip_start_depth is not None:
            raise ValueError("unclosed skipped container")
        if parser.target_stack:
            raise ValueError("unclosed target container")
        if parser.targets_started == 0:
            raise ValueError(f"{profile} container not found")
        if parser.targets_started != 1 or parser.targets_completed != 1:
            raise ValueError(
                f"expected exactly one completed target for {profile}; "
                f"started={parser.targets_started}, completed={parser.targets_completed}"
            )
        normalized = re.sub(r"\s+", " ", " ".join(parser.parts)).strip()
    if len(normalized) < MIN_NORMALIZED_CHARACTERS:
        raise ValueError(
            f"normalized fingerprint did not meet minimum content contract "
            f"({len(normalized)} < {MIN_NORMALIZED_CHARACTERS} characters)"
        )
    return normalized


def fetch(url: str, timeout: float, profile: str | None = None) -> dict:
    is_pdf = profile == "pdf_document"
    accept = "application/pdf" if is_pdf else "text/html,application/xhtml+xml"
    max_bytes = MAX_PDF_BYTES if is_pdf else MAX_BYTES
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
    with urlopen(request, timeout=timeout) as response:
        raw = response.read(max_bytes + 1)
        if len(raw) > max_bytes:
            raise ValueError(f"response exceeded {max_bytes} bytes")
        if is_pdf:
            if not raw.startswith(b"%PDF-"):
                raise ValueError("pdf_document response missing PDF header")
            if len(raw) < MIN_NORMALIZED_CHARACTERS:
                raise ValueError(
                    "PDF fingerprint did not meet minimum content contract "
                    f"({len(raw)} < {MIN_NORMALIZED_CHARACTERS} bytes)"
                )
            return {
                "url": response.geturl(),
                "sha256": hashlib.sha256(raw).hexdigest(),
                "normalized_characters": len(raw),
                "etag": response.headers.get("ETag"),
                "last_modified": response.headers.get("Last-Modified"),
            }
        normalized = normalize_html(raw, profile=profile)
        return {
            "url": response.geturl(),
            "sha256": hashlib.sha256(normalized.encode("utf-8")).hexdigest(),
            "normalized_characters": len(normalized),
            "etag": response.headers.get("ETag"),
            "last_modified": response.headers.get("Last-Modified"),
        }


def check(registry_path: Path, state_path: Path | None, timeout: float) -> dict:
    registry = validate_registry(_read_json_document(registry_path, "registry"))
    if state_path and state_path.exists():
        state = validate_state(_read_json_document(state_path, "state"))
        prior = {item["id"]: item for item in state["sources"]}
    else:
        prior = {}
    observed_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    results = []
    cache: dict[tuple[str, str | None], dict] = {}
    for source in registry["sources"]:
        if source["status"] == "pending":
            results.append({"id": source["id"], "url": source["url"], "status": "pending", "changed": False})
            continue
        try:
            profile = source.get("fingerprint_profile")
            fingerprint_url = source.get("fingerprint_url", source["url"])
            cache_key = (fingerprint_url, profile)
            fetched = cache.get(cache_key)
            if fetched is None:
                fetched = fetch(fingerprint_url, timeout, profile=profile)
                cache[cache_key] = fetched
            fetched = dict(fetched)
            fetched["url"] = source["url"]
            if "fingerprint_url" in source:
                fetched["fingerprint_url"] = source["fingerprint_url"]
            previous = prior.get(source["id"], {})
            unbaselined = not previous.get("sha256")
            changed = bool(not unbaselined and previous["sha256"] != fetched["sha256"])
            results.append({
                "id": source["id"],
                "status": "unbaselined" if unbaselined else "available",
                "changed": changed,
                "review_required": unbaselined or changed,
                **fetched,
            })
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            results.append({
                "id": source["id"],
                "url": source["url"],
                "status": "fetch_error",
                "changed": False,
                "error": f"{type(exc).__name__}: {exc}",
            })
    return {
        "schema_version": 1,
        "observed_at": observed_at,
        "sources": results,
        "changed_source_ids": [item["id"] for item in results if item.get("changed")],
        "error_source_ids": [item["id"] for item in results if item["status"] == "fetch_error"],
        "unbaselined_source_ids": [item["id"] for item in results if item["status"] == "unbaselined"],
        "review_required_source_ids": [item["id"] for item in results if item.get("review_required")],
    }


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def write_state_json(path: Path, payload: dict) -> None:
    """Write readable baseline metadata with compact per-source records."""

    path.parent.mkdir(parents=True, exist_ok=True)
    lines = ["{"]
    entries = list(payload.items())
    for entry_index, (key, value) in enumerate(entries):
        suffix = "," if entry_index < len(entries) - 1 else ""
        encoded_key = json.dumps(key, ensure_ascii=False)
        if key != "sources":
            lines.append(f"  {encoded_key}: {json.dumps(value, ensure_ascii=False)}{suffix}")
            continue
        lines.append(f"  {encoded_key}: [")
        for source_index, source in enumerate(value):
            source_suffix = "," if source_index < len(value) - 1 else ""
            encoded_source = json.dumps(source, ensure_ascii=False, separators=(",", ":"))
            lines.append(f"    {encoded_source}{source_suffix}")
        lines.append(f"  ]{suffix}")
    lines.append("}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def merge_reviewed_state(prior_state: dict, report: dict, approved_source_ids: list[str]) -> dict:
    """Merge approved successful observations without discarding prior baselines."""

    approved = set(approved_source_ids)
    report_by_id = {item["id"]: item for item in report.get("sources", [])}
    for source_id in approved:
        observed = report_by_id.get(source_id)
        if not observed:
            raise ValueError(f"approved source is absent from report: {source_id}")
        if observed.get("status") not in {"available", "unbaselined"} or not observed.get("sha256"):
            raise ValueError(f"approved source does not have a successful fingerprint: {source_id}")

    def accepted_baseline(source_id: str) -> dict:
        baseline = copy.deepcopy(report_by_id[source_id])
        baseline["status"] = "available"
        baseline["changed"] = False
        baseline.pop("review_required", None)
        baseline.pop("error", None)
        return baseline

    merged = copy.deepcopy(prior_state)
    merged_sources = []
    seen = set()
    for prior in prior_state.get("sources", []):
        source_id = prior["id"]
        merged_sources.append(accepted_baseline(source_id) if source_id in approved else copy.deepcopy(prior))
        seen.add(source_id)
    for observed in report.get("sources", []):
        source_id = observed["id"]
        if source_id in approved and source_id not in seen:
            merged_sources.append(accepted_baseline(source_id))
            seen.add(source_id)

    merged["schema_version"] = prior_state.get("schema_version", report.get("schema_version", 1))
    merged["observed_at"] = report["observed_at"]
    merged["sources"] = merged_sources
    merged["changed_source_ids"] = []
    merged["error_source_ids"] = []
    merged.pop("unbaselined_source_ids", None)
    merged.pop("review_required_source_ids", None)
    return merged


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--state", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument(
        "--accept-reviewed",
        action="append",
        default=[],
        metavar="SOURCE_ID",
        help="accept one successful reviewed fingerprint into --state; repeat for multiple sources",
    )
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--fail-on-error", action="store_true")
    args = parser.parse_args()
    report = check(args.registry, args.state, args.timeout)
    write_json(args.report, report)
    if args.accept_reviewed:
        if not args.state:
            parser.error("--accept-reviewed requires --state")
        prior_state = (
            json.loads(args.state.read_text(encoding="utf-8"))
            if args.state.exists()
            else {"schema_version": 1, "sources": []}
        )
        try:
            merged_state = merge_reviewed_state(prior_state, report, args.accept_reviewed)
        except ValueError as exc:
            parser.error(str(exc))
        write_state_json(args.state, merged_state)
    print(json.dumps({
        "accepted_reviewed": args.accept_reviewed,
        "changed": len(report["changed_source_ids"]),
        "errors": len(report["error_source_ids"]),
        "review_required": len(report["review_required_source_ids"]),
        "unbaselined": len(report["unbaselined_source_ids"]),
        "report": str(args.report),
    }, sort_keys=True))
    return 2 if args.fail_on_error and report["error_source_ids"] else 0


if __name__ == "__main__":
    sys.exit(main())
