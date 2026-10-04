// system/media-engine/sound-retro.mjs
// The Retro instrument's own sounds on the sound layer: the interaction pings and the drone.
//
// A ping is a superstack.sound/1 scene (producer "ping"): its notes, each an enveloped oscillator
// with the envelope WebAudio's exponential ramps describe, rendered offline in float64 with
// band-limited partials, normalised to the interactive class and quantized once. The live ping
// plays those samples.
//
// The drone reacts to the picture, so its score is only known as it plays. It is rendered in
// chunks of CHUNK samples: each chunk latches the six band levels, the root and whether the drone
// is audible, and the renderer carries its state (phases, gains, frequencies, filter cutoff and
// memory, level) from chunk to chunk. A session's scene (producer "drone") lists the chunks it
// played; rendering that scene offline from the start gives the same samples the live path
// scheduled, chunk for chunk. Its level is fixed by its own gains (fixed_gain), so the receipt
// states the loudness that came out instead of normalising after the fact.
//
// Changes from the WebAudio graph this replaces: no DynamicsCompressor on the master bus, the
// drone's targets change at chunk boundaries (every 50 ms) instead of at each feed() call, its
// lowpass coefficients follow the cutoff every 128 samples, and the drone fades in and out with
// a 0.15 s and 0.1 s time constant instead of a 0.6 s exponential and a 0.4 s linear ramp.

import { registerRenderer, SOUND_RATE, soundReceipt, REFERENCE_BACKEND } from "./sound.mjs";
import { quantizeS16, reconcilePcmS16, sha256 } from "./contracts.mjs";

const TAU = 2 * Math.PI;
const SCALE = [0, 3, 5, 7, 10, 12];
const semi = (n) => Math.pow(2, n / 12);
const e6 = (v) => Math.round(v * 1e6) / 1e6;
const at = (s) => Math.round(s * SOUND_RATE);
export const MASTER = 0.5;

// ---------------------------------------------------------------- pings

const degreeOf = (v) => Math.max(0, Math.min(SCALE.length - 1, Math.floor((v || 0) * SCALE.length)));

// The notes of one ping, as retro-audio.js's blip() and thump() played them.
function pingNotes(kind, degree, root) {
  const blip = (hz, wave, dur, peak, off = 0) => ({ wave, hz: e6(hz), at: at(off), attack: at(0.006), dur: at(dur), stop: at(dur + 0.03), peak });
  const d = SCALE[degree];
  if (kind === "chip") return [blip(root * semi(d), "triangle", 0.16, 0.12)];
  if (kind === "slider") return [blip(root * 2 * semi(d), "sine", 0.07, 0.06)];
  if (kind === "button") return [0, 1, 2].map((i) => blip(root * semi(SCALE[i]), "triangle", 0.13, 0.10, i * 0.055));
  if (kind === "bell") return [blip(root * 2, "sine", 0.5, 0.08), blip(root * 2 * 1.004, "sine", 0.5, 0.05)];
  if (kind === "click") return [{ wave: "sine", hz: 190, hz_end: 60, sweep: at(0.13), at: 0, attack: at(0.008), dur: at(0.16), stop: at(0.2), peak: 0.22 },
    blip(1750, "square", 0.03, 0.04)];
  return [blip(root, "triangle", 0.14, 0.09)];
}

const PING_KINDS = ["chip", "slider", "button", "bell", "click"];

export function pingScene(kind, value, rootHz) {
  const k = PING_KINDS.includes(kind) ? kind : "note";
  const degree = k === "chip" || k === "slider" ? degreeOf(value) : 0;
  const root = e6(rootHz);
  const notes = pingNotes(k, degree, root);
  const end = Math.max(...notes.map((n) => n.at + n.stop));
  return { kind: "superstack.sound/1", producer: "ping", rate: SOUND_RATE, channels: 1, ping: k, degree, root_hz: root,
    master: MASTER, notes, duration_samples: Math.max(end, at(0.5)), loudness_class: "interactive" };
}

// Odd-harmonic partial sums below Nyquist: triangle (1/k^2, alternating) and square (1/k).
function partials(wave, phase, maxK) {
  let acc = 0;
  for (let k = 1; k <= maxK; k += 2) {
    const s = Math.sin(k * phase);
    acc += wave === "square" ? s / k : ((((k - 1) / 2) & 1) ? -1 : 1) * s / (k * k);
  }
  return wave === "square" ? (4 / Math.PI) * acc : (8 / (Math.PI * Math.PI)) * acc;
}

// WebAudio's exponentialRampToValueAtTime from 0.0001: up to the peak by `attack`, down to 0.0001
// by `dur`, held there until `stop`.
function envelope(n, i) {
  if (i < n.attack) return 0.0001 * Math.pow(n.peak / 0.0001, i / n.attack);
  if (i < n.dur) return n.peak * Math.pow(0.0001 / n.peak, (i - n.attack) / (n.dur - n.attack));
  return 0.0001;
}

