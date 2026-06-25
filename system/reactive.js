// reactive.js
// The music-reactive engine for Telos Studio. Zero external dependencies.
// Coordinates audio analysis, feature->param mapping, and visual rendering.
//
// ============================================================================
// API (window.MusicExperience):
// ============================================================================
//
//   start(sourceSpec)
//     Connect an audio source and begin the reactive loop.
//     sourceSpec shapes:
//       { kind: "element", el: HTMLMediaElement }  - loaded <audio>/<video> element
//       { kind: "mic" }                             - getUserMedia microphone
//       { kind: "synth" }                           - built-in WebAudio synth (offline-capable)
//
//   stop()
//     Stop the reactive loop, silence the reactive sound layer, disconnect audio.
//     The canvas retains its last frame; visuals do not restart on their own.
//
//   setMapping(map | presetName)
//     Override the feature->param mapping config. Pass a config object or a preset
//     name string from MusicExperience.PRESETS (e.g. "pulse", "ambient", "bass").
//
//   setMode(name)
//     Switch the active visual mode: "particles" | "attractor" | "harmonograph"
//     | "flowfield" | "spectrum".
//
//   setAttractorType(type)
//     When mode is "attractor": "clifford" | "dejong" | "lorenz2d".
//
//   setSoundEnabled(bool)
//     Toggle the reactive sound layer on/off.
//
//   setSoundLevel(0..1)
//     Adjust reactive sound layer volume.
//
//   getFeatures()
//     Returns the most recent computed feature frame (or null when stopped).
//
//   onBeat(callback)
//     Register a callback(features) fired on every detected onset/beat.
//     Returns an unregister function.
//
//   running              Boolean: true while the reactive loop is active.
//   soundEnabled         Boolean.
//   soundLevel           Number 0..1.
//   PRESETS              Named mapping preset configs (see reactive-mapping.js).
//   MODES                Array of available mode names.
//
// ============================================================================
// AUDIO ANALYSIS (per frame, 60fps-safe):
// ============================================================================
//   level     0..1  RMS loudness
//   flux      0..1  spectral flux (onset / beat energy)
//   bass      0..1  band power 20-250 Hz
//   mid       0..1  band power 250-2500 Hz
//   treble    0..1  band power 2500-16000 Hz
//   centroid  0..1  spectral centroid normalized to Nyquist
//   chroma    [12]  coarse pitch-class energy, peak-normalized
//   tempo     bpm   estimated from inter-onset intervals (0 when unknown)
//
// ============================================================================
// VISUAL MODES (reactive-visuals.js):
// ============================================================================
//   particles    Spring/flocking system; beat spawns bursts; bass drives force
//   attractor    Strange attractor tracer (Clifford/de Jong/Lorenz)
//   harmonograph Lissajous/harmonograph parametric curves; chroma sets freq ratio
//   flowfield    Curl-noise flow field; centroid steers noise phase
//   spectrum     Frequency spectrum bars with perceptual color gradients
//
// ============================================================================
// REACTIVE SOUND LAYER:
// ============================================================================
//   A soft WebAudio pad synth (detuned sine oscillators + delay-feedback reverb)
//   that tracks the detected chroma class and reacts to onsets. Tasteful and subtle
//   by default. Toggle with setSoundEnabled(true/false); adjust with setSoundLevel.
//
// ============================================================================
// PERFORMANCE:
// ============================================================================
//   All per-frame work: RMS, spectral flux, 3-band power, centroid, coarse chroma.
//   Off the per-frame loop: YIN pitch, MFCC, full ERB pass, tempo history.
//   Tempo is estimated from the onset accumulator (~4/s update rate).

import { applyMapping, MAPPING_PRESETS, dominantChromaClass, clamp } from "./reactive-mapping.js";
import ReactiveVisuals from "./reactive-visuals.js";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _running       = false;
let _raf           = null;
let _startTs       = null;   // timestamp of the start() call for elapsed-time tracking
let _audioCtx      = null;
let _analyser      = null;
let _inputNode     = null;
let _freqBuf       = null;   // Float32Array for getFloatFrequencyData
let _timeBuf       = null;   // Float32Array for getFloatTimeDomainData
let _currentMapping = {};
let _beatCallbacks = [];
let _lastFeatures  = null;

// Reactive sound layer
let _soundEnabled  = false;
let _soundLevel    = 0.07;
let _padNode       = null;
let _builtinSynth  = null;

// Tempo / onset accumulator
let _onsetTimes    = [];
let _lastOnsetTs   = 0;
let _estimatedBpm  = 0;

// Flux history (16-frame ring buffer for smoothing)
const FLUX_HIST_LEN = 16;
const _fluxHist    = new Float32Array(FLUX_HIST_LEN);
let   _fluxIdx     = 0;
let   _prevFreq    = null;

