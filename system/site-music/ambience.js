// ambience.js: sea, wind and open air, made from noise and filters. No recordings.
//   sea    each wave is an event: a slow swell, a break and a wash of foam. The time between waves is drawn from 7 to 13
//          seconds, so the period is slow and never regular. The swell opens a low-pass filter on the noise (dull far out,
//          bright at the break) and the foam is a band of high noise that rises just after the break and thins out.
//          Each wave breaks at its own place across the stereo field.
//   wind   a band of noise whose centre and level wander on slow seeded curves (gusts of 5 to 20 seconds)
//   air    a very quiet band above 5 kHz that breathes slowly: the hiss of a wide open space
// createAmbience() returns a generator with state, so a long piece can be rendered in chunks that join without a seam:
// render(n) always continues from where the last call stopped.
import { rng } from '../../world/sound/sound/v3/instruments/core.js';

// A smooth random curve in 0..1: seeded values at whole numbers, joined by a cosine.
function wander(seed) { const cache = new Map(), v = (i) => { if (!cache.has(i)) { const r = rng((seed + i * 7919) >>> 0 || 1); r(); cache.set(i, r()); if (cache.size > 64) cache.delete(cache.keys().next().value); } return cache.get(i); };
  return (x) => { const i = Math.floor(x), f = x - i, c = 0.5 - 0.5 * Math.cos(Math.PI * f); return v(i) * (1 - c) + v(i + 1) * c; }; }

class OnePole { constructor() { this.y = 0; } lp(x, a) { this.y += a * (x - this.y); return this.y; } }
const coef = (fc, sr) => 1 - Math.exp(-2 * Math.PI * fc / sr);

export const DEFAULTS = { sea: 1, wind: 0.5, air: 0.4, period: [7, 13] };

export function createAmbience({ seed = 1, sr = 48000, sea = 1, wind = 0.5, air = 0.4, period = [7, 13] } = {}) {
  const r = rng(seed * 2654435761 >>> 0 || 1), noise = rng((seed + 99) * 40503 >>> 0 || 1), waves = [], gust = wander(seed + 11), tilt = wander(seed + 23), breath = wander(seed + 37);
  let n0 = 0, nextWave = 0.5 * sr;
  const F = () => ({ a: new OnePole(), b: new OnePole() }), seaL = F(), seaR = F(), foamL = F(), foamR = F(), deep = F(), windL = [new OnePole(), new OnePole(), new OnePole()], windR = [new OnePole(), new OnePole(), new OnePole()], airL = new OnePole(), airR = new OnePole(), sub = new OnePole(), cDeep = coef(90, sr), cSub = coef(25, sr), cAir = coef(6000, sr);
  const spawn = (at) => { const swell = (2.6 + 2.2 * r()) * sr, wash = (3.5 + 3 * r()) * sr; waves.push({ at, swell, wash, size: 0.55 + 0.45 * r(), pan: (r() - 0.5) * 1.2, travel: (r() - 0.5) * 0.5 }); return at + (period[0] + (period[1] - period[0]) * r()) * sr; };
  function render(n) {
    const L = new Float32Array(n), R = new Float32Array(n); let cs = 0, cf = 0, cw = 0, cw2 = 0, gS = 0, gF = 0, pan = 0, gW = 0, gA = 0;
    for (let i = 0; i < n; i++) {
      const t = n0 + i;
      if (i % 32 === 0) {   // control rate: envelopes and filter settings every 32 samples
        while (nextWave <= t + sr) nextWave = spawn(nextWave);
        let body = 0, foam = 0, pw = 0, ps = 0;
        for (let k = waves.length - 1; k >= 0; k--) { const w = waves[k], u = t - w.at; if (u < 0) continue; if (u > w.swell + w.wash) { waves.splice(k, 1); continue; }
          const up = u < w.swell ? Math.pow(u / w.swell, 2.4) : Math.exp(-(u - w.swell) / (w.wash * 0.42)), fo = u < w.swell * 0.92 ? 0 : (1 - Math.exp(-(u - w.swell * 0.92) / (0.25 * sr))) * Math.exp(-(u - w.swell) / (w.wash * 0.3));
          body += w.size * up; foam += w.size * Math.max(0, fo); pw += w.size * up * (w.pan + w.travel * u / (w.swell + w.wash)); ps += w.size * up; }
        const sec = t / sr; pan = ps > 0 ? Math.max(-0.8, Math.min(0.8, pw / ps)) : 0;
        gS = sea * (0.1 + 0.9 * Math.min(1.3, body)); gF = sea * 0.5 * Math.min(1.2, foam); cs = coef(220 + 1500 * Math.pow(Math.min(1.2, body), 1.4), sr); cf = coef(2600, sr);
        const g = gust(sec / 9), tl = tilt(sec / 14); gW = wind * (0.12 + 0.88 * g * g); cw = coef(260 + 520 * tl, sr); cw2 = coef(1200 + 1400 * tl, sr); gA = air * (0.6 + 0.4 * breath(sec / 17));
      }
      const c = noise() * 2 - 1, a = noise() * 2 - 1, b = noise() * 2 - 1, l = 0.6 * c + 0.8 * a, rr = 0.6 * c + 0.8 * b;   // part shared, part separate: wide but safe in mono
      const sl = seaL.b.lp(seaL.a.lp(l, cs), cs), sr2 = seaR.b.lp(seaR.a.lp(rr, cs), cs), fl = a - foamL.a.lp(a, cf), fr = b - foamR.a.lp(b, cf), d0 = deep.b.lp(deep.a.lp(c, cDeep), cDeep), dp = d0 - sub.lp(d0, cSub);   // the rumble, with everything under 25 Hz taken out
      const wl0 = windL[2].lp(windL[1].lp(l, cw2), cw2), wr0 = windR[2].lp(windR[1].lp(rr, cw2), cw2), wl = wl0 - windL[0].lp(wl0, cw), wr = wr0 - windR[0].lp(wr0, cw), al = a - airL.lp(a, cAir), ar = b - airR.lp(b, cAir);
      const pl = 1 - 0.5 * Math.max(0, pan), pr = 1 + 0.5 * Math.min(0, pan);
      L[i] = (sl * 2.2 * gS + fl * 0.07 * gF) * pl + dp * 1.6 * sea * (0.3 + 0.7 * Math.min(1, gS)) + wl * 0.55 * gW + al * 0.009 * gA;
      R[i] = (sr2 * 2.2 * gS + fr * 0.07 * gF) * pr + dp * 1.6 * sea * (0.3 + 0.7 * Math.min(1, gS)) + wr * 0.55 * gW + ar * 0.009 * gA;
    }
    n0 += n; return { L, R };
  }
  return { render, get position() { return n0 / sr; } };
}
