"""Deterministic ATS artifact generation from reviewed public HTML."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
from importlib.metadata import version
import json
import runpy
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree

import fitz
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "tools" / "build_career_artifacts.py"
OUTPUT_NAMES = (
    "Zain-Dana-Harper-Resume-Support-Developer-Operations-QA.pdf",
    "Zain-Dana-Harper-Resume-Support-Developer-Operations-QA.docx",
    "Zain-Dana-Harper-Resume-Evaluation-Tooling-Python-Developer-Tools.pdf",
    "Zain-Dana-Harper-Resume-Evaluation-Tooling-Python-Developer-Tools.docx",
    "Zain-Dana-Harper-Resume-Public-Operations.pdf",
    "Zain-Dana-Harper-Resume-Public-Operations.docx",
    "Zain-Dana-Harper-Resume-Grounds.pdf",
    "Zain-Dana-Harper-Resume-Grounds.docx",
    "Zain-Dana-Harper-CV.pdf",
    "Zain-Dana-Harper-CV.docx",
)


def _build(output: Path, receipt: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--site-root",
            str(ROOT),
            "--output-root",
            str(output),
            "--receipt",
            str(receipt),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=ROOT,
    )


def _docx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as package:
        root = ElementTree.fromstring(package.read("word/document.xml"))
    namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    return "\n".join(node.text or "" for node in root.iter(namespace + "t"))


def _artifact_text(path: Path) -> str:
    if path.suffix == ".pdf":
        reader = PdfReader(path)
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    return _docx_text(path)


def _normalized_extraction(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.splitlines()).strip() + "\n"


class _ArticleTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.article_depth = 0
        self.kind: str | None = None
        self.parts: list[str] = []
        self.blocks: list[str] = []

    def handle_starttag(self, tag, attrs) -> None:
        if tag == "article":
            self.article_depth += 1
        elif self.article_depth and tag in {"h1", "h2", "p", "li"}:
            self.kind = tag
            self.parts = []
        elif (
            self.article_depth
            and self.kind == "p"
            and tag == "span"
            and any(part.strip() for part in self.parts)
        ):
            self.parts.append(" | ")

    def handle_data(self, data: str) -> None:
        if self.article_depth and self.kind is not None:
            self.parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if self.article_depth and tag == self.kind:
            text = " ".join("".join(self.parts).split())
            if text:
                self.blocks.append(text)
            self.kind = None
            self.parts = []
        if tag == "article" and self.article_depth:
            self.article_depth -= 1


def _html_extraction(path: Path) -> str:
    parser = _ArticleTextParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return "\n".join(parser.blocks).strip() + "\n"


def test_cli_builds_every_status_bounded_artifact(tmp_path: Path) -> None:
    """Omitting one affected lane would leave public and downloadable claims split."""
    output = tmp_path / "career"
    receipt = tmp_path / "receipt.json"
    proc = _build(output, receipt)

    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert sorted(path.name for path in output.iterdir()) == sorted(OUTPUT_NAMES)
    assert receipt.is_file()


def test_generated_formats_are_parseable_one_page_and_status_bounded(
    tmp_path: Path,
) -> None:
    """Corrupt, image-only, multipage, or stale outputs are not ATS artifacts."""
    output = tmp_path / "career"
    proc = _build(output, tmp_path / "receipt.json")
    assert proc.returncode == 0, proc.stdout + proc.stderr

    expected = (
        "Technical Networking Support, Xbox/Microsoft contract | subcontracted through Stream/Convergys | Wilsonville, Oregon | 2014 to 2015",
        "Full-time operations and commercial arboriculture | Legendary Tree (organization label) | April 25, 2015 to June 2, 2026",
        "Freelance Technical Writer, Documentation, and Product Operations | independent practice | started 2017",
        "Independent Systems Engineer | independent practice | started 2023",
    )
    boundary = (
        "The 2017 and 2023 start years do not state current status or an end date; "
        "both remain unspecified."
    )
    arboriculture_boundary = (
        "Legendary Tree is the applicant-provided organization label; no conventional "
        "job title or legal employer of record is asserted."
    )
    for path in output.iterdir():
        if path.suffix == ".pdf":
            reader = PdfReader(path)
            assert len(reader.pages) == 1, path.name
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        else:
            text = _docx_text(path)
        assert len(text.split()) >= 150, path.name
        assert "current status unconfirmed" not in text, path.name
        for line in expected:
            assert line in text, f"{path.name}: missing {line!r}"
        assert boundary in text, f"{path.name}: missing explicit status boundary"
        assert arboriculture_boundary in text, path.name
        assert "Operations and Commercial Arboriculture Lead" not in text, path.name
        assert "family business" not in text, path.name
        assert "started 2015" not in text, path.name


def test_generated_pdfs_render_visible_content_inside_letter_page(
    tmp_path: Path,
) -> None:
    """Selectable text alone must not conceal clipped or invisible application copy."""
    output = tmp_path / "career"
    proc = _build(output, tmp_path / "receipt.json")
    assert proc.returncode == 0, proc.stdout + proc.stderr

    for path in sorted(output.glob("*.pdf")):
        document = fitz.open(path)
        assert document.page_count == 1, path.name
        page = document[0]
        assert round(page.rect.width) == 612, path.name
        assert round(page.rect.height) == 792, path.name
        blocks = [block for block in page.get_text("blocks") if block[4].strip()]
        assert blocks, path.name
        for x0, y0, x1, y1, *_ in blocks:
            assert x0 >= 36 and y0 >= 25, (path.name, x0, y0)
            assert x1 <= page.rect.width - 36, (path.name, x1)
            assert y1 <= page.rect.height - 25, (path.name, y1)
            rendered = page.get_pixmap(
                matrix=fitz.Matrix(2, 2),
                colorspace=fitz.csGRAY,
                alpha=False,
                clip=fitz.Rect(x0, y0, x1, y1),
            )
            assert min(rendered.samples) < 200, (path.name, block[4][:40])


def test_cv_contact_fields_stay_visibly_separated_in_both_formats(
    tmp_path: Path,
) -> None:
    """Adjacent HTML spans must not become one unreadable ATS token stream."""
    output = tmp_path / "career"
    proc = _build(output, tmp_path / "receipt.json")
    assert proc.returncode == 0, proc.stdout + proc.stderr
    expected = "Seattle, Washington | zaindharper@gmail.com | LinkedIn | GitHub"
    for suffix in ("pdf", "docx"):
        path = output / f"Zain-Dana-Harper-CV.{suffix}"
        assert expected in _artifact_text(path), path.name


def test_explicit_source_epoch_makes_repeated_builds_byte_identical(
    tmp_path: Path,
) -> None:
    """Ambient time must not change an application attachment's payload hash."""
    outputs = []
    for run in ("first", "second"):
        output = tmp_path / run
        proc = subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                "--site-root",
                str(ROOT),
                "--output-root",
                str(output),
                "--receipt",
                str(tmp_path / f"{run}.json"),
                "--source-epoch",
                "1788109200",
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            cwd=ROOT,
        )
        assert proc.returncode == 0, proc.stdout + proc.stderr
        outputs.append(output)

    first, second = outputs
    for name in OUTPUT_NAMES:
        first_hash = hashlib.sha256((first / name).read_bytes()).hexdigest()
        second_hash = hashlib.sha256((second / name).read_bytes()).hexdigest()
        assert first_hash == second_hash, name


