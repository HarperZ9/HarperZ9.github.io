// Jazz-funk kit: synthesized drums with velocity-dependent timbre (a ghost note is shorter and darker, not just quieter) and a
// groove generator with human swing (each limb has its own timing habit) and ghost-note density. Our own synthesis and our
// own patterns; the reference was a public description of a style (REFERENCES.md), not any recording.
import { rng, velocity, Biquad, expDecay, softclip, edges, mtof, panInto } from './core.js';

export const meta = {
  id: 'funkkit', title: 'Jazz-funk kit', kind: 'drums',
  params: {
    tune: { min: -6, max: 6, default: 0, unit: 'semitones' }, decay: { min: 0.5, max: 2, default: 1, unit: 'x' }, snap: { min: 0, max: 1, default: 0.6 },
    tight: { min: 0, max: 1, default: 0.5, doc: 'hat closure and kick damping' }, grit: { min: 0, max: 1, default: 0.2, doc: 'drive into a soft clip' },
    swing: { min: 0.5, max: 0.7, default: 0.57, doc: 'eighth-pair swing of the hats' }, ghosts: { min: 0, max: 1, default: 0.5, doc: 'ghost-note density on the snare' },
    human: { min: 0, max: 1, default: 0.5, doc: 'microtiming and velocity spread' }, pocket: { min: -1, max: 1, default: 0.3, doc: 'snare lays back (+) or pushes (-)' },
  },
  presets: {
    'deep-pocket': { tune: -1, decay: 1.1, snap: 0.55, tight: 0.55, grit: 0.15, swing: 0.58, ghosts: 0.7, human: 0.6, pocket: 0.45 },
    'second-line': { tune: 1, decay: 0.9, snap: 0.75, tight: 0.35, grit: 0.1, swing: 0.62, ghosts: 0.85, human: 0.7, pocket: 0.15 },
    'dry-break': { tune: 0, decay: 0.8, snap: 0.8, tight: 0.75, grit: 0.45, swing: 0.54, ghosts: 0.4, human: 0.35, pocket: 0.1 },
    'brushed-room': { tune: -2, decay: 1.4, snap: 0.3, tight: 0.25, grit: 0.05, swing: 0.6, ghosts: 0.6, human: 0.8, pocket: 0.5 },
  },
};

// A band-limited square: odd harmonics only up to 16 kHz, so the metallic partials do not alias.
const bsq = (ph, f) => { let s = 0; for (let k = 1; k * f < 16000; k += 2) s += Math.sin(k * ph) / k; return s * 1.27; };

// One hit as a mono Float32Array. piece: kick, snare, hat, ohat, phat (pedal), ride, rim.
export function hit(piece, vel, p, sr, seed = 1) {
  const V = velocity(vel, { curve: 1.5 }), r = rng(seed), T = Math.pow(2, p.tune / 12), dec = p.decay;
  const len = Math.floor(sr * ({ kick: 0.6, snare: 0.4, hat: 0.12, ohat: 0.7, phat: 0.15, ride: 1.6, rim: 0.12 }[piece] * dec)), x = new Float32Array(len);
  if (piece === 'kick') {
    let ph = 0; const f0 = 52 * T, damp = 0.12 + 0.18 * (1 - p.tight);
    for (let i = 0; i < len; i++) { const t = i / sr, f = f0 * (1 + 2.2 * expDecay(t, 0.012 + 0.01 * V.bright)); ph += 2 * Math.PI * f / sr; x[i] = Math.sin(ph) * expDecay(t, damp * dec) + (r() * 2 - 1) * 0.25 * V.bright * expDecay(t, 0.002); }
    new Biquad('lp', 2500 + 4000 * V.bright, 0.7, sr).run(x);
  } else if (piece === 'snare' || piece === 'rim') {
    const rim = piece === 'rim', shell = new Biquad('bp', (rim ? 520 : 190) * T, rim ? 8 : 2.5, sr), wires = new Biquad('hp', 1800 + 2600 * V.bright, 0.7, sr), dark = new Biquad('lp', 3500 + 7500 * V.bright, 0.6, sr);
    const tw = (0.05 + 0.13 * V.bright) * dec, tb = 0.06 * dec; let ph = 0;
    for (let i = 0; i < len; i++) { const t = i / sr, n = r() * 2 - 1; ph += 2 * Math.PI * 185 * T / sr;
      const body = (Math.sin(ph) * 0.6 + shell.tick(n) * 2) * expDecay(t, tb), w = rim ? 0 : dark.tick(wires.tick(n)) * expDecay(t, tw) * (0.4 + 0.6 * p.snap);
      x[i] = body * (rim ? 1.4 : 0.7) + w; }
  } else if (piece === 'ride') {
    const ratios = [1, 1.483, 1.932, 2.546, 2.63, 3.897], f0 = 610 * T, hp = new Biquad('hp', 3000, 0.6, sr), ph = ratios.map(() => r() * 6.28);
    for (let i = 0; i < len; i++) { const t = i / sr; let s = 0; ratios.forEach((q, k) => { s += bsq(ph[k] + 2 * Math.PI * f0 * q * t, f0 * q); }); x[i] = (hp.tick(s / 6 * 0.5 + (r() * 2 - 1) * 0.4)) * (expDecay(t, 0.9 * dec) * 0.6 + expDecay(t, 0.02) * 0.6 * V.bright); }
    new Biquad('lp', 9500, 0.5, sr).run(x);
  } else {  // hats: six detuned square partials (our ratios) through a band-pass and a high-pass, plus noise
    const ratios = [1, 1.304, 1.657, 1.995, 2.444, 3.141], f0 = 410 * T, bp = new Biquad('bp', 8200, 1.2, sr), hp = new Biquad('hp', 6500, 0.7, sr), lp = new Biquad('lp', 12500, 0.6, sr);
    const tau = piece === 'ohat' ? 0.22 * dec * (1.3 - p.tight) : piece === 'phat' ? 0.03 : (0.018 + 0.03 * (1 - p.tight)) * dec;
    for (let i = 0; i < len; i++) { const t = i / sr; let s = 0; for (const q of ratios) s += bsq(2 * Math.PI * f0 * q * t, f0 * q); x[i] = lp.tick(hp.tick(bp.tick(s / 6 + (r() * 2 - 1) * 0.5))) * expDecay(t, tau) * (piece === 'phat' ? 0.6 : 1); }
  }
  if (p.grit > 0) softclip(x, 1 + 5 * p.grit);
  let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v)); const g = pk ? V.gain / pk * ({ kick: 0.95, snare: 0.8, rim: 0.5, hat: 0.38, ohat: 0.35, phat: 0.3, ride: 0.32 }[piece]) : 0;
  for (let i = 0; i < len; i++) x[i] *= g; return edges(x, sr, 0.0005, 0.01);
}

