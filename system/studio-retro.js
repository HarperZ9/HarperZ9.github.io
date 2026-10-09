// studio-retro.js: the full Retro Engine inside the Studio (4 October 2026). The author: "this page
// is the hub for where all of these modules should exist." Nothing is rewritten. retro.html's own
// engine markup (its control panel and its preview, with the output canvas, the full-screen button
// and the HUD) is read from the page once, placed in the Retro source's inspector and on the stage,
// and retro-studio.js, the engine's own controller, boots against it.
//
// While Retro is the source, its output canvas carries the Studio's canvas id, so the readings,
// the deck's exports and the hand-offs read the engine's frames. Leaving parks it, pauses the
// engine's loop and gives the id back.

const RETRO_PAGE = "retro.html?v=20261004-retro-hub";
let hub = null;          // { preview, out, studioCanvas }
let loading = null;

function adopt(doc, sel) {
  const n = doc.querySelector(sel);
  return n ? document.adoptNode(n) : null;
}

async function build(mount, stage) {
  const res = await fetch(RETRO_PAGE, { credentials: "same-origin" });
  if (!res.ok) throw new Error("retro.html answered " + res.status);
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");
  // The page's own racks: its two inline style blocks, scoped to .re-* classes.
  for (const st of doc.querySelectorAll("head style")) {
    if (!st.textContent.includes(".re-")) continue;
    const s = document.createElement("style");
    s.dataset.retroHub = "";
    s.textContent = st.textContent;
    document.head.append(s);
  }
  const panel = adopt(doc, ".re-panel");
  const preview = adopt(doc, ".re-preview");
  if (!panel || !preview) throw new Error("retro.html has no engine panel or preview");
  mount.replaceChildren(panel);
  for (const sel of ["#re-measure", "#re-flow"]) { const n = adopt(doc, sel); if (n) mount.append(n); }
  preview.classList.add("studio-retro-preview");
  preview.hidden = true;
  stage.append(preview);
  const out = preview.querySelector("#re-out");
  out.dataset.retro = "";
  await import("./retro-studio.js?v=20261009-studio-bar");   // boots against the markup above
  return { preview, out, studioCanvas: null };
}

/** Show the engine. Resolves once it is drawing. */
export async function enterRetroHub({ mount, stage }) {
  if (!hub) {
    if (!loading) loading = build(mount, stage).then((h) => { hub = h; return h; }).finally(() => { loading = null; });
    await loading;
  }
  const studioCanvas = document.getElementById("studio-canvas");
  if (studioCanvas && studioCanvas !== hub.out) {
    hub.studioCanvas = studioCanvas;
    studioCanvas.id = "studio-canvas-parked";
    studioCanvas.hidden = true;
  }
  hub.out.id = "studio-canvas";
  hub.preview.hidden = false;
  if (window.__retroStudio) window.__retroStudio.resume();
}

/** Park the engine: stop its loop and give the Studio its canvas back. */
export function leaveRetroHub() {
  if (!hub) return;
  if (window.__retroStudio) window.__retroStudio.pause();
  hub.preview.hidden = true;
  hub.out.id = "re-out";
  if (hub.studioCanvas) {
    hub.studioCanvas.id = "studio-canvas";
    hub.studioCanvas.hidden = false;
  }
}

export const retroHubReady = () => !!hub;
