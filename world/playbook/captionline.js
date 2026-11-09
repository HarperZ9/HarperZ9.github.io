// captionline.js: timed captions inside media pieces, in three modes, on the cadence clock.
//
//   quote    the sentence fades in and holds; the claim span turns to the one hot mark at its own onset, set in
//            inverse video; the citation sits under it at about 2% of frame height.
//   kinetic  one to three words at a time, each entering on its own onset.
//   log      one line per step, words typing on at their onsets; older lines dim and scroll.
//
// Synthesized from three sources, none reproduced: the span timing of the wiqaayat films' yellow key phrase, the
// inverse-video word of pleo's balloons, and our one-hot-mark rule for the colour. Set in Hanken Grotesk and Conso.
//
// Input: WebVTT in raw-native's shape (tools/explainer/captions.mjs writes numbered cues, 00:MM:SS.mmm). Word
// timing comes from WebVTT inline timestamps (<00:00:02.900>word) when present; otherwise each cue's span is
// shared out by spoken weight (letters, plus a pause after punctuation) and the words are marked estimated.
//
// Holds and onsets (the decision): an onset is an event, a hold is a look. A word appears at the first display
// frame at or after its onset, whatever the clock is holding, so at 60 Hz it is never more than 16.7 ms late.
// The clock quantises everything else: the quote fade steps on the clock, the kinetic boil re-seeds on it, the
// log cursor blinks on it. `onsets: 'clock'` snaps onsets to the clock instead; on long holds that breaks the
// 40 ms rule, and the tests show by how much.
import { clamp, EASE, hash01 } from './lib/util.js';
import { defineNode } from './lib/node.js';

