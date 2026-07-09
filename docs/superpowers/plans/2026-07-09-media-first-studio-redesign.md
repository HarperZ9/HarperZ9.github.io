# Media-First Studio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `studio.html` as a media-first art and perception instrument where the canvas and live measurements dominate, while verification remains available as secondary receipts.

**Architecture:** Preserve existing Studio JavaScript bindings by keeping all current IDs and source blocks, but change the shell hierarchy and CSS emphasis. The HTML gains a media-first class, a compact source rail, a canvas-led center, a Live Perception side panel, and collapsed Receipts/Chat areas. CSS overrides near the bottom of `system/system.css` own the final Studio layout so earlier legacy rules do not win.

**Tech Stack:** Static HTML, CSS cascade in `system/system.css`, existing vanilla JS modules in `system/studio.js`, Python pytest visual contract tests, Node test runner, local Chrome/DevTools QA.

## Global Constraints

- Scope: `studio.html`, `system/system.css`, and narrowly related Studio tests/checks.
- Do not rewrite Studio engines or rendering logic.
- Do not remove certificate, audit, export, or model-connect capabilities.
- Do not split Studio into multiple public pages in this pass.
- Leave existing IDs intact so `system/studio.js` continues to bind controls.
- Avoid renaming IDs used by JavaScript.
- Keep desktop and mobile layouts usable without horizontal scroll.
- Existing Studio scripts must load without console errors when served with correct `.mjs` MIME type.
- Verification, certificates, audit trail, and project-stack content move out of the primary path.

---

### Task 1: Studio HTML Reframe

**Files:**
- Modify: `studio.html`
- Test: `tests/test_portfolio_visual_contract.py`

**Interfaces:**
- Consumes: existing IDs `studio-source`, `studio-rail`, `studio-viewport`, `render-toolbar`, `engine-statusbar`, `studio-panel`, `studio-frame`, `sc-meters`, `sc-certificate`, `project-telos-features`, `chat-dock`.
- Produces: classes `studio-media-first`, `studio-mode-strip`, `studio-primary-stage`, `studio-perception-panel`, `studio-receipts`, and `studio-chat-drawer` for CSS and tests.

- [ ] **Step 1: Add failing layout-contract assertions**

Add this test to `tests/test_portfolio_visual_contract.py`:

```python
def test_studio_is_media_first_not_certificate_first() -> None:
    studio = (ROOT / "studio.html").read_text(encoding="utf-8")
    css = system_css_source()
    assert 'class="studio-app studio-media-first"' in studio
    assert 'class="studio-mode-strip"' in studio
    assert 'class="studio-primary-stage"' in studio
    assert 'class="studio-perception-panel"' in studio
    assert 'class="studio-receipts"' in studio
    assert studio.index('id="sc-meters"') < studio.index('id="sc-certificate"')
    assert studio.index('id="sc-certificate"') < studio.index('id="project-telos-features"')
    assert "What the model sees" not in studio
    assert "Live Perception" in studio
    assert ".studio-media-first" in css
    assert ".studio-receipts[open]" in css
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
python -m pytest tests\test_portfolio_visual_contract.py::test_studio_is_media_first_not_certificate_first -q
```

Expected: fail because `studio-media-first`, new structural classes, and the new copy do not exist yet.

- [ ] **Step 3: Reframe Studio shell markup**

In `studio.html`, change the main shell and immediate regions as follows while preserving nested control IDs:

```html
<main class="studio-app studio-media-first" aria-label="The Studio">
  <aside class="studio-rail" id="studio-rail" aria-label="Media sources and controls">
    <div class="rail-head">
      <h1 translate="no">The Studio</h1>
      <p class="rail-lede">A live media instrument for rendering, measuring, transforming, and reading the frame.</p>
    </div>

    <div class="source-menu studio-mode-strip" id="studio-source" role="tablist" aria-label="Choose a media source">
      <!-- keep the existing source buttons and aria-controls exactly as they are -->
    </div>

    <div class="rail-scroll">
      <!-- keep all existing source blocks exactly as they are -->
      <details class="rail-group rail-about">
        <summary>Studio notes</summary>
        <p>Render media, watch the measurements move, and export the frame or perception record. Receipts remain available when a source produces checkable evidence.</p>
      </details>
    </div>
  </aside>

  <section class="studio-viewport studio-primary-stage" id="studio-viewport" aria-label="The live media frame">
    <!-- keep viewport-stage, studio-canvas, render-toolbar, and engine-statusbar IDs intact -->
  </section>

  <aside class="studio-panel studio-perception-panel" id="studio-panel" aria-label="Live perception and receipts">
    <!-- right panel content is handled in Step 4 -->
  </aside>
</main>
```

