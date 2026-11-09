// One Score: a pointer, Lovelace's words and a step clock drive four lanes through one bus.
// Picture: studio plates (light, dmv-beat, art-deco) crossfade on each step while lerpMaterial gives the blended
// palette that inks the marks; type: the last word, large; sound: the sound engine's pluck and bell (after a press);
// data: the recorded log drawn as a score along the foot. Every lane prints its key.
import { Bus, record, replay, map, materialLane } from '../crossbus.js';
import { drawStrip } from '../lib/crossbus-strip.js';
import { Cadence, run } from '../cadence.js';
import { hash01, reducedMotion, hexToRgb } from '../lib/util.js';
import { MATERIALS } from '../../studio/lib/materials.mjs';
import { lerpMaterial } from '../../studio/lib/blend.mjs';

const P3 = 'display-p3'; // R5: a P3 backing store on every display; sRGB plates and colours are converted on draw, so nothing oversaturates
const $ = (id) => document.getElementById(id), stage = $('stage');
const WORDS = 'We may say most aptly that the Analytical Engine weaves algebraical patterns just as the Jacquard-loom weaves flowers and leaves'.split(' ');
const MATS = ['light', 'dmv-beat', 'art-deco'].map((id) => MATERIALS.find((m) => m.id === id));
const WINDOW = 16, STEP_S = 4.2;

// --- the bus, its lanes and routes
const bus = new Bus(), { log } = record(bus), mat = materialLane({ materials: MATS, lerp: lerpMaterial, over: 1.6 });
let lastDeg = -1, lastNoteT = -1;
bus.route('pointer', 'value', map.pointerToValue('height'), 'pointer height becomes a value from 0 to 1');
const v2n = map.valueToNote({ low: 45, high: 81 });
bus.route('value', 'note', (e) => { const n = v2n(e); if (n.midi === lastDeg || e.t - lastNoteT < 0.16) return null; lastDeg = n.midi; lastNoteT = e.t; return n; }, 'a value plays when it crosses a pentatonic degree, MIDI 45 to 81');
bus.route('word', 'note', map.wordToNote({ low: 69 }), 'a word picks a degree by its letters and rings for its length');
bus.lane(mat);
const marks = [], words = [];
bus.lane({ id: 'marks', medium: 'picture', reads: ['note', 'pointer'], key: ['note becomes a ring at the pointer, radius by velocity', 'pointer leaves a trace'], encode: {
  note: (e) => { marks.push({ t: e.t, x: px, y: py, r: e.vel, midi: e.midi }); },
  pointer: (e) => { px = e.x; py = e.y; },
} });
bus.lane({ id: 'type', medium: 'type', reads: ['word'], key: ['word is set large, one at a time'], encode: { word: (e) => { words.push(e.text); } } });
let engine = null, voices = null;
bus.lane({ id: 'sound', medium: 'sound', reads: ['note', 'step'], key: ['note plays a pluck, step rings a bell'], encode: {
  note: (e) => { if (engine && !engine.muted) voices.pluck(engine.ctx, engine.master, engine.now + 0.01, { note: e.midi, vel: 0.22 * e.vel + 0.08, dur: e.dur }); },
  step: () => { if (engine && !engine.muted) voices.bell(engine.ctx, engine.master, engine.now + 0.01, { note: 81, vel: 0.12, dur: 1.4 }); },
} });
bus.lane({ id: 'score', medium: 'data', reads: ['value', 'word', 'note', 'step', 'pointer'], key: ['every event is drawn on the score'], encode: Object.fromEntries(['value', 'word', 'note', 'step', 'pointer'].map((t) => [t, () => undefined])) });
$('key').innerHTML = bus.keys().map((k) => `<li>${k}</li>`).join('');

