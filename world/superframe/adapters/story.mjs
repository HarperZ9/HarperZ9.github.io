// adapters/story.mjs: the transformation and creation engine's language and motion nodes, and the living mosaic as a
// storytelling surface. The mosaic itself is the name-art library (name-art/lib/mosaic), used as it is:
// this file reads it and never changes it. A typed sentence becomes beats; each beat is laid as tesserae whose light
// moves; the beats play in order with their words as captions; a voice line of notes follows the same beats.
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import * as px from '../lib/pix.mjs';
import { storyBeats, voiceLine, explainCode, describeSound, describePicture, textToSeries } from '../lib/transform.mjs';
import { mosaic, STYLES } from '../../name-art/lib/mosaic/index.mjs';
import { guardFlashes } from '../lib/flash.mjs';

// The plain ground: the mean colour of the outer band of a laid frame (the field the letters sit in).
function groundOf(f, w, h) {
  const m = Math.max(2, Math.round(Math.min(w, h) * 0.04)), s = [0, 0, 0]; let n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < m || y < m || x >= w - m || y >= h - m) { const i = 4 * (y * w + x); s[0] += f[i]; s[1] += f[i + 1]; s[2] += f[i + 2]; n++; }
  return s.map(v => v / n);
}
const cellOf = w => Math.max(4, Math.round(w / 24));
// Glyph regions of a laid beat, one per letter. Seeds are the connected letter-zone tiles of the mosaic's own zone
// map; a dot joins the stem it sits over (their columns overlap). Every outline (halo) pixel and a few pixels of glow
// beyond it then go to the nearest letter by a breadth-first grow, so adjacent letters whose outlines touch still
// split along the line between them. Returns { label: Int32Array(w*h) (0 is ground), order: ids in reading order }.
export function glyphRegions(zone, key, w, h) {
  const grow = Math.max(2, Math.round(w * 0.012)), label = new Int32Array(w * h), boxes = [];
  let n = 0;
  for (let s0 = 0; s0 < w * h; s0++) {
    if (zone[s0] !== 2 || label[s0]) continue;
    n++; const st = [s0], bx = { id: n, x0: w, x1: 0, y0: h, y1: 0, sx: 0, sy: 0, c: 0 }; label[s0] = n;
    while (st.length) { const i = st.pop(), x = i % w, y = (i / w) | 0; bx.x0 = Math.min(bx.x0, x); bx.x1 = Math.max(bx.x1, x); bx.y0 = Math.min(bx.y0, y); bx.y1 = Math.max(bx.y1, y); bx.sx += x; bx.sy += y; bx.c++;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && !label[j] && zone[j] === 2) { label[j] = n; st.push(j); } }
    boxes.push(bx);
  }
  // a dot over a stem (i, j) or parts stacked in one column are one letter
  const root = new Map(boxes.map(b => [b.id, b.id])), find = id => (root.get(id) === id ? id : find(root.get(id)));
  for (const p of boxes) for (const q of boxes) if (p.id < q.id) { const ov = Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0), small = Math.min(p.x1 - p.x0, q.x1 - q.x0) + 1; if (ov > 0.5 * small && (p.y1 < q.y0 || q.y1 < p.y0)) root.set(find(q.id), find(p.id)); }
  for (let i = 0; i < w * h; i++) if (label[i]) label[i] = find(label[i]);
  // grow each letter into its outline and glow, nearest letter first
  const dist = new Int32Array(w * h).fill(-1); let q = [];
  for (let i = 0; i < w * h; i++) if (label[i]) { dist[i] = 0; q.push(i); }
  while (q.length) { const next = []; for (const i of q) { const x = i % w, y = (i / w) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
      if (j < 0 || dist[j] >= 0) continue;
      const inHalo = zone[j] === 1, d = dist[i] + 1;
      if (!inHalo && (zone[i] !== 1 && dist[i] >= grow || zone[i] === 1 && grow <= 0)) continue;
      if (!inHalo && zone[j] === 0 && dist[i] - 0 >= grow + (zone[i] === 1 ? 0 : 0) && zone[i] !== 1) continue;
      dist[j] = inHalo ? 0 : (zone[i] === 1 ? 1 : d); label[j] = label[i]; next.push(j);
    } } q = next.filter(j => zone[j] === 1 || dist[j] <= grow); }
  // a tile belongs wholly to one letter: the most common label among its pixels
  const votes = new Map();
  for (let i = 0; i < w * h; i++) if (label[i]) { const m = votes.get(key[i]) ?? new Map(); m.set(label[i], (m.get(label[i]) ?? 0) + 1); votes.set(key[i], m); }
  const owner = new Map(); for (const [k, m] of votes) owner.set(k, [...m].sort((a, b) => b[1] - a[1])[0][0]);
  for (let i = 0; i < w * h; i++) if (label[i] && zone[i] >= 1) label[i] = owner.get(key[i]) ?? label[i];
  const ids = [...new Set(label)].filter(Boolean), cents = ids.map(id => { let sx = 0, sy = 0, c = 0; for (let i = 0; i < w * h; i++) if (label[i] === id) { sx += i % w; sy += (i / w) | 0; c++; } return { id, x: sx / c, y: sy / c }; });
  const line = Math.max(1, h / 4);
  cents.sort((p, r) => Math.floor(p.y / line) - Math.floor(r.y / line) || p.x - r.x);
  return { label, order: cents.map(c => c.id) };
}

