# ZentropyLabs Site-Wide Brand Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the public static site so shared pages, document pages, and standalone pages carry the ZentropyLabs identity, current artwork, custom display typography, and mobile-safe runtime behavior.

**Architecture:** Use `system/nav.js` as the shared runtime control point for brand chrome, route-art mounting, and GPU capability gating. Use late shared CSS layers in `system/system.css` and `system/doc.css` to override legacy theme cascades while preserving compatibility variables and existing page markup. Copy only public brand/art assets from `telos-v2`; do not import source generators or private material.

**Tech Stack:** Static HTML, CSS, browser ES modules, self-hosted font/image assets, Python `pytest`, Node link checker, `npx serve`, Playwright/Chrome for visual inspection, GitHub Pages.

## Global Constraints

- Public shared chrome renders `zentropyLabs` exactly in rhinoCase.
- Project Telos remains the public workbench and project family.
- The approved source assets are under `C:/dev/public/telos-v2/public/brand` and `C:/dev/public/telos-v2/public/img/og`.
- `ZentropyDisplay` is for short brand, route, and project marks; Hanken Grotesk remains body text; Conso remains metadata/readout text.
- Heavy canvas/WebGL enhancements run only when there is no reduced motion preference, the pointer is fine, and the viewport is at least 900px wide.
- Mobile and reduced-motion fallbacks must show static artwork and complete DOM content.
- Shared CSS changes must preserve compatibility variable names used by legacy selectors.
- Existing page content, links, maturity labels, and public/private boundaries remain intact.
- GitHub Pages is production; push only after local tests, visual checks, link checks, diff checks, and credential scan pass.

---

## File Structure

- Create `tests/test_zentropy_sitewide_contract.py`: source and asset contracts for shared static Zentropy branding.
- Modify `system/nav.js`: brand label, fallback mark, active-section signal, GPU capability gate, and route-art mounting.
- Modify `system/system.css`: main static-page Zentropy palette, typography, route plate, navigation, mobile behavior, and canvas fallback rules.
- Modify `system/doc.css`: document-page Zentropy palette, typography, route plate, navigation, print-safe fallback, and mobile behavior.
- Modify selected `*.html`: cache-busting query strings for shared CSS/JS if needed.
- Add `brand/zentropy-avatar.png`: compact aperture/avatar mark copied from Telos v2.
- Refresh `brand/ZentropyDisplay.ttf`: custom display font copied from Telos v2 if different.
- Refresh `img/og/*.png`: current Zentropy/Telos v2 page and project artwork copied from Telos v2.
- Modify `docs/superpowers/specs/2026-07-19-zentropy-sitewide-design.md`: status moves from `DRAFT` to `APPROVED` before code execution.

---

### Task 1: Add Site-Wide Brand Contract Tests

**Files:**
- Create: `tests/test_zentropy_sitewide_contract.py`

**Interfaces:**
- Consumes: existing static files under the repository root.
- Produces: four pytest tests that later tasks satisfy:
  - `test_shared_nav_renders_zentropy_brand_and_desktop_gpu_gate`
  - `test_shared_styles_define_zentropy_material_system`
  - `test_current_zentropy_assets_are_shipped`
  - `test_representative_pages_keep_route_art_metadata`

- [ ] **Step 1: Create the failing test file**

Add `tests/test_zentropy_sitewide_contract.py` with this content:

