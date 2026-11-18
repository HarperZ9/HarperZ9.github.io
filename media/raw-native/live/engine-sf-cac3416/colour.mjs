// Colour pipelines on the GPU: packs the parameters colour.wgsl reads, and runs a
// pipeline over an array of RGB values (the browser test and offline tools use it).
// The ACES 2.0 tables come from the C++ reference: raw_native_cli colour tables
// PIPELINE OUT.json, committed under web/colour/tables/.

export const PIPELINES = [
  'clip/srgb', 'clip/display-p3', 'clip/rec2020', 'pbr-neutral/srgb', 'pbr-neutral/display-p3',
  'agx/srgb', 'agx/display-p3', 'aces2-sdr/srgb', 'aces2-sdr/display-p3', 'aces2-hdr1000/rec2100-pq',
  'aces2-hdr1000/srgb-extended',
];
const TONES = { clip: 0, 'pbr-neutral': 1, agx: 2, 'aces2-sdr': 3, 'aces2-hdr1000': 3 };
const OUTPUTS = { srgb: 0, 'display-p3': 1, rec2020: 2, 'rec2100-pq': 3, 'srgb-extended': 4 };
export const LAYOUT = { toAp0: 0, ap0ToAp1: 9, ap1ToAp0: 18, ap1Upper: 27, outM: 28, peak: 37, camIn: 38, camOut: 79,
  tonescale: 120, limitJ: 125, gammaInv: 126, chroma: 127, gamut: 131, agxIn: 136, agxOutset: 145, agxOut: 154,
  reach: 163, hue: 526, cusp: 889, size: 889 + 363 * 3 };

const PRIMARIES = {
  rec709: [[0.64, 0.33], [0.30, 0.60], [0.15, 0.06], [0.3127, 0.3290]],
  p3: [[0.680, 0.320], [0.265, 0.690], [0.150, 0.060], [0.3127, 0.3290]],
  rec2020: [[0.708, 0.292], [0.170, 0.797], [0.131, 0.046], [0.3127, 0.3290]],
};
const OUT_PRIMARIES = { srgb: 'rec709', 'display-p3': 'p3', rec2020: 'rec2020', 'rec2100-pq': 'rec2020', 'srgb-extended': 'rec709' };