- [ ] **Step 4: Reorder right panel into perception, receipts, and chat**

Within `#studio-panel`, keep `#studio-frame` and `#sc-meters` first, then wrap certificate and feature stack in a collapsed receipts details, then keep chat as a secondary drawer:

```html
<div class="panel-scroll">
  <section class="panel" id="studio-frame" aria-label="Live perception summary">
    <h2>Live Perception
      <span class="mm-live" id="mm-live" hidden aria-hidden="true"><span class="mm-dot"></span>live</span>
    </h2>
    <!-- keep existing rows, feature grounds, description, and drift IDs -->
  </section>

  <section class="panel measurimeter" id="sc-meters" aria-label="Measured perception channels">
    <h2>Measured frame <span class="mm-sub">color, motion, structure, audio, source</span></h2>
    <!-- keep existing measurimeter IDs -->
  </section>

  <details class="studio-receipts">
    <summary>Receipts</summary>
    <section class="panel cert-panel" id="sc-certificate" aria-label="Receipts: criterion, verdict, and re-checkable evidence">
      <h2>Receipt <span class="mm-sub">criterion, verdict, evidence</span></h2>
      <!-- keep cert-render, cert-audit, cert-note IDs -->
    </section>
    <section class="panel telos-stack" id="project-telos-features" aria-label="Project Telos feature stack">
      <h2>Engine contracts <span class="mm-sub">runnable pieces behind this Studio</span></h2>
      <!-- keep existing feature-stack content and links -->
    </section>
  </details>
</div>

<section class="chat-dock studio-chat-drawer minimized" id="chat-dock" aria-label="Ask about the frame">
  <!-- keep chat IDs and form IDs intact -->
</section>
```

- [ ] **Step 5: Update source/menu copy without breaking bindings**

Keep button IDs, `data-source`, `aria-controls`, and role attributes intact. Change only visible text and labels:

```html
<span class="source-group-label" aria-hidden="true">Make</span>
...
<span class="source-group-label" aria-hidden="true">Bring</span>
...
<span class="source-group-label" aria-hidden="true">Measure</span>
```

Change `Physics` and `Showcase` titles only if needed to keep them media-oriented, for example `Physics` and `First Integral`; leave `data-source` values unchanged.

- [ ] **Step 6: Run focused HTML contract test**

Run:

```powershell
python -m pytest tests\test_portfolio_visual_contract.py::test_studio_is_media_first_not_certificate_first -q
```

Expected: pass.

---

### Task 2: Studio CSS Media-First Layout

**Files:**
- Modify: `system/system.css`
- Test: `tests/test_portfolio_visual_contract.py`

**Interfaces:**
- Consumes: classes produced by Task 1.
- Produces: final cascade rules that make the canvas dominant, source rail compact, perception panel primary, receipts collapsed, and chat secondary.

- [ ] **Step 1: Add CSS contract assertions**

Extend `test_studio_is_media_first_not_certificate_first` with:

```python
    assert "grid-template-columns:minmax(12rem,18rem) minmax(0,1fr) minmax(18rem,24rem)" in css
    assert ".studio-primary-stage .viewport-stage" in css
    assert ".studio-chat-drawer.minimized .chat-dock-body" in css
    assert "@media (max-width:899.98px)" in css
```

- [ ] **Step 2: Run test to verify CSS assertions fail**

Run:

```powershell
python -m pytest tests\test_portfolio_visual_contract.py::test_studio_is_media_first_not_certificate_first -q
```

