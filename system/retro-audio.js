/* retro-audio.js — the Retro Engine's instrument. Sound comes from the work,
   not a soundtrack: every physical edit plays a note (ping), and the running
   shader sings its own math — a six-harmonic additive voice whose partials are
   driven by the brightness bands of a scanline of the live render (feed). Both
   are quantised to a seed-rooted scale so stacking stays musical. Off by
   default, user-initiated (Web Audio needs a gesture), zero deps. */

function hash(str) {
  let h = 2166136261; const s = String(str == null ? "seed" : str);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// minor pentatonic — consonant under stacking
const SCALE = [0, 3, 5, 7, 10, 12];
const semi = (n) => Math.pow(2, n / 12);
const HARMONICS = 6;

export function createRetroAudio() {
  let ctx = null, master = null, voiceFilter = null, on = false, seed = "seed";
  let rootHz = 65, pingRootHz = 220;
  const oscs = [], oscGains = [];
  // Analysis tap: everything audible (the instrument, a mic, your own file) is
  // summed here and read back as bass/mid/treble/level so the SOUND can drive
  // the VISUALS, closing the loop in both directions.
  let analyser = null, analyBus = null, freqData = null;
  let micStream = null, micNode = null, fileNode = null, fileGain = null;
  const band = { bass: 0, mid: 0, treble: 0, level: 0 };

  function setRoot(s) {
    const n = hash(s) % 12;
    rootHz = 55 * semi(n);        // ~55–104 Hz drone root
    pingRootHz = 220 * semi(n);   // A3-ish for interaction notes
  }

  // The analysis tap exists even when the instrument is silent, so a mic or a
  // dropped file still drives the visuals with the drone switched off.
  function ensureAnalyser() {
    if (analyser) return analyser;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.75;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    analyBus = ctx.createGain(); analyBus.gain.value = 1;
    analyBus.connect(analyser);   // a tap: never routed onward to the speakers
    return analyser;
  }

  function build() {
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ctx.destination);
    ensureAnalyser(); comp.connect(analyBus);

    // additive shader voice: 6 harmonic oscillators, gains driven by feed()
    voiceFilter = ctx.createBiquadFilter(); voiceFilter.type = "lowpass"; voiceFilter.frequency.value = 700; voiceFilter.Q.value = 3;
    const voiceGain = ctx.createGain(); voiceGain.gain.value = 0.9;
    voiceFilter.connect(voiceGain); voiceGain.connect(master);
    for (let i = 0; i < HARMONICS; i++) {
      const o = ctx.createOscillator(); o.type = i === 0 ? "sine" : "sine";
      o.frequency.value = rootHz * (i + 1); o.detune.value = (i - 2.5) * 2.5; // a little beating
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(g); g.connect(voiceFilter); o.start();
      oscs.push(o); oscGains.push(g);
    }
  }

  const now = () => ctx.currentTime;

  // one enveloped note through the master bus
  function blip(freq, type, dur, peak, whenOff) {
    const t0 = whenOff || now();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.03);
    o.onended = () => { try { o.disconnect(); g.disconnect(); } catch (_) {} };
  }

  function thump() {
    const t0 = now(), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(190, t0); o.frequency.exponentialRampToValueAtTime(60, t0 + 0.13);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.2);
    o.onended = () => { try { o.disconnect(); g.disconnect(); } catch (_) {} };
    blip(1750, "square", 0.03, 0.04);
  }

  const deg = (v) => SCALE[Math.max(0, Math.min(SCALE.length - 1, Math.floor((v || 0) * SCALE.length)))];

  function ping(kind, value) {
    if (!on || !ctx) return;
    try {
      if (kind === "chip") blip(pingRootHz * semi(deg(value)), "triangle", 0.16, 0.12);
      else if (kind === "slider") blip(pingRootHz * 2 * semi(deg(value)), "sine", 0.07, 0.06);
      else if (kind === "button") { for (let i = 0; i < 3; i++) blip(pingRootHz * semi(SCALE[i]), "triangle", 0.13, 0.10, now() + i * 0.055); }
      else if (kind === "bell") { blip(pingRootHz * 2, "sine", 0.5, 0.08); blip(pingRootHz * 2 * 1.004, "sine", 0.5, 0.05); }
      else if (kind === "click") thump();
      else blip(pingRootHz, "triangle", 0.14, 0.09);
    } catch (_) {}
  }

  // drive the six harmonics from per-band brightness energy of the render
  function feed(bands) {
    if (!on || !ctx || !oscGains.length || !bands) return;
    const t = now(); let sum = 0;
    for (let i = 0; i < HARMONICS; i++) {
      const b = Math.max(0, Math.min(1, bands[i] || 0)); sum += b;
      oscGains[i].gain.setTargetAtTime(b * (0.32 / (i + 1)), t, 0.09);
    }
    if (voiceFilter) voiceFilter.frequency.setTargetAtTime(260 + (sum / HARMONICS) * 3200, t, 0.12);
  }

  // Read the tap: average magnitude per band, 0..1. Returns the last values if
  // nothing is connected yet, so callers can poll unconditionally.
  function bands() {
    if (!analyser || !freqData) return band;
    analyser.getByteFrequencyData(freqData);
    const nyq = ctx.sampleRate / 2, n = freqData.length;
    const bin = (hz) => Math.max(0, Math.min(n - 1, Math.round((hz / nyq) * n)));
    const avg = (lo, hi) => { let s = 0, c = 0; for (let i = bin(lo); i <= bin(hi); i++) { s += freqData[i]; c++; } return c ? s / c / 255 : 0; };
    // gentle gain: quiet material should still move the visuals
    band.bass = Math.min(1, avg(20, 250) * 1.35);
    band.mid = Math.min(1, avg(250, 2000) * 1.5);
    band.treble = Math.min(1, avg(2000, 9000) * 1.9);
    band.level = Math.min(1, (band.bass * 0.5 + band.mid * 0.35 + band.treble * 0.15) * 1.25);
    return band;
  }

  async function ensureCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") await ctx.resume();
    ensureAnalyser();
  }

  // The ANS scan bank: one sine per image row, frequencies fixed, only the
  // gains automated as the playhead crosses columns (lookahead window, so the
  // AudioParam event lists stay short). Routed to the speakers and the
  // analysis tap directly: the picture sounds whether or not the drone runs,
  // and the scope can draw what the picture sings.
  let scanRun = null;
  async function playScan(scan, freqs, seconds) {
    await ensureCtx();
    if (scanRun) scanRun.stop();
    const { grid, rows, cols } = scan;
    const dur = Math.max(2, seconds || 8);
    const bus = ctx.createGain();
    bus.gain.value = 2.2 / rows;
    // A compressor between the bank and the speakers: bright material sums
    // hot (rows of near-unity gains on harmonically related sines), and the
    // ceiling should be musical, not a hard clip.
    const comp2 = ctx.createDynamicsCompressor();
    comp2.threshold.value = -12; comp2.ratio.value = 8;
    bus.connect(comp2); comp2.connect(ctx.destination);
    bus.connect(analyBus);
    const oscs2 = [], gains = [];
    for (let r = 0; r < rows; r++) {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freqs[r];
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(g); g.connect(bus); o.start();
      oscs2.push(o); gains.push(g);
    }
    const t0 = ctx.currentTime + 0.08, colDur = dur / cols;
    let nextCol = 0, timer = 0;
    // The lookahead must outlive background-tab timer throttling (1s floor),
    // or late-scheduled gains snap instead of enveloping.
    const schedule = () => {
      const horizon = ctx.currentTime + 1.2;
      while (nextCol < cols && t0 + nextCol * colDur < horizon) {
        const t = t0 + nextCol * colDur;
        for (let r = 0; r < rows; r++) {
          const v = grid[r * cols + nextCol];
          gains[r].gain.setTargetAtTime(Math.pow(v, 1.5), t, colDur * 0.45);
        }
        nextCol++;
      }
      if (nextCol >= cols) { clearInterval(timer); setTimeout(done, (t0 + dur + 0.5 - ctx.currentTime) * 1000); }
    };
    let stopped = false;
    const done = () => {
      if (stopped) return; stopped = true;
      for (const g of gains) { try { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); } catch (_) {} }
      setTimeout(() => { for (const o of oscs2) { try { o.stop(); } catch (_) {} } try { bus.disconnect(); comp2.disconnect(); } catch (_) {} }, 300);
      if (scanRun && scanRun._done === done) scanRun = null;
    };
    timer = setInterval(schedule, 200);
    schedule();
    scanRun = { stop: () => { clearInterval(timer); done(); }, _done: done };
    return scanRun;
  }

  // A drawn figure as a looping stereo buffer: left is X, right is Y, the
  // retrace rate is the pitch. Routed to the speakers and the analysis tap;
  // one figure at a time.
  let loopSrc = null, loopGain = null;
  async function playLoop(left, right) {
    await ensureCtx();
    stopLoop();
    const buf = ctx.createBuffer(2, left.length, ctx.sampleRate);
    buf.copyToChannel(left, 0); buf.copyToChannel(right, 1);
    loopSrc = ctx.createBufferSource(); loopSrc.buffer = buf; loopSrc.loop = true;
    loopGain = ctx.createGain(); loopGain.gain.value = 0.2;
    loopSrc.connect(loopGain); loopGain.connect(ctx.destination); loopGain.connect(analyBus);
    loopSrc.start();
    return { stop: stopLoop };
  }
  function stopLoop() {
    if (!loopSrc) return;
    try { loopSrc.stop(); } catch (_) {}
    try { loopSrc.disconnect(); loopGain.disconnect(); } catch (_) {}
    loopSrc = null; loopGain = null;
  }

  let waveBuf = null;
  return {
    isOn: () => on,
    ping,
    feed,
    bands,
    playScan,
    scanPlaying: () => !!scanRun,
    playLoop,
    stopLoop,
    loopPlaying: () => !!loopSrc,
    // The context's true rate, for callers building sample-exact buffers.
    async rate() { await ensureCtx(); return ctx.sampleRate; },
    // Raw time-domain samples from the analysis tap, for the XY scope. Null
    // until something is connected; the caller idles on its own figure then.
    waveform() {
      if (!analyser) return null;
      if (!waveBuf || waveBuf.length !== analyser.fftSize) waveBuf = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(waveBuf);
      return waveBuf;
    },
    hasInput: () => !!(micNode || fileNode),
    // Listen to your own room. The stream is analysed in this tab and never
    // recorded, uploaded, or routed to the speakers (which would howl).
    async startMic() {
      await ensureCtx();
      if (micNode) return true;
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
      micNode = ctx.createMediaStreamSource(micStream);
      micNode.connect(analyBus);
      return true;
    },
    stopMic() {
      if (micNode) { try { micNode.disconnect(); } catch (_) {} micNode = null; }
      if (micStream) { micStream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} }); micStream = null; }
    },
    // Play your own audio file and let it drive the visuals. Decoded locally.
    async playFile(file) {
      await ensureCtx();
      this.stopFile();
      const buf = await ctx.decodeAudioData(await file.arrayBuffer());
      fileNode = ctx.createBufferSource(); fileNode.buffer = buf; fileNode.loop = true;
      fileGain = ctx.createGain(); fileGain.gain.value = 0.85;
      fileNode.connect(fileGain);
      fileGain.connect(ctx.destination); fileGain.connect(analyBus);
      fileNode.start();
      return Math.round(buf.duration);
    },
    stopFile() {
      if (fileNode) { try { fileNode.stop(); } catch (_) {} try { fileNode.disconnect(); } catch (_) {} fileNode = null; }
      if (fileGain) { try { fileGain.disconnect(); } catch (_) {} fileGain = null; }
    },
    async start(s) {
      if (s) { seed = s; setRoot(seed); }
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") await ctx.resume();
      if (on) return;
      build(); on = true;
      master.gain.setValueAtTime(0.0001, now());
      master.gain.exponentialRampToValueAtTime(0.5, now() + 0.6);
    },
    stop() {
      if (!on || !ctx) return;
      on = false;
      // The stop button is the mute the user reaches for: everything the
      // engine is sounding dies with it, including the figure loop and a
      // running picture scan, which route around the master bus.
      stopLoop();
      if (scanRun) { try { scanRun.stop(); } catch (_) {} }
      const t = now();
      if (master) { master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0, t + 0.4); }
      const killO = oscs.splice(0), killG = oscGains.splice(0);
      setTimeout(() => { killO.forEach((o) => { try { o.stop(); o.disconnect(); } catch (_) {} }); killG.forEach((g) => { try { g.disconnect(); } catch (_) {} }); }, 500);
    },
    setSeed(s) {
      seed = s || "seed"; setRoot(seed);
      if (on && oscs.length) { const t = now(); oscs.forEach((o, i) => o.frequency.setTargetAtTime(rootHz * (i + 1), t, 0.1)); }
    },
  };
}
