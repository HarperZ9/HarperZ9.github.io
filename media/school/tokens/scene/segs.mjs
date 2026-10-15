// The tokens film's segments, on the conveyors of Pylon's customs shed. Every row of crates is the
// lesson's own encoder applied to facts.json's merges (corpus) or to merges learned at load on the
// Moby-Dick passage (English), so the belts carry exactly what the tokenizer makes.
import { rect, polyline, span, ease, lerp, window, label as slabel, C } from "../../shared/lib.mjs";
import { pylon, talking, cone } from "../../vectors/scene/chart.mjs";
import { INK, shed, belt, crates, lab, label } from "./shed.mjs";

const SENT = ["rerun", "knocked", "on", "a", "shell", "."];
const guide = (t, A, extra = {}) => pylon(t, 1760, 1020, 0.5, { talk: talking(A.rows, t), ...extra });
const arrive = (t, t0) => 900 * (1 - span(t, t0, t0 + 1.2, ease.out));

export function open(t, A) {
  const items = shed(t, { lamp: span(t, 0.5, 2.5) }), s = "rerun knocked on a shell . tallow kept the lamp bright .";
  items.push(...belt(560, t), lab(A, s.slice(0, Math.floor(span(t, 0.6, 3.6) * s.length)), 34, 120, 560, INK.night, "left", 1));
  return { items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1.04 - 0.04 * span(t, 0, 4) } };
}
export function title(t, A, T) {
  const a = window(t, T.say, T.end, 0.6, 0.8), items = [...shed(t), ...belt(700, t)];
  items.push(slabel(A, "Tokens", 104, 960, 320, C.ink, "center", a, "head"), slabel(A, "cutting text into crates", 38, 960, 380, INK.dim, "center", span(t, T.sub, T.sub + 0.6) * a));
  items.push(...crates(A, SENT.map((w) => A.enc(w, 136)), 600 + arrive(t, T.say), 700, { a }).items);
  return { items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

// Letters, then whole words, then a word with no crate.
export function sizes(t, A, T, F) {
  const items = [...shed(t), ...belt(330, t), ...belt(620, t)];
  items.push(...crates(A, SENT.map((w) => A.enc(w, 0)), 130 + arrive(t, T.start), 330, { size: 32 }).items);
  if (t >= T.letters) items.push(lab(A, `cut by letter: ${F.corpus.curveTrain[0].tokensPerWord.toFixed(2)} pieces per word`, 28, 130, 250, INK.night, "left", span(t, T.letters, T.letters + 0.6)));
  if (t >= T.whole) {
    items.push(...crates(A, SENT.map((w) => [w + "</w>"]), 130 + arrive(t, T.whole), 620).items, lab(A, "cut by word: one piece per word", 28, 130, 540, INK.night, "left", span(t, T.whole, T.whole + 0.6)));
    if (t >= T.unseen) items.push(...crates(A, [["lamplit?"]], 1200 + arrive(t, T.unseen), 620, { hot: () => true }).items, lab(A, "never seen: no crate", 26, 1220, 720, INK.ember, "left", span(t, T.unseen + 0.6, T.unseen + 1.2)));
  }
  return { items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

// Counting pairs and merging: the tally board, then the belt re-cut as merges are applied.
export function merge(t, A, T, F) {
  const items = [...shed(t), ...belt(700, t)], fm = F.corpus.firstMerges;
  let k = 0;
  if (t >= T.common) k = Math.min(5, Math.floor(span(t, T.common, T.ask.start - 0.5) * 6));
  if (t >= T.reveal) k = 50;
  if (t >= T.all) k = Math.round(lerp(50, 136, span(t, T.all, T.all + 3)));
  const tally = span(t, T.count, T.count + 1);
  fm.slice(0, 6).forEach((m, i) => {
    const w = 600 * (m.count / fm[0].count), done = i < k;
    items.push({ shape: rect(120, 140 + i * 60, w * tally, 38, 4), fill: done ? [0.89, 0.58, 0.45, 0.85] : [0.75, 0.82, 0.95, 0.5] }, lab(A, `${label(m.a)} + ${label(m.b)}  ${m.count.toLocaleString("en")}`, 28, 140 + w * tally, 168 + i * 60, done ? INK.ember : INK.dim, "left", tally));
  });
  items.push(lab(A, "pairs counted inside words", 22, 120, 120, INK.dim, "left", tally));
  const row = SENT.map((w) => A.enc(w, k)), n = row.flat().length;
  items.push(...crates(A, row, 130, 700).items, lab(A, `${k} merges: ${n} pieces for ${SENT.length} words`, 30, 130, 620, INK.night, "left", 1));
  if (t >= T.reveal) items.push(lab(A, `${F.corpus.curveTrain[7].tokensPerWord.toFixed(2)} pieces per word over all the guides' text`, 28, 130, 860, INK.ember, "left", span(t, T.reveal, T.reveal + 0.6)));
  return { items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

// A word nobody shipped before, cut into pieces that have crates.
export function unseen(t, A, T, F) {
  const items = [...shed(t), ...belt(560, t)], u = F.corpus.unseen[0], cut = span(t, T.cut, T.cut + 1.5);
  if (cut <= 0) items.push(...crates(A, [[u.word + "?"]], 700 + arrive(t, T.start), 560, { hot: () => true, size: 36 }).items);
  else items.push(...crates(A, [A.enc(u.word, 136)], 640, 560, { size: 36, a: cut }).items);
  if (t >= T.who) items.push(lab(A, "Sennrich, Haddow and Birch, 2016", 26, 960, 1000, INK.dim, "center", span(t, T.who, T.who + 0.6)));
  return { items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

// Real English: merges learned at load on the Moby-Dick passage, applied to Pride and Prejudice.
export function english(t, A, T, F) {
  const items = [...shed(t), ...belt(420, t), ...belt(720, t)], E = F.english;
  items.push(lab(A, "Call me Ishmael. Some years ago ...   (Melville, 1851)", 28, 130, 160, INK.dim, "left", span(t, T.moby, T.moby + 1)));
  if (t >= T.moby) items.push(...crates(A, ["Call", "me", "Ishmael", "."].map((w) => A.encE(w, 878)), 130 + arrive(t, T.moby), 420).items);
  if (t >= T.pride) {
    items.push(lab(A, "It is a truth universally acknowledged ...   (Austen, 1813)", 28, 130, 600, INK.dim, "left", span(t, T.pride, T.pride + 1)));
    const words = t >= T.light ? ["lighthouse"] : ["It", "is", "a", "truth", "universally", "acknowledged"];
    items.push(...crates(A, words.map((w) => A.encE(w, E.curveHeld[9].merges)), 130 + arrive(t, t >= T.light ? T.light : T.pride), 720, { hot: () => t >= T.light }).items);
    if (t >= T.m400) items.push(lab(A, `${E.curveHeld[9].merges} merges: ${E.curveHeld[9].tokensPerWord.toFixed(2)} pieces per word on the new page`, 28, 130, 880, INK.ember, "left", span(t, T.m400, T.m400 + 0.6)));
  }
  return { items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

// Random merges instead of common ones: the same count, ten tries.
export function random(t, A, T, F) {
  const items = [...shed(t)], rc = F.corpus.randomControl.train[12], X = (v) => 260 + (v / 2) * 1100, g = span(t, T.rand, T.rand + 1.5);
  items.push({ shape: rect(260, 400, (X(1) - 260) * span(t, T.start, T.start + 1), 50, 6), fill: [1, 0.75, 0.45, 0.8] }, lab(A, "most common pairs, 136 merges: 1.00 piece per word", 26, 260, 380, INK.night, "left", span(t, T.start, T.start + 1)));
  items.push({ shape: rect(X(rc.min), 560, (X(rc.max) - X(rc.min)) * g, 50, 6), fill: [0.75, 0.82, 0.95, 0.7] }, lab(A, `random pairs, 136 merges, ten tries: ${rc.min.toFixed(2)} to ${rc.max.toFixed(2)}`, 26, 260, 540, INK.night, "left", g));
  for (const v of [0, 0.5, 1, 1.5, 2]) items.push(lab(A, v.toFixed(1), 20, X(v), 680, INK.dim, "center", 1));
  items.push(lab(A, "pieces per word", 22, X(1), 720, INK.dim, "center", 1));
  return { items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

// Bytes: characters named by code point, with their UTF-8 bytes; unknown pieces at each base.
export function bytes(t, A, T, F) {
  const items = [...shed(t)], B = F.bytes, names = { "U+0061": "a", "U+00E9": "e with an accent", "U+2019": "curly apostrophe", "U+20AC": "euro sign", "U+1F9AD": "seal emoji" };
  if (t >= T.quotes && t < T.gpt) items.push(lab(A, "curly quotation marks, and two capitals Moby-Dick never used: no crate", 28, 960, 300, INK.ember, "center", span(t, T.quotes, T.quotes + 0.6)));
  if (t >= T.gpt) {
    const g = span(t, T.table, T.table + 2);
    items.push(lab(A, "256 bytes: every text is some list of them", 30, 130, 180, INK.night, "left", span(t, T.gpt, T.gpt + 0.6)));
    B.table.filter((r) => r.char !== "€").forEach((r, i) => {
      const y = 300 + i * 110, a = Math.min(1, Math.max(0, g * 4 - i));
      items.push(lab(A, `${names[r.codePoint]} (${r.codePoint})`, 26, 130, y + 10, INK.dim, "left", a));
      r.hex.split(" ").forEach((h, j) => items.push({ shape: rect(760 + j * 100, y - 26, 84, 56, 6), fill: [1, 0.75, 0.45, 0.16 * a], stroke: [1, 0.8, 0.55, 0.85 * a], width: 2.5, blend: "add" }, lab(A, h, 28, 802 + j * 100, y + 10, INK.night, "center", a)));
    });
  }
  if (t >= T.zero) items.push(lab(A, `unknown pieces on the new page: ${B.byteBPE.heldUnknownTokens} from bytes, ${B.charBPE.heldUnknownTokens} from letters`, 28, 960, 900, INK.ember, "center", span(t, T.zero, T.zero + 0.6)));
  return { items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

// The lighthouse model: one crate per word, 46; BPE's vocabulary of 160 to reach whole words.
export function ours(t, A, T, F) {
  const items = [...shed(t)], ti = F.tieIn, v = F.corpus.curveTrain[12].vocab, g = span(t, T.start, T.start + 2), h = span(t, T.bpe, T.bpe + 2);
  for (let i = 0; i < ti.attentionVocab; i++) items.push({ shape: rect(160 + (i % 23) * 70, 300 + Math.floor(i / 23) * 70, 58, 58, 4), fill: [1, 0.75, 0.45, 0.25 * Math.min(1, Math.max(0, g * 3 - i / 23))], stroke: [1, 0.8, 0.55, 0.7], width: 1.5 });
  items.push(lab(A, `${ti.attentionVocab} crates: one per word (the attention model)`, 26, 160, 270, INK.night, "left", g));
  for (let i = 0; i < v; i++) items.push({ shape: rect(160 + (i % 40) * 40, 560 + Math.floor(i / 40) * 40, 32, 32, 3), fill: [0.75, 0.82, 0.95, 0.3 * Math.min(1, Math.max(0, h * 4 - i / 40))] });
  items.push(lab(A, `${v} crates for byte-pair encoding to reach whole words`, 26, 160, 530, INK.ember, "left", h));
  return { items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

export function close(t, A, T) {
  const items = [...shed(t, { lamp: 1 - span(t, T.night, T.end) }), ...belt(700, t)];
  items.push(...crates(A, SENT.map((w) => A.enc(w, 136)), 600, 700).items);
  const c = span(t, T.start + 1, T.start + 2.2, ease.out);
  if (c > 0) items.push(...cone(1520, lerp(300, 660, c), 0.3));
  items.push(...guide(t, A, { hat: c <= 0 }), { shape: rect(0, 0, 1920, 1080), screen: true, fill: [0, 0, 0, 0.85 * span(t, T.night, T.end)] });
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}
