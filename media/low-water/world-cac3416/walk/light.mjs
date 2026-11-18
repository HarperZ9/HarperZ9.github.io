// From a moment of weather to the numbers the shaders read: sky colours, the key light, the air.
// The palette follows the art direction: a low-chroma blue-grey base, orange against blue when the
// sun is low, the warm light scarce, and the lamp hue of the place for the night.
const mix = (a, b, t) => a + (b - a) * t, mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// keys by sun elevation in degrees: zenith, horizon, glow round the sun, sun colour, sun strength, exposure
const KEYS = [
  { el: -18, zenith: [0.006, 0.010, 0.026], horizon: [0.016, 0.024, 0.050], glow: [0.10, 0.12, 0.25], sun: [0.5, 0.6, 0.9], power: 0, exposure: 3.4 },
  { el: -7, zenith: [0.020, 0.036, 0.100], horizon: [0.110, 0.090, 0.130], glow: [0.90, 0.36, 0.16], sun: [1.0, 0.5, 0.3], power: 0, exposure: 2.6 },
  { el: -1.5, zenith: [0.070, 0.120, 0.300], horizon: [0.800, 0.380, 0.180], glow: [1.00, 0.40, 0.12], sun: [1.0, 0.42, 0.18], power: 0.5, exposure: 1.7 },
  { el: 4, zenith: [0.150, 0.250, 0.500], horizon: [0.920, 0.600, 0.380], glow: [1.00, 0.55, 0.22], sun: [1.0, 0.62, 0.36], power: 3.4, exposure: 1.15 },
  { el: 12, zenith: [0.180, 0.320, 0.600], horizon: [0.720, 0.740, 0.760], glow: [1.00, 0.82, 0.60], sun: [1.0, 0.86, 0.70], power: 3.6, exposure: 1.0 },
  { el: 36, zenith: [0.170, 0.340, 0.680], horizon: [0.600, 0.720, 0.860], glow: [1.00, 0.95, 0.86], sun: [1.0, 0.96, 0.90], power: 3.3, exposure: 1.0 },
];
function keyAt(el) {
  if (el <= KEYS[0].el) return KEYS[0];
  for (let i = 1; i < KEYS.length; i++) if (el <= KEYS[i].el) {
    const a = KEYS[i - 1], b = KEYS[i], t = smooth(a.el, b.el, el), o = { el };
    for (const k of ["zenith", "horizon", "glow", "sun"]) o[k] = mix3(a[k], b[k], t);
    o.power = mix(a.power, b.power, t); o.exposure = mix(a.exposure, b.exposure, t);
    return o;
  }
  return KEYS[KEYS.length - 1];
}

// s is weather.mjs sky(); returns the fields of the frame block that depend on light and air
export function frameLight(s, flash = 0) {
  const k = keyAt(s.sunElevation), w = s.weather, ev = s.events, cover = clamp(w.cover), night = smooth(-2, -9, s.sunElevation), m = ev.moon;
  // overcast pulls the dome toward a grey of the same brightness, slightly cool
  const grey = (c, boost) => { const l = lum(c) * boost; return [l * 0.92, l * 0.96, l]; };
  let zenith = mix3(k.zenith, grey(k.horizon, 0.55), cover * 0.9), horizon = mix3(k.horizon, grey(k.horizon, 0.8), cover * 0.82);
  // moonlight lifts a clear night a little
  const moonUp = clamp(m.dir[1] * 4) * m.lit * night * (1 - cover * 0.7);
  zenith = zenith.map((c, i) => c + [0.010, 0.014, 0.030][i] * moonUp); horizon = horizon.map((c, i) => c + [0.016, 0.022, 0.040][i] * moonUp);
  const sunUp = s.sunElevation > -1.5;
  const key = sunUp ? s.sun : m.dir[1] > 0.03 ? m.dir : [0.2, 0.9, 0.3];
  const keyCol = sunUp ? k.sun : [0.50, 0.62, 0.95];
  const keyPower = sunUp ? k.power * (1 - 0.86 * cover) * smooth(-1.5, 3, s.sunElevation) : 0.20 * moonUp;
  const amb = [0, 1, 2].map((i) => zenith[i] * 0.34 + horizon[i] * 0.40 + [0.004, 0.005, 0.009][i]);
  // the air takes the region's tint at the dome's brightness; far ground goes to this before it loses contrast
  const hl = lum(horizon) * 0.95 + 0.004, fog = [0, 1, 2].map((i) => mix(horizon[i], w.tint[i] * hl, 0.6));
  const sea = w.cloudSea > 0 ? 1 : 0;
  return {
    key: [...key, keyPower], keyCol: [...keyCol, 0], sun: [...s.sun, sunUp ? 1 : 0], moon: [...m.dir, m.lit],
    zenith: [...zenith, ev.stars], horizon: [...horizon, cover], glow: [...k.glow, sunUp || s.sunElevation > -9 ? 1 : 0], amb: [...amb, 0],
    fog: [...fog, w.fog / 1000 * (sea ? 0.12 : 1)], fogp: [0, 1 / Math.max(40, w.fogTop), sea ? w.cloudSea : 0, sea ? w.fog / 1000 * 2.2 : 0],
    wx: [w.rain, w.snow, w.wind, clamp(w.rain * 1.5)], ev: [ev.aurora, ev.halo, ev.comet, flash],
    misc: [night, w.snowLine, k.exposure * (1 - 0.3 * cover * (1 - night)), ev.cells.length ? clamp(w.storm) : 0], lamp: [...w.lamp, 0],
  };
}

// The air near the ground and the snow on it. sh is the share of each region at the walker
// (weather.mjs makeRegionField), so a border is a gradient here too.
//   gfog: ground fog density per metre, its depth in metres, how wispy it is, lamp haze per metre
//   snowp: new snow in metres, thaw, first-snow dusting, share of old grey snow
export function groundState(s, sh) {
  const w = s.weather, day = smooth(-4, 8, s.sunElevation);
  return {
    gfog: [w.fog * 0.0042, Math.min(18, Math.max(2.5, w.fogTop * 0.05)), clamp(0.75 - w.wind * 0.5), 0.003 + w.fog * 0.004 + 0.008 * (w.rain + w.snow)],
    snowp: [0.5 * w.snow, sh[1] * (0.10 + 0.28 * day), clamp(sh[3] * 0.85), 0.28 + 0.25 * sh[1] + 0.2 * sh[11]],
  };
}
