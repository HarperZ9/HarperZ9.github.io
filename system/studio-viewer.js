// studio-viewer.js: the Verified viewer source (12 October 2026). raw-native's own viewer page
// (web/viewer/ in the engine) runs on the stage, loaded from a byte copy of a pinned raw-native
// release (media/raw-native/viewer-<version>/, every file checked against the release's SHA256SUMS
// by studio-viewer.test.mjs). The page is not copied or edited: it runs in a same-origin frame
// exactly as the release ships it, with all of its controls (open your own glTF or GLB, the two
// owned assets, size, the ray-traced AO reference, the error scale) and all of its output (the GPU
// frame, the CPU reference, the error map, the certificate). The rail's buttons press the page's
// own buttons, and the rail reads the verdict from the page's own record (window.__viewer).

export const VIEWER_VERSION = "0.7.0";
export const VIEWER_DIR = `media/raw-native/viewer-${VIEWER_VERSION}/`;
export const VIEWER_PAGE = `${VIEWER_DIR}web/viewer/index.html`;

let box = null, frame = null, ready = null, poll = 0, statusEl = null;

const pageDoc = () => { try { return frame && frame.contentDocument; } catch (_) { return null; } };
const pageState = () => { try { return frame && frame.contentWindow && frame.contentWindow.__viewer; } catch (_) { return null; } };

// The rail's one-line reading of the page: its status line, then the newest run's verdict.
export function viewerReading() {
  const d = pageDoc(), s = pageState();
  if (!d) return "loading the viewer";
  const status = (d.getElementById("status") || {}).textContent || "";
  const run = s && s.runs && s.runs.length ? s.runs[s.runs.length - 1] : null;
  if (!run) return status;
  const err = Number.isFinite(run.errorWorst) ? `, worst |GPU - CPU| ${run.errorWorst.toFixed(4)}` : "";
  return `${run.model}: ${run.verdict || "no certificate"} (exit ${run.exitCode}, ${(run.ms / 1000).toFixed(1)} s${err})`;
}

function tick() {
  poll = 0;
  if (!box || box.hidden) return;
  if (statusEl) statusEl.textContent = viewerReading();
  poll = setTimeout(tick, 500);
}

/** Show the viewer on the stage, loading the release's page on the first entry. */
export function enterViewer({ stage, status }) {
  statusEl = status || null;
  if (!box) {
    box = document.createElement("div");
    box.id = "viewer-stage";
    box.className = "studio-hub-preview";
    box.dataset.hub = "viewer";
    frame = document.createElement("iframe");
    frame.id = "viewer-frame";
    frame.title = `raw-native ${VIEWER_VERSION} verified viewer`;
    frame.setAttribute("allow", "fullscreen");
    ready = new Promise((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
    frame.src = VIEWER_PAGE;
    box.append(frame);
    stage.append(box);
  }
  box.hidden = false;
  if (!poll) tick();
  return ready;
}

/** Hide the viewer; the page stays loaded, so a render in flight finishes and coming back shows it. */
export function leaveViewer() {
  if (box) box.hidden = true;
  if (poll) { clearTimeout(poll); poll = 0; }
}

/** Press one of the page's own buttons (raw-hero, raw-hall). */
export async function pressViewer(id) {
  if (ready) await ready;
  const d = pageDoc();
  const b = d && d.getElementById(id);
  if (!b) return false;
  b.click();
  return true;
}

/** The page's own record of its runs, for the shell's history and the tests. */
export function viewerState() {
  const s = pageState();
  return s ? { done: !!s.done, error: s.error || null, runs: (s.runs || []).map((r) => ({ ...r })) } : null;
}
