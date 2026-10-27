// transform.mjs: the language edges of the transformation engine, as plain functions any adapter, page or tool can
// call. Deterministic, local, no model and no network: words to numbers, code to words, sound to words, a picture to
// words, a sentence to story beats, and a sentence to a voice line of notes. Every output says only what the input
// holds; nothing here guesses at meaning or feeling.
import { luma, toSrgb } from './pix.mjs';

// ---- words to numbers
export function textToSeries(text, mode = 'words') {
  const s = String(text ?? '');
  if (mode === 'letters') { const y = [...s].filter(c => /\p{L}|\p{N}/u.test(c)).map(c => c.codePointAt(0)); return { y: y.length >= 2 ? y : [0, 0], label: 'letter codes', unit: 'code point' }; }
  const words = splitWords(s);
  if (mode === 'vowels') { const y = words.map(w => (w.match(/[aeiouy]/gi) ?? []).length / Math.max(1, w.length)); return { y: y.length >= 2 ? y : [...y, ...y, 0].slice(0, 2), label: 'vowel share per word', unit: 'share' }; }
  const y = words.map(w => [...w].length);
  return { y: y.length >= 2 ? y : [y[0] ?? 0, 0], label: 'letters per word', unit: 'letters' };
}
export const splitWords = s => String(s ?? '').split(/\s+/).map(w => w.trim()).filter(Boolean);

// ---- a sentence as story beats: one to three words per beat, never splitting a word, punctuation kept
export function storyBeats(text, { maxChars = 16 } = {}) {
  const beats = []; let cur = [];
  for (const w of splitWords(text)) {
    const next = [...cur, w].join(' ');
    if (cur.length && (next.length > maxChars || cur.length >= 3 || /[.!?,;:]$/.test(cur.at(-1)))) { beats.push(cur.join(' ')); cur = [w]; } else cur.push(w);
  }
  if (cur.length) beats.push(cur.join(' '));
  return beats.length ? beats : [''];
}

// ---- a sentence as a voice line: one note per syllable, a contour that falls at a full stop and rises at a question
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
export function syllables(word) { const m = word.toLowerCase().replace(/[^a-z]/g, '').replace(/e$/, '').match(/[aeiouy]+/g); return Math.max(1, m ? m.length : 1); }
export function voiceLine(text, { beatSeconds = 1.2, root = 57, voice = 'pluck' } = {}) {
  const beats = storyBeats(text), events = [];
  beats.forEach((beat, b) => {
    const words = splitWords(beat), syl = words.flatMap(w => Array.from({ length: syllables(w) }, (_, i) => ({ w, first: i === 0 })));
    const end = /[?]$/.test(beat) ? 'rise' : /[.!]$/.test(beat) ? 'fall' : 'level', loud = /!$/.test(beat);
    const step = beatSeconds / Math.max(1, syl.length + 1);
    syl.forEach((s, i) => {
      const pos = syl.length > 1 ? i / (syl.length - 1) : 0, code = s.w.charCodeAt(0) || 97;
      let deg = (code + b) % 5 + 1;
      if (end === 'rise') deg += Math.round(pos * 3); else if (end === 'fall') deg -= Math.round(pos * 3);
      events.push({ t: +(b * beatSeconds + i * step).toFixed(4), voice, role: 'syllable', args: { note: root + SCALE[Math.max(0, Math.min(SCALE.length - 1, deg))], dur: +(step * 1.6).toFixed(3), vel: (s.first ? 0.6 : 0.42) + (loud ? 0.2 : 0) }, text: s.first ? s.w : '' });
    });
  });
  return { duration: beats.length * beatSeconds, events };
}

