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

Verify before release:

```powershell
python -m pytest `
  tests/test_career_artifact_generation.py `
  tests/test_career_documents.py `
  tests/test_capability_publication_release.py
```

These checks establish local determinism, committed-to-fresh byte parity,
one-page/selectable-text structure, rendered text visibility and page bounds,
claim parity, receipt integrity, and inclusion in the reviewed release/privacy
boundary. They do not establish ATS acceptance, recruiter review, or
application outcome.
