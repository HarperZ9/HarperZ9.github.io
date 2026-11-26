// studio-daw.mjs: Clean-room WebAudio 4-lane step sequencer + modal chord/bass/breakbeat synth.
// Zero external deps; starts stopped/muted until explicit Play press. Emits live audio_features
// (rms, onset, bass, centroid, bands8, beatPhase, bpm, lufs) directly for patchbay-core.mjs.
import { makeAudioFeatures } from './patchbay-engines.mjs';

export const DAW_SCALES = Object.freeze({
  phrygian: [0, 1, 3, 5, 7, 8, 10, 12],
  dorian: [0, 2, 3, 5, 7, 9, 10, 12],
  lydian: [0, 2, 4, 6, 7, 9, 11, 12],
});

export const DEFAULT_PATTERNS = Object.freeze({
  kick:  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
  hat:   [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1],
  chord: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0],
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function createStudioDaw(onStep) {
  let ctx = null;
  let master = null;
  let analyser = null;
  let delayL = null;
  let delayWet = null;
  let shaper = null;
  let timer = 0;
  let step = 0;
  let running = false;
  let nextTime = 0;
  let freqBuf = null;
  let noiseBuf = null;
  let lastOnset = false;

  const state = {
    bpm: 132,
    scale: 'phrygian',
    detune: 0.18,
    retune: 0.0,
    space: 0.34,
    pocket: 0.22,
    grit: 0.20,
    chaos: 0.14,
    patterns: {
      kick: DEFAULT_PATTERNS.kick.slice(),
      snare: DEFAULT_PATTERNS.snare.slice(),
      hat: DEFAULT_PATTERNS.hat.slice(),
      chord: DEFAULT_PATTERNS.chord.slice(),
    },
  };

  function makeCurve(amount) {
    const k = clamp(amount, 0, 1) * 48 + 0.01;
    const n = 256, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  function ensureAudio() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.58;
    shaper = ctx.createWaveShaper();
    shaper.curve = makeCurve(state.grit);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    freqBuf = new Uint8Array(analyser.frequencyBinCount);

    delayL = ctx.createDelay(1.0);
    delayL.delayTime.value = 0.28;
    const fb = ctx.createGain();
    fb.gain.value = 0.34;
    delayWet = ctx.createGain();
    delayWet.gain.value = state.space * 0.48;

    shaper.connect(master);
    shaper.connect(delayL);
    delayL.connect(fb);
    fb.connect(delayL);
    delayL.connect(delayWet);
    delayWet.connect(master);
    master.connect(analyser);
    analyser.connect(ctx.destination);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    let seed = 0x51a7c3d1;
    for (let i = 0; i < ch.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      ch[i] = (seed / 0xffffffff) * 2 - 1;
    }
    return ctx;
  }

  function trigKick(t) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(142, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.85, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(g); g.connect(shaper);
    osc.start(t); osc.stop(t + 0.25);
  }

  function trigSnare(t) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1850; bp.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(bp); bp.connect(g); g.connect(shaper);
    src.start(t); src.stop(t + 0.16);
  }

  function trigHat(t, accent) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 6400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(accent ? 0.22 : 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    src.connect(hp); hp.connect(g); g.connect(shaper);
    src.start(t); src.stop(t + 0.06);
  }

  function trigChord(t, stepIdx) {
    const scale = DAW_SCALES[state.scale] || DAW_SCALES.phrygian;
    const rootMidi = 48 + Math.round((state.retune - 0.5) * 12);
    const deg = (Math.floor(stepIdx / 3) + (state.chaos > 0.45 ? (stepIdx % 5) : 0)) % scale.length;
    const notes = [0, 2, 4].map((o) => rootMidi + scale[(deg + o) % scale.length] + (o === 4 ? 12 : 0));
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(920 + state.space * 1400, t);
    filt.frequency.exponentialRampToValueAtTime(340, t + 0.36);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, t);
    env.gain.linearRampToValueAtTime(0.22, t + 0.018);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    filt.connect(env); env.connect(shaper);
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(midiHz(notes[i]), t);
      osc.detune.setValueAtTime((i - 1) * state.detune * 38, t);
      osc.connect(filt);
      osc.start(t); osc.stop(t + 0.44);
    }
  }

  function stepDuration(idx) {
    const base = 60 / clamp(state.bpm, 84, 172) / 4;
    const swing = (idx % 2 === 1 ? 1 : -1) * state.pocket * 0.24 * base;
    const drift = Math.sin(idx * 1.618) * state.chaos * 0.08 * base;
    return Math.max(0.04, base + swing + drift);
  }

  function schedule() {
    if (!running || !ctx) return;
    while (nextTime < ctx.currentTime + 0.12) {
      const idx = step % 16;
      const chaosHit = state.chaos > 0.35 && ((idx * 7 + step) % 11 === 0);
      const kickOn = Boolean(state.patterns.kick[idx]);
      const snareOn = Boolean(state.patterns.snare[idx]);
      const hatOn = Boolean(state.patterns.hat[idx]) || chaosHit;
      const chordOn = Boolean(state.patterns.chord[idx]);
      if (kickOn) trigKick(nextTime);
      if (snareOn) trigSnare(nextTime);
      if (hatOn) trigHat(nextTime, idx % 4 === 0);
      if (chordOn) trigChord(nextTime, idx);
      lastOnset = kickOn || snareOn || chordOn;
      onStep?.(idx, readFeatures(idx, lastOnset));
      nextTime += stepDuration(idx);
      step = (step + 1) % 16;
    }
  }

  function readFeatures(stepIdx = step, onset = lastOnset) {
    const bands8 = [0, 0, 0, 0, 0, 0, 0, 0];
    let rms = 0.08, centroid = 1120;
    if (running && analyser && freqBuf) {
      analyser.getByteFrequencyData(freqBuf);
      const binPerBand = Math.max(1, Math.floor(freqBuf.length / 8));
      let sumSq = 0, wSum = 0, vSum = 0;
      for (let b = 0; b < 8; b++) {
        let acc = 0;
        for (let k = 0; k < binPerBand; k++) {
          const idx = b * binPerBand + k;
          const v = (freqBuf[idx] || 0) / 255;
          acc += v; sumSq += v * v; wSum += v * (idx + 1); vSum += v;
        }
        bands8[b] = Number(clamp(acc / binPerBand, 0, 1).toFixed(3));
      }
      rms = clamp(Math.sqrt(sumSq / freqBuf.length) * 1.45, 0.05, 0.98);
      if (vSum > 0.001) centroid = Math.round((wSum / vSum) * ((ctx.sampleRate / 2) / freqBuf.length));
    } else if (running) {
      for (let b = 0; b < 8; b++) {
        bands8[b] = Number(clamp(0.2 + 0.55 * Math.abs(Math.sin((stepIdx + 1) * 0.7 + b)), 0, 1).toFixed(3));
      }
      rms = onset ? 0.74 : 0.36;
      centroid = 1480 + (stepIdx % 4) * 260;
    }
    return makeAudioFeatures({
      rms,
      spectralCentroidHz: centroid,
      bands8,
      beatPhase: (stepIdx % 16) / 16,
      onset,
      bpm: state.bpm,
      lufs: Number((-22 + rms * 10).toFixed(1)),
    });
  }

  function start() {
    const a = ensureAudio();
    if (!a) return false;
    if (a.state === 'suspended') a.resume().catch(() => {});
    if (running) return true;
    running = true;
    nextTime = a.currentTime + 0.03;
    schedule();
    timer = setInterval(schedule, 30);
    return true;
  }

  function stop() {
    running = false;
    if (timer) { clearInterval(timer); timer = 0; }
    lastOnset = false;
  }

  function setParam(key, val) {
    if (key === 'scale' && DAW_SCALES[val]) state.scale = val;
    else if (key === 'bpm') state.bpm = clamp(val, 84, 172);
    else if (key in state && typeof state[key] === 'number') state[key] = clamp(val, 0, 1);
    if (shaper && key === 'grit') shaper.curve = makeCurve(state.grit);
    if (delayWet && key === 'space') delayWet.gain.value = state.space * 0.48;
  }

  function toggleStep(lane, idx) {
    if (!state.patterns[lane] || idx < 0 || idx >= 16) return 0;
    state.patterns[lane][idx] = state.patterns[lane][idx] ? 0 : 1;
    return state.patterns[lane][idx];
  }

  return {
    start, stop, setParam, toggleStep, readFeatures,
    isRunning: () => running,
    getState: () => ({ ...state, step, running }),
  };
}