// ---- code to words: what the code is made of, in plain sentences, read from its structure (JavaScript, Python and
// most C-like languages). It names constructs and counts them; it does not claim to know what the program is for.
export function explainCode(code) {
  const src = String(code ?? ''), lines = src.split(/\r?\n/), out = [];
  const count = re => (src.match(re) ?? []).length;
  const fns = [...src.matchAll(/\b(?:function\s+([A-Za-z_$][\w$]*)|def\s+([A-Za-z_]\w*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/g)].map(m => m[1] ?? m[2] ?? m[3]);
  const loops = count(/\b(for|while)\b/g), ifs = count(/\bif\b/g), returns = count(/\breturn\b/g), calls = count(/[A-Za-z_$][\w$]*\s*\(/g) - fns.length;
  const strings = [...src.matchAll(/(["'`])((?:\\.|(?!\1).){1,40})\1/g)].map(m => m[2]).slice(0, 3), comments = lines.filter(l => /^\s*(\/\/|#)/.test(l)).map(l => l.replace(/^\s*(\/\/|#)\s?/, '').trim()).filter(Boolean);
  out.push(`This code has ${lines.filter(l => l.trim()).length} non-empty line${lines.length === 1 ? '' : 's'}.`);
  if (fns.length) out.push(`It defines ${fns.length === 1 ? 'one function' : `${fns.length} functions`}: ${fns.slice(0, 6).join(', ')}${fns.length > 6 ? ', and more' : ''}.`);
  if (loops) out.push(`It repeats something in ${loops === 1 ? 'one loop' : `${loops} loops`}.`);
  if (ifs) out.push(`It makes ${ifs === 1 ? 'one choice' : `${ifs} choices`} with if.`);
  if (returns) out.push(`It gives back a result in ${returns === 1 ? 'one place' : `${returns} places`}.`);
  if (calls > 0) out.push(`It calls other code ${calls === 1 ? 'once' : `${calls} times`}.`);
  if (strings.length) out.push(`Text inside it: ${strings.map(s => `"${s}"`).join(', ')}.`);
  if (comments.length) out.push(`Its notes say: ${comments.slice(0, 3).join(' / ')}.`);
  return out.join(' ');
}

// ---- sound to words
export function describeSound(a) {
  const x = a.channels[0], n = x.length, sec = n / a.rate, win = Math.max(1, Math.floor(a.rate * 0.05)), env = [];
  for (let i = 0; i + win <= n; i += win) { let s = 0; for (let k = i; k < i + win; k++) s += x[k] * x[k]; env.push(Math.sqrt(s / win)); }
  const peak = Math.max(...env, 1e-9), loudDb = 20 * Math.log10(peak + 1e-12), onsets = env.filter((v, i) => i && v > 0.3 * peak && v > env[i - 1] * 1.6).length;
  let zc = 0; for (let i = 1; i < Math.min(n, a.rate * 4); i++) if ((x[i - 1] < 0) !== (x[i] < 0)) zc++;
  const bright = zc / Math.min(sec, 4) / 2, third = Math.floor(env.length / 3) || 1, mean = r => r.reduce((p, q) => p + q, 0) / Math.max(1, r.length);
  const shape = mean(env.slice(-third)) > mean(env.slice(0, third)) * 1.4 ? 'grows louder toward the end' : mean(env.slice(0, third)) > mean(env.slice(-third)) * 1.4 ? 'fades toward the end' : 'stays about as loud throughout';
  return `A sound ${sec.toFixed(1)} seconds long. It ${shape}, with ${onsets === 0 ? 'no clear beats' : onsets === 1 ? 'one clear beat' : `about ${onsets} clear beats`}. It is ${loudDb > -6 ? 'loud' : loudDb > -18 ? 'medium' : 'quiet'} and ${bright > 2500 ? 'bright' : bright > 700 ? 'mid-toned' : 'low and dark'} in tone.`;
}

// ---- a picture to words: tone, contrast, the main colour family, and where the mass sits
const HUES = [[0, 'red'], [30, 'orange'], [55, 'yellow'], [90, 'green'], [170, 'teal'], [205, 'blue'], [260, 'violet'], [300, 'pink'], [345, 'red']];
function hueName(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
  if (c < 0.08) return mx > 0.7 ? 'white' : mx < 0.2 ? 'black' : 'grey';
  let h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; h = (h * 60 + 360) % 360;
  let name = 'red'; for (const [deg, nm] of HUES) if (h >= deg) name = nm; return name;
}
export function describePicture(R) {
  const L = luma(R).data, n = L.length; let s = 0, s2 = 0, mx = 0, my = 0, mw = 0;
  for (let i = 0; i < n; i++) { const v = L[i]; s += v; s2 += v * v; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, s2 / n - mean * mean));
  for (let i = 0; i < n; i++) { const wgt = Math.abs(L[i] - mean); mx += (i % R.w) * wgt; my += Math.floor(i / R.w) * wgt; mw += wgt; }
  const cx = mw ? mx / mw / R.w : 0.5, cy = mw ? my / mw / R.h : 0.5, counts = {};
  for (let i = 0; i < n; i += 7) { const k = hueName(toSrgb(R.data[4 * i]), toSrgb(R.data[4 * i + 1]), toSrgb(R.data[4 * i + 2])); counts[k] = (counts[k] ?? 0) + 1; }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
  const where = `${cy < 0.4 ? 'upper' : cy > 0.6 ? 'lower' : 'middle'}${cx < 0.4 ? ' left' : cx > 0.6 ? ' right' : ''}`.replace('middle', cx < 0.4 || cx > 0.6 ? 'middle' : 'centre');
  return `A ${mean < 0.35 ? 'dark' : mean > 0.65 ? 'light' : 'mid-toned'} picture with ${sd < 0.08 ? 'soft' : sd < 0.2 ? 'clear' : 'strong'} contrast, mostly ${top.join(' and ')}. Its busiest part sits in the ${where}.`;
}
