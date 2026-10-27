// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// app.js: the live visualizer. The same features (lib/features.mjs, in a worker), the same drives
// (lib/drive.mjs, the settings file's own list) and the same scene as the offline renderer, drawn in WebGL2:
// caustics at half size, the floor and its lens at full size, the glass module's GLASS_FS for the ribbons
// (their body swept in a worker), and the figure, spectrum and timeline on a 2D canvas above. Text lives in the DOM.
// Clock: the AudioContext's, less its output latency, so the picture shows what is being heard.
// Reduced motion: the picture holds still (no ripples, no drift); text still updates.
// The meter figure is drawn under the glass, as offline: its lines go into the floor target before the glass pass.
import { context, program, floatTex, imageTex, pass } from '../../glass/lib/gl.js';
import { GLASS_FS } from '../../glass/lib/shaders.js';
import { channelIor } from '../../glass/lib/optics.js';
import { hexLin } from '../../glass/lib/raster.js';
import { CAUSTIC_FS, FLOOR_FS, BODYUP_FS, ADD_FS } from './shaders.js';
import { spectrum, SEABED } from '../render/seabed.mjs';
import { RIBBONS } from '../render/ribbons.mjs';
import { compileDrives } from '../lib/drive.mjs';
import { barGeometry } from '../render/meter.mjs';
import { hudModel } from '../render/hud-model.mjs';
import { infoToggle } from './info.js';

const $ = id => document.getElementById(id);
const STILL = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MEDIA = {
  hum: '../../sound/theme/assets/hum3.opus', sax: 'media/cc0-alto-sax-iluppai.opus', satie: 'media/pd-satie-gymnopedie3.opus',
  cpi: 'media/cpi-sonified.opus', cpiData: '../../dataviz/data/cpi-annual.json',
};
const BANDS = ['sub', 'low', 'lowmid', 'mid', 'presence', 'air'];
const settings = await (await fetch('../settings.json')).json();
const gains = Object.fromEntries(BANDS.map(b => [b, 1]));

// ---------- workers
function worker(role) {
  const W = new Worker(new URL('./workers.js', import.meta.url), { type: 'module' }); let busy = null;
  const call = (msg, transfer = []) => new Promise((res, rej) => { busy = { res, rej }; W.postMessage({ role, ...msg }, transfer); });
  W.onmessage = e => { const b = busy; busy = null; if (!b) return; e.data.ok ? b.res(e.data) : b.rej(new Error(e.data.error)); };
  return { call, get busy() { return !!busy; } };
}
const analyser = worker('analyse'), waterW = worker('water'), bodyW = worker('body');

// ---------- audio
let actx = null, buffer = null, src = null, startedAt = 0, offset = 0, playing = false;
const clock = () => (playing ? Math.max(0, actx.currentTime - startedAt + offset - (actx.outputLatency || 0) - (actx.baseLatency || 0)) : offset);
function play() {
  if (!buffer) return; actx ??= new AudioContext(); actx.resume();
  src = actx.createBufferSource(); src.buffer = buffer; src.connect(actx.destination);
  src.onended = () => { if (playing && clock() >= buffer.duration - 0.05) { stop(); offset = 0; } };
  src.start(0, offset); startedAt = actx.currentTime; playing = true; syncPlay();
}
function stop() { if (src) { src.onended = null; try { src.stop(); } catch {} src = null; } if (playing) offset = clock(); playing = false; syncPlay(); }
function syncPlay() { $('play').setAttribute('aria-pressed', String(playing)); $('playLabel').textContent = playing ? 'Pause' : 'Play'; $('status').textContent = playing ? 'Playing' : 'Paused'; }