// One frame of the letter-atomic flip at time t (0..1). The old beat's glyphs leave one whole glyph at a time over the
// first half, each folding to the plain ground; the new beat's glyphs arrive one whole glyph at a time over the second
// half. Ground tiles flip freely in a reading-order wave, folding through the plain ground colour edge-on. A glyph's tiles, keyline
// and glow move as one, so no letter is ever split between beats and no glow outlives its glyph.
const fold = u => Math.abs(Math.cos(Math.PI * Math.max(0, Math.min(1, u))));
function flipFrame(A, B, G, P, ra, rb, w, h, cell, t) {
  const out = new Float32Array(w * h * 4), cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
  const kA = new Float32Array(ra.order.length + 1), kB = new Float32Array(rb.order.length + 1);
  ra.order.forEach((id, i) => { const s0 = (i / Math.max(1, ra.order.length)) * 0.42; kA[id] = t <= s0 ? 1 : t >= s0 + 0.08 ? 0 : 1 - (t - s0) / 0.08; });
  rb.order.forEach((id, i) => { const s0 = 0.5 + (i / Math.max(1, rb.order.length)) * 0.42; kB[id] = t <= s0 ? 0 : t >= s0 + 0.08 ? 1 : (t - s0) / 0.08; });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, o = 4 * i, la = ra.label[i], lb = rb.label[i];
    const c = Math.floor(x / cell), r = Math.floor(y / cell), u = (t - 0.7 * ((c + 0.6 * r) / (cols + 0.6 * rows))) / 0.3;
    let src = null, k = 0;
    if (la && kA[la] > 0) { src = A; k = kA[la]; }                         // an old glyph still in place
    else if (lb && kB[lb] > 0) { src = B; k = kB[lb]; }                     // a new glyph arriving
    else { src = u < 0.5 ? (la ? P : A) : (lb ? P : B); k = fold(u); }   // ground, and glyphs that are away: the field
    // tiles turn in a free wave; where a letter is away its place shows the plain field (P, the same mosaic laid with
    // no words), so an absent word leaves no flat silhouette behind
    for (let ch = 0; ch < 3; ch++) out[o + ch] = G[ch] + ((src ? src[o + ch] : G[ch]) - G[ch]) * k;
    out[o + 3] = 1;
  }
  return out;
}
const flat = (w, h, c) => { const f = new Float32Array(w * h * 4); for (let i = 0; i < w * h; i++) f.set([c[0], c[1], c[2], 1], 4 * i); return f; };

const NA = 'name-art/lib/mosaic';
const toRGBA = (w, h, rgb) => { const f = new Float32Array(w * h * 4); for (let i = 0; i < w * h; i++) { f[4 * i] = rgb[3 * i]; f[4 * i + 1] = rgb[3 * i + 1]; f[4 * i + 2] = rgb[3 * i + 2]; f[4 * i + 3] = 1; } return f; };
const textOf = (inputs, params) => (inputs.text?.text ?? params.text ?? '').trim();

