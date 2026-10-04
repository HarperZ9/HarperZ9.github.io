// system/media-engine/plugins/voxels.mjs
// The Studio's Voxels source, render half, as an engine plugin: a built voxel scene drawn
// isometrically by voxel-forge.js, with its pick buffer (one colour per voxel face) drawn into the
// host's pick canvas in the same pass. Building, turning and editing the scene stay with the host
// page, which owns the study, seed, resolution and edit controls and hands the plugin the scene.
// Static, and it draws only the frame the host asked for: setParams() arms one frame and drawing it
// disarms, so the engine's own still frames (on mount, a theme or visibility change) never repaint
// the shared Studio canvas, which another source may own by then.
//
// params: { scene, view, pickCtx }   scene from buildVoxelScene; view is the still-view state;
//                                    pickCtx is the 2D context of the host's pick canvas.

import { renderVoxelScene } from "../../voxel-forge.js";

export const voxels = {
  id: "voxels",
  version: "1.0.0",
  backends: ["canvas2d"],
  create({ canvas, params = {} }) {
    let p = { ...params };
    let armed = false;
    const inst = {
      backend: "canvas2d",
      static: true,
      frame() {
        if (!armed || !p.scene) return;
        armed = false;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        renderVoxelScene(ctx, p.scene, canvas.width, canvas.height, { pickCtx: p.pickCtx, view: p.view });
      },
      setParams(next) { p = { ...p, ...next }; armed = true; },
      readPixels() {
        const c = canvas.getContext("2d", { willReadFrequently: true });
        return new Uint8Array(c.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
      },
      dispose() {},
    };
    return inst;
  },
};
