// Weather and time for the whole island. Pure functions of (seed, clock, place): no state, so a
// save, a capture and a test all see the same sky.
//
// Three systems:
//   the day      24 game hours whose length is weighted toward dusk, night, dawn; noon is short
//   the regions  each of the eleven holds one signature state that drifts a little and never leaves
//   sky events   aurora, moon and sun haloes, a comet, storm cells with lightning
//
// The numbers a region gives use the names the game's place environment already reads
// (world/env.mjs terms: fog, rain, wind), so a place inside a region can take them as its base.

const TAU = Math.PI * 2, clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function hash(a, b = 0, c = 0) {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77) ^ Math.imul(c | 0, 0xc2b2ae3d)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
// smooth noise in time: one value per hour, eased between
function drift(seed, key, hours) {
  const i = Math.floor(hours), t = hours - i, u = t * t * (3 - 2 * t);
  return mix(hash(seed, key, i), hash(seed, key, i + 1), u);
}

// ---------------------------------------------------------------- the day
// The sun's height is a function of the clock, bent so the low sun lasts. Shares of the 24 hours:
// night 9.5 h, dawn 3.5 h, day 6 h (noon proper under 2 h), dusk 5 h. PARTS lists clock hours.
export const PARTS = [
  { name: "night", from: 0, to: 4.5 }, { name: "dawn", from: 4.5, to: 8 }, { name: "day", from: 8, to: 14 },
  { name: "dusk", from: 14, to: 19 }, { name: "night", from: 19, to: 24 },
];
// sun elevation in degrees at each knot of the clock; between knots it is eased
const SUN_KNOTS = [[0, -38], [3, -22], [4.5, -9], [6, -1], [8, 9], [10, 17], [11, 36], [12, 17], [14, 10], [16, 3], [17.5, -2], [19, -10], [21, -24], [24, -38]];
export function sunElevation(clockHours) {
  const c = ((clockHours % 24) + 24) % 24;
  for (let i = 1; i < SUN_KNOTS.length; i++) {
    if (c <= SUN_KNOTS[i][0]) { const [a, ea] = SUN_KNOTS[i - 1], [b, eb] = SUN_KNOTS[i]; return mix(ea, eb, smooth(a, b, c)); }
  }
  return -38;
}
export const dayPart = (clockHours) => PARTS.find((p) => { const c = ((clockHours % 24) + 24) % 24; return c >= p.from && c < p.to; }).name;
// Direction to the sun: x east, y up, z south. It rises in the east, stands in the south at 11.
export function sunDir(clockHours) {
  const c = ((clockHours % 24) + 24) % 24, el = sunElevation(c) * Math.PI / 180;
  const az = (c - 11) / 24 * TAU * 1.05;   // 0 = due south, negative = east
  return [-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
}
// The moon runs opposite the sun with a 29.5 day phase; phase 0 is new, 0.5 full.
export function moon(day, clockHours) {
  const phase = (((day + clockHours / 24) / 29.5) % 1 + 1) % 1, c = ((clockHours % 24) + 24) % 24;
  const lag = phase * 24, mc = (c - lag + 48) % 24, el = (sunElevation(mc) * 0.85 + 4) * Math.PI / 180, az = (mc - 11) / 24 * TAU * 1.05;
  return { phase, lit: 0.5 - 0.5 * Math.cos(phase * TAU), dir: [-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)] };
}

