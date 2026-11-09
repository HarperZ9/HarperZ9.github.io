// sound.mjs: the sea, the wind, the rain and the thunder, made from physics with Web Audio rather than recordings.
// The models follow the DAW's nature module (superframe packages/daw, daw/nature.py) and its wave lab constants:
//   wind: vortex shedding off a cylinder sounds at f = St U / d with St = 0.2 (Strouhal 1878); here thin rigging,
//     wires and grass stems (2 to 12 mm) in the visitor's wind, over broadband noise that rises with U^2
//   rain: each drop that lands traps a bubble ringing at the Minnaert frequency f = sqrt(3 gamma p0 / rho) / (2 pi a)
//     (Minnaert 1933), about 3.26 kHz for a 1 mm bubble in water at one atmosphere, plus the impact's click
//   surf: low noise swelling at the waves' peak period, from the same JONSWAP spectrum the sea is drawn from
//   thunder: a rumble that arrives distance / 343 m/s after its flash (speed of sound in air at 20 C), duller the
//     farther it travels, since air absorbs high frequencies more
// Nothing plays until the visitor taps the Sound button; the same button mutes. No autoplay, ever.

export const SOUND_SPEED = 343;         // m/s, dry air at 20 C
export const STROUHAL = 0.2;
const GAMMA = 1.4, P0 = 101325, RHO = 998.2; // air's heat-capacity ratio; standard atmosphere, Pa; water at 20 C, kg/m3
export const minnaert = (radiusM) => Math.sqrt((3 * GAMMA * P0) / RHO) / (2 * Math.PI * radiusM);
export const aeolian = (wind, diameterM) => (STROUHAL * wind) / diameterM;
export const thunderDelay = (distanceM) => distanceM / SOUND_SPEED;

function noiseBuffer(ctx, seconds = 2, brown = false) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = brown ? (last + 0.02 * w) / 1.02 : w; d[i] = brown ? last * 3.5 : w; }
  return b;
}

export function createSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  const loop = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
  const white = noiseBuffer(ctx), brown = noiseBuffer(ctx, 3, true);
  // surf: brown noise through a low-pass, its level swelling at the peak period
  const surfF = ctx.createBiquadFilter(); surfF.type = "lowpass"; surfF.frequency.value = 420;
  const surfG = ctx.createGain(); surfG.gain.value = 0;
  loop(brown).connect(surfF).connect(surfG).connect(master);
  const swell = ctx.createOscillator(), swellG = ctx.createGain(); swell.frequency.value = 0.1; swellG.gain.value = 0;
  swell.connect(swellG).connect(surfG.gain); swell.start();
  // wind: broadband rush and three aeolian tones
  const rushF = ctx.createBiquadFilter(); rushF.type = "bandpass"; rushF.frequency.value = 500; rushF.Q.value = 0.6;
  const rushG = ctx.createGain(); rushG.gain.value = 0; loop(white).connect(rushF).connect(rushG).connect(master);
  const tones = [0.002, 0.005, 0.012].map(() => { const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 18; const g = ctx.createGain(); g.gain.value = 0; loop(white).connect(f).connect(g).connect(master); return { f, g }; });
  const rainBus = ctx.createGain(); rainBus.gain.value = 0.5; rainBus.connect(master);
  let state = { wind: 5, rain: 0, Tp: 6, breaking: 0 }, rainTimer = 0, on = false;

  function drop(t) {
    const a = 0.0004 + Math.random() * 0.0026; // bubble radius 0.4 to 3 mm
    const f = minnaert(a), o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.15, t + 0.04); // bubbles rise in pitch as they form
    const amp = 0.04 + Math.random() * 0.06;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + a * 20);
    o.connect(g).connect(rainBus); o.start(t); o.stop(t + 0.12);
    const c = ctx.createBufferSource(), cg = ctx.createGain(); c.buffer = white; cg.gain.setValueAtTime(amp * 0.5, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.006);
    c.connect(cg).connect(rainBus); c.start(t, Math.random(), 0.01);
  }
  function rainTick() {
    if (!on || state.rain <= 0) return;
    const rate = Math.min(400, state.rain * 40); // drops heard per second, rising with rain rate (mm/h)
    const now = ctx.currentTime; for (let i = 0; i < rate * 0.1; i++) drop(now + Math.random() * 0.1);
  }
  function apply() {
    const t = ctx.currentTime, U = state.wind;
    surfG.gain.setTargetAtTime(0.25 + 0.5 * Math.min(1, U / 20), t, 0.5);
    swell.frequency.setTargetAtTime(1 / Math.max(2, state.Tp), t, 0.5); swellG.gain.setTargetAtTime(0.15 + 0.3 * state.breaking, t, 0.5);
    surfF.frequency.setTargetAtTime(300 + 900 * state.breaking, t, 0.5);
    rushG.gain.setTargetAtTime(Math.min(0.5, 0.0012 * U * U), t, 0.5); rushF.frequency.setTargetAtTime(300 + 25 * U, t, 0.5);
    tones.forEach((x, i) => { x.f.frequency.setTargetAtTime(Math.min(8000, aeolian(U, [0.002, 0.005, 0.012][i])), t, 0.3); x.g.gain.setTargetAtTime(U > 6 ? Math.min(0.08, 0.0002 * U * U) : 0, t, 0.5); });
  }
  return {
    async start() { await ctx.resume(); on = true; master.gain.setTargetAtTime(0.6, ctx.currentTime, 0.4); apply(); clearInterval(rainTimer); rainTimer = setInterval(rainTick, 100); },
    stop() { on = false; master.gain.setTargetAtTime(0, ctx.currentTime, 0.2); clearInterval(rainTimer); },
    get playing() { return on; },
    set(s) { state = { ...state, ...s }; if (on) apply(); },
    // a strike distanceM away: the rumble arrives after the sound's travel time, duller with distance
    thunder(distanceM) {
      if (!on) return;
      const t = ctx.currentTime + thunderDelay(distanceM), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = brown; f.type = "lowpass"; f.frequency.value = Math.max(80, 900 - distanceM * 0.08);
      const amp = Math.min(1, 2500 / distanceM);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.05); g.gain.exponentialRampToValueAtTime(amp * 0.3, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 3 + distanceM / 3000);
      src.connect(f).connect(g).connect(master); src.start(t, Math.random(), 6);
    },
  };
}
