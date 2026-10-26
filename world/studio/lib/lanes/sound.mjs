// lanes/sound.mjs: a material as a score of engine voices. The score is pure data (node tests hash it); the
// browser plays it live on ../../sound/sound/engine.js or renders it offline for WAV export.
//
//   const sc = score(material, { seconds: 4, seed: 2, drive });
//   sc.events  [{ t, voice, args, role }]   sc.onsets [t, ...] (the audio-to-visual drivers read these)
//   await renderScore(Engine, sc)            -> AudioBuffer at 48 kHz, through the engine's true-peak limiter
//   playScore(engine, sc)                    schedules now; returns { stop, ended }
import * as V from '../../../sound/sound/voices.js';
import { EXTRA } from '../voices-extra.mjs';
import { normalize, fnv, canonical } from '../schema.mjs';
import { rng } from '../field.mjs';
import { levelLufs } from '../loudness.mjs';

const VOICE_FNS = { ...V, ...EXTRA };
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17];
const r3 = x => +x.toFixed(4);

// Each voice role turns the core numbers into events. g is the voice's gain; s is the step (one sixteenth).
function voiceEvents(v, c, nc, R, sec, s, grid) {
  const out = [], g = v.gain, push = (t, voice, args) => { if (t < sec) out.push({ t: r3(t), voice, args, role: v.role ?? voice }); };
  const density = 0.15 + 0.85 * c.particles, regular = c.order;
  const hit = k => (regular > 0.6 ? grid[k % grid.length] : R() < density * 0.5 + regular * 0.3);
  switch (v.voice) {
    case 'kick808': for (let k = 0; k * s < sec; k += 1) if (k % 8 === 0 || (k % 16 === 10 && c.transient > 0.7) || (k % 8 === 3 && R() < 0.2 * c.transient)) push(k * s, 'kick808', { note: Math.round(c.pitch), dur: r3(Math.min(1.6, c.decayS)), drive: r3(1 + 8 * c.transient), vel: r3(0.9 * g), glideTo: c.transient > 0.8 && k % 16 === 10 ? Math.round(c.pitch) - 5 : null, clip: false }); break;
    case 'kick': for (let k = 0; k * s < sec; k += 4) push(k * s, 'kick', { vel: r3(0.8 * g), pitch: 40 + 30 * c.brightness, decay: r3(0.1 + c.decayS * 0.3) }); break;
    case 'snare': case 'clap': for (let k = 8; k * s < sec; k += 16) push(k * s, v.voice, { vel: r3(0.7 * g) }); break;
    case 'hat': for (let k = 0; k * s < sec; k += 2) if (hit(k)) push(k * s, 'hat', { vel: r3((0.3 + 0.3 * R()) * g), open: R() < 0.1 }); break;
    case 'hatRoll': for (let k = 0; k * s < sec; k += 2) { if (k % 16 === 14) push(k * s, 'hatRoll', { n: 6, span: r3(s * 2), from: 0.25, to: r3(0.7 * g), pitchRise: 0.2 }); else push(k * s, 'hat', { vel: r3((0.25 + 0.2 * (k % 4 === 0)) * g) }); } break;
    case 'sub': push(0, 'sub', { note: Math.round(c.pitch) - 12, dur: r3(sec * 0.9), vel: r3(0.5 * g), attack: 0.2 }); break;
    case 'pluck': for (let k = 0; k * s < sec; k += 1) if (k % 2 === 0 ? hit(k) : R() < density * 0.15) {
      const note = Math.round(c.pitch) + PENTA[(R() * PENTA.length) | 0] + (v.role === 'drip' ? 12 : 0);
      push(k * s, 'pluck', { note, dur: r3(Math.max(0.05, c.decayS)), vel: r3(0.45 * g), bright: Math.round(800 + 7000 * c.brightness), type: c.transient > 0.5 ? 'square' : 'sawtooth' });
    } break;
    case 'bell': { const step = c.order > 0.8 ? 4 : 6; for (let k = 0; k * s < sec; k += step) if (hit(k) || k === 0) push(k * s, 'bell', { note: Math.round(c.pitch) + 12 + PENTA[k / step % PENTA.length | 0], dur: r3(Math.min(3, c.decayS)), vel: r3(0.3 * g), ratio: r3(1.4 + 2.6 * c.order), index: Math.round(80 + 400 * c.brightness) }); } break;
    case 'pad': push(0, 'pad', { notes: [0, 7, 12, 16].map(n => Math.round(c.pitch) + n), dur: r3(sec), vel: r3(0.12 * g), attack: r3(Math.min(1.5, sec * 0.3)), release: r3(Math.min(1.5, sec * 0.3)), cutoff: Math.round(500 + 4000 * c.brightness), spread: Math.round(4 + 14 * c.sheen) }); break;
    case 'noise':
      if (/hiss|wash|bed/.test(v.role ?? '') || c.flow > 0.8) push(0, 'noise', { dur: r3(sec), kind: nc, vel: r3(0.2 * g), lp: Math.round(1500 + 12000 * c.brightness), hp: Math.round(60 + 2000 * c.brightness * c.transient), attack: 0.3, release: 0.4 });
      else for (let k = 0; k * s < sec; k += 1) if (R() < 0.15 + 0.6 * c.particles * c.noise) push(k * s, 'noise', { dur: r3(0.02 + 0.2 * (1 - c.transient)), kind: nc, vel: r3((0.15 + 0.2 * R()) * g), lp: Math.round(2000 + 10000 * c.brightness), hp: Math.round(200 + 3000 * c.brightness), attack: 0.002, release: 0.02 });
      break;
    case 'scrape': for (let k = 0; k * s < sec; k += 1) if (hit(k) || R() < 0.35) push(k * s, 'scrape', { dur: r3(0.04 + 0.12 * R()), vel: r3(0.35 * g), freq: Math.round(c.resonanceHz * (0.8 + 0.4 * R())) }); break;
    case 'rip': for (let k = 0; k * s < sec; k += 3) if (k === 0 || R() < 0.6) push(k * s, 'rip', { dur: r3(0.25 + 0.4 * R()), vel: r3(0.5 * g), from: Math.round(c.resonanceHz * 0.5), to: Math.round(c.resonanceHz * 4) }); break;
    case 'bubble': for (let k = 0; k * s / 3 < sec; k += 1) if (R() < 0.25 + 0.5 * c.flow) push(k * s / 3 + R() * s / 3, 'bubble', { radius: r3(0.8 + 5 * R() ** 2), vel: r3(0.25 * g), dur: r3(0.04 + 0.1 * R()) }); break;
    case 'creak': for (let k = 0; k * s < sec; k += 4) push(k * s, 'creak', { note: Math.round(c.pitch), dur: r3(s * 3), vel: r3(0.35 * g), body: Math.round(c.resonanceHz * 3), bend: r3(0.3 + 0.7 * c.tension) }); break;
    default: throw new Error(`sound: no events for voice ${v.voice}`);
  }
  return out;
}

