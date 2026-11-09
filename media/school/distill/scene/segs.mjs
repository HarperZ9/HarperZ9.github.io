// The distillation film's segments (lesson S17), in Tallow's lamp room (PROGRESS.md, step 38): the
// teacher's big brass wheel, the student's small one, and the hard label as a wheel with one slot.
// Every share and loss drawn is a facts.json value (F); timings from the cue map in film.scene.mjs (T).
import { rect, circle, words, span, label, C, darkness } from "../../shared/lib.mjs";
import { host } from "../../embeddings/scene/segs.mjs";
import { night, glazing } from "../../attention/scene/room.mjs";
import { INK, wheel, pointer, lab, plateRect } from "../../nextword/scene/wheel.mjs";

export const TW = { x: 760, y: 520, r: 300 }, SW = { x: 1460, y: 560, r: 190 }, HW = { x: 1460, y: 560, r: 150 };
const N = 46, even = new Array(N).fill(1 / N);
const order = (d) => d.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(([, i]) => i);
const pick = (d, o) => o.map((i) => d[i]);
const mixS = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const scene = (t, A, items, cam = { x: 960, y: 540, zoom: 1 }) => ({ items: [...items, darkness(380, 700, 1900, 0.35), ...host(t, A)], camera: cam });
const ctxOf = (F, k) => F.film.contexts[k];
const names = (F, o) => o.map((i) => F.film.vocab[i]);
// A word card clipped above the teacher's wheel: the words so far.
const stand = (A, w, a = 1) => { const wd = Math.max(240, w.length * 20 + 60);
  return [{ shape: rect(TW.x - wd / 2, 100, wd, 64, 4), fill: [0.89, 0.84, 0.71, a], stroke: "#2a2219", width: 2 }, { shape: words(w, A.sans, 32, TW.x, 144, "center"), fill: INK.ink, opacity: a }]; };
// The hard label: a small wheel whose one slot is the word the text happened to say.
const hard = (A, F, o, word, a = 1, at = HW) => [...wheel(A, pick(F.film.vocab.map((w) => (w === word ? 1 : 0)), o), names(F, o), { at, hot: () => true, a, size: 24, minLabel: 0.5 }), ...pointer(at, a)];

export function open(t, A, T, F) {
  const lit = span(t, 0.8, 1.6), c = ctxOf(F, 0), o = order(c.teacher.T1);
  const items = [...roomD(t, 0.3 * lit), ...wheel(A, pick(c.teacher.T1, o), names(F, o), { at: TW, turn: t * 0.1, a: 0.5 + 0.5 * lit, minLabel: 1 }), ...wheel(A, even, names(F, o), { at: SW, a: 0.4 + 0.4 * lit, minLabel: 1 })];
  return { items: [...items, darkness(400, 600, 300 + 1200 * lit, 0.95 - 0.5 * lit), ...host(t, A, { flame: lit })], camera: { x: 960, y: 540, zoom: 1.05 - 0.05 * span(t, 0, 4) } };
}
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end)), c = ctxOf(F, 0), o = order(c.teacher.T1);
  return scene(t, A, [...roomD(t), ...wheel(A, pick(c.teacher.T1, o), names(F, o), { at: TW, turn: t * 0.1, a: 0.5, minLabel: 1 }), ...wheel(A, even, names(F, o), { at: SW, a: 0.4, minLabel: 1 }),
    label(A, "Distillation", 92, 960, 105, C.ink, "center", a, "head"), label(A, "a big teacher, a small student", 34, 960, 158, INK.dim, "center", span(t, T.sub, T.sub + 0.6) * a)]);
}

// After "rerun knocked": the rules' half and half, the text's one word, the teacher's split, then how often the next word is open.
export function labels(t, A, T, F) {
  const c = ctxOf(F, 1), o = order(c.generator.map((v, i) => v + c.teacher.T1[i] * 1e-3)), u = span(t, T.soft, T.soft + 2);
  const shares = mixS(pick(c.generator, o), pick(c.teacher.T1, o), u), items = [...roomD(t, 0.3), ...stand(A, "rerun knocked")];
  items.push(...wheel(A, shares, names(F, o), { at: TW, pct: (k) => k < 2, minLabel: 0.05 }), ...pointer(TW));
  items.push(lab(A, u < 0.5 ? "the rules' own odds" : "the teacher's guess: a soft target", 24, TW.x, TW.y + TW.r + 70, u < 0.5 ? [0.7, 0.82, 0.95] : INK.night, "center"));
  if (t >= T.text) { const a = span(t, T.text, T.text + 0.8); items.push(...hard(A, F, o, "on", a), lab(A, 'the text says "on": a hard label', 24, HW.x, HW.y + HW.r + 70, INK.ember, "center", a)); }
  if (t >= T.torn) {
    const a = span(t, T.torn, T.torn + 0.8), k = Math.round(F.darkKnowledge.torn * 20);
    items.push(plateRect(560, 900, 1300, 120, 0.7 * a));
    for (let i = 0; i < 20; i++) items.push({ shape: circle(620 + i * 40, 985, 13, 20), fill: i < k ? [0.89, 0.58, 0.45, a] : [0.3, 0.27, 0.24, a], screen: true });
    items.push(lab(A, `${Math.round(F.darkKnowledge.torn * 100)}% of held-out words: the next word is open`, 24, 600, 940, INK.night, "left", a));
  }
  return scene(t, A, items);
}

