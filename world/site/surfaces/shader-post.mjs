// shader-post.mjs: the picture rack of the shader room. It is the Retro Engine's pipeline (system/retro-studio.js),
// carried into the room: the frame the stack draws goes through the hardware palette, the pixel grid, the dither and
// the tube (system/media-engine/plugins/retro.mjs), then through the effects rack (system/glitch-ops.js), then
// through video feedback, into a 2D canvas the room shows in place of the WebGL frame.
//
// One thing is new: the rack has an amount. At 0 the room shows the stack's own frame and nothing here runs; between 0
// and 1 the tube's picture and the plain frame blend, so the retro look fades in over the shader instead of switching on.
// Every other number keeps the studio's meaning, its range and its default, so a patch reads the same in both.
//
// The modules load on the first use of the rack (ready()), by address, so the room's press stays light.
export const RACK_URLS = Object.freeze({ retro: '/system/media-engine/plugins/retro.mjs', ops: '/system/glitch-ops.js', mod: '/system/mod-matrix.js', pal: '/system/retro-palettes.js', engine: '/system/retro-engine.js?v=20261003-worker' });

export const PALETTES = Object.freeze([['outrun', 'Outrun (custom)'], ['gameboy', 'Game Boy DMG'], ['nes', 'NES'], ['c64', 'Commodore 64'], ['zx', 'ZX Spectrum'], ['ega', 'EGA 16'], ['cga', 'CGA 4'],
  ['teletext', 'Teletext 8'], ['pico8', 'PICO-8'], ['vboy', 'Virtual Boy (red)'], ['amber', 'Amber phosphor'], ['mono1', '1-bit mono'], ['aurora', 'Aurora (custom)'], ['auto', 'Auto (from the picture)'], ['yours', 'Your palette']]);
export const DITHERS = Object.freeze([['bayer8', 'Bayer 8'], ['bayer4', 'Bayer 4'], ['bayer2', 'Bayer 2'], ['noise', 'Noise'], ['diffusion', 'Diffusion'], ['none', 'None']]);
export const MASKS = Object.freeze([['grille', 'Aperture grille'], ['slot', 'Slot mask'], ['dot', 'Dot triad'], ['none', 'None']]);
export const YOURS = Object.freeze(['#0a0612', '#3a2a5a', '#c86a44', '#7de3ea', '#ff4ea0', '#f4ecff']);
// The studio's sliders: [key, label, min, max, default, divisor for the shown value (0 shows the plain number)]
export const SLIDERS = Object.freeze([
  ['tw', 'Pixel size: width of the grid', 24, 360, 240, 0], ['dstr', 'Dither strength', 0, 100, 80, 100], ['gam', 'Gamma', 40, 220, 100, 100],
  ['scan', 'Scanlines', 0, 90, 35, 100], ['maskA', 'Phosphor mask strength', 0, 100, 30, 100], ['bloom', 'Bloom', 0, 100, 18, 100],
  ['hal', 'Halation: the glow through the glass', 0, 100, 20, 100], ['curv', 'Curvature', 0, 100, 12, 100], ['abr', 'Colour fringe', 0, 100, 10, 100], ['vig', 'Vignette', 0, 100, 25, 100],
]);
// What a motion route can move: [key, label, the slider it reads, min, max]. The knobs are the room's own sliders.
export const MOD_TARGETS = Object.freeze([['tw', 'Pixel size', 24, 360], ['bloom', 'Bloom', 0, 100], ['curv', 'Curvature', 0, 100], ['vig', 'Vignette', 0, 100], ['scan', 'Scanlines', 0, 90],
  ['gam', 'Gamma', 40, 220], ['amount', 'Effect amount', 0, 100], ['knobA', 'Knob A', 0, 1], ['knobB', 'Knob B', 0, 1], ['knobC', 'Knob C', 0, 1], ['fb', 'Feedback decay', 0, 95]]);
export const VIBES = Object.freeze([['Dreamy', ['soften', 'sparkle', 'starry'], 55], ['Cosmic', ['starry', 'goop', 'bleed'], 70], ['Goopy', ['goop', 'bubbly', 'wavy'], 65],
  ['Shattered', ['crystallize', 'sharpen', 'rgbShift'], 75], ['Wavy', ['wavy', 'soften', 'bleed'], 55], ['Cathode', ['dither', 'scanlines', 'bleed', 'rgbShift'], 60]]);

