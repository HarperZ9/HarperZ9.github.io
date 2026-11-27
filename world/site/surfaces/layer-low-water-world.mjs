// layer-low-water-world.mjs: Real-time Low Water atmospheric sky, ridged terrain/shoreline,
// water reflection, and wind-blown flora layer for the Unified /playground/ Studio (Wave 33A-1).
// Reuses exact Low Water sun-elevation sky keys and fog/exposure equations from walk/light.mjs.

export const LAYER_META = Object.freeze({
  id: 'low-water',
  name: 'Low Water World & Sky',
  discipline: 'Native Engine, Living World & Inspection',
  route: 'Elements + DAW -> Low Water',
  takes: ['palette', 'audio_features'],
  gives: ['frame', 'palette'],
  defaultOn: true,
  defaultOpacity: 0.92,
  defaultBlend: 'normal',
});

const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
const linRgbStr = (c, alpha = 1) => {
  const s = c.map((v) => Math.round(clamp(Math.pow(clamp(v, 0, 1), 1 / 2.2), 0, 1) * 255));
  return alpha < 1 ? `rgba(${s[0]},${s[1]},${s[2]},${alpha.toFixed(2)})` : `rgb(${s[0]},${s[1]},${s[2]})`;
};
const linToHex = (c) => '#' + c.map((v) => hex2(Math.pow(clamp(v, 0, 1), 1 / 2.2) * 255)).join('');

// Exact Low Water atmospheric sun-elevation key table (degrees)
export const SKY_KEYS = Object.freeze([
  { el: -18, zenith: [0.006, 0.010, 0.026], horizon: [0.016, 0.024, 0.050], glow: [0.10, 0.12, 0.25], sun: [0.5, 0.6, 0.9], power: 0, exposure: 3.4 },
  { el: -7, zenith: [0.020, 0.036, 0.100], horizon: [0.110, 0.090, 0.130], glow: [0.90, 0.36, 0.16], sun: [1.0, 0.5, 0.3], power: 0, exposure: 2.6 },
  { el: -1.5, zenith: [0.070, 0.120, 0.300], horizon: [0.800, 0.380, 0.180], glow: [1.00, 0.40, 0.12], sun: [1.0, 0.42, 0.18], power: 0.5, exposure: 1.7 },
  { el: 4, zenith: [0.150, 0.250, 0.500], horizon: [0.920, 0.600, 0.380], glow: [1.00, 0.55, 0.22], sun: [1.0, 0.62, 0.36], power: 3.4, exposure: 1.15 },
  { el: 12, zenith: [0.180, 0.320, 0.600], horizon: [0.720, 0.740, 0.760], glow: [1.00, 0.82, 0.60], sun: [1.0, 0.86, 0.70], power: 3.6, exposure: 1.0 },
  { el: 36, zenith: [0.170, 0.340, 0.680], horizon: [0.600, 0.720, 0.860], glow: [1.00, 0.95, 0.86], sun: [1.0, 0.96, 0.90], power: 3.3, exposure: 1.0 },
]);

function skyKeyAt(el) {
  if (el <= SKY_KEYS[0].el) return SKY_KEYS[0];
  for (let i = 1; i < SKY_KEYS.length; i++) {
    if (el <= SKY_KEYS[i].el) {
      const a = SKY_KEYS[i - 1], b = SKY_KEYS[i], t = smooth(a.el, b.el, el);
      return {
        el,
        zenith: mix3(a.zenith, b.zenith, t),
        horizon: mix3(a.horizon, b.horizon, t),
        glow: mix3(a.glow, b.glow, t),
        sun: mix3(a.sun, b.sun, t),
        power: mix(a.power, b.power, t),
        exposure: mix(a.exposure, b.exposure, t),
      };
    }
  }
  return SKY_KEYS[SKY_KEYS.length - 1];
}

