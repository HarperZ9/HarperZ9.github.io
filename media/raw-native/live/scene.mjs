// The scenes the live renderer draws, and the triangles it hands to the GPU.
//
// Two of them are the engine's owned assets, raw-hall and raw-hero, exactly as `raw_native_cli export-assets`
// writes them at superframe commit cac34166: the page fetches the glTF and its buffer, hashes both, and refuses
// to draw anything whose SHA-256 differs from the hashes the engine commits in evidence/m3-assets.json. The third
// is the engine's built-in test scene (src/scene/scene.cpp, buildTestScene): a 10 m ground plane and a 2 m box.
// The cameras are the engine's own: the five views of the test scene and the nave and gallery views of the hall
// (src/tools/owned_export.cpp, hallCamera).

const ASSETS = new URL("../assets/", import.meta.url);
// evidence/m3-assets.json at superframe cac34166: json:bin
export const PINS = {
  "raw-hall": ["bdaec612f3adfc30fd9a75ee497fdd2b7d9c63194a3e7c065738f0ef474c61f5", "017b0d276ac2f2a09358e1c24ef36c9aeb2d3807c9d562440d6d6f8e2077c9f6"],
  "raw-hero": ["aa9c9bc290705706922fb698b58fa20af9ee046d00435321a8bf67d424b2f7af", "9765de597e308c8ff0c68ec6baeeeb229deee7cf7530ad36b048ace6ab1cc358"],
};

const TEST_VIEWS = {
  default: { eye: [4, 4, 6], target: [0, 1, 0], fovy: 0.9 },
  high: { eye: [0, 9, 3], target: [0, 0.5, 0], fovy: 0.9 },
  low: { eye: [6, 1.5, 2], target: [0, 1, 0], fovy: 0.9 },
  close: { eye: [2, 2.5, 3], target: [0, 0.8, 0], fovy: 0.7 },
  wide: { eye: [5, 5, 8], target: [0, 0.5, 0], fovy: 1.2 },
};

// Each scene: what to load, its cameras, its sun, its exposure (EV100), its AO radius in metres, and its looks.
export const SCENES = {
  hall: {
    name: "The hall", bytes: 15027264 + 7350, asset: "raw-hall", aoRadius: 1.2, ev: 13.5,
    sun: { azimuth: 200, elevation: 66 }, fog: 0.02,
    views: {
      nave: { eye: [-15.5, 2.0, 0.0], target: [10.0, 5.5, 0.0], fovy: 1.1, label: "the nave" },
      gallery: { eye: [-12.0, 9.0, 6.6], target: [4.0, 5.0, -4.0], fovy: 1.1, label: "the gallery" },
      aisle: { eye: [-9.0, 1.7, -6.4], target: [9.0, 3.0, -5.6], fovy: 1.0, label: "the aisle" },
      floor: { eye: [-4.0, 0.9, 1.6], target: [6.0, 0.2, -0.4], fovy: 0.8, label: "the floor, low" },
    },
    lens: { tilt: 0.5, focus: 14, aperture: 0.35 },
    polish: { floor: 0.12, "floor inlay": 0.08 },
  },
  hero: {
    name: "The hero", bytes: 2706072 + 7436, asset: "raw-hero", inTest: true, aoRadius: 0.5, ev: 14.0,
    sun: { azimuth: 125, elevation: 38 }, fog: 0.015,
    views: {
      default: { eye: [2.6, 1.7, 3.2], target: [0, 0.8, 0], fovy: 0.8, label: "three quarters" },
      front: { eye: [0.0, 1.1, 3.6], target: [0, 0.9, 0], fovy: 0.75, label: "the front" },
      low: { eye: [2.8, 0.35, 1.4], target: [0, 0.7, 0], fovy: 0.9, label: "low" },
      wide: { eye: [5, 5, 8], target: [0, 0.5, 0], fovy: 1.2, label: "wide" },
    },
    lens: { tilt: 0.35, focus: 4.2, aperture: 0.06 },
    polish: { ground: 0.1 },
  },
  test: {
    name: "The test scene", bytes: 0, aoRadius: 1.0, ev: 14.0, sun: { azimuth: 233, elevation: 66 }, fog: 0.02,
    views: Object.fromEntries(Object.entries(TEST_VIEWS).map(([k, v]) => [k, { ...v, label: k }])),
    lens: { tilt: 0.4, focus: 7.2, aperture: 0.12 },
    polish: { ground: 0.25 },
  },
};

async function sha256(bytes) {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

// fetch with progress, as bytes
async function fetchBytes(url, onBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  if (!res.body || !onBytes) return new Uint8Array(await res.arrayBuffer());
  const total = +res.headers.get("content-length") || 0, parts = [];
  let got = 0;
  for (const reader = res.body.getReader(); ;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); got += value.length; onBytes(got, total);
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// A growing triangle soup: positions and normals per vertex, one material per triangle.
class Soup {
  constructor() { this.pos = []; this.nrm = []; this.mat = []; this.materials = []; this.chunks = []; }
  material(m) { this.materials.push(m); return this.materials.length - 1; }
  tri(a, b, c, na, nb, nc, m) { this.pos.push(...a, ...b, ...c); this.nrm.push(...na, ...nb, ...nc); this.mat.push(m); }
  quad(a, b, c, d, n, m) { this.tri(a, b, c, n, n, n, m); this.tri(a, c, d, n, n, n, m); }
  box(c, h, m) {
    const [x, y, z] = c, P = (i, j, k) => [x + i * h, y + j * h, z + k * h];
    this.quad(P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), [0, 0, 1], m);
    this.quad(P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), [0, 0, -1], m);
    this.quad(P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), [1, 0, 0], m);
    this.quad(P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), [-1, 0, 0], m);
    this.quad(P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1), [0, 1, 0], m);
    this.quad(P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1), [0, -1, 0], m);
  }
  // typed chunks (a glTF part) go in as they are
  chunk(pos, nrm, mat) { this.chunks.push({ pos, nrm, mat }); }
  done() {
    const all = [{ pos: this.pos, nrm: this.nrm, mat: this.mat }, ...this.chunks];
    const nt = all.reduce((a, c) => a + c.mat.length, 0);
    const positions = new Float32Array(nt * 9), normals = new Float32Array(nt * 9), triMat = new Uint32Array(nt);
    let t = 0;
    for (const c of all) { positions.set(c.pos, t * 9); normals.set(c.nrm, t * 9); triMat.set(c.mat, t); t += c.mat.length; }
    return { positions, normals, triMat, materials: this.materials };
  }
}

