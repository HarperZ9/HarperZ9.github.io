// The host, Rerun, in its home style: the pixel 2.5D tidepool (raw-native templates/guides),
// rendered in pixel mode at 480 x 270 on the shore's own fixed palette with an ordered dither.
// That home style is itself colour on a budget, which is why Rerun hosts this film.
//
// Cold open: Rerun knocks on a shell, knock, knock, and it rings hollow (its signature action).
// Close: Rerun at rest, the one spectral flare in its glass shell; it looks out and lets the
// viewer go. Both beats are wordless; the voice starts after the open.
import { shot } from "../../../raw-native/tree-c6b114d/templates/guides/stage.mjs";
import { rect } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";
import { span, ease } from "../../../raw-native/tree-c6b114d/web/motion/timeline.mjs";

export const openShot = shot({ guide: "rerun", style: "pixel", clip: "action", layer: "art" });
export const closeShot = shot({ guide: "rerun", style: "pixel", clip: "idle", layer: "art" });

export async function load(ctx) { return openShot.load(ctx); }

const veil = (o) => ({ shape: rect(-20, -20, 1960, 1120), screen: true, fill: [0.004, 0.004, 0.01, 1], opacity: o });

export function frame(t, ctx, H, T) {
  if (t < T.openEnd) {
    const f = openShot.frame(Math.min(t, 3.19), { ...ctx, assets: H });
    const dark = Math.max(1 - span(t, 0, 0.5, ease.out), span(t, T.openEnd - 0.6, T.openEnd, ease.inOut));
    if (dark > 0.003) f.items = [...f.items, veil(dark)];
    return f;
  }
  if (t >= T.closeStart) {
    const u = t - T.closeStart, f = closeShot.frame(u % 2.4, { ...ctx, assets: H });
    const dark = Math.max(1 - span(u, 0, 0.6, ease.out), span(t, T.end - 0.8, T.end, ease.inOut));
    if (dark > 0.003) f.items = [...f.items, veil(dark)];
    return f;
  }
  return null;
}
