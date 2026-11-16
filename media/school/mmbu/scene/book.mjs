// The MMBU film's pictures (lesson S20), in Tallow's lamp room (PROGRESS.md, step 84): the logbook page,
// each run a ruled line with its bar drawn in pencil before its interval is inked across it; bars of
// shares; the two answer keys; the runs' burn lines; the ledger's entries. Every value drawn is a
// facts.json value (F); timings from the cue map in film.scene.mjs (T).
import { rect, circle, span, darkness } from "../../shared/lib.mjs";
import { host } from "../../embeddings/scene/segs.mjs";
import { night, glazing } from "../../attention/scene/room.mjs";
import { lab, INK } from "../../nextword/scene/wheel.mjs";

export const PAPER = [0.89, 0.84, 0.71], EMBER = [0.89, 0.58, 0.45], DARK = [0.16, 0.14, 0.12], PENCIL = [0.45, 0.42, 0.37], RULE = [0.6, 0.55, 0.45];
export const PAGE = { x: 560, y: 110, w: 1260, h: 840 };
export const room = (t) => [...night(t, { moon: false }), ...glazing()];
export const scene = (t, A, items) => ({ items: [...items, darkness(380, 700, 1900, 0.3), ...host(t, A)], camera: { x: 960, y: 540, zoom: 1 } });
export const page = (a = 1) => [{ shape: rect(PAGE.x, PAGE.y, PAGE.w, PAGE.h, 8), fill: [...PAPER, a], screen: true }];
export const ink = (A, s, size, x, y, a = 1, col = INK.ink, anchor = "left") => lab(A, s, size, x, y, col, anchor, a);
const sgn = (v, d = 3) => `${v > 0 ? "+" : ""}${v.toFixed(d)}`;
export const ivText = (r, d = 3) => `${sgn(r.mean, d)} [${r.lo.toFixed(d)}, ${r.hi.toFixed(d)}]`;

// The logbook's run lines. rows: { name, r (mean, lo, hi), bar, show (0..1 the line), pencil (0..1), inked (0..1) }.
export function logbook(t, A, rows, { title = "the logbook: the bar first, the result after", a = 1 } = {}) {
  const out = [...page(a)], X = (v) => 1080 + ((v + 0.03) / 0.09) * 640, y0 = 270;
  out.push(ink(A, title, 24, 610, 175, a));
  out.push({ shape: rect(X(-0.03), 205, X(0.06) - X(-0.03), 2), fill: [...RULE, 0.5 * a], screen: true });
  [-0.02, 0, 0.02, 0.04].forEach((v) => out.push(ink(A, sgn(v, 2).replace("+0.00", "0"), 16, X(v), 230, 0.7 * a, "#5d564b", "center")));
  rows.forEach((row, i) => {
    const y = y0 + i * 150, s = row.show ?? 1;
    if (s <= 0) return;
    out.push({ shape: rect(600, y + 46, 1180, 2), fill: [...RULE, 0.6 * s * a], screen: true }, ink(A, row.name, 26, 610, y + 30, s * a));
    const p = row.pencil ?? 1;
    if (p > 0) out.push({ shape: rect(X(row.bar) - 2, y + 46 - 70 * p, 4, 70 * p), fill: [...PENCIL, s * a], screen: true });
    const k = row.inked ?? 0;
    if (k > 0) {
      const met = row.r.lo > row.bar, col = met ? DARK : EMBER;
      out.push({ shape: rect(X(row.r.lo), y + 6, (X(row.r.hi) - X(row.r.lo)) * k, 8, 3), fill: [...col, a], screen: true },
        { shape: circle(X(row.r.mean), y + 10, 9, 16), fill: [...col, k * a], screen: true },
        ink(A, `${ivText(row.r)}  ${met ? "bar met" : "bar missed"}`, 22, 1100, y + 80, k * a));
    }
  });
  return out;
}

// Horizontal bars of shares (0 to 1) on the page: { name, v, at, hot }.
export function shares(t, A, rows, { x0 = 1120, w = 620, y0 = 260, step = 92, max = 0.5, a = 1, unit = "percent" } = {}) {
  const out = [];
  rows.forEach((r, i) => {
    const u = span(t, r.at, r.at + 0.9), y = y0 + i * step;
    if (u <= 0) return;
    out.push(ink(A, r.name, 26, 610, y + 22, u * a), { shape: rect(x0, y, Math.max(2, (w * r.v * u) / max), 28, 3), fill: r.hot ? [...EMBER, a] : [...DARK, 0.85 * a], screen: true },
      ink(A, `${(r.v * 100).toFixed(1)} ${unit}`, 24, x0 + (w * r.v * u) / max + 14, y + 22, u * a));
  });
  return out;
}