Expected: fail until the new Studio CSS is present.

- [ ] **Step 3: Add final Studio media-first cascade**

Append this block near the bottom of `system/system.css`, after the existing interaction polish block so it wins:

```css
/* Media-first Studio redesign: canvas and measured perception lead the page. */
.studio-media-first{
  grid-template-columns:minmax(12rem,18rem) minmax(0,1fr) minmax(18rem,24rem);
  gap:0;
  background:radial-gradient(90% 120% at 50% 10%, color-mix(in oklab, var(--signal) 11%, transparent), transparent 62%);
}

.studio-media-first .studio-rail{
  background:color-mix(in oklab, var(--void) 64%, transparent);
  border-right:1px solid var(--hairline);
}

.studio-media-first .rail-head{
  padding:clamp(.85rem,1.4vw,1.1rem);
}

.studio-media-first .rail-head h1{
  font-size:clamp(1.05rem,1.4vw,1.35rem);
}

.studio-media-first .rail-lede{
  max-width:24ch;
  font-size:.86rem;
}

.studio-media-first .studio-mode-strip{
  padding:.35rem clamp(.75rem,1.4vw,1rem) .55rem;
  gap:.45rem;
}

.studio-media-first .source-group{
  grid-template-columns:1fr;
  gap:.32rem;
}

.studio-media-first .source-menu button{
  justify-content:flex-start;
  min-height:2.35rem;
  padding:.58rem .65rem;
  font-size:.62rem;
}

.studio-primary-stage{
  padding:clamp(.75rem,1.5vw,1.1rem);
  gap:.65rem;
}

.studio-primary-stage .viewport-stage{
  flex:1 1 auto;
  width:100%;
  min-height:min(68vh,calc(100dvh - 13rem));
  max-width:none;
  border-radius:10px;
  background:color-mix(in oklab, var(--void) 92%, black);
  box-shadow:0 30px 120px -70px rgba(0,0,0,.95),0 0 0 1px var(--hairline);
}

.studio-primary-stage .render-toolbar{
  max-width:min(100%,58rem);
  padding:.35rem;
  border:1px solid var(--hairline);
  border-radius:10px;
  background:color-mix(in oklab, var(--void) 68%, transparent);
}

.studio-primary-stage .rt-btn{
  min-height:2.35rem;
  padding:.48rem .64rem;
  font-size:.58rem;
}

.studio-primary-stage .engine-statusbar{
  max-width:min(100%,58rem);
  opacity:.82;
}

.studio-perception-panel{
  background:color-mix(in oklab, var(--void) 58%, transparent);
}

.studio-perception-panel .panel-scroll{
  gap:.75rem;
  padding:clamp(.85rem,1.5vw,1.05rem);
}

.studio-perception-panel .panel{
  border-radius:10px;
  background:color-mix(in oklab, var(--void) 72%, transparent);
}

.studio-receipts{
  border:1px solid var(--hairline);
  border-radius:10px;
  background:color-mix(in oklab, var(--void) 64%, transparent);
  overflow:hidden;
}

.studio-receipts>summary{
  min-height:2.65rem;
  padding:.7rem .85rem;
  cursor:pointer;
  list-style:none;
  font-family:var(--mono);
  font-size:.62rem;
  letter-spacing:.12em;
  text-transform:uppercase;
  color:var(--signal);
}

.studio-receipts>summary::-webkit-details-marker{display:none}
.studio-receipts>summary::after{content:"+";float:right;color:var(--muted)}
.studio-receipts[open]>summary::after{content:"-"}
.studio-receipts:not([open])>*:not(summary){display:none}

.studio-receipts .panel{
  border:0;
  border-top:1px solid var(--hairline);
  border-radius:0;
}

.studio-chat-drawer{
  border-top:1px solid var(--hairline);
  background:color-mix(in oklab, var(--void) 70%, transparent);
}

.studio-chat-drawer.minimized .chat-dock-body{
  display:none;
}

.studio-chat-drawer .chat-dock-head{
  min-height:2.7rem;
}

@media (max-width:899.98px){
  .studio-media-first{
    display:flex;
    flex-direction:column;
    min-height:0;
  }
  .studio-media-first .studio-rail{
    order:1;
    border-right:0;
    border-bottom:1px solid var(--hairline);
  }
  .studio-media-first .studio-mode-strip{
    display:flex;
    flex-direction:row;
    overflow-x:auto;
    padding-bottom:.65rem;
  }
  .studio-media-first .source-group{
    min-width:9.5rem;
  }
  .studio-primary-stage{
    order:2;
    min-height:70svh;
  }
  .studio-primary-stage .viewport-stage{
    min-height:min(62svh,34rem);
  }
  .studio-perception-panel{
    order:3;
  }
  .studio-perception-panel .panel-scroll{
    max-height:none;
    overflow:visible;
  }
  .studio-chat-drawer{
    order:4;
  }
}
```

