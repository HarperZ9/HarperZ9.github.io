// studio-loom.js: the whole Loom inside the Studio (9 October 2026). Before, the Studio's Loom was a
// preview with a seed, an instrument and a structure, against loom.html's 43 controls. Now the
// Studio adopts the page's own panel and preview (studio-hub.js) and loom-studio.js, the Loom's
// controller, boots against them: your image or a WIF draft, the five starting drafts, cloth and
// draft views with zoom and hand editing, width, sett, tone, warp and weft colours, the shuttle
// and its sound, WIF export and the re-read check, the draft chart, save cloth, setups, and the
// send to the Retro Engine, which stays in the page.
//
// Kept from the earlier Studio Loom: "Export frame and receipt" at the end of the rail.

import { createHub } from "./studio-hub.js?v=20261009-loom-hub";
import { stageHandoff, takeHandoff, exportWithReceipt } from "./studio-engine-flows.js";

let hooks = {};   // { setSource, onBuilt }

const hub = createHub({
  id: "loom",
  page: "loom.html?v=20261009-loom-hub",
  panel: ".re-panel",
  preview: ".re-preview",
  extras: ["#wv-flow"],
  canvas: "#wv-out",
  sheets: ["system/instrument.css?v=20260902-creative-chassis"],
  styleTest: (t) => t.includes(".re-"),
  async boot() {
    window.__loomHost = {
      async send(target, canvas) {
        await stageHandoff(canvas, "Loom");
        if (hooks.setSource) hooks.setSource(target);
      },
      onBuilt: () => { if (hooks.onBuilt) hooks.onBuilt(); },
    };
    await import("./loom-studio.js?v=20261009-loom-hub");
  },
  pause: () => { if (window.__loomStudio) window.__loomStudio.pause(); },
  resume: () => { if (window.__loomStudio) window.__loomStudio.resume(); },
});

function receiptButton(mount) {
  if (mount.querySelector("#loom-receipt")) return;
  const row = document.createElement("div");
  row.className = "src-actions loom-receipt-row";
  const b = document.createElement("button");
  b.type = "button"; b.className = "btn"; b.id = "loom-receipt";
  b.textContent = "Export frame and receipt";
  b.title = "Save the cloth as a PNG with a receipt naming the structure and the loom settings";
  b.addEventListener("click", () => {
    const c = hub.canvas(); if (!c || !window.__loomStudio) return;
    const s = window.__loomStudio.state();
    exportWithReceipt(c, { plugin: "loom", version: "2", params: s, seed: s.structureId, backend: "canvas2d" })
      .catch((e) => console.error("[studio-loom] receipt export failed:", e));
  });
  row.append(b);
  mount.append(row);
}

/** Show the Loom. hooks: { setSource, onBuilt }. A frame handed over in the page is woven. */
export async function enterLoom({ mount, stage, ...h }) {
  hooks = h;
  await hub.enter({ mount, stage });
  receiptButton(mount);
  const handed = takeHandoff();
  if (handed && window.__loomStudio) {
    try { sessionStorage.setItem("re.loom.handoff", handed.canvas.toDataURL("image/png")); } catch (_) {}
    window.__loomStudio.importHandoff();
  } else if (window.__loomStudio) window.__loomStudio.redraw();
}
export function leaveLoom() { hub.leave(); }
export const loomState = () => (window.__loomStudio ? window.__loomStudio.state() : null);
export function applyLoomState(s) { if (window.__loomStudio) window.__loomStudio.apply(s); }
export function redrawLoom() { if (window.__loomStudio && hub.ready()) window.__loomStudio.redraw(); }
