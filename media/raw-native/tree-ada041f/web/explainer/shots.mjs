// Camera choreography and scene transitions. Pure functions of time, so a scrub lands on the
// same frame a render does.
//
//   const cam = shots([
//     { t: 0, x: 960, y: 540, zoom: 1 },
//     { t: 8, x: 600, y: 420, zoom: 3.2, ease: "inOut", hold: 1.5 },   // a push-in, eased
//   ], { reduced });
//   list.camera = cam(t);
//   const ir = iris(t, 30, 31.6);      // { cover: 0..1, ground: 0 (night) .. 1 (paper), radius }
// Under reduced motion every move becomes a cut at the midpoint of its span, zoom included.
import { ease, lerp, lerpLog, span, clamp01 } from "../motion/timeline.mjs";

const EASE = { linear: ease.linear, inOut: ease.inOut, out: ease.out, in: ease.in, smooth: ease.smooth, expo: ease.expoInOut };

// Keys: { t, x, y, zoom, ease?, hold? }. Between keys the camera moves from the previous key
// to this one over [prev.t + prev.hold, t], with zoom in log space so a push reads as steady.
export function shots(keys, { reduced = false } = {}) {
  const ks = [...keys].sort((a, b) => a.t - b.t);
  return (t) => {
    if (t <= ks[0].t) return pick(ks[0]);
    for (let i = 1; i < ks.length; i++) {
      const a = ks[i - 1], b = ks[i], t0 = a.t + (a.hold || 0);
      if (t <= b.t) {
        if (t <= t0) return pick(a);
        let u = (t - t0) / Math.max(1e-6, b.t - t0);
        u = reduced ? (u < 0.5 ? 0 : 1) : (EASE[b.ease || "inOut"] || ease.inOut)(u);
        const z = lerpLog(a.zoom, b.zoom, u);
        return { x: toward(a.x, b.x, a.zoom, b.zoom, z, u), y: toward(a.y, b.y, a.zoom, b.zoom, z, u), zoom: z, aperture: lerp(a.aperture || 0, b.aperture || 0, u), focus: 0 };
      }
    }
    return pick(ks[ks.length - 1]);
  };
}
// Zoom to a point: on a push-in the destination's screen offset shrinks linearly to zero, so the
// target never leaves the frame (a plain lerp of the centre swings it off screen at high zoom);
// a pull-out runs the same move backwards from the start point.
export function toward(a, b, za, zb, z, u) {
  if (zb >= za) return b - (1 - u) * (b - a) * (za / z);
  return a + u * (b - a) * (zb / z);
}
const pick = (k) => ({ x: k.x, y: k.y, zoom: k.zoom, aperture: k.aperture || 0, focus: 0 });

// The orb iris: the orb grows from `radius0` to cover the frame over [a, b]; the ground swaps
// under it at the midpoint, then the orb shrinks back. cover is the orb's radius share of the
// frame's half-diagonal; ground goes 0 to 1 at the cut.
export function iris(t, a, b, { radius0 = 120, reduced = false } = {}) {
  const mid = (a + b) / 2;
  const up = span(t, a, mid, ease.in), down = span(t, mid, b, ease.out);
  const cover = reduced ? 0 : up * (1 - down);   // reduced motion: the ground cuts, the orb stays
  const R = Math.hypot(960, 540) * 1.15;
  return { cover, radius: lerp(radius0, R, cover), ground: t >= mid ? 1 : 0, active: t >= a && t <= b };
}

// A focus pull: the outgoing content blurs and fades over [a, m], the incoming sharpens over
// [m, b]. Returns { out: { blur, opacity }, in: { blur, opacity } } for items' blur and opacity.
export function focusPull(t, a, b, maxBlur = 24, { reduced = false } = {}) {
  const m = (a + b) / 2, uo = span(t, a, m, ease.in), ui = span(t, m, b, ease.out);
  if (reduced) return { out: { blur: 0, opacity: t < m ? 1 : 0 }, in: { blur: 0, opacity: t >= m ? 1 : 0 } };
  return { out: { blur: maxBlur * uo, opacity: 1 - uo }, in: { blur: maxBlur * (1 - ui), opacity: ui } };
}

// Fade a beat in and out: 0 before a, 1 inside, 0 after b.
export const beat = (t, a, b, up = 0.5, down = 0.5) => Math.min(span(t, a, a + up), 1 - span(t, b - down, b));

// Pulse phase for flow along connections: 0..1, one cycle every `period` seconds from t0.
export const phase = (t, t0 = 0, period = 1.6) => clamp01((((t - t0) / period) % 1 + 1) % 1);
