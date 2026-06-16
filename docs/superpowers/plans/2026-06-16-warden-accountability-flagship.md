# WARDEN Accountability Flagship Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a high-caliber static WARDEN flagship page that frames WARDEN as an accountability engine while keeping private internals protected.

**Architecture:** Add one static `warden.html` page that reuses the portfolio site's existing typography, glass material, navigation, and responsive shell. Extend `styles.css` with WARDEN-specific page components, then wire the page into `index.html`, `README.md`, and visual contract tests.

**Tech Stack:** Static HTML, CSS, pytest, GitHub Pages, local Python HTTP server, Browser or Playwright viewport checks.

---

## Files

- Create: `C:\dev\public\portfolio-site\warden.html` - the public WARDEN accountability flagship page.
- Modify: `C:\dev\public\portfolio-site\styles.css` - WARDEN hero, loop, lanes, boundary, and repo surface styles.
- Modify: `C:\dev\public\portfolio-site\index.html` - portfolio navigation and WARDEN entry points.
- Modify: `C:\dev\public\portfolio-site\README.md` - documentation for the new page and public lineup.
- Modify: `C:\dev\public\portfolio-site\tests\test_portfolio_visual_contract.py` - tests for WARDEN page content, public/private boundary, repo links, and portfolio wiring.
- Read only: `C:\dev\public\portfolio-site\docs\superpowers\specs\2026-06-16-warden-accountability-flagship-design.md` - approved design spec.

## Task 1: Add Failing WARDEN Contract Tests

**Files:**
- Modify: `C:\dev\public\portfolio-site\tests\test_portfolio_visual_contract.py`

- [ ] **Step 1: Add WARDEN constants and helpers**

Insert `WARDEN = ROOT / "warden.html"` below the existing `STYLES` constant:

```python
WARDEN = ROOT / "warden.html"
```

Insert these helpers below `page_source()`:

```python
def index_source() -> str:
    return INDEX.read_text(encoding="utf-8")


def warden_source() -> str:
    assert WARDEN.exists(), "warden.html must exist"
    return WARDEN.read_text(encoding="utf-8") + "\n" + STYLES.read_text(encoding="utf-8")
```

- [ ] **Step 2: Add WARDEN page tests**

Append these tests to the bottom of `tests/test_portfolio_visual_contract.py`:

```python
def test_warden_flagship_page_exists_and_has_thesis() -> None:
    source = warden_source()

    assert "Claims should leave a trail" in source
    assert "accountability engine for agent-assisted work" in source
    assert "Accountability is the product" in source
    assert '<body class="warden-page">' in source
    assert "font-size:clamp" not in source
    assert "letter-spacing:-" not in source


def test_warden_public_private_boundary_is_explicit() -> None:
    source = warden_source()

    assert "Public surface" in source
    assert "Private core" in source
    assert (
        "Private internals, credentials, client data, operational details, and sensitive workflows are not exposed."
        in source
    )
    for overclaim in [
        "certified",
        "certification",
        "regulatory approval",
        "customer deployment",
        "production trust status",
    ]:
        assert overclaim not in source.lower()


def test_warden_links_public_accountability_repos() -> None:
    source = warden_source()

    for repo in [
        "https://github.com/HarperZ9/warden-reporting",
        "https://github.com/HarperZ9/warden-algorithms",
        "https://github.com/HarperZ9/warden-anomaly",
        "https://github.com/HarperZ9/public-surface-sweeper",
        "https://github.com/HarperZ9/model-provenance-validator",
        "https://github.com/HarperZ9/repo-proof-index",
        "https://github.com/HarperZ9/gpu-trace-validator",
        "https://github.com/HarperZ9/emet",
    ]:
        assert repo in source


def test_portfolio_links_to_warden_flagship() -> None:
    source = index_source()

    assert 'href="warden.html"' in source
    assert "WARDEN overview" in source
    assert "Accountability engine" in source
```

- [ ] **Step 3: Run the targeted test and verify it fails for the missing page**

Run:

```powershell
python -m pytest -q tests\test_portfolio_visual_contract.py
```

