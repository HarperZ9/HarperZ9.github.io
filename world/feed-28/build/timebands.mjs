// timebands.mjs: one stretch of sea, cut into horizontal bands, each band lit at a different hour of the same day.
// After the RaminNasibov clip in feed set 28 (four strips of sea footage labelled 09:00, 12:00, 16:00, 18:00). We keep
// the idea (time folded into space: a slit-scan across the day) and build everything else from physics:
//   - Water: a sum of directional deep-water waves. Each wave's angular frequency is a whole multiple of 2 pi / T, so
//     the surface repeats exactly every T seconds, and its wavenumber obeys deep-water dispersion k = omega^2 / g.
//   - Light: the sun's elevation and azimuth from a standard solar position model (declination and hour angle, for a
//     date and latitude); sky colour by elevation; Schlick Fresnel at n = 1.33; a sun glint from the reflected ray
//     (a Blinn lobe whose width follows the wave slope spread), so a low sun ahead of the camera lays a long glitter path.
//   - Every band shows the same window of sea (view rays from 2.5 to 13 degrees below the horizon, where a low sun
//     lays its path), at the same instant: the waves in all bands are identical and only the light differs, so the
//     bands compare directly. The seams are exact cuts.
//   - Band heights follow the clock: each band is as tall as the time until the next band's hour (the last until
//     sunset), with a floor of 0.14 of the frame so the evening bands stay readable. The frame is a time axis, which
//     also keeps it apart from the reference's four equal strips (the similarity gate read 0.593 structure against
//     0.60 with equal strips).
// Labels (the hours) are real page text over the art, never pixels in it.
import { raster, clamp, rng } from '../../feed-29/build/lib/field.mjs';
import { mixLin, hexLin } from '../../feed-29/build/lib/color.mjs';

const G = 9.81, TAU = Math.PI * 2;
export const SPEC = {
  id: 'light.timebands',
  params: {
    w: { min: 64, max: 4096, default: 1280, unit: 'px' }, h: { min: 64, max: 4096, default: 960, unit: 'px' },
    hours: { default: [6.0, 12.5, 18.3, 19.7], unit: 'local solar hours, one per band, top to bottom' },
    lat: { min: -66, max: 66, default: 47.6, unit: 'deg' }, day: { min: 1, max: 365, default: 172, unit: 'day of year' },
    loop: { min: 2, max: 30, default: 6, unit: 's (exact repeat of the surface)' }, waves: { min: 4, max: 64, default: 28, unit: 'count' },
    facing: { min: 0, max: 360, default: 296, unit: 'deg compass bearing of the camera' }, seed: { default: 'sea', unit: 'string' },
  },
  determinism: 'the same seed and t give the same frame; t and t + loop give the same frame (tests/timebands.test.mjs)',
};

// Solar position (Cooper's declination, hour angle 15 deg per hour from solar noon). Returns elevation and azimuth in
// radians; azimuth is the compass bearing (0 north, 90 east).
export function sun(hour, lat = 47.6, day = 172) {
  const d = 23.44 * Math.PI / 180 * Math.sin(TAU * (284 + day) / 365), H = (hour - 12) * 15 * Math.PI / 180, f = lat * Math.PI / 180;
  const el = Math.asin(Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.cos(H));
  let az = Math.acos(clamp((Math.sin(d) - Math.sin(el) * Math.sin(f)) / (Math.cos(el) * Math.cos(f)), -1, 1)); if (H > 0) az = TAU - az;
  return { el, az };
}

// The wave set: directions spread about the wind, amplitudes from a falling spectrum, omega = 2 pi n / T.
export function waveSet({ loop = 6, waves = 28, seed = 'sea' } = {}) {
  const r = rng(seed), W = [];
  for (let i = 0; i < waves; i++) {
    const n = 2 + Math.floor(r() * 9 + i * 0.6), om = TAU * n / loop, k = om * om / G, dir = -0.6 + 1.2 * r() + (r() < 0.2 ? Math.PI * 0.5 : 0);
    W.push({ om, k, kx: k * Math.cos(dir), kz: k * Math.sin(dir), amp: 0.55 / Math.pow(k * 8, 1.15) * (0.6 + 0.4 * r()), ph: r() * TAU });
  }
  return W;
}

// Sky colour seen at elevation e (rad) when the sun is at elevation se: a warm low sun reddens the horizon.
// cs is the cosine between the sky direction and the sun (a circumsolar brightening, warmer when the sun is low).
function sky(e, se, cs) {
  const day = clamp(se / 0.5), warm = 1 - clamp(se / 0.35), zen = mixLin(hexLin('#2a3f6e'), hexLin('#4f86c6'), day), hor = mixLin(hexLin('#e98a52'), hexLin('#cfe0ea'), 1 - warm);
  const base = mixLin(hor, zen, clamp(e / 0.6) ** 0.6), halo = Math.pow(clamp(cs), 12) * (0.6 + 1.6 * warm), hc = mixLin(hexLin('#ffb070'), [1, 0.98, 0.94], day);
  return base.map((v, i) => (v + hc[i] * halo) * (0.35 + 0.65 * clamp(se / 0.2 + 0.3)));
}