```python
"""Contracts for the site-wide ZentropyLabs static shell."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def test_shared_nav_renders_zentropy_brand_and_desktop_gpu_gate() -> None:
    nav = read("system/nav.js")

    assert "zentropyLabs" in nav
    assert "<span>TELOS</span>" not in nav
    assert "brand/zentropy-avatar.png" in nav
    assert "function shouldUseDesktopGpuArt" in nav
    assert '"(prefers-reduced-motion: reduce)"' in nav
    assert '"(pointer: fine)"' in nav
    assert '"(min-width: 900px)"' in nav
    assert "mountRouteArt" in nav
    assert "getRouteArtMetadata" in nav
    assert "shouldUseDesktopGpuArt(window)" in nav
    assert "import(\"./generative-field.js\")" in nav
    assert "import(\"./cursor-field.js\")" in nav


def test_shared_styles_define_zentropy_material_system() -> None:
    system_css = read("system/system.css")
    doc_css = read("system/doc.css")

    for css in (system_css, doc_css):
        assert 'font-family:"ZentropyDisplay"' in css
        assert "--brand-display:\"ZentropyDisplay\"" in css
        assert "#070406" in css
        assert "#eaf5f6" in css
        assert "#94afb4" in css
        assert "#678188" in css
        assert "#8ee3f2" in css
        assert "#c86a44" in css
        assert "#1e0f14" in css
        assert ".route-art" in css
        assert "@media (max-width:760px)" in css or "@media (max-width: 760px)" in css

    assert "Telos Display retired" not in system_css
    assert "Telos Display retired" not in doc_css
    assert "Kilon retired" not in doc_css


def test_current_zentropy_assets_are_shipped() -> None:
    expected_assets = {
        "brand/zentropy-avatar.png": 450_000,
        "brand/ZentropyDisplay.ttf": 50_000,
        "img/og/portfolio-home.png": 550_000,
        "img/og/forum.png": 560_000,
        "img/og/gather.png": 560_000,
        "img/og/telos.png": 560_000,
        "img/og/profile.png": 560_000,
    }

    for rel, minimum_size in expected_assets.items():
        path = ROOT / rel
        assert path.is_file(), rel
        assert path.stat().st_size >= minimum_size, rel


def test_representative_pages_keep_route_art_metadata() -> None:
    pages = (
        "overview.html",
        "catalog.html",
        "research.html",
        "writing.html",
        "forum.html",
        "gather.html",
    )

    for page in pages:
        html = read(page)
        match = re.search(r'<meta property="og:image" content="https://harperz9.github.io/([^"]+)"', html)
        assert match, f"{page} must expose og:image metadata"
        assert (ROOT / match.group(1)).is_file(), f"{page} og:image target must exist"
        assert '<meta property="og:image:alt"' in html
```

- [ ] **Step 2: Run the new tests to verify they fail before implementation**

Run:

```powershell
python -m pytest -q tests/test_zentropy_sitewide_contract.py
```

Expected: FAIL on current state because `system/nav.js` still hardcodes `TELOS`, `brand/zentropy-avatar.png` is missing, old shared CSS comments remain, and old OG assets are smaller than the current Telos v2 art.

- [ ] **Step 3: Commit the failing contract tests with the approved plan**

This task is part of the planning/contract commit, not the final implementation commit.

```powershell
git add docs/superpowers/specs/2026-07-19-zentropy-sitewide-design.md docs/superpowers/plans/2026-07-19-zentropy-sitewide-brand-pass.md tests/test_zentropy_sitewide_contract.py
git commit -m "test: define site-wide Zentropy brand contract"
```

Expected: commit succeeds and only the approved spec status, implementation plan, and new failing contract test are staged.

---

### Task 2: Sync Approved Public Brand and OG Assets

**Files:**
- Add: `brand/zentropy-avatar.png`
- Modify: `brand/ZentropyDisplay.ttf`
- Modify: `img/og/*.png`

**Interfaces:**
- Consumes: Telos v2 public assets from `C:/dev/public/telos-v2/public/brand` and `C:/dev/public/telos-v2/public/img/og`.
- Produces: public assets used by `system/nav.js`, existing social metadata, and route-art plates.

- [ ] **Step 1: Copy only public assets from Telos v2**

Run:

```powershell
Copy-Item -LiteralPath C:\dev\public\telos-v2\public\brand\zentropy-avatar.png -Destination C:\dev\public\portfolio-site\brand\zentropy-avatar.png -Force
Copy-Item -LiteralPath C:\dev\public\telos-v2\public\brand\ZentropyDisplay.ttf -Destination C:\dev\public\portfolio-site\brand\ZentropyDisplay.ttf -Force
Copy-Item -LiteralPath C:\dev\public\telos-v2\public\img\og\*.png -Destination C:\dev\public\portfolio-site\img\og -Force
```

