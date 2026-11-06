// ocean.js: the sea's spectrum and the lettering's distance field, both prepared on the CPU once per change.
//
// Waves: a JONSWAP spectrum (Hasselmann et al. 1973, Deutsche Hydrographische Zeitschrift A8(12)) with
// alpha = 0.076 (U10^2 / (F g))^0.22, omega_p = 22 (g^2 / (U10 F))^(1/3), gamma = 3.3, sigma 0.07 and 0.09,
// spread over direction by D(theta) proportional to cos^(2s)(theta / 2) (Longuet-Higgins et al. 1963), with the
// deep-water dispersion relation omega^2 = g k. Each cascade (a tiling patch of the sea) sums its share of the
// spectrum as discrete waves with seeded random phases: the direct-summation form of Tessendorf's FFT ocean
// (Tessendorf 2001, "Simulating Ocean Water", SIGGRAPH course notes), exact for the waves it keeps.
export const G = 9.81;  // m s^-2, standard gravity (CGPM 1901)

const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

export function jonswap(omega, { U10, fetch }) {
  const alpha = 0.076 * Math.pow((U10 * U10) / (fetch * G), 0.22);
  const wp = 22 * Math.pow((G * G) / (U10 * fetch), 1 / 3);
  const sigma = omega <= wp ? 0.07 : 0.09, r = Math.exp(-((omega - wp) ** 2) / (2 * sigma * sigma * wp * wp));
  return ((alpha * G * G) / omega ** 5) * Math.exp(-1.25 * (wp / omega) ** 4) * Math.pow(3.3, r);
}

// waves for one cascade: n waves with wavenumbers in [kmin, kmax], stratified in log k and in angle; returns
// Float32Array of (kx, kz, amplitude, phase) per wave
export function cascadeWaves({ tile, kmin, kmax, n, U10, fetch, windAngle, spread = 10, seed = 1 }) {
  const out = new Float32Array(n * 4), rand = rng(seed), nk = Math.round(Math.sqrt(n * 2)), na = Math.ceil(n / nk);
  let i = 0;
  for (let a = 0; a < na && i < n; a++) for (let b = 0; b < nk && i < n; b++, i++) {
    const lk0 = Math.log(kmin) + (Math.log(kmax) - Math.log(kmin)) * (b / nk), lk1 = lk0 + (Math.log(kmax) - Math.log(kmin)) / nk;
    const k = Math.exp(lk0 + (lk1 - lk0) * rand()), dk = Math.exp(lk1) - Math.exp(lk0);
    const th0 = -Math.PI + (2 * Math.PI * a) / na, dth = (2 * Math.PI) / na, th = th0 + dth * rand();
    const omega = Math.sqrt(G * k), domega = (G / (2 * omega)) * dk;
    // directional spreading, normalised over the circle
    const d = Math.pow(Math.abs(Math.cos(th / 2)), 2 * spread), norm = (Math.pow(2, 2 * spread - 1) * gammaRatio(spread)) / Math.PI;
    const amp = Math.sqrt(2 * jonswap(omega, { U10, fetch }) * domega * d * norm * dth);
    // snap to the patch's lattice (multiples of 2 pi / tile) so the patch tiles without a seam
    const dir = th + windAngle, q = (2 * Math.PI) / tile;
    let kx = Math.round((k * Math.cos(dir)) / q) * q, kz = Math.round((k * Math.sin(dir)) / q) * q;
    if (kx === 0 && kz === 0) kx = q;
    out.set([kx, kz, amp, rand() * 2 * Math.PI], i * 4);
  }
  return out;
}
// Gamma(s+1)^2 / Gamma(2s+1), the cos^(2s)(theta/2) spreading norm's factor, by Stirling for s >= 1
function gammaRatio(s) { const lg = (x) => (x - 0.5) * Math.log(x) - x + 0.5 * Math.log(2 * Math.PI) + 1 / (12 * x); return Math.exp(2 * lg(s + 1) - lg(2 * s + 1)); }

