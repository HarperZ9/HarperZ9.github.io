# HarperZ9.github.io

Static portfolio and product-surface site for Zain Dana Harper.

The site presents public release-readiness tools, proof-surface samples, EMET
witness material, QuantaLang work, and related engineering surfaces. It is a
plain static site intended for GitHub Pages.

## Files

- `index.html` - primary portfolio page.
- `proof-surface-sample.html` - sample proof-surface report.
- `proof-index-sample.html` - sample proof index.
- `public-surface-sweeper-sample.html` - sample public-surface sweep.
- `emet-sample.html` - sample EMET witness surface.
- `AUTHORS.md` - authorship and release ownership note.

## Local Verification

Open `index.html` directly in a browser or serve this directory locally:

```powershell
python -m http.server 8765
```

Then visit `http://127.0.0.1:8765/`.

Before publishing, verify:

- The first viewport identifies the portfolio and current offer.
- Local sample links resolve.
- External GitHub links point at intended public repositories.
- The page remains legible at desktop and mobile widths.
- No local secrets, generated logs, or private artifacts are staged.