// ---------- source
let F = null, D = null, grid = null, meta = null;
async function load(id, file = null) {
  stop(); offset = 0; $('status').textContent = 'Reading the source';
  actx ??= new AudioContext();
  const S = settings.sources[id] ?? { kind: 'audio', title: file?.name ?? 'a file', credit: ['read on this device; nothing leaves it'] };
  let bytes;
  if (id === 'cpi') {
    const doc = await (await fetch(MEDIA.cpiData)).json(), rows = doc.rows.filter(r => r[S.column] != null);
    const r = await analyser.call({ kind: 'series', values: rows.map(r => r[S.column]), labels: rows.map(r => r[S.label]), unit: S.unit, name: S.title, duration: S.duration, group: S.group, groupAlign: S.groupAlign });
    F = r.F; F.rows = rows;
    try { bytes = await (await fetch(MEDIA.cpi)).arrayBuffer(); buffer = await actx.decodeAudioData(bytes); } catch { buffer = actx.createBuffer(1, Math.ceil(F.duration * 48000), 48000); }
  } else {
    bytes = file ? await file.arrayBuffer() : await (await fetch(MEDIA[id])).arrayBuffer();
    buffer = await actx.decodeAudioData(bytes);
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c).slice());
    const r = await analyser.call({ kind: 'audio', rate: buffer.sampleRate, channels }, channels.map(c => c.buffer)); F = r.F;
  }
  D = compileDrives(F, settings.drives.filter(d => d.node !== 'clock'));
  grid = { beats: F.beats, downbeats: F.downbeats, beatsPerBar: F.meter.beatsPerBar, onsets: F.onsets.map(t => ({ t, vel: 0.5 })) };
  await waterW.call({ grid, figure: figureNow(), water: settings.scene.water, onsets: F.onsets.map(t => ({ t, vel: Math.min(1, F.series.flux[Math.min(F.n - 1, Math.round(t * F.fps))]) })) });
  meta = { S, hud: { hud: { title: S.title, credit: S.credit, definitions: F.kind === 'series' ? settings.hud.seriesDefinitions : settings.hud.definitions, defineEvery: F.kind === 'series' ? 1 : settings.hud.defineEvery, digits: S.digits, seriesCaption: S.seriesCaption,
    derived: S.derived && F.rows ? i => { const v = F.rows[i]?.[S.derived]; return v == null ? null : `${Math.round(v)} cents left of a 1913 dollar`; } : null } } };
  $('credit').textContent = (S.credit ?? []).join('\n');
  timeline = null; waterU = null; bodyKey = '';
  $('status').textContent = `${S.title}: ${F.kind === 'series' ? `${F.values.length} observations` : `${F.tempo.bpm.toFixed(1)} BPM, ${F.meter.identified ? `${F.meter.beatsPerBar} beats a bar` : 'bar not identified'}`}`;
  frameDirty = true;
}

// ---------- GL
const art = $('art'), ink = $('ink');
const K = context(art, { preserveDrawingBuffer: false });
let W = 0, H = 0, DPR = 1, causRT = null, floorRT = null, bodyRT = null, waterT = null, bodySrcT = null;
const P = K && { caus: program(K, CAUSTIC_FS), floor: program(K, FLOOR_FS), up: program(K, BODYUP_FS), glass: program(K, GLASS_FS), add: program(K, ADD_FS) };
let figCanvas = null, figT = null;
// display-p3 (R5): the overlay's CSS colours are converted on draw, so asking for P3 is safe on an sRGB display too
const g2 = ink.getContext('2d', { colorSpace: 'display-p3' }) ?? ink.getContext('2d');
const WAVES = spectrum(SEABED.seed);
function floatTarget(w, h, internal, format, mips = false) {
  const { gl } = K, tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, internal === gl.SRGB8_ALPHA8 ? gl.UNSIGNED_BYTE : gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (mips) gl.generateMipmap(gl.TEXTURE_2D);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, w, h };
}
function resize() {
  // full device pixel ratio (QUALITY-SPEC R1); the caustic map is solved at half size, as offline
  DPR = Math.min(3, devicePixelRatio || 1); W = Math.round(innerWidth * DPR); H = Math.round(innerHeight * DPR);
  for (const c of [art, ink]) { c.width = W; c.height = H; }
  if (K) {
    const { gl } = K;
    causRT = floatTarget(Math.round(W / 2), Math.round(H / 2), gl.RGBA16F, gl.RGBA, true);
    floorRT = floatTarget(W, H, gl.SRGB8_ALPHA8, gl.RGBA);
    bodyRT = floatTarget(W, H, gl.RGBA16F, gl.RGBA);
  }
  bodyKey = ''; frameDirty = true; placePlay();
}
function placePlay() {
  const f = figureNow(), r = f.r * innerHeight, b = $('play');
  Object.assign(b.style, { left: `${f.cx * innerWidth - r}px`, top: `${f.cy * innerHeight - r}px`, width: `${2 * r}px`, height: `${2 * r}px` });
}