// A groove: events { step (16ths, fractional), piece, vel } for `bars` bars. style: 'funk', 'halftime' (snare on 3), 'ride'.
// Human swing: hats swing by p.swing, the snare lays back by p.pocket, every hit wanders by up to 12 ms times p.human.
export function groove(bars, p, { style = 'funk', seed = 7, fills = true } = {}) {
  const r = rng(seed), ev = [], sw = (s) => (s % 2 === 1 ? s - 1 + 2 * p.swing : s);
  const jitter = () => (r() - 0.5) * 0.2 * p.human;  // in 16ths: at 96 BPM a 16th is 156 ms, so 0.1 is about 16 ms
  for (let b = 0; b < bars; b++) {
    const o = b * 16, last = b === bars - 1;
    const kicks = style === 'halftime' ? [0, 3, 10] : [0, 6, 7, 10].filter((s) => s !== 7 || r() < 0.5);
    kicks.forEach((s) => ev.push({ step: o + s + jitter(), piece: 'kick', vel: s === 0 ? 0.95 : 0.75 + 0.15 * r() }));
    const backs = style === 'halftime' ? [8] : [4, 12];
    backs.forEach((s) => ev.push({ step: o + s + 0.15 * p.pocket + jitter() * 0.5, piece: 'snare', vel: 0.9 + 0.1 * r() }));
    for (let s = 1; s < 16; s++) if (!backs.includes(s) && r() < 0.18 * p.ghosts * (s % 2 ? 1.6 : 0.8)) ev.push({ step: o + sw(s) + jitter(), piece: 'snare', vel: 0.12 + 0.18 * r() });
    const ride = style === 'ride';
    for (let s = 0; s < 16; s += ride ? 2 : 1) {
      if (!ride && s % 2 === 1 && r() > 0.55 + 0.4 * p.ghosts) continue;
      const accent = s % 4 === 0 ? 0.75 : s % 2 === 0 ? 0.55 : 0.35;
      ev.push({ step: o + sw(s) + jitter(), piece: ride ? 'ride' : (s === 14 && b % 2 === 1 ? 'ohat' : 'hat'), vel: accent * (0.85 + 0.3 * r() * p.human) });
    }
    if (style !== 'halftime') ev.push({ step: o + 4 + jitter(), piece: 'phat', vel: 0.4 }), ev.push({ step: o + 12 + jitter(), piece: 'phat', vel: 0.4 });
    if (fills && last) for (let k = 0; k < 6; k++) ev.push({ step: o + 12 + k * (4 / 6) + jitter() * 0.3, piece: k % 3 === 2 ? 'rim' : 'snare', vel: 0.35 + 0.1 * k });
  }
  return ev.sort((a, b) => a.step - b.step);
}

// Render a groove to stereo (kick and snare centre, hats right, ride left, ghosts slightly wide).
export function render(events, p, { bpm = 96, sr = 48000, bars = 2, tail = 1.5 } = {}) {
  const step = 60 / bpm / 4, n = Math.ceil((bars * 16 * step + tail) * sr), L = new Float32Array(n), R = new Float32Array(n), cache = new Map();
  const pan = { kick: 0, snare: 0, rim: -0.1, hat: 0.35, ohat: 0.35, phat: 0.3, ride: -0.35 };
  events.forEach((e, i) => { const key = `${e.piece}:${Math.round(e.vel * 12)}:${i % 3}`; if (!cache.has(key)) cache.set(key, hit(e.piece, Math.round(e.vel * 12) / 12, p, sr, 11 + i % 3));
    panInto(L, R, cache.get(key), Math.round(Math.max(0, e.step) * step * sr), pan[e.piece] + (e.vel < 0.3 && e.piece === 'snare' ? 0.12 : 0)); });
  return { L, R, sr, seconds: n / sr };
}
export { mtof };