function renderPing(scene) {
  const out = new Float64Array(scene.duration_samples), r = scene.rate;
  for (const n of scene.notes) {
    let phase = 0;
    for (let i = 0; i < n.stop && n.at + i < out.length; i++) {
      const hz = n.hz_end ? (i < n.sweep ? n.hz * Math.pow(n.hz_end / n.hz, i / n.sweep) : n.hz_end) : n.hz;
      const maxK = Math.max(1, Math.floor((r / 2) / hz));
      const v = n.wave === "sine" ? Math.sin(phase) : partials(n.wave, phase, maxK);
      out[n.at + i] += scene.master * envelope(n, i) * v;
      phase += TAU * hz / r;
    }
  }
  return out;
}

// ---------------------------------------------------------------- drone

export const DRONE = Object.freeze({ chunk: 2400, harmonics: 6, block: 128, tau_gain: 0.09, tau_cutoff: 0.12, tau_freq: 0.1,
  tau_in: 0.15, tau_out: 0.1, cutoff0: 700, q_db: 3, voice: 0.9, master: MASTER });

// One chunk's controls, quantized so a scene holds exact integers: band levels in thousandths, the
// root in millihertz, audible 1 or 0.
export function droneChunk(bands, rootHz, audible) {
  const b = [];
  for (let i = 0; i < DRONE.harmonics; i++) b.push(Math.round(Math.max(0, Math.min(1, (bands && bands[i]) || 0)) * 1000));
  return { b, r: Math.round(rootHz * 1000), m: audible ? 1 : 0 };
}

export function droneScene(chunks) {
  return { kind: "superstack.sound/1", producer: "drone", rate: SOUND_RATE, channels: 1, ...DRONE,
    chunks, duration_samples: chunks.length * DRONE.chunk, loudness_class: "interactive", fixed_gain: true };
}

export function droneState(firstRootHz) {
  const f = Array.from({ length: DRONE.harmonics }, (_, i) => firstRootHz * (i + 1));
  return { phase: new Float64Array(DRONE.harmonics), gain: new Float64Array(DRONE.harmonics), freq: Float64Array.from(f),
    cutoff: DRONE.cutoff0, level: 0, x1: 0, x2: 0, y1: 0, y2: 0, n: 0, c: null };
}

function lowpass(st, r) {
  const w0 = TAU * Math.min(st.cutoff, r / 2 - 1) / r, cw = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Math.pow(10, DRONE.q_db / 20));
  const a0 = 1 + alpha;
  st.c = [(1 - cw) / 2 / a0, (1 - cw) / a0, (1 - cw) / 2 / a0, -2 * cw / a0, (1 - alpha) / a0];
}

// Render one chunk into out[offset..offset+CHUNK), advancing the state.
export function renderDroneChunk(st, ch, out, offset, r = SOUND_RATE) {
  const H = DRONE.harmonics, root = ch.r / 1000;
  const kg = Math.exp(-1 / (DRONE.tau_gain * r)), kc = Math.exp(-1 / (DRONE.tau_cutoff * r)), kf = Math.exp(-1 / (DRONE.tau_freq * r));
  const kl = Math.exp(-1 / ((ch.m ? DRONE.tau_in : DRONE.tau_out) * r));
  const tg = ch.b.map((v, i) => (v / 1000) * (0.32 / (i + 1)));
  let sum = 0; for (const v of ch.b) sum += v / 1000;
  const tc = 260 + (sum / H) * 3200, tl = ch.m ? DRONE.master : 0;
  for (let j = 0; j < DRONE.chunk; j++) {
    if (st.n % DRONE.block === 0 || !st.c) lowpass(st, r);
    let x = 0;
    for (let i = 0; i < H; i++) {
      const target = root * (i + 1) * Math.pow(2, ((i - 2.5) * 2.5) / 1200);
      st.freq[i] = target + (st.freq[i] - target) * kf;
      st.gain[i] = tg[i] + (st.gain[i] - tg[i]) * kg;
      x += st.gain[i] * Math.sin(st.phase[i]);
      st.phase[i] += TAU * st.freq[i] / r;
      if (st.phase[i] > TAU) st.phase[i] -= TAU;
    }
    const c = st.c, y = c[0] * x + c[1] * st.x1 + c[2] * st.x2 - c[3] * st.y1 - c[4] * st.y2;
    st.x2 = st.x1; st.x1 = x; st.y2 = st.y1; st.y1 = y;
    st.cutoff = tc + (st.cutoff - tc) * kc;
    st.level = tl + (st.level - tl) * kl;
    out[offset + j] = y * DRONE.voice * st.level;
    st.n++;
  }
}

function renderDrone(scene) {
  const out = new Float64Array(scene.duration_samples);
  if (!scene.chunks.length) return out;
  const st = droneState(scene.chunks[0].r / 1000);
  scene.chunks.forEach((ch, k) => renderDroneChunk(st, ch, out, k * DRONE.chunk, scene.rate));
  return out;
}

// ---------------------------------------------------------------- live drone

const RECORD_CHUNKS = 600;   // a session's receipt covers its first 30 s
const LOOKAHEAD = 0.25, LEAD = 0.05;   // seconds of drone scheduled ahead, and the first chunk's lead

