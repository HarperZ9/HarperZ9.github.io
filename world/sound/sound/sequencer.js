// Sequencer with swing. A song is { bpm, swing, bars, setup(engine, bus) -> state, events(bar, state) -> [...] }.
// An event is { step, name, vel, run(t) }. step is in 16ths and may be fractional (rolls, ratchets).
// Swing delays the second 16th of every pair. swing 0.5 is straight, 0.667 is a triplet feel.
export function swingPos(pos, swing) {
  const pair = Math.floor(pos / 2), f = pos - pair * 2, s2 = 2 * swing;
  return pair * 2 + (f < 1 ? f * s2 : s2 + (f - 1) * (2 - s2));
}

export class Sequencer {
  constructor(engine, song, { loop = true } = {}) {
    this.e = engine; this.song = song; this.loop = loop; this.bpm = song.bpm; this.swing = song.swing ?? 0.56;
    this.timer = null; this.bar = 0; this.next = 0; this.running = false; this.onbar = null;
  }
  get stepDur() { return 60 / this.bpm / 4; }
  get barDur() { return this.stepDur * 16; }
  timeOf(t0, step) { return t0 + swingPos(step, this.swing) * this.stepDur; }
  scheduleBar(bar, t0, state) {
    const evs = this.song.events(bar % this.song.bars, state, bar);
    for (const ev of evs) {
      const t = this.timeOf(t0, ev.step);
      ev.run(t);
      this.e.hit(t, ev.name, ev.vel ?? 1, { bar, step: ev.step });
    }
  }
  // Offline: schedule everything, then the caller renders.
  renderAll(t0 = 0.05, bars = this.song.bars) {
    const bus = this.e.ctx.createGain(); bus.connect(this.e.out);
    const state = this.song.setup(this.e, bus, t0);
    for (let b = 0; b < bars; b++) this.scheduleBar(b, t0 + b * this.barDur, state);
    return { state, end: t0 + bars * this.barDur };
  }
  start(t0 = this.e.now + 0.08) {
    if (this.running) return;
    this.running = true; this.bus = this.e.ctx.createGain(); this.bus.connect(this.e.out);
    this.state = this.song.setup(this.e, this.bus, t0); this.bar = 0; this.next = t0;
    const tick = () => {
      while (this.running && this.next < this.e.now + 0.35) {
        this.scheduleBar(this.bar, this.next, this.state);
        if (this.onbar) this.onbar(this.bar % this.song.bars, this.next);
        this.next += this.barDur; this.bar++;
        if (!this.loop && this.bar >= this.song.bars) { this.running = false; break; }
      }
    };
    tick(); this.timer = setInterval(tick, 40);
  }
  stop(fade = 0.15) {
    this.running = false; clearInterval(this.timer); this.timer = null;
    if (this.bus) { const t = this.e.now; this.bus.gain.cancelScheduledValues(t); this.bus.gain.setTargetAtTime(0, t, fade / 3); const b = this.bus; setTimeout(() => b.disconnect(), fade * 1000 + 500); this.bus = null; }
    if (this.state && this.state.stop) this.state.stop(this.e.now + fade);
    this.e.hits.length = 0;
  }
}
