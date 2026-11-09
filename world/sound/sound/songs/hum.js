// "Hum": an original beat written in our engine for the theme. 148 BPM, swing 0.58, C# minor, 36 bars (about 58 s).
// Written from the genre's published traits (fast skeletal drums, driven gliding 808, choppy snare, hat rolls and ratchets,
// eerie bells over a pad), not from any recording. Nothing here follows any specific track.
// Motifs inside it: the false scale (the pad hums flat in the intro), the vanishing record (tape dropouts in the break
// and a final one that stays gone), momentum (a snare roll that keeps accelerating through the break).
import { kick808, kick, snare, clap, hat, hatRoll, ratchet, bell, pad, pluck, voice } from '../voices.js';
import { tape, vinyl, reverb, sidechain, chain } from '../fx.js';

const ROOTS = [37, 37, 33, 35]; // C#, C#, A, B (i, i, VI, VII)
const CHORDS = [[49, 52, 56], [49, 52, 56], [45, 49, 52], [47, 51, 54]];
const SECTIONS = [['intro', 0, 4], ['A', 4, 12], ['B', 12, 20], ['break', 20, 24], ['A2', 24, 32], ['outro', 32, 36]];
export const sectionOf = (bar) => SECTIONS.find(([, a, b]) => bar >= a && bar < b)[0];

function setup(e, bus, t0) {
  bus.gain.value = 0.7;
  const ctx = e.ctx, drums = ctx.createGain(), bass = ctx.createGain(), music = ctx.createGain();
  drums.gain.value = 0.9; bass.gain.value = 0.95; music.gain.value = 0.8;
  drums.connect(bus); bass.connect(bus);
  const sc = sidechain(ctx, { depth: 0.55, release: 0.2 }), tp = tape(ctx, { wow: 0.5, flutter: 0.25, hiss: 0.006, cutoff: 10500 }), rv = reverb(ctx, { seconds: 1.6, mix: 0.3 });
  music.connect(sc.input); chain(sc, tp, rv).output.connect(bus);
  const v = vinyl(ctx, { dust: 0.3, rumble: 0.3, hiss: 0.008 }); v.output.gain.value = 0.9; v.output.connect(bus); v.start(t0);
  return { drums, bass, music, sc, tp, v, stop(t) { tp.stop(t); v.stop(t); } };
}

const ev = (step, name, vel, run) => ({ step, name, vel, run });

function drumEvents(bar, S, sec) {
  const e = [], d = S.drums, full = sec === 'B' || sec === 'A2';
  const kicks = sec === 'A' ? [0, 7, 10] : full ? (bar % 2 ? [0, 3, 7, 10, 14] : [0, 6, 10]) : [0];
  kicks.forEach((s) => e.push(ev(s, 'kick', 0.8, (t) => { S.sc.trigger(t, 0.5); kick(S.ctx, d, t, { vel: 0.55, pitch: 58 }); })));
  // choppy snare on the half-time backbeat, a clap layered in the full sections, a ghost before the next bar
  e.push(ev(8, 'snare', 1, (t) => snare(S.ctx, d, t, { vel: 0.95, decay: 0.085, tone: 190 })));
  if (full) e.push(ev(8, 'clap', 0.7, (t) => clap(S.ctx, d, t, { vel: 0.55 })));
  if (bar % 4 === 3) e.push(ev(14.5, 'snare', 0.4, (t) => snare(S.ctx, d, t, { vel: 0.35, decay: 0.05 })));
  for (let s = 0; s < 16; s++) {
    if (bar % 4 === 3 && s >= 12) continue; // the last beat of every fourth bar is a roll instead
    if (s === 6 && bar % 2) continue; // gap for the ratchet
    const acc = s % 4 === 0 ? 0.62 : s % 2 === 0 ? 0.46 : 0.34;
    e.push(ev(s, 'hat', acc, (t) => hat(S.ctx, d, t, { vel: acc, open: s === 14 && full && bar % 2 === 0 })));
  }
  if (bar % 2) e.push(ev(6, 'ratchet', 0.55, (t) => ratchet(S.ctx, d, t, { span: S.step * 2, pattern: [1, 1, 0, 1, 2, 1] })));
  if (bar % 4 === 3) e.push(ev(12, 'roll', 0.8, (t) => hatRoll(S.ctx, d, t, { n: bar % 8 === 7 ? 14 : 9, span: S.step * 4, from: 0.3, to: 0.85, curve: 1.6 })));
  return e;
}