Expected: destination files are overwritten with the current public artwork. No source HTML generators, private drafts, temp captures, or local-only files are copied.

- [ ] **Step 2: Run the asset contract**

Run:

```powershell
python -m pytest -q tests/test_zentropy_sitewide_contract.py::test_current_zentropy_assets_are_shipped
```

Expected: PASS. Representative files meet the current size floor and exist in the public repo.

- [ ] **Step 3: Commit the asset sync**

Run:

```powershell
git add brand/zentropy-avatar.png brand/ZentropyDisplay.ttf img/og
git commit -m "brand: sync Zentropy public artwork"
```

Expected: commit includes only public brand/image/font assets.

---

### Task 3: Update Shared Navigation, Route Art, and GPU Gate

**Files:**
- Modify: `system/nav.js`

**Interfaces:**
- Consumes: `og:image` and `og:image:alt` metadata from each page.
- Produces:
  - `shouldUseDesktopGpuArt(win: Window): boolean`
  - `getRouteArtMetadata(doc: Document): { src: string, alt: string } | null`
  - `mountRouteArt(doc: Document): void`
  - a shared nav brand link that renders `zentropyLabs`

- [ ] **Step 1: Add brand constants, route-art helpers, and GPU capability gate**

In `system/nav.js`, add these definitions near the top after the menu arrays:

```javascript
const BRAND_LABEL = "zentropyLabs";
const BRAND_MARK_SRC = "brand/zentropy-avatar.png";

const DESKTOP_GPU_ART_QUERIES = [
  "(prefers-reduced-motion: reduce)",
  "(pointer: fine)",
  "(min-width: 900px)",
];

function shouldUseDesktopGpuArt(win = window) {
  if (!win || typeof win.matchMedia !== "function") return false;
  const [reducedMotion, finePointer, desktopWidth] = DESKTOP_GPU_ART_QUERIES.map((query) => win.matchMedia(query));
  return !reducedMotion.matches && finePointer.matches && desktopWidth.matches;
}

function normalizeRouteArtSrc(raw, doc) {
  if (!raw) return "";
  try {
    const url = new URL(raw, doc.location ? doc.location.href : window.location.href);
    if (url.hostname === "harperz9.github.io" || url.origin === window.location.origin) return url.pathname;
    return raw;
  } catch {
    return raw;
  }
}

function getRouteArtMetadata(doc = document) {
  const image = doc.querySelector('meta[property="og:image"],meta[name="twitter:image"]');
  const alt = doc.querySelector('meta[property="og:image:alt"]');
  const src = normalizeRouteArtSrc(image && image.getAttribute("content"), doc);
  if (!src || src.includes("/brand/zentropy-logo.png")) return null;
  return { src, alt: (alt && alt.getAttribute("content")) || "" };
}

function mountRouteArt(doc = document) {
  if (!doc || !doc.body || doc.documentElement.dataset.homeShell === "react") return;
  if (doc.querySelector("[data-route-art='mounted']")) return;
  const main = doc.getElementById("main");
  if (!main) return;
  const art = getRouteArtMetadata(doc);
  if (!art) return;

  const figure = doc.createElement("figure");
  figure.className = "route-art";
  figure.dataset.routeArt = "mounted";
  const img = doc.createElement("img");
  img.src = art.src;
  img.alt = art.alt;
  img.loading = "lazy";
  img.decoding = "async";
  figure.appendChild(img);
  const caption = doc.createElement("figcaption");
  caption.textContent = "zentropyLabs / route artifact";
  figure.appendChild(caption);
  main.insertAdjacentElement("afterbegin", figure);
}
```

- [ ] **Step 2: Update the rendered brand link and mobile active-section signal**