Expected output includes:

```text
FAILED tests/test_portfolio_visual_contract.py::test_warden_flagship_page_exists_and_has_thesis
FAILED tests/test_portfolio_visual_contract.py::test_warden_public_private_boundary_is_explicit
FAILED tests/test_portfolio_visual_contract.py::test_warden_links_public_accountability_repos
FAILED tests/test_portfolio_visual_contract.py::test_portfolio_links_to_warden_flagship
```

## Task 2: Create `warden.html`

**Files:**
- Create: `C:\dev\public\portfolio-site\warden.html`

- [ ] **Step 1: Create the static WARDEN page**

Create `warden.html` with this complete content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WARDEN - Accountability Engine</title>
<meta name="description" content="WARDEN is an accountability engine for agent-assisted work: evidence, provenance, reporting, anomaly review, and human ownership held in one system.">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='8' fill='%231d1d1f'/%3E%3Cpath d='M14 34h36M20 22h24M20 46h24' stroke='%23fff' stroke-width='5' stroke-linecap='round'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
</head>
<body class="warden-page">
<a class="skip-link" href="#main">Skip to content</a>
<div class="bg"></div>
<div class="grain"></div>
<div class="bloom"></div>

<nav aria-label="Primary">
  <div class="nav-in">
    <a class="brand" href="index.html">WARDEN</a>
    <div class="nav-links">
      <a href="#accountability">Accountability</a>
      <a href="#lanes">Lanes</a>
      <a href="#boundary">Boundary</a>
      <a href="#surface">Surface</a>
      <a href="index.html">Portfolio</a>
      <a href="https://github.com/HarperZ9">GitHub</a>
    </div>
  </div>
</nav>

<header id="top" class="warden-hero shell g12">
  <div class="warden-hero-copy">
    <p class="kicker">accountability engine &middot; public proof surface</p>
    <h1>Claims should leave a trail<span class="grad">.</span></h1>
    <p class="lead warden-lead">WARDEN is an accountability engine for agent-assisted work: evidence, provenance, reporting, anomaly review, and human ownership held in one system.</p>
    <div class="cta">
      <a class="btn solid" href="#surface">Public surface</a>
      <a class="btn" href="#boundary">Private boundary</a>
      <a class="btn" href="index.html">Portfolio</a>
    </div>
  </div>
  <aside class="accountability-loop glass" aria-label="WARDEN accountability loop">
    <div class="loop-head">
      <span>WARDEN loop</span>
      <strong>Human-owned</strong>
    </div>
    <ol>
      <li><span>01</span><strong>Claim captured</strong><em>state the thing being asserted</em></li>
      <li><span>02</span><strong>Evidence attached</strong><em>link receipts, tests, samples, or reports</em></li>
      <li><span>03</span><strong>Provenance checked</strong><em>validate source, model, or release records</em></li>
      <li><span>04</span><strong>Anomaly reviewed</strong><em>separate drift from noise</em></li>
      <li><span>05</span><strong>Report handed off</strong><em>make reviewable findings</em></li>
      <li><span>06</span><strong>Human ownership</strong><em>keep decisions accountable</em></li>
    </ol>
  </aside>
  <div class="warden-stats">
    <div class="stat glass" aria-label="Five accountability lanes"><div class="n">5</div><div class="l">Accountability lanes</div></div>
    <div class="stat glass" aria-label="Three public WARDEN packages"><div class="n">3</div><div class="l">WARDEN packages</div></div>
    <div class="stat glass" aria-label="One EMET witness primitive"><div class="n">EMET</div><div class="l">Witness primitive</div></div>
    <div class="stat glass" aria-label="Private core is protected"><div class="n">Core</div><div class="l">Private by design</div></div>
  </div>
</header>

