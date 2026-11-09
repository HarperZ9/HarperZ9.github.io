// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// grid.js: the struck grid, live. The same score reader (lib/midi.mjs), the same closed-form state
// (render/grid.mjs stateAt), mask coverage and HUD strings (render/grid-hud.mjs) as the offline frames, so a frame here
// and an offline frame at the same t show the same state; the pixels differ only in rasterisation and grain.
// Clock: the AudioContext's time, less its output latency. Each frame draws the state at the time being heard; no
// timers, no per-cell animation loops, nothing scheduled ahead of the sound.
// Sound: the score's own master when it has one (Hum v3); a MIDI file of yours plays on a small synth of our own
// (triangle wave, attack 20 ms, release 1 s, velocity as gain), scheduled on the audio clock.
// Reduced motion: the grid holds the state at the paused time and the count of notes; no fades run.
// Static files only: no server process, no port is ever taken from anything else, no library from a CDN.
import { parseMidi } from '../lib/midi.mjs';
import { prepareScore, stateAt, gridLayout, maskCoverage, gutterPx, GRID } from '../render/grid.mjs';
import { gridHud, MAPPING_TEXT } from '../render/grid-hud.mjs';
import { infoToggle } from './info.js';

const $ = id => document.getElementById(id);
const STILL = matchMedia('(prefers-reduced-motion: reduce)').matches;
const settings = await (await fetch('../settings.json')).json();
const AUDIO = { humGrid: '../../sound/theme/assets/hum3.opus' };

let actx = null, buffer = null, nodes = [], startedAt = 0, offset = 0, playing = false;
let midi = null, prep = null, src = null, G = null, ownSynth = false;
const clock = () => (playing ? Math.max(0, actx.currentTime - startedAt + offset - (actx.outputLatency || 0) - (actx.baseLatency || 0)) : offset);
const duration = () => (buffer ? buffer.duration : midi ? midi.duration + 2 : 0);

function synthNotes(from) {
  const out = actx.createGain(); out.gain.value = 0.18; out.connect(actx.destination); nodes.push(out);
  const t0 = actx.currentTime + 0.05;
  for (const n of midi.notes) {
    if (n.t + n.dur < from) continue;
    const at = t0 + Math.max(0, n.t - from), o = actx.createOscillator(), g = actx.createGain();
    o.type = 'triangle'; o.frequency.value = 440 * 2 ** ((n.pitch - 69) / 12);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(n.vel, at + 0.02); g.gain.setTargetAtTime(0, at + Math.max(0.02, n.dur), 0.3);
    o.connect(g).connect(out); o.start(at); o.stop(at + n.dur + 1.2); nodes.push(o);
  }
  return t0;
}
function play() {
  if (!prep) return; actx ??= new AudioContext(); actx.resume();
  if (ownSynth) { startedAt = synthNotes(offset); }
  else { const s = actx.createBufferSource(); s.buffer = buffer; s.connect(actx.destination); s.start(0, offset); startedAt = actx.currentTime; nodes.push(s); }
  playing = true; sync();
}
function stop() { if (playing) offset = clock(); for (const n of nodes) { try { n.stop?.(); n.disconnect(); } catch {} } nodes = []; playing = false; sync(); }
function sync() { $('play').setAttribute('aria-pressed', String(playing)); $('playLabel').textContent = playing ? 'Pause' : 'Play'; $('status').textContent = playing ? 'Playing' : `Paused, ${prep ? gridHud(midi, prep, offset, src).tr[1] : ''}`; }

async function load(id, file = null) {
  stop(); offset = 0; actx ??= new AudioContext();
  src = settings.sources[id] ?? { title: file?.name ?? 'a MIDI file', credit: ['read on this device; nothing leaves it'] };
  G = { ...GRID, ...(settings.scene.grid ?? {}), ...(src.grid ?? {}) };
  const bytes = file ? await file.arrayBuffer() : await (await fetch(`../${src.midi}`)).arrayBuffer();
  midi = parseMidi(bytes); prep = prepareScore(midi.notes, G);
  ownSynth = !AUDIO[id]; buffer = ownSynth ? null : await actx.decodeAudioData(await (await fetch(AUDIO[id])).arrayBuffer());
  $('credit').textContent = (src.credit ?? []).join('\n');
  $('mapping').textContent = MAPPING_TEXT[G.mapping] ?? '';
  $('fadeline').textContent = `${G.fade.toFixed(1)} s, scaled by note length`;
  // the text equivalent: which keys strike which cell
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], body = $('cells').tBodies[0]; body.replaceChildren();
  prep.strikes.forEach((list, i) => { const keys = [...new Set(list.map(s => s.pitch))].sort((a, b) => a - b).map(p => `${NAMES[p % 12]}${Math.floor(p / 12) - 1}`); const tr = body.insertRow(); tr.insertCell().textContent = `row ${Math.floor(i / G.cols) + 1}, column ${(i % G.cols) + 1}`; tr.insertCell().textContent = keys.join(', ') || 'none'; });
  dirty = true; sync();
}

