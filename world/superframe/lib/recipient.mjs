// recipient.mjs: render any graph for the one who receives it. Framework section 1, "One panel of light": every
// medium ends as something a recipient's instrument can take in, and the conventions in between are open to rework.
// The only hard limits are physics and perception, so each recipient here is defined by what its instrument takes
// and by the checks that make a rendering perceptible to it:
//
//   eye           light on a panel: a raster, with visible contrast and no flashing above 3 Hz in motion
//   ear           pressure on an eardrum: audio inside 20 Hz to 20 kHz, audible, peak at or under -1 dBFS
//   reader        meaning in a reader's mind: plain text, the real words of any lettering first
//   screenreader  the same for assistive tech: a short alt text, a long description, and every real word in order
//   agent         a model's input: JSON with the recipe, the plan, every output's shape and digest, and the text
//
// forRecipient() converts from whatever the graph produced, through the ordinary converters, so a graph made for the
// eye can still be heard or read. Nothing here is drawn on a page; it is data the page or the agent asks for.
import { createHash } from 'node:crypto';
import { registry } from './registry.mjs';
import { conversionPath, lanesOf, domainsOf } from './graph.mjs';
import { nodeSeed } from './seed.mjs';
import { luma } from './pix.mjs';

export const RECIPIENTS = Object.freeze({
  eye: { takes: 'raster', doc: 'light on a flat panel' },
  ear: { takes: 'audio', doc: 'pressure on an eardrum' },
  reader: { takes: 'text', doc: 'words read by a person' },
  screenreader: { takes: 'text', doc: 'words announced by assistive technology' },
  agent: { takes: 'json', doc: 'structured input for a model' },
});

const ORDER = ['raster', 'glyphs', 'field', 'vector', 'particles', 'material', 'audio', 'events', 'series', 'text'];
const typeOf = v => (v?.rate && v.channels ? 'audio' : typeof v?.text === 'string' && v.mask ? 'glyphs' : typeof v?.text === 'string' ? 'text'
  : v?.data && v.data.length === v.w * v.h * 4 ? 'raster' : v?.data && v.channels ? 'field' : v?.paths ? 'vector' : v?.x && v?.n !== undefined ? 'particles'
  : Array.isArray(v?.events) ? 'events' : v?.y ? 'series' : v?.schema === 'studio.material/1' ? 'material' : null);

async function convertTo(value, from, to, ctx) {
  const chain = conversionPath(from, to);
  if (!chain) return null;
  let v = value;
  for (const c of chain) {
    const params = Object.fromEntries(Object.entries(c.params).map(([k, p]) => [k, p.default]));
    v = (await c.render({ inputs: { in: v }, params, ...ctx, ...nodeSeed(ctx.seed, `recipient/${c.id}`) })).out;
  }
  return v;
}

// Every value the graph made, outputs first, so a recipient reads from the richest source available.
function sources(ev) {
  const out = [];
  for (const v of Object.values(ev.outputs)) { const t = typeOf(v); if (t) out.push({ t, v }); }
  for (const inst of ev.plan.order) for (const [port, t] of Object.entries(inst.def.outputs)) { const v = ev.values.get(inst.id)?.[port]; if (v && !out.some(o => o.v === v)) out.push({ t, v, id: inst.id }); }
  return out;
}

function words(ev) {
  const seen = new Set(), list = [];
  for (const { t, v } of sources(ev)) if ((t === 'glyphs' || t === 'text') && v.text && !seen.has(v.text)) { seen.add(v.text); list.push(v.text); }
  return list;
}

function describe(ev, recipe) {
  const steps = ev.plan.order.filter(i => !i.inserted).map(i => i.def.title.replace(/\.$/, ''));
  const lanes = lanesOf(ev.plan), fields = domainsOf(ev.plan), w = words(ev);
  const img = ev.outputs.image, s = img ? luma(img).data : null;
  let tone = '';
  if (s) { let m = 0, q = 0; for (const x of s) { m += x; q += x * x; } m /= s.length; const sd = Math.sqrt(Math.max(0, q / s.length - m * m)); tone = `The picture is ${m < 0.35 ? 'dark' : m > 0.65 ? 'light' : 'mid-toned'}, with ${sd < 0.08 ? 'low' : sd < 0.2 ? 'moderate' : 'strong'} contrast.`; }
  const series = sources(ev).filter(o => o.t === 'series');
  return {
    steps, lanes, fields, words: w, tone,
    long: [
      w.length ? `Words: ${w.map(x => `"${x}"`).join(', ')}.` : '',
      `Made in ${steps.length} steps: ${steps.join(', then ')}.`,
      tone,
      ev.outputs.audio ? `It also sounds, for ${(ev.outputs.audio.channels[0].length / ev.outputs.audio.rate).toFixed(1)} seconds.` : '',
      series.length ? `It carries data: ${series.map(o => o.v.label ?? 'a series').join(', ')}.` : '',
    ].filter(Boolean).join(' '),
  };
}