// The two answer keys: replies on the left, the key on the right, flipping from old words to new.
export function keys(t, A, F, T) {
  const V = F.vocab.ft7minusFt6, flip = span(t, T.flip, T.flip + 1.2), out = [...page()];
  const rows = [["X-ray", "X-Ray Imaging"], ["Light Microscopy", "light microscopy"], ["Ultrasound", "Ultrasound Imaging"]];
  out.push(ink(A, "the same replies, scored against two answer keys", 22, 610, 175));
  rows.forEach(([now, old], i) => {
    const y = 240 + i * 100, ok = flip > 0.5;
    out.push({ shape: rect(610, y, 440, 70, 6), fill: [0.97, 0.94, 0.86, 1], screen: true }, ink(A, `reply: ${now}`, 22, 630, y + 44));
    out.push({ shape: rect(1100, y, 480, 70, 6), fill: [...DARK, 0.9], screen: true }, ink(A, `key: ${ok ? now : old}`, 22, 1120, y + 44, 1, INK.night));
    out.push(ink(A, ok ? "match" : "no match", 20, 1610, y + 44, 1, ok ? INK.ink : "#a8502e"));
  });
  const o = V.original, h = V.harmonised;
  out.push(ink(A, `the sources' own key: ${ivText(o)}`, 22, 610, 630, span(t, T.fall, T.fall + 0.8), "#a8502e"));
  out.push(ink(A, `the key in the paper's words: ${ivText(h)}`, 22, 610, 690, span(t, T.flip + 1, T.flip + 1.8)));
  out.push(ink(A, `${F.recomputed.vocabRows.toLocaleString("en")} held-out rows, ${F.recomputed.vocabClusters} source clusters; seventh run minus sixth`, 18, 610, 760, span(t, T.fall, T.fall + 0.8), "#5d564b"));
  out.push(ink(A, "a measurement made after the fall, not a preregistered test", 20, 610, 830, span(t, T.neutral, T.neutral + 0.8)));
  return out;
}

// Burn lines: a run's steps as a line with a notch at every checkpoint, and what happened on it.
export function burn(t, A, F, T) {
  const S = F.records.survival, out = [...page()], X = (s, n) => 640 + (s / n) * 1080, u = span(t, T.start, T.start + 3);
  out.push(ink(A, `three runs; a notch at every checkpoint (every ${S.checkpointEvery} steps)`, 22, 610, 175));
  const line = (y, n, name, a) => { out.push(ink(A, name, 20, 640, y - 24, a), { shape: rect(640, y, 1080 * u, 6, 3), fill: [...DARK, a], screen: true });
    for (let s = 0; s <= n * u; s += S.checkpointEvery) out.push({ shape: rect(X(s, n) - 1, y - 8, 2, 22), fill: [...RULE, a], screen: true }); };
  const a1 = span(t, T.start, T.start + 0.8), a2 = span(t, T.idle, T.idle + 0.8), a3 = span(t, T.dup, T.dup + 0.8);
  line(330, S.ft7Steps, `seventh run, ${S.ft7Steps.toLocaleString("en")} steps`, a1);
  out.push({ shape: rect(X(S.saveStep, S.ft7Steps) - 3, 290, 6, 70), fill: [...EMBER, a1], screen: true }, ink(A, `shutdown: step ${S.saveStep} saved, nothing lost`, 20, X(S.saveStep, S.ft7Steps) + 14, 300, a1));
  line(520, S.ft5Steps, `fifth run, larger model, ${S.ft5Steps.toLocaleString("en")} steps`, a2);
  out.push({ shape: rect(X(0, S.ft5Steps), 500, 26, 46), fill: [...EMBER, 0.85 * a2], screen: true }, ink(A, `a branch that had never run: about ${S.idleHours} hours idle`, 20, X(0, S.ft5Steps) + 40, 512, a2, "#a8502e"));
  line(710, S.ft6Steps, `sixth run, ${S.ft6Steps.toLocaleString("en")} steps`, a3);
  out.push({ shape: rect(X(300, S.ft6Steps), 724, X(300 + S.dupSteps, S.ft6Steps) - X(300, S.ft6Steps), 6, 3), fill: [...EMBER, a3], screen: true }, ink(A, `two trainers at once: ${S.dupSteps} steps lost`, 20, X(300 + S.dupSteps, S.ft6Steps) + 14, 744, a3, "#a8502e"));
  out.push(ink(A, "now: if a check cannot tell, the trainer counts as alive", 20, 640, 860, span(t, T.fix, T.fix + 0.8)));
  return out;
}

// The ledger: one small square per entry number; the pushed ones inked, the rest outlined.
export function ledger(t, A, F, T) {
  const L = F.ledger, R = F.records.ledger, out = [...page()], n = L.lastEntry, cols = 15, c = 40;
  out.push(ink(A, `the ledger: entries 1 to ${n}`, 22, 610, 175));
  for (let i = 1; i <= n; i++) {
    const col = (i - 1) % cols, row = Math.floor((i - 1) / cols), x = 640 + col * c, y = 220 + row * c, pushed = i <= L.lastPushedEntry;
    const a = span(t, T.start + i * 0.01, T.start + 0.5 + i * 0.01), lit = pushed ? 1 : span(t, T.local, T.local + 0.8);
    out.push({ shape: rect(x, y, c - 8, c - 8, 3), fill: pushed && t >= T.pushed ? [...DARK, a] : [...RULE, 0.35 * a], screen: true });
    if (!pushed && lit > 0) out.push({ shape: rect(x + 6, y + 6, c - 20, c - 20, 2), fill: [...EMBER, 0.8 * lit], screen: true });
  }
  out.push(ink(A, `${R.filesMatched} rule files match: ${R.fullMatch} by full fingerprint, ${R.prefixMatch} by prefix`, 20, 1280, 260, span(t, T.start, T.start + 0.8)));
  out.push(ink(A, `pushed to GitHub: entries 1 to ${L.lastPushedEntry}, last on ${L.lastPushDate}`, 20, 1280, 320, span(t, T.pushed, T.pushed + 0.8)));
  out.push(ink(A, `the repository: ${L.visibility}`, 20, 1280, 360, span(t, T.pushed, T.pushed + 0.8)));
  out.push(ink(A, `entries ${L.firstUnpushed} to ${n}: our own file only`, 20, 1280, 420, span(t, T.local, T.local + 0.8), "#a8502e"));
  out.push(ink(A, "a fingerprint proves the bytes, not the hour", 26, 640, 880, span(t, T.hour, T.hour + 0.8)));
  return out;
}
