// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// demo.js: four plates. WebGL2 where it exists, a CPU still in Canvas 2D where it does not, and the live site page
// under a reeded arch through an SVG backdrop filter. All CPU preparation runs in worker.js, including the CRT
// programme at 10 Hz, so the main thread only uploads and draws. Motion keeps the alive layer's bar (6.4 s):
// the vessel breathes on two bars, the water steps at 30 Hz. Reduced motion gives one still per plate.
import { context, program, floatTex, target, pass } from './lib/gl.js';
import { GLASS_FS, WATER_FS, CRT_FS, BAND_FS } from './lib/shaders.js';
import { channelIor, DEFAULTS } from './glass.js';
import { SHORE, sunDirection } from './liquid.js';
import { FIGURE2, CHORUS2, LIVE2, VESSEL } from './pieces2.js';
import { hexLin, boxBlur } from './lib/raster.js';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches, BAR = 6.4;
// two workers: 'prep' bakes bodies, caustics and stills; 'live' serves the per-frame jobs, so neither waits on the other
const workers = { prep: new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }), live: new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }) };
let seq = 0; const pending = new Map();
for (const wk of Object.values(workers)) wk.onmessage = e => { const { id, ok, r, error } = e.data, p = pending.get(id); pending.delete(id); ok ? p.res(r) : p.rej(new Error(error)); };
const LIVE_JOBS = new Set(['signal', 'seaInit', 'seaStep']);
const job = (type, args) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); workers[LIVE_JOBS.has(type) ? 'live' : 'prep'].postMessage({ id, type, args }); });
const MASK = new URL('./assets/chorus-mask.png', import.meta.url).href;
let SERIES = null;
const series = async () => SERIES ??= (await (await fetch(new URL('../dataviz/data/cpi-annual.json', import.meta.url))).json()).rows.filter(r => r.inflation_pct != null).map(r => r.inflation_pct);

async function size(canvas) {
  let r = canvas.getBoundingClientRect();
  for (let k = 0; k < 20 && r.width < 8; k++) { await new Promise(requestAnimationFrame); r = canvas.getBoundingClientRect(); }
  // full DPR (QUALITY-SPEC R1); capped at 3200 px, where the glass pass stays under the frame budget in the audit
  const w = Math.min(3200, Math.round(r.width * Math.min(2, devicePixelRatio || 1)));
  canvas.width = w; canvas.height = Math.round(w * 10 / 16); return [w, canvas.height];
}
function loop(el, draw) {
  draw(0); // one frame now, so a plate that has not yet scrolled into view still holds its picture
  if (still) return;
  let on = false, raf = 0; const t0 = performance.now();
  const tick = now => { draw((now - t0) / 1000); if (on) raf = requestAnimationFrame(tick); };
  new IntersectionObserver(es => es.forEach(e => { on = e.isIntersecting; cancelAnimationFrame(raf); if (on) raf = requestAnimationFrame(tick); })).observe(el);
}
function glassUniforms(o, h) {
  const p = { ...DEFAULTS, ...o, env: { ...DEFAULTS.env, ...o.env }, key: { ...DEFAULTS.key, ...o.key } };
  const sigma = hexLin(p.tint).map(v => -Math.log(Math.max(1e-4, v)) * p.density / 100);
  return { u_n: channelIor(p.glass, p.spread ?? 1), u_sigma: sigma, u_zen: hexLin(p.env.zenith), u_hor: hexLin(p.env.horizon), u_gnd: hexLin(p.env.ground),
    u_key: p.key.dir, u_keyPow: p.key.power, u_keyShine: p.key.shine, u_gap: p.gap * h, u_thick: 1, u_rim: p.rim,
    u_ck: p.caustic?.strength ?? 0, u_light: p.caustic?.light ?? [0, 0], u_hasC: p.caustic ? 1 : 0, u_soft: 0, u_flip: 1 };
}
async function fallback2D(canvas, piece) {
  const w = 480, h = 300; canvas.width = w; canvas.height = h;
  const { rgba } = await job('fallback', { piece, w, h, mask: MASK, series: piece === 'vessel' ? await series() : null });
  canvas.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0);
}