// ---------- layout: the offline frame is 16:9; a portrait or square window keeps the figure inside the width
function figureNow() {
  const f = settings.scene.figure, a = innerWidth / innerHeight;
  if (a >= 1.2) return { ...f, aspect: a };
  return { ...f, cx: 0.5, cy: 0.44, r: Math.min(f.r, 0.34 * a), aspect: a };
}
function ribbonsNow() {
  const f = figureNow(), sc = settings.scene.ribbons, k = f.r / settings.scene.figure.r;
  return { ...sc, cx: f.cx, cy: f.cy, inner: sc.inner * k, outer: sc.outer * k };
}

// ---------- per frame
let waterU = null, waterInfo = null, bodyKey = '', bodyPending = false, lastBody = 0, frameDirty = true, timeline = null, lastHud = '';
function driveAt(t) {
  const v = D ? D.at(t) : {};
  // band gains scale how far a band-driven parameter moves from the bottom of its range
  for (const d of settings.drives) if (BANDS.includes(d.from) && v[d.node]?.[d.param] !== undefined && d.range) { const g = gains[d.from]; v[d.node][d.param] = d.range[0] + g * (v[d.node][d.param] - d.range[0]); }
  return v;
}
function requestWater(t) {
  if (STILL || waterW.busy || !F) return;
  waterW.call({ t, ny: Math.round(192 * innerHeight / innerWidth) }).then(r => { waterU = r.u; waterInfo = r; }).catch(e => console.error('water', e));
}
function requestBody(v, t) {
  if (bodyW.busy || !F) return;
  const g = v.glass ?? {}, key = [g.swirl, g.thickness, g.breathe, g.striae].map(x => (x ?? 0).toFixed(3)).join('/');
  const now = performance.now(); if (key === bodyKey || now - lastBody < 80) return;   // the layout clock: at most 12 Hz
  const bw = Math.min(960, Math.round(W / 2)), bh = Math.round(bw * H / W), sc = ribbonsNow();
  lastBody = now; bodyKey = key;
  bodyW.call({ size: [bw, bh] }).then(() => bodyW.call({ key, params: { ...sc, swirl: g.swirl ?? 0, breathe: g.breathe ?? 0, body: { thickness: g.thickness ?? sc.thickness, width: sc.width, striae: Math.round(g.striae ?? sc.striae) } } }))
    .then(r => { bodySrcT = floatTex(K, r.w, r.h, r.rg, 2, { tex: bodySrcT }); bodySrcT.w = r.w; bodySrcT.h = r.h; frameDirty = true; }).catch(e => console.error('body', e));
}

