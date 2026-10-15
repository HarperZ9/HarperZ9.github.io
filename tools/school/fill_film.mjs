// Fill the attention film's numbers from the trained model, so no number in the film is typed by
// hand. Reads media/school/attention/model.json (written by train_film_weights.mjs), rebuilds the
// model from its weights, runs the probe, and writes:
//   facts.json  every number the scene draws (vectors, scores, shares, maps, curves)
//   film.json   film.template.json with each {{token}} replaced
//
//   node tools/school/fill_film.mjs [media/school/attention]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fromJSON, forward, attentionOn, evaluate } from "../../system/school/tinyformer.mjs";
import { encode, heldOut, PROBES } from "../../system/school/corpus.mjs";

const dir = process.argv[2] || "media/school/attention";
const M = JSON.parse(readFileSync(join(dir, "model.json"), "utf8"));
const model = fromJSON(M.weights), c = model.config, D = c.dModel, H = c.nHeads, hd = D / H;
const round = (v, k = 4) => Math.round(v * 10 ** k) / 10 ** k;

// The probe: the first of the corpus's probes (a copy across a full stop).
const probe = PROBES[0], words = probe.words, T = words.length, q = probe.query, src = probe.answerFrom;
const fw = forward(model, encode(words), 1, T, { keep: true }), work = fw.work;
const att = attentionOn(model, words);

// The head that puts the most light from the reading word on the answer's source.
let best = { l: 0, h: 0, w: -1 };
att.layers.forEach((heads, l) => heads.forEach((rows, h) => { if (rows[q][src] > best.w) best = { l, h, w: rows[q][src] }; }));
const qkv = work.layers[best.l].qkv, sc = fw.scores[best.l];
const qv = Array.from(qkv.subarray(q * 3 * D + best.h * hd, q * 3 * D + (best.h + 1) * hd));
const kv = Array.from(qkv.subarray(src * 3 * D + D + best.h * hd, src * 3 * D + D + (best.h + 1) * hd));
const qkRaw = qv.reduce((s, v, i) => s + v * kv[i], 0);
const scores = words.map((_, j) => (j <= q ? sc[(best.h * T + q) * T + j] : 0));
const scaledCheck = Math.abs(scores[src] - qkRaw / Math.sqrt(hd));
if (scaledCheck > 1e-4) throw new Error(`score check failed: ${scores[src]} vs ${qkRaw / Math.sqrt(hd)}`);
const shares = att.layers[best.l][best.h][q].slice(0, T);
const vecs = words.map((_, i) => Array.from(work.res[0].subarray(i * D, (i + 1) * D), (v) => round(v)));
const vecMax = Math.max(...vecs.flat().map(Math.abs));

// What each head does, measured on the held-out set: its mean weight on the previous word, on
// itself, and on the source of a look-back target. The largest names the head.
const held = heldOut(256, c.ctx), ev = evaluate(model, held);
const fh = forward(model, held.x, held.batch, held.ctx, { keep: true });
const heads = [];
for (let l = 0; l < c.nLayers; l++) for (let h = 0; h < H; h++) {
  let prev = 0, self = 0, n = 0;
  const A = fh.attention[l], Tc = held.ctx;
  for (let b = 0; b < held.batch; b++) for (let i = 1; i < Tc; i++) { const row = ((b * H + h) * Tc + i) * Tc; prev += A[row + i - 1]; self += A[row + i]; n++; }
  const m = { "previous word": prev / n, copy: ev.sourceAttention[l][h], itself: self / n };
  const [kind, v] = Object.entries(m).sort((a, b2) => b2[1] - a[1])[0];
  heads.push({ layer: l, head: h, kind: v >= 0.3 ? kind : "spread out", measured: Object.fromEntries(Object.entries(m).map(([k, x]) => [k, round(x, 3)])),
    map: att.layers[l][h].map((r) => r.slice(0, T).map((x) => round(x, 3))), shares: att.layers[l][h][q].slice(0, T).map((x) => round(x, 4)) });
}
const ord = ["first", "second", "third", "fourth"];
const named = heads.filter((h) => h.kind === "previous word" || h.kind === "copy");
const headsSentence = named.length
  ? "After training, " + named.map((h) => `a head in the ${ord[h.layer]} layer puts ${Math.round(h.measured[h.kind] * 100)} percent of its light on ${h.kind === "copy" ? "the word to be copied" : "the word just before"}`).join(", and ") + "."
  : "After training, no head settled on one simple job; their light is spread out.";

const final = M.curve[M.curve.length - 1], ctl = Object.fromEntries(M.controls.map((k) => [k.attnMode, k]));
const curveOf = (cv) => cv.map((p) => [p.step, p.heldOut]);
const cap = (w) => w[0].toUpperCase() + w.slice(1);
const spoken = (() => { const s = words.join(" ").replace(/ \./g, ".").split(". "); return s.map((x) => cap(x)).join(". ").replace(/\b(tallow|pylon|rerun)\b/g, cap) + "..."; })();
const facts = {
  about: "Computed by tools/school/fill_film.mjs from model.json. Do not edit by hand.",
  dModel: D, dHead: hd, nHeads: H, nLayers: c.nLayers, params: model.nParams, seed: M.seed, steps: M.steps,
  probe: { words, query: q, answer: probe.answer, answerFrom: src }, layer: best.l, head: best.h,
  vecs, vecMax: round(vecMax), q: qv.map((v) => round(v)), k: kv.map((v) => round(v)), qkRaw: round(qkRaw), qkMax: round(Math.max(...qv.map(Math.abs), ...kv.map(Math.abs))),
  scores: scores.map((v) => round(v)), shares: shares.map((v) => round(v)), top5: att.top5[q].map((t) => ({ word: t.word, p: round(t.p) })),
  heads, headsSentence, copyOn: final.copyAccuracy, copyOff: ctl.self.curve.at(-1).copyAccuracy, copyUniform: ctl.uniform.curve.at(-1).copyAccuracy,
  lossOn: curveOf(M.curve), lossOff: curveOf(ctl.self.curve), lossUniform: curveOf(ctl.uniform.curve), unigramLoss: M.baselines.unigramLoss,
};
const pc = (v) => String(Math.round(v * 100));
const top = shares.indexOf(Math.max(...shares.slice(0, q)));
const tokens = { d_model: D, d_head: hd, params: model.nParams.toLocaleString("en"), n_heads: H, n_layers: c.nLayers, probe_spoken: spoken, probe_answer: probe.answer,
  probe_top_share: shares[top] >= 0.995 ? "more than 99" : pc(shares[top]), probe_top_word: words[top], heads_sentence: headsSentence, copy_on: pc(facts.copyOn), copy_off: pc(facts.copyOff), copy_uniform: pc(facts.copyUniform) };
const tpl = readFileSync(join(dir, "film.template.json"), "utf8");
const film = tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => { if (!(k in tokens)) throw new Error(`no value for {{${k}}}`); return String(tokens[k]); });
JSON.parse(film);
writeFileSync(join(dir, "facts.json"), JSON.stringify(facts) + "\n");
writeFileSync(join(dir, "film.json"), film);
console.log(JSON.stringify({ layer: best.l + 1, head: best.h + 1, share: round(best.w, 3), qkRaw: round(qkRaw), tokens }, null, 1));