<main id="main">
<section id="accountability" class="shell" aria-labelledby="accountability-heading">
  <div class="sec-head"><p class="kicker">Accountability</p><h2 id="accountability-heading">A system for keeping claims inspectable.</h2></div>
  <div class="feats g12">
    <article class="feat a glass sheen" data-glow>
      <span class="idx">01</span>
      <div class="role">Claim discipline</div>
      <h3>Short statements. Visible receipts.</h3>
      <p>WARDEN treats public claims as things that need evidence, maturity labels, and handoff context. The public pieces stay narrow enough to inspect.</p>
      <div class="chips"><span class="chip">claims</span><span class="chip">receipts</span><span class="chip">maturity labels</span></div>
    </article>
    <article class="feat b glass sheen" data-glow>
      <span class="idx">02</span>
      <div class="role">Review workflow</div>
      <h3>Evidence becomes a report.</h3>
      <p>The loop moves from surface inspection to provenance checks, proof indexing, anomaly review, and human-readable reporting.</p>
      <div class="chips"><span class="chip">surface</span><span class="chip">provenance</span><span class="chip">proof</span><span class="chip">report</span></div>
    </article>
  </div>
</section>

<section id="lanes" class="shell" aria-labelledby="lanes-heading">
  <div class="sec-head"><p class="kicker">Public proof lanes</p><h2 id="lanes-heading">Where the public work points.</h2></div>
  <div class="warden-lanes">
    <article class="lane glass"><span>01</span><h3>Evidence</h3><p>Gather claims, artifacts, release notes, samples, and test signals into a reviewable packet.</p></article>
    <article class="lane glass"><span>02</span><h3>Provenance</h3><p>Check model, release, and workflow records before they become public proof.</p></article>
    <article class="lane glass"><span>03</span><h3>Reporting</h3><p>Turn findings into plain-language reports that preserve the trail without exposing sensitive internals.</p></article>
    <article class="lane glass"><span>04</span><h3>Anomaly review</h3><p>Flag drift, missing context, and unexpected behavior for human review.</p></article>
    <article class="lane glass"><span>05</span><h3>Agent workflow</h3><p>Keep agent-assisted work owned by a human operator with scope, tests, and audit evidence visible.</p></article>
  </div>
</section>

<section id="boundary" class="band warden-boundary" aria-labelledby="boundary-heading">
  <div class="shell g12">
    <div class="boundary-copy">
      <p class="kicker band-kicker">Public/private boundary</p>
      <h2 id="boundary-heading">Present the system. Protect the core.</h2>
      <p>WARDEN has a larger private body of work. The public surface shows reporting, algorithms, anomaly primitives, witness behavior, and proof tooling.</p>
    </div>
    <div class="boundary-panel glass">
      <div><span>Public surface</span><p>Repos, sample artifacts, evidence patterns, reports, and maturity labels.</p></div>
      <div><span>Private core</span><p>Private internals, credentials, client data, operational details, and sensitive workflows are not exposed.</p></div>
    </div>
  </div>
</section>

<section id="surface" class="shell" aria-labelledby="surface-heading">
  <div class="sec-head"><p class="kicker">Repository surface</p><h2 id="surface-heading">The inspectable edge of WARDEN.</h2></div>
  <div class="repo-grid">
    <a class="repo-pill glass" href="https://github.com/HarperZ9/warden-reporting"><span>WARDEN</span><strong>warden-reporting</strong><em>evidence chains and reviewer handoff</em></a>
    <a class="repo-pill glass" href="https://github.com/HarperZ9/warden-algorithms"><span>WARDEN</span><strong>warden-algorithms</strong><em>public algorithms and scoring primitives</em></a>
    <a class="repo-pill glass" href="https://github.com/HarperZ9/warden-anomaly"><span>WARDEN</span><strong>warden-anomaly</strong><em>anomaly review primitives</em></a>
    <a class="repo-pill glass" href="https://github.com/HarperZ9/public-surface-sweeper"><span>Surface</span><strong>public-surface-sweeper</strong><em>claim and release-surface checks</em></a>
    <a class="repo-pill glass" href="https://github.com/HarperZ9/model-provenance-validator"><span>Provenance</span><strong>model-provenance-validator</strong><em>model record validation</em></a>
    <a class="repo-pill glass" href="https://github.com/HarperZ9/repo-proof-index"><span>Proof</span><strong>repo-proof-index</strong><em>artifact and receipt indexing</em></a>
    <a class="repo-pill glass" href="https://github.com/HarperZ9/gpu-trace-validator"><span>Trace</span><strong>gpu-trace-validator</strong><em>GPU trace evidence checks</em></a>
    <a class="repo-pill glass" href="https://github.com/HarperZ9/emet"><span>Witness</span><strong>EMET</strong><em>source/view integrity primitive</em></a>
  </div>