const TS = /(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})/;
export const parseTime = (s) => { const m = TS.exec(s); if (!m) throw new Error(`captionline: bad timestamp ${s}`); return (+(m[1] || 0)) * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000; };
const fmt = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s - h * 3600 - m * 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${r.toFixed(3).padStart(6, '0')}`; };

// Spoken weight of a word: letters and digits, plus a pause after punctuation (a comma breathes, a stop rests).
const weight = (w) => (w.replace(/[^\p{L}\p{N}]/gu, '').length || 1) + (/[.!?]$/.test(w) ? 4 : /[,;:]$/.test(w) ? 2 : 0) + 1;

function cueWords(body, start, end) {
  const words = [], re = /<((?:\d+:)?\d{2}:\d{2}\.\d{3})>|(\S+)/g; let at = null, m;
  const clean = body.replace(/<\/?[bciuv][^>]*>/g, '');
  while ((m = re.exec(clean))) { if (m[1]) { at = parseTime(m[1]); } else { words.push({ text: m[2], t: at }); at = null; } }
  if (!words.length) return words;
  if (words[0].t === null) words[0].t = start;
  // fill untimed words by spoken weight between the timed anchors around them
  for (let i = 0; i < words.length; i++) {
    if (words[i].t !== null) continue;
    let j = i; while (j < words.length && words[j].t === null) j++;
    const t0 = words[i - 1].t, t1 = j < words.length ? words[j].t : end - 0.15 * (end - start);
    const ws = words.slice(i - 1, j).map((w) => weight(w.text)), total = ws.reduce((a, b) => a + b, 0); let acc = ws[0];
    for (let k = i; k < j; k++) { words[k].t = t0 + ((t1 - t0) * acc) / total; words[k].est = true; acc += ws[k - i + 1]; }
    i = j - 1;
  }
  return words;
}

// Parse WebVTT. Returns { cues: [{ id, start, end, text, words: [{ text, t, est?, i }] }], words } with a global word index.
export function parseVTT(src) {
  const blocks = src.replace(/\r/g, '').split(/\n\n+/), cues = []; let n = 0;
  for (const b of blocks) {
    const lines = b.split('\n').filter((l) => l.length), k = lines.findIndex((l) => l.includes('-->'));
    if (k < 0) continue;
    const [a, z] = lines[k].split('-->').map((s) => s.trim().split(/\s/)[0]), start = parseTime(a), end = parseTime(z), body = lines.slice(k + 1).join(' ');
    const words = cueWords(body, start, end).map((w) => ({ ...w, i: n++ }));
    cues.push({ id: k ? lines[0] : String(cues.length + 1), start, end, text: words.map((w) => w.text).join(' '), words });
  }
  return { cues, words: cues.flatMap((c) => c.words) };
}

// Write word-timed WebVTT (inline timestamps), the inverse of parseVTT.
export const toVTT = (track) => 'WEBVTT\n\n' + track.cues.map((c, i) => `${i + 1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.words.map((w, j) => (j ? `<${fmt(w.t)}>` : '') + w.text).join(' ')}\n`).join('\n');

// Mark spans. A span is { cue, text } (first match of the phrase inside that cue) or { from, to } (global word indices).
export function markSpans(track, spans = []) {
  for (const s of spans) {
    let idx = [];
    if (s.text != null) {
      const cue = track.cues[s.cue ?? 0], want = s.text.split(/\s+/), plain = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      for (let j = 0; j + want.length <= cue.words.length && !idx.length; j++) if (want.every((w, k) => plain(cue.words[j + k].text) === plain(w))) idx = want.map((_, k) => cue.words[j + k].i);
      if (!idx.length) throw new Error(`captionline: span "${s.text}" not found in cue ${s.cue ?? 0}`);
    } else for (let i = s.from; i <= s.to; i++) idx.push(i);
    for (const i of idx) track.words[i].hot = s.kind || 'claim';
  }
  return track;
}

// Kinetic groups: at most three words, broken at punctuation and at pauses over 0.35 s.
export function groups(cue, { max = 3, gap = 0.35 } = {}) {
  const out = []; let g = [];
  cue.words.forEach((w, k) => {
    const next = cue.words[k + 1];
    g.push(w);
    if (g.length >= max || /[.,;:!?]$/.test(w.text) || !next || next.t - w.t > gap + 0.04 * w.text.length) { out.push(g); g = []; }
  });
  return out;
}

const DEF = { mode: 'kinetic', onsets: 'exact', fadeIn: 0.32, fadeOut: 0.22, enter: 0.14, maxLines: 6, boil: 0.6, cites: {} };

// The caption state at time t: a pure function of (track, t, clock state). Each line is { words, cite?, alpha }.
// Each word: { text, i, on (shown), alpha, hot, rise (px of entry offset, 0 at rest), dx, dy (boil) }.
export function captionState(track, t, opts = {}) {
  const o = { ...DEF, ...opts }, ck = o.clock, cs = ck ? ck.at(t) : { index: Math.floor(t * 60), local: 0 };
  const onset = (w) => (o.onsets === 'clock' && ck ? ck.startOf(ck.indexAt(w.t) + (ck.at(w.t).start < w.t - 1e-9 ? 1 : 0)) : w.t);
  const shown = (w) => t + 1e-9 >= onset(w);
  const look = (t0) => (ck ? Math.max(cs.start, t0) : t); // the look is drawn at the start of the held state, never before t0
  const word = (w, extra = {}) => ({ text: w.text, i: w.i, on: shown(w), alpha: shown(w) ? 1 : 0, hot: w.hot || null, rise: 0, dx: 0, dy: 0, ...extra });
  const lines = [];
  if (o.mode === 'log') {
    const live = track.cues.filter((c) => t + 1e-9 >= onset(c.words[0])).slice(-o.maxLines);
    live.forEach((c, k) => { const age = live.length - 1 - k; lines.push({ n: track.cues.indexOf(c) + 1, alpha: age ? Math.max(0.38, 1 - 0.14 * age) : 1, words: c.words.map((w) => word(w)), cursor: !age && (cs.index & 1) === 0 }); });
    return { mode: 'log', t, clockIndex: cs.index, lines };
  }
  const cue = track.cues.find((c) => t >= onset(c.words[0]) - 1e-9 && t < c.end);
  if (!cue) return { mode: o.mode, t, clockIndex: cs.index, lines };
  if (o.mode === 'quote') {
    const tq = look(cue.start), fi = EASE.outQuad((tq - cue.start) / o.fadeIn), fo = 1 - EASE.outQuad((tq - (cue.end - o.fadeOut)) / o.fadeOut), a = clamp(Math.min(fi, fo));
    // the sentence is shown from its first onset; a claim word turns hot at its own onset
    lines.push({ alpha: t + 1e-9 >= cue.words[0].t ? Math.max(a, 0.001) : 0, cite: o.cites[track.cues.indexOf(cue)] || null,
      words: cue.words.map((w) => ({ ...word(w), on: true, alpha: 1, hot: w.hot && shown(w) ? w.hot : null, hotOn: w.hot ? shown(w) : null })) });
    return { mode: 'quote', t, clockIndex: cs.index, lines };
  }
  const gs = groups(cue), gi = gs.findIndex((g, k) => t + 1e-9 >= onset(g[0]) && (k === gs.length - 1 || t + 1e-9 < onset(gs[k + 1][0])));
  if (gi < 0) return { mode: 'kinetic', t, clockIndex: cs.index, lines };
  lines.push({ alpha: 1, words: gs[gi].map((w) => {
    const r = shown(w) ? 1 - EASE.outQuad((t - onset(w)) / o.enter) : 1;
    return word(w, { rise: r, dx: (hash01(cs.index, w.i) - 0.5) * o.boil * 2, dy: (hash01(cs.index ^ 0x5bd1, w.i) - 0.5) * o.boil * 2 });
  }) });
  return { mode: 'kinetic', t, clockIndex: cs.index, lines };
}

// For the acceptance test: when each word first shows when sampled at fps, against its onset.
export function onsetErrors(track, fps, opts = {}) {
  const first = new Map(), end = track.cues.at(-1).end + 0.5;
  for (let f = 0; f <= end * fps; f++) {
    const t = f / fps, st = captionState(track, t, opts);
    for (const l of st.lines) for (const w of l.words) if ((opts.mode === 'quote' ? w.hotOn : w.on) && !first.has(w.i)) first.set(w.i, t);
  }
  return [...first].map(([i, t]) => ({ i, err: t - track.words[i].t }));
}

export const SPEC = Object.freeze({
  inputs: { vtt: 'WebVTT string, cue or word timed', spans: '[{ cue, text } | { from, to }]', cites: 'cue index to citation string', clock: 'cadence clock (optional)' },
  params: {
    fadeIn: { range: [0, 1.2], unit: 's, quote fade in (ease-out quad, stepped on the clock)', default: 0.32 },
    fadeOut: { range: [0, 1.2], unit: 's, quote fade out', default: 0.22 },
    enter: { range: [0, 0.4], unit: 's, kinetic word entry (ease-out quad)', default: 0.14 },
    boil: { range: [0, 2], unit: 'CSS px, kinetic boil amplitude per clock state', default: 0.6 },
    maxLines: { range: [1, 12], unit: 'lines kept in log mode', default: 6 },
    citeShare: { range: [0.012, 0.03], unit: 'share of frame height for the citation line', default: 0.02 },
  },
  determinism: 'captionState is a pure function of (track, t, clock seed); the boil is hash01(clock index, word index)',
  budget: 'captionState under 0.05 ms per frame for a 40-word cue; the DOM update touches only changed words',
  acceptance: 'every word shows within 40 ms of its onset at 60 Hz, also on held clocks (onsets: exact)',
});

export const node = defineNode({
  id: 'captionline', ports: { in: { text: 'text', clock: 'clock' }, out: { text: 'text' } },
  params: { boil: SPEC.params.boil, enter: SPEC.params.enter }, seed: 1,
  render: ({ t, inputs = {}, params }) => captionState(inputs.track, t, { mode: inputs.mode || 'kinetic', clock: inputs.clock, ...params }),
});
