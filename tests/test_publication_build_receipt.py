"""The publication receipt must describe the current generated output bytes."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
TEXT_OUTPUT_SUFFIXES = {".html", ".json", ".svg", ".xml"}


def _assert_output_hashes(root: Path, outputs: dict[str, str]) -> None:
    assert outputs, "publication build receipt declares no outputs"
    problems = []
    for relative, expected in outputs.items():
        path = root / relative
        assert path.suffix in TEXT_OUTPUT_SUFFIXES, (
            f"Review receipt byte normalization for new output type: {relative}"
        )
        if not path.is_file():
            problems.append(f"{relative}: missing declared output")
            continue
        # build_publications._text_bytes normalizes CRLF, not arbitrary
        # whitespace or lone CR. Its JSON emitter also writes LF text.
        payload = path.read_bytes().replace(b"\r\n", b"\n")
        actual = hashlib.sha256(payload).hexdigest()
        if actual != expected:
            problems.append(f"{relative}: expected {expected}, found {actual}")
    assert not problems, "publication build receipt output drift:\n" + "\n".join(problems)


def test_publication_build_receipt_matches_declared_outputs() -> None:
    receipt = json.loads((ROOT / "publications/build.json").read_text(encoding="utf-8"))
    assert receipt["schema_version"] == 1
    assert isinstance(receipt["outputs"], dict)
    _assert_output_hashes(ROOT, receipt["outputs"])


@pytest.mark.parametrize("newline", [b"\n", b"\r\n"])
def test_receipt_accepts_equivalent_checkout_line_endings(tmp_path: Path, newline: bytes) -> None:
    canonical = b"first\nsecond\rwithin-line\n"
    (tmp_path / "page.html").write_bytes(canonical.replace(b"\n", newline))
    _assert_output_hashes(tmp_path, {"page.html": hashlib.sha256(canonical).hexdigest()})


def test_receipt_rejects_tampered_output(tmp_path: Path) -> None:
    original = b"<p>Reviewed claim.</p>\n"
    (tmp_path / "page.html").write_bytes(b"<p>Different claim.</p>\r\n")
    with pytest.raises(AssertionError, match=r"page\.html: expected"):
        _assert_output_hashes(tmp_path, {"page.html": hashlib.sha256(original).hexdigest()})


def test_receipt_rejects_missing_declared_output(tmp_path: Path) -> None:
    with pytest.raises(AssertionError, match=r"page\.html: missing declared output"):
        _assert_output_hashes(tmp_path, {"page.html": hashlib.sha256(b"missing\n").hexdigest()})