// the lettering as a signed distance field: Felzenszwalb and Huttenlocher's exact Euclidean distance transform
// (Theory of Computing 8, 2012) on a 1024x256 mask; returns { data: Float32Array of signed distances in pixels }
export function glyphField(word, font = "800 200px 'Hanken Grotesk', system-ui, sans-serif") {
  const W = 1024, H = 256, c = new OffscreenCanvas(W, H), x = c.getContext("2d", { willReadFrequently: true });
  let size = 200, m;
  const set = () => { x.font = font.replace(/\d+px/, `${size}px`); m = x.measureText(word); };
  set(); while ((m.width > W * 0.92 || m.actualBoundingBoxAscent + m.actualBoundingBoxDescent > H * 0.78) && size > 20) { size -= 4; set(); }
  x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "alphabetic";
  const base = H / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  x.fillText(word, W / 2, base);
  const a = x.getImageData(0, 0, W, H).data, inside = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) inside[i] = a[i * 4 + 3] > 127 ? 1 : 0;
  const dOut = edt(inside, W, H, 0), dIn = edt(inside, W, H, 1), out = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = Math.sqrt(dOut[i]) - Math.sqrt(dIn[i]);
  // the exact transform is piecewise linear between pixel centres; two box passes of radius 2 round its creases,
  // so the bevel normals come out smooth instead of rippled
  for (let pass = 0; pass < 2; pass++) blur(out, W, H, 2);
  // the inked extent, so the shader can stand the word's baseline on the water
  return { data: out, w: W, h: H, baseV: base / H, capV: (base - m.actualBoundingBoxAscent) / H, descV: (base + m.actualBoundingBoxDescent) / H, inkW: m.width / W };
}
function blur(a, W, H, r) {
  const t = new Float32Array(W * H), n = 2 * r + 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let k = -r; k <= r; k++) s += a[y * W + Math.min(W - 1, Math.max(0, x + k))]; t[y * W + x] = s / n; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let k = -r; k <= r; k++) s += t[Math.min(H - 1, Math.max(0, y + k)) * W + x]; a[y * W + x] = s / n; }
}
// squared distance to the nearest pixel whose value is not `of`
function edt(mask, W, H, of) {
  const INF = 1e20, f = new Float64Array(Math.max(W, H)), d = new Float64Array(W * H), z = new Float64Array(Math.max(W, H) + 1), v = new Int32Array(Math.max(W, H));
  for (let i = 0; i < W * H; i++) d[i] = mask[i] === of ? INF : 0;
  const pass = (n, get, put) => {
    for (let q = 0; q < n; q++) f[q] = get(q);
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; put(q, (q - v[k]) ** 2 + f[v[k]]); }
  };
  for (let x = 0; x < W; x++) pass(H, (y) => d[y * W + x], (y, val) => { d[y * W + x] = val; });
  for (let y = 0; y < H; y++) pass(W, (x) => d[y * W + x], (x, val) => { d[y * W + x] = val; });
  return d;
}

// Sellmeier dispersion: n^2 = 1 + sum B_i l^2 / (l^2 - C_i), l in micrometres
export function sellmeier(lambdaNm, { B, C }) {
  const l2 = (lambdaNm / 1000) ** 2; let s = 1;
  for (let i = 0; i < 3; i++) s += (B[i] * l2) / (l2 - C[i]);
  return Math.sqrt(s);
}
// SCHOTT N-BK7, from the maker's data sheet (also refractiveindex.info, SCHOTT optical glass catalogue)
export const N_BK7 = { B: [1.03961212, 0.231792344, 1.01046945], C: [0.00600069867, 0.0200179144, 103.560653] };

