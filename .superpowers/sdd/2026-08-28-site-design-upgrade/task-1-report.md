status: DONE_WITH_CONCERNS

release base commit SHA: 2a036013b97dad407aa3d18386d919555d047d47
task base commit SHA: d7892893ef2b98c8b27c2b27ab55ca7de033ac7e
final task commit SHA before current-main rebase: 9738566ac595d077079f02e546707c3649cc6a3e
rebased task commit SHA: f0cc153

files changed:
- tests/test_zentropy_sitewide_contract.py
- tests/test_page_export.py
- system/system.css
- system/doc.css
- system/nav.css
- system/figure.css
- .superpowers/sdd/2026-08-28-site-design-upgrade/task-1-report.md

RED command and expected failure summary:
- Command: python -m pytest tests/test_zentropy_sitewide_contract.py tests/test_page_export.py -q
- Result before production CSS edits: 4 failed, 14 passed.
- Expected failures:
  - test_shared_styles_define_zentropy_material_system found active ZentropyDisplay references in system/system.css.
  - test_shared_styles_define_paper_data_surfaces found no .data-plate contract in system/system.css.
  - test_data_surfaces_survive_forced_colors found no forced-colors data-surface contract in system/system.css.
  - test_shared_data_surfaces_print_as_black_ink_on_white_paper found no print data-surface contract in system/system.css.

GREEN commands and exact pass/fail counts:
- python -m pytest tests/test_zentropy_sitewide_contract.py tests/test_page_export.py -q
  - 18 passed, 0 failed.
- python -m pytest tests/test_zentropy_sitewide_contract.py tests/test_page_export.py tests/test_page_metadata.py -q
  - 25 passed, 4 failed.
  - Failures are in tests/test_page_metadata.py for resume-evaluation-tooling.html missing description and og:image metadata, cv.html description length, and the follow-on house-voice check after missing metadata.
- node --test system/nav.test.mjs system/figure.test.mjs
  - 12 passed, 0 failed, 0 skipped.
- git diff --check
  - Passed with exit code 0 and no output.

Post-rebase reconciliation on current `origin/main` b688549:
- Restored the current live navigation contract from b688549. The mobile menu remains a pinned fixed control and shifts to `right:1rem` after the wordmark hides at 430px.
- python -m pytest tests/test_zentropy_sitewide_contract.py tests/test_page_export.py tests/test_page_metadata.py -q
  - 29 passed, 0 failed.
- node --test system/nav.test.mjs system/figure.test.mjs
  - 12 passed, 0 failed, 0 skipped.
- python -m pytest tests -q
  - 339 passed, 1 failed. The remaining failure is the expected reviewed release-spine fingerprint drift caused by the intentional shared CSS changes. The fingerprint must be regenerated once the complete design release is finalized, not during this foundation task.
- node --test "system/**/*.test.mjs"
  - 980 passed, 0 failed, 14 skipped.

self-review findings:
- Active shared CSS files no longer contain ZentropyDisplay declarations or uses.
- system.css, doc.css, nav.css, and figure.css define the exact shared font and ground/paper/ink tokens required by the brief.
- system.css, doc.css, and figure.css define .data-plate and .evidence-ledger using warm-paper background and near-black ink.
- Forced-colors rules remove decorative backgrounds on the data surfaces and keep visible CanvasText borders.
- Print rules force data surfaces to white paper, black ink, and black borders.
- Existing public selectors were preserved; stale test assertions were updated only where they tracked retired implementation details in current nav.js and the current sticky-grid mobile menu.

concerns:
- The current-main rebase resolved the previous metadata failures.
- The release-spine fingerprint remains intentionally stale until all design tasks are complete and the final reviewed artifact set can be sealed once.
- A shortened rebased SHA can be recorded here, but an exact commit SHA cannot be embedded in the same Git object without changing that object.