Replace the `mount.innerHTML =` brand fragment in `renderNav()` with:

```javascript
  const activeLabel = active ? active.replace(/-/g, " ") : "site";
  mount.innerHTML =
    `<a class="sn-home" href="index.html" aria-label="${BRAND_LABEL} / Project Telos home"><span class="sn-home-field"><canvas class="sn-logo-canvas" aria-hidden="true"></canvas><img class="sn-logo-fallback" src="${BRAND_MARK_SRC}" alt="" width="30" height="30"></span><span class="sn-brand-word">${BRAND_LABEL}</span></a>`
    + `<span class="sn-section" aria-label="Current section">${activeLabel}</span>`
    + `<nav class="sn-links" aria-label="Primary">`
```

Expected: the primary brand word is `zentropyLabs`, the fallback image is the aperture/avatar mark, and a compact current-section label exists for mobile layout.

- [ ] **Step 3: Gate nav logo WebGL and static page field imports**

In `mountHomeLogo(doc)`, call `showFallback()` when `shouldUseDesktopGpuArt(window)` is false:

```javascript
  if (!shouldUseDesktopGpuArt(window)) {
    showFallback();
    return;
  }
```

In the boot block, call `mountRouteArt(document)` before field imports and wrap both heavy imports:

```javascript
    mountRouteArt(document);
    if (document.documentElement.dataset.homeShell !== "react" && shouldUseDesktopGpuArt(window)) {
      import("./generative-field.js").catch(() => {});
      import("./cursor-field.js").then((m) => m.mountCursorField()).catch(() => {});
    }
```

Expected: mobile, coarse-pointer, and reduced-motion users do not import the heavy static field modules.

- [ ] **Step 4: Run the nav contract**

Run:

```powershell
python -m pytest -q tests/test_zentropy_sitewide_contract.py::test_shared_nav_renders_zentropy_brand_and_desktop_gpu_gate
```

Expected: PASS.

- [ ] **Step 5: Commit the shared runtime update**

Run:

```powershell
git add system/nav.js tests/test_zentropy_sitewide_contract.py
git commit -m "brand: update shared Zentropy nav runtime"
```

Expected: commit includes `system/nav.js` and the test only if the test file changed during implementation.

---

### Task 4: Update Main Static Page CSS

**Files:**
- Modify: `system/system.css`

**Interfaces:**
- Consumes: DOM emitted by `system/nav.js`, especially `.sn-brand-word`, `.sn-section`, and `.route-art`.
- Produces: site-wide visual defaults for non-document static pages.

- [ ] **Step 1: Replace contradictory top-level font comments and add the display face**

At the top of `system/system.css`, replace the old comment that says Telos/custom display work was retired with a current Zentropy type comment and add:

```css
@font-face{font-family:"ZentropyDisplay";src:url("../brand/ZentropyDisplay.ttf") format("truetype");font-weight:400;font-style:normal;font-display:swap}
```

Expected: the stylesheet no longer states that custom display work is retired.

- [ ] **Step 2: Add the late Zentropy shell override layer**

Append this block near the end of `system/system.css` after the existing shared page styles:

```css
/* ZentropyLabs site-wide shell (2026-07-19) */
:root{
  --zentropy-void:#070406;
  --zentropy-ink:#eaf5f6;
  --zentropy-ink-2:#c8dcdf;
  --zentropy-muted:#94afb4;
  --zentropy-faint:#678188;
  --zentropy-signal:#8ee3f2;
  --zentropy-rust:#c86a44;
  --zentropy-oxblood:#1e0f14;
  --brand-display:"ZentropyDisplay","Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --display:"Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --body:"Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --void:var(--zentropy-void);
  --void-opaque:var(--zentropy-void);
  --bone:var(--zentropy-ink);
  --orange:var(--zentropy-rust);
  --ember:var(--zentropy-rust);
  --signal:var(--zentropy-signal);
  --muted:var(--zentropy-muted);
  --prussian:var(--zentropy-faint);
  --hairline:rgba(142,227,242,.16);
}

body{
  background:
    radial-gradient(80rem 50rem at 72% -10%,rgba(142,227,242,.11),transparent 58%),
    linear-gradient(180deg,#070406 0%,#0a0709 55%,#12090d 100%);
  color:var(--zentropy-ink);
}

body::before{
  content:"";
  position:fixed;
  inset:0;
  z-index:1;
  pointer-events:none;
  opacity:.33;
  background:
    linear-gradient(180deg,transparent 0 54%,rgba(200,106,68,.18) 54% 90%,transparent 100%),
    repeating-linear-gradient(0deg,rgba(234,245,246,.045) 0 1px,transparent 1px 3px);
  mix-blend-mode:screen;
}
```

