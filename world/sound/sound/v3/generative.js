// Generative site music: an arrangement that keeps changing instead of a fixed loop. One bar length for everything (86 BPM, so
// 172 for the drum and bass moods lands on the same bar), five moods that blend the author's references as techniques, and a
// Markov walk between them every 8 to 16 bars. Notes and phrases render in a worker (render-worker.js); this file schedules.
//   drift    pads and a reed line, no drums                     (spiritual-jazz reeds, Yamaoka's quiet)
//   pocket   jazz-funk kit with ghost notes, electric piano comping, a round 808   (jazz-funk groove)
//   atlantis a breakbeat roller at 172 under long pads and sparse keys          (atmospheric drum and bass)
//   grit     choppy breaks, the sliding 808, struck metal, a dark reed           (DMV frame, industrial)
//   temple   flute line, struck pipe, a low cathedral pad                        (Lateef's world instruments, by description)
// Quiet by design: the bus sits about 8 dB under the theme master and nothing starts until the visitor turns sound on.
import { rng } from './instruments/core.js';
import { preset, INSTRUMENTS, funkkit, keys, reed } from './instruments/index.js';

const BPM = 86, BAR = 240 / BPM, SLOT = 2; // slots of two bars
const PROGS = [['C#m9', 'Amaj9', 'F#m11', 'G#7alt'], ['Emaj9', 'C#m11', 'A6/9', 'Bsus13'], ['C#m9', 'D#m7b5', 'G#7alt', 'C#m11'], ['F#m11', 'Bsus13', 'Emaj9', 'C#m9']];
const MOODS = {
  drift: { next: { drift: 0.2, pocket: 0.35, temple: 0.3, atlantis: 0.15 } },
  pocket: { next: { pocket: 0.3, atlantis: 0.3, grit: 0.2, drift: 0.2 } },
  atlantis: { next: { atlantis: 0.35, drift: 0.25, grit: 0.2, temple: 0.2 } },
  grit: { next: { grit: 0.25, pocket: 0.25, temple: 0.25, drift: 0.25 } },
  temple: { next: { temple: 0.2, drift: 0.4, atlantis: 0.2, pocket: 0.2 } },
};
const P = (id, name) => preset(INSTRUMENTS[id].meta, name);

