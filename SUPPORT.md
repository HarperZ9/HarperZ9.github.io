# Support

This site is the public launch and portfolio surface for Project Telos.

## Public Issues

Open a GitHub issue for:

- broken pages, links, images, or demos
- accessibility problems
- inaccurate public descriptions
- portfolio formatting or rendering defects

## Private Material

Do not post secrets, credentials, private corpora, live runbooks, or customer
material in public issues. Keep private-line evidence in the relevant local
repository or handoff package.

## Verification

Before publishing presentation changes, run:

```powershell
python -m pytest tests/test_portfolio_visual_contract.py -q
```