export function computeLowWaterLight({ sunElevation = 4, azimuthDeg = 215, cover = 0.22, fog = 0.28, wind = 0.35 } = {}) {
  const k = skyKeyAt(sunElevation);
  const c = clamp(cover), night = smooth(-2, -9, sunElevation);
  const grey = (col, boost) => { const l = lum(col) * boost; return [l * 0.92, l * 0.96, l]; };
  const zenith = mix3(k.zenith, grey(k.horizon, 0.55), c * 0.9);
  const horizon = mix3(k.horizon, grey(k.horizon, 0.80), c * 0.82);
  const elR = (sunElevation * Math.PI) / 180, azR = (azimuthDeg * Math.PI) / 180;
  const sunDir = [Math.cos(elR) * Math.sin(azR), Math.sin(elR), Math.cos(elR) * Math.cos(azR)];
  const sunUp = sunElevation > -1.5;
  const keyPower = sunUp ? k.power * (1 - 0.86 * c) * smooth(-1.5, 3, sunElevation) : 0.18;
  const keyCol = sunUp ? k.sun : [0.50, 0.62, 0.95];
  const amb = [0, 1, 2].map((i) => zenith[i] * 0.34 + horizon[i] * 0.40 + [0.004, 0.005, 0.009][i]);
  const hl = lum(horizon) * 0.95 + 0.004;
  const fogCol = [0, 1, 2].map((i) => mix(horizon[i], [0.78, 0.84, 0.90][i] * hl, clamp(fog, 0, 1) * 0.65));
  return {
    sunElevation, night, sunDir, keyCol, keyPower, zenith, horizon, glow: k.glow, amb, fogCol,
    exposure: k.exposure * (1 - 0.3 * c * (1 - night)),
    wind: clamp(wind),
    hex: [linToHex(zenith), linToHex(horizon), linToHex(k.glow), linToHex(fogCol)],
  };
}

// Deterministic ridged fBm shoreline terrain height (no Math.random)
export function terrainHeight(xNorm, ridgeIndex = 0, seed = 3301) {
  let amp = 0.55, freq = 2.1 + ridgeIndex * 0.85, sum = 0;
  for (let o = 0; o < 4; o++) {
    const ph = (seed * 0.13 + ridgeIndex * 4.7 + o * 1.9);
    const v = 1 - Math.abs(Math.sin(xNorm * freq * Math.PI + ph) * Math.cos(xNorm * freq * 0.61 * Math.PI - ph * 0.7));
    sum += v * v * amp;
    amp *= 0.48;
    freq *= 2.04;
  }
  return clamp(sum / 1.15, 0, 1);
}