export class Generative {
  constructor(engine, { seed = Date.now() % 100000, level = 0.42, onmood = null } = {}) {
    Object.assign(this, newState(seed), { e: engine, ctx: engine.ctx, onmood, running: false, id: 0, waits: new Map() });
    this.bus = this.ctx.createGain(); this.bus.gain.value = 0; this.bus.connect(engine.out); this.level = level;
    this.worker = new Worker(new URL('./render-worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (ev) => { const w = this.waits.get(ev.data.id); if (!w) return; this.waits.delete(ev.data.id); ev.data.error ? w.reject(new Error(ev.data.error)) : w.resolve(ev.data); };
    this.worker.onerror = (err) => console.error('render worker failed', err.message);
  }
  ask(call, params, args) { const id = ++this.id; return new Promise((resolve, reject) => { this.waits.set(id, { resolve, reject }); this.worker.postMessage({ id, call, params, args: { sr: this.ctx.sampleRate, ...args } }); }); }
  place(r, t, { gain = 1, pan = 0 } = {}) {
    if (t < this.ctx.currentTime) return; const b = this.ctx.createBuffer(2, r.L.length, r.sr); b.getChannelData(0).set(r.L); b.getChannelData(1).set(r.R);
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(), p = this.ctx.createStereoPanner(); s.buffer = b; g.gain.value = gain; p.pan.value = pan; s.connect(g); g.connect(p); p.connect(this.bus); s.start(t);
  }
  hits(t0, list) { for (const [dt, name, vel] of list) this.e.hit(t0 + dt, name, vel, { bar: this.slot * SLOT }); }

  // one slot: two bars. The plan is pure (planSlot below); here each job goes to the worker and is placed when it returns.
  async schedule(t0) {
    const plan = planSlot(this); this.hits(t0, plan.hits);
    if (plan.mood !== this.shown && this.onmood) { this.shown = plan.mood; setTimeout(() => this.running && this.onmood(plan.mood), Math.max(0, (t0 - this.ctx.currentTime) * 1000)); }  // name the mood when it is heard
    const jobs = plan.jobs.map((j) => this.ask(j.call, j.params, j.args).then((r) => this.place(r, t0 + j.at, { gain: j.gain, pan: j.pan || 0 })));
    await Promise.allSettled(jobs).then((rs) => rs.filter((x) => x.status === 'rejected').forEach((x) => console.error('generative part failed', x.reason)));
  }
  start() {
    if (this.running) return; this.running = true; const t = this.ctx.currentTime; this.bus.gain.setTargetAtTime(this.level, t, 0.5);
    this.next = t + 0.4; this.shown = null;
    const tick = () => { if (!this.running) return; while (this.next < this.ctx.currentTime + SLOT * BAR * 2) { this.schedule(this.next); this.next += SLOT * BAR; } };
    tick(); this.timer = setInterval(tick, 500);
  }
  stop(fade = 0.6) { this.running = false; clearInterval(this.timer); const t = this.ctx.currentTime; this.bus.gain.cancelScheduledValues(t); this.bus.gain.setTargetAtTime(0, t, fade / 3); this.e.hits.length = 0; }
  dispose() { this.stop(0.1); setTimeout(() => { this.worker.terminate(); this.bus.disconnect(); }, 800); }
}
export const meta = { bpm: BPM, bar: BAR, slotBars: SLOT, moods: Object.keys(MOODS), progressions: PROGS };

export function newState(seed) { return { seed, r: rng(seed), slot: 0, mood: 'drift', moodLeft: 4, prog: PROGS[0] }; }

// The score for one slot, from a state { seed, r, slot, mood, moodLeft, prog } that it advances. Pure: no audio, no clock.
// Returns { mood, jobs: [{ call, params, args, at, gain, pan }], hits: [[dt, name, vel]] }.
export function planSlot(st) {
  if (--st.moodLeft <= 0) { const nx = MOODS[st.mood].next; let u = st.r(), m = st.mood; for (const [k, w] of Object.entries(nx)) { if ((u -= w) <= 0) { m = k; break; } }
    st.mood = m; st.moodLeft = 4 + Math.floor(st.r() * 5); if (st.r() < 0.5) st.prog = PROGS[Math.floor(st.r() * PROGS.length)]; }
  const m = st.mood, s = st.slot, seed = st.seed + s * 13, chords = [st.prog[(s * 2) % 4], st.prog[(s * 2 + 1) % 4]], jobs = [], hits = [], step86 = BAR / 16;
  const root = (sym) => keys.bassOf(sym, 1), job = (call, params, args, at, gain, pan = 0) => jobs.push({ call, params, args, at, gain, pan });
  const pad = (name, vel) => chords.forEach((c, i) => job('pad', P('pads', name), { notes: keys.voice(c).slice(0, 3), vel, dur: BAR * 1.05, seed: seed + i }, i * BAR, 0.8));
  const reedLine = (name, rootN, gain) => { for (const n of reed.line(SLOT, { root: rootN, seed, rest: 0.45 })) job('reed', P('reed', name), { note: n.m, vel: 0.6, dur: n.beats * BAR / 4 * 0.95, seed: n.beat }, n.beat * BAR / 4, gain, -0.15); };
  if (m === 'drift') { pad('night-glass', 0.55); reedLine('dark-reed', 61, 0.5); }
  if (m === 'temple') { pad('low-cathedral', 0.5); reedLine('temple-flute', 68, 0.45); job('metal', P('metal', 'pipe'), { vel: 0.5 }, BAR * 0.5, 0.35, 0.4); }
  if (m === 'pocket') {
    const kp = P('funkkit', 'deep-pocket'); job('groove', kp, { bars: SLOT, style: 'funk', seed, bpm: BPM }, 0, 0.7);
    for (const ev of funkkit.groove(SLOT, kp, { style: 'funk', seed })) hits.push([ev.step * step86, ev.piece === 'kick' ? 'kick808' : ev.piece === 'snare' ? 'snare' : 'hat', ev.vel]);
    job('comp', P('keys', 'warm-tine'), { prog: chords.map((sym) => ({ sym, beats: 4 })), bpm: BPM, seed, rhythm: [[0, 1.5], [1.5, 1], [3, 1]] }, 0, 0.55);
    chords.forEach((c, i) => job('b808', P('b808', 'deep-clean'), { note: root(c), vel: 0.7, dur: BAR * 0.9 }, i * BAR, 0.6));
    chords.forEach((c, i) => job('phantom', { harmonics: 6 }, { note: root(c), vel: 0.6, dur: BAR * 0.8 }, i * BAR, 0.18));  // the missing fundamental: the bass line reads on a laptop speaker
  }
  if (m === 'atlantis' || m === 'grit') {
    job('breaks', { ...P('breaks', m === 'grit' ? 'choppy-dmv' : 'atmos-roller'), bpm: BPM * 2 }, { bars: SLOT * 2, seed }, 0, m === 'grit' ? 0.55 : 0.45);
    for (let k = 0; k < SLOT * 8; k++) hits.push([k * BAR / 8, k % 4 === 0 ? 'kick808' : 'hat', 0.5]);
    if (m === 'atlantis') { pad('atlantic-drift', 0.5); chords.forEach((c, i) => job('b808', P('b808', 'deep-clean'), { note: root(c), vel: 0.6, dur: BAR }, i * BAR, 0.5)); }
    else { chords.forEach((c, i) => job('b808', P('b808', 'dmv-slide'), { note: root(c), vel: 0.8, dur: BAR * 0.95, path: [[BAR * 0.75, root(c) + 7], [BAR * 0.9, root(c)]] }, i * BAR, 0.55));
      job('metal', P('metal', 'anvil'), { vel: 0.6 }, BAR * 0.5, 0.3, 0.3); reedLine('dark-reed', 61, 0.35); }
  }
  st.slot++; return { mood: m, jobs, hits };
}