// ---------- drawing: ink on ground, at the device pixel ratio, from the same state function as the offline frames
const art = $('art'), c = art.getContext('2d', { colorSpace: 'display-p3' }) ?? art.getContext('2d');
let W = 0, H = 0, dirty = true, cellImg = null;
function resize() { const d = Math.min(3, devicePixelRatio || 1); W = Math.round(innerWidth * d); H = Math.round(innerHeight * d); art.width = W; art.height = H; dirty = true; placePlay(); }
function region() { const portrait = innerWidth / innerHeight < 1.2; return portrait ? [0.5, 0.47, Math.min(0.62, 0.86 * innerWidth / innerHeight)] : GRID.region; }
function placePlay() { if (!G) return; const L = gridLayout(innerWidth, innerHeight, { ...G, region: region() }); Object.assign($('play').style, { left: `${L.x0}px`, top: `${L.y0}px`, width: `${L.cols * L.pitch}px`, height: `${L.rows * L.pitch}px` }); }

// Grain at 24 Hz (QUALITY-SPEC R4): a 256 px tile of mono noise, a new seed per 1/24 s, laid over at low alpha.
const grain = Array.from({ length: 4 }, (_, k) => { const g = new OffscreenCanvas(256, 256), x = g.getContext('2d'), im = x.createImageData(256, 256); let s = 9 + k * 7919;
  for (let i = 0; i < im.data.length; i += 4) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; const v = 128 + ((((s >>> 0) / 4294967296) - 0.5) * 2 * 28) | 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); return g; });

function draw(t) {
  const ground = G.ground ?? '#02040b', ink = G.ink ?? '#e6edf7', L = gridLayout(W, H, { ...G, region: region() }), S = stateAt(prep, t), fw = Math.max(1, (G.frame ?? 2) * H / 1080), gi = fw + gutterPx(L, G);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.fillStyle = ground; c.fillRect(0, 0, W, H);
  const n = Math.max(8, Math.ceil(L.cell - 2 * gi)); if (!cellImg || cellImg.width !== n) cellImg = new OffscreenCanvas(n, n);
  const cx = cellImg.getContext('2d');
  for (const st of S) {
    const x0 = L.x0 + (st.cell % L.cols) * L.pitch, y0 = L.y0 + Math.floor(st.cell / L.cols) * L.pitch;
    if (st.opacity > 0) {
      // the fill with its ground mask, drawn per pixel by the same coverage function as offline, then placed
      const im = cx.createImageData(n, n), px = 1 / n; const [r, g, b] = [1, 3, 5].map(i => parseInt(ink.slice(i, i + 2), 16));
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const a = st.opacity * (1 - maskCoverage(st.mask, (x + 0.5) / n - 0.5, (y + 0.5) / n - 0.5, st.e, px)), i = (y * n + x) * 4; im.data[i] = r; im.data[i + 1] = g; im.data[i + 2] = b; im.data[i + 3] = Math.round(255 * a); }
      cx.putImageData(im, 0, 0); c.drawImage(cellImg, x0 + gi, y0 + gi, L.cell - 2 * gi, L.cell - 2 * gi);   // inset: a bare gutter inside the frame
    }
    c.strokeStyle = ink; c.lineWidth = fw; c.strokeRect(x0 + fw / 2, y0 + fw / 2, L.cell - fw, L.cell - fw);
  }
  // grain veil: overlay vanished on the near-black ground (surface sd 0); a plain veil keeps about 1.5 code values
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.05; c.fillStyle = c.createPattern(grain[Math.floor(t * 24) % 4], 'repeat'); c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
}

let lastKey = '';
function hud(t) {
  const M = gridHud(midi, prep, t, src), key = M.tr.join('|'); if (key === lastKey) return; lastKey = key;
  $('v0').textContent = M.tr[0]; $('v1').textContent = M.tr[1]; $('v2').textContent = M.tr[2];
  $('seek').value = String(Math.round(1000 * Math.min(1, t / Math.max(1e-6, duration()))));
}
let lastT = -1;
function frame() {
  requestAnimationFrame(frame); if (!prep) return;
  const t = STILL ? offset : clock();
  if (!dirty && t === lastT) return; dirty = false; lastT = t;
  draw(t); hud(t);
}

$('play').addEventListener('click', () => (playing ? stop() : play()));
$('seek').addEventListener('input', e => { const was = playing; stop(); offset = (+e.target.value / 1000) * duration(); dirty = true; if (was) play(); });
$('source').addEventListener('change', e => { if (e.target.value === 'file') $('file').click(); else load(e.target.value); });
$('file').addEventListener('change', e => { const f = e.target.files?.[0]; if (f) load('file', f); });
addEventListener('keydown', e => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); playing ? stop() : play(); } });
$('settings').addEventListener('click', () => { const out = structuredClone(settings); out.scene.grid = { ...out.scene.grid, ...(src?.grid ?? {}) }; $('settings').href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })); });
addEventListener('resize', resize);
infoToggle($('info'));
const q = new URLSearchParams(location.search);
await load(q.get('source') ?? 'humGrid'); resize();
offset = +(q.get('t') ?? 0); dirty = true;
requestAnimationFrame(frame);
