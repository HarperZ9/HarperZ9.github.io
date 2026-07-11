// studio-sound.js: the seed-authored sound instrument, wired as a MEASURED studio
// source. It synthesizes the seed's short phrase (audio.js), plays it through its
// OWN AudioContext (resumed inside the play gesture, so playback is reliable),
// analyses that audio with its own AnalyserNode, and writes the live level,
// spectrum, and pitch straight into the perception panel's audio channels while
// drawing a piano-roll of the melody on the shared canvas.
//
// Self-contained on purpose: routing through the Studio's shared audio tap ties
// playback to a context that may be suspended, which silences it. Here the
// context is ours and resumed in-gesture, so what you hear is what the panel
// measures - and both are deterministic, the same seed is the same PCM.
//
// Playback is always user-initiated (a play button); nothing autoplays.

import { renderAudioBuffer, seedComposition, audioToWav } from "./audio.js";

const SR = 44100;
let raf = null, ctx = null, srcNode = null, analyser = null, freqBuf = null, timeBuf = null;
let running = false, playing = false, startedAt = 0;
let comp = null, pcm = null, dur = 0, canvasRef = null;

function rmsFromTime(buf) {
  let s = 0;
  for (let i = 0; i < buf.length; i += 1) { const v = (buf[i] - 128) / 128; s += v * v; }
  return Math.sqrt(s / buf.length);
}

function dominantHz(buf, sampleRate, fftSize) {
  let peak = 0, idx = -1;
  for (let i = 2; i < buf.length; i += 1) { if (buf[i] > peak) { peak = buf[i]; idx = i; } }
  if (peak < 24 || idx < 0) return 0;
  return Math.round((idx * sampleRate) / fftSize);
}

// Feed the perception panel's audio channels (the same meters the file/stream
// sources drive) from our own analyser reading.
function pushMeters(level, hz) {
  const lf = document.getElementById("mm-au-level"), lv = document.getElementById("mm-au-level-v");
  if (lf) lf.style.width = Math.min(1, level * 2.2) * 100 + "%";
  if (lv) lv.textContent = level < 0.005 ? "—" : level.toFixed(3);
  const sp = document.getElementById("mm-au-spectrum");
  if (sp && freqBuf) {
    const els = sp.querySelectorAll(".mm-bar");
    const bin = Math.max(1, Math.floor(freqBuf.length / (els.length || 1)));
    for (let i = 0; i < els.length; i += 1) {
      let acc = 0;
      for (let k = 0; k < bin; k += 1) acc += freqBuf[i * bin + k] || 0;
      els[i].style.height = Math.max(2, (acc / bin / 255) * 100) + "%";
    }
  }
  const pf = document.getElementById("mm-au-pitch"), pv = document.getElementById("mm-au-pitch-v");
  if (pf) pf.style.width = Math.min(1, hz / 4000) * 100 + "%";
  if (pv) pv.textContent = hz ? hz + " Hz" : "—";
}

function drawFrame(ctx2d, W, H, tNorm, level) {
  const tones = [[80, 196, 185], [167, 115, 255], [239, 171, 48]];
  ctx2d.save();
  ctx2d.globalCompositeOperation = "source-over";
  ctx2d.fillStyle = "rgba(6,7,14,1)";
  ctx2d.fillRect(0, 0, W, H);
  const pad = Math.min(W, H) * 0.08;
  const gw = W - 2 * pad, gh = H - 2 * pad;
  const notes = comp.seq.filter((n) => n != null);
  const lo = (notes.length ? Math.min.apply(null, notes) : comp.root) - 3;
  const hi = (notes.length ? Math.max.apply(null, notes) : comp.root + 12) + 3;
  const span = Math.max(1, hi - lo);
  ctx2d.strokeStyle = "rgba(255,255,255,0.05)";
  ctx2d.lineWidth = 1;
  for (let i = 0; i <= comp.steps; i += 1) {
    const x = pad + (i / comp.steps) * gw;
    ctx2d.beginPath(); ctx2d.moveTo(x, pad); ctx2d.lineTo(x, H - pad); ctx2d.stroke();
  }
  const activeStep = Math.floor(tNorm * comp.steps) % comp.steps;
  for (let i = 0; i < comp.steps; i += 1) {
    const m = comp.seq[i];
    if (m == null) continue;
    const x = pad + (i / comp.steps) * gw;
    const w = (1 / comp.steps) * gw * 0.82;
    const y = pad + (1 - (m - lo) / span) * gh;
    const t = tones[i % tones.length];
    const on = i === activeStep && playing;
    ctx2d.fillStyle = `rgba(${t[0]},${t[1]},${t[2]},${on ? 0.98 : 0.62})`;
    const h = 7 + (on ? level * 64 : 0);
    ctx2d.fillRect(x, y - h / 2, w, h);
  }
  if (playing) {
    const px = pad + tNorm * gw;
    ctx2d.strokeStyle = `rgba(245,238,252,${0.32 + level * 0.55})`;
    ctx2d.lineWidth = 2;
    ctx2d.beginPath(); ctx2d.moveTo(px, pad * 0.6); ctx2d.lineTo(px, H - pad * 0.6); ctx2d.stroke();
  }
  ctx2d.restore();
}

