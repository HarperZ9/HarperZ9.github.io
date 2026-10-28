// room/room.mjs: the type room. The word is a real input laid over the live canvas; materials, families and axes
// are controls drawn in their own media; exports are in exports.mjs. State: { family, text, loc }.
import { createLive, drawCanvas2D, shaderPath } from '../web/gl.mjs';
import { MATERIALS } from '../lib/materials.mjs';
import { instance, faceOf } from '../lib/program.mjs';
import { renderWord } from '../lib/render.mjs';
import { glyphContext } from '../lib/setline.mjs';
import { pngOf } from '../lib/encode.mjs';
import { browserDeflate } from '../../feed-23/build/brush/png.js';
import { openAny, readKeptSession, readPresets, KEEP_KEY, PRESET_KEY, LEGACY_WEIGHTS, session } from '../lib/legacy.mjs';
import { wireExports } from './exports.mjs';

const $ = (id) => document.getElementById(id);
const stage = $('stage'), word = $('word'), status = $('status');
const LAYER_SLOT = { glow: 'edge', offset: 'shadow', drift: 'motion', voice: 'sound' };
const SWATCH_SKIP = new Set(['voice']);
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { console.error('[room] storage read failed:', e); return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { console.error('[room] storage write failed:', e); } } };
const S = { family: null, text: 'Accession', loc: {}, families: [] };
let live = null, mode = 'canvas2d', animating = false;

const blob = async (R) => URL.createObjectURL(new Blob([await pngOf(R, browserDeflate, 'room')], { type: 'image/png' }));
async function paintInto(canvas, family, text, opt = {}) {
  const R = renderWord(family, text, canvas.width, canvas.height, opt).raster, img = new Image();
  img.src = await blob(R); await img.decode(); canvas.getContext('2d').drawImage(img, 0, 0); URL.revokeObjectURL(img.src);
}
const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 30));

function draw(t = 0) {
  if (!S.family) return;
  try {
    const r = live ? live.draw(S.family, S.text || ' ', { t, loc: S.loc }) : drawCanvas2D(stage, S.family, S.text || ' ', { t, loc: S.loc });
    stage.closest('.stage').classList.remove('refused'); status.textContent = r.missing?.length ? r.missing.join(' ') : '';
  } catch (e) {
    if (/refused/.test(e.message)) { stage.closest('.stage').classList.add('refused'); status.textContent = e.message.replace(/^skeleton refused: /, ''); }
    else { console.error('[room] draw failed:', e); status.textContent = e.message; }
  }
  fitWord();
}

// Lay the input over the drawn word: the same size per em and the same centre.
function fitWord() {
  const inst = instance(S.family, S.loc), fc = faceOf(inst); if (fc.refused) return;
  const g = glyphContext(fc, S.text || ' ', stage.width, stage.height, { fill: 0.82 }), k = stage.clientWidth / stage.width;
  word.style.fontSize = `${g.size * k}px`;
  word.style.fontWeight = String(Math.round(inst.skeleton.weight ?? 700));
}

function moving() { const b = instance(S.family, S.loc).bindings; return !!(b.motion || b.fill.material === 'crt' && (b.fill.params?.snow ?? 0.03) > 0); }
function startClock() {
  if (animating || !moving() || matchMedia('(prefers-reduced-motion: reduce)').matches || !window.UIShell?.clock) return;
  animating = true; const t0 = performance.now();
  const off = window.UIShell.clock.subscribe(() => { if (!moving()) { animating = false; off?.(); return; } draw((performance.now() - t0) / 1000); });
}

// Backing store: device pixels on the shader path; one pixel per CSS pixel when the CPU draws the material.
function sizeStage(f) {
  const css = stage.getBoundingClientRect(), dpr = live && shaderPath(instance(f, S.loc)) ? Math.min(2, devicePixelRatio || 1) : 1;
  const w = Math.min(2880, Math.round(css.width * dpr)), h = Math.round(w * css.height / Math.max(1, css.width));
  if (stage.width !== w || stage.height !== h) { stage.width = w; stage.height = h; }
}

