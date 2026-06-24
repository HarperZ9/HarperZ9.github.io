# Task 8h Report — Overlay / Pop-out Mode

## Status
Done. Three commits on `feat/site-restructure`.

## Commits
1. `9145f79` — `feat(studio): add Overlay button to toolbar + floating panel CSS (Task 8h)`
2. `534d87d` — `feat(studio): overlay mode — pop out the live readout (Document PiP + in-page fallback), native note (Task 8h)`
3. `d7feaa0` — `fix(studio): use querySelector('.panel-scroll') — element has no id, only class (Task 8h)`

## What was built

**HTML (`studio.html`):** Added `<button id="rt-overlay" class="rt-btn" aria-pressed="false">` after the Fullscreen button in the render toolbar. Uses `⧉` as the icon.

**CSS (`system/system.css`):** Added 11 rules for `.studio-overlay-panel`, `.studio-overlay-head`, `.studio-overlay-head-label`, `.studio-overlay-close`, `.studio-overlay-body`, `.studio-overlay-note` — a fixed-position, resizable, dark-themed floating panel styled to match the Studio's existing palette.

**JS (`system/studio.js`):**
- Patched the module-level `$` helper to search `window.__overlayDoc` first, then `document`. This is the key mechanism that keeps the live loop's id-based element lookups working after nodes move into a PiP document (where `document.getElementById` would otherwise miss them).
- Added `openOverlay()` / `closeOverlay()` with:
  - **Path A (PiP):** `documentPictureInPicture.requestWindow({width:360,height:520})`, copies all stylesheets into the PiP document, moves `.panel-scroll` there, restores on `pagehide`. The `$()` helper detects via `window.__overlayDoc`.
  - **Path B (fallback):** builds a draggable `position:fixed` panel, moves `.panel-scroll` into its body. Pointer-event drag via `setPointerCapture`. Close button calls `closeOverlay()`.
  - Both paths include an honest scope note: "Perceives only what you share via screen capture, in your browser. Continuous OS-level perception is the native application's job."
  - Guard: `if (overlayOpen) return` prevents double-open.
  - Clean restore in `closeOverlay`: moves `.panel-scroll` back before `.chat-dock` in `#studio-panel`, removes the floating panel, resets `aria-pressed` and `disabled` on the button.
- Test hooks: `window.__studioOverlayOpen`, `window.__studioOverlayClose`, `window.__studioOverlayState`.

## Verification

**Path verified:** Fallback (in-page draggable panel) — Playwright's headless Chromium exposes `window.documentPictureInPicture` but `requestWindow` requires a user gesture; stubbing it to throw forces the fallback.

**Checks passed:**
- Overlay button renders in the toolbar (accessibility snapshot confirmed).
- `state.open: true, fallback: true, pip: false` after `openOverlay()`.
- `panel-scroll` node moves inside `#studio-overlay-panel` (`insideOverlay: true`).
- All readout elements remain accessible by `getElementById` while open (fallback keeps nodes in main document — no `$()` patching needed for this path).
- Canvas 2D context works on `#mm-mosaic` while inside the overlay (painting is not interrupted).
- `window.__studioMeasure()` executed successfully with nodes inside the overlay.
- After `closeOverlay()`: `panel-scroll` back inside `#studio-panel` (`insideAside: true`), overlay panel removed (`overlayGone: true`), button reset (`aria-pressed=false`, `disabled=false`).

**PiP path not exercised in headless.** Real Document PiP requires Chrome 116+ with a user gesture. The `$()` dual-document helper is implemented for correctness — it will be exercised in a real browser session.

## Concerns / Notes

1. **`panel-scroll` is a class, not an id.** `getElementById("panel-scroll")` returned null — discovered during verification. Fixed to `querySelector(".panel-scroll")` in commit `d7feaa0`. The HTML has `class="panel-scroll"` with no id attribute.

2. **PiP CSS copy:** `[...document.styleSheets].forEach(ss => ...)` clones stylesheet links and inline styles into the PiP document. Cross-origin sheets will silently fail (caught per-sheet). Google Fonts href copy works if the PiP document can make the network request.

3. **Live loop in PiP:** The `$()` helper returns elements from whichever document holds them. For the PiP path, `window.__overlayDoc` is set to `pipWin.document` before `panelScroll` moves there. All id-based lookups in `liveTick` (`sc-phash`, `mm-live`, `mm-mosaic`, etc.) resolve to the PiP document correctly. The `meterEls` object holds direct element references (immune to document changes).

4. **Screen capture + overlay:** The live loop checks `watchStream && watchVideo.videoWidth` — this is untouched. If screen capture is active while the overlay is open, the loop continues blitting frames and updating the moved meters. No additional wiring needed.

5. **Static-stop in headless:** The live loop self-idles after 18 static ticks (~1.5s) when no canvas animation is present. In headless without WebGL, the 3D fractal doesn't animate; the hash stays constant and the loop stops. This is existing behavior, not a regression.

## Report path
`c:/dev/public/portfolio-site/.superpowers/sdd/task-8h-report.md`