// The single draw/measure loop. Runs while the source is active; reads the
// analyser and feeds the audio channels while playing.
function tick() {
  if (!running || !canvasRef) { raf = null; return; }
  const ctx2d = canvasRef.getContext && canvasRef.getContext("2d");
  if (!ctx2d) { raf = null; return; }
  let level = 0, hz = 0, tNorm = 0;
  if (playing && analyser && ctx && srcNode) {
    analyser.getByteTimeDomainData(timeBuf);
    analyser.getByteFrequencyData(freqBuf);
    level = rmsFromTime(timeBuf);
    hz = dominantHz(freqBuf, ctx.sampleRate, analyser.fftSize);
    tNorm = dur ? (((ctx.currentTime - startedAt) % dur) / dur) : 0;
    pushMeters(level, hz);
  }
  drawFrame(ctx2d, canvasRef.width, canvasRef.height, tNorm, level);
  if (typeof requestAnimationFrame === "function") raf = requestAnimationFrame(tick);
  else raf = null;
}

/* Draw the seed's melody as a live piano-roll on the shared canvas; playback (and
   the audio measurement) is user-initiated via playSound(). Returns { animating }. */
export function startSound(canvas, opts = {}) {
  const seed = opts.seed || "aurora";
  comp = seedComposition(seed);
  pcm = renderAudioBuffer(seed, { sampleRate: SR });
  dur = pcm.length / SR;
  canvasRef = canvas;
  const ctx2d = canvas && typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
  if (!ctx2d) return { animating: false, composition: comp };
  if (raf) { cancelAnimationFrame(raf); raf = null; }
  running = true;
  if (typeof requestAnimationFrame === "function") tick();
  else drawFrame(ctx2d, canvas.width, canvas.height, 0, 0);
  return { animating: typeof requestAnimationFrame === "function", composition: comp };
}

/* Begin playback in our own resumed AudioContext and measure it. Must be called
   from a user gesture. Returns Promise<boolean>. */
export function playSound(opts = {}) {
  if (opts.seed) { comp = seedComposition(opts.seed); pcm = renderAudioBuffer(opts.seed, { sampleRate: SR }); dur = pcm.length / SR; }
  if (!pcm) return Promise.resolve(false);
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return Promise.resolve(false);
  try {
    if (!ctx) ctx = new AC();
    const resume = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
    return resume.then(() => {
      stopNodes();
      const ab = ctx.createBuffer(1, pcm.length, SR);
      ab.getChannelData(0).set(pcm);
      srcNode = ctx.createBufferSource();
      srcNode.buffer = ab;
      srcNode.loop = true;
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      freqBuf = new Uint8Array(analyser.frequencyBinCount);
      timeBuf = new Uint8Array(analyser.fftSize);
      srcNode.connect(analyser);
      srcNode.connect(ctx.destination);
      startedAt = ctx.currentTime;
      srcNode.start();
      playing = true;
      if (!raf && running && canvasRef && typeof requestAnimationFrame === "function") tick();
      return true;
    }).catch(() => false);
  } catch (_) {
    return Promise.resolve(false);
  }
}

function stopNodes() {
  if (srcNode) { try { srcNode.stop(); } catch (_) {} try { srcNode.disconnect(); } catch (_) {} srcNode = null; }
  if (analyser) { try { analyser.disconnect(); } catch (_) {} analyser = null; }
}

export function pauseSound() {
  playing = false;
  stopNodes();
  pushMeters(0, 0);
}

export function stopSound() {
  running = false;
  if (raf) { cancelAnimationFrame(raf); raf = null; }
  pauseSound();
  canvasRef = null;
}

export function soundReadout(seed) {
  const NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const c = seedComposition(seed);
  return `${NOTE[c.root % 12]}${Math.floor(c.root / 12) - 1} · ${c.scaleName} · ${c.bpm} bpm · ${c.noteCount} notes`;
}