// a material record: albedo, roughness, emitted radiance (nits), metallic
const mat = (name, albedo, rough, metal = 0, emit = [0, 0, 0]) => ({ name, albedo, rough, metal, emit });

function testGround(s, polish) {
  const g = s.material(mat("ground", [0.7, 0.7, 0.7], polish.ground ?? 0.6));
  s.quad([-5, 0, -5], [-5, 0, 5], [5, 0, 5], [5, 0, -5], [0, 1, 0], g);
}

// glTF from the engine's exporter: one mesh per part, POSITION, NORMAL, u32 indices, one material each.
function gltfInto(s, json, bin, place, polish) {
  const view = (acc) => {
    const a = json.accessors[acc], v = json.bufferViews[a.bufferView], off = (v.byteOffset || 0) + (a.byteOffset || 0);
    const n = a.count * ({ VEC3: 3, SCALAR: 1 }[a.type]);
    return a.componentType === 5125 ? new Uint32Array(bin.buffer, bin.byteOffset + off, n) : new Float32Array(bin.buffer, bin.byteOffset + off, n);
  };
  for (const mesh of json.meshes) for (const prim of mesh.primitives) {
    const m = json.materials[prim.material], pbr = m.pbrMetallicRoughness || {};
    const strength = m.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1;
    const e = (m.emissiveFactor || [0, 0, 0]).map((v) => v * strength * 100);   // glTF emission x strength, in nits / 100
    // neither path refracts: a transmissive part (the hero's visor) is drawn as dark glass, its light the
    // share transmission does not pass on
    const pass = m.extensions?.KHR_materials_transmission?.transmissionFactor ?? 0;
    const albedo = (pbr.baseColorFactor || [1, 1, 1]).slice(0, 3).map((v) => v * (1 - 0.97 * pass));
    const id = s.material(mat(m.name, albedo, polish[m.name] ?? pbr.roughnessFactor ?? 1, pbr.metallicFactor ?? 1, e));
    const P = view(prim.attributes.POSITION), N = view(prim.attributes.NORMAL), I = view(prim.indices);
    const nt = I.length / 3, pos = new Float32Array(nt * 9), nrm = new Float32Array(nt * 9), q = [0, 0, 0];
    for (let j = 0; j < I.length; j++) {
      const k = I[j];
      place(P[3 * k], P[3 * k + 1], P[3 * k + 2], q);
      pos[3 * j] = q[0]; pos[3 * j + 1] = q[1]; pos[3 * j + 2] = q[2];
      nrm[3 * j] = N[3 * k]; nrm[3 * j + 1] = N[3 * k + 1]; nrm[3 * j + 2] = N[3 * k + 2];
    }
    s.chunk(pos, nrm, new Uint32Array(nt).fill(id));
  }
}

// Load one scene: the soup, its materials and what the page should say about where it came from.
export async function loadScene(id, onBytes) {
  const def = SCENES[id];
  if (!def) throw new Error(`no scene ${id}`);
  const s = new Soup(), receipt = [];
  if (!def.asset) {
    testGround(s, def.polish);
    s.box([0, 1, 0], 1, s.material(mat("box", [0.8, 0.3, 0.2], 0.5)));
    receipt.push("built here from the engine's test scene: a 10 m ground plane and a 2 m box");
    return { def, ...s.done(), receipt };
  }
  const [jsonPin, binPin] = PINS[def.asset];
  const jsonBytes = await fetchBytes(new URL(`${def.asset}.gltf`, ASSETS));
  const bin = await fetchBytes(new URL(`${def.asset}.bin`, ASSETS), onBytes);
  const [hj, hb] = await Promise.all([sha256(jsonBytes), sha256(bin)]);
  if (hj !== jsonPin || hb !== binPin) throw new Error(`${def.asset} does not match the engine's pinned SHA-256 (got ${hj.slice(0, 12)} and ${hb.slice(0, 12)})`);
  receipt.push(`${def.asset}.gltf and .bin, ${(bin.length / 1e6).toFixed(1)} MB, SHA-256 ${hb.slice(0, 12)} as the engine pins it`);
  const json = JSON.parse(new TextDecoder().decode(jsonBytes));
  let place = (x, y, z, o) => { o[0] = x; o[1] = y; o[2] = z; };
  if (def.inTest) {   // owned_export.cpp inTestScene: largest extent 2, centred over the origin, resting on the ground
    testGround(s, def.polish);
    const lo = [1e30, 1e30, 1e30], hi = [-1e30, -1e30, -1e30];
    for (const a of json.accessors) if (a.min && a.type === "VEC3") for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], a.min[k]); hi[k] = Math.max(hi[k], a.max[k]); }
    const k = 2 / Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1e-6), c = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2];
    place = (x, y, z, o) => { o[0] = (x - c[0]) * k; o[1] = (y - c[1]) * k; o[2] = (z - c[2]) * k; };
  }
  gltfInto(s, json, bin, place, def.polish);
  return { def, ...s.done(), receipt };
}
