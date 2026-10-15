"""The release review record: pins per path, one review file per change.

The merge tests run real git in a temporary repository: two changes to different release paths
must merge with no conflict, two changes to one path must conflict on that path's pin, and the
single-line aggregate this record replaced is kept as the control that conflicts.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from tools.release_reviews import (
    PIN_DIR,
    REVIEW_DIR,
    legacy_fingerprint,
    load_pins,
    load_reviews,
    path_digest,
    record,
    stale_paths,
    verify,
)

ROOT = Path(__file__).resolve().parents[1]
GIT = shutil.which("git")


def _git(repo: Path, *args: str) -> subprocess.CompletedProcess:
    command = [
        GIT, "-c", "user.name=release-test", "-c", "user.email=release-test@example.invalid",
        "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false", *args,
    ]
    return subprocess.run(command, cwd=repo, capture_output=True, text=True, check=False)


def _commit(repo: Path, message: str) -> None:
    assert _git(repo, "add", "-A").returncode == 0
    result = _git(repo, "commit", "-q", "-m", message)
    assert result.returncode == 0, result.stdout + result.stderr


def _page(lines: int, edit_at: int | None = None) -> str:
    rows = [f"<p>line {n}</p>" for n in range(lines)]
    if edit_at is not None:
        rows[edit_at] = f"<p>line {edit_at}, edited</p>"
    return "\n".join(rows) + "\n"


def _site(tmp_path: Path) -> Path:
    """A repository on main with two reviewed release pages."""
    if GIT is None:
        pytest.fail("git is required for the merge tests")
    repo = tmp_path / "site"
    repo.mkdir()
    assert _git(repo, "init", "-q", "-b", "main").returncode == 0
    (repo / "a.html").write_text(_page(40), encoding="utf-8", newline="\n")
    (repo / "b.html").write_text(_page(40), encoding="utf-8", newline="\n")
    record(repo, "2026-10-16-baseline", "Seed review", ["a.html", "b.html"])
    _commit(repo, "baseline")
    return repo


def _change(repo: Path, branch: str, page: str, edit_at: int) -> None:
    """On a new branch from main, edit one page and record its review."""
    assert _git(repo, "checkout", "-q", "-b", branch, "main").returncode == 0
    (repo / page).write_text(_page(40, edit_at), encoding="utf-8", newline="\n")
    record(repo, f"2026-10-16-{branch}", f"Edit {page}", [page])
    assert verify(repo) == []
    _commit(repo, f"{branch}: edit {page}")


def _merge_into_main(repo: Path, branch: str) -> subprocess.CompletedProcess:
    assert _git(repo, "checkout", "-q", "main").returncode == 0
    return _git(repo, "merge", "--no-ff", "-q", "-m", f"Merge {branch}", branch)


def _conflicts(repo: Path) -> set[str]:
    listed = _git(repo, "diff", "--name-only", "--diff-filter=U").stdout
    return {line for line in listed.splitlines() if line}


def test_two_concurrent_changes_to_different_paths_merge_cleanly(tmp_path: Path) -> None:
    repo = _site(tmp_path)
    _change(repo, "change-a", "a.html", 3)
    _change(repo, "change-b", "b.html", 30)

    first = _merge_into_main(repo, "change-a")
    second = _merge_into_main(repo, "change-b")

    assert first.returncode == 0, first.stdout + first.stderr
    assert second.returncode == 0, second.stdout + second.stderr
    assert verify(repo) == []
    assert load_pins(repo) == {"a.html": "2026-10-16-change-a", "b.html": "2026-10-16-change-b"}


def test_two_changes_to_one_path_conflict_only_on_its_pin(tmp_path: Path) -> None:
    repo = _site(tmp_path)
    _change(repo, "change-a", "a.html", 3)
    _change(repo, "change-c", "a.html", 30)

    assert _merge_into_main(repo, "change-a").returncode == 0
    second = _merge_into_main(repo, "change-c")

    # Git merges the page itself (the edits are far apart), and nobody reviewed those merged
    # bytes, so the pin must stop the merge.
    assert second.returncode != 0
    assert _conflicts(repo) == {f"{PIN_DIR.as_posix()}/a.html.pin"}


def test_control_the_single_aggregate_line_conflicts_on_unrelated_changes(tmp_path: Path) -> None:
    """The replaced scheme: one pinned aggregate and its history in one shared file."""
    repo = _site(tmp_path)
    pin_file = repo / "fingerprint.py"

    def pin_current(note: str) -> None:
        digests = {p: path_digest(repo, p) for p in ("a.html", "b.html")}
        lines = pin_file.read_text(encoding="utf-8").splitlines()[:-1] if pin_file.exists() else []
        lines += [f"# {note}", f'REVIEWED_RELEASE_SHA256 = "{legacy_fingerprint(digests)}"']
        pin_file.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")

    pin_current("baseline")
    _commit(repo, "aggregate pin")
    for branch, page, line in (("old-a", "a.html", 3), ("old-b", "b.html", 30)):
        assert _git(repo, "checkout", "-q", "-b", branch, "main").returncode == 0
        (repo / page).write_text(_page(40, line), encoding="utf-8", newline="\n")
        pin_current(f"{branch} edits {page}")
        _commit(repo, branch)

    assert _merge_into_main(repo, "old-a").returncode == 0
    assert _merge_into_main(repo, "old-b").returncode != 0
    assert _conflicts(repo) == {"fingerprint.py"}


def _copy_reviewed(tmp_path: Path, relative: str) -> Path:
    """One real release path with its pin and review, copied out of the repository."""
    review_id = load_pins(ROOT)[relative]
    for source in (relative, f"{PIN_DIR.as_posix()}/{relative}.pin", f"{REVIEW_DIR.as_posix()}/{review_id}.json"):
        target = tmp_path / source
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / source, target)
    return tmp_path / relative


def test_a_tampered_published_file_fails_until_a_review_names_it(tmp_path: Path) -> None:
    page = _copy_reviewed(tmp_path, "studio.html")
    assert verify(tmp_path) == []

    page.write_bytes(page.read_bytes().replace(b"</body>", b"<!-- unreviewed --></body>", 1))

    assert verify(tmp_path) == [f"studio.html: bytes differ from review {load_pins(ROOT)['studio.html']}"]
    assert stale_paths(tmp_path) == ["studio.html"]
    record(tmp_path, "2026-10-16-tamper-reviewed", "The edit, reviewed", ["studio.html"])
    assert verify(tmp_path) == []


def test_a_pin_naming_a_missing_or_wrong_review_fails(tmp_path: Path) -> None:
    _copy_reviewed(tmp_path, "studio.html")
    pin = tmp_path / PIN_DIR / "studio.html.pin"

    pin.write_text("2026-10-16-never-written\n", encoding="utf-8")
    assert verify(tmp_path) == ["studio.html: pin names missing review '2026-10-16-never-written'"]

    (tmp_path / "other.html").write_text("other\n", encoding="utf-8")
    record(tmp_path, "2026-10-16-other", "Covers another path", ["other.html"])
    pin.write_text("2026-10-16-other\n", encoding="utf-8")
    assert "studio.html: review 2026-10-16-other does not name this path" in verify(tmp_path)


def test_review_files_are_dated_noted_and_hashed(tmp_path: Path) -> None:
    reviews = tmp_path / REVIEW_DIR
    reviews.mkdir(parents=True)
    (reviews / "Bad Id.json").write_text('{"date": "2026-10-16", "note": "n", "paths": {"a": "0"}}')
    (reviews / "2026-10-16-ok-id.json").write_text('{"date": "2026-10-17", "note": " ", "paths": {"a": "0"}}')

    problems = verify(tmp_path)

    assert "Bad Id: id must be YYYY-MM-DD-lower-case-words" in problems
    assert "2026-10-16-ok-id: date must be 2026-10-16" in problems
    assert "2026-10-16-ok-id: note is empty" in problems
    assert "2026-10-16-ok-id: a has no sha256" in problems
    assert "no release pins found" in problems


def test_baseline_composes_to_the_last_single_aggregate_pin() -> None:
    """The migration seed is the release that main pinned as one aggregate at 77dc0b53."""
    baseline = load_reviews(ROOT)["2026-10-15-baseline"]

    assert len(baseline["paths"]) == 387
    assert legacy_fingerprint(baseline["paths"]) == baseline["legacy_aggregate_sha256"]
    assert baseline["legacy_aggregate_sha256"] == (
        "71ed3b0ab73460b92b8181586aafe25b4b40c82363b7b35960756a0a7de7ae33"
    )
    assert any("October 15, 2026: batch 7" in line for line in baseline["history"])


def test_recording_refuses_to_overwrite_a_review(tmp_path: Path) -> None:
    (tmp_path / "a.html").write_text("a\n", encoding="utf-8")
    record(tmp_path, "2026-10-16-once", "First", ["a.html"])

    with pytest.raises(FileExistsError):
        record(tmp_path, "2026-10-16-once", "Second", ["a.html"])
    assert json.loads((tmp_path / REVIEW_DIR / "2026-10-16-once.json").read_text())["note"] == "First"
