// voices.mjs: events to sound through the v3 instruments (sound/sound/v3/instruments), pure DSP, so the
// same samples come out in Node, the browser and the site. Each event's voice name (the engine and studio score names)
// routes to the nearest instrument: melodic voices to keys or reed, held voices to pads, low hits to the 808, drum
// names to the funk kit, and noises to metal. lib/synth.mjs stays only as the fallback for a voice nothing here plays.
import { INSTRUMENTS, preset, keys, pads, reed, low, funkkit } from '../../sound/sound/v3/instruments/index.js';
import { renderEvents as standIn } from './synth.mjs';

const RATE = 48000;
const P = id => preset(INSTRUMENTS[id].meta, Object.keys(INSTRUMENTS[id].meta.presets)[0]);
const ROUTE = {
  pluck: 'keys', bell: 'keys', datum: 'keys', pad: 'pads', voice: 'reed', kick808: 'b808', sub: 'b808', kick: 'funkkit:kick',
  snare: 'funkkit:snare', clap: 'funkkit:snare', hat: 'funkkit:hat', hatRoll: 'funkkit:hat', noise: 'metal', scrape: 'metal', rip: 'metal', bubble: 'metal', creak: 'metal',
};
export const VOICE_ROUTE = Object.freeze({ ...ROUTE });

function noteOf(e) { const n = e.args?.note; return typeof n === 'number' && Number.isFinite(n) ? Math.max(21, Math.min(108, n)) : 60; }

export function renderEvents(ev, { rng, tail = 2.5 } = {}) {
  const n = Math.ceil((ev.duration + tail) * RATE), L = new Float32Array(n), R = new Float32Array(n), presets = {}, rest = [];
  const pre = id => (presets[id] ??= P(id));
  for (const e of ev.events) {
    const route = ROUTE[e.voice] ?? ROUTE[e.role]; if (!route) { rest.push(e); continue; }
    const a = e.args ?? {}, vel = Math.max(0.05, Math.min(1, a.vel ?? 0.6)), dur = Math.max(0.05, Math.min(6, a.dur ?? 0.4)), at = Math.round(e.t * RATE);
    let x = null, st = null;
    const [inst, piece] = route.split(':');
    if (inst === 'keys') x = keys.note(noteOf(e), vel, dur, pre('keys'), RATE);
    else if (inst === 'reed') x = reed.note(noteOf(e), vel, dur, pre('reed'), RATE);
    else if (inst === 'b808') x = low.b808(noteOf(e), vel, dur, pre('b808'), { sr: RATE });
    else if (inst === 'metal') x = low.metal(vel, pre('metal'), RATE);
    else if (inst === 'funkkit') x = funkkit.hit(piece, vel, pre('funkkit'), RATE);
    else if (inst === 'pads') st = pads.chord(a.notes ?? [noteOf(e)], vel, dur, pre('pads'), RATE);
    if (st) { for (let i = 0; i < st.L.length && at + i < n; i++) { L[at + i] += st.L[i]; R[at + i] += st.R[i]; } continue; }
    const pan = Math.max(-1, Math.min(1, a.pan ?? 0)), gl = Math.SQRT1_2 * (1 - pan), gr = Math.SQRT1_2 * (1 + pan);
    for (let i = 0; i < x.length && at + i < n; i++) { L[at + i] += x[i] * gl; R[at + i] += x[i] * gr; }
  }
  if (rest.length) { const s = standIn({ duration: ev.duration, events: rest }, { rng, tail }); for (let i = 0; i < Math.min(n, s.channels[0].length); i++) { L[i] += s.channels[0][i]; R[i] += s.channels[1][i]; } }
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  if (peak > 0.89) { const g = 0.89 / peak; for (let i = 0; i < n; i++) { L[i] *= g; R[i] *= g; } }
  return { rate: RATE, channels: [L, R] };
}