async function figurePlate(canvas) {
  const K = context(canvas); if (!K) return fallback2D(canvas, 'figure');
  const [w, h] = await size(canvas), { body, caustic } = await job('figure', { w, h }), P = FIGURE2, B = P.band;
  const bodyT = floatTex(K, w, h, body, 2, { filter: 'nearest' }), causT = floatTex(K, w, h, caustic, 3);
  const S = Math.min(720, w), L = Math.max(24, Math.round(B.height * h / 2.4)), bh = Math.round(B.height * h);
  const tube = target(K, w, bh), wall = target(K, w, h), crtP = program(K, CRT_FS), bandP = program(K, BAND_FS), glassP = program(K, GLASS_FS);
  const U = { ...glassUniforms(P.glass, h), u_bodyRes: [w, h], u_grain: 4 };
  let sigT = null, haloT = null, want = -1, have = -1, busy = false, drawn = -1;
  const request = held => { if (busy) return; busy = true; want = held;
    job('signal', { t: 1.3 + held * 0.1, seed: 27 + held, lines: L, samples: S }).then(r => {
      sigT = floatTex(K, S, L, r.data, 3, { tex: sigT }); haloT = floatTex(K, S, L, boxBlur(r.data, S, L, 6, { stride: 3, passes: 2 }), 3, { tex: haloT }); have = want; busy = false;
    }, e => { busy = false; console.error('signal:', e); }); };
  request(0);
  loop(canvas, t => {
    const frame = Math.floor(t * 30), held = Math.floor(frame / 3);
    if (held !== want) request(held);
    if (!sigT || (frame === drawn && have === want)) return; drawn = frame;
    pass(K, crtP, { out: tube, w, h: bh, textures: { u_sig: sigT, u_halo: haloT }, uniforms: { u_res: [w, bh], u_sigRes: [S, L], u_gamma: 2.4,
      u_spot: 0.33, u_bloom: 0.7, u_mask: 0.12, u_pitch: 3, u_halation: 0.14, u_curve: 0, u_vignette: 0, u_exposure: 1, u_bezel: [0, 0, 0], u_snow: B.snow * 0.8, u_frame: frame % 997 } });
    pass(K, bandP, { out: wall, w, h, textures: { u_tube: tube.tex }, uniforms: { u_res: [w, h], u_tubeRes: [w, bh], u_g0: hexLin(P.ground[0]), u_g1: hexLin(P.ground[1]), u_y: B.y, u_h: B.height, u_conv: B.converge } });
    pass(K, glassP, { w, h, textures: { u_bg: wall.tex, u_body: bodyT, u_caustic: causT }, uniforms: { ...U, u_res: [w, h], u_grainSeed: frame % 61 } });
  });
}

async function chorusPlate(canvas) {
  const K = context(canvas); if (!K) return fallback2D(canvas, 'chorus');
  const [w, h] = await size(canvas), { gl } = K, P = CHORUS2;
  // the sky, the word's glass layer and its body bake at half size (smooth fields, sampled with linear filtering), so
  // the plate is ready in a few seconds at 2650 px; the water and the refraction still run at full size on the GPU
  const bw = Math.round(w / 2), bh2 = Math.round(h / 2);
  const [r] = await Promise.all([job('chorus', { w: bw, h: bh2, mask: MASK }), job('seaInit', { w: bw, h: bh2, mask: MASK })]);
  const skyT = floatTex(K, bw, bh2, r.sky, 4); gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  const objT = floatTex(K, bw, bh2, r.layer, 4), bodyT = floatTex(K, bw, bh2, r.body, 2, { filter: 'nearest' });
  const waterP = program(K, WATER_FS), glassP = program(K, GLASS_FS), scene = target(K, w, h), [gx, gy] = r.grid;
  const S = { ...SHORE, ...P.shore, sun: { ...SHORE.sun, ...P.shore.sun } }, wob = new Float32Array(32);
  const GU = { ...glassUniforms({ ...P.glass, caustic: null }, h), u_bodyRes: [bw, bh2], u_soft: 1.2, u_grain: 3 };
  const sT = [null, null, null, null], upload = sl => sl.forEach((d, i) => { sT[i] = floatTex(K, gx, gy, d, 2, { wrap: 'repeat', tex: sT[i] }); });
  upload(r.slopes);
  let lastStep = 0, busy = false, fresh = true;
  loop(canvas, t => {
    const due = still ? 0 : Math.min(3, Math.round(t * 30) - lastStep);
    if (due > 0 && !busy) { busy = true; lastStep += due; job('seaStep', { n: due }).then(q => { upload(q.slopes); fresh = true; busy = false; }, e => { busy = false; console.error('sea:', e); }); }
    if (!fresh) return; fresh = false;
    pass(K, waterP, { out: scene, w, h, textures: { u_above: skyT, u_obj: objT, u_s0: sT[0], u_s1: sT[1], u_s2: sT[2], u_s3: sT[3] }, uniforms: {
      u_res: [w, h], u_hor: S.horizon, u_cam: S.camHeight, u_tile: S.tile, u_ripple: S.ripple, u_absorb: S.absorb, u_depthSlope: S.depthSlope,
      u_shore: S.shore, u_swash: S.swash, u_wet: S.wet, u_contact: P.contact * h, u_hasObj: 1, u_drawObj: 0, u_sunPow: S.sun.power, u_sunShine: S.sun.shine,
      u_t: t, u_deep: hexLin(S.deep), u_shallow: hexLin(S.shallow), u_sand: hexLin(S.sand), u_wetSand: hexLin(S.wetSand), u_sunC: hexLin(S.sun.colour),
      u_sunDir: sunDirection(S, w, h), u_grid: [gx, gy], u_wob: wob } });
    gl.bindTexture(gl.TEXTURE_2D, scene.tex); gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    pass(K, glassP, { w, h, textures: { u_bg: scene.tex, u_body: bodyT, u_caustic: bodyT }, uniforms: { ...GU, u_res: [w, h], u_grainSeed: lastStep % 61 } });
  });
}