def test_docx_repack_discards_platform_specific_zip_metadata(tmp_path: Path) -> None:
    """Equivalent source packages must repack to identical bytes on every OS."""
    paths = []
    for label, create_system in (("windows", 0), ("unix", 3)):
        path = tmp_path / f"{label}.docx"
        with zipfile.ZipFile(
            path,
            "w",
            compression=zipfile.ZIP_DEFLATED,
            compresslevel=9,
        ) as package:
            info = zipfile.ZipInfo("word/document.xml", (2026, 8, 30, 17, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = create_system
            info.external_attr = 0o600 << 16
            package.writestr(info, b"<document/>")
        paths.append(path)

    repack = runpy.run_path(str(SCRIPT))["_repack_docx"]
    fixed_datetime = datetime.fromtimestamp(1788109200, timezone.utc)
    for path in paths:
        repack(path, fixed_datetime)

    windows, unix = paths
    assert windows.read_bytes() == unix.read_bytes()


def test_fresh_build_matches_each_committed_release_artifact(tmp_path: Path) -> None:
    """Committed application bytes must be reproducible from the reviewed sources."""
    output = tmp_path / "career"
    receipt_path = tmp_path / "receipt.json"
    proc = _build(output, receipt_path)
    assert proc.returncode == 0, proc.stdout + proc.stderr

    committed_receipt = json.loads(
        (ROOT / "career" / "career-build-receipt.json").read_text(encoding="utf-8")
    )
    assert committed_receipt["source_epoch"] == 1788109200
    committed_inputs = {
        row["path"]: row for row in committed_receipt["build_inputs"]
    }
    for relative in (
        "tools/build_career_artifacts.py",
        "requirements-career-docs.txt",
    ):
        assert committed_inputs[relative]["sha256"] == hashlib.sha256(
            (ROOT / relative).read_bytes()
        ).hexdigest()
    for source in committed_receipt["sources"]:
        assert source["sha256"] == hashlib.sha256(
            (ROOT / source["path"]).read_bytes()
        ).hexdigest(), source["path"]
    committed_by_name = {
        Path(row["path"]).name: row for row in committed_receipt["artifacts"]
    }
    for name in OUTPUT_NAMES:
        fresh_hash = hashlib.sha256((output / name).read_bytes()).hexdigest()
        committed_hash = hashlib.sha256((ROOT / "career" / name).read_bytes()).hexdigest()
        assert fresh_hash == committed_hash == committed_by_name[name]["sha256"], name


def test_receipt_binds_artifact_and_extraction_hashes_without_local_paths(
    tmp_path: Path,
) -> None:
    """A receipt that cannot re-identify its bytes is not release evidence."""
    output = tmp_path / "career"
    receipt_path = tmp_path / "receipt.json"
    proc = _build(output, receipt_path)
    assert proc.returncode == 0, proc.stdout + proc.stderr

    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    assert receipt["schema"] == "harperz9-career-build/v1"
    assert receipt["source_epoch"] == 1788109200
    build_inputs = {row["path"]: row for row in receipt["build_inputs"]}
    for relative in (
        "tools/build_career_artifacts.py",
        "requirements-career-docs.txt",
    ):
        assert build_inputs[relative]["sha256"] == hashlib.sha256(
            (ROOT / relative).read_bytes()
        ).hexdigest()
    assert receipt["runtime"]["python"].startswith("3.12.")
    assert receipt["runtime"]["dependencies"] == {
        name: version(name)
        for name in (
            "charset-normalizer",
            "lxml",
            "pillow",
            "PyMuPDF",
            "python-docx",
            "pypdf",
            "reportlab",
            "typing_extensions",
        )
    }
    assert len(receipt["artifacts"]) == 10
    by_name = {Path(row["path"]).name: row for row in receipt["artifacts"]}
    assert sorted(by_name) == sorted(OUTPUT_NAMES)
    for name in OUTPUT_NAMES:
        path = output / name
        row = by_name[name]
        assert row["path"] == f"career/{name}"
        assert row["sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
        extraction = _normalized_extraction(_artifact_text(path))
        assert row["extraction_sha256"] == hashlib.sha256(
            extraction.encode("utf-8")
        ).hexdigest()

    serialized = json.dumps(receipt, sort_keys=True)
    assert str(ROOT) not in serialized
    assert str(tmp_path) not in serialized


def test_release_manifest_replaces_only_generated_artifact_rows(
    tmp_path: Path,
) -> None:
    """A status-boundary rebuild must not restamp unrelated attachments."""
    output = tmp_path / "career"
    receipt_path = tmp_path / "receipt.json"
    manifest_path = tmp_path / "career-artifacts.json"
    shutil.copyfile(ROOT / "career" / "career-artifacts.json", manifest_path)
    before = json.loads(manifest_path.read_text(encoding="utf-8"))
    proc = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--site-root",
            str(ROOT),
            "--output-root",
            str(output),
            "--receipt",
            str(receipt_path),
            "--source-epoch",
            "1788109200",
            "--release-manifest",
            str(manifest_path),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=ROOT,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr

    after = json.loads(manifest_path.read_text(encoding="utf-8"))
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    generated_paths = {row["path"] for row in receipt["artifacts"]}
    unaffected_before = [
        row for row in before["artifacts"] if row["path"] not in generated_paths
    ]
    unaffected_after = [
        row for row in after["artifacts"] if row["path"] not in generated_paths
    ]
    assert unaffected_after == unaffected_before
    assert len(after["artifacts"]) == len(before["artifacts"]) == 14
    by_path = {row["path"]: row for row in after["artifacts"]}
    for receipt_row in receipt["artifacts"]:
        expected = {key: value for key, value in receipt_row.items() if key != "source"}
        assert by_path[receipt_row["path"]] == expected
    assert after["generated_at_epoch"] == 1788109200


def test_release_manifest_rehashes_every_current_html_authority(
    tmp_path: Path,
) -> None:
    """Artifact hashes cannot be current while their source-page rows stay stale."""
    output = tmp_path / "career"
    manifest_path = tmp_path / "career-artifacts.json"
    before = json.loads(
        (ROOT / "career" / "career-artifacts.json").read_text(encoding="utf-8")
    )
    stale_row = next(
        row for row in before["current_html"] if row["path"] == "hire.html"
    )
    stale_row["byte_length"] = 0
    stale_row["sha256"] = "0" * 64
    stale_row["extraction_sha256"] = "0" * 64
    manifest_path.write_text(
        json.dumps(before, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    proc = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--site-root",
            str(ROOT),
            "--output-root",
            str(output),
            "--receipt",
            str(tmp_path / "receipt.json"),
            "--source-epoch",
            "1788109200",
            "--release-manifest",
            str(manifest_path),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=ROOT,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for row in manifest["current_html"]:
        name = row["path"]
        payload = (ROOT / name).read_bytes()
        extraction = _html_extraction(ROOT / name)
        assert row["byte_length"] == len(payload)
        assert row["sha256"] == hashlib.sha256(payload).hexdigest()
        assert row["extraction_sha256"] == hashlib.sha256(
            extraction.encode("utf-8")
        ).hexdigest()


def test_committed_manifest_binds_current_html_extractions() -> None:
    """Committed extraction receipts must identify current visible article text."""
    manifest = json.loads(
        (ROOT / "career" / "career-artifacts.json").read_text(encoding="utf-8")
    )
    for row in manifest["current_html"]:
        extraction = _html_extraction(ROOT / row["path"])
        assert row["extraction_sha256"] == hashlib.sha256(
            extraction.encode("utf-8")
        ).hexdigest(), row["path"]


def test_invalid_release_manifest_is_left_byte_identical_on_failure(
    tmp_path: Path,
) -> None:
    """Validation must finish before a failed release can restamp its authority."""
    output = tmp_path / "career"
    manifest_path = tmp_path / "career-artifacts.json"
    manifest = json.loads(
        (ROOT / "career" / "career-artifacts.json").read_text(encoding="utf-8")
    )
    manifest["current_html"] = [
        row for row in manifest["current_html"] if row["path"] != "cv.html"
    ]
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    before = manifest_path.read_bytes()

    proc = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--site-root",
            str(ROOT),
            "--output-root",
            str(output),
            "--receipt",
            str(tmp_path / "receipt.json"),
            "--source-epoch",
            "1788109260",
            "--release-manifest",
            str(manifest_path),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=ROOT,
    )

    assert proc.returncode != 0
    assert "release manifest has no HTML rows for: cv.html" in proc.stderr
    assert manifest_path.read_bytes() == before


def test_invalid_release_manifest_cannot_overwrite_outputs_or_receipt(
    tmp_path: Path,
) -> None:
    """Release-authority validation must run before any output mutation."""
    output = tmp_path / "career"
    output.mkdir()
    protected_output = output / OUTPUT_NAMES[0]
    protected_output.write_bytes(b"existing reviewed artifact")
    receipt_path = tmp_path / "receipt.json"
    receipt_path.write_bytes(b"existing reviewed receipt")
    manifest_path = tmp_path / "career-artifacts.json"
    manifest = json.loads(
        (ROOT / "career" / "career-artifacts.json").read_text(encoding="utf-8")
    )
    manifest["current_html"] = [
        row for row in manifest["current_html"] if row["path"] != "cv.html"
    ]
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )

    proc = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--site-root",
            str(ROOT),
            "--output-root",
            str(output),
            "--receipt",
            str(receipt_path),
            "--release-manifest",
            str(manifest_path),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=ROOT,
    )

    assert proc.returncode != 0
    assert protected_output.read_bytes() == b"existing reviewed artifact"
    assert receipt_path.read_bytes() == b"existing reviewed receipt"
    assert sorted(path.name for path in output.iterdir()) == [OUTPUT_NAMES[0]]


def test_missing_current_html_authority_cannot_overwrite_release_outputs(
    tmp_path: Path,
) -> None:
    """Every rehashed HTML authority must validate before release mutation."""
    output = tmp_path / "career"
    output.mkdir()
    protected_output = output / OUTPUT_NAMES[0]
    protected_output.write_bytes(b"existing reviewed artifact")
    receipt_path = tmp_path / "receipt.json"
    receipt_path.write_bytes(b"existing reviewed receipt")
    manifest_path = tmp_path / "career-artifacts.json"
    manifest = json.loads(
        (ROOT / "career" / "career-artifacts.json").read_text(encoding="utf-8")
    )
    hire_row = next(
        row for row in manifest["current_html"] if row["path"] == "hire.html"
    )
    hire_row["path"] = "missing-hiring-authority.html"
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )

    proc = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--site-root",
            str(ROOT),
            "--output-root",
            str(output),
            "--receipt",
            str(receipt_path),
            "--release-manifest",
            str(manifest_path),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=ROOT,
    )

    assert proc.returncode != 0
    assert protected_output.read_bytes() == b"existing reviewed artifact"
    assert receipt_path.read_bytes() == b"existing reviewed receipt"
    assert sorted(path.name for path in output.iterdir()) == [OUTPUT_NAMES[0]]


