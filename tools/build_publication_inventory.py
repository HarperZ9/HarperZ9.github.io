"""Build a private, metadata-only inventory of publication automation artifacts."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


def _is_within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
    except ValueError:
        return False
    return True


def assert_private_output(output_path: Path, public_roots: list[Path]) -> None:
    """Reject an inventory destination inside any public repository."""

    output = output_path.resolve(strict=False)
    for root in public_roots:
        if _is_within(output, root.resolve(strict=False)):
            raise ValueError("inventory output must remain outside public repositories")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _classification(relative_path: str) -> tuple[str, str, str, str]:
    lower = relative_path.casefold()
    name = Path(relative_path).name.casefold()

    if name in {"automation.toml", "memory.md"}:
        return (
            "private-control",
            "control-state",
            "hold",
            "automation controls are never publication inputs",
        )
    if "receipt" in lower or "map" in lower or lower.endswith(".diff"):
        return (
            "private-evidence",
            "evidence-only",
            "hold",
            "use as verification evidence, not public copy",
        )
    if "packet-" in name:
        return (
            "candidate",
            "packet-candidate",
            "review-required",
            "requires public-record validation and claim review",
        )
    if "source-check" in lower or "research" in lower:
        return (
            "review-required",
            "research-input",
            "review-required",
            "source notes require destination-specific editorial review",
        )
    if any(part.startswith(("regen-", "regen-caption-", "mirror")) for part in Path(relative_path).parts):
        return (
            "duplicate-reference",
            "generated-mirror",
            "hold",
            "generated mirror must not become a second canonical publication",
        )
    return (
        "private-hold",
        "unclassified",
        "hold",
        "unknown artifacts remain private until explicitly classified",
    )


def inventory_file(path: Path, root: Path, automation_id: str) -> dict[str, object]:
    """Return metadata for one artifact without copying its content or absolute path."""

    resolved_root = root.resolve(strict=True)
    resolved_path = path.resolve(strict=True)
    if not resolved_path.is_file() or not _is_within(resolved_path, resolved_root):
        raise ValueError("inventory input must be a file inside its automation root")

    relative_path = resolved_path.relative_to(resolved_root).as_posix()
    stat = resolved_path.stat()
    classification, editorial_state, public_readiness, hold_reason = _classification(
        relative_path
    )
    timestamp = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(
        timespec="microseconds"
    ).replace("+00:00", "Z")
    return {
        "automation_id": automation_id,
        "relative_path": relative_path,
        "sha256": _sha256(resolved_path),
        "bytes": stat.st_size,
        "last_write_time": timestamp,
        "suffix": resolved_path.suffix.casefold(),
        "classification": classification,
        "editorial_state": editorial_state,
        "public_readiness": public_readiness,
        "hold_reason": hold_reason,
    }


def _files(root: Path) -> Iterable[Path]:
    return sorted(
        (path for path in root.rglob("*") if path.is_file()),
        key=lambda path: path.relative_to(root).as_posix(),
    )


def _json_bytes(payload: dict[str, object]) -> bytes:
    return (json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode(
        "utf-8"
    )


def build_inventory(
    roots: dict[str, Path], output_path: Path, public_roots: list[Path]
) -> dict[str, object]:
    """Inventory every file in each root and atomically write a private ledger."""

    assert_private_output(output_path, public_roots)
    artifacts: list[dict[str, object]] = []
    for automation_id, root in sorted(roots.items()):
        resolved = root.resolve(strict=True)
        if not resolved.is_dir():
            raise ValueError(f"automation root is not a directory: {automation_id}")
        artifacts.extend(
            inventory_file(path, resolved, automation_id) for path in _files(resolved)
        )

    inventory: dict[str, object] = {
        "schema_version": 1,
        "summary": {
            "automation_count": len(roots),
            "file_count": len(artifacts),
            "total_bytes": sum(int(item["bytes"]) for item in artifacts),
        },
        "artifacts": artifacts,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = output_path.with_name(f".{output_path.name}.{os.getpid()}.tmp")
    temporary.write_bytes(_json_bytes(inventory))
    temporary.replace(output_path)
    return inventory


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", action="append", nargs=2, metavar=("ID", "PATH"), required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--public-root", action="append", type=Path, default=[])
    args = parser.parse_args()
    roots = {automation_id: Path(path) for automation_id, path in args.root}
    inventory = build_inventory(roots, args.output, args.public_root)
    print(
        f"Inventoried {inventory['summary']['file_count']} files across "
        f"{inventory['summary']['automation_count']} automations."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