async function vesselPlate(canvas) {
  const K = context(canvas); if (!K) return fallback2D(canvas, 'vessel');
  const [w, h] = await size(canvas), r = await job('vessel', { w, h, series: await series() }), P = VESSEL;
  const groundT = floatTex(K, w, h, r.ground, 4), innerT = floatTex(K, w, h, r.inner, 2, { filter: 'nearest' }), outerT = floatTex(K, w, h, r.outer, 2, { filter: 'nearest' });
  const causT = floatTex(K, w, h, r.caustic, 3), mid = target(K, w, h), glassP = program(K, GLASS_FS);
  const UI = { ...glassUniforms({ ...P.glass, glass: 'crown', gap: 0.05, caustic: null, rim: 0.15 }, h), u_bodyRes: [w, h], u_flip: 0 };
  const UO = { ...glassUniforms(P.glass, h), u_bodyRes: [w, h], u_grain: 3.5 };
  let drawn = -1;
  loop(canvas, t => {
    const f = Math.floor(t * 30); if (f === drawn) return; drawn = f;
    const breath = 1 + 0.06 * Math.sin(2 * Math.PI * t / (2 * BAR)); // two bars of the shared clock
    pass(K, glassP, { out: mid, w, h, textures: { u_bg: groundT, u_body: innerT, u_caustic: innerT }, uniforms: { ...UI, u_res: [w, h], u_gap: UI.u_gap * breath } });
    pass(K, glassP, { w, h, textures: { u_bg: mid.tex, u_body: outerT, u_caustic: causT }, uniforms: { ...UO, u_res: [w, h], u_gap: UO.u_gap * breath, u_grainSeed: f % 61 } });
  });
}

// The pane and the ribbons: whole stills from the worker at full DPR, drawn once into a 2D canvas.
async function stillPlate(canvas, piece) {
  const [w, h] = await size(canvas), { rgba } = await job('still', { piece, w, h });
  canvas.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0);
}

async function livePlate(sec) {
  const frame = sec.querySelector('iframe'), lens = sec.querySelector('.lens'), over = lens.querySelector('canvas');
  frame.src = new URLSearchParams(location.search).get('site') ?? new URL('../ui/directions/cs-max/index.html', import.meta.url).href;
  const build = async () => {
    for (let k = 0; k < 20 && sec.getBoundingClientRect().width < 8; k++) await new Promise(requestAnimationFrame);
    const pw = sec.getBoundingClientRect(), W = Math.round(pw.width), H = Math.round(W * 10 / 16), scale = 48;
    const k = Math.min(2, devicePixelRatio || 1), DW = Math.round(W * k), DH = Math.round(H * k);
    const d = await job('live', { w: DW, h: DH, scale: scale * k }); // offsets in device px; the filter works in CSS px
    const c = new OffscreenCanvas(DW, DH); c.getContext('2d').putImageData(new ImageData(d.map, DW, DH), 0, 0);
    const svg = document.getElementById('reed'), img = svg.querySelector('feImage');
    img.setAttribute('href', URL.createObjectURL(await c.convertToBlob({ type: 'image/png' }))); img.setAttribute('width', W); img.setAttribute('height', H);
    const [r1, g1, b1] = svg.querySelectorAll('feDisplacementMap');
    r1.setAttribute('scale', (scale * d.spread.r).toFixed(2)); g1.setAttribute('scale', scale); b1.setAttribute('scale', (scale * d.spread.b).toFixed(2));
    over.width = DW; over.height = DH; over.getContext('2d').putImageData(new ImageData(d.overlay, DW, DH), 0, 0);
    frame.style.transform = `scale(${W / 1600})`;
    const A = LIVE2.arch, cx = A.cx * W, hw = A.halfW * W, sp = A.top * H + hw;
    document.querySelector('#archclip path').setAttribute('d', `M${cx - hw},${H} L${cx - hw},${sp} A${hw},${hw} 0 0 1 ${cx + hw},${sp} L${cx + hw},${H} Z`);
  };
  await build();
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => build().catch(e => console.error('live:', e)), 250); });
}

const RUN = { figure: el => figurePlate(el.querySelector('canvas')), chorus: el => chorusPlate(el.querySelector('canvas')), vessel: el => vesselPlate(el.querySelector('canvas')), live: livePlate,
  pane: el => stillPlate(el.querySelector('canvas'), 'pane'), ribbons: el => stillPlate(el.querySelector('canvas'), 'ribbons') };
for (const el of document.querySelectorAll('[data-plate]')) {
  const kind = el.dataset.plate; el.dataset.state = 'busy';
  RUN[kind](el).then(() => { el.dataset.state = 'ready'; }, err => { el.dataset.state = 'failed'; console.error(`plate ${kind}:`, err); });
}
