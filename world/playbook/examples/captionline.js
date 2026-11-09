// Order: Lovelace's two sentences about the engine, set three ways on one clock.
// Ground: studio material plates (light, chladni, code) rendered off-thread and recut with a gate weave on
// twos and threes. Captions: kinetic, then the quote beat with its claim in the hot mark, then the log of the
// numbers Note G sets out to compute. Onsets are exact; fades, boil and cursor step on the clocks.
import { parseVTT, markSpans } from '../captionline.js';
import { mountCaptions } from '../lib/captionline-render.js';
import { Cadence, run } from '../cadence.js';
import { hash01, reducedMotion } from '../lib/util.js';

const P3 = 'display-p3'; // R5: a P3 backing store on every display; sRGB plates and colours are converted on draw, so nothing oversaturates
const LOOP = 26, T0 = Math.max(0, +new URLSearchParams(location.search).get('t') || 0); // ?t= opens the loop at a time, for review
// raw-native cue shape (tools/explainer/captions.mjs); word onsets are estimated by spoken weight inside each cue.
const K = `WEBVTT\n\n1\n00:00:00.600 --> 00:00:08.200\nWe may say most aptly that the Analytical Engine weaves algebraical patterns just as the Jacquard-loom weaves flowers and leaves.\n`;
const Q = `WEBVTT\n\n1\n00:00:08.800 --> 00:00:17.000\nThe Analytical Engine has no pretensions whatever to originate anything. It can do whatever we know how to order it to perform.\n`;
const L = `WEBVTT\n\n1\n00:00:17.600 --> 00:00:18.900\nB2 = 1/6\n\n2\n00:00:19.300 --> 00:00:20.600\nB4 = -1/30\n\n3\n00:00:21.000 --> 00:00:22.300\nB6 = 1/42\n\n4\n00:00:22.700 --> 00:00:25.600\nB8 = -1/30, the number Note G sets out to compute\n`;
const SECTIONS = [
  { from: 0, material: 'light', veil: { x: 0.5, y: 0.52, r: 0.5, k: 0.84 } },
  { from: 8.6, material: 'chladni', veil: [{ x: 0.24, y: 0.42, r: 0.62, k: 0.78 }, { x: 0.3, y: 0.86, r: 0.5, k: 0.7 }] },
  { from: 17.4, material: 'code', veil: { x: 0.25, y: 0.82, r: 0.7, k: 0.5 } },
];

const stage = document.getElementById('stage'), cv = document.getElementById('plate'), caps = document.getElementById('caps');
const kin = parseVTT(K), quote = markSpans(parseVTT(Q), [{ cue: 0, text: 'whatever we know how to order it to perform.' }]), log = parseVTT(L);
document.getElementById('transcript').innerHTML = [kin, quote, log].map((t) => `<div>${t.cues.map((c) => c.text).join(' ')}</div>`).join('');

const cad = new Cadence({ clocks: { weave: 'twos-threes-24', look: 'twos-24', step: 'step-7' }, seed: 23 });
const C = cad.clocks;
const mounts = [
  mountCaptions(caps, kin, { mode: 'kinetic', clock: C.look, boil: 0.7 }),
  mountCaptions(caps, quote, { mode: 'quote', clock: C.look, cites: { 0: 'Ada Lovelace, Note G, 1843' } }),
  mountCaptions(caps, log, { mode: 'log', clock: C.step, maxLines: 4 }),
];

// Plates: rendered in a worker at the canvas's device size plus 3% for the weave.
const g = cv.getContext('2d', { alpha: false, colorSpace: P3 }); let dirty = true, lastKey = '';
const section = (t) => SECTIONS.reduce((a, s, k) => (t >= s.from ? k : a), 0);
const MARGIN = 0.03, plates = new Map(); let W = 0, H = 0, gen = 0;
// One worker, plates in order of need. Three workers rendered in parallel, but their module graphs (the studio pulls in
// the brush engine) arrived at once and overflowed the stdlib server's listen backlog (ERR_CONNECTION_REFUSED).
const worker = new Worker(new URL('../lib/captionline-plates-worker.js', import.meta.url), { type: 'module' }), workers = [worker];
const onPlate = async ({ data }) => {
  const [g, k] = data.id.split(':').map(Number); if (g !== gen) return;
  if (data.error) { console.error(data.error); return; }
  plates.set(k, await createImageBitmap(new ImageData(new Uint8ClampedArray(data.buf), data.w, data.h))); dirty = true;
};
for (const w of workers) { w.onmessage = onPlate; w.onerror = (e) => console.error('plates worker failed to load', e.message || e.type); }
function size() {
  const r = stage.getBoundingClientRect(), dpr = devicePixelRatio || 1; W = Math.round(r.width * dpr); H = Math.round(r.height * dpr);
  cv.width = W; cv.height = H; gen++; plates.clear(); dirty = true;
  const now = section(((performance.now() / 1000) + T0) % LOOP), order = SECTIONS.map((_, k) => (now + k) % SECTIONS.length); // the section on screen renders first
  order.map((k) => [SECTIONS[k], k]).forEach(([s, k]) => worker.postMessage({ id: `${gen}:${k}`, material: s.material, w: Math.ceil(W * (1 + MARGIN)), h: Math.ceil(H * (1 + MARGIN)), seed: 11 + k, veil: s.veil }));
}
function drawPlate(t, weaveIndex) {
  const k = section(t), key = `${k}:${weaveIndex}:${plates.has(k)}`; if (!dirty && key === lastKey) return; lastKey = key; dirty = false;
  const p = plates.get(k); g.fillStyle = '#0d1a22'; g.fillRect(0, 0, W, H); if (!p) return;
  const dx = Math.round(hash01(weaveIndex, 1) * W * MARGIN), dy = Math.round(hash01(weaveIndex, 2) * H * MARGIN * 0.6);
  g.drawImage(p, -dx, -dy);
}

cad.subscribe({ layout: 'weave', draw(f) {
  const t = (f.t + T0) % LOOP; drawPlate(t, f.clocks.weave.index);
  for (const m of mounts) m.update(t);
} });
let resizeT = 0; addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(size, 200); });
size();
if (reducedMotion()) {
  // Finished state: the quote held at full strength with its claim lit, the log complete, the plate still.
  mounts[0].el.hidden = true; mounts[1].update(16.2); mounts[2].update(25.5);
  const show = () => drawPlate(10, 0); for (const w of workers) w.addEventListener('message', () => setTimeout(show, 50)); show();
} else run(cad);