- [ ] **Step 4: Run focused CSS contract test**

Run:

```powershell
python -m pytest tests\test_portfolio_visual_contract.py::test_studio_is_media_first_not_certificate_first -q
```

Expected: pass.

---

### Task 3: Verification, Browser QA, Commit, Push

**Files:**
- Modify: HTML cache keys in `studio.html` if `system/system.css` or Studio assets need a fresh query string.
- Modify: `tests/test_portfolio_visual_contract.py` if final class/copy assertions need exact adjustment.

**Interfaces:**
- Consumes: Task 1 and Task 2 changes.
- Produces: committed and pushed public site changes.

- [ ] **Step 1: Bump Studio CSS cache key**

In `studio.html`, update:

```html
<link rel="stylesheet" href="system/system.css?v=20260709h">
```

to:

```html
<link rel="stylesheet" href="system/system.css?v=20260709i">
```

If other pages already use `system/system.css?v=20260709h`, leave them unless the final CSS affects those pages materially. Studio can carry the Studio-specific cache key.

- [ ] **Step 2: Run syntax and test commands**

Run:

```powershell
node --check system\nav.js
node --check system\home-art.js
python -m pytest tests\test_portfolio_visual_contract.py
node --test system\*.test.mjs
node tests\linkcheck.mjs
git diff --check
```

Expected:

- `node --check` commands produce no output and exit 0.
- `pytest` reports `18 passed` or more if new tests increase the count.
- `node --test` reports all non-skipped tests passing.
- `linkcheck` reports `0 broken`.
- `git diff --check` exits 0.

- [ ] **Step 3: Browser QA with correct module MIME**

Use Chrome DevTools or a MIME-correct local server for `.mjs`. Verify this DOM contract:

```javascript
(() => ({
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  hasMediaFirst: !!document.querySelector(".studio-media-first"),
  hasPrimaryStage: !!document.querySelector(".studio-primary-stage .viewport-stage"),
  perceptionBeforeReceipts:
    document.querySelector("#sc-meters").compareDocumentPosition(document.querySelector("#sc-certificate")) & Node.DOCUMENT_POSITION_FOLLOWING,
  receiptsOpen: document.querySelector(".studio-receipts")?.open || false,
  visibleSmallControls: [...document.querySelectorAll("button,a,summary,[role='tab']")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden" && r.height < 40 && r.width < 120;
    }).map((el) => (el.textContent || el.getAttribute("aria-label") || "").trim()).slice(0, 10)
}))()
```

Expected:

- `overflowX` is `false`.
- `hasMediaFirst` is `true`.
- `hasPrimaryStage` is `true`.
- `perceptionBeforeReceipts` is non-zero truthy.
- `receiptsOpen` is `false`.
- `visibleSmallControls` is empty or contains only inline text links that are not discrete controls.

- [ ] **Step 4: Commit implementation**

Run:

```powershell
git status --short
git add studio.html system/system.css tests/test_portfolio_visual_contract.py
git commit -m "Redesign Studio as media-first perception surface"
```

Expected: a new commit on `main`.

- [ ] **Step 5: Push all completed commits**

Run:

```powershell
git push origin main
```

Expected: `main` pushes successfully to `origin/main`.
