// MasterPlayer: plays a finished master (Opus) through the live engine and feeds the engine's hit queue from an events
// file, so the visuals react to the 808, the hats and the sections exactly as they do with the live sequencer, at a
// fraction of the CPU. Same surface the theme uses from Sequencer: start(), stop(fade), running, bar, onbar.
// The events file is written by tools/export_hits.py from the song's own score: [{ t, name, vel, bar }] in seconds.
export class MasterPlayer {
  constructor(engine, { audioUrl, hitsUrl, bars = null, bpm = null, sections = null }) { Object.assign(this, { e: engine, audioUrl, hitsUrl, bars, bpm, sections }); this.running = false; this.bar = 0; this.onbar = null; }
  sectionOf(bar) { const s = (this.sections || []).find(([, a, b]) => bar >= a && bar < b); return s ? s[0] : ''; }
  async load() {
    if (this.buf) return;
    const [a, h] = await Promise.all([fetch(this.audioUrl), fetch(this.hitsUrl)]);
    if (!a.ok || !h.ok) throw new Error('master or hits missing: ' + a.status + ' ' + h.status);
    this.buf = await this.e.ctx.decodeAudioData(await a.arrayBuffer()); const H = await h.json(); this.hits = H.hits; this.bars = this.bars || H.bars; this.bpm = this.bpm || H.bpm; this.sections = this.sections || H.sections;
  }
  async start() {
    if (this.running) return; await this.load(); const c = this.e.ctx, t0 = c.currentTime + 0.08;
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = this.buf; s.loop = true; g.gain.value = 0; g.gain.setTargetAtTime(1, t0, 0.02);
    s.connect(g); g.connect(this.e.out); s.start(t0); Object.assign(this, { src: s, gain: g, t0, running: true, cycle: 0, idx: 0 });
    const tick = () => {  // queue hits 0.35 s ahead of the clock, wrapping with the loop
      if (!this.running) return; const now = c.currentTime, L = this.buf.duration;
      while (true) {
        if (this.idx >= this.hits.length) { this.idx = 0; this.cycle++; }
        const h = this.hits[this.idx], at = this.t0 + this.cycle * L + h.t; if (at > now + 0.35) break;
        if (at >= now - 0.05) { this.e.hit(at, h.name, h.vel, { bar: h.bar }); if (h.name === 'bar') { this.bar = h.bar + 1; this.onbar && this.onbar(h.bar, at); } }
        this.idx++;
      }
    };
    tick(); this.timer = setInterval(tick, 40);
  }
  stop(fade = 0.15) {
    this.running = false; clearInterval(this.timer); if (!this.src) return; const c = this.e.ctx, t = c.currentTime, s = this.src, g = this.gain;
    g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, fade / 3); setTimeout(() => { try { s.stop(); } catch (err) { console.warn('player stop', err); } g.disconnect(); }, fade * 1000 + 400);
    this.src = null; this.e.hits.length = 0;
  }
}
