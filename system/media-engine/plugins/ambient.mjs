// system/media-engine/plugins/ambient.mjs
// The ambient field (generative-field.js) as an engine plugin. The field draws exactly as it did
// under its own loop; the engine scheduler now owns the loop, so the page has one
// requestAnimationFrame, the hidden-tab stop and the reduced-motion still frame come from one
// policy, and the field's CPU time shows in the engine's stats. nav.js mounts it only where the
// page asks for it (data-ambient-field="true").
//
// Mount on any canvas: the plugin creates the field's own full-page canvases and ignores the one
// it was given except as the engine's handle. create() throws where the page opted out.

import { createAmbientField } from "../../generative-field.js?v=20260925-void-plates";

export const ambient = {
  id: "ambient",
  version: "1.0.0",
  backends: ["canvas2d"],
  create({ reduced, requestRedraw = () => {} }) {
    const field = createAmbientField(document);
    if (!field) throw new Error("ambient: the page opted out of the field, or it is already mounted");
    const onResize = () => requestRedraw();
    window.addEventListener("resize", onResize, { passive: true });
    return {
      backend: "canvas2d",
      static: false,
      canvas: field.scene,
      // t is seconds from the engine; the field's clock is milliseconds. A still frame (reduced
      // motion, resize) is forced; a running frame follows the field's own 28 or 82 ms cadence.
      frame(t, dt) { field.step(t * 1000, reduced || dt === 0); },
      dispose() { window.removeEventListener("resize", onResize); field.dispose(); },
    };
  },
};