export function defaultPost() {
  const P = { amount: 0, pal: 'outrun', yours: [...YOURS], dith: 'bayer8', mask: 'grille', sdf: false,
    fx: [], amts: {}, master: 50, fxseed: 'glitch-1', fxanim: false, fb: { on: false, amt: 55, zoom: 15, rot: 4 }, mod: [], pending: { src: 'lfo-sine', tgt: 'bloom' } };
  for (const [k, , , , d] of SLIDERS) P[k] = d;
  return P;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// The post state in the address as rp=: only what differs from the defaults, as URL-safe base64 of its JSON.
export function encodePost(P) {
  const d = defaultPost(), out = {};
  for (const k of Object.keys(d)) if (JSON.stringify(P[k]) !== JSON.stringify(d[k])) out[k] = P[k];
  if (!Object.keys(out).length) return null;
  const raw = new TextEncoder().encode(JSON.stringify(out)); let s = ''; for (const b of raw) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodePost(text) {
  const P = defaultPost(); if (!text) return P;
  let got = null;
  try { got = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))); } catch { return P; }
  return mergePost(P, got);
}
// A patch or an address read into a post state, field by field, each checked against its own range.
export function mergePost(P, got) {
  if (!got || typeof got !== 'object') return P;
  const ok = (list, v) => list.some(([id]) => id === v);
  if (Number.isFinite(+got.amount)) P.amount = clamp(+got.amount, 0, 1);
  if (ok(PALETTES, got.pal)) P.pal = got.pal; if (ok(DITHERS, got.dith)) P.dith = got.dith; if (ok(MASKS, got.mask)) P.mask = got.mask;
  if (got.sdf != null) P.sdf = !!got.sdf;
  if (Array.isArray(got.yours)) got.yours.slice(0, 6).forEach((h, i) => { if (/^#[0-9a-f]{6}$/i.test(h)) P.yours[i] = h.toLowerCase(); });
  for (const [k, , lo, hi] of SLIDERS) if (Number.isFinite(+got[k])) P[k] = clamp(Math.round(+got[k]), lo, hi);
  if (Array.isArray(got.fx)) P.fx = got.fx.filter((o) => typeof o === 'string').slice(0, 40);
  if (got.amts && typeof got.amts === 'object') for (const [k, v] of Object.entries(got.amts)) if (Number.isFinite(+v)) P.amts[k] = clamp(+v, 0, 1);
  if (Number.isFinite(+got.master)) P.master = clamp(+got.master, 0, 100);
  if (typeof got.fxseed === 'string') P.fxseed = got.fxseed.slice(0, 40); if (got.fxanim != null) P.fxanim = !!got.fxanim;
  if (got.fb && typeof got.fb === 'object') P.fb = { on: !!got.fb.on, amt: clamp(+got.fb.amt || 0, 0, 95), zoom: clamp(+got.fb.zoom || 0, -50, 50), rot: clamp(+got.fb.rot || 0, -30, 30) };
  if (Array.isArray(got.mod)) P.mod = got.mod.filter((r) => r && typeof r.src === 'string' && MOD_TARGETS.some(([k]) => k === r.tgt)).slice(0, 12).map((r) => ({ src: r.src, tgt: r.tgt, depth: clamp(+r.depth || 0, -1, 1) }));
  return P;
}
export const postActive = (P) => P.amount > 0 || P.fx.length > 0 || P.fb.on;

export function createPost(out) {
  let M = null, loading = null, renderer = null, offsets = {}, lastMeasure = null;
  const fbCanvas = document.createElement('canvas'), moshPrev = document.createElement('canvas'), slit = { frames: [], head: 0 }, SLIT_LEN = 16;
  const mouse = { x: 0.5, y: 0.35 }, au = { bass: 0, mid: 0, treble: 0, level: 0 };
  async function ready() {
    if (M) return M;
    if (!loading) loading = Promise.all([import(RACK_URLS.retro), import(RACK_URLS.ops), import(RACK_URLS.mod), import(RACK_URLS.pal), import(RACK_URLS.engine)])
      .then(([r, o, m, p, e]) => { M = { ...r, ...o, ...m, setUserPalette: p.setUserPalette, renderRetro: e.renderRetro }; renderer = M.createRetroRenderer(); return M; })
      .catch((e) => { loading = null; console.error('shader room: the picture rack did not load', e); throw e; });
    return loading;
  }
  // a slider's value as the routes move it: its set point plus each route's offset, inside its own range
  const mv = (P, key) => { const t = MOD_TARGETS.find(([k]) => k === key), base = key === 'amount' ? P.master : P[key]; return t && M ? M.modValue(base, t[2], t[3], offsets[key]) : base; };
  function opts(P, react) {
    let tw = Math.round(mv(P, 'tw')), bloom = mv(P, 'bloom') / 100; const scan = mv(P, 'scan') / 100;
    if (react?.on.has('pixel')) tw = Math.max(24, Math.round(tw * (1 - au.bass * 0.45 * react.amt)));
    if (react?.on.has('bloom')) bloom = Math.min(1.4, bloom + au.level * 0.9 * react.amt);
    return { palette: P.pal, targetWidth: tw, dither: P.dith, gamma: mv(P, 'gam') / 100, sdfShade: P.sdf, curvature: mv(P, 'curv') / 100, bloom,
      vignette: mv(P, 'vig') / 100, scanStrength: scan, scanlines: scan > 0.02, ditherStrength: P.dstr / 100, mask: P.mask, maskStrength: P.maskA / 100,
      halation: P.hal / 100, aberration: P.abr / 100, upscale: Math.max(2, Math.min(12, Math.round(900 / tw))) };
  }
  // The studio's buildFx, unchanged in what each effect is given: every op scales with its own dial.
  function buildFx(P, t, react) {
    if (!P.fx.length || !M) return [];
    const base = (P.fxseed || 'glitch') + '|' + (P.fxanim ? Math.floor(t * 2) : '0'), rng = M.rngFrom(base), ph = P.fxanim ? t : 0;
    const lift = react?.on.has('effects') ? au.level * react.amt * 0.55 : 0, on = new Set(P.fx), list = [];
    for (const m of M.OP_META) {
      if (!on.has(m.op)) continue;
      const op = m.op, amt = clamp((m.op in P.amts ? P.amts[m.op] : mv(P, 'amount') / 100) + lift, 0, 1);
      if (op === 'pixelSort') list.push({ op, low: 0.5 - amt * 0.42, high: 0.5 + amt * 0.45, axis: rng() > 0.5 ? 'col' : 'row' });
      else if (op === 'databend') list.push({ op, shift: 3 + Math.floor(amt * (9 + rng() * 90)), xor: Math.floor(rng() * 255 * amt) });
      else if (op === 'rgbShift') list.push({ op, dx: amt * (6 + rng() * 22), dy: (rng() * 2 - 1) * amt * 12 });
      else if (op === 'slice') list.push({ op, count: 4 + Math.floor(rng() * 14), maxShift: amt * (0.05 + rng() * 0.3), seed: base });
      else if (op === 'wave') list.push({ op, amp: amt * (0.02 + rng() * 0.09), freq: 2 + Math.floor(rng() * 7), phase: ph, axis: rng() > 0.5 ? 'col' : 'row' });
      else if (op === 'mirror') list.push({ op, mode: ['quad', 'x', 'y'][Math.floor(rng() * 3)] });
      else if (op === 'echo') list.push({ op, dx: amt * (8 + rng() * 34), dy: amt * (4 + rng() * 26), alpha: 0.18 + amt * 0.6 });
      else if (op === 'posterize') list.push({ op, levels: Math.max(2, Math.round(10 - amt * 8)) });
      else if (op === 'dither') list.push({ op, levels: Math.max(2, Math.round(9 - amt * 7)) });
      else if (op === 'halftone') list.push({ op, cell: Math.max(3, Math.round(3 + amt * 12)), color: rng() > 0.5 ? 'source' : 'mono' });
      else if (op === 'ascii') list.push({ op, cell: Math.max(5, Math.round(5 + amt * 14)), color: ['source', 'green', 'amber', 'ink'][Math.floor(rng() * 4)] });
      else if (op === 'scanlines') list.push({ op, strength: 0.08 + amt * 0.7, gap: 2 + Math.floor(rng() * 2) });
      else if (op === 'bleed') list.push({ op, radius: Math.max(1, Math.round(1 + amt * 16)) });
      else if (op === 'mosaic') list.push({ op, amount: amt, phase: t, seed: base, mode: ['stone', 'gold', 'glass', 'trencadis'][Math.floor(rng() * 4)], lightX: mouse.x, lightY: mouse.y, glint: 0.35 + amt * 0.5 });
      else if (op === 'datamosh') list.push({ op, amount: amt, phase: t, seed: base, prev: moshPrev });
      else if (op === 'slitscan') list.push({ op, amount: amt, phase: t, ring: slit.frames, head: slit.head, len: slit.frames.length, axis: rng() > 0.72 ? 'col' : 'row' });
      else if (op === 'crystallize' || op === 'melt' || op === 'bubbly' || op === 'sparkle') list.push({ op, amount: amt, phase: ph, seed: base });
      else if (op === 'kaleido' || op === 'goop' || op === 'starry') list.push({ op, amount: amt, phase: ph });
      else if (op === 'wavy') list.push({ op, amount: amt, phase: ph, freq: 2 + Math.floor(rng() * 4) });
      else list.push({ op, amount: amt });
    }
    return list;
  }
  // The routes for this frame: offsets as fractions of each target's range. Knob routes return the knobs as moved.
  function modulate(P, t, knobs) {
    if (!M || !P.mod.length) { offsets = {}; return null; }
    offsets = M.computeOffsets(P.mod, M.evalSources(t, { ...au, mx: mouse.x, my: mouse.y, knobA: knobs[0], knobB: knobs[1], knobC: knobs[2] }));
    return ['knobA', 'knobB', 'knobC'].map((k, i) => clamp(knobs[i] + (offsets[k] || 0), 0, 1));
  }
  const userPalette = (P) => { if (M) M.setUserPalette(P.yours.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)))); };
  // One frame through the rack: src is the stack's canvas. Returns the measure of the grid, or null when the rack is out.
  function render(P, src, t, react) {
    if (!M || !src.width) return null;
    let m = null;
    if (P.amount > 0) {
      if (P.pal === 'yours') userPalette(P);
      m = renderer.render(src, out, opts(P, react));
      if (P.amount < 1) { const g = out.getContext('2d'); g.save(); g.globalAlpha = 1 - P.amount; g.imageSmoothingEnabled = true; g.drawImage(src, 0, 0, out.width, out.height); g.restore(); }
    } else {
      if (out.width !== src.width || out.height !== src.height) { out.width = src.width; out.height = src.height; }
      out.getContext('2d').drawImage(src, 0, 0);
    }
    lastMeasure = m;
    if (P.fx.length) M.applyOps(out, buildFx(P, t, react));
    if (P.fb.on) feedback(P);
    remember(P);
    return m;
  }
  // Feedback: the previous frame, zoomed and turned a little, folded back over this one; the blend is the next memory.
  function feedback(P) {
    const g = out.getContext('2d');
    if (fbCanvas.width > 0 && fbCanvas.height > 0) {
      g.save(); g.globalAlpha = clamp(mv(P, 'fb') / 100, 0, 0.95); g.translate(out.width / 2, out.height / 2);
      g.rotate((P.fb.rot / 10) * Math.PI / 180); const z = 1 + P.fb.zoom / 1000; g.scale(z, z);
      g.drawImage(fbCanvas, -out.width / 2, -out.height / 2, out.width, out.height); g.restore();
    }
    if (fbCanvas.width !== out.width || fbCanvas.height !== out.height) { fbCanvas.width = out.width; fbCanvas.height = out.height; }
    fbCanvas.getContext('2d').drawImage(out, 0, 0);
  }
  // the memory two effects feed on: datamosh the last frame, slit scan a short half-size ring of past frames
  function remember(P) {
    if (P.fx.includes('datamosh')) { if (moshPrev.width !== out.width || moshPrev.height !== out.height) { moshPrev.width = out.width; moshPrev.height = out.height; } moshPrev.getContext('2d').drawImage(out, 0, 0); }
    if (P.fx.includes('slitscan')) {
      const rw = Math.max(2, out.width >> 1), rh = Math.max(2, out.height >> 1); slit.head = (slit.head + 1) % SLIT_LEN;
      let f = slit.frames[slit.head]; if (!f) { f = document.createElement('canvas'); slit.frames[slit.head] = f; }
      if (f.width !== rw || f.height !== rh) { f.width = rw; f.height = rh; } f.getContext('2d').drawImage(out, 0, 0, rw, rh);
    }
  }
  // The pixel grid itself, one image pixel per cell, with no tube: the studio's Save 1x.
  function oneToOne(P, src, react) {
    if (!M) return null;
    const one = document.createElement('canvas');
    M.renderRetro(src, one, { ...opts(P, react), upscale: 1, scanlines: false, bloom: 0, curvature: 0, vignette: 0, halation: 0, aberration: 0, mask: 'none' });
    if (P.fx.length) M.applyOps(one, buildFx(P, 0, react));
    return one;
  }
  return {
    ready, render, oneToOne, modulate, userPalette, mouse, au, buildFx: (P, t) => buildFx(P, t, null), value: (P, key) => mv(P, key),
    get loaded() { return !!M; }, get meta() { return M ? M.OP_META : []; }, get sources() { return M ? M.MOD_SOURCES : []; }, get measure() { return lastMeasure; },
    flush() { fbCanvas.width = 0; },
    dispose() { try { renderer?.dispose(); } catch (e) { console.error('shader room: the tube did not close', e); } fbCanvas.width = 0; moshPrev.width = 0; slit.frames.length = 0; },
  };
}