// Temperature: the teacher's wheel after "tallow found a" softens from T 1 to 2 to 4; the student's matches; the two sizes.
export function temperature(t, A, T, F) {
  const c = ctxOf(F, 0), o = order(c.teacher.T1), u2 = span(t, T.t2, T.t2 + 1.5), u4 = span(t, T.t4, T.t4 + 1.5);
  const s = mixS(mixS(pick(c.teacher.T1, o), pick(c.teacher.T2, o), u2), pick(c.teacher.T4, o), u4), Tn = u4 > 0.5 ? 4 : u2 > 0.5 ? 2 : 1;
  const items = [...roomD(t, 0.3), ...stand(A, "tallow found a"), ...wheel(A, s, names(F, o), { at: TW, pct: (k) => k < 3, minLabel: 0.055 }), ...pointer(TW),
    lab(A, `temperature ${Tn}`, 30, TW.x, TW.y + TW.r + 70, INK.ember, "center", span(t, T.start + 1, T.start + 2))];
  if (t >= T.student && t < T.sizes) { const a = span(t, T.student, T.student + 0.8); items.push(...wheel(A, pick(c.studentSoft, o), names(F, o), { at: SW, a, minLabel: 0.08, size: 22 }), ...pointer(SW, a), lab(A, "the student, softened the same way", 22, SW.x, SW.y + SW.r + 70, INK.night, "center", a)); }
  if (t >= T.square && t < T.sizes) items.push(lab(A, "soft loss times temperature squared", 26, SW.x, 230, INK.night, "center", span(t, T.square, T.square + 0.8)));
  if (t >= T.sizes) items.push(...sizes(A, F, span(t, T.sizes, T.sizes + 1.2)));
  return scene(t, A, items);
}
// Teacher and student as blocks of numbers, area to scale.
function sizes(A, F, a) {
  const tn = F.teacher.nParams, sn = F.students.sizes.d16x1.nParams, side = (n) => Math.sqrt(n) * 2.2, x = 1200, y = 300, out = [plateRect(1120, 200, 720, 640, 0.6 * a)];
  out.push({ shape: rect(x, y, side(tn), side(tn), 4), fill: [0.89, 0.84, 0.71, 0.85 * a], screen: true }, { shape: rect(x + side(tn) + 30, y + side(tn) - side(sn), side(sn), side(sn), 4), fill: [0.89, 0.58, 0.45, a], screen: true });
  out.push(lab(A, `teacher: ${tn.toLocaleString("en")} numbers`, 22, x, y + side(tn) + 40, INK.night, "left", a), lab(A, `student: ${sn.toLocaleString("en")}`, 22, x + side(tn) + 30, y + side(tn) + 80, INK.ember, "left", a));
  return out;
}

// A board of held-out losses: one bar per arm to its mean, a dot per seed, the teacher's line.
export function board(A, F, rows, { min, max, a = 1, y0 = 250, title = "", teacher = true }) {
  const X0 = 1000, W = 760, X = (v) => X0 + ((Math.min(v, max) - min) / (max - min)) * W, out = [plateRect(520, y0 - 90, 1360, 150 + rows.length * 96, 0.6 * a)];
  out.push(lab(A, title, 24, 560, y0 - 40, INK.dim, "left", a));
  if (teacher) out.push({ shape: rect(X(F.teacher.heldOut) - 1, y0 - 20, 3, rows.length * 96, 0), fill: [0.7, 0.82, 0.95, 0.8 * a], screen: true }, lab(A, `teacher ${F.teacher.heldOut.toFixed(2)}`, 20, X(F.teacher.heldOut), y0 + rows.length * 96 + 14, [0.7, 0.82, 0.95], "center", a));
  rows.forEach((r, i) => {
    const y = y0 + i * 96, b = r.show ?? 1;
    out.push(lab(A, r.name, 24, 560, y + 26, r.hot ? INK.ember : INK.night, "left", a));
    if (b <= 0) return;
    out.push({ shape: rect(X0, y, Math.max(3, (X(r.mean) - X0) * b), 34, 3), fill: r.hot ? [0.89, 0.58, 0.45, a] : [0.89, 0.84, 0.71, 0.85 * a], screen: true });
    for (const v of r.values || []) out.push({ shape: circle(X(v), y + 17, 6, 12), fill: [0.1, 0.08, 0.06, a * b], screen: true });
    if (r.best !== undefined) out.push({ shape: circle(X(r.best), y + 17, 10, 16), fill: null, stroke: [0.7, 0.82, 0.95, a * b], width: 3, screen: true });
    out.push(lab(A, r.text ?? r.mean.toFixed(2), 24, Math.min(X(r.mean), X0 + W) + 18, y + 26, INK.night, "left", a * b));
  });
  return out;
}
// The lamp room without the lens or the moon: the wheels and boards need the glass to themselves.
export const roomD = (t) => [...night(t, { moon: false }), ...glazing()];
export const arm = (R, k, name, extra = {}) => ({ name, mean: R[k].heldOut.mean, values: R[k].heldOut.values, ...extra });
