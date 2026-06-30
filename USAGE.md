# Usage Guide

This repository publishes the static Project Telos portfolio and product
surface at `HarperZ9.github.io`.

It is intentionally inspectable: no application build step is required for the
current public site.

## Run Locally

```powershell
python -m http.server 8765
```

Open:

```text
http://127.0.0.1:8765/
```

## Verify

Install the Python test runner if needed:

```powershell
python -m pip install pytest
```

Run content and structure contracts:

```powershell
python -m pytest
```

Run the internal-link crawl:

```powershell
python -m http.server 8802
node tests/linkcheck.mjs
```

Run the public delivery sweep when `public-surface-sweeper` is available
locally:

```powershell
python -m public_surface_sweeper . --workspace --json
```

## Public Checks

Before publishing:

- Verify the first viewport explains the public value plainly.
- Check product pages, sample reports, and GitHub links.
- Check desktop and mobile readability.
- Keep maturity labels honest: sample, release candidate, production-ready,
  archived, or research.
- Do not stage `.env`, local logs, private artifacts, browser state, or raw
  protected evidence.

## Developer Notes

- Keep the site static unless a build step becomes clearly necessary.
- Keep sample pages scrubbed and self-contained.
- Keep repository links pointed at public repos only.
- Keep README, USAGE, changelog, tests, and page content aligned.
