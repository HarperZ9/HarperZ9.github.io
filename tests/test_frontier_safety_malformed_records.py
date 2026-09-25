"""Record files whose JSON root is not an object are rejected by name, not with a traceback.

The review wrote `[]` to a receipt file in a receipted 2026-09-24 edition. `validate` printed a
traceback ending in AttributeError at `receipt.get`, because the CLI turns only ValueError into a
rejection line, and the traceback never named the file. An edition file, the checker packet and
history.json failed the same way. Every such file must hold a JSON object.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from test_frontier_safety_receipts import receipts
from test_frontier_safety_record_lifecycle import (  # noqa: F401  (record is a fixture)
    ROOT, coverage, publish_receipted, record, run_tool, write,
)

RECEIPTS = receipts.RECEIPTS_DIR / "2026-09-24"
MALFORMED_FILES = {
    "receipt": RECEIPTS / "bogus.json",
    "packet": RECEIPTS / receipts.PACKET_NAME,
    "edition": coverage.EDITIONS_DIR / "2026-09-24.json",
    "history": coverage.HISTORY_PATH,
}


@pytest.mark.parametrize("root", [[], "x", 42, None], ids=["list", "string", "number", "null"])
@pytest.mark.parametrize("kind", sorted(MALFORMED_FILES))
def test_a_record_file_whose_json_root_is_not_an_object_is_rejected_by_name(
    record: Path, kind: str, root: object
) -> None:
    publish_receipted(record)
    write(record / MALFORMED_FILES[kind], root)
    with pytest.raises(receipts.ReceiptError, match="must hold a JSON object") as rejected:
        coverage.validate_repository(record)
    assert MALFORMED_FILES[kind].as_posix() in str(rejected.value)


def test_validate_cli_rejects_a_non_object_receipt_in_one_line(record: Path) -> None:
    publish_receipted(record)
    write(record / MALFORMED_FILES["receipt"], [])
    result = run_tool(str(ROOT / "tools" / "frontier_safety_receipts.py"), "validate", "--root", str(record))
    assert result.returncode == 1
    assert result.stderr.startswith("First-observation contract rejected:")
    assert "bogus.json must hold a JSON object" in result.stderr
    assert "Traceback" not in result.stderr
