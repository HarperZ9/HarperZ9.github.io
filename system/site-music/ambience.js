// ambience.js: sea, wind and open air, made from noise and filters. No recordings.
//   sea    each wave is an event: a slow swell, a break and a wash of foam. The time between waves is drawn from 7 to 13
//          seconds, so the period is slow and never regular. The swell opens a low-pass filter on the noise (dull far out,
//          bright at the break) and the foam is a band of high noise that rises just after the break and thins out.
//          Each wave breaks at its own place across the stereo field.
//   wind   a band of noise whose centre and level wander on slow seeded curves (gusts of 5 to 20 seconds)
//   air    a very quiet band above 6 kHz that breathes slowly: the hiss of a wide open space
// The sea listens to the music. cue() tells it when the lead plays and when it falls silent; then
//   - a wave that is due near the start of a rest is moved so that it breaks just as the rest begins
//   - while the lead plays, sea, wind and air drop by up to 2.9 dB and come back over about a second
//   - a tide and a breeze drift over a minute or so, so the first minute and the third do not sound alike
// createAmbience() returns a generator with state, so a long piece can be rendered in chunks that join without a seam:
// render(n) always continues from where the last call stopped. Times in cues are seconds on the generator's own clock.
import { rng } from '../../world/sound/sound/v3/instruments/core.js';

// A smooth random curve in 0..1: seeded values at whole numbers, joined by a cosine.
function wander(seed) { const cache = new Map(), v = (i) => { if (!cache.has(i)) { const r = rng((seed + i * 7919) >>> 0 || 1); r(); cache.set(i, r()); if (cache.size > 64) cache.delete(cache.keys().next().value); } return cache.get(i); };
  return (x) => { const i = Math.floor(x), f = x - i, c = 0.5 - 0.5 * Math.cos(Math.PI * f); return v(i) * (1 - c) + v(i + 1) * c; }; }

class OnePole { constructor() { this.y = 0; } lp(x, a) { this.y += a * (x - this.y); return this.y; } }
const coef = (fc, sr) => 1 - Math.exp(-2 * Math.PI * fc / sr);
export const DUCK = 0.28, SNAP = 3.5;   // share of level taken off under the lead; seconds a wave may move to meet a rest