function setFamily(f, { text, loc } = {}) {
  sizeStage(f);
  S.family = f; S.loc = loc ?? {}; if (text) { S.text = text; word.value = text; }
  for (const b of document.querySelectorAll('#families button')) b.setAttribute('aria-pressed', String(b.dataset.id === f.id));
  syncSwatches(); buildAxes(); draw(); startClock(); idle(proof); keep();
  $('listen').hidden = !instance(f, S.loc).bindings.sound;
}
function keep() { store.set('typeengine.session.v1', JSON.stringify(session(S.family, S.text, S.loc))); }

// A thumbnail is drawn once, so it ships as a picture: painted on a canvas that never joins the page, then kept as an
// image. Twenty-six live canvases on this page became twenty-six images (the site's performance budget allows three).
// A thumbnail is drawn once, so it ships as a picture: the engine's raster becomes an image, with no canvas at all.
// The image holds its place (its size known up front) before the picture arrives, so nothing shifts.
function stillInto(button, w, h, family, text, opt = {}) {
  const img = new Image(w, h); img.alt = ''; img.decoding = 'async'; button.append(img);
  return blob(renderWord(family, text, w, h, opt).raster).then((url) => { img.src = url; });
}

// Materials: each swatch is the letter drawn in that material, at twice its 64 px slot. Families draw at twice 320 by 84. Fill materials replace the fill; layer materials toggle.
async function buildSwatches() {
  const box = $('materials'), probe = { schema: 'typeengine.family/1', id: 'swatch', name: 'Swatch', skeleton: { source: 'accession', style: 'display', weight: 800 },
    inputs: { 'data.series': { values: [3, 6, 2, 8, 5, 9, 4] }, 'sound.pcm': { source: 'phrase' } } };
  for (const m of MATERIALS.values()) {
    if (SWATCH_SKIP.has(m.id)) continue;
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.material = m.id; b.setAttribute('aria-label', m.title); b.setAttribute('aria-pressed', 'false');
    box.append(b);
    const slot = LAYER_SLOT[m.id] ?? 'fill', fam = { ...probe, bindings: slot === 'fill' ? { fill: { material: m.id } } : { fill: { material: 'ink', params: { color: '#8f877a' } }, [slot]: { material: m.id } } };
    idle(() => stillInto(b, 192, 192, fam, 'a', { size: 156, t: 0.6 }).catch((e) => console.error(`[room] swatch ${m.id}:`, e)));
    b.addEventListener('click', () => {
      const f = structuredClone(S.family); f.id = f.id.replace(/(-mix)?$/, '-mix');
      if (slot === 'fill') f.bindings.fill = { material: m.id };
      else if (f.bindings[slot]?.material === m.id) delete f.bindings[slot]; else f.bindings[slot] = { material: m.id };
      setFamily(f, { loc: S.loc });
    });
  }
}
function syncSwatches() {
  const b = instance(S.family, S.loc).bindings;
  for (const el of document.querySelectorAll('#materials button')) {
    const id = el.dataset.material, slot = LAYER_SLOT[id] ?? 'fill';
    el.setAttribute('aria-pressed', String(b[slot]?.material === id));
  }
}

// Axes: a range input whose track is a strip of the word drawn at seven points along the axis.
function buildAxes() {
  const box = $('axes'); box.replaceChildren();
  const axes = [...(S.family.axes ?? [])];
  for (const a of axes) {
    const r = document.createElement('input'); r.type = 'range'; r.min = a.min; r.max = a.max; r.step = (a.max - a.min) / 200;
    r.value = S.loc[a.tag] ?? a.default; r.setAttribute('aria-label', a.name); r.setAttribute('aria-valuetext', `${a.name} ${(+r.value).toFixed(2)}`);
    r.addEventListener('input', () => { S.loc = { ...S.loc, [a.tag]: +r.value }; r.setAttribute('aria-valuetext', `${a.name} ${(+r.value).toFixed(2)}`); draw(); });
    r.addEventListener('change', () => { idle(proof); keep(); });
    box.append(r); idle(() => strip(r, a));
  }
  if (S.family.skeleton.source === 'zain-mint') {
    const row = document.createElement('div'); row.className = 'shelf';
    for (const [name, v] of Object.entries(LEGACY_WEIGHTS)) { const b = document.createElement('button'); b.type = 'button'; b.className = 'stamp-btn'; b.textContent = name; b.addEventListener('click', () => { S.loc = { ...S.loc, STEM: v }; buildAxes(); draw(); keep(); }); row.append(b); }
    box.append(row);
  }
}
async function strip(input, a) {
  const c = document.createElement('canvas'); c.width = 840; c.height = 60; const ctx = c.getContext('2d'), plain = { ...S.family, bindings: { fill: { material: 'ink', params: { color: getComputedStyle(document.documentElement).getPropertyValue('--soft').trim() || '#4a443b' } } } };
  plain.ground = getComputedStyle(document.documentElement).getPropertyValue('--wall').trim() || '#e8e3d9';
  for (let i = 0; i < 7; i++) {
    const v = a.min + ((a.max - a.min) * i) / 6, cell = document.createElement('canvas'); cell.width = 120; cell.height = 60;
    try { await paintInto(cell, plain, 'Rag', { loc: { ...S.loc, [a.tag]: v }, size: 40 }); ctx.drawImage(cell, i * 120, 0); } catch (e) { if (!/refused/.test(e.message)) console.error('[room] axis strip:', e); } // a refused point stays an empty cell, as the old desk greyed it
  }
  input.style.setProperty('--strip', `url(${c.toDataURL()})`);
}

