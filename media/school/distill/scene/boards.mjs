// The distillation film's later segments (lesson S17): the boards of held-out losses with plenty of
// text and with a small pool, the two teachers that fail, and the close. Bars wait for each held
// question. Every value drawn is a facts.json value (F).
import { rect, span } from "../../shared/lib.mjs";
import { host } from "../../embeddings/scene/segs.mjs";
import { INK, wheel, pointer, lab, plateRect } from "../../nextword/scene/wheel.mjs";
import { darkness } from "../../shared/lib.mjs";
import { TW, SW, board, arm, roomD } from "./segs.mjs";

const scene = (t, A, items) => ({ items: [...items, darkness(380, 700, 1900, 0.35), ...host(t, A)], camera: { x: 960, y: 540, zoom: 1 } });
const order = (d) => d.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(([, i]) => i);
const pick = (d, o) => o.map((i) => d[i]);
const reveal = (t, t0, i) => span(t, t0 + i * 0.5, t0 + i * 0.5 + 0.8);

export function plenty(t, A, T, F) {
  const R = F.fullData.arms, go = T.ask.held, items = [...roomD(t, 0.2)];
  const rows = [arm(R, "hard", "the text's words"), arm(R, "soft1", "teacher, temperature 1"), arm(R, "soft2", "teacher, temperature 2", { hot: true }), arm(R, "soft4", "teacher, temperature 4"), arm(R, "soft8", "teacher, temperature 8")]
    .map((r, i) => ({ ...r, show: i === 0 ? span(t, T.hard, T.hard + 0.8) : reveal(t, go, i) }));
  items.push(...board(A, F, rows, { min: 0.6, max: 0.8, title: "held-out loss with fresh text, three students each (dots), lower is better" }));
  if (t >= T.agree) {
    const a = span(t, T.agree, T.agree + 0.8);
    items.push(plateRect(560, 800, 1300, 100, 0.7 * a), lab(A, `picks the teacher's top word: taught by the wheel ${Math.round(R.soft2.agreement.mean * 100)}%, taught by the text ${Math.round(R.hard.agreement.mean * 100)}%`, 26, 600, 862, INK.night, "left", a));
  }
  return scene(t, A, items);
}

// A pile of rows, one card each, lit in turn as the student reads them again and again.
function pile(A, P, t, a) {
  const out = [], cols = 8, n = P.small;
  for (let i = 0; i < n; i++) { const x = 600 + (i % cols) * 54, y = 820 + Math.floor(i / cols) * 40, hot = Math.floor(t * 8) % n === i;
    out.push({ shape: rect(x, y, 46, 32, 3), fill: hot ? [0.89, 0.58, 0.45, a] : [0.89, 0.84, 0.71, 0.8 * a], stroke: "#2a2219", width: 1, screen: true }); }
  out.push(lab(A, `${n} rows of ${P.words} words, each read ${P.passesSmall.toLocaleString("en")} times`, 22, 1060, 860, INK.night, "left", a));
  return out;
}

export function little(t, A, T, F) {
  const L = F.lowData, P = L.pool, go = T.ask.held, items = [...roomD(t, 0.2)];
  const rows = [arm(L.pool32, "hard", "32 rows: the text's words", { best: L.pool32.hard.bestHeldOut.mean, show: span(t, T.hard, T.hard + 1.2) }), arm(L.pool32, "soft2", "32 rows: the teacher's wheel", { hot: true, best: L.pool32.soft2.bestHeldOut.mean, show: reveal(t, go, 1) }),
    arm(L.pool256, "hard", "256 rows: the text's words", { best: L.pool256.hard.bestHeldOut.mean, show: span(t, T.mid, T.mid + 0.8) }), arm(L.pool256, "soft2", "256 rows: the teacher's wheel", { hot: true, show: span(t, T.mid + 1.5, T.mid + 2.3) })];
  rows[0].name = `${P.small} rows: the text's words`; rows[1].name = `${P.small} rows: the teacher's wheel`; rows[2].name = `${P.mid} rows: the text's words`; rows[3].name = `${P.mid} rows: the teacher's wheel`;
  items.push(...board(A, F, rows, { min: 0, max: 5, title: "held-out loss on a small pile of rows; ring: the best check along the way" }));
  if (t >= T.pool && t < T.mid) items.push(...pile(A, P, t, span(t, T.pool, T.pool + 0.8)));
  if (t >= T.caution) items.push(plateRect(560, 800, 1300, 100, 0.7), lab(A, "the teacher learned from far more text than these rows", 26, 600, 862, INK.dim, "left", span(t, T.caution, T.caution + 0.8)));
  return scene(t, A, items);
}

export function wrong(t, A, T, F) {
  const R = F.fullData.arms, items = [...roomD(t, 0.2)];
  const rows = [arm(R, "argmax", "the teacher's top word, as if certain", { show: span(t, T.argmax, T.argmax + 1) }), { name: "counting words", mean: F.controls.unigramLoss, show: span(t, T.counts, T.counts + 0.8) },
    { name: "a teacher that never trained", mean: F.controls.untrainedTeacher.heldOut.mean, values: F.controls.untrainedTeacher.heldOut.values, show: span(t, T.untrained, T.untrained + 1) },
    arm(R, "oracle1", "the rules' own odds", { hot: true, show: span(t, T.oracle, T.oracle + 1) }), arm(R, "hard", "the text's words", { show: span(t, T.oracle + 1, T.oracle + 2) })];
  items.push(...board(A, F, rows, { min: 0, max: 4, title: "held-out loss with fresh text, three students each" }));
  if (t >= T.copy && t < T.untrained) items.push(plateRect(560, 800, 1300, 100, 0.7), lab(A, `top word as if certain: look-back words ${Math.round(R.argmax.copyAccuracy.mean * 100)}% right`, 26, 600, 862, INK.night, "left", span(t, T.copy, T.copy + 0.8)));
  return scene(t, A, items);
}

export function close(t, A, T, F) {
  const c = F.film.contexts[0], o = order(c.teacher.T1), dim = span(t, T.night, T.end), names = o.map((i) => F.film.vocab[i]);
  return scene(t, A, [...roomD(t, 0.3 * (1 - dim)), ...wheel(A, pick(c.teacher.T1, o), names, { at: TW, turn: t * 0.12, a: 1 - 0.5 * dim, minLabel: 0.07 }), ...pointer(TW, 1 - dim),
    ...wheel(A, pick(c.studentSoft, o), names, { at: SW, turn: t * 0.12, a: 1 - 0.5 * dim, minLabel: 0.09, size: 22 }), ...pointer(SW, 1 - dim)]);
}
