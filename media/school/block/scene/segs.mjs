// The block film's segments (lesson L11), in the lighthouse cutaway (tower.mjs). Every norm, loss,
// accuracy and count drawn is a facts.json value (F); timings from film.scene.mjs's cue map (T).
import { rect, words, span, label, C, darkness } from "../../shared/lib.mjs";
import { night, glazing } from "../../attention/scene/room.mjs";
import { host } from "../../embeddings/scene/segs.mjs";
import { INK, YS, shell, beam, room, tap, readout } from "./tower.mjs";

const norms = (F) => F.stream.trained.steps.map((s) => s.norm);
const pct = (v) => `${Math.round(v * 100)}%`;
const abl = (F, name, mode = "zero") => F.ablations.trained.rows.find((r) => r.name === name && r.mode === mode);
const lab = (A, s, size, x, y, fill = INK.night, anchor = "left", a = 1) => ({ shape: words(s, A.mono, size, x, y, anchor), fill, opacity: a, screen: true });
const base = (t) => [...night(t, { moon: false }), ...glazing(), ...shell()];
const scene = (t, A, items) => ({ items: [...items, darkness(380, 760, 1900, 0.3), ...host(t, A)], camera: { x: 960, y: 540, zoom: 1 } });
const rooms = (A, a = 1, state = () => "on", heads = () => null) => [0, 1, 2, 3].flatMap((i) => room(A, i, { a, state: state(i), heads: heads(i) }));

export function open(t, A, T, F) {
  const lit = span(t, 0.8, 1.6);
  return { items: [...base(t), ...beam(norms(F), 0.15 + 0.6 * span(t, 1.6, 4), { a: lit }), darkness(400, 700, 300 + 1300 * lit, 0.95 - 0.5 * lit), ...host(t, A, { flame: lit })], camera: { x: 960, y: 540, zoom: 1.05 - 0.05 * span(t, 0, 4) } };
}
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end));
  return scene(t, A, [...base(t), ...beam(norms(F), 4, { a: 0.4 }), ...rooms(A, 0.4), label(A, "The transformer block", 84, 960, 60, C.ink, "center", a, "head"), label(A, "two floors, one stream", 32, 960, 1045, INK.dim, "center", span(t, T.sub, T.sub + 0.6) * a)]);
}

// The stream: the two tables added on the ground floor; rooms add on the way up; the norm taps.
export function stream(t, A, T, F) {
  const up = span(t, T.add, T.add + 6) * 4, items = [...base(t), ...beam(norms(F), Math.max(0.2, up)), ...rooms(A, span(t, T.add, T.add + 1))];
  items.push(lab(A, `word table + place table: ${F.params.config.dModel} numbers`, 24, 120, 140, INK.night, "left", span(t, T.start + 2, T.start + 3)));
  if (t >= T.norm) { [0, 1, 2, 3].forEach((i) => items.push(...tap(i, span(t, T.norm, T.norm + 1)))); items.push(lab(A, "layer norm: each room reads a rescaled copy; the stream is left alone", 22, 120, 180, [0.7, 0.82, 0.95], "left", span(t, T.norm, T.norm + 1))); }
  return scene(t, A, items);
}

// The two rooms; the parameter counts as bars.
export function rooms2(t, A, T, F) {
  const P = F.params.counts, at = t >= T.mlp ? [1, 3] : [0, 2], items = [...base(t), ...beam(norms(F), 4, { a: 0.6 }), ...rooms(A, 1, (i) => (at.includes(i) ? "lit" : "on"), (i) => (i % 2 === 0 && t < T.mlp ? [1, 1] : null))];
  if (t >= T.mlp) items.push(lab(A, `${F.params.config.dModel} to ${F.params.config.dFF} to ${F.params.config.dModel}, per word`, 24, 1240, 130, INK.night, "left", span(t, T.mlp, T.mlp + 0.6)));
  if (t >= T.count) {
    const parts = [["attention", P.attention], ["MLP", P.mlp], ["embeddings", P.embeddings], ["output", P.output], ["norms", P.norms]], g = span(t, T.count, T.count + 1);
    items.push({ shape: rect(80, 120, 620, 300, 10), fill: [0.03, 0.03, 0.04, 0.8 * g], screen: true });
    parts.forEach(([n, v], k) => items.push(lab(A, n, 22, 100, 170 + k * 52, INK.night, "left", g), { shape: rect(260, 150 + k * 52, (v / P.total) * 1000, 26, 3), fill: [0.89, 0.84, 0.71, g], screen: true }, lab(A, v.toLocaleString("en"), 22, 270 + (v / P.total) * 1000, 170 + k * 52, INK.dim, "left", g)));
  }
  return scene(t, A, items);
}