// ---------------------------------------------------------------------------
// Cheap per-frame analysis helpers
// ---------------------------------------------------------------------------

function rmsFloat(buf) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

function spectralFlux(cur, prev) {
  if (!prev) return 0;
  const n = Math.min(cur.length, prev.length);
  let f = 0;
  for (let i = 0; i < n; i++) { const d = cur[i] - prev[i]; if (d > 0) f += d; }
  return f / (n || 1);
}

function bandPower(freqBuf, sr, fftSize, loHz, hiHz, minDb, maxDb) {
  const binHz = sr / fftSize;
  const lo = Math.max(0, Math.floor(loHz / binHz));
  const hi = Math.min(freqBuf.length - 1, Math.ceil(hiHz / binHz));
  if (lo > hi) return 0;
  const range = maxDb - minDb;
  let s = 0;
  for (let k = lo; k <= hi; k++) { const n = (freqBuf[k] - minDb) / range; s += n > 0 ? n : 0; }
  return clamp(s / (hi - lo + 1), 0, 1);
}

function centroidNorm(freqBuf, sr, fftSize, minDb, maxDb) {
  const binHz = sr / fftSize;
  const ny = sr / 2;
  const range = maxDb - minDb;
  let num = 0, den = 0;
  for (let k = 1; k < freqBuf.length; k++) {
    const m = clamp((freqBuf[k] - minDb) / range, 0, 1);
    num += k * binHz * m; den += m;
  }
  return den > 1e-12 ? clamp(num / den / ny, 0, 1) : 0;
}

const C0_HZ = 16.351597831287414;
function coarseChroma(freqBuf, sr, fftSize, minDb, maxDb) {
  const binHz = sr / fftSize, range = maxDb - minDb;
  const chroma = new Array(12).fill(0);
  for (let k = 1; k < freqBuf.length; k++) {
    const f = k * binHz;
    if (f < 55 || f > 4200) continue;
    const midi = 12 * Math.log2(f / C0_HZ);
    if (!Number.isFinite(midi)) continue;
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    const m = clamp((freqBuf[k] - minDb) / range, 0, 1);
    chroma[pc] += m;
  }
  let peak = 0;
  for (let i = 0; i < 12; i++) if (chroma[i] > peak) peak = chroma[i];
  if (peak > 1e-12) for (let i = 0; i < 12; i++) chroma[i] /= peak;
  return chroma;
}

function dbBufToMag(freqBuf, minDb, maxDb) {
  const range = maxDb - minDb;
  const mag = new Float32Array(freqBuf.length);
  for (let i = 0; i < freqBuf.length; i++) mag[i] = clamp((freqBuf[i] - minDb) / range, 0, 1);
  return mag;
}

function smoothedFlux(flux) {
  _fluxHist[_fluxIdx % FLUX_HIST_LEN] = flux;
  _fluxIdx++;
  let s = 0;
  for (let i = 0; i < FLUX_HIST_LEN; i++) s += _fluxHist[i];
  return s / FLUX_HIST_LEN;
}

function updateTempo(nowMs) {
  const WIN_MS = 8000, GAP_MS = 200;
  if (nowMs - _lastOnsetTs < GAP_MS) return;
  _lastOnsetTs = nowMs;
  _onsetTimes.push(nowMs);
  const cut = nowMs - WIN_MS;
  while (_onsetTimes.length > 1 && _onsetTimes[0] < cut) _onsetTimes.shift();
  if (_onsetTimes.length < 3) return;
  let ioi = 0;
  for (let i = 1; i < _onsetTimes.length; i++) ioi += _onsetTimes[i] - _onsetTimes[i - 1];
  const mean = ioi / (_onsetTimes.length - 1);
  if (mean > 0) _estimatedBpm = 60000 / mean;
}

// ---------------------------------------------------------------------------
// Reactive sound pad synth
// ---------------------------------------------------------------------------

const CHROMA_MIDI = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71];
function midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

function ensurePad(ctx, chroma, onsetStrength) {
  if (!_soundEnabled || !ctx) return;
  const pc = dominantChromaClass(chroma);
  const baseHz = pc >= 0 ? midiToHz(CHROMA_MIDI[pc]) : 220;
  const gain = _soundLevel * (0.5 + onsetStrength * 0.5);

  if (_padNode) {
    try {
      _padNode.osc1.frequency.setTargetAtTime(baseHz, ctx.currentTime, 0.06);
      _padNode.osc2.frequency.setTargetAtTime(baseHz * 1.007, ctx.currentTime, 0.06);
      _padNode.gainNode.gain.setTargetAtTime(gain, ctx.currentTime, 0.04);
    } catch (_) {}
    return;
  }
  try {
    const osc1 = ctx.createOscillator(), osc2 = ctx.createOscillator();
    osc1.type = "sine"; osc2.type = "sine";
    osc1.frequency.value = baseHz; osc2.frequency.value = baseHz * 1.007;
    const gainNode = ctx.createGain(); gainNode.gain.value = 0;
    const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.22;
    const feedback = ctx.createGain(); feedback.gain.value = 0.28;
    delay.connect(feedback); feedback.connect(delay);
    osc1.connect(gainNode); osc2.connect(gainNode);
    gainNode.connect(delay); gainNode.connect(ctx.destination); delay.connect(ctx.destination);
    osc1.start(); osc2.start();
    gainNode.gain.setTargetAtTime(gain, ctx.currentTime, 0.06);
    _padNode = { osc1, osc2, gainNode, delay, feedback };
  } catch (_) {}
}