export const NODES = [
  defineNode({
    id: 'core.text', title: 'Words, as given', lane: 'language', domains: [], source: 'superframe', explore: false,
    outputs: { text: 'text' }, params: { text: { type: 'string', default: '' }, role: { type: 'enum', options: ['content', 'code'], default: 'content' } },
    render: ({ params }) => ({ text: { text: params.text, role: params.role } }),
  }),
  defineNode({
    id: 'core.numbers', title: 'Numbers, as given', lane: 'data', domains: [], source: 'superframe', explore: false,
    doc: 'Any numbers in the text, in order; commas, spaces and new lines all separate them.',
    outputs: { series: 'series' }, params: { values: { type: 'string', default: '3 1 4 1 5 9 2 6' } },
    render: ({ params }) => {
      const y = (params.values.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).slice(0, 500);
      if (y.length < 2) throw new RangeError('numbers: give at least two numbers');
      return { series: make.series(y, { label: 'your numbers' }) };
    },
  }),
  defineNode({
    id: 'story.mosaic', title: 'A sentence told as a living mosaic', lane: 'motion', domains: ['craft', 'typography', 'storytelling'], source: NA,
    doc: 'Each beat of the sentence (one to three words) is laid as mosaic tesserae; the light moves across the tiles while the beat holds, and the next beat rises out of the ground. The words ride along as captions.',
    inputs: { text: { type: 'text', optional: true } }, outputs: { motion: 'motion' },
    params: {
      text: { type: 'string', default: 'I like the sea', doc: 'the sentence, when no text input arrives' },
      style: { type: 'enum', options: Object.keys(STYLES), default: 'echo' },
      framesPerBeat: { type: 'int', min: 1, max: 12, default: 4 },
      fps: { type: 'number', min: 1, max: 12, default: 4, unit: 'frames per second' },
      maxBeats: { type: 'int', min: 1, max: 12, default: 8 },
      transition: { type: 'enum', options: ['ground', 'cut', 'flip'], default: 'ground', doc: 'ground: fade out to the plain ground, then in; cut: no in-between frames; flip: tiles turn over in a wave along the reading direction' },
      fadeFrames: { type: 'int', min: 1, max: 6, default: 2, unit: 'frames each way' },
    },
    cost: p => 300 * (p?.framesPerBeat ?? 4) * Math.min(8, p?.maxBeats ?? 8),
    render: ({ inputs, params, w, h, seedInt }) => {
      const beats = storyBeats(textOf(inputs, params) || ' ').slice(0, params.maxBeats), frames = [], captions = [], transitions = [];
      const layouts = [], laid = beats.map(beat => Array.from({ length: params.framesPerBeat }, (_, k) => {
        const m = mosaic(w, h, { text: beat.slice(0, 40) || ' ', style: params.style, t: params.framesPerBeat > 1 ? k / params.framesPerBeat : 0, seed: seedInt % 9999 + 1 });
        if (k === 0) layouts.push(m.layout);
        return toRGBA(w, h, m.image.px);
      }));
      const regions = params.transition === 'flip' ? layouts.map(L => glyphRegions(L.zone, L.key, w, h)) : null;
      const plainField = params.transition === 'flip' ? toRGBA(w, h, mosaic(w, h, { text: ' ', style: params.style, t: 0, seed: seedInt % 9999 + 1 }).image.px) : null;
      const ground = groundOf(laid[0][0], w, h), G = flat(w, h, ground), mix = (p, q, t) => Float32Array.from(p, (v, i) => v + (q[i] - v) * t);
      laid.forEach((set, b) => {
        if (b > 0) {
          const prev = laid[b - 1].at(-1), next = set[0], from = frames.length, n = params.fadeFrames;
          // calm: out to the plain ground, then in; the two beats are never on screen together
          if (params.transition === 'ground') { for (let k = 1; k <= n; k++) frames.push(mix(prev, G, k / n)); for (let k = 1; k < n; k++) frames.push(mix(G, next, k / n)); }
          // vivid: tile flip. Each tessera-sized cell turns over from the old beat to the new one in a wave along the
          // reading direction; while a cell turns it narrows to its edge over the plain ground, so any cell shows one
          // beat or the other, never both
          else if (params.transition === 'flip') { const steps = 4 * n + 3; for (let k = 1; k <= steps; k++) frames.push(flipFrame(prev, next, ground, plainField, regions[b - 1], regions[b], w, h, cellOf(w), k / (steps + 1))); }
          if (frames.length > from) transitions.push({ from, to: frames.length - 1, kind: params.transition, a: b - 1, b, cell: params.transition === 'flip' ? cellOf(w) : null, regions: regions ? [regions[b - 1], regions[b]] : null });
        }
        const from = frames.length; frames.push(...set); captions.push({ from, to: frames.length - 1, text: beats[b] });
      });
      return { motion: guardFlashes({ w, h, fps: params.fps, frames, captions, transitions, ground, field: plainField }) };
    },
  }),
  defineNode({
    id: 'story.voice', title: 'A sentence as a voice line of notes', lane: 'sound', domains: ['music', 'prosody'], source: 'superframe lib/transform.mjs',
    doc: 'One note per syllable, on the same beats as story.mosaic. A question rises at its end, a full stop falls, an exclamation is louder. It carries the shape of the sentence, not its sound.',
    inputs: { text: { type: 'text', optional: true } }, outputs: { events: 'events' },
    params: { text: { type: 'string', default: 'I like the sea' }, beatSeconds: { type: 'number', min: 0.4, max: 4, default: 1, unit: 's per beat' }, root: { type: 'int', min: 40, max: 72, default: 57, unit: 'MIDI' }, voice: { type: 'enum', options: ['pluck', 'bell', 'pad', 'voice'], default: 'pluck' } },
    cost: () => 2,
    render: ({ inputs, params }) => { const v = voiceLine(textOf(inputs, params) || ' ', params); return { events: make.events(v.events, v.duration) }; },
  }),
  defineNode({
    id: 'language.explaincode', title: 'Code told in plain words', lane: 'language', domains: ['programming', 'plain language'], source: 'superframe lib/transform.mjs',
    doc: 'Names what the code is built from (functions, loops, choices, results, the text and notes inside it) and counts them. It does not guess what the program is for.',
    inputs: { text: 'text' }, outputs: { text: 'text' }, cost: () => 1,
    render: ({ inputs }) => ({ text: { text: explainCode(inputs.text.text), role: 'description' } }),
  }),
  defineNode({
    id: 'language.describesound', title: 'A sound told in plain words', lane: 'language', domains: ['acoustics', 'plain language'], source: 'superframe lib/transform.mjs',
    inputs: { audio: 'audio' }, outputs: { text: 'text' }, cost: () => 5,
    render: ({ inputs }) => ({ text: { text: describeSound(inputs.audio), role: 'description' } }),
  }),
  defineNode({
    id: 'language.describepicture', title: 'A picture told in plain words', lane: 'language', domains: ['perception', 'plain language'], source: 'superframe lib/transform.mjs',
    inputs: { raster: 'raster' }, outputs: { text: 'text' }, cost: () => 5,
    render: ({ inputs }) => ({ text: { text: describePicture(inputs.raster), role: 'description' } }),
  }),
  defineNode({
    id: 'language.numbers', title: 'Words counted as numbers', lane: 'data', domains: ['linguistics'], source: 'superframe lib/transform.mjs',
    inputs: { text: 'text' }, outputs: { series: 'series' },
    params: { mode: { type: 'enum', options: ['words', 'letters', 'vowels'], default: 'words', doc: 'letters per word, letter codes, or vowel share per word' } }, cost: () => 1,
    render: ({ inputs, params }) => { const s = textToSeries(inputs.text.text, params.mode); return { series: make.series(s.y, { label: s.label, unit: s.unit }) }; },
  }),
  defineNode({
    id: 'motion.breathe', title: 'A still that breathes', lane: 'motion', domains: ['animation'], source: 'superframe',
    doc: 'A slow, small rise and fall of light across a still picture: motion with no surprise in it.',
    inputs: { raster: 'raster' }, outputs: { motion: 'motion' },
    params: { frames: { type: 'int', min: 2, max: 24, default: 8 }, depth: { type: 'number', min: 0, max: 0.2, default: 0.06, unit: 'light change' }, fps: { type: 'number', min: 1, max: 12, default: 4 } }, cost: p => 4 * (p?.frames ?? 8),
    render: ({ inputs, params, w, h }) => {
      const R = px.resampleRaster(inputs.raster, w, h), frames = [];
      for (let k = 0; k < params.frames; k++) { const g = 1 + params.depth * Math.sin((2 * Math.PI * k) / params.frames), f = Float32Array.from(R.data, (v, i) => ((i & 3) === 3 ? v : v * g)); frames.push(f); }
      return { motion: guardFlashes({ w, h, fps: params.fps, frames }) };
    },
  }),
];
