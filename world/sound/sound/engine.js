// Engine: one master bus with a limiter, a mute that ramps, a volume, an analyser, and a queue of hit events
// that visuals read. Sound stays off until start() is called from a user gesture.
import { clamp } from './util.js';
import { installWorklets, hasLimiter } from './fx.js';

export class Engine {
  constructor(ctx, { offline = false, makeupDb = 0, ceilingDb = -1.6 } = {}) {
    this.ctx = ctx; this.offline = offline; this.hits = []; this.muted = false; this.volume = 0.8; this.makeupDb = makeupDb; this.ceilingDb = ceilingDb;
    this.master = ctx.createGain(); this.master.gain.value = this.volume;
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 1024; this.analyser.smoothingTimeConstant = 0.6;
    this.out = this.master;
  }
  // Master chain, built once the worklets are installed: master -> makeup -> DC blocker -> lookahead true-peak limiter -> analyser -> out.
  // The ceiling defaults to -1.6 dB on a 4x estimate, which leaves margin under the -1 dBTP target. Without worklets a compressor stands in.
  wire() {
    const c = this.ctx, mk = c.createGain(); mk.gain.value = Math.pow(10, this.makeupDb / 20); this.makeup = mk; this.master.connect(mk);
    if (hasLimiter(c)) {
      const dc = new AudioWorkletNode(c, 'anvil-dc-block'), lim = new AudioWorkletNode(c, 'anvil-tp-limiter', { parameterData: { ceiling: Math.pow(10, this.ceilingDb / 20) } });
      mk.connect(dc); dc.connect(lim); lim.connect(this.analyser); this.limiter = lim; this.limiterKind = 'tp-lookahead';
    } else {
      const k = c.createDynamicsCompressor(); k.threshold.value = -6; k.knee.value = 0; k.ratio.value = 20; k.attack.value = 0.002; k.release.value = 0.12;
      mk.connect(k); k.connect(this.analyser); this.limiter = k; this.limiterKind = 'compressor-fallback';
    }
    this.analyser.connect(c.destination);
  }
  // Live engine. Must be called from a click or key handler. Nothing is created before that.
  static async live() {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC({ latencyHint: 'interactive' });
    const e = new Engine(ctx);
    await ctx.resume();
    await installWorklets(ctx); e.wire();
    return e;
  }
  static async offline(seconds, { sampleRate = 48000, channels = 2, makeupDb = 0, ceilingDb = -1.6 } = {}) {
    const ctx = new OfflineAudioContext(channels, Math.ceil(seconds * sampleRate), sampleRate);
    const e = new Engine(ctx, { offline: true, makeupDb, ceilingDb });
    await installWorklets(ctx); e.wire();
    return e;
  }
  get now() { return this.ctx.currentTime; }
  setVolume(v) { this.volume = clamp(v, 0, 1); if (!this.muted) this.master.gain.setTargetAtTime(this.volume, this.now, 0.02); }
  mute(on = true) { this.muted = on; this.master.gain.setTargetAtTime(on ? 0 : this.volume, this.now, 0.03); }
  hit(time, name, vel = 1, extra = {}) { if (!this.offline) this.hits.push({ time, name, vel, ...extra }); }
  // Hits that have reached the speakers by now (output latency included). Visuals call this once per frame.
  due() {
    const now = this.now - (this.ctx.outputLatency || this.ctx.baseLatency || 0), out = [];
    while (this.hits.length && this.hits[0].time <= now) out.push(this.hits.shift());
    if (this.hits.length > 2000) this.hits.length = 0;
    return out;
  }
  levels() { const d = new Uint8Array(this.analyser.frequencyBinCount); this.analyser.getByteFrequencyData(d); return d; }
  async suspend() { if (!this.offline) await this.ctx.suspend(); }
  async resume() { if (!this.offline) await this.ctx.resume(); }
}
