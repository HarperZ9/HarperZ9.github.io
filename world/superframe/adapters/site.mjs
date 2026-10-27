// adapters/site.mjs: generators from the site (HarperZ9.github.io system/, pinned at origin/main 3ca6529 in
// ../upstream/site-3ca6529) and raw-native through its vendored 0.4.0 CPU wasm build. Retro quantise and dither,
// loom drafts, plot-map terrain and hidden-line ridges, CPU fractals, and the raw-native path-traced test scene.
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import * as px from '../lib/pix.mjs';
import { quantizeGrid, RETRO_DEFAULT_OPTS, paletteNames } from '../upstream/site-3ca6529/system/retro-engine.js';
import { computeDraft, STRUCTURES } from '../upstream/site-3ca6529/system/weave-engine.js';
import { elevationField, ridgelines } from '../upstream/site-3ca6529/system/plot-maps.js';
import { renderFormulaCPU } from '../upstream/site-3ca6529/system/fractal-formula-cpu.js';
import { toSrgb } from '../../feed-24/build/raster.js';

const SYS = 'HarperZ9.github.io system';
const RETRO_PALETTES = paletteNames();

// The fractal CPU path paints through canvas.getContext('2d').putImageData(new ImageData(...)); give it a capture.
function captureCanvas(w, h) {
  const c = { width: w, height: h, pixels: null };
  c.getContext = () => ({ putImageData: img => { c.pixels = img.data; } });
  return c;
}
globalThis.ImageData ??= class { constructor(data, width, height) { this.data = data; this.width = width; this.height = height; } };

let rawModule = null;
async function raw() {
  if (rawModule) return rawModule;
  const dir = new URL('../upstream/site-3ca6529/media/raw-native/wasm-0.4.0/', import.meta.url);
  const { default: create } = await import(new URL('raw-native.mjs', dir).href);
  rawModule = { create, wasm: readFileSync(fileURLToPath(new URL('raw-native.wasm', dir))), runs: 0 };
  return rawModule;
}
function parseNetpbm(bytes) {
  let i = 0; const tok = () => { while (bytes[i] === 0x20 || bytes[i] === 0x0a || bytes[i] === 0x0d || bytes[i] === 0x09) i++; let s = ''; while (bytes[i] > 0x20) s += String.fromCharCode(bytes[i++]); return s; };
  const magic = tok(), w = +tok(), h = +tok(); tok(); i++;
  return { magic, w, h, data: bytes.subarray(i) };
}
const VIEWS = { default: { eye: [4, 4, 6], target: [0, 1, 0], fovy: 0.9 }, high: { eye: [0, 9, 3], target: [0, 0.5, 0], fovy: 0.9 }, low: { eye: [6, 1.5, 2], target: [0, 1, 0], fovy: 0.9 }, close: { eye: [2, 2.5, 3], target: [0, 0.8, 0], fovy: 0.7 }, wide: { eye: [5, 5, 8], target: [0, 0.5, 0], fovy: 1.2 } };