Expected: legacy variable names resolve to the Zentropy palette without breaking older selectors.

- [ ] **Step 3: Add shared nav, route-art, and mobile styles**

Append after the token block:

```css
.site-nav{background:rgba(7,4,6,.86);border-bottom:1px solid rgba(142,227,242,.16);backdrop-filter:blur(16px)}
.site-nav .sn-home{gap:.7rem;color:var(--zentropy-ink);font-family:var(--brand-display);font-size:clamp(1.05rem,2vw,1.38rem);font-weight:400;letter-spacing:0;text-transform:none}
.site-nav .sn-home-field{border:1px solid rgba(142,227,242,.22);background:#050305}
.site-nav .sn-logo-fallback{display:block;object-fit:cover;border-radius:0}
.site-nav .sn-brand-word{transform:translateY(.04em)}
.site-nav .sn-section{display:none;font-family:var(--mono);font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--zentropy-muted)}
.site-nav .sn-links a,.site-nav .sn-more summary{color:var(--zentropy-muted)}
.site-nav .sn-links a:hover,.site-nav .sn-more summary:hover,.site-nav .sn-links a[aria-current="page"],.site-nav .sn-more[data-current="true"] summary{color:var(--zentropy-signal);border-color:var(--zentropy-signal)}

.route-art{position:relative;z-index:4;width:min(100% - 2rem,72rem);margin:clamp(1rem,4vw,2.6rem) auto clamp(2rem,5vw,4rem);border:1px solid rgba(142,227,242,.18);background:#080507;overflow:hidden}
.route-art::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,transparent 0 50%,rgba(200,106,68,.22) 58% 100%),repeating-linear-gradient(0deg,rgba(234,245,246,.08) 0 1px,transparent 1px 4px);mix-blend-mode:screen;opacity:.58}
.route-art img{display:block;width:100%;aspect-ratio:1280/430;object-fit:cover}
.route-art figcaption{position:absolute;left:clamp(.85rem,2vw,1.4rem);bottom:clamp(.7rem,1.6vw,1rem);font-family:var(--mono);font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--zentropy-ink);text-shadow:0 1px 16px #000}

@media (max-width:760px){
  .site-nav{display:grid;grid-template-columns:1fr auto;align-items:center;gap:.45rem .75rem;padding:.65rem .8rem}
  .site-nav .sn-home{min-width:0;font-size:1.05rem}
  .site-nav .sn-section{display:block;grid-column:1/2;grid-row:2;color:var(--zentropy-faint)}
  .site-nav .sn-links{display:contents}
  .site-nav .sn-links>a{display:none}
  .site-nav .sn-more{grid-column:2;grid-row:1/span 2;justify-self:end}
  .site-nav .sn-more summary{min-block-size:44px;display:flex;align-items:center}
  .site-nav .sn-more-list{position:fixed;left:.75rem;right:.75rem;top:4.4rem;max-height:calc(100dvh - 5.2rem);overflow:auto}
  .route-art{width:calc(100% - 1rem);margin:1rem auto 2rem}
  .route-art img{aspect-ratio:16/9}
}

@media (prefers-reduced-motion:reduce),(pointer:coarse),(max-width:899px){
  #gl.generative-field-canvas,#motes.generative-motes-canvas{display:none!important}
}
```