// Perceptibility checks: physics and the recipient's instrument, nothing else.
export function perceptible(recipient, v) {
  const why = [];
  if (recipient === 'eye') {
    if (!v?.data) why.push('no picture');
    else { const s = luma(v).data; let lo = 1, hi = 0; for (const x of s) { if (x < lo) lo = x; if (x > hi) hi = x; } if (hi - lo < 2 / 255) why.push('no visible contrast: the panel shows one flat level'); }
  } else if (recipient === 'ear') {
    if (!v?.channels) why.push('no sound');
    else {
      if (v.rate < 8000) why.push(`sample rate ${v.rate} Hz cannot carry speech-band sound`);
      let peak = 0, e = 0; const x = v.channels[0]; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; e += x[i] * x[i]; }
      const rmsDb = 10 * Math.log10(e / Math.max(1, x.length) + 1e-20);
      if (rmsDb < -60) why.push(`inaudible: RMS ${rmsDb.toFixed(0)} dBFS`);
      if (peak > 0.892) why.push(`peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS is over the -1 dBFS ceiling`);
      if (x.length / v.rate < 0.05) why.push('shorter than 50 ms, under the time the ear needs to hear a pitch');
    }
  } else if (recipient === 'reader' || recipient === 'screenreader') {
    const t = recipient === 'reader' ? v : v?.alt;
    if (typeof t !== 'string' || !t.trim()) why.push('no words');
  } else if (recipient === 'agent') { if (!v?.recipe) why.push('no recipe'); }
  return { ok: why.length === 0, why };
}

// Render an evaluated graph for one recipient. ev is the result of evaluate(); recipe the recipe it ran.
export async function forRecipient(recipient, ev, recipe) {
  if (!RECIPIENTS[recipient]) throw new Error(`recipient: unknown "${recipient}" (one of ${Object.keys(RECIPIENTS).join(', ')})`);
  const [w, h] = recipe.size ?? [256, 256], ctx = { w, h, palette: { ground: '#ebe5d8', ink: '#15130f', accent: '#c4632b', ...(recipe.palette ?? {}) }, time: recipe.time ?? { t: 1, duration: 2, fps: 24 }, seed: recipe.seed ?? 'superframe' };
  const d = describe(ev, recipe);
  let value;
  if (recipient === 'eye' || recipient === 'ear') {
    const want = RECIPIENTS[recipient].takes, have = sources(ev).sort((a, b) => ORDER.indexOf(a.t) - ORDER.indexOf(b.t));
    const direct = have.find(o => o.t === want);
    if (direct) value = direct.v;
    else for (const o of (recipient === 'ear' ? [...have].reverse() : have)) { value = await convertTo(o.v, o.t, want, ctx); if (value) break; }
  } else if (recipient === 'reader') {
    value = d.long;
  } else if (recipient === 'screenreader') {
    value = { alt: (d.words.length ? `${d.words.join(' ')}: ` : '') + `${d.steps.slice(0, 3).join(', ')}${d.steps.length > 3 ? ', and more' : ''}.`, long: d.long, words: d.words, lang: 'en' };
  } else {
    const shape = v => { const t = typeOf(v); const dig = v?.data ?? v?.channels?.[0] ?? v?.mask; return { type: t, ...(v?.w ? { w: v.w, h: v.h } : {}), ...(v?.rate ? { rate: v.rate, seconds: +(v.channels[0].length / v.rate).toFixed(3), channels: v.channels.length } : {}), ...(dig ? { sha256: createHash('sha256').update(Buffer.from(dig.buffer, dig.byteOffset, dig.byteLength)).digest('hex') } : {}), ...(v?.text ? { text: v.text } : {}) }; };
    value = { schema: 'superframe.agent/1', recipe, plan: ev.plan.order.map(i => ({ id: i.id, node: i.def.id, inserted: !!i.inserted, params: i.params })), lanes: d.lanes, fields: d.fields, words: d.words, description: d.long, outputs: Object.fromEntries(Object.entries(ev.outputs).map(([k, v]) => [k, shape(v)])), timings: ev.timings };
  }
  return { recipient, value, check: perceptible(recipient, value) };
}