// Row edges of the bands (length hours + 1). Spans run to the next hour; the last runs to sunset (elevation 0).
export function bandEdges(hours, lat = 47.6, day = 172, h = 1) {
  let set = hours[hours.length - 1]; while (set < 24 && sun(set, lat, day).el > 0) set += 1 / 60;
  const span = hours.map((hr, i) => Math.max(0.05, (i + 1 < hours.length ? hours[i + 1] : set) - hr)), tot = span.reduce((a, b) => a + b, 0);
  let f = span.map(v => Math.max(0.14, v / tot)); const k = f.reduce((a, b) => a + b, 0); f = f.map(v => v / k);
  const Y = [0]; f.forEach(v => Y.push(Y[Y.length - 1] + v)); return Y.map(v => Math.round(v * h));
}

export function frame(t, o = {}) {
  const p = { w: 1280, h: 960, hours: [6.0, 12.5, 18.3, 19.7], lat: 47.6, day: 172, loop: 6, waves: 28, facing: 296, seed: 'sea', ...o };
  const { w, h } = p, R = raster(w, h), W = p.W ?? waveSet(p), bands = p.hours.length, f = 0.9 * w, eyeY = 3.2;
  const face = p.facing * Math.PI / 180, suns = p.hours.map(hr => { const s = sun(hr, p.lat, p.day), rel = s.az - face; return { ...s, dir: [Math.sin(rel) * Math.cos(s.el), Math.sin(s.el), Math.cos(rel) * Math.cos(s.el)], col: mixLin(hexLin('#ff8a3c'), [1, 0.97, 0.92], clamp(s.el / 0.6)) }; });
  const body = hexLin('#0d3a45'), tt = ((t % p.loop) + p.loop) % p.loop, Y = bandEdges(p.hours, p.lat, p.day, h);
  for (let y = 0; y < h; y++) {
    let b = 0; while (b < bands - 1 && y >= Y[b + 1]) b++; const S = suns[b];
    // every band maps its own rows onto the same window of view rays (2.5 to 13 deg below the horizon)
    const yl = (y - Y[b]) / (Y[b + 1] - Y[b]), vy = -Math.tan((2.5 + 10.5 * yl) * Math.PI / 180);
    for (let x = 0; x < w; x++) {
      const vx = (x - w / 2) / f, len = Math.hypot(vx, vy, 1), dx = vx / len, dy = vy / len, dz = 1 / len, dist = eyeY / -dy, X = dx * dist, Z = dz * dist;
      // wave LOD: a wave shorter than about two pixels' footprint is faded out (anti-aliasing by construction)
      const foot = dist * len / f;
      let sx = 0, sz = 0; for (const q of W) { const lod = Math.exp(-((q.k * foot) ** 2)); if (lod < 1e-3) continue; const a = q.kx * X + q.kz * Z - q.om * tt + q.ph, c = lod * q.amp * q.k * Math.cos(a); sx += c * q.kx / q.k; sz += c * q.kz / q.k; }
      const fade = clamp(1 - dist / 400), nx = -sx * fade, nz = -sz * fade, nl = Math.hypot(nx, 1, nz), N = [nx / nl, 1 / nl, nz / nl];
      const vn = dx * N[0] + dy * N[1] + dz * N[2], Rf = [dx - 2 * vn * N[0], dy - 2 * vn * N[1], dz - 2 * vn * N[2]], cosi = clamp(-vn, 0, 1), F = 0.02 + 0.98 * (1 - cosi) ** 5;
      const cosg = Rf[0] * S.dir[0] + Rf[1] * S.dir[1] + Rf[2] * S.dir[2], env = sky(Math.max(0, Math.asin(clamp(Rf[1], -1, 1))), S.el, cosg);
      const glint = S.el > -0.05 && cosg > 0.99 ? Math.pow(cosg, 1400) * 30 * clamp(S.el / 0.05 + 0.4) : 0;
      // low sun: the whole scene takes the sun's colour (the light has crossed more air)
      const lit = 0.25 + 0.75 * clamp(S.el / 0.6 + 0.2), k = 3 * (y * w + x), tint = mixLin(S.col, [1, 1, 1], 0.25 + 0.75 * clamp(S.el / 0.45));
      for (let c = 0; c < 3; c++) { const v = (body[c] * (1 - F) * lit * (0.6 + 0.4 * env[c] / 0.6) + env[c] * F) * tint[c] + S.col[c] * glint * F * 4; R.px[k + c] = v / (1 + 0.35 * v); } // soft shoulder: glints roll off
    }
  }
  R.bands = suns.map((s, i) => ({ hour: p.hours[i], y0: Y[i], y1: Y[i + 1], el: s.el, az: s.az }));
  return R;
}
