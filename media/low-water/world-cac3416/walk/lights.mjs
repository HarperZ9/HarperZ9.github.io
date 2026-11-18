// Every lamp on the island that is near enough to matter. A lamp is a real source: it lights the
// ground and the walls, its cone shows in fog, rain and snow, and it is drawn as a point with a
// glow. Towns and the works add theirs as they are built; each frame the 64 that count most at
// the eye are sent to the shaders, the ones whose cones show in the air first.
//   add({ x, y, z, col: [r, g, b], power, reach, mono, aim: [x, y, z] | null, cone, size, flicker, haze, glow })
// power is the brightness one metre away; mono is the sodium share (1: value only, no hue);
// cone is the cosine of the half-angle; size is the lamp's own radius in metres, for its point;
// haze 0 keeps its light out of the air; glow scales the point alone.
export const MAX_LIGHTS = 64, CELL = 96, MAX_HAZE = 32;
// A lamp's power is written for its point of light. On a surface a metre away it gives this share
// of that, which puts lamp-lit snow near the top of the film curve at night and no higher.
const SURFACE = 0.10;
export const HUE = {
  sodium: [1.0, 0.56, 0.16], paraffin: [1.0, 0.72, 0.42], mercury: [0.55, 1.0, 0.72], white: [0.92, 0.96, 1.0],
  led: [0.62, 0.78, 1.0], red: [1.0, 0.10, 0.06], flare: [1.0, 0.48, 0.14], paper: [1.0, 0.80, 0.52],
};

export function makeLights() {
  const all = [], grid = new Map(), block = new ArrayBuffer(16 + MAX_LIGHTS * 48), head = new Uint32Array(block, 0, 4), f = new Float32Array(block, 16);
  let dirty = true, sprites = new Float32Array(0);
  function add(l) {
    const L = { mono: 0, aim: null, cone: -1, size: 0.12, flicker: 0, haze: 1, glow: 1, ...l };
    all.push(L);
    const key = Math.floor(L.x / CELL) * 65536 + Math.floor(L.z / CELL);
    let b = grid.get(key); if (!b) grid.set(key, b = []);
    b.push(L); dirty = true;
    return L;
  }
  const pick = [];
  // the lamps that count at the eye, into the uniform block; returns how many
  // `on` is how far the lamps have come on (0 by day, 1 at night); a flare burns all day
  function select(cam, fwd, reach = 260, on = 1) {
    pick.length = 0;
    const c0 = Math.floor((cam[0] - reach) / CELL), c1 = Math.floor((cam[0] + reach) / CELL), d0 = Math.floor((cam[2] - reach) / CELL), d1 = Math.floor((cam[2] + reach) / CELL);
    for (let cz = d0; cz <= d1; cz++) for (let cx = c0; cx <= c1; cx++) {
      const b = grid.get(cx * 65536 + cz); if (!b) continue;
      for (const L of b) {
        if (L.reach < 1) continue;                      // a lamp too small or far to light anything: a point only
        const dx = L.x - cam[0], dy = L.y - cam[1], dz = L.z - cam[2], d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > (reach + L.reach) * (reach + L.reach)) continue;
        // a lamp behind the walker still lights what is in front of it, so it only loses a little
        const ahead = (dx * fwd[0] + dy * fwd[1] + dz * fwd[2]) / Math.sqrt(d2 + 1e-6);
        L.score = L.power * L.reach * (0.6 + 0.4 * ahead) / (d2 + L.reach * L.reach * 0.15 + 9);
        pick.push(L);
      }
    }
    // haze lamps first, each kind by how much it counts; haze lamps may take at most MAX_HAZE places
    pick.sort((a, b) => b.score - a.score);
    const hazy = pick.filter((l) => l.haze > 0).slice(0, MAX_HAZE), taken = new Set(hazy), rest = pick.filter((l) => !taken.has(l)).slice(0, MAX_LIGHTS - hazy.length), chosen = hazy.concat(rest);
    for (let i = 0; i < chosen.length; i++) {
      const L = chosen[i], o = i * 12, a = L.aim || [0, -1, 0];
      f[o] = L.x; f[o + 1] = L.y; f[o + 2] = L.z; f[o + 3] = L.reach;
      const pw = L.power * SURFACE * (L.always ? 1 : on);
      f[o + 4] = L.col[0] * pw; f[o + 5] = L.col[1] * pw; f[o + 6] = L.col[2] * pw; f[o + 7] = L.mono;
      f[o + 8] = a[0]; f[o + 9] = a[1]; f[o + 10] = a[2]; f[o + 11] = L.aim ? L.cone : -1;
    }
    head[0] = chosen.length; head[1] = hazy.length; head[2] = 0; head[3] = 0;
    return chosen.length;
  }
  // every lamp as a point for the glow pass: x, y, z, size; r, g, b, flicker
  function spriteData() {
    if (!dirty) return { data: sprites, count: all.length, changed: false };
    sprites = new Float32Array(Math.max(1, all.length) * 8);
    all.forEach((L, i) => { const p = L.power * L.glow; sprites.set([L.x, L.y, L.z, L.size, L.col[0] * p, L.col[1] * p, L.col[2] * p, L.always ? -1 - L.flicker : L.flicker], i * 8); });
    dirty = false;
    return { data: sprites, count: all.length, changed: true };
  }
  return { all, add, select, spriteData, block };
}