</section>

<section class="shell warden-close" aria-labelledby="close-heading">
  <p class="kicker">Position</p>
  <h2 id="close-heading">Accountability is the product.</h2>
  <p>WARDEN is the body of work underneath the public proof tools: a way to make agent-assisted systems more inspectable, more honest about their limits, and easier to hand to a real reviewer.</p>
  <div class="cta">
    <a class="btn solid" href="mailto:zaindharper@gmail.com">Discuss WARDEN</a>
    <a class="btn" href="index.html">Back to portfolio</a>
  </div>
</section>
</main>

<footer class="shell">
  <div class="foot-big">Claims. Evidence. Ownership.</div>
  <div class="foot-cta">
    <a class="btn solid" href="index.html">Zain Dana Harper</a>
    <a class="btn" href="https://github.com/HarperZ9">github.com/HarperZ9</a>
  </div>
  <p class="muted">Static public page. Private internals stay private.</p>
</footer>

<script>
  (function(){
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if(!window.matchMedia('(pointer:fine)').matches) return;
    document.querySelectorAll('.glass.sheen').forEach(function(c){
      c.addEventListener('pointermove', function(e){
        var r=c.getBoundingClientRect();
        c.style.setProperty('--mx',(e.clientX-r.left)+'px');
        c.style.setProperty('--my',(e.clientY-r.top)+'px');
      },{passive:true});
    });
  })();
