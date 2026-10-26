// anim.mjs: Feedback plate, the animated piece. A membrane field whose mode mix turns once per loop is
// fed back through modulateScale and modulatePixelate (the compounding blocks of image 37), posterized
// and ramped through the Bauhaus inks, inside a survey sheet whose panel prints the live values.
//
// Inputs: size (px, 256 to 3840), frame index k. Cadence: 12 unique frames per second, each shown
// twice at 24 fps (24 on twos, the `lu7` cadence). Loop: 10 s = 120 unique frames; a warm-up loop runs
// first so the feedback state at the seam matches. Deterministic: same size and seed, same pixels.
// Budget: about 0.3 s per unique frame at 1080 x 1080 in node (measured in PROGRESS.md).
import { sheet, Layer } from './layer.mjs';
import { fromField, noise, membrane, crossingsOf } from './sources.mjs';
import * as H from './hud.mjs';
import { readout, text } from './numerals.mjs';
import { INK } from './pieces-sheets.mjs';

export const LOOP_S = 10, UNIQUE_FPS = 12, FPS = 24, UNIQUE = LOOP_S * UNIQUE_FPS;
const A = [3, 5, 30], B = [5, 2, 60];

export function field(theta) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return (u, v) => c * membrane(...A.slice(0, 2), A[2], u, v) + s * membrane(...B.slice(0, 2), B[2], u, v);
}

export function createFeedback(size, { seed = 37 } = {}) {
  const S0 = sheet(size, size, { seed }), I = S0.inner, u = I.w / 1000, fw = Math.round(1000 * u), fh = Math.round(760 * u);
  return { size, seed, u, fw, fh, F: new Layer(fw, fh, { seed }), Nz: noise(fw, fh, { scale: 3, seed }), k: -UNIQUE };
}

// Advance one unique frame. Returns the sheet for frame st.k (st.k counts up from -UNIQUE; 0 starts the record).
export function step(st) {
  const kk = ((st.k % UNIQUE) + UNIQUE) % UNIQUE, theta = (2 * Math.PI * kk) / UNIQUE, f = field(theta), { fw, fh, u } = st;
  const Bf = fromField(fw, fh, (x, y) => Math.exp(-((f(x, y) / 0.09) ** 2)), { seed: st.seed });
  const F = st.F; F.modulateScale({ by: Bf, amount: 0.035 }).modulatePixelate({ by: st.Nz, min: Math.max(1, Math.round(1.5 * u)), max: Math.max(8, Math.round(24 * u)) });
  for (let i = 0; i < F.px.length; i++) F.px[i] = Math.min(1, F.px[i] * 0.86 + Bf.px[i] * 0.5);
  st.k++;
  // the sheet seed follows kk, so the grain boils once per unique frame and loops with the piece
  const S = sheet(st.size, st.size, { ground: INK.paper, seed: st.seed * 1000 + kk }), X = (v) => S.inner.x + v * u, Y = (v) => S.inner.y + v * u, hair = Math.max(1, 1.1 * u);
  S.place(F.clone().posterize({ levels: 6 }).ramp({ stops: [INK.black, INK.blue, INK.red, INK.yellow, '#e9e2d0'] }), X(0), Y(0));
  for (let i = 0; i < 4; i++) { const x = X(1000 * (0.2 + 0.2 * i + 0.03 * Math.sin(theta + i))); H.rule(S, x, Y(0), x, Y(760), { w: hair, ink: INK.hair, alpha: 0.5 }); }
  const cr = crossingsOf(f, Math.PI * 5, 128);
  for (const q of cr) H.crosshair(S, X(q[0] * 1000), Y(q[1] * 760), 9 * u, { w: hair, ink: INK.hair });
  S.place(new Layer(fw, Math.round(220 * u)).fill(INK.black), X(0), Y(780));
  const px = Math.max(1, Math.round(2 * u)), deg = Math.round((theta * 180) / Math.PI);
  readout(S, [['MODES', '3x5 + 5x2'], ['MIX', `${deg}°`], ['CROSSINGS', String(cr.length)], ['FRAME', `${String(kk * 2).padStart(3, '0')}/240`]], X(24), Y(800), { px, ink: INK.hair, rule: INK.grey });
  text(S, `LOOP ${LOOP_S}.0 S  24 FPS ON TWOS`, X(976), Y(960), { px, ink: INK.hair, align: 'right' });
  H.dashedCircle(S, X(860), Y(870), 60 * u, { w: hair, ink: INK.hair, dash: 5 * u, gap: 4 * u });
  H.rule(S, X(860), Y(870), X(860) + 56 * u * Math.cos(theta), Y(870) + 56 * u * Math.sin(theta), { w: 2 * hair, ink: INK.yellow });
  return { sheet: S, grain: { std: 0.015, size: st.size / 700 }, meta: { k: kk, theta, crossings: cr.length } };
}
