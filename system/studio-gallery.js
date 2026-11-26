// studio-gallery.js: the Gallery's whole print desk inside the Studio (9 October 2026). Before, the
// Gallery source was a preview with 6 controls against gallery.html's 360 and a button that left
// for the page. Now the Studio adopts the page's desk itself (studio-hub.js): the seed, draw and
// reroll, the 95 instruments shelved by family with locks, 15 recipes, the effects rack, variations,
// pen-plotter replay, sound and play the plate, your own image, save PNG and copy link. The desk's
// own controller (gallery-desk.js, the code gallery.html runs) does the work.
//
// Kept from the earlier Studio Gallery: Send to Retro and to the Loom hand the plate over inside
// the Studio, and "Export frame and receipt" stays at the end of the rail.

import { createHub } from "./studio-hub.js?v=20261009-loom-hub";
import { stageHandoff, exportWithReceipt } from "./studio-engine-flows.js";

let desk = null;   // the gallery-desk.js module, once booted
let hooks = {};    // { setSource, onDrawn, workshop }

const hub = createHub({
  id: "gallery",
  page: "gallery.html?v=20261009-gallery-desk",
  panel: ".desk-rail",
  preview: ".desk-plate-col",
  canvas: "#desk-canvas",
  styleTest: (t) => t.includes(".desk-"),
  async boot() {
    const boot = window.__studioBootSearch || "";
    window.__galleryDeskHost = {
      mirror: false,
      linkPage: "gallery.html",
      // A link to the Studio's Gallery that names a plate (?source=gallery&seed=...&layers=...).
      search: /[?&]source=gallery\b/.test(boot) ? boot : "",
      inView: () => window.__studioActiveSource === "gallery",
      async send(target, canvas) {
        await stageHandoff(canvas, "Gallery");
        if (hooks.setSource) hooks.setSource(target);
      },
      workshop: (seed) => { if (hooks.workshop) hooks.workshop(seed); },
      onDrawn: () => { if (hooks.onDrawn) hooks.onDrawn(); },
    };
    desk = await import("./gallery-desk.js?v=20261009-gallery-desk");
  },
});

function receiptButton(mount) {
  if (mount.querySelector("#gallery-receipt")) return;
  const row = document.createElement("div");
  row.className = "src-actions gallery-receipt-row";
  const b = document.createElement("button");
  b.type = "button"; b.className = "btn"; b.id = "gallery-receipt";
  b.textContent = "Export frame and receipt";
  b.title = "Save this plate as a PNG with a receipt naming the seed, instruments and effects";
  b.addEventListener("click", () => {
    const c = hub.canvas(); if (!c || !desk) return;
    const s = desk.deskState();
    exportWithReceipt(c, { plugin: "gallery-desk", version: "1", params: { layers: s.layers.join(","), fx: s.fx.join(","), fxa: s.fx.length ? s.fxa : "" }, seed: s.seed, backend: "canvas2d" })
      .catch((e) => console.error("[studio-gallery] receipt export failed:", e));
  });
  row.append(b);
  mount.append(row);
}

/** Show the desk on the stage. hooks: { setSource, onDrawn, workshop }. */
export async function enterGallery({ mount, stage, ...h }) {
  hooks = h;
  await hub.enter({ mount, stage });
  receiptButton(mount);
  if (desk) desk.redrawDesk();
}
export function leaveGallery() { hub.leave(); }
export const galleryState = () => (desk ? desk.deskState() : null);
export function applyGalleryState(s) { if (desk) desk.applyDeskState(s); }
export function redrawGallery() { if (desk && hub.ready()) desk.redrawDesk(); }
export const galleryReady = () => hub.ready() && !!desk;
