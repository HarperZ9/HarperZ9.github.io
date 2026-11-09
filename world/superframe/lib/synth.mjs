// synth.mjs: a small offline synthesiser for the events port, pure JS, deterministic. It plays the voice names of
// the sound engine (sound/sound/voices.js) and the studio score with simple stand-in models, because that
// engine needs WebAudio and does not run in Node. The stand-ins are not byte- or timbre-equal to the engine; a browser
// render through the engine stays the reference for finished audio.
const TAU = Math.PI * 2;
const mtof = m => 440 * 2 ** ((m - 69) / 12);

function voiceFn(name) {
  switch (name) {
    case 'kick808': case 'kick': case 'sub': return kick;
    case 'snare': case 'clap': return snare;
    case 'hat': case 'hatRoll': case 'noise': case 'scrape': case 'rip': return hat;
    case 'bell': return bell;
    case 'pad': case 'voice': return pad;
    case 'bubble': case 'creak': return bubble;
    default: return pluck;
  }
}

function pluck(L, R, i0, sr, a, r) {
  const f = mtof(a.note ?? 60), dur = Math.min(4, a.dur ?? 0.4) + 0.3, n = Math.floor(dur * sr), vel = a.vel ?? 0.5;
  const bright = Math.min(0.99, (a.bright ?? 3000) / 6000), period = Math.max(2, Math.round(sr / f)), buf = new Float32Array(period);
  for (let k = 0; k < period; k++) buf[k] = r() * 2 - 1;
  let idx = 0, last = 0;
  for (let k = 0; k < n && i0 + k < L.length; k++) {
    const v = buf[idx]; const nv = (v * bright + last * (1 - bright)) * 0.996; last = v; buf[idx] = nv; idx = (idx + 1) % period;
    const s = v * vel * 0.6; L[i0 + k] += s; R[i0 + k] += s;
  }
}
function bell(L, R, i0, sr, a) {
  const f = mtof(a.note ?? 76), dur = (a.dur ?? 0.9) * 2, n = Math.floor(dur * sr), vel = a.vel ?? 0.4, ratio = a.ratio ?? 3.5;
  for (let k = 0; k < n && i0 + k < L.length; k++) {
    const t = k / sr, env = Math.exp(-t * 3 / dur * 2), m = Math.sin(TAU * f * ratio * t) * 2.2 * env;
    const s = Math.sin(TAU * f * t + m) * env * vel * 0.5; L[i0 + k] += s; R[i0 + k] += s;
  }
}
function kick(L, R, i0, sr, a) {
  const f0 = a.pitch ?? mtof(a.note ?? 33), dur = Math.min(1.6, a.dur ?? 0.5), n = Math.floor(dur * sr), vel = a.vel ?? 0.8;
  let ph = 0;
  for (let k = 0; k < n && i0 + k < L.length; k++) {
    const t = k / sr, f = f0 * (1 + 3 * Math.exp(-t * 30)); ph += TAU * f / sr;
    const s = Math.tanh(Math.sin(ph) * 1.6) * Math.exp(-t * 4 / dur) * vel * 0.7; L[i0 + k] += s; R[i0 + k] += s;
  }
}
function snare(L, R, i0, sr, a, r) {
  const n = Math.floor(0.25 * sr), vel = a.vel ?? 0.6;
  for (let k = 0; k < n && i0 + k < L.length; k++) { const t = k / sr, s = ((r() * 2 - 1) * 0.7 + Math.sin(TAU * 185 * t) * 0.3) * Math.exp(-t * 22) * vel * 0.5; L[i0 + k] += s; R[i0 + k] += s; }
}
function hat(L, R, i0, sr, a, r) {
  const dur = a.open ? 0.3 : a.dur ?? 0.05, n = Math.floor(dur * sr), vel = a.vel ?? 0.3; let prev = 0;
  for (let k = 0; k < n && i0 + k < L.length; k++) { const w = r() * 2 - 1, hp = w - prev; prev = w; const s = hp * Math.exp(-k / sr * 4 / dur) * vel * 0.25; L[i0 + k] += s; R[i0 + k] += s * 0.9; }
}
function pad(L, R, i0, sr, a) {
  const notes = a.notes ?? [a.note ?? 57], dur = a.dur ?? 2, n = Math.floor((dur + 0.5) * sr), vel = (a.vel ?? 0.2) / notes.length, att = a.attack ?? 0.3;
  for (let k = 0; k < n && i0 + k < L.length; k++) {
    const t = k / sr, env = Math.min(1, t / att) * (t > dur ? Math.exp(-(t - dur) * 6) : 1);
    let s = 0; for (const m of notes) { const f = mtof(m); s += Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 1.003 * 2 * t); }
    L[i0 + k] += s * env * vel * 0.35; R[i0 + k] += s * env * vel * 0.33;
  }
}
function bubble(L, R, i0, sr, a) {
  const f0 = mtof(a.note ?? 72), n = Math.floor(0.12 * sr), vel = a.vel ?? 0.3; let ph = 0;
  for (let k = 0; k < n && i0 + k < L.length; k++) { const t = k / sr; ph += TAU * f0 * (1 + t * 8) / sr; const s = Math.sin(ph) * Math.exp(-t * 30) * vel * 0.5; L[i0 + k] += s; R[i0 + k] += s; }
}

// Render events to stereo float at rate. Peak-normalised to -1 dBFS if it would clip; otherwise left as is.
export function renderEvents(ev, { rate = 48000, tail = 1, rng }) {
  const n = Math.max(1, Math.ceil((ev.duration + tail) * rate)), L = new Float32Array(n), R = new Float32Array(n);
  for (const e of ev.events) voiceFn(e.voice)(L, R, Math.floor(e.t * rate), rate, e.args ?? {}, rng);
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = peak > 0.89 ? 0.89 / peak : 1;
  if (g !== 1) for (let i = 0; i < n; i++) { L[i] *= g; R[i] *= g; }
  return { rate, channels: [L, R] };
}
