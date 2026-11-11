// fuzz.test.mjs: a parameter fuzzer for the CPU-side shading, sea and sky kernels. Our own code, fixed seeds.
//
// Each target draws random inputs from its valid range and checks the output against the kernel's contract: finite,
// and inside the stated range. A failure names the seed, the draw and the input, so it can be copied into REGRESSIONS
// and stays as a named case. Each target also runs a planted defect (a copy of a kernel with a guard removed) that
// the same check has to catch inside the same seed budget; a check that cannot see its planted defect is not a check.
// sky/sky.js is not covered: it reads the document at import, so it does not load outside a browser.
import test from "node:test";
import assert from "node:assert/strict";
import { G, jonswap, cascadeWaves, swellWaves, swellHeight, sellmeier, N_BK7 } from "./ocean.js";
import { blueMask, jit, ign } from "./jitter.mjs";
import { LAYERS, magnitude, flux, temperature, tint, colourIndex, cubeFace, faceDir } from "./stars.mjs";
import { sunPosition, moonPosition, refraction, localSidereal } from "../sky/astro.mjs";
import { seaState, hazeExtinction, estimatedWeather, effectiveFetch, beaufort } from "../sky/weather.mjs";

export const SEEDS = [1, 7, 42, 1337, 20261109];
const DRAWS = 400;
function rng(s) {
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  r.in = (a, b) => a + (b - a) * r(); r.log = (a, b) => Math.exp(r.in(Math.log(a), Math.log(b))); r.int = (a, b) => Math.floor(r.in(a, b + 1));
  return r;
}
const fin = (...xs) => xs.every((x) => Number.isFinite(x));
const all = (arr) => Array.prototype.every.call(arr, Number.isFinite);

// run(gen, kernel, check, draws) -> failures [{ seed, draw, input, why }]; check returns "" or the reason
export function run(gen, kernel, check, draws = DRAWS, seeds = SEEDS) {
  const fails = [];
  for (const seed of seeds) {
    const r = rng(seed);
    for (let i = 0; i < draws; i++) {
      const input = gen(r); let why;
      try { why = check(kernel(input), input); } catch (e) { why = "threw: " + e.message; }
      if (why) fails.push({ seed, draw: i, input, why });
    }
  }
  return fails;
}
const sea = (r) => ({ U10: r.log(0.5, 40), fetch: r.log(1e3, 2e6) });
const place = (r) => ({ date: new Date(Date.UTC(1950, 0, 1) + r() * 150 * 365.25 * 86400000), lat: r.in(-90, 90), lon: r.in(-180, 180) });
const mask = blueMask();
const starOut = (p, bv) => { const l = LAYERS[p.layer], m = magnitude(p.u, l.m0, l.m1); return { l, m, f: flux(m), T: temperature(bv), c: tint(bv), back: faceDir(cubeFace(p.e)), e: p.e }; };