</script>
</body>
</html>
```

- [ ] **Step 2: Run the WARDEN thesis test**

Run:

```powershell
python -m pytest -q tests\test_portfolio_visual_contract.py::test_warden_flagship_page_exists_and_has_thesis
```

Expected output:

```text
1 passed
```

## Task 3: Add WARDEN Visual Styles

**Files:**
- Modify: `C:\dev\public\portfolio-site\styles.css`

- [ ] **Step 1: Append WARDEN styles before the first `@media` block**

Insert this CSS after the existing `.muted` rule and before `@media(max-width:940px)`:

```css
.warden-page .brand::after{background:radial-gradient(circle at 35% 30%,#fff 0 11%,#dce9ff 25%,#714226 100%); box-shadow:0 0 26px rgba(148,173,210,.58)}
.warden-hero{padding-top:clamp(3rem,5vw,5rem); padding-bottom:clamp(2.5rem,5vw,4.5rem); row-gap:1.15rem; align-items:start}
.warden-hero-copy{grid-column:1/7; padding-top:.4rem}
.warden-hero h1{font-size:4.55rem; max-width:10.5ch; margin:.2rem 0 .8rem}
.warden-lead{max-width:50ch}
.accountability-loop{grid-column:8/13; padding:1.05rem; overflow:hidden}
.loop-head{display:flex; justify-content:space-between; gap:1rem; align-items:center; padding:.25rem .2rem .85rem; border-bottom:1px solid var(--rule); font-family:var(--mono); font-size:.76rem; color:var(--ink-muted)}
.loop-head strong{color:var(--orange-deep); font-weight:700}
.accountability-loop ol{list-style:none; display:grid; gap:.48rem; margin-top:.85rem}
.accountability-loop li{display:grid; grid-template-columns:2.1rem 1fr; column-gap:.75rem; padding:.72rem .68rem; border-radius:var(--r); background:rgba(255,255,255,.58); border:1px solid rgba(23,24,28,.09)}
.accountability-loop li span{grid-row:1/3; font-family:var(--mono); font-size:.76rem; font-weight:700; color:var(--orange-deep)}
.accountability-loop li strong{font-family:var(--display); font-size:1rem; line-height:1.1}
.accountability-loop li em{font-family:var(--body); font-style:normal; color:var(--ink-muted); font-size:.88rem; line-height:1.35}
.warden-stats{grid-column:1/-1; display:grid; grid-template-columns:repeat(4,1fr); gap:.85rem; margin-top:.8rem}
.warden-lanes{display:grid; grid-template-columns:repeat(5,1fr); gap:.85rem}
.lane{padding:1.15rem; min-height:14rem}
.lane span,.repo-pill span{font-family:var(--mono); font-size:.75rem; font-weight:700; color:var(--orange-deep)}
.lane h3{font-size:1.35rem; margin:.75rem 0 .7rem}
.lane p{color:var(--ink-muted); font-size:.98rem; line-height:1.55}
.warden-boundary .shell{align-items:center; row-gap:1.4rem}
.boundary-copy{grid-column:1/7}
.boundary-copy h2{font-size:3.05rem; max-width:11ch; margin:.7rem 0 1rem}
.boundary-copy p:last-child{color:var(--ink-muted); max-width:52ch}
.boundary-panel{grid-column:8/13; padding:1.1rem; display:grid; gap:.75rem}
.boundary-panel div{padding:1rem; background:rgba(255,255,255,.6); border:1px solid rgba(23,24,28,.09); border-radius:var(--r)}
.boundary-panel span{font-family:var(--mono); font-size:.76rem; font-weight:700; color:var(--orange-deep); text-transform:uppercase}
.boundary-panel p{color:var(--ink-muted); margin-top:.45rem; line-height:1.55}
.repo-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:.85rem}
.repo-pill{display:flex; min-height:11rem; flex-direction:column; gap:.55rem; padding:1.05rem; text-decoration:none; transition:transform .3s var(--ease), box-shadow .3s var(--ease)}
.repo-pill:hover{transform:translateY(-3px); box-shadow:var(--glass-shadow-hi); opacity:1}
.repo-pill strong{font-family:var(--display); font-size:1.1rem; line-height:1.15}
.repo-pill em{font-style:normal; color:var(--ink-muted); font-size:.9rem; line-height:1.45}
.warden-close h2{font-size:3.2rem; max-width:12ch; margin:.7rem 0 1rem}
.warden-close p:not(.kicker){color:var(--ink-muted); max-width:58ch}
```

- [ ] **Step 2: Extend responsive rules**

Inside `@media(max-width:940px)`, add this line before the closing brace:

```css
  .warden-hero-copy,.accountability-loop,.boundary-copy,.boundary-panel{grid-column:1/-1}
  .warden-hero h1{font-size:3.45rem}
  .warden-stats{grid-template-columns:repeat(2,1fr)}
  .warden-lanes,.repo-grid{grid-template-columns:repeat(2,1fr)}
```

Inside `@media(max-width:640px)`, add this line before the closing brace:

```css
  .warden-hero{padding-top:1.35rem}
  .warden-hero h1{font-size:2.36rem}
  .accountability-loop{padding:.85rem}
  .accountability-loop li{grid-template-columns:1.8rem 1fr; padding:.62rem}
  .warden-stats,.warden-lanes,.repo-grid{grid-template-columns:1fr}
  .lane{min-height:auto}
  .boundary-copy h2,.warden-close h2{font-size:2.15rem}
```

- [ ] **Step 3: Run WARDEN page tests**

Run:

```powershell
python -m pytest -q tests\test_portfolio_visual_contract.py::test_warden_flagship_page_exists_and_has_thesis tests\test_portfolio_visual_contract.py::test_warden_public_private_boundary_is_explicit tests\test_portfolio_visual_contract.py::test_warden_links_public_accountability_repos
```

Expected output:

```text
3 passed
```

## Task 4: Wire WARDEN Into Portfolio And README

**Files:**
- Modify: `C:\dev\public\portfolio-site\index.html`
- Modify: `C:\dev\public\portfolio-site\README.md`

- [ ] **Step 1: Add WARDEN to portfolio navigation and hero CTAs**

In `index.html`, inside `.nav-links`, insert this link after the `Lineup` link:

```html
      <a href="warden.html">WARDEN</a>
```

In the hero `.cta`, insert this link before the QuantaLang link:

```html
      <a class="btn" href="warden.html">WARDEN</a>
```

- [ ] **Step 2: Add WARDEN overview to the current-state toolchain map**

In the Toolchain map links, insert the WARDEN overview before `warden-reporting`:

```html
<a href="warden.html">WARDEN overview</a>
```

The final links line in that article should contain:

```html
      <div class="links"><a href="https://github.com/HarperZ9/public-surface-sweeper">public-surface-sweeper</a><a href="https://github.com/HarperZ9/model-provenance-validator">model-provenance-validator</a><a href="https://github.com/HarperZ9/repo-proof-index">repo-proof-index</a><a href="warden.html">WARDEN overview</a><a href="https://github.com/HarperZ9/warden-reporting">warden-reporting</a><a href="https://github.com/HarperZ9/emet">EMET</a></div>
```

- [ ] **Step 3: Update the public lineup WARDEN row**

Replace the current WARDEN row state:

```html
          <td>Public reporting, algorithm, and anomaly primitives from private tooling.</td>
```

with:

```html
          <td><a href="warden.html">Accountability engine</a> with public reporting, algorithm, and anomaly primitives from private tooling.</td>
```

- [ ] **Step 4: Link the Evidence systems direction to WARDEN**

Replace the Evidence systems link:

```html
      <div class="lk"><a href="https://github.com/HarperZ9/warden-reporting">GitHub</a></div>
```

with:

```html
      <div class="lk"><a href="warden.html">WARDEN</a></div>
```

- [ ] **Step 5: Update README files list and public lineup**

In `README.md`, insert this bullet after the `index.html` bullet:

```markdown
- `warden.html` - WARDEN accountability flagship page.
```

Replace the WARDEN public packages row:

```markdown
| WARDEN public packages | `warden-reporting`, `warden-algorithms`, `warden-anomaly` | Public reporting, algorithm, and anomaly primitives from private tooling. |
```

with:

```markdown
| WARDEN public packages | `warden.html`, `warden-reporting`, `warden-algorithms`, `warden-anomaly` | Accountability engine page plus public reporting, algorithm, and anomaly primitives from private tooling. |
```

Replace this verification bullet:

```markdown
- Local sample links resolve.
```

with:

```markdown
- Local sample links and `warden.html` resolve.
```

- [ ] **Step 6: Run the portfolio link test**

Run:

```powershell
python -m pytest -q tests\test_portfolio_visual_contract.py::test_portfolio_links_to_warden_flagship
```

Expected output:

```text
1 passed
```

## Task 5: Verify The Site And Visual Caliber

**Files:**
- Verify: `C:\dev\public\portfolio-site\warden.html`
- Verify: `C:\dev\public\portfolio-site\index.html`
- Verify: `C:\dev\public\portfolio-site\styles.css`
- Verify: `C:\dev\public\portfolio-site\README.md`
- Verify: `C:\dev\public\portfolio-site\tests\test_portfolio_visual_contract.py`

- [ ] **Step 1: Run the targeted portfolio test suite**

Run:

```powershell
python -m pytest -q tests\test_portfolio_visual_contract.py
```

Expected output:

```text
17 passed
```

- [ ] **Step 2: Run whitespace diff validation**

Run:

```powershell
git diff --check
```

Expected output: no output and exit code `0`.

- [ ] **Step 3: Serve the site locally**

Run:

```powershell
$server = Start-Process -FilePath python -ArgumentList '-m','http.server','8765' -WorkingDirectory 'C:\dev\public\portfolio-site' -WindowStyle Hidden -PassThru
$server.Id
```

Expected output: a numeric process id.

- [ ] **Step 4: Inspect desktop viewport**

Use Browser or Playwright to open:

```text
http://127.0.0.1:8765/warden.html
```

Set viewport to `1440x1000`. Expected visual result:

- First viewport shows WARDEN, the headline "Claims should leave a trail.", the lead sentence, CTAs, and the accountability-loop panel.
- The loop panel is readable and not cropped.
- Buttons do not wrap awkwardly.
- No text overlaps.
- The page feels like the existing portfolio system, with a stronger formal WARDEN identity.

- [ ] **Step 5: Inspect mobile viewport**

Use Browser or Playwright on the same URL with viewport `390x844`. Expected visual result:

- Nav collapses to brand-only, matching the portfolio behavior.
- Hero headline, lead, CTAs, loop panel, and stat tiles stack cleanly.
- No horizontal scrolling.
- No button or card text overflows.
- Boundary language is visible without feeling like small print.

- [ ] **Step 6: Stop the local server**

Run:

```powershell
Stop-Process -Id $server.Id
```

Expected output: no output and the server process ends.

## Task 6: Stage, Scan, Commit, Push, And Sync Clones

**Files:**
- Stage: `C:\dev\public\portfolio-site\warden.html`
- Stage: `C:\dev\public\portfolio-site\styles.css`
- Stage: `C:\dev\public\portfolio-site\index.html`
- Stage: `C:\dev\public\portfolio-site\README.md`
- Stage: `C:\dev\public\portfolio-site\tests\test_portfolio_visual_contract.py`

- [ ] **Step 1: Stage the implementation**

Run:

```powershell
git add warden.html styles.css index.html README.md tests\test_portfolio_visual_contract.py
```

Expected output: no output.

- [ ] **Step 2: Run staged diff validation**

Run:

```powershell
git diff --cached --check
```

Expected output: no output and exit code `0`.

- [ ] **Step 3: Run staged secret-shape scan**

Run:

```powershell
$diff = git diff --cached
$matches = $diff | Select-String -Pattern '(?i)(api[_-]?key|client[_-]?secret|secret|token|password|passwd|authorization|bearer)\s*[:=]\s*[''"]?[^''"<>{}\s]{16,}'
if ($matches) {
  $matches | ForEach-Object { $_.Line }
  exit 1
} else {
  'No secret-shaped assignments found in staged diff.'
}
```

Expected output:

```text
No secret-shaped assignments found in staged diff.
```

- [ ] **Step 4: Commit the WARDEN page**

Run:

```powershell
git commit -m "site: add WARDEN accountability flagship"
```

Expected output includes:

```text
[main
 site: add WARDEN accountability flagship
```

- [ ] **Step 5: Push the portfolio site**

Run:

```powershell
git push origin main
```

Expected output includes one of:

```text
To github.com:HarperZ9/HarperZ9.github.io.git
```

or:

```text
Everything up-to-date
```

- [ ] **Step 6: Fast-forward local duplicate portfolio clones**

Run:

```powershell
foreach ($repo in @('C:\dev\public\sitefix','C:\dev\public\pubscan\HarperZ9.github.io')) {
  if (Test-Path (Join-Path $repo '.git')) {
    git -C $repo fetch origin
    git -C $repo merge --ff-only origin/main
    git -C $repo status --short --branch
  }
}
```

Expected output for each existing clone includes:

```text
Already up to date.
## main...origin/main
```

## Task 7: Final Status Sweep

**Files:**
- Verify: `C:\dev\public\portfolio-site`
- Verify: `C:\dev\public\sitefix`
- Verify: `C:\dev\public\pubscan\HarperZ9.github.io`

- [ ] **Step 1: Confirm the main repo is clean**

Run:

```powershell
git -C C:\dev\public\portfolio-site status --short --branch
```

Expected output:

```text
## main...origin/main
```

- [ ] **Step 2: Confirm WARDEN page is reachable from local file paths**

Run:

```powershell
Test-Path C:\dev\public\portfolio-site\warden.html
```

Expected output:

```text
True
```

- [ ] **Step 3: Record completion evidence for the user**

Summarize:

- Test command and pass count.
- `git diff --check` status.
- Staged secret scan result.
- Browser or Playwright desktop and mobile visual checks.
- Commit hash and push result.