async function proof() { const pc = $('proof'), r = pc.getBoundingClientRect(); if (r.width) { pc.width = Math.min(2880, Math.round(r.width * Math.min(2, devicePixelRatio || 1))); pc.height = Math.round(pc.width / 10); }
  try { await paintInto($('proof'), S.family, 'abcdefghijklmnopqrstuvwxyz 0123456789', { loc: S.loc, fill: 0.94 }); $('proof-wrap').setAttribute('aria-label', 'abcdefghijklmnopqrstuvwxyz 0123456789'); } catch (e) { console.error('[room] proof:', e); } }

async function buildFamilies() {
  const idx = await fetch('../families/index.json').then((r) => (r.ok ? r.json() : { families: [] })).catch((e) => { console.error('[room] families index:', e); return { families: [] }; });
  const list = [];
  for (const id of idx.families) { const f = await fetch(`../families/${id}.json`).then((r) => r.json()); list.push(f); }
  const kept = store.get(KEEP_KEY); if (kept) { const k = readKeptSession(kept); if (k.ok) list.push({ ...k.family, name: 'Kept' }); }
  const pre = store.get(PRESET_KEY); if (pre) for (const p of readPresets(pre)) list.push({ ...p.family, name: p.name });
  S.families = list;
  const box = $('families');
  for (const f of list) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.id = f.id; b.setAttribute('aria-label', f.name); b.setAttribute('aria-pressed', 'false');
    box.append(b);
    b.addEventListener('click', () => setFamily(structuredClone(f)));
    idle(() => stillInto(b, 640, 168, f, f.name.split(' ')[0], { fill: 0.86 }).catch((e) => console.error(`[room] family ${f.id}:`, e)));
  }
  return list;
}

async function boot() {
  live = (() => { try { return createLive(stage); } catch (e) { console.error('[room] WebGL2 failed, using Canvas 2D:', e); return null; } })();
  mode = live ? 'webgl2' : 'canvas2d'; document.documentElement.dataset.renderer = mode;
  const list = await buildFamilies();
  let start = list[0], text = S.text, loc = {};
  const mine = store.get('typeengine.session.v1'); if (mine) { const o = openAny(mine); if (o.ok) { start = o.family; text = o.text || text; loc = o.loc ?? {}; } }
  const q = new URLSearchParams(location.search).get('family'); if (q) start = list.find((f) => f.id === q) ?? start;
  await buildSwatches();
  setFamily(structuredClone(start), { text, loc });
  word.addEventListener('input', () => { S.text = word.value; draw(); idle(keep); });
  addEventListener('resize', () => { sizeStage(S.family); draw(); });
  $('open').addEventListener('change', async (e) => { const file = e.target.files[0]; if (!file) return; const o = openAny(await file.text()); if (o.ok) setFamily(o.family, { text: o.text || S.text, loc: o.loc }); else status.textContent = o.reason; });
  wireExports({ S, stage, draw, live: () => live });
}
boot().catch((e) => { console.error('[room] boot failed:', e); status.textContent = e.message; });