const TARGETS = {
  jonswap: {
    gen: (r) => ({ ...sea(r), omega: r.log(0.02, 20) }), kernel: (p) => jonswap(p.omega, p),
    check: (s) => (!fin(s) ? "not finite" : s < 0 ? "negative energy" : ""),
    // planted: the guard is the valid range itself; a frequency of zero divides by zero
    planted: (p) => jonswap(p.omega < 0.05 ? 0 : p.omega, p),
  },
  cascadeWaves: {
    gen: (r) => { const tile = r.log(4, 2000), kmin = ((2 * Math.PI) / tile) * r.in(1, 4); return { ...sea(r), tile, kmin, kmax: kmin * r.in(2, 64), n: r.int(8, 64), windAngle: r.in(-7, 7), spread: r.in(1, 20), seed: r.int(1, 1e6) }; },
    kernel: cascadeWaves, draws: 120,
    check: (w, p) => {
      if (w.length !== p.n * 4 || !all(w)) return "not finite or wrong length";
      for (let i = 0; i < p.n; i++) { if (Math.hypot(w[i * 4], w[i * 4 + 1]) === 0) return "zero wave vector"; if (w[i * 4 + 2] < 0) return "negative amplitude"; }
      return "";
    },
    // planted: the lattice snap without its zero guard
    planted: (p) => { const w = cascadeWaves(p), q = Math.fround((2 * Math.PI) / p.tile); for (let i = 0; i < p.n; i++) if (w[i * 4] === q && w[i * 4 + 1] === 0) w[i * 4] = 0; return w; },
  },
  swell: {
    gen: (r) => ({ ...sea(r), windAngle: r.in(-7, 7), n: r.int(2, 8), seed: r.int(1, 1e6), storm: r() < 0.5, x: r.in(-5000, 5000), z: r.in(-5000, 5000), t: r.in(0, 86400) }),
    kernel: (p) => { const s = swellWaves(p); return { ...s, h: swellHeight(s, p.x, p.z, p.t) }; }, draws: 60,
    check: (s, p) => {
      if (!all(s.waves) || !fin(s.Q, s.kp, s.h)) return "not finite";
      if (s.Q < 0.35 || s.Q > 0.95) return "choppiness out of range";
      let sum = 0;
      for (let i = 0; i < p.n; i++) {
        const k = Math.hypot(s.waves[i * 4], s.waves[i * 4 + 1]), a = s.waves[i * 4 + 2];
        if (!(k > 0) || a < 0) return "bad wave"; if (k * a > Math.PI / 7 + 1e-5) return `steepness ${k * a} over the Stokes limit`; sum += a;
      }
      return Math.abs(s.h) > sum * 1.0001 + 1e-9 ? "height over the sum of amplitudes" : "";
    },
    // planted: the steepness cap removed
    planted: (p) => { const s = swellWaves(p); for (let i = 0; i < p.n; i++) s.waves[i * 4 + 2] *= 6; return { ...s, h: swellHeight(s, p.x, p.z, p.t) }; },
  },
  seaState: {
    gen: (r) => ({ wind: r.log(0.5, 40), fetch: r.log(1e3, 2e6) }), kernel: (p) => ({ ...seaState(p.wind, p.fetch), fe: effectiveFetch(p.wind, p.fetch), b: beaufort(p.wind) }), draws: 40,
    check: (s, p) => (!fin(s.Hs, s.Tp, s.fe) ? "not finite" : !(s.Hs > 0 && s.Hs < 40) ? `wave height ${s.Hs} m` : !(s.Tp > 0.3 && s.Tp < 40) ? `peak period ${s.Tp} s`
      : s.fe > p.fetch || s.fe <= 0 ? "fetch out of range" : !Number.isInteger(s.b) || s.b < 0 || s.b > 12 ? "Beaufort out of range" : ""),
    // planted: the saturation cap on fetch removed, so a wind over an endless fetch raises an impossible sea
    planted: (p) => { let m0 = 0; for (let w = 0.05; w < 6; w += 0.0025) m0 += jonswap(w, { U10: p.wind, fetch: p.fetch * 1e6 }) * 0.0025; return { Hs: 4 * Math.sqrt(m0), Tp: 5, fe: effectiveFetch(p.wind, p.fetch), b: beaufort(p.wind) }; },
  },
  hazeExtinction: {
    gen: (r) => ({ fog: r() < 0.2, rain: r() < 0.3 ? 0 : r.log(0.01, 300) }), kernel: (w) => [hazeExtinction(w), hazeExtinction({ ...w, rain: w.rain * 2 })],
    check: ([b, b2]) => (!fin(b, b2) ? "not finite" : b < 0 || b > 3.912 / 0.6 + 1e-12 ? `extinction ${b} per km out of range` : b2 < b ? "more rain gave clearer air" : ""),
    // planted: the sign of the rain exponent flipped, so visibility rises with rain rate
    planted: (w) => [w, { ...w, rain: w.rain * 2 }].map((x) => (x.fog ? 3.912 / 0.6 : x.rain > 0 ? 3.912 / Math.max(0.8, 11.6 * Math.pow(x.rain, 0.29)) : 0)),
  },
  estimatedWeather: {
    gen: place, kernel: (p) => estimatedWeather(p.date, p.lat, p.lon),
    check: (w) => (!fin(w.wind, w.windFrom, w.cloud, w.rain) ? "not finite" : w.wind < 1.5 || w.wind > 12 ? "wind out of range" : w.cloud < 0 || w.cloud > 1 ? "cloud out of range"
      : w.rain < 0 || w.rain > 7 ? "rain out of range" : w.windFrom < 0 || w.windFrom > 360 ? "direction out of range" : ""),
    // planted: the cloud clamp removed
    planted: (p) => { const w = estimatedWeather(p.date, p.lat, p.lon); return { ...w, cloud: w.cloud + 0.3 * Math.sin(p.lon) }; },
  },
  sunAndMoon: {
    gen: place, kernel: (p) => ({ s: sunPosition(p.date, p.lat, p.lon), m: moonPosition(p.date, p.lat, p.lon), st: localSidereal(p.date, p.lon) }),
    check: ({ s, m, st }) => {
      for (const o of [s, m]) {
        if (!fin(o.alt, o.altGeometric, o.az, o.dec)) return "not finite";
        if (Math.abs(o.alt) > 90.6 || Math.abs(o.altGeometric) > 90 + 1e-9 || o.az < 0 || o.az >= 360) return "angle out of range";
        if (o.alt < o.altGeometric - 1e-9) return "refraction lowered the body";
      }
      if (Math.abs(s.dec) > 23.5 || s.distanceAU < 0.983 || s.distanceAU > 1.017) return "Sun out of range";
      if (Math.abs(s.eqTime) > 17) return "equation of time out of range";
      if (Math.abs(m.dec) > 28.8 || m.distance < 356000 || m.distance > 407000 || m.illuminated < 0 || m.illuminated > 1) return "Moon out of range";
      return st < 0 || st >= 360 ? "sidereal time out of range" : "";
    },
    // planted: azimuth left unwrapped
    planted: (p) => { const s = sunPosition(p.date, p.lat, p.lon); return { s: { ...s, az: s.az - 180 }, m: moonPosition(p.date, p.lat, p.lon), st: localSidereal(p.date, p.lon) }; },
  },
  refraction: {
    gen: (r) => ({ e: r() < 0.3 ? r.in(-1, 6) : r.in(-90, 90) }), kernel: (p) => refraction(p.e),
    check: (x) => (!fin(x) ? "not finite" : x < 0 || x > 0.6 ? `refraction ${x} degrees out of range` : ""),
    // planted: the branch for a body under the horizon removed, so the low-angle polynomial runs outside its range
    planted: (p) => (p.e > 5 ? refraction(p.e) : (1735 + p.e * (-518.2 + p.e * (103.4 + p.e * (-12.79 + p.e * 0.711)))) / 3600),
  },
  jitter: {
    gen: (r) => ({ x: r.int(0, 8191), y: r.int(0, 8191), seq: r.int(0, 100000), dim: r() < 0.5 ? r.int(0, 64) : r.in(0, 64) }), kernel: (p) => [jit(mask, p.x, p.y, p.seq, p.dim), ign(p.x, p.y)],
    check: (v) => (v.every((x) => fin(x) && x >= 0 && x < 1) ? "" : `jitter ${v} outside [0, 1)`),
    // planted: the wrap into [0, 1) removed
    planted: (p) => [mask[(p.y & 63) * 64 + (p.x & 63)] + 0.61803399 * p.seq + 0.75487767 * p.dim, ign(p.x, p.y)],
  },
  stars: {
    gen: (r) => { const z = r.in(-1, 1), a = r.in(0, 6.2831853), s = Math.sqrt(1 - z * z); return { u: r(), layer: r.int(0, 3), h: r(), e: [s * Math.cos(a), z, s * Math.sin(a)] }; },
    kernel: (p) => starOut(p, colourIndex(p.h)),
    check: (o) => (!fin(o.m, o.f, o.T, ...o.c, ...o.back) ? "not finite" : o.m < o.l.m0 - 1e-9 || o.m > o.l.m1 + 1e-9 ? "magnitude outside its layer" : o.f <= 0 || o.f > 21 ? "flux out of range"
      : o.T < 3500 || o.T > 20000 ? `temperature ${o.T} K` : o.c.some((x) => x < 0.3 || x > 1) ? "tint out of range"
      : Math.hypot(o.back[0] - o.e[0], o.back[1] - o.e[1], o.back[2] - o.e[2]) > 1e-9 ? "cube map does not round-trip" : ""),
    // planted: the colour index drawn past the range the temperature formula holds for
    planted: (p) => starOut(p, -0.25 + 3.5 * p.h),
  },
  sellmeier: {
    gen: (r) => ({ nm: r.in(380, 780) }), kernel: (p) => sellmeier(p.nm, N_BK7),
    check: (n) => (!fin(n) ? "not finite" : n < 1.5 || n > 1.54 ? `index ${n} out of range for BK7` : ""),
    // planted: the wavelength in the wrong unit, a thousand times too small
    planted: (p) => sellmeier(p.nm / 1000, N_BK7),
  },
};
// inputs that failed once, kept by name: [target, name, input]
export const REGRESSIONS = [];

const show = (f) => f.slice(0, 3).map((x) => `seed ${x.seed} draw ${x.draw}: ${x.why}; input ${JSON.stringify(x.input)}`).join("\n");
for (const [name, t] of Object.entries(TARGETS)) {
  test(`fuzz ${name}: every draw is finite and in range`, () => { const f = run(t.gen, t.kernel, t.check, t.draws); assert.equal(f.length, 0, `${f.length} failures\n${show(f)}`); });
  test(`fuzz ${name}: the planted defect is caught`, () => { const f = run(t.gen, t.planted, t.check, t.draws); assert.ok(f.length > 0, "the check passed a kernel with its guard removed"); });
}
test("fuzz: the same seeds give the same draws", () => {
  const t = TARGETS.hazeExtinction, a = run(t.gen, t.planted, t.check), b = run(t.gen, t.planted, t.check);
  assert.ok(a.length > 0); assert.deepEqual(a, b); assert.equal(G, 9.81);
});
for (const [target, name, input] of REGRESSIONS) test(`regression ${target}: ${name}`, () => assert.equal(TARGETS[target].check(TARGETS[target].kernel(input), input), ""));
