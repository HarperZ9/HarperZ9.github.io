# Career artifact release

The role-lane PDFs and DOCX files are generated from the reviewed HTML career
pages. The generator uses an explicit source epoch so a rebuild from identical
source bytes and pinned dependencies is byte-identical.

Install the pinned document runtime:

```powershell
python -m pip install -r requirements-career-docs.txt
```

Build the four role lanes and public-safe CV, update their rows in the release
manifest, and write a path-clean receipt:

```powershell
python tools/build_career_artifacts.py `
  --site-root . `
  --output-root career `
  --receipt career/career-build-receipt.json `
  --source-epoch 1788109200 `
  --release-manifest career/career-artifacts.json
```

The command updates only the ten generated PDF/DOCX rows and refreshes every
`current_html` row after validating that each page is a local article inside
the site root. Cover-letter and portfolio-brief binaries remain untouched. The
receipt binds each generated artifact to its SHA-256, normalized extraction
SHA-256, source page, lane, byte length, MIME type, and page count. It also
binds the generator and requirements-file hashes plus the exact Python and
dependency versions used for the build.

Build the cover letters after the step above. The letter page (`cover-letter.html`)
and the general letter for security and AI evaluation roles
(`career/cover-letter-evaluation.md`) each give one PDF and one DOCX through the
same writers; `--check` rebuilds them and compares bytes. The template copy with
`[COMPANY]` and `[ROLE]` placeholders is never built.

```powershell
python tools/build_cover_letters.py
python tools/build_cover_letters.py --check
```

The designed editions under `career/designed/` come from
`tools/build_career_typeset.py --buildlang PATH`, and `tools/career_pdf_checks.py`
reads them back. The full CV runs to seven pages since 13 November 2026, and the
designed CV must land on the same page count as the plain one.

## Document order (14 November 2026)

Every resume, the CV, the hiring page and both cover letters lead with strengths and
checkable results. The order in `career/resume-source.json` is: a job-title headline,
a two or three line Summary, Selected Results, Experience, Projects, Education, Skills.

- The start date is one statement on every surface: about thirteen years of programming.
- The sentence about no paid software role appears once, in the Experience section.
- The merged pull request count and its date come from `career/open-source-census.json`;
  `tests/test_resume_consolidation.py` compares the documents, the hiring page and the
  letters with that file.
- The hiring page takes its headline, summary and Proof list from the CV blocks, so the
  two cannot disagree.
- Relocation and pay are answered on application forms and are left out of these files.

Verify before release:

```powershell
python -m pytest `
  tests/test_career_artifact_generation.py `
  tests/test_career_documents.py `
  tests/test_cover_letters.py `
  tests/test_capability_publication_release.py
```

These checks establish local determinism, committed-to-fresh byte parity,
one-page/selectable-text structure, rendered text visibility and page bounds,
claim parity, receipt integrity, and inclusion in the reviewed release/privacy
boundary. They do not establish ATS acceptance, recruiter review, or
application outcome.