export function createAmbience({ seed = 1, sr = 48000, sea = 1, wind = 0.5, air = 0.4, period = [7, 13], position = 0, responsive = true } = {}) {
  const r = rng(seed * 2654435761 >>> 0 || 1), noise = rng((seed + 99) * 40503 >>> 0 || 1), waves = [], gust = wander(seed + 11), tilt = wander(seed + 23), breath = wander(seed + 37), tide = wander(seed + 53), breeze = wander(seed + 71);
  const rests = [], lead = [], breaks = []; let n0 = 0, pending = null, duck = 0;
  const F = () => ({ a: new OnePole(), b: new OnePole() }), seaL = F(), seaR = F(), foamL = F(), foamR = F(), deep = F(), windL = [new OnePole(), new OnePole(), new OnePole()], windR = [new OnePole(), new OnePole(), new OnePole()], airL = new OnePole(), airR = new OnePole(), sub = new OnePole(), cDeep = coef(90, sr), cSub = coef(25, sr), cAir = coef(6000, sr);
  const draw = (at) => ({ at, nominal: at, swell: 2.6 + 2.2 * r(), wash: 3.5 + 3 * r(), size: 0.55 + 0.45 * r(), pan: (r() - 0.5) * 1.2, travel: (r() - 0.5) * 0.5, gap: period[0] + (period[1] - period[0]) * r() });
  pending = draw(0.5);
  // move the pending wave so it breaks 0.2 s into the nearest rest, when that is within SNAP seconds and still ahead
  function meet(now) { if (!responsive || pending.met) return; const brk = pending.nominal + pending.swell; let best = null;
    for (const t of rests) if (Math.abs(t + 0.2 - brk) <= SNAP && t + 0.2 - pending.swell >= now && (best === null || Math.abs(t + 0.2 - brk) < Math.abs(best + 0.2 - brk))) best = t;
    if (best !== null) { pending.at = best + 0.2 - pending.swell; pending.met = true; } }
  function advance(sec) { meet(sec); while (pending.at <= sec) { const w = pending; waves.push(w); breaks.push(w.at + w.swell); if (breaks.length > 400) breaks.shift(); pending = draw(Math.max(w.nominal, w.at) + w.gap); meet(sec); } }
  if (position > 0) { for (let s = 0; s < position; s += 0.25) advance(s); waves.length = 0; n0 = Math.round(position * sr); }   // resume a long listen at another sample rate
  function render(n) {
    const L = new Float32Array(n), R = new Float32Array(n); let cs = 0, cf = 0, cw = 0, cw2 = 0, gS = 0, gF = 0, pan = 0, gW = 0, gA = 0, gD = 0; const ka = 1 - Math.exp(-32 / (0.15 * sr)), kr = 1 - Math.exp(-32 / (0.9 * sr));
    for (let i = 0; i < n; i++) {
      if (i % 32 === 0) {   // control rate: envelopes and filter settings every 32 samples
        const sec = (n0 + i) / sr; advance(sec);
        let body = 0, foam = 0, pw = 0, ps = 0;
        for (let k = waves.length - 1; k >= 0; k--) { const w = waves[k], u = sec - w.at; if (u < 0) continue; if (u > w.swell + w.wash) { waves.splice(k, 1); continue; }
          const up = u < w.swell ? Math.pow(u / w.swell, 2.4) : Math.exp(-(u - w.swell) / (w.wash * 0.42)), fo = u < w.swell * 0.92 ? 0 : (1 - Math.exp(-(u - w.swell * 0.92) / 0.25)) * Math.exp(-(u - w.swell) / (w.wash * 0.3));
          body += w.size * up; foam += w.size * Math.max(0, fo); pw += w.size * up * (w.pan + w.travel * u / (w.swell + w.wash)); ps += w.size * up; }
        while (lead.length && lead[0][1] < sec - 2) lead.shift(); while (rests.length && rests[0] < sec - 10) rests.shift();
        const playing = responsive && lead.some(([a, b]) => sec >= a && sec <= b) ? 1 : 0; duck += (playing > duck ? ka : kr) * (playing - duck); const under = 1 - DUCK * duck, seaNow = sea * (0.8 + 0.4 * tide(sec / 70)) * under, windNow = wind * (0.75 + 0.5 * breeze(sec / 55)) * under;
        pan = ps > 0 ? Math.max(-0.8, Math.min(0.8, pw / ps)) : 0;
        gS = seaNow * (0.1 + 0.9 * Math.min(1.3, body)); gF = seaNow * 0.5 * Math.min(1.2, foam); gD = sea * (0.3 + 0.7 * Math.min(1, gS)); cs = coef(220 + 1500 * Math.pow(Math.min(1.2, body), 1.4), sr); cf = coef(2600, sr);
        const g = gust(sec / 9), tl = tilt(sec / 14); gW = windNow * (0.12 + 0.88 * g * g); cw = coef(260 + 520 * tl, sr); cw2 = coef(1200 + 1400 * tl, sr); gA = air * under * (0.6 + 0.4 * breath(sec / 17));
      }
      const c = noise() * 2 - 1, a = noise() * 2 - 1, b = noise() * 2 - 1, l = 0.6 * c + 0.8 * a, rr = 0.6 * c + 0.8 * b;   // part shared, part separate: wide but safe in mono
      const sl = seaL.b.lp(seaL.a.lp(l, cs), cs), sr2 = seaR.b.lp(seaR.a.lp(rr, cs), cs), fl = a - foamL.a.lp(a, cf), fr = b - foamR.a.lp(b, cf), d0 = deep.b.lp(deep.a.lp(c, cDeep), cDeep), dp = d0 - sub.lp(d0, cSub);   // the rumble, with everything under 25 Hz taken out
      const wl0 = windL[2].lp(windL[1].lp(l, cw2), cw2), wr0 = windR[2].lp(windR[1].lp(rr, cw2), cw2), wl = wl0 - windL[0].lp(wl0, cw), wr = wr0 - windR[0].lp(wr0, cw), al = a - airL.lp(a, cAir), ar = b - airR.lp(b, cAir);
      const pl = 1 - 0.5 * Math.max(0, pan), pr = 1 + 0.5 * Math.min(0, pan);
      L[i] = (sl * 2.2 * gS + fl * 0.07 * gF) * pl + dp * 1.6 * gD + wl * 0.55 * gW + al * 0.012 * gA;
      R[i] = (sr2 * 2.2 * gS + fr * 0.07 * gF) * pr + dp * 1.6 * gD + wr * 0.55 * gW + ar * 0.012 * gA;
    }
    n0 += n; return { L, R };
  }
  // rests: seconds at which the lead falls silent; lead: [start, end] pairs in seconds while it plays
  function cue({ rests: rs = [], lead: ls = [] } = {}) { for (const t of rs) rests.push(t); for (const p of ls) lead.push(p); }
  return { render, cue, get position() { return n0 / sr; }, get breaks() { return breaks.slice(); }, get cues() { return { rests: rests.slice(), lead: lead.slice() }; } };
}