const floatsOf = (pcm) => {
  const dv = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength), f = new Float32Array(pcm.byteLength >> 1);
  for (let i = 0; i < f.length; i++) f[i] = dv.getInt16(2 * i, true) / 32767;
  return f;
};

// Render and schedule the drone chunk by chunk on a live context. connect(source) routes each
// chunk's buffer source (to the speakers and an analysis tap). The first RECORD_CHUNKS chunks are
// kept as the session: scene() is their droneScene and pcm() the bytes the live path was given.
export function createDroneStream(ctx, { rootHz, connect }) {
  let bands = new Array(DRONE.harmonics).fill(0), root = rootHz, audible = true, ending = false;
  // Start times are whole sample frames at 48 kHz, so no chunk starts between two samples.
  let st = null, nextFrame = 0, timer = 0, late = 0;
  const chunks = [], parts = [], sources = new Set();
  const buf = new Float64Array(DRONE.chunk);
  function one() {
    const ch = droneChunk(bands, root, audible && !ending);
    if (!st) st = droneState(ch.r / 1000);
    renderDroneChunk(st, ch, buf, 0, SOUND_RATE);
    const pcm = quantizeS16(buf);
    if (chunks.length < RECORD_CHUNKS) { chunks.push(ch); parts.push(pcm); }
    const ab = ctx.createBuffer(1, DRONE.chunk, SOUND_RATE);   // a context at another rate resamples it
    ab.copyToChannel(floatsOf(pcm), 0);
    const src = ctx.createBufferSource();
    src.buffer = ab; connect(src); src.start(nextFrame / SOUND_RATE);
    sources.add(src); src.onended = () => { sources.delete(src); try { src.disconnect(); } catch (_) {} };
    nextFrame += DRONE.chunk;
  }
  // A chunk that would start in the past (the first one, a return to the tab, or a timer that ran
  // late) moves the schedule forward instead; late counts the times that happened mid-stream.
  function catchUp() {
    const lead = Math.ceil((ctx.currentTime + LEAD) * SOUND_RATE);
    if (nextFrame < lead) { if (nextFrame && audible && !ending) late++; nextFrame = lead; }
  }
  function pump() {
    if (!audible || ending) return;   // hidden (faded already) or stopped
    catchUp();
    while (nextFrame / SOUND_RATE < ctx.currentTime + LOOKAHEAD) one();
  }
  // A fade out is rendered and scheduled at once (ten chunks, 0.5 s): a hidden tab's timers run
  // once a second, too slowly to feed it chunk by chunk.
  function fadeOut() {
    catchUp();
    for (let k = 0; k < 10; k++) one();
  }
  timer = setInterval(pump, 25);
  pump();
  return {
    setBands(b) { bands = Array.from(b || []); },
    setRoot(hz) { root = hz; },
    setAudible(on) { if (audible === on) return; audible = on; if (!on) fadeOut(); else { nextFrame = 0; pump(); } },
    stop() { if (ending) return; ending = true; fadeOut(); if (timer) { clearInterval(timer); timer = 0; } },
    stopNow() { ending = true; if (timer) { clearInterval(timer); timer = 0; } for (const s of sources) { try { s.stop(); } catch (_) {} } },
    scene: () => droneScene(chunks.slice()),
    get late() { return late; },
    pcm() { const out = new Uint8Array(parts.length * DRONE.chunk * 2); parts.forEach((p, k) => out.set(p, k * DRONE.chunk * 2)); return out; },
  };
}

// The live drone's check: its scheduled chunks, rendered through the same buffer sources in an
// OfflineAudioContext, held against the session scene's offline reference.
export async function reconcileDroneLive(ref, livePcm) {
  const O = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  const n = ref.pcm.byteLength / 2;
  const reference = { backend: REFERENCE_BACKEND, content_sha256: sha256(ref.pcm) };
  const given = reconcilePcmS16(ref.pcm, livePcm);
  if (!O) return { given, receipt: null };
  const ctx = new O(1, n, ref.scene.rate), f = floatsOf(livePcm);
  for (let k = 0; k * DRONE.chunk < n; k++) {
    const ab = ctx.createBuffer(1, DRONE.chunk, ref.scene.rate);
    ab.copyToChannel(f.subarray(k * DRONE.chunk, (k + 1) * DRONE.chunk), 0);
    const src = ctx.createBufferSource(); src.buffer = ab; src.connect(ctx.destination); src.start((k * DRONE.chunk) / ref.scene.rate);
  }
  const live = quantizeS16((await ctx.startRendering()).getChannelData(0));
  const receipt = soundReceipt(ref, { backend: "webaudio-offline", content: live, reference, reconcile: reconcilePcmS16(ref.pcm, live),
    extra: ["The live check schedules the session's chunks in an OfflineAudioContext; a real-time context on a device can still glitch, drop a late chunk or resample.",
      "The scene is the drone's first 30 s at most, and leaves out the silence while the tab was hidden."] });
  return { given, receipt };
}

registerRenderer("ping", renderPing);
registerRenderer("drone", renderDrone);