export const NODES = [
  defineNode({
    id: 'site.retro', title: 'Retro palette quantise and dither', lane: 'image', domains: ['games', 'colour science'], source: `${SYS}/retro-engine.js quantizeGrid`,
    doc: 'Downsamples to a low grid, maps to a period palette in OKLab with ordered or diffusion dither, then scales back with hard pixels.',
    inputs: { raster: 'raster' }, outputs: { raster: 'raster' },
    params: { palette: { type: 'enum', options: RETRO_PALETTES, default: RETRO_PALETTES.includes('gameboy') ? 'gameboy' : RETRO_PALETTES[0] }, grid: { type: 'int', min: 32, max: 256, default: 96, unit: 'cells across' }, dither: { type: 'enum', options: ['none', 'bayer2', 'bayer4', 'bayer8', 'noise', 'diffusion'], default: 'bayer4' }, strength: { type: 'number', min: 0, max: 1, default: 0.8 } },
    cost: () => 30,
    render: ({ inputs, params, w, h, rng }) => {
      const tw = Math.min(params.grid, w), th = Math.max(2, Math.round(tw * h / w)), small = px.resampleRaster(inputs.raster, tw, th), d = px.toSRGB8(small, rng, { ground: '#000000' });
      quantizeGrid(d, tw, th, { ...RETRO_DEFAULT_OPTS, palette: params.palette, dither: params.dither, ditherStrength: params.strength });
      const S = px.fromSRGB8(tw, th, d), R = make.raster(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const j = (Math.min(th - 1, (y * th / h) | 0) * tw + Math.min(tw - 1, (x * tw / w) | 0)) * 4; R.data.set(S.data.subarray(j, j + 4), (y * w + x) * 4); }
      return { raster: R };
    },
  }),
  defineNode({
    id: 'site.loom', title: 'Woven draft from a field', lane: 'field', domains: ['textiles', 'computing history'], source: `${SYS}/weave-engine.js computeDraft`,
    doc: 'The field drives the treadling of a loom draft (plain, twill, satin, overshot or jacquard); the output is warp-up or weft-up at every crossing.',
    inputs: { field: 'field' }, outputs: { field: 'field' },
    params: { structure: { type: 'enum', options: Object.keys(STRUCTURES), default: 'twill22' }, ends: { type: 'int', min: 24, max: 256, default: 96, unit: 'warp ends' }, drive: { type: 'number', min: 0, max: 1, default: 0.6 } },
    cost: () => 10,
    render: ({ inputs, params, w, h }) => {
      const ends = params.ends, picks = Math.max(8, Math.round(ends * h / w)), L = px.resample(inputs.field, ends, picks).data, D = computeDraft(L, ends, picks, params.structure, { toneDrive: params.drive }), F = make.field(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const e = (x * ends / w) | 0, p = (y * picks / h) | 0, cx = (x * ends / w) % 1, cy = (y * picks / h) % 1, up = D.liftAt(e, p);
        const shade = up ? 0.85 - 0.5 * Math.abs(cx - 0.5) : 0.25 + 0.4 * (1 - Math.abs(cy - 0.5) * 2); F.data[y * w + x] = shade * (0.65 + 0.35 * D.lumaAt(e, p)); }
      return { field: F };
    },
  }),
  defineNode({
    id: 'site.terrain', title: 'Plot-map terrain', lane: 'field', domains: ['cartography', 'geology'], source: `${SYS}/plot-maps.js elevationField`,
    outputs: { field: 'field' },
    params: { baseFreq: { type: 'number', min: 1, max: 10, default: 3, unit: 'cycles per sheet' }, octaves: { type: 'int', min: 1, max: 8, default: 5 }, ridged: { type: 'bool', default: false } },
    cost: () => 30,
    render: ({ params, w, h, seed }) => ({ field: make.field(w, h, elevationField(seed, w, h, params).field) }),
  }),
  defineNode({
    id: 'site.ridgelines', title: 'Hidden-line ridgelines', lane: 'vector', domains: ['cartography', 'data graphics'], source: `${SYS}/plot-maps.js ridgelines`,
    doc: 'Rows of the field lifted by their height, drawn front to back with a running horizon so nearer ridges hide the ones behind.',
    inputs: { field: 'field' }, outputs: { vector: 'vector' },
    params: { rows: { type: 'int', min: 12, max: 140, default: 60 }, lift: { type: 'number', min: 0.05, max: 0.6, default: 0.32, unit: 'share of height' } },
    cost: () => 10,
    render: ({ inputs, params, w, h }) => { const F = px.resample(inputs.field, w, h), L = ridgelines(F.data, w, h, { rows: params.rows, lift: params.lift, sampleStep: 2 });
      return { vector: make.vector(w, h, L.map(l => ({ pts: l.map(([x, y]) => [x * w, y * h]), width: Math.max(0.8, w / 400) }))) }; },
  }),
  defineNode({
    id: 'site.fractal', title: 'Escape-time and Newton fractals (CPU)', lane: 'image', domains: ['complex dynamics'], source: `${SYS}/fractal-formula-cpu.js`,
    outputs: { raster: 'raster' },
    params: { type: { type: 'enum', options: ['multibrot', 'tricorn', 'celtic', 'magnet', 'phoenix', 'newton', 'nova'], default: 'multibrot' }, scale: { type: 'number', min: 0.02, max: 4, default: 3, unit: 'plane width', log: true }, cx: { type: 'number', min: -1.5, max: 1, default: -0.6 }, cy: { type: 'number', min: -1, max: 1, default: 0 }, maxIter: { type: 'int', min: 40, max: 400, default: 160 } },
    cost: p => p.maxIter * 0.6,
    render: ({ params, w, h, palette }) => {
      const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)), c = captureCanvas(w, h);
      renderFormulaCPU(c, { ...params }, [hex(palette.ground), hex(palette.accent), hex(palette.ink), hex(palette.ground)]);
      return { raster: px.fromSRGB8(w, h, c.pixels) };
    },
  }),
  defineNode({
    id: 'raw.render', title: 'raw-native path-traced scene (CPU wasm 0.4.0)', lane: 'image', domains: ['rendering', 'graphics'], source: 'raw-native 0.4.0 wasm, vendored in the site at media/raw-native/wasm-0.4.0',
    doc: 'The raw-native engine renders its certified test scene with ray-traced ambient occlusion; outputs the frame and the AO channel as a field.',
    outputs: { raster: 'raster', field: 'field' },
    params: { view: { type: 'enum', options: Object.keys(VIEWS), default: 'default' }, orbit: { type: 'number', min: -3.14, max: 3.14, default: 0, unit: 'rad around the target' } },
    cost: () => 900,
    render: async ({ params, w, h }) => {
      const R = await raw(), m = await R.create({ wasmBinary: R.wasm, print() {}, printErr() {} }), dir = `/run${R.runs++}`, v = VIEWS[params.view];
      const dx = v.eye[0] - v.target[0], dz = v.eye[2] - v.target[2], c = Math.cos(params.orbit), s = Math.sin(params.orbit), eye = [v.target[0] + dx * c - dz * s, v.eye[1], v.target[2] + dx * s + dz * c];
      const size = Math.min(512, Math.max(64, Math.max(w, h)));
      m.FS.mkdir(dir);
      const code = m.callMain(['--out', dir, '--width', String(size), '--height', String(size), '--eye', eye.join(','), '--target', v.target.join(','), '--fovy', String(v.fovy)]);
      if (code !== 0 && code !== undefined) throw new Error(`raw-native exited ${code}`);
      const f = parseNetpbm(m.FS.readFile(`${dir}/frame.ppm`)), rgba = new Uint8ClampedArray(f.w * f.h * 4);
      for (let i = 0; i < f.w * f.h; i++) { rgba[4 * i] = f.data[3 * i]; rgba[4 * i + 1] = f.data[3 * i + 1]; rgba[4 * i + 2] = f.data[3 * i + 2]; rgba[4 * i + 3] = 255; }
      let ao = null; try { const a = parseNetpbm(m.FS.readFile(`${dir}/ao_rt.pgm`)); ao = make.field(a.w, a.h, Float32Array.from(a.data.subarray(0, a.w * a.h), b => b / 255)); } catch { ao = px.luma(px.fromSRGB8(f.w, f.h, rgba)); }
      return { raster: px.resampleRaster(px.fromSRGB8(f.w, f.h, rgba), w, h), field: px.resample(ao, w, h) };
    },
  }),
];