// The swell: the long, high waves near the spectrum's peak, as a few Gerstner (trochoidal) waves the scene ray-marches
// as raised geometry (Gerstner 1802; Fournier and Reeves 1986, "A simple model of ocean waves", SIGGRAPH). n waves
// span 0.5 to 2.5 times the peak wavenumber and +-50 degrees of the wind; each takes its share of the JONSWAP energy,
// a = sqrt(2 S(omega) d omega D(theta) d theta). A wave is no steeper than a Stokes wave can stand, H / L = 1/7
// (Michell 1893), so k a <= pi / 7; the choppiness Q sharpens crests (Q = 1 would close them to a cusp) and grows
// with wind; where crests fold, the surface Jacobian goes below zero and the wave breaks (foam and spray, scene).
// Returns Float32Array of (kx, kz, a, phase) and the choppiness and the peak wavenumber.
export function swellWaves({ U10, fetch, windAngle, n = 8, seed = 5 }) {
  const rand = rng(seed), wp = 22 * Math.pow((G * G) / (U10 * fetch), 1 / 3), kp = (wp * wp) / G, out = new Float32Array(n * 4);
  const spread = 4, norm = (Math.pow(2, 2 * spread - 1) * gammaRatio(spread)) / Math.PI;
  const nk = Math.ceil(n / 2), na = Math.ceil(n / nk);
  let i = 0;
  for (let b = 0; b < nk && i < n; b++) for (let a = 0; a < na && i < n; a++, i++) {
    const lk0 = Math.log(0.5 * kp) + (Math.log(5) * b) / nk, lk1 = lk0 + Math.log(5) / nk, k = Math.exp(lk0 + (lk1 - lk0) * rand());
    const omega = Math.sqrt(G * k), domega = (G / (2 * omega)) * (Math.exp(lk1) - Math.exp(lk0));
    const dth = (100 * Math.PI) / 180 / na, th = -50 * Math.PI / 180 + dth * (a + rand());
    const d = Math.pow(Math.abs(Math.cos(th / 2)), 2 * spread) * norm;
    const amp = Math.min(Math.sqrt(2 * jonswap(omega, { U10, fetch }) * domega * d * dth), Math.PI / 7 / k);
    const dir = th + windAngle;
    out.set([k * Math.cos(dir), k * Math.sin(dir), amp, rand() * 2 * Math.PI], i * 4);
  }
  // choppiness (GPU Gems 1, ch. 1: displacement Q / (k n) per wave, so aligned crests give a Jacobian of 1 - Q): calm
  // seas are near sinusoidal; a gale's aligned crests fold, which is where it breaks
  const Q = Math.min(0.95, 0.35 + 0.04 * Math.max(0, U10 - 4));
  return { waves: out, Q, kp };
}
// height of the swell at (x, z), time t (crests where cos = 1, where the displacement bunches points together), with
// two fixed-point steps that undoes the Gerstner horizontal displacement;
// the same sum the shader marches, so the camera can ride the same sea
export function swellHeight({ waves, Q }, x, z, t) {
  const n = waves.length / 4; let px = x, pz = z;
  for (let it = 0; it < 2; it++) {
    let dx = 0, dz = 0;
    for (let i = 0; i < n; i++) { const kx = waves[i * 4], kz = waves[i * 4 + 1], a = waves[i * 4 + 2], k = Math.hypot(kx, kz), th = kx * px + kz * pz - Math.sqrt(G * k) * t + waves[i * 4 + 3], q = Q / (k * n);
      dx -= (q * kx / k) * Math.sin(th); dz -= (q * kz / k) * Math.sin(th); }
    px = x - dx; pz = z - dz;
  }
  let h = 0; for (let i = 0; i < n; i++) { const kx = waves[i * 4], kz = waves[i * 4 + 1], k = Math.hypot(kx, kz); h += waves[i * 4 + 2] * Math.cos(kx * px + kz * pz - Math.sqrt(G * k) * t + waves[i * 4 + 3]); }
  return h;
}