// The readout on each landing: loss, then copy accuracy.
export function climb(t, A, T, F) {
  const L = F.lens.trained, items = [...base(t), ...beam(norms(F), 4), ...rooms(A, 0.8)], at = [T.l0, T.l0, T.l1, T.l1, T.l2];
  L.forEach((l, i) => { if (t >= at[i]) items.push(readout(A, i, t >= T.copy ? `copies ${pct(l.copyAccuracy)}` : `loss ${l.loss.toFixed(2)}`, span(t, at[i], at[i] + 0.6), t >= T.copy ? INK.ember : INK.night)); });
  return scene(t, A, items);
}

// Knockouts: heads and rooms switched off, the copy rate or loss beside them.
export function knockout(t, A, T, F) {
  const B = F.ablations.trained.base, items = [...base(t)];
  let off = -1, heads = () => null, note = `everything on: copies ${pct(B.copyAccuracy)}, loss ${B.loss.toFixed(2)}`;
  if (t >= T.h1) { heads = (i) => (i === 2 ? [1, 0] : null); note = `top floor, head 2 off: copies ${pct(abl(F, "l1.h1").copyAccuracy)}`; }
  if (t >= T.h0) { heads = (i) => (i === 2 ? [0, 1] : null); note = `top floor, head 1 off: copies ${pct(abl(F, "l1.h0").copyAccuracy)}`; }
  if (t >= T.low) { heads = (i) => (i === 0 ? [1, 0] : null); note = `first floor, head 2 off: copies ${pct(abl(F, "l0.h1").copyAccuracy)}`; }
  if (t >= T.mlp) { heads = () => null; off = 1; note = `first floor MLP off: loss ${abl(F, "l0.mlp").loss.toFixed(2)} (a blind guess: ${Math.log(F.params.config.vocab).toFixed(2)})`; }
  if (t >= T.untrained) { off = -1; const d = Math.max(...F.ablations.untrained.rows.map((r) => Math.abs(r.loss - F.ablations.untrained.base.loss))); note = `untrained model: no switch moves the loss by more than ${d.toFixed(3)}`; }
  items.push(...beam(norms(F), 4, { a: off >= 0 ? 0.5 : 1 }), ...[0, 1, 2, 3].flatMap((i) => room(A, i, { state: i === off ? "off" : "on", heads: heads(i) || (i % 2 === 0 ? [1, 1] : null) })));
  items.push({ shape: rect(560, 990, 1300, 60, 10), fill: [0.03, 0.03, 0.04, 0.75], screen: true }, lab(A, note, 26, 590, 1030, INK.night, "left", 1));
  return scene(t, A, items);
}

// Replace instead of add: the beam above the replaced room is cut and restarted from its answer.
export function residual(t, A, T, F) {
  const R = F.residual.trained.rows, items = [...base(t)], odd = t >= T.odd, i = odd ? 1 : 2, r = R[i];
  items.push(...beam(norms(F), 4, { cut: t >= T.top ? i + 1 : -1 }), ...[0, 1, 2, 3].flatMap((k) => room(A, k, { state: t >= T.top && k === i ? "lit" : "on", label: t >= T.top && k === i ? "replaces" : null })));
  if (t >= T.top) items.push({ shape: rect(560, 990, 1300, 60, 10), fill: [0.03, 0.03, 0.04, 0.75], screen: true },
    lab(A, odd ? `first floor MLP adds ${F.stream.trained.adds[1].ratioToStream.toFixed(1)} times the stream: replacing it, loss ${r.loss.toFixed(2)}` : `top floor attention replaces the stream: loss ${r.loss.toFixed(2)} (adding: ${F.residual.trained.base.loss.toFixed(2)})`, 26, 590, 1030, INK.night, "left", 1));
  return scene(t, A, items);
}

export function close(t, A, T, F) {
  const dim = span(t, T.night, T.end), items = [...base(t), ...beam(norms(F), 4, { a: 1 - 0.6 * dim }), ...rooms(A, 1 - 0.6 * dim)];
  items.push({ shape: rect(860, 60, 200, 90, 8), fill: [1, 0.8, 0.5, 0.25 * (1 - dim)], blend: "add" });
  return scene(t, A, items);
}