Expected: system pages render the new shell and mobile nav without needing per-page markup.

- [ ] **Step 4: Run the shared-style contract**

Run:

```powershell
python -m pytest -q tests/test_zentropy_sitewide_contract.py::test_shared_styles_define_zentropy_material_system
```

Expected: PASS for `system/system.css` only after Task 5 also updates `doc.css`; if this task is run alone, the test still reports the document stylesheet gap.

---

### Task 5: Update Document Page CSS

**Files:**
- Modify: `system/doc.css`

**Interfaces:**
- Consumes: DOM emitted by `system/nav.js`, `.route-art`, and existing `body.doc .sheet` document markup.
- Produces: dark Zentropy screen document shell with print-safe fallback.

- [ ] **Step 1: Replace contradictory top-level font comments and add the display face**

At the top of `system/doc.css`, replace the old comment that says Telos/custom display work was retired with a current Zentropy document-shell comment and add:

```css
@font-face{font-family:"ZentropyDisplay";src:url("../brand/ZentropyDisplay.ttf") format("truetype");font-weight:400;font-style:normal;font-display:swap}
```

Expected: the document stylesheet no longer says Telos Display or Kilon are retired.

- [ ] **Step 2: Add the dark Zentropy document screen layer**

Append this block near the end of `system/doc.css` before print-specific rules if a print block exists; otherwise append at the end:

```css
/* ZentropyLabs document shell (2026-07-19) */
:root{
  --zentropy-void:#070406;
  --zentropy-ink:#eaf5f6;
  --zentropy-ink-2:#c8dcdf;
  --zentropy-muted:#94afb4;
  --zentropy-faint:#678188;
  --zentropy-signal:#8ee3f2;
  --zentropy-rust:#c86a44;
  --zentropy-oxblood:#1e0f14;
  --brand-display:"ZentropyDisplay","Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --display:"Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --body:"Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --page:#0b070a;
  --backdrop:#070406;
  --ink:var(--zentropy-ink);
  --ink-soft:var(--zentropy-ink-2);
  --ink-muted:var(--zentropy-muted);
  --teal:var(--zentropy-ink);
  --teal-soft:var(--zentropy-signal);
  --ember:var(--zentropy-rust);
  --tag:var(--zentropy-faint);
  --rule:rgba(142,227,242,.16);
  --rule-strong:rgba(142,227,242,.28);
}

body.doc{
  background:
    radial-gradient(66rem 38rem at 74% -8%,rgba(142,227,242,.11),transparent 60%),
    linear-gradient(180deg,#070406 0%,#0a0709 60%,#12090d 100%);
  color:var(--zentropy-ink);
}

body.doc::before{
  content:"";
  position:fixed;
  inset:0;
  z-index:0;
  pointer-events:none;
  opacity:.28;
  background:linear-gradient(180deg,transparent 0 55%,rgba(200,106,68,.18) 55% 100%),repeating-linear-gradient(0deg,rgba(234,245,246,.045) 0 1px,transparent 1px 3px);
}

body.doc .docnav,body.doc .sheet,body.doc .route-art{position:relative;z-index:2}
body.doc .sheet{background:rgba(10,7,9,.94);border:1px solid rgba(142,227,242,.16);box-shadow:0 24px 80px -46px rgba(0,0,0,.9);border-radius:0}
body.doc .mast{border-bottom-color:rgba(142,227,242,.22)}
body.doc .mast h1,body.doc h2{color:var(--zentropy-ink)}
body.doc a{color:var(--zentropy-signal)}
body.doc .entry-meta,body.doc ul.bul .num{color:var(--zentropy-rust)}

body.doc .route-art{width:min(100%,50rem);margin:0 auto clamp(1rem,2.4vw,1.6rem);border:1px solid rgba(142,227,242,.18);background:#080507;overflow:hidden}
body.doc .route-art img{display:block;width:100%;aspect-ratio:1280/430;object-fit:cover}
body.doc .route-art figcaption{position:absolute;left:1rem;bottom:.8rem;font-family:var(--mono);font-size:.58rem;letter-spacing:.12em;text-transform:uppercase;color:var(--zentropy-ink);text-shadow:0 1px 16px #000}

@media (max-width:760px){
  body.doc{padding:.7rem}
  body.doc .sheet{padding:clamp(1.25rem,5vw,2rem)}
  body.doc .route-art img{aspect-ratio:16/9}
}
```