// --- the driver: an autopilot path unless a hand is on the stage
let px = 0.5, py = 0.5, hand = null, handT = -10, wordI = 0, stepI = 0;
stage.addEventListener('pointermove', (e) => { const r = stage.getBoundingClientRect(); hand = [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; handT = cad.t; });
function drive(t) {
  bus.at(t);
  const auto = [0.5 + 0.36 * Math.sin(t * 0.61) * Math.cos(t * 0.23), 0.42 + 0.3 * Math.sin(t * 0.97 + 1.3)];
  const [x, y] = hand && t - handT < 3 ? hand : auto;
  bus.emit('pointer', { x, y, p: 0.5 + 0.5 * hash01(7, Math.round(t * 10)) });
  if (t >= wordI * 0.62 + 0.4) bus.emit('word', { text: WORDS[wordI++ % WORDS.length] });
  if (t >= stepI * STEP_S) bus.emit('step', { i: stepI++ });
}

// --- picture
const plateCv = $('plate'), marksCv = $('marks'), stripCv = $('strip'), pg = plateCv.getContext('2d', { alpha: false, colorSpace: P3 }), mg = marksCv.getContext('2d', { colorSpace: P3 }), sg = stripCv.getContext('2d', { colorSpace: P3 });
const bitmaps = new Map(); let W = 0, H = 0, gen = 0, lastPlate = '';
const worker = new Worker(new URL('../lib/captionline-plates-worker.js', import.meta.url), { type: 'module' });
worker.onerror = (e) => console.error('plates worker failed to load', e.message || e.type);
worker.onmessage = async ({ data }) => { const [g, k] = data.id.split(':').map(Number); if (g !== gen) return; if (data.error) { console.error(data.error); return; } bitmaps.set(k, await createImageBitmap(new ImageData(new Uint8ClampedArray(data.buf), data.w, data.h))); };
function size() {
  const dpr = devicePixelRatio || 1;
  for (const c of [plateCv, marksCv, stripCv]) { const r = c.getBoundingClientRect(); c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
  W = plateCv.width; H = plateCv.height; gen++; bitmaps.clear(); lastPlate = '';
  MATS.forEach((m, k) => worker.postMessage({ id: `${gen}:${k}`, material: m.id, w: W, h: H, seed: 5 + k, veil: [{ x: 0.2, y: 0.78, r: 0.55, k: 0.6 }, { x: 0.9, y: 0.05, r: 0.35, k: 0.55 }] }));
}
const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex).map((v) => Math.round(v * 255)); return `rgba(${r},${g},${b},${a})`; };
function paint(t) {
  const m = mat.at(t), s = log.events.filter((e) => e.type === 'step').at(-1), i = s ? s.i : 0, a = bitmaps.get(i % 3), b = bitmaps.get((i + 1) % 3);
  const plateKey = `${i}:${m.u.toFixed(3)}:${!!a}:${!!b}`; // the plate redraws only while it crossfades or when a plate lands
  if (plateKey !== lastPlate) {
    lastPlate = plateKey; pg.fillStyle = m.material.palette.ground; pg.fillRect(0, 0, W, H);
    if (a && m.u < 1) { pg.globalAlpha = 1; pg.drawImage(a, 0, 0); } if (b && m.u > 0) { pg.globalAlpha = m.u < 1 ? m.u : 1; pg.drawImage(b, 0, 0); }
    pg.globalAlpha = 1;
  }
  const ink = m.material.palette.ink, dpr = W / stage.clientWidth;
  mg.clearRect(0, 0, W, H); mg.lineCap = 'round';
  const pts = log.events.filter((e) => e.type === 'pointer' && e.t > t - 2.5);
  mg.lineWidth = 1.5 * dpr; mg.strokeStyle = rgba(ink, 0.7); mg.beginPath(); pts.forEach((e, k) => mg[k ? 'lineTo' : 'moveTo'](e.x * W, e.y * H)); mg.stroke();
  while (marks.length && marks[0].t < t - 2) marks.shift();
  for (const k of marks) { const age = (t - k.t) / 2; mg.lineWidth = (1 + 2 * k.r) * dpr; mg.strokeStyle = rgba(ink, 0.85 * (1 - age)); mg.beginPath(); mg.arc(k.x * W, k.y * H, (10 + 70 * age) * (0.6 + k.r) * dpr, 0, Math.PI * 2); mg.stroke(); }
  sg.fillStyle = '#0b0a0c'; sg.fillRect(0, 0, stripCv.width, stripCv.height);
  drawStrip(sg, log, { t0: Math.max(0, t - WINDOW), t1: Math.max(WINDOW, t), ground: false, pad: Math.round(16 * dpr) });
  const w = words.at(-1) || ''; if ($('word').textContent !== w) $('word').textContent = w;
  while (log.events.length && log.events[0].t < t - WINDOW - 1) log.events.shift();
}

// --- sound, only after a press
$('snd').addEventListener('click', async () => {
  const btn = $('snd');
  if (!engine) { const S = await import('../../sound/sound/index.js'); voices = S.voices; engine = await S.Engine.live(); btn.setAttribute('aria-pressed', 'true'); return; }
  engine.mute(!engine.muted); btn.setAttribute('aria-pressed', String(!engine.muted));
});

const cad = new Cadence({ clocks: { look: 'twos-24' }, seed: 9 });
let simT = 0;
cad.subscribe({ update(dt) { simT += dt; if (Math.round(simT * 120) % 12 === 0) drive(simT); /* the driver samples at 10 Hz */ }, layout: 'look', onLayout(st, t) { paint(t); } });
let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(size, 200); });
size();
if (reducedMotion()) {
  // Finished state: a recorded 13 s session (it ends on the last word) replayed into the lanes at once, then drawn as one still.
  for (let k = 0; k <= 13 * 10; k++) drive(k / 10);
  const still = () => paint(13); worker.addEventListener('message', () => setTimeout(still, 50)); still();
} else run(cad);
export { log, replay };
