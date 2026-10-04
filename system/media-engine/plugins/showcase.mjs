// system/media-engine/plugins/showcase.mjs
// The Studio's Showcase source (First Integral), render half, as an engine plugin: the orbit scene
// from showcase/orbit-render.js, which composites the ground, the revealed trajectory and the
// readout bands from one view object per draw. first-integral.js keeps the state machine, the
// reveal pacing, the report and its re-check; it drives the scene this plugin owns (setGround,
// setTrajectory, reveal) and asks the plugin for every frame it shows. Static, and it draws only
// the frame the host asked for: setParams() arms one frame and drawing it disarms, so the engine's
// own still frames never repaint the shared Studio canvas.
//
// params: { view }   a view from showcase/view.js buildView().
// instance.scene is the orbit scene, for the host's state machine.

import { makeScene } from "../../showcase/orbit-render.js?v=20260925-studio-plate";

export const showcase = {
  id: "showcase",
  version: "1.0.0",
  backends: ["canvas2d"],
  create({ canvas, params = {} }) {
    let p = { ...params };
    let armed = false;
    const scene = makeScene(canvas);
    const inst = {
      backend: "canvas2d",
      static: true,
      scene,
      frame() {
        if (!armed || !p.view) return;
        armed = false;
        scene.draw(p.view);
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