function bassEvents(bar, S, sec) {
  if (sec === 'intro' || sec === 'break' || sec === 'outro') return [];
  const root = ROOTS[bar % 4], drive = sec === 'A2' ? 9 : sec === 'B' ? 6 : 3.5, e = [];
  const lead = sec === 'A' ? [0, 10] : [0, 6, 10];
  lead.forEach((s, i) => {
    const slide = s === 10 || (s === 6 && bar % 2);
    e.push(ev(s, 'kick808', 1, (t) => { S.sc.trigger(t, 0.2); kick808(S.ctx, S.bass, t, { note: root, dur: (i === lead.length - 1 ? 0.75 : 0.45), glideTo: slide ? root + (bar % 2 ? 5 : -2) : null, glide: 0.1, drive, vel: 0.95 }); }));
  });
  return e;
}

function musicEvents(bar, S, sec) {
  const e = [], ch = CHORDS[bar % 4], flat = sec === 'intro' ? -22 : 0; // the false scale: the intro hums flat of the bells
  if (sec !== 'break' || bar === 20) e.push(ev(0, 'pad', 0.5, (t) => pad(S.ctx, S.music, t, { notes: ch, dur: S.barDur * 1.02, vel: sec === 'B' || sec === 'A2' ? 0.15 : 0.2, attack: 0.5, release: 0.6, cutoff: sec === 'break' ? 500 : 1300, cents: flat })));
  const mel = bar % 2 ? [[0, 78], [4, 76], [8, 73], [12, 71]] : [[0, 73], [3, 76], [6, 80], [10, 76]];
  if (sec !== 'break') mel.forEach(([s, m]) => e.push(ev(s, 'bell', 0.5, (t) => bell(S.ctx, S.music, t, { note: m, dur: 1.1, vel: sec === 'intro' ? 0.2 : 0.3 }))));
  if (sec === 'B' || sec === 'A2') { [0, 8].forEach((s) => e.push(ev(s, 'pluck', 0.4, (t) => pluck(S.ctx, S.music, t, { note: ch[0] + 12, dur: 0.3, vel: 0.16, bright: 2400 })))); }
  // the crowd of one, two bars in B: one voice layered and detuned until it reads as several
  if (sec === 'B' && bar % 4 < 2) for (let k = 0; k < 5; k++) e.push(ev(0, 'voice', 0.3, (t) => voice(S.ctx, S.music, t, { note: ch[2] + 12, dur: S.barDur * 0.98, vel: 0.035, vowel: 'o', cents: (k - 2) * 11, pan: (k - 2) * 0.35, attack: 0.3 })));
  return e;
}

function breakEvents(bar, S, sec) {
  if (sec !== 'break' && !(sec === 'outro' && bar >= 32)) return [];
  const e = [], b = bar - 20;
  if (sec === 'break') {
    // momentum: a snare figure that speeds up across the break and never resolves
    const n = [4, 6, 8, 12][b]; for (let k = 0; k < n; k++) { const st = (16 / n) * k; e.push(ev(st, 'snare', 0.3 + 0.12 * b, (t) => snare(S.ctx, S.drums, t, { vel: 0.22 + 0.1 * b, decay: 0.05 }))); }
    if (b === 3) e.push(ev(0, 'dropout', 0.5, (t) => S.tp.dropout(t, 0.5, { back: true })));
    if (b === 1) e.push(ev(8, 'dropout', 0.5, (t) => S.tp.dropout(t, 0.2, { back: true })));
  } else if (bar === 35) e.push(ev(4, 'dropout', 1, (t) => S.tp.dropout(t, 4, { back: false, sag: 0.03 })));
  return e;
}

function events(bar, S, barIdx) {
  const sec = sectionOf(bar), e = [];
  if (sec !== 'intro' && sec !== 'break' && !(sec === 'outro' && bar >= 34)) e.push(...drumEvents(bar, S, sec === 'outro' ? 'A' : sec));
  e.push(...bassEvents(bar, S, sec), ...musicEvents(bar, S, sec), ...breakEvents(bar, S, sec));
  return e;
}

export const song = {
  name: 'Hum', bpm: 148, swing: 0.58, bars: 36, sections: SECTIONS,
  setup(e, bus, t0) { const S = setup(e, bus, t0); S.ctx = e.ctx; S.step = 60 / 148 / 4; S.barDur = S.step * 16; return S; },
  events,
};
