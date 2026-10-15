// The block lab, drawn in the lighthouse cutaway: the beam's width at each landing is the stream's
// measured size under the reader's switches; rooms and heads switched off are dark; each landing
// shows the early guess's loss. Pure in state.
import { words, rect } from "../../media/school/shared/lib.mjs";
import { night, glazing } from "../../media/school/attention/scene/room.mjs";
import { host } from "../../media/school/embeddings/scene/segs.mjs";
import { INK, shell, beam, room, readout } from "../../media/school/block/scene/tower.mjs";

export function frame(s, A, t) {
  const items = [...night(t, { moon: false }), ...glazing(), ...shell()];
  if (s.norms.length) items.push(...beam(s.norms, 4));
  [0, 1, 2, 3].forEach((i) => { const layer = i >> 1, attn = i % 2 === 0;
    items.push(...room(A, i, { state: attn ? (s.off[`l${layer}.attn`] ? "off" : "on") : s.off[`l${layer}.mlp`] ? "off" : "on", heads: attn ? [0, 1].map((h) => (s.off[`l${layer}.h${h}`] || s.off[`l${layer}.attn`] ? 0 : 1)) : null })); });
  s.lens.forEach((l, i) => items.push(readout(A, i, `loss ${l.loss.toFixed(2)}`, 1, i === 4 ? INK.ember : INK.night)));
  if (s.score) items.push({ shape: rect(560, 990, 1300, 60, 10), fill: [0.03, 0.03, 0.04, 0.75], screen: true },
    { shape: words(`loss ${s.score.loss.toFixed(2)}; copies ${Math.round(s.score.copyAccuracy * 100)}%; other words ${Math.round(s.score.localAccuracy * 100)}% right`, A.mono, 26, 590, 1030), fill: INK.night, screen: true });
  return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items: [...items, ...host(t, { rows: [] })],
    post: { bloom: 0.2, threshold: 1, vignette: 0.12, grain: 0, passes: [{ pass: "film", preset: "500t-print", ev: 1.6 }] } };
}
