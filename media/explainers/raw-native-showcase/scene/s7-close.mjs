// Segment 7, the close. The camera comes out of the last facet to the whole lens, every facet
// lit, and keeps pulling back while the lens turns once; the void sits at its core. The one
// thing to keep sits on the void's rim, then the voice disclosure. After the last line the host
// takes over (host.mjs): the lens is Rerun's shell again.
import { C, put, T, span, window, ease } from "./world.mjs";

export function prepare(A, facts, c) {
  A.s7 = {
    keep: T(A, "a style is a claim", { size: 52, x: 960, y: 150, atlas: "head" }),
    voice: T(A, "The voice is synthesized . Sources under the video", { size: 34, x: 960, y: 150, atlas: "mono" }),
  };
  A.T7 = { enter: c.at(7, 0, 0), voice: c.at(7, 1, 0), end: c.last };
}
export const stops = (c) => [["lens", c.at(7, 0, 0)], ["far", c.at(7, 1, 0) + 1.0]];

// The lens turns once over the close, in the art layer.
export function spin(t, A) {
  const T7 = A.T7;
  return T7 ? Math.PI * 2 * span(t, T7.enter, T7.end + 1.5, ease.inOut) : 0;
}

export function draw(t, A, items) {
  const S = A.s7, T7 = A.T7;
  if (t < T7.enter - 1) return;
  put(items, S.keep, C.ink, window(t, T7.enter + 0.6, T7.voice - 0.2, 0.8, 0.6));
  put(items, S.voice, C.ink2, window(t, T7.voice + 0.2, T7.end + 1.2, 0.6, 0.6));
}
