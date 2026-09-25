"""The receipt contract's doc names every test file that checks its rules.

docs/frontier-safety-operations.md says the test files it lists "check each rule" and that
deleting any guard turns a test red. A review mutation pass deleted ten guards one at a time.
Nine of them stayed green across the listed files and went red only in
test_frontier_safety_receipt_shapes.py or test_frontier_safety_workflow_security.py, which the
list left out. A reader who trusted the list would run too few files.

The proxy here is textual: a frontier-safety test file that mentions receipts belongs to the
contract. It does not prove that each listed file catches a guard deletion. The mutation pass is
the evidence for that.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / "docs" / "frontier-safety-operations.md"


def listed_test_files() -> set[str]:
    text = DOC.read_text(encoding="utf-8")
    section = text.split("## First-observation receipts", 1)[1].split("\n## ", 1)[0]
    sentence = re.search(r"Tests in (.+?) check each rule\.", section, re.DOTALL)
    assert sentence, "the receipt section no longer states which tests check each rule"
    return set(re.findall(r"`(tests/test_frontier_safety_\w+\.py)`", sentence.group(1)))


def receipt_test_files() -> set[str]:
    return {
        f"tests/{path.name}"
        for path in (ROOT / "tests").glob("test_frontier_safety_*.py")
        if path.name != Path(__file__).name
        and "receipt" in path.read_text(encoding="utf-8").lower()
    }


def test_receipt_doc_lists_every_test_file_that_checks_receipts() -> None:
    missing = sorted(receipt_test_files() - listed_test_files())
    assert not missing, f"docs/frontier-safety-operations.md omits {missing}"


def test_receipt_doc_lists_only_test_files_that_exist() -> None:
    stale = sorted(name for name in listed_test_files() if not (ROOT / name).is_file())
    assert not stale, f"docs/frontier-safety-operations.md names missing files {stale}"