function drawGL(t, v) {
  const { gl } = K, sb = { ...SEABED, ...settings.scene.seabed, ...(v.sea ?? {}) }, cw = causRT.w, ch = causRT.h;
  if (waterU) { waterT = floatTex(K, waterInfo.nx, waterInfo.ny, waterU, 1, { tex: waterT, filter: 'nearest' }); waterU = null; }
  const wave = new Float32Array(128), amp = new Float32Array(32);
  WAVES.forEach((q, i) => { wave.set([q.kx, q.ky, q.L, q.ph], i * 4); amp[i] = q.amp; });
  gl.bindFramebuffer(gl.FRAMEBUFFER, causRT.fb); gl.viewport(0, 0, cw, ch); gl.useProgram(P.caus.p);
  gl.uniform4fv(P.caus.u('u_wave'), wave); gl.uniform1fv(P.caus.u('u_amp'), amp);
  pass(K, P.caus, { out: causRT, w: cw, h: ch, textures: waterT ? { u_water: waterT } : {}, uniforms: { u_res: [cw, ch], u_waterRes: [waterInfo?.nx ?? 1, waterInfo?.ny ?? 1], u_has: waterT ? 1 : 0,
    u_t: STILL ? 0 : t, u_lam: sb.fineScale * ch, u_speed: sb.fineSpeed, u_fine: sb.fine, u_simGain: sb.sim ?? sb.simGain, u_focus: sb.focus * ch / 40, u_floor: sb.floor } });
  gl.bindTexture(gl.TEXTURE_2D, causRT.tex); gl.generateMipmap(gl.TEXTURE_2D);
  const st = [settings.scene.seabed.deep, settings.scene.seabed.low, settings.scene.seabed.mid, settings.scene.seabed.light].map(hx => { const n = parseInt(hx.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(x => x / 255); });
  pass(K, P.floor, { out: floorRT, w: W, h: H, textures: { u_caus: causRT.tex, ...(waterT ? { u_water: waterT } : {}) }, uniforms: { u_res: [W, H], u_causRes: [cw, ch],
    u_waterRes: [waterInfo?.nx ?? 1, waterInfo?.ny ?? 1], u_hasW: waterT && !STILL ? 1 : 0, u_crest: sb.crest ?? 0, u_crestLevel: sb.crestLevel ?? 0.3, u_crestC: hexLin(SEABED.crestColour), u_s0: st[0], u_s1: st[1], u_s2: st[2], u_s3: st[3],
    u_gain: 1, u_light: 0.8, u_relief: 0.16, u_caustic: sb.caustic, u_exposure: sb.exposure, u_depth: sb.depth, u_contrast: sb.contrast } });
  const R = RIBBONS.glass, sigma = hexLin(R.tint).map(x => -Math.log(Math.max(1e-4, x)) * R.density / 100);
  // the figure under the glass: added as light into the floor target, then refracted by the glass pass
  figT = imageTex(K, figCanvas, { tex: figT });
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  pass(K, P.add, { out: floorRT, w: W, h: H, textures: { u_fig: figT }, uniforms: { u_res: [W, H], u_box: figBox, u_gain: settings.scene.phosphor?.gain ?? 0.9 } });
  gl.disable(gl.BLEND);
  if (bodySrcT) pass(K, P.up, { out: bodyRT, w: W, h: H, textures: { u_src: bodySrcT }, uniforms: { u_res: [W, H], u_srcRes: [bodySrcT.w, bodySrcT.h] } });
  pass(K, P.glass, { w: W, h: H, textures: { u_bg: floorRT.tex, u_body: bodyRT.tex, u_caustic: floorRT.tex }, uniforms: {
    u_res: [W, H], u_bodyRes: [W, H], u_n: channelIor(R.glass, 1), u_sigma: sigma, u_zen: hexLin(R.env.zenith), u_hor: hexLin(R.env.horizon), u_gnd: hexLin(R.env.ground),
    u_key: R.key.dir, u_keyPow: R.key.power, u_keyShine: R.key.shine, u_gap: R.gap * H, u_thick: bodySrcT ? W / bodySrcT.w : 1, u_rim: R.rim, u_ck: 0, u_light: [0, 0], u_hasC: 0,
    u_soft: 1, u_flip: 1, u_grain: settings.scene.finish.grain.sd, u_grainSeed: Math.floor(t * 24) % 61 } });
}

// The meter figure's lines (bar polygon, earlier bars, the path travelled) as light on a transparent canvas.
function drawFigure(c, g, s) {
  const X = ([x, y]) => [x * W, y * H], inkC = settings.scene.ink;
  const path = (pts, closed) => { c.beginPath(); pts.forEach((p, i) => { const [x, y] = X(p); i ? c.lineTo(x, y) : c.moveTo(x, y); }); if (closed) c.closePath(); };
  c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = 'rgba(200, 220, 255, 0.55)'; c.shadowBlur = 6 * s; c.strokeStyle = inkC;
  for (const hh of g.history) { c.globalAlpha = 0.8 * hh.alpha; c.lineWidth = Math.max(1, 1 * s); path(hh.verts, true); c.stroke(); }
  c.globalAlpha = 0.8; c.lineWidth = Math.max(1, 1.25 * s); path(g.verts, true); c.stroke();
  c.globalAlpha = 1; c.lineWidth = Math.max(1, 1.6 * s); path([...g.verts.slice(0, g.beat + 1), g.pos], false); c.stroke();
  c.shadowBlur = 0; c.globalAlpha = 1;
}
// Only the figure's bounding box is drawn and uploaded (a full-frame upload at 2x DPR cost 50 ms a frame).
let figBox = [0, 0, 1, 1];
function figureLayer(t) {
  const f = figureNow(), g = barGeometry(grid, t, f), s = Math.min(H / 1080, W / 1080), pad = 24 * s;
  const x0 = Math.max(0, Math.floor(f.cx * W - f.r * H - pad)), y0 = Math.max(0, Math.floor(f.cy * H - f.r * H - pad));
  const bw = Math.min(W - x0, Math.ceil(2 * f.r * H + 2 * pad)), bh = Math.min(H - y0, Math.ceil(2 * f.r * H + 2 * pad));
  if (!figCanvas || figCanvas.width !== bw || figCanvas.height !== bh) figCanvas = new OffscreenCanvas(bw, bh);
  const fc = figCanvas.getContext('2d'); fc.setTransform(1, 0, 0, 1, 0, 0); fc.clearRect(0, 0, bw, bh); fc.translate(-x0, -y0);
  drawFigure(fc, g, s);
  figBox = [x0, y0, bw, bh];
}

function drawInk(t) {
  const c = g2, s = Math.min(H / 1080, W / 1080), g = barGeometry(grid, t, figureNow()), X = ([x, y]) => [x * W, y * H];
  c.clearRect(0, 0, W, H); c.lineCap = 'round'; c.lineJoin = 'round';
  const inkC = settings.scene.ink, amber = settings.scene.amber;
  if (!K) drawFigure(c, g, s);   // no WebGL: the figure goes on the overlay instead of under the glass
  // labels: beat numbers at the vertices and the inter-onset time outside the current edge
  const M = hudModel(F, t, g, meta.hud), [cx, cy] = g.centre;
  c.font = `${Math.max(12, Math.round(12 * s)) * 1}px "Accession Mono"`; c.textAlign = 'center'; c.fillStyle = inkC;
  for (const L of M.figure) {
    const [u, v] = L.at, dx = (u - cx) * (W / H), dy = v - cy, d = Math.hypot(dx, dy) || 1, k = L.anchor === 'vertex' ? 18 : 30;
    c.globalAlpha = L.anchor === 'vertex' ? 0.7 : 0.6; c.fillText(L.text, u * W + dx / d * k * s, v * H + dy / d * (L.anchor === 'vertex' ? 18 : 26) * s + 4 * s);
  }
  // the hot mark
  const [px, py] = X(g.pos); c.globalAlpha = 1; c.fillStyle = amber; c.shadowColor = amber; c.shadowBlur = 10 * s;
  if (F.kind !== 'series') { c.beginPath(); c.arc(px, py, 4.2 * s, 0, 7); c.fill(); c.shadowBlur = 0; c.strokeStyle = amber; c.globalAlpha = 0.55; c.lineWidth = Math.max(1, s); c.beginPath(); c.arc(px, py, 9 * s, 0, 7); c.stroke(); }
  else { c.shadowBlur = 0; c.fillStyle = inkC; c.globalAlpha = 0.9; c.beginPath(); c.arc(px, py, 3.2 * s, 0, 7); c.fill(); }
  c.shadowBlur = 0;
  // the spectrum (or the series) above the drive gains, and the loudness line as the timeline
  const br = $('bands').getBoundingClientRect(), bx = br.left * DPR, bw = br.width * DPR, by = br.bottom * DPR, bh = br.height * DPR;
  c.globalAlpha = 0.75; c.strokeStyle = inkC; c.lineWidth = Math.max(1, s);
  if (M.corners.br.kind === 'spectrum') {
    const row = M.corners.br.row; c.beginPath(); row.forEach((db, i) => { const x = bx + bw * i / (row.length - 1), y = by - bh * Math.max(0, Math.min(1, (db + 84) / 72)); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
    // six gain ticks: the height of each band's tick is its gain
    c.globalAlpha = 0.4; BANDS.forEach((b, i) => { const x = bx + bw * (i + 0.5) / 6; c.beginPath(); c.moveTo(x, by); c.lineTo(x, by - bh * 0.5 * gains[b] / 2); c.stroke(); });
  } else {
    const { values, range: [lo, hi], frac } = M.corners.br, n = values.length, Xs = i => bx + bw * i / (n - 1), Ys = v => by - bh * (v - lo) / (hi - lo || 1);
    c.beginPath(); values.forEach((v, i) => (i ? c.lineTo(Xs(i), Ys(v)) : c.moveTo(Xs(i), Ys(v)))); c.stroke();
    const i0 = Math.floor(frac), v0 = values[i0] + (values[Math.min(n - 1, i0 + 1)] - values[i0]) * (frac - i0);
    c.globalAlpha = 1; c.fillStyle = amber; c.beginPath(); c.arc(Xs(frac), Ys(v0), 3.2 * s, 0, 7); c.fill();
  }
  c.globalAlpha = 0.5; c.beginPath(); c.moveTo(bx, by + 0.5); c.lineTo(bx + bw, by + 0.5); c.stroke();
  const mg = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mg')) || 40, tx0 = mg * DPR, tx1 = W - mg * DPR, ty = H - mg * 0.35 * DPR;
  timeline ??= Array.from({ length: 400 }, (_, i) => F.series.lufsS[Math.min(F.n - 1, Math.round(i / 399 * (F.n - 1)))]);
  c.globalAlpha = 0.35; c.beginPath(); timeline.forEach((v, i) => { const x = tx0 + (tx1 - tx0) * i / 399, y = ty - 10 * s * Math.max(0, Math.min(1, (v + 40) / 32)); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
  const ph = tx0 + (tx1 - tx0) * Math.min(1, t / F.duration); c.globalAlpha = 0.8; c.beginPath(); c.moveTo(ph, ty - 12 * s); c.lineTo(ph, ty + 2 * s); c.stroke();
  c.globalAlpha = 1;
  return M;
}

function updateHud(M) {
  const key = JSON.stringify([M.corners.tr, M.corners.bl, M.corners.br.readout ?? M.corners.br.caption]);
  if (key === lastHud) return; lastHud = key;
  $('v0').textContent = M.corners.tr[0]?.text ?? ''; $('v1').textContent = M.corners.tr[1]?.text ?? ''; $('v2').textContent = M.corners.tr[2]?.text ?? '';
  const d = M.corners.bl; $('term').textContent = d?.term ?? ''; $('def').textContent = d?.text ?? ''; $('defsrc').textContent = d?.source ?? '';
  $('readout').textContent = M.corners.br.readout ?? M.corners.br.caption ?? '';
  $('seek').value = String(Math.round(1000 * Math.min(1, clock() / F.duration)));
}

let lastT = -1;
function frame() {
  requestAnimationFrame(frame);
  if (!F || !meta) return;
  const t = clock();
  if (STILL && !frameDirty && Math.abs(t - lastT) < 1e-6) { updateHud(hudModel(F, t, barGeometry(grid, t, figureNow()), meta.hud)); return; }
  lastT = t; frameDirty = false;
  const v = driveAt(t);
  requestWater(t); requestBody(v, t);
  if (K) { figureLayer(t); drawGL(t, v); }
  updateHud(drawInk(t));
}

// ---------- controls made of the media
$('play').addEventListener('click', () => (playing ? stop() : play()));
$('seek').addEventListener('input', e => { const was = playing; stop(); offset = (+e.target.value / 1000) * (F?.duration ?? 0); frameDirty = true; if (was) play(); });
$('source').addEventListener('change', e => { if (e.target.value === 'file') $('file').click(); else load(e.target.value); });
$('file').addEventListener('change', e => { const f = e.target.files?.[0]; if (f) load('file', f); });
addEventListener('keydown', e => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); playing ? stop() : play(); } });
for (const b of BANDS) {
  const i = document.createElement('input'); Object.assign(i, { type: 'range', min: '0', max: '200', value: '100', step: '1' });
  i.setAttribute('aria-label', `${b} band drive, percent`);
  i.addEventListener('input', () => { gains[b] = +i.value / 100; frameDirty = true; });
  $('bands').append(i);
}
$('settings').addEventListener('click', () => {
  const out = structuredClone(settings);
  out.drives = out.drives.map(d => (BANDS.includes(d.from) && d.range && gains[d.from] !== 1 ? { ...d, range: [d.range[0], d.range[0] + gains[d.from] * (d.range[1] - d.range[0])] } : d));
  $('settings').href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
});
infoToggle($('info'));
addEventListener('resize', () => { resize(); if (F && !waterW.busy) waterW.call({ grid, figure: figureNow(), water: settings.scene.water, onsets: F.onsets.map(t => ({ t, vel: 0.6 })) }); });
resize();
await load(new URLSearchParams(location.search).get('source') ?? 'hum');
const t0 = +(new URLSearchParams(location.search).get('t') ?? 0); if (t0) offset = t0;
requestAnimationFrame(frame);
