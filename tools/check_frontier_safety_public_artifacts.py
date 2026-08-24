#!/usr/bin/env python3
"""Reject credential-shaped content in Frontier Safety public artifacts."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Finding:
    path: Path
    line: int
    label: str


TOKEN_RULES = (
    (
        "private key",
        re.compile(r"-----BEGIN (?:[A-Z0-9][A-Z0-9 ]* )?PRIVATE KEY-----"),
    ),
    (
        "GitHub token",
        re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b"),
    ),
    ("OpenAI key", re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b")),
    ("AWS access key", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("Slack token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b")),
    ("Hugging Face token", re.compile(r"\bhf_[A-Za-z0-9]{20,}\b")),
    ("Stripe live key", re.compile(r"\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b")),
)
CREDENTIAL_ASSIGNMENT = re.compile(
    r"(?i)[\"']?(?:api[_-]?key|access[_-]?token|auth[_-]?token|bearer[_-]?token|"
    r"client[_-]?secret|password|passwd|secret[_-]?key)[\"']?\s*[:=]\s*(?P<value>.+)$"
)
PLACEHOLDER = re.compile(
    r"(?i)^[\[<{(]?(?:redacted|removed|unset|none|null|n/?a|unavailable|unknown|"
    r"placeholder|example|fake|not[-_ ]?set|not[-_ ]?provided)[\]}>)]?$"
)


def _line_number(content: str, offset: int) -> int:
    return content.count("\n", 0, offset) + 1


def _is_placeholder(raw_value: str) -> bool:
    value = raw_value.strip().rstrip(",;").strip().strip("\"'").strip()
    return (
        not value
        or bool(PLACEHOLDER.fullmatch(value))
        or value.startswith(("${", "$env:", "%"))
    )


def scan_text(path: Path, content: str) -> list[Finding]:
    findings = []
    for label, pattern in TOKEN_RULES:
        findings.extend(
            Finding(path=path, line=_line_number(content, match.start()), label=label)
            for match in pattern.finditer(content)
        )
    for line_number, line in enumerate(content.splitlines(), start=1):
        assignment = CREDENTIAL_ASSIGNMENT.search(line)
        if assignment and not _is_placeholder(assignment.group("value")):
            findings.append(Finding(path=path, line=line_number, label="credential assignment"))
    return findings


def _iter_files(paths: list[Path]) -> list[Path]:
    files: set[Path] = set()
    for path in paths:
        if path.is_dir():
            files.update(candidate for candidate in path.rglob("*") if candidate.is_file())
        elif path.is_file():
            files.add(path)
        else:
            raise FileNotFoundError(path)
    return sorted(files, key=lambda item: item.as_posix())


def scan_paths(paths: list[Path]) -> list[Finding]:
    findings = []
    for path in _iter_files(paths):
        content = path.read_text(encoding="utf-8")
        findings.extend(scan_text(path, content))
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=Path, help="UTF-8 files or directories to scan")
    args = parser.parse_args()
    try:
        findings = scan_paths(args.paths)
    except (FileNotFoundError, OSError, UnicodeError) as exc:
        print(f"public-artifact scan error: {type(exc).__name__}", file=sys.stderr)
        return 2
    if findings:
        for finding in findings:
            print(f"{finding.path}:{finding.line}: credential pattern: {finding.label}")
        print(f"credential scan failed: {len(findings)} finding(s)")
        return 1
    print(f"No credential-shaped content found in {len(_iter_files(args.paths))} file(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
