"""Public-artifact security and reproducibility contracts."""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SCANNER = ROOT / "tools" / "check_frontier_safety_public_artifacts.py"


def run_scanner(*paths: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCANNER), *(str(path) for path in paths)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


@pytest.mark.parametrize(
    ("label", "secret"),
    [
        ("private key", "-----BEGIN " + "PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----"),
        ("GitHub token", "gh" + "p_1234567890abcdefghijklmnopqrstuvwxyz"),
        ("OpenAI key", "sk" + "-proj-abcdefghijklmnopqrstuvwxyz1234567890"),
        ("AWS access key", "AK" + "IA1234567890ABCDEF"),
        ("Google API key", "AIza" + "A" * 35),
        ("Slack token", "xox" + "b-123456789012-123456789012-abcdefghijklmnopqrstuvwx"),
        ("Hugging Face token", "hf" + "_abcdefghijklmnopqrstuvwxyz123456"),
        ("Stripe live key", "sk_" + "live_abcdefghijklmnopqrstuvwxyz"),
        ("credential assignment", 'client_secret = "correct-horse-battery-staple"'),
    ],
)
def test_scanner_rejects_secret_shaped_content_without_echoing_it(
    tmp_path: Path, label: str, secret: str
) -> None:
    artifact = tmp_path / "public.txt"
    artifact.write_text(f"Reviewed public copy\n{secret}\n", encoding="utf-8")

    result = run_scanner(artifact)

    assert result.returncode == 1, (label, result.stdout, result.stderr)
    assert label.casefold().split()[0] in result.stdout.casefold()
    assert secret not in result.stdout
    assert secret not in result.stderr


def test_scanner_accepts_documentation_placeholders_and_public_hashes(tmp_path: Path) -> None:
    artifact = tmp_path / "safe.json"
    artifact.write_text(
        """{
  "edition_sha256": "c8ca79052d804290c7143e014fbdba03a89263d3babbc5e248f73d0359054fa4",
  "api_key": "[REDACTED]",
  "access_token": null,
  "client_secret": "${CLIENT_SECRET}",
  "note": "API keys and access tokens must never appear in public artifacts."
}
""",
        encoding="utf-8",
    )

    result = run_scanner(artifact)

    assert result.returncode == 0, (result.stdout, result.stderr)
    assert "no credential-shaped content found" in result.stdout.casefold()


def test_scanner_recurses_through_artifact_directories(tmp_path: Path) -> None:
    nested = tmp_path / "frontier-safety" / "social"
    nested.mkdir(parents=True)
    (nested / "safe.txt").write_text("Reviewed copy only.\n", encoding="utf-8")
    (nested / "unsafe.txt").write_text(
        "password: this-value-must-not-be-public\n", encoding="utf-8"
    )

    result = run_scanner(tmp_path / "frontier-safety")

    assert result.returncode == 1
    assert str(nested / "unsafe.txt") in result.stdout
    assert str(nested / "safe.txt") not in result.stdout


def load_builder():
    path = ROOT / "tools" / "build_frontier_safety_briefing.py"
    spec = importlib.util.spec_from_file_location("frontier_safety_repro_builder", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_committed_public_artifacts_are_byte_reproducible(tmp_path: Path) -> None:
    builder = load_builder()
    editions = sorted((ROOT / "frontier-safety" / "data" / "editions").glob("*.json"))
    assert editions
    for edition in editions:
        builder.build(edition, tmp_path)
    generated_paths = [
        Path("frontier-safety.html"),
        Path("frontier-safety/data/current.json"),
        Path("frontier-safety/data/history.json"),
    ]
    for edition in editions:
        edition_date = edition.stem
        generated_paths.extend(
            [
                Path("frontier-safety/archive") / f"{edition_date}.html",
                Path("frontier-safety/data/archive") / f"{edition_date}.json",
                Path("frontier-safety/social") / f"{edition_date}-x.txt",
                Path("frontier-safety/social") / f"{edition_date}-linkedin.txt",
            ]
        )

    for relative_path in generated_paths:
        assert (tmp_path / relative_path).read_bytes() == (ROOT / relative_path).read_bytes(), relative_path
