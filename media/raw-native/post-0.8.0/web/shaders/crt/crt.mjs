// The physical CRT, CPU reference: the whole tube for one frame, pass by pass, in the
// order the GPU runs them (crt.wgsl). createCrt keeps the persistence history between frames.
import { resolve, PRESETS } from "./params.mjs";
import { packTaps, signalChain } from "./signal.mjs";
import { beamPass } from "./beam.mjs";
import { haloDown, haloConv, compose, encode8 } from "./glass.mjs";

export { resolve, PRESETS, encode8 };

export function createCrt(preset, overrides, src, out) {
  const plan = resolve(preset, overrides, src, out), taps = packTaps(plan.taps);
  const hist = new Float32Array(out.w * out.h * 8);
  let frameNo = 0;
  return {
    plan, taps, hist,
    // srcFrame: { width, height, data } of R'G'B' signal values in [0, 1].
    frame(srcFrame, f = frameNo) {
      const sig = signalChain(plan, srcFrame, f, taps);
      const em = beamPass(plan, sig, hist, f);
      const img = compose(plan, em, haloConv(plan, haloDown(plan, em)));
      frameNo = f + 1;
      return { sig, em, img };
    },
  };
}