export function renderLowWaterLayer(ctx, state = {}, opts = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const t = Number(state.time) || 0;
  const audio = state.audio || { rms: 0.3, bass: 0.35, onset: false, bands8: Array(8).fill(0.3) };
  const sunEl = opts.sunElevation ?? (-2 + ((state.stirY ?? 0.46) * 32));
  const light = computeLowWaterLight({
    sunElevation: sunEl,
    azimuthDeg: 140 + (state.stirX ?? 0.52) * 140,
    cover: opts.cover ?? 0.20,
    fog: opts.fog ?? 0.32,
    wind: clamp(0.25 + audio.rms * 0.65),
  });
  const horizonY = H * 0.56;

  // 1. Atmospheric sky gradient + sun disc/glow
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, linRgbStr(light.zenith));
  skyGrad.addColorStop(0.74, linRgbStr(light.horizon));
  skyGrad.addColorStop(1, linRgbStr(light.fogCol));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, horizonY + 2);

  const sunX = clamp(0.18 + (state.stirX ?? 0.52) * 0.64, 0.1, 0.9) * W;
  const sunY = horizonY - clamp((sunEl + 6) / 42, -0.1, 0.85) * (horizonY * 0.82);
  const glowR = W * (0.14 + (audio.onset ? 0.04 : 0) + audio.rms * 0.05);
  const sunG = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, glowR);
  sunG.addColorStop(0, linRgbStr(light.keyCol, 0.88));
  sunG.addColorStop(0.35, linRgbStr(light.glow, 0.36));
  sunG.addColorStop(1, linRgbStr(light.glow, 0));
  ctx.fillStyle = sunG;
  ctx.fillRect(0, 0, W, horizonY + 40);

  // 2. Layered atmospheric ridges receding into Low Water mist
  const layers = 4;
  for (let r = 0; r < layers; r++) {
    const depth = (r + 1) / layers;
    const baseY = horizonY - (1 - depth) * H * 0.14 + depth * 12;
    const hScale = H * (0.24 - r * 0.032) * (1 + (audio.bands8?.[r] ?? 0.3) * 0.12);
    const col = mix3(light.fogCol, [0.06, 0.11, 0.15], 0.25 + depth * 0.68);
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 2);
    for (let x = 0; x <= W; x += 12) {
      const h = terrainHeight(x / W + t * 0.004 * (r + 1), r, opts.seed ?? 3301);
      ctx.lineTo(x, baseY - h * hScale);
    }
    ctx.lineTo(W, horizonY + 2);
    ctx.closePath();
    ctx.fillStyle = linRgbStr(col);
    ctx.fill();
  }

  // 3. Low Water reflective tidal plane + shimmering sun column
  const waterGrad = ctx.createLinearGradient(0, horizonY, 0, H);
  waterGrad.addColorStop(0, linRgbStr(mix3(light.horizon, light.fogCol, 0.45)));
  waterGrad.addColorStop(1, linRgbStr(mix3(light.zenith, [0.02, 0.05, 0.09], 0.6)));
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, horizonY, W, H - horizonY);

  const bass = audio.bass ?? audio.bands8?.[0] ?? 0.3;
  for (let row = 0; row < 24; row++) {
    const f = row / 23;
    const y = horizonY + f * f * (H - horizonY);
    const spread = 14 + f * 95 + bass * 26;
    const sway = Math.sin(t * 2.4 + row * 0.7) * (6 + f * 18);
    ctx.fillStyle = linRgbStr(light.glow, (1 - f * 0.65) * 0.34);
    ctx.fillRect(sunX + sway - spread * 0.5, y, spread, 1.5 + f * 2.5);
  }

  // 4. Wind-blown shoreline reeds reacting to DAW bass/onset
  const reedCount = opts.reedCount ?? 26;
  ctx.strokeStyle = linRgbStr(mix3(light.amb, [0.04, 0.07, 0.08], 0.78), 0.88);
  for (let i = 0; i < reedCount; i++) {
    const rx = ((i + 0.5) / reedCount) * W;
    const rh = H * (0.09 + 0.08 * ((i * 37) % 11) / 11) * (1 + bass * 0.25);
    const bend = Math.sin(t * (1.8 + light.wind * 2.2) + i * 0.55) * (10 + light.wind * 28 + (audio.onset ? 10 : 0));
    ctx.lineWidth = 1.2 + (i % 3) * 0.5;
    ctx.beginPath();
    ctx.moveTo(rx, H);
    ctx.quadraticCurveTo(rx + bend * 0.4, H - rh * 0.55, rx + bend, H - rh);
    ctx.stroke();
  }
  return light;
}

export function lowWaterTransform(input, ctx, digestFn) {
  const audio = ctx.inPort === 'audio_features' ? input : ctx.lastByEnginePort?.get('daw:audio_features') || { rms: 0.35, bands8: Array(8).fill(0.35), beatPhase: 0.25 };
  const pal = ctx.inPort === 'palette' ? input : ctx.lastByEnginePort?.get('elements:palette');
  const sunEl = pal?.oklab?.[0]?.[0] != null ? -6 + pal.oklab[0][0] * 42 : 4 + audio.rms * 18;
  const light = computeLowWaterLight({ sunElevation: sunEl, cover: 0.2, fog: 0.3, wind: 0.3 + audio.rms * 0.5 });
  const w = 8, h = 4, lumaGrid = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const th = terrainHeight(x / w, y, 3301);
      const v = y < 2 ? lum(mix3(light.zenith, light.horizon, y * 0.7 + 0.2)) : clamp(th * 0.55 + (audio.bands8?.[x % 8] ?? 0.3) * 0.35);
      lumaGrid.push(Math.round(clamp(v, 0, 1) * 255));
    }
  }
  const oklab = light.hex.map((_, i) => [Number((0.28 + i * 0.17).toFixed(4)), Number(((light.glow[0] - 0.5) * 0.14).toFixed(4)), Number(((light.horizon[2] - 0.5) * 0.14).toFixed(4))]);
  return {
    frame: {
      width: w, height: h, lumaGrid,
      pixelsSha256: digestFn({ width: w, height: h, lumaGrid, source: 'low-water' }),
      transfer: 'srgb-u8', source: 'low-water', sunLight: light,
    },
    palette: { oklab, hex: light.hex, mix: light.hex[1], ground: light.hex[0] },
  };
}