export function score(material, { seconds = null, seed = 1, drive = null } = {}) {
  const m = normalize(material), c = m.core, R = rng(seed * 7919 + 17);
  const sec = seconds ?? Math.max(2, Math.min(8, c.durationS * 2)), s = 60 / c.tempo / 4;
  const grid = drive?.grid ?? Array.from({ length: 16 }, (_, k) => k % 4 === 0 || (c.order > 0.85 && k % 2 === 0));
  let events = m.hints.sound.voices.flatMap(v => voiceEvents(v, c, m.noiseColour, R, sec, s, grid));
  if (drive?.events) events = events.concat(drive.events.filter(e => e.t < sec));
  events.sort((a, b) => a.t - b.t || (a.voice < b.voice ? -1 : 1));
  const onsets = [...new Set(events.filter(e => !['pad', 'sub'].includes(e.voice) && !(e.voice === 'noise' && e.args.dur > 1)).map(e => e.t))];
  return { seconds: sec, tempo: c.tempo, step: s, events, onsets, motif: m.hints.sound.motif };
}
export const hashScore = sc => fnv(canonical(sc)).toString(16).padStart(8, '0');

// Schedule a score on an engine (live or offline). Every event also lands in the engine's hit queue, so the
// visuals can read engine.due() and move on the onsets they hear.
export function schedule(engine, sc, t0 = engine.now + 0.06, dest = engine.master) {
  for (const e of sc.events) {
    VOICE_FNS[e.voice](engine.ctx, dest, t0 + e.t, e.args);
    engine.hit(t0 + e.t, e.role, e.args.vel ?? 0.5, { voice: e.voice });
  }
  return t0 + sc.seconds;
}

// Offline render through the engine's master chain (DC block, true-peak limiter). Browser only.
// Every material is levelled to -14 LUFS integrated (ITU-R BS.1770-4, gated) with the true peak (4x) held at or
// under -1.6 dBTP, QUALITY-SPEC O3, so the lanes compare by timbre and not by volume. Where the ceiling binds,
// the loudness falls short and buf.loudness says so. (Until 2026-10-23 this was RMS at -20 dBFS.)
export async function renderScore(Engine, sc, { sampleRate = 48000, tail = 1.5, targetLufs = -14, ceilingDbtp = -1.6 } = {}) {
  const e = await Engine.offline(sc.seconds + tail, { sampleRate, channels: 2 });
  schedule(e, sc, 0.02);
  const buf = await e.ctx.startRendering();
  const ch = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  buf.loudness = levelLufs(ch, buf.sampleRate, { target: targetLufs, ceilingDbtp });
  buf.gain = buf.loudness.gain;
  return buf;
}
export function level(buf, targetDb = -20, ceilingDb = -1.6) {
  let peak = 0, sum = 0, n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; n++; } }
  const rms = Math.sqrt(sum / Math.max(1, n)); if (!(rms > 1e-7)) return 1;
  const g = Math.min(10 ** (targetDb / 20) / rms, 10 ** (ceilingDb / 20) / Math.max(peak, 1e-7));
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= g; }
  return g;
}

// Live play on its own bus, so stop() fades this score out without touching anything else on the engine.
export function playScore(engine, sc, { gain = 1 } = {}) {
  const bus = engine.ctx.createGain(); bus.gain.value = gain; bus.connect(engine.master);
  const t0 = engine.now + 0.06, end = schedule(engine, sc, t0, bus);
  let stopped = false;
  const stop = () => {
    if (stopped) return; stopped = true;
    const now = engine.now; bus.gain.setTargetAtTime(0, now, 0.03);
    engine.hits.length = 0;
    setTimeout(() => bus.disconnect(), 400);
  };
  return { t0, end, stop };
}