def test_out_of_tree_html_authority_cannot_overwrite_release_outputs(
    tmp_path: Path,
) -> None:
    """A manifest cannot bind local files outside the declared site root."""
    output = tmp_path / "career"
    output.mkdir()
    protected_output = output / OUTPUT_NAMES[0]
    protected_output.write_bytes(b"existing reviewed artifact")
    receipt_path = tmp_path / "receipt.json"
    receipt_path.write_bytes(b"existing reviewed receipt")
    outside = tmp_path / "outside.html"
    outside.write_text(
        "<article><h1>private local authority</h1></article>",
        encoding="utf-8",
    )
    manifest_path = tmp_path / "career-artifacts.json"
    manifest = json.loads(
        (ROOT / "career" / "career-artifacts.json").read_text(encoding="utf-8")
    )
    hire_row = next(
        row for row in manifest["current_html"] if row["path"] == "hire.html"
    )
    hire_row["path"] = str(outside)
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )

    proc = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--site-root",
            str(ROOT),
            "--output-root",
            str(output),
            "--receipt",
            str(receipt_path),
            "--release-manifest",
            str(manifest_path),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=ROOT,
    )

    assert proc.returncode != 0
    assert protected_output.read_bytes() == b"existing reviewed artifact"
    assert receipt_path.read_bytes() == b"existing reviewed receipt"
    assert sorted(path.name for path in output.iterdir()) == [OUTPUT_NAMES[0]]


def test_json_release_authorities_use_lf_line_endings(tmp_path: Path) -> None:
    """Receipt and manifest hashes must not depend on the host newline default."""
    output = tmp_path / "career"
    receipt_path = tmp_path / "receipt.json"
    manifest_path = tmp_path / "career-artifacts.json"
    shutil.copyfile(ROOT / "career" / "career-artifacts.json", manifest_path)
    proc = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--site-root",
            str(ROOT),
            "--output-root",
            str(output),
            "--receipt",
            str(receipt_path),
            "--release-manifest",
            str(manifest_path),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=ROOT,
    )

    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert b"\r" not in receipt_path.read_bytes()
    assert b"\r" not in manifest_path.read_bytes()