function releasePad() {
  if (!_padNode) return;
  try {
    _padNode.gainNode.gain.setTargetAtTime(0, _audioCtx ? _audioCtx.currentTime : 0, 0.08);
    const p = _padNode; _padNode = null;
    setTimeout(() => {
      try { p.osc1.stop(); p.osc2.stop(); } catch (_) {}
      try { p.gainNode.disconnect(); p.delay.disconnect(); p.feedback.disconnect(); } catch (_) {}
    }, 500);
  } catch (_) { _padNode = null; }
}

// ---------------------------------------------------------------------------
// Built-in synth (offline-capable oscillator chord)
// ---------------------------------------------------------------------------

function buildBuiltinSynth(ctx) {
  const osc = ctx.createOscillator(), osc5 = ctx.createOscillator(), osc8 = ctx.createOscillator();
  osc.type = "sawtooth"; osc5.type = "sine"; osc8.type = "triangle";
  osc.frequency.value = 110; osc5.frequency.value = 165; osc8.frequency.value = 220;
  const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
  lfo.frequency.value = 0.17; lfoGain.gain.value = 6;
  lfo.connect(lfoGain); lfoGain.connect(osc.frequency); lfo.start();
  const mix = ctx.createGain(); mix.gain.value = 0.22;
  osc.connect(mix); osc5.connect(mix); osc8.connect(mix);
  osc.start(); osc5.start(); osc8.start();
  return {
    node: mix,
    stop() { try { osc.stop(); osc5.stop(); osc8.stop(); lfo.stop(); } catch (_) {} },
  };
}

// ---------------------------------------------------------------------------
// Audio context setup
// ---------------------------------------------------------------------------

function ensureAudioCtx() {
  if (_audioCtx) return _audioCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error("WebAudio not available in this browser.");
  _audioCtx = new AC();
  return _audioCtx;
}

function setupAnalyser(ctx) {
  _analyser = ctx.createAnalyser();
  _analyser.fftSize = 2048;
  _analyser.smoothingTimeConstant = 0.72;
  _freqBuf = new Float32Array(_analyser.frequencyBinCount);
  _timeBuf = new Float32Array(_analyser.fftSize);
}

// ---------------------------------------------------------------------------
// Per-frame reactive loop
// ---------------------------------------------------------------------------