// ---------------------------------------------------------------- the regions
// fog: density per km at the ground; fogTop: metres over which it thins; cover: cloud 0..1;
// rain, snow, wind 0..1; cloudSea: height of a fog deck with clear air above, 0 for none;
// tint: what the air does to distance (rgb); lamp: the hue that names the place at night;
// storm: chance scale for cells; clear: chance scale for star, aurora and halo nights.
export const REGION_WEATHER = {
  0: { name: "open sea", fog: 0.05, fogTop: 400, cover: 0.5, rain: 0.1, snow: 0, wind: 0.6, cloudSea: 0, tint: [0.62, 0.70, 0.78], lamp: [1.0, 0.62, 0.24], storm: 0.4, clear: 0.5, snowLine: 0 },
  1: { name: "burying snow", fog: 0.5, fogTop: 500, cover: 0.85, rain: 0, snow: 0.7, wind: 0.35, cloudSea: 0, tint: [0.80, 0.85, 0.92], lamp: [1.0, 0.62, 0.24], storm: 0, clear: 0.35, snowLine: -6 },
  2: { name: "cloud sea below, clear above", fog: 0.5, fogTop: 120, cover: 0.2, rain: 0, snow: 0.1, wind: 0.7, cloudSea: 950, tint: [0.72, 0.76, 0.88], lamp: [1.0, 0.86, 0.6], storm: 0.1, clear: 0.8, snowLine: 0 },
  3: { name: "standing fog", fog: 1.7, fogTop: 260, cover: 0.75, rain: 0.25, snow: 0, wind: 0.1, cloudSea: 0, tint: [0.55, 0.66, 0.66], lamp: [1.0, 0.70, 0.36], storm: 0, clear: 0.15, snowLine: 1 },
  4: { name: "sea fog and swell", fog: 0.6, fogTop: 300, cover: 0.8, rain: 0.5, snow: 0, wind: 0.9, cloudSea: 0, tint: [0.56, 0.62, 0.70], lamp: [1.0, 0.58, 0.20], storm: 1, clear: 0.2, snowLine: 1 },
  5: { name: "dry and far-seeing", fog: 0.015, fogTop: 1500, cover: 0.12, rain: 0, snow: 0, wind: 0.3, cloudSea: 0, tint: [0.86, 0.70, 0.56], lamp: [0.6, 0.9, 1.0], storm: 0.15, clear: 0.9, snowLine: 3 },
  6: { name: "storm light on the marsh", fog: 0.45, fogTop: 60, cover: 0.65, rain: 0.35, snow: 0, wind: 0.4, cloudSea: 0, tint: [0.60, 0.64, 0.58], lamp: [1.0, 0.74, 0.40], storm: 0.8, clear: 0.25, snowLine: 3 },
  7: { name: "smoke and drizzle", fog: 0.4, fogTop: 350, cover: 0.7, rain: 0.3, snow: 0, wind: 0.3, cloudSea: 0, tint: [0.66, 0.62, 0.60], lamp: [1.0, 0.60, 0.22], storm: 0.3, clear: 0.2, snowLine: 3 },
  8: { name: "steam and flare", fog: 0.5, fogTop: 300, cover: 0.6, rain: 0.15, snow: 0, wind: 0.3, cloudSea: 0, tint: [0.70, 0.60, 0.50], lamp: [0.55, 1.0, 0.62], storm: 0.3, clear: 0.2, snowLine: 3 },
  9: { name: "still and clear", fog: 0.03, fogTop: 900, cover: 0.18, rain: 0, snow: 0, wind: 0.08, cloudSea: 0, tint: [0.80, 0.78, 0.80], lamp: [1.0, 0.9, 0.7], storm: 0.05, clear: 0.9, snowLine: 3 },
  10: { name: "fog on still water", fog: 1.1, fogTop: 80, cover: 0.7, rain: 0.1, snow: 0, wind: 0.05, cloudSea: 0, tint: [0.52, 0.62, 0.64], lamp: [0.5, 0.8, 1.0], storm: 0.2, clear: 0.2, snowLine: 3 },
  11: { name: "whiteout", fog: 1.3, fogTop: 400, cover: 0.7, rain: 0, snow: 0.85, wind: 0.8, cloudSea: 0, tint: [0.86, 0.88, 0.92], lamp: [1.0, 0.60, 0.22], storm: 0, clear: 0.45, snowLine: -9 },
};
const NUM = ["fog", "fogTop", "cover", "rain", "snow", "wind", "cloudSea", "storm", "clear", "snowLine"];