const mul = (a, b) => Array.from({ length: 9 }, (_, k) => {
  const i = Math.floor(k / 3), j = k % 3;
  return a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
});
function inv(m) {
  const [a, b, c, d, e, f, g, h, k] = m;
  const A = e * k - f * h, B = -(d * k - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [A / det, -(b * k - c * h) / det, (b * f - c * e) / det, B / det, (a * k - c * g) / det,
    -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
export function rgbToXyz([r, g, b, w]) {
  const xyz = [r[0], g[0], b[0], r[1], g[1], b[1], 1 - r[0] - r[1], 1 - g[0] - g[1], 1 - b[0] - b[1]];
  const iv = inv(xyz), wt = [w[0] / w[1], 1, (1 - w[0] - w[1]) / w[1]];
  const gain = [0, 1, 2].map(i => wt[0] * iv[i * 3] + wt[1] * iv[i * 3 + 1] + wt[2] * iv[i * 3 + 2]);
  return xyz.map((v, k) => v * gain[k % 3]);
}
/** src to dst RGB with the same white (no adaptation). */
export const convert = (src, dst) => mul(inv(rgbToXyz(PRIMARIES[dst])), rgbToXyz(PRIMARIES[src]));

const AGX_INSET = [0.856627153315983, 0.0951212405381588, 0.0482516061458583, 0.137318972929847, 0.761241990602591,
  0.101439036467562, 0.11189821299995, 0.0767994186031903, 0.811302368396859];
const AGX_OUTSET = [1.1271005818144368, -0.11060664309660323, -0.016493938717834573, -0.1413297634984383,
  1.157823702216272, -0.016493938717834257, -0.14132976349843826, -0.11060664309660294, 1.2519364065950405];

function packCam(d, o, c) {
  d.set(c.rgb_to_cam, o); d.set(c.cam_to_rgb, o + 9); d.set(c.cone_to_aab, o + 18); d.set(c.aab_to_cone, o + 27);
  d.set([c.F_L_n, c.cz, c.inv_cz, c.A_w_J, c.inv_A_w_J], o + 36);
}

/** The uniform words and the packed data for a pipeline; `tables` is its ACES 2.0 JSON (or null). */
export function pack(name, tables = null) {
  const [tone, output] = name.split('/');
  if (!(tone in TONES) || !(output in OUTPUTS)) throw new Error(`unknown colour pipeline ${name}`);
  const L = LAYOUT, d = new Float32Array(L.size);
  d.set(convert('rec709', OUT_PRIMARIES[output]), L.outM);
  d.set(mul(AGX_INSET, convert('rec709', 'rec2020')), L.agxIn);
  d.set(AGX_OUTSET, L.agxOutset);
  d.set(convert('rec2020', 'rec709'), L.agxOut);
  if (TONES[tone] === 3) {
    if (!tables || tables.pipeline !== name) throw new Error(`${name} needs its ACES 2.0 tables`);
    const t = tables;
    d.set(t.rec709_to_ap0, L.toAp0); d.set(t.ap0_to_ap1, L.ap0ToAp1); d.set(t.ap1_to_ap0, L.ap1ToAp0);
    d[L.ap1Upper] = t.ap1_upper; d.set(t.limit_to_output, L.outM); d[L.peak] = t.peak;
    packCam(d, L.camIn, t.in); packCam(d, L.camOut, t.out);
    d.set([t.tonescale.n_r, t.tonescale.g, t.tonescale.t_1, t.tonescale.s_2, t.tonescale.m_2], L.tonescale);
    d[L.limitJ] = t.limit_J_max; d[L.gammaInv] = t.model_gamma_inv;
    d.set([t.chroma.sat, t.chroma.sat_thr, t.chroma.compr, t.chroma.scale], L.chroma);
    d.set([t.gamut.mid_J, t.gamut.focus_dist, t.gamut.lower_hull_gamma_inv, t.gamut.search[0], t.gamut.search[1]], L.gamut);
    d.set(t.reach_m, L.reach); d.set(t.gamut.hue, L.hue); d.set(t.gamut.cusp, L.cusp);
  }
  return { params: new Uint32Array([TONES[tone], OUTPUTS[output], 0, 0]), data: d };
}

let source = null;
export async function colourWGSL(base = new URL('./colour.wgsl', import.meta.url)) {
  if (!source) source = await (await fetch(base)).text();
  return source;
}

/** Runs a pipeline over RGB triples (Float32Array, length 3n) and returns the encoded triples.
 *  `wgsl` replaces colour.wgsl's source; only a test's control uses it. */
export async function applyColour(device, name, rgb, tables = null, wgsl = null) {
  const { params, data } = pack(name, tables);
  const code = `@group(0) @binding(0) var<uniform> cp: ColourParams;
@group(0) @binding(1) var<storage, read> cd: array<f32>;
@group(0) @binding(2) var<storage, read> src: array<f32>;
@group(0) @binding(3) var<storage, read_write> dst: array<f32>;
${wgsl ?? await colourWGSL()}
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i * 3u + 2u >= arrayLength(&src)) { return; }
  let o = colour_apply(vec3f(src[i * 3u], src[i * 3u + 1u], src[i * 3u + 2u]));
  dst[i * 3u] = o.x; dst[i * 3u + 1u] = o.y; dst[i * 3u + 2u] = o.z;
}`;
  const mod = device.createShaderModule({ code });
  const info = await mod.getCompilationInfo();
  const errs = info.messages.filter(m => m.type === 'error');
  if (errs.length) throw new Error(errs.map(m => `${m.lineNum}:${m.linePos} ${m.message}`).join('\n'));
  const pipe = device.createComputePipeline({ layout: 'auto', compute: { module: mod, entryPoint: 'main' } });
  const U = GPUBufferUsage;
  const buf = (arr, usage) => { const b = device.createBuffer({ size: Math.max(16, arr.byteLength), usage: usage | U.COPY_DST }); device.queue.writeBuffer(b, 0, arr); return b; };
  const ub = buf(params, U.UNIFORM), db = buf(data, U.STORAGE), sb = buf(rgb, U.STORAGE);
  const out = device.createBuffer({ size: rgb.byteLength, usage: U.STORAGE | U.COPY_SRC });
  const read = device.createBuffer({ size: rgb.byteLength, usage: U.MAP_READ | U.COPY_DST });
  const bg = device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [ub, db, sb, out].map((b, i) => ({ binding: i, resource: { buffer: b } })) });
  const enc = device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(pipe); pass.setBindGroup(0, bg); pass.dispatchWorkgroups(Math.ceil(rgb.length / 3 / 64)); pass.end();
  enc.copyBufferToBuffer(out, 0, read, 0, rgb.byteLength);
  device.queue.submit([enc.finish()]);
  await read.mapAsync(GPUMapMode.READ);
  const res = new Float32Array(read.getMappedRange().slice(0));
  read.unmap();
  for (const b of [ub, db, sb, out, read]) b.destroy();
  return res;
}