function reactiveFrame(ts) {
  if (!_running) return;
  _raf = requestAnimationFrame(reactiveFrame);

  if (!_analyser || !_freqBuf || !_timeBuf) return;
  if (_audioCtx && _audioCtx.state === "suspended") { _audioCtx.resume(); return; }

  _analyser.getFloatFrequencyData(_freqBuf);
  _analyser.getFloatTimeDomainData(_timeBuf);

  const sr = _audioCtx.sampleRate, fft = _analyser.fftSize;
  const minDb = _analyser.minDecibels, maxDb = _analyser.maxDecibels;

  const level    = clamp(rmsFloat(_timeBuf) * 4, 0, 1);
  const mag      = dbBufToMag(_freqBuf, minDb, maxDb);
  const rawFlux  = spectralFlux(mag, _prevFreq);
  const flux     = smoothedFlux(rawFlux);
  const bass     = bandPower(_freqBuf, sr, fft, 20,   250,  minDb, maxDb);
  const mid      = bandPower(_freqBuf, sr, fft, 250,  2500, minDb, maxDb);
  const treble   = bandPower(_freqBuf, sr, fft, 2500, 16000, minDb, maxDb);
  const centroid = centroidNorm(_freqBuf, sr, fft, minDb, maxDb);
  const chroma   = coarseChroma(_freqBuf, sr, fft, minDb, maxDb);

  if (!_prevFreq || _prevFreq.length !== mag.length) _prevFreq = new Float32Array(mag.length);
  _prevFreq.set(mag);

  const features = { level, flux, bass, mid, treble, centroid, chroma, tempo: _estimatedBpm };
  _lastFeatures = features;

  const ONSET_THRESH = 0.3;
  if (rawFlux > ONSET_THRESH) {
    updateTempo(ts);
    for (let i = 0; i < _beatCallbacks.length; i++) {
      try { _beatCallbacks[i](features); } catch (_) {}
    }
  }

  const params = applyMapping(features, _currentMapping);

  // Drive visuals
  const canvas = document.getElementById("studio-canvas");
  if (canvas) {
    const elapsed = _startTs !== null ? (ts - _startTs) / 1000 : 0;
    ReactiveVisuals.draw(canvas, features, params, elapsed);
  }

  // Reactive sound pad
  if (_soundEnabled && rawFlux > ONSET_THRESH) ensurePad(_audioCtx, chroma, params.pulse);
  else if (_soundEnabled && _padNode) ensurePad(_audioCtx, chroma, 0);

  // Expose live features for the measurimeter bridge
  window.__reactiveCurrentFeatures = features;

  // Feed into the Studio's audio channel if the meter loop is looking for it
  if (typeof window.__studioReactiveAudioBridge === "function") {
    try { window.__studioReactiveAudioBridge(features); } catch (_) {}
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const MusicExperience = {
  get running() { return _running; },
  get soundEnabled() { return _soundEnabled; },
  get soundLevel() { return _soundLevel; },
  PRESETS: MAPPING_PRESETS,
  MODES: ReactiveVisuals.MODES,

  start(sourceSpec) {
    if (_running) this.stop();
    const spec = sourceSpec || { kind: "synth" };
    let ctx;
    try { ctx = ensureAudioCtx(); } catch (e) {
      console.warn("reactive.js: WebAudio unavailable:", e.message);
      return;
    }
    if (ctx.state === "suspended") ctx.resume();
    setupAnalyser(ctx);

    // Reset analysis state
    for (let i = 0; i < FLUX_HIST_LEN; i++) _fluxHist[i] = 0;
    _fluxIdx = 0; _prevFreq = null;
    _onsetTimes = []; _estimatedBpm = 0; _lastOnsetTs = 0;

    if (spec.kind === "element" && spec.el) {
      try {
        _inputNode = ctx.createMediaElementSource(spec.el);
        _inputNode.connect(_analyser);
        _analyser.connect(ctx.destination);
      } catch (e) { console.warn("reactive.js: element source:", e.message); return; }
    } else if (spec.kind === "mic") {
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
          if (!_running) return;
          _inputNode = ctx.createMediaStreamSource(stream);
          _inputNode.connect(_analyser);
          // Do NOT connect analyser to destination (mic feedback prevention)
        })
        .catch(err => { console.warn("reactive.js: mic:", err.message); this.stop(); });
    } else {
      _builtinSynth = buildBuiltinSynth(ctx);
      _inputNode = _builtinSynth.node;
      _inputNode.connect(_analyser);
      _analyser.connect(ctx.destination);
    }

    _running = true;
    _startTs = performance.now();
    _raf = requestAnimationFrame(reactiveFrame);
  },

  stop() {
    _running = false;
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
    releasePad();
    if (_builtinSynth) { try { _builtinSynth.stop(); } catch (_) {} _builtinSynth = null; }
    try { if (_inputNode) _inputNode.disconnect(); } catch (_) {}
    _inputNode = null;
    try { if (_analyser) _analyser.disconnect(); } catch (_) {}
    _analyser = null;
    _freqBuf = null; _timeBuf = null; _prevFreq = null;
    _lastFeatures = null;
    window.__reactiveCurrentFeatures = null;
    _startTs = null;
  },

  setMapping(mapOrPreset) {
    if (typeof mapOrPreset === "string") {
      _currentMapping = MAPPING_PRESETS[mapOrPreset] || {};
    } else {
      _currentMapping = mapOrPreset || {};
    }
  },

  setMode(name) { ReactiveVisuals.setMode(name); },
  setAttractorType(t) { ReactiveVisuals.setAttractorType(t); },

  setSoundEnabled(v) {
    _soundEnabled = !!v;
    if (!_soundEnabled) releasePad();
  },

  setSoundLevel(v) {
    _soundLevel = clamp(+v || 0, 0, 1);
    if (_padNode) {
      try {
        _padNode.gainNode.gain.setTargetAtTime(_soundLevel, _audioCtx ? _audioCtx.currentTime : 0, 0.04);
      } catch (_) {}
    }
  },

  getFeatures() { return _lastFeatures ? Object.assign({}, _lastFeatures) : null; },

  onBeat(cb) {
    if (typeof cb !== "function") throw new TypeError("onBeat: callback must be a function");
    _beatCallbacks.push(cb);
    return () => { const i = _beatCallbacks.indexOf(cb); if (i >= 0) _beatCallbacks.splice(i, 1); };
  },
};

window.MusicExperience = MusicExperience;
export default MusicExperience;
