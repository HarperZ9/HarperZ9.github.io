# Spec: Private-Line One-Word Names

## Objective
Present the private-line Project Telos tools with one-word names that describe
what they do, while avoiding a repo, package, CLI, or import rename in this
change.

## Requirements
- [x] The public site names all six private-line tools.
- [x] The public site uses one-word names: Gate, Runtime, Vault, Boundary,
  Lab, and Ledger.
- [x] Lab and Ledger remain marked private until public-safe splits are
  complete.
- [x] Browser titles and social metadata lead with Gate and Runtime where those
  are the product names.
- [x] No package names, repository names, import paths, or CLI commands are
  renamed in this patch.
- [x] Tests assert the public-safe private-line group appears on the home page
  and Aleph page.

## Technical Approach
Update only presentation and product documentation. Treat the functional names
as product labels that sit beside existing repo names. Keep public links only
for repositories that passed the public-safety gate.

## Files to Modify
- `index.html` - list the full private-line family and its safety split.
- `overview.html` - clarify the private-line roles in the flagship map.
- `catalog.html` - list the same function-first labels in the catalog.
- `aleph.html` - show the same private-line contract in the Gate page.
- `orca.html` - present Runtime as the product name for the ORCA repo page.
- `portfolio.html` - keep the portfolio note current.
- `tests/test_portfolio_visual_contract.py` - assert the presentation contract.

## Success Criteria
- [x] `python -m pytest -q` passes in the public site repo.
- [x] `node tests/linkcheck.mjs` passes against a local HTTP server.
- [ ] Staged diff contains no secrets or credential material.

## Blockers
None identified.

## Status: IMPLEMENTED
