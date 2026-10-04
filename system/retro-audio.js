/* retro-audio.js — the Retro Engine's instrument. Sound comes from the work,
   not a soundtrack: every physical edit plays a note (ping), and the running
   shader sings its own math — a six-harmonic additive voice whose partials are
   driven by the brightness bands of a scanline of the live render (feed). Both
   are quantised to a seed-rooted scale so stacking stays musical. Off by
   default, user-initiated (Web Audio needs a gesture).

   The drone and the pings react to the picture, so they are reactive sound: with
   reduced sound on (reduced motion asked for, or the site's sound preference off)
   start() refuses, and while the tab is hidden the drone fades out and comes back
   on return. Every sound here is a scene on the sound layer (media-engine/sound.mjs):
   a picture or cloth scan, a drawn figure, each ping, and the drone, which is
   rendered chunk by chunk as it plays (media-engine/sound-retro.mjs). The live
   context plays exactly the samples the offline renderer computed. */

import { fnv1a32 } from "./media-engine/seed.mjs";
import { scanScene, figureScene, renderReference, liveContext, playReference, reducedSound, reconcileLive } from "./media-engine/sound.mjs";
import { pingScene, createDroneStream, reconcileDroneLive } from "./media-engine/sound-retro.mjs";

function hash(str) { return fnv1a32(str == null ? "seed" : str); }

const semi = (n) => Math.pow(2, n / 12);

export function createRetroAudio() {
  let ctx = null, drone = null, on = false, seed = "seed";
  let rootHz = 65, pingRootHz = 220, lastPing = null, lastDrone = null;
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

  // The drone: six harmonics of the root, each band of the picture driving one,
  // through a lowpass that opens with the overall brightness (sound-retro.mjs).
  function startDrone() {
    drone = createDroneStream(ctx, { rootHz, connect: (src) => { src.connect(ctx.destination); src.connect(analyBus); } });
    lastDrone = drone;
  }

  // A ping: one of the instrument's interaction notes (minor pentatonic over the
  // seed's root), rendered offline as a scene and played from its reference samples.
  function ping(kind, value) {
    if (!on || !ctx) return;
    try {
      const ref = renderReference(pingScene(kind, value, pingRootHz));
      lastPing = ref;
      playReference(ctx, ref, { connectTo: analyBus });
    } catch (e) { console.error("[retro-audio] ping failed:", e); }
  }

  // drive the six harmonics from per-band brightness energy of the render
  function feed(bands) {
    if (!on || !drone || !bands) return;
    drone.setBands(bands);
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
    if (!ctx) ctx = liveContext();
    if (ctx.state === "suspended") await ctx.resume();
    ensureAnalyser();
  }

  // The ANS scan: one sine per image row, the gains following the picture column
  // by column. The sound layer renders it offline as a scene and the context
  // plays the reference samples, routed to the speakers and the analysis tap,
  // so the scope can draw what the picture sings. lastScan holds the scene and
  // its reference for receipts and checks.
  let scanRun = null, lastScan = null;
  async function playScan(scan, freqs, seconds, label = "scan") {
    await ensureCtx();
    if (scanRun) scanRun.stop();
    const ref = renderReference(scanScene(scan, freqs, seconds || 8, { label }));
    lastScan = ref;
    const run = playReference(ctx, ref, { connectTo: analyBus });
    let stopped = false;
    const done = () => { if (stopped) return; stopped = true; run.stop(); if (scanRun && scanRun._done === done) scanRun = null; };
    run.source.onended = done;
    scanRun = { stop: done, _done: done, reference: ref };
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
  // A drawn figure (interleaved x, y in -1..1) retraced hz times a second, as a
  // scene on the sound layer; the loop plays the reference samples.
  let lastFigure = null;
  async function playFigure(points, hz) {
    await ensureCtx();
    stopLoop();
    const ref = renderReference(figureScene(points, hz));
    lastFigure = ref;
    const run = playReference(ctx, ref, { loop: true, connectTo: analyBus });
    loopSrc = run.source; loopGain = null;
    return { stop: stopLoop, reference: ref };
  }
  function stopLoop() {
    if (!loopSrc) return;
    try { loopSrc.stop(); } catch (_) {}
    try { loopSrc.disconnect(); if (loopGain) loopGain.disconnect(); } catch (_) {}
    loopSrc = null; loopGain = null;
  }

  // The drone is ambient: it fades out while the tab is hidden and back in on
  // return. A scan or figure the reader started keeps playing.
  let watching = false;
  function watchVisibility() {
    if (watching || typeof document === "undefined") return;
    watching = true;
    document.addEventListener("visibilitychange", () => {
      if (!on || !drone) return;
      drone.setAudible(!document.hidden);
    });
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
    playFigure,
    stopLoop,
    lastScan: () => lastScan,
    lastFigure: () => lastFigure,
    lastPing: () => lastPing,
    // The drone session's scene (its first 30 s), the bytes the live path was given, and the
    // check: those bytes against the offline reference, and the scheduled chunks rendered in an
    // OfflineAudioContext against it.
    droneSession: () => (lastDrone ? { scene: lastDrone.scene(), pcm: lastDrone.pcm(), late: lastDrone.late } : null),
    async checkDrone() {
      if (!lastDrone) return null;
      const ref = renderReference(lastDrone.scene());
      return { reference: ref, late: lastDrone.late, ...(await reconcileDroneLive(ref, lastDrone.pcm())) };
    },
    async checkPing() { return lastPing ? reconcileLive(lastPing) : null; },
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
      // Reactive sound: refused in reduced-sound mode. Callers catch and say so.
      if (reducedSound()) throw new Error("reduced sound is on");
      if (!ctx) ctx = liveContext();
      if (ctx.state === "suspended") await ctx.resume();
      if (on) return;
      ensureAnalyser();
      startDrone(); on = true;
      watchVisibility();
    },
    stop() {
      if (!on || !ctx) return;
      on = false;
      // The stop button is the mute the user reaches for: everything the
      // engine is sounding dies with it, including the figure loop and a
      // running picture scan; the drone fades out over half a second.
      stopLoop();
      if (scanRun) { try { scanRun.stop(); } catch (_) {} }
      if (drone) { drone.stop(); drone = null; }
    },
    setSeed(s) {
      seed = s || "seed"; setRoot(seed);
      if (on && drone) drone.setRoot(rootHz);
    },
  };
}