- [ ] **Step 3: Preserve print readability**

Add or update the print block:

```css
@media print{
  body.doc{background:#fff;color:#000;padding:0}
  body.doc::before,.site-nav,.route-art,#gl,#motes{display:none!important}
  body.doc .sheet{background:#fff;color:#000;border:0;box-shadow:none}
}
```

Expected: screen documents use the dark Zentropy shell, while print output remains high-contrast and avoids decorative route art.

- [ ] **Step 4: Run the shared-style contract**

Run:

```powershell
python -m pytest -q tests/test_zentropy_sitewide_contract.py::test_shared_styles_define_zentropy_material_system
```

Expected: PASS.

- [ ] **Step 5: Commit shared styles**

Run:

```powershell
git add system/system.css system/doc.css
git commit -m "brand: apply Zentropy shared page styles"
```

Expected: commit includes only the shared CSS files.

---

### Task 6: Refresh Shared Asset Cache Strings

**Files:**
- Modify: selected `*.html` files that import `system/nav.js`, `system/system.css`, or `system/doc.css`

**Interfaces:**
- Consumes: existing static HTML pages.
- Produces: pages pointing at `v=20260719-zentropy-sitewide` for the changed shared CSS/JS resources.

- [ ] **Step 1: Run a mechanical cache-string update**

Run from `C:/dev/public/portfolio-site`:

```powershell
$version = "20260719-zentropy-sitewide"
Get-ChildItem -Path . -Filter *.html -Recurse | Where-Object {
  $_.FullName -notmatch '\\\.git\\|\\home\\node_modules\\|\\home\\dist\\'
} | ForEach-Object {
  $path = $_.FullName
  $text = [System.IO.File]::ReadAllText($path)
  $updated = $text `
    -replace 'system/nav\.js\?v=[^"]+', "system/nav.js?v=$version" `
    -replace 'system/system\.css\?v=[^"]+', "system/system.css?v=$version" `
    -replace 'system/doc\.css\?v=[^"]+', "system/doc.css?v=$version"
  if ($updated -ne $text) {
    [System.IO.File]::WriteAllText($path, $updated, [System.Text.UTF8Encoding]::new($false))
  }
}
```

Expected: only HTML pages that already reference the changed shared assets are modified.

- [ ] **Step 2: Check representative metadata still resolves**

Run:

```powershell
python -m pytest -q tests/test_zentropy_sitewide_contract.py::test_representative_pages_keep_route_art_metadata
```

Expected: PASS.

- [ ] **Step 3: Inspect the HTML diff scope**

Run:

```powershell
git diff --name-only -- '*.html'
git diff --check
```

Expected: HTML diffs are cache-string-only unless a page needed metadata repair. `git diff --check` exits 0.

- [ ] **Step 4: Commit cache-string updates**

Run:

```powershell
git add -- '*.html'
git commit -m "chore: refresh Zentropy shared asset versions"
```

Expected: commit includes only intended HTML cache-string changes.

---

### Task 7: Local Verification, Visual Inspection, Commit Hygiene, and Publish

**Files:**
- No planned source file changes unless verification reveals a defect.

**Interfaces:**
- Consumes: the completed implementation from Tasks 1-6.
- Produces: verified local site, pushed `main`, and confirmed GitHub Pages build for the pushed commit.

- [ ] **Step 1: Run full Python contract suite**

Run:

```powershell
python -m pytest -q
```

Expected: all tests pass. If any test fails, fix the implementation and rerun the full command.

- [ ] **Step 2: Run home build only if home source or generated root assets changed**

If `git diff --name-only HEAD~1..HEAD` or current worktree changes include `home/`, `index.html`, or `assets/`, run:

```powershell
Set-Location C:\dev\public\portfolio-site\home
npm.cmd run build
```

Expected: build exits 0. If home was untouched, record that this step is not applicable.

- [ ] **Step 3: Run whitespace and source diff checks**

Run:

```powershell
git diff --check
git status --short
```

Expected: diff check exits 0. Status shows only intended implementation files plus the pre-existing untracked `docs/superpowers/plans/2026-07-12-evidence-led-home.md` if it remains untracked.

- [ ] **Step 4: Serve and inspect desktop/mobile pages**

Start a local server:

```powershell
Set-Location C:\dev\public\portfolio-site
$server = Start-Process -FilePath npx.cmd -ArgumentList @("serve","-l","8765",".") -WindowStyle Hidden -PassThru
```

Open these pages at desktop and mobile widths with Playwright/Chrome:

```text
http://127.0.0.1:8765/
http://127.0.0.1:8765/overview.html
http://127.0.0.1:8765/research.html
http://127.0.0.1:8765/forum.html
http://127.0.0.1:8765/proof-surface-sample.html
```

Expected desktop results:
- nav brand reads `zentropyLabs`
- route art appears on static pages that have `og:image`
- system pages and doc pages use the Zentropy palette, not purple/lime defaults
- text remains readable and does not overlap route art

Expected mobile results:
- nav does not cram all primary links into one row
- page content has no horizontal document scroll
- `generative-field.js`, `cursor-field.js`, and nav logo WebGL do not load
- static artwork and text remain visible

Stop the server when inspection is finished:

```powershell
Stop-Process -Id $server.Id
```

- [ ] **Step 5: Run link checker on its hardcoded port**

Start a link-check server:

```powershell
Set-Location C:\dev\public\portfolio-site
$linkServer = Start-Process -FilePath npx.cmd -ArgumentList @("serve","-l","8802",".") -WindowStyle Hidden -PassThru
node tests/linkcheck.mjs
Stop-Process -Id $linkServer.Id
```

Expected: command reports checked internal links with `0 broken`.

- [ ] **Step 6: Scan changed/staged files for credential-shaped content**

Run:

```powershell
git diff --name-only HEAD | ForEach-Object {
  Select-String -Path $_ -Pattern '(?i)(api[_-]?key|password|passwd|private[_-]?key|BEGIN (RSA|OPENSSH|EC|DSA|PRIVATE) KEY|ghp_|github_pat_|sk-[A-Za-z0-9])' -ErrorAction SilentlyContinue
}
```

Expected: no credential-shaped matches. If a false positive appears, inspect the line and record it.

- [ ] **Step 7: Commit final implementation if uncommitted changes remain**

Run:

```powershell
git add system/nav.js system/system.css system/doc.css brand/zentropy-avatar.png brand/ZentropyDisplay.ttf img/og tests '*.html'
git commit -m "brand: align static site with ZentropyLabs"
```

Expected: commit succeeds if implementation changes remain. If all prior tasks already committed everything, this step is not applicable.

- [ ] **Step 8: Push and verify publish**

Run:

```powershell
git push origin main
git rev-parse HEAD
```

Use `gh` or GitHub's API to verify the GitHub Pages build for the pushed commit reaches a terminal success/built state. The expected published URL is:

```text
https://harperz9.github.io/
```

Expected: remote `main` contains the final commit and GitHub Pages reports the pushed commit as built.

- [ ] **Step 9: Final completion audit**

Check the approved spec requirements one by one against current evidence:

```powershell
git status --short --branch
python -m pytest -q
git diff --check
```

Also inspect the live pages after publish for the same desktop/mobile representative set from Step 4. Only mark the goal complete after current local and live evidence proves the site-wide branding, artwork, typography, mobile shader gate, and publish requirements.