// One region's state at a time. It drifts by up to a quarter either way and keeps its character.
export function regionState(seed, id, day, clockHours) {
  const R = REGION_WEATHER[id] || REGION_WEATHER[0], h = day * 24 + clockHours, d = (k) => 0.75 + 0.5 * drift(seed, id * 16 + k, h / 5);
  // clear spells: on some nights a region that is usually closed opens up
  const open = smooth(1 - R.clear * 0.9, 1 - R.clear * 0.9 + 0.2, drift(seed, id * 16 + 9, h / 9));
  const cover = clamp(R.cover * d(1) * (1 - 0.75 * open));
  return {
    id, name: R.name, fog: R.fog * d(0) * (1 - 0.5 * open), fogTop: R.fogTop, cover, rain: clamp(R.rain * d(2) * (cover > 0.35 ? 1 : 0.2)),
    snow: clamp(R.snow * d(3) * (cover > 0.3 ? 1 : 0.15)), wind: clamp(R.wind * d(4)), cloudSea: R.cloudSea, tint: R.tint, lamp: R.lamp,
    storm: R.storm, clear: open, snowLine: R.snowLine,
  };
}
// How much of each region lies round every point of a 1 km lattice: the share of region ids in a
// 9 x 9 sample out to `reach` metres. Built once for a world. shares(x, z) reads it back with
// bilinear weights, so the share of a region changes smoothly as the walker crosses a border.
// regionAt(x, z) returns a region id for a position in metres.
export function makeRegionField(regionAt, width, depth, { step = 1024, reach = 3500 } = {}) {
  const gw = Math.ceil(width / step) + 1, gh = Math.ceil(depth / step) + 1, f = new Float32Array(gw * gh * 12);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const o = (gy * gw + gx) * 12; let n = 0;
    for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
      const w = 1 / (1 + (i * i + j * j) / 6), id = regionAt(gx * step + i * reach / 4, gy * step + j * reach / 4);
      f[o + (id > 11 ? 0 : id)] += w; n += w;
    }
    for (let k = 0; k < 12; k++) f[o + k] /= n;
  }
  const out = new Float32Array(12);
  return function shares(x, z) {
    const qx = Math.min(gw - 1.001, Math.max(0, x / step)), qz = Math.min(gh - 1.001, Math.max(0, z / step)), ix = Math.floor(qx), iz = Math.floor(qz), fx = qx - ix, fz = qz - iz;
    const a = (iz * gw + ix) * 12, b = a + 12, c = a + gw * 12, d = c + 12;
    for (let k = 0; k < 12; k++) out[k] = (f[a + k] * (1 - fx) + f[b + k] * fx) * (1 - fz) + (f[c + k] * (1 - fx) + f[d + k] * fx) * fz;
    return out;
  };
}
// The state at a place: every region's state weighed by its share there, so a border is a gradient.
// shares(x, z) comes from makeRegionField.
export function weatherAt(seed, shares, x, z, day, clockHours) {
  const acc = {}, tint = [0, 0, 0], lamp = [0, 0, 0], sh = shares(x, z); let here = 0;
  for (const k of NUM) acc[k] = 0;
  for (let id = 0; id < 12; id++) {
    const w = sh[id]; if (w <= 0) continue;
    if (w > sh[here]) here = id;
    const s = regionState(seed, id, day, clockHours);
    for (const k of NUM) acc[k] += s[k] * w;
    for (let c = 0; c < 3; c++) { tint[c] += s.tint[c] * w; lamp[c] += s.lamp[c] * w; }
  }
  return { region: here, name: (REGION_WEATHER[here] || REGION_WEATHER[0]).name, tint, lamp, ...acc };
}
// the names the place environment reads
export const placeTerms = (w) => ({ fog: clamp(w.fog * 1.6), rain: clamp(w.rain), wind: clamp(w.wind), snow: clamp(w.snow) });

// ---------------------------------------------------------------- sky events
// Aurora on clear northern nights, a halo when thin ice cloud crosses the moon or the low sun,
// a comet for eight nights in every sixty, storm cells that drift on the wind.
export function skyEvents(seed, w, zNorth01, day, clockHours) {
  const el = sunElevation(clockHours), night = smooth(-4, -12, el), m = moon(day, clockHours);
  const auroraNight = hash(seed, 7001, day) < 0.55 ? 0.4 + 0.6 * hash(seed, 7002, day) : 0;
  const aurora = night * auroraNight * smooth(0.75, 0.2, zNorth01) * (1 - w.cover) * (0.6 + 0.4 * drift(seed, 7003, clockHours * 3));
  const ice = hash(seed, 7101, day) < 0.4 ? 1 : 0;
  const halo = ice * clamp(1 - Math.abs(w.cover - 0.3) * 3) * (m.dir[1] > 0.05 && night > 0.5 ? m.lit : el > 0 && el < 14 ? 0.8 : 0);
  const cyc = ((day % 60) + 60) % 60, comet = cyc >= 12 && cyc < 20 ? night * (1 - w.cover) * (1 - Math.abs(cyc - 15.5) / 5) : 0;
  const cells = [];
  if (w.storm > 0.05) for (let i = 0; i < 3; i++) {
    const alive = hash(seed, 7200 + i, Math.floor((day * 24 + clockHours) / 6)) < w.storm * 0.7;
    if (!alive) continue;
    const t = (day * 24 + clockHours) % 6 / 6, a = hash(seed, 7300 + i, day) * TAU;
    const flash = hash(seed, 7400 + i, Math.floor((day * 24 + clockHours) * 3600 / 4)) < 0.25 ? 1 : 0;   // one strike in four, every four seconds
    cells.push({ bearing: a, drift: t, range: 14000 + 20000 * hash(seed, 7500 + i, day), flash });
  }
  return { night, aurora: clamp(aurora), halo: clamp(halo), comet: clamp(comet), cells, moon: m, stars: night * (1 - clamp(w.cover * 1.6)) ** 2 * (1 - clamp(w.snow * 3 + w.rain * 3)) };
}

// ---------------------------------------------------------------- one call for a frame
export function sky(seed, shares, x, z, worldDepth, day, clockHours) {
  const w = weatherAt(seed, shares, x, z, day, clockHours), ev = skyEvents(seed, w, clamp(z / worldDepth), day, clockHours);
  return { part: dayPart(clockHours), sunElevation: sunElevation(clockHours), sun: sunDir(clockHours), weather: w, events: ev, terms: placeTerms(w) };
}
