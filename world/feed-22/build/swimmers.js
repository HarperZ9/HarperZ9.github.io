// swimmers.js: a small closed ecosystem of swimmers, streamers and pellets.
//
// Rules (our own, written from watching the reference, not copied from it):
//   1. Swimmers feed on a dissolved nutrient pool and grow. Small ones swim head first and bounce off pellets.
//   2. At flipMass a swimmer turns round: it reverses its swimming direction and sprouts two streamers that
//      trail behind it as Verlet chains. Streamer length is stored mass.
//   3. A grown swimmer that touches a pellet latches and pecks: a lunge every pecking period. Each peck moves
//      peckCost of streamer into the pellet. When the streamer is spent the swimmer is absorbed whole.
//   4. Pellets leak mass back into the pool, bud tiny swimmers, and divide in two past splitMass. A dividing
//      pellet spends splitTime as a joined pair (the peanut stage) before the halves part.
// Mass is conserved: swimmers + streamers + pellets + pool is constant, so the ecosystem cannot run away.
// The world wraps at its edges. Dependency-free ES module, no DOM.

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export const DEFAULTS = {
  W: 1000, H: 640, flipMass: 3, maxMass: 5, growth: 0.35, pool0: 40, speedSmall: 70, speedBig: 38, wander: 2.2,
  sense: 140, streamerPerMass: 30, segLen: 7, maxSegs: 18, peckPeriod: 0.42, peckCost: 0.8, peckLunge: 9,
  leak: 0.012, budRate: 0.05, budMass: 0.6, budMin: 6, splitMass: 26, splitTime: 1.6, pelletRadius: 7.5, swimmerRadius: 3.2,
};

const TAU = Math.PI * 2;

export class World {
  constructor(opts = {}) {
    this.o = { ...DEFAULTS, ...opts }; this.r = rng(opts.seed ?? 1); this.t = 0; this.nextId = 1;
    this.swimmers = []; this.pellets = []; this.pool = this.o.pool0; this.events = [];
    const { pellets = 6, swimmers = 40 } = opts;
    for (let i = 0; i < pellets; i++) this.pellets.push(this._pellet(this.o.W / 2 + (this.r() - 0.5) * 220, this.o.H / 2 + (this.r() - 0.5) * 160, 10 + this.r() * 8));
    for (let i = 0; i < swimmers; i++) this.swimmers.push(this._swimmer(this.r() * this.o.W, this.r() * this.o.H, 0.6 + this.r() * 2.2));
  }
  _pellet(x, y, mass) { return { id: this.nextId++, x, y, vx: 0, vy: 0, mass, split: null }; }
  _swimmer(x, y, mass) {
    return { id: this.nextId++, x, y, th: this.r() * TAU, dir: 1, mass, streamer: 0, state: 'swim', target: null, peckClock: 0, lunge: 0, tails: [[], []] };
  }
  radiusOf(p) { return this.o.pelletRadius * Math.sqrt(p.mass / 4); }
  totalMass() { return this.pool + this.swimmers.reduce((s, w) => s + w.mass + w.streamer, 0) + this.pellets.reduce((s, p) => s + p.mass, 0); }
  // Attention as food: a viewer may drop a pellet, paid for out of the pool. Refused when the pool is short.
  addPellet(x, y, mass = 8) {
    if (this.pool < mass) return null;
    this.pool -= mass; const p = this._pellet(x, y, mass); this.pellets.push(p); return p;
  }
  wrap(a, L) { return ((a % L) + L) % L; }
  delta(a, b, L) { let d = b - a; if (d > L / 2) d -= L; if (d < -L / 2) d += L; return d; }

  step(dt = 1 / 60) {
    this.t += dt; this.events.length = 0;
    this._pellets(dt);
    for (const s of [...this.swimmers]) this._swimmer_step(s, dt);
    for (const s of this.swimmers) this._tails(s);
  }

  _pellets(dt) {
    const o = this.o, ps = this.pellets;
    let cx = 0, cy = 0; for (const p of ps) { cx += p.x; cy += p.y; } cx /= ps.length || 1; cy /= ps.length || 1;
    for (const p of ps) {
      const leak = Math.min(p.mass - 0.5, p.mass * o.leak * dt); if (leak > 0) { p.mass -= leak; this.pool += leak; }
      if (p.mass > o.budMin && this.r() < o.budRate * dt * (p.mass / 10)) {
        p.mass -= o.budMass; const a = this.r() * TAU, rr = this.radiusOf(p) + 6;
        const b = this._swimmer(this.wrap(p.x + Math.cos(a) * rr, o.W), this.wrap(p.y + Math.sin(a) * rr, o.H), o.budMass); b.th = a; this.swimmers.push(b);
        this.events.push({ kind: 'bud', pellet: p.id, swimmer: b.id });
      }
      if (!p.split && p.mass > o.splitMass) p.split = { t: 0, a: this.r() * Math.PI };
      // a gentle pull to the colony centre plus soft repulsion between pellets: they clump without merging
      p.vx += (cx - p.x) * 0.02 * dt; p.vy += (cy - p.y) * 0.02 * dt;
    }
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j], dx = this.delta(a.x, b.x, o.W), dy = this.delta(a.y, b.y, o.H), d = Math.hypot(dx, dy) || 1e-6, min = this.radiusOf(a) + this.radiusOf(b);
      if (d < min) { const f = ((min - d) / d) * 1.5; a.vx -= dx * f * dt; a.vy -= dy * f * dt; b.vx += dx * f * dt; b.vy += dy * f * dt; }
    }
    for (const p of [...ps]) {
      p.vx *= 0.96; p.vy *= 0.96; p.x = this.wrap(p.x + p.vx, o.W); p.y = this.wrap(p.y + p.vy, o.H);
      if (p.split) { p.split.t += dt; if (p.split.t >= o.splitTime) this._divide(p); }
    }
  }

  _divide(p) {
    const o = this.o, half = p.mass / 2, r = this.radiusOf({ mass: half }), dx = Math.cos(p.split.a) * r * 0.9, dy = Math.sin(p.split.a) * r * 0.9;
    const a = this._pellet(this.wrap(p.x - dx, o.W), this.wrap(p.y - dy, o.H), half), b = this._pellet(this.wrap(p.x + dx, o.W), this.wrap(p.y + dy, o.H), p.mass - half);
    this.pellets.splice(this.pellets.indexOf(p), 1, a, b); this.events.push({ kind: 'split', pellet: p.id, into: [a.id, b.id] });
  }

  _nearestPellet(s) {
    let best = null, bd = Infinity;
    for (const p of this.pellets) { const d = Math.hypot(this.delta(s.x, p.x, this.o.W), this.delta(s.y, p.y, this.o.H)) - this.radiusOf(p); if (d < bd) { bd = d; best = p; } }
    return { p: best, d: bd };
  }

  _swimmer_step(s, dt) {
    const o = this.o;
    if (s.state === 'peck') return this._peck(s, dt);
    // feed from the pool
    const want = Math.min(o.maxMass - s.mass, o.growth * dt * Math.min(1, this.pool / o.pool0));
    if (want > 0 && this.pool >= want) { s.mass += want; this.pool -= want; }
    // turn round and sprout streamers at flipMass; streamer is paid for out of body mass
    if (s.dir === 1 && s.mass >= o.flipMass) { s.dir = -1; s.th += Math.PI; this.events.push({ kind: 'flip', swimmer: s.id }); }
    if (s.dir === -1) { const grow = Math.min(s.mass - o.flipMass * 0.8, 0.8 * dt); if (grow > 0 && s.streamer < (s.mass - 1) * 1.2) { s.mass -= grow; s.streamer += grow; } }
    const { p, d } = this._nearestPellet(s);
    s.th += (this.r() - 0.5) * o.wander * dt * 2;
    if (p && s.dir === -1 && d < o.sense) { // grown swimmers back toward food: their front is now their old tail
      const want = Math.atan2(this.delta(s.y, p.y, o.H), this.delta(s.x, p.x, o.W)) + Math.PI;
      let e = want - s.th; e = Math.atan2(Math.sin(e), Math.cos(e)); s.th += e * Math.min(1, 3 * dt);
    }
    const sp = s.dir === 1 ? o.speedSmall : o.speedBig, hx = Math.cos(s.th) * s.dir, hy = Math.sin(s.th) * s.dir;
    s.x = this.wrap(s.x + hx * sp * dt, o.W); s.y = this.wrap(s.y + hy * sp * dt, o.H);
    if (p && d < o.swimmerRadius) {
      if (s.dir === -1 && s.streamer > 0.05) { s.state = 'peck'; s.target = p.id; s.peckClock = 0; this.events.push({ kind: 'latch', swimmer: s.id, pellet: p.id }); }
      else { const nx = this.delta(p.x, s.x, o.W), ny = this.delta(p.y, s.y, o.H), n = Math.hypot(nx, ny) || 1, push = this.radiusOf(p) + o.swimmerRadius + 0.5 - n; s.x = this.wrap(s.x + (nx / n) * push, o.W); s.y = this.wrap(s.y + (ny / n) * push, o.H); s.th = Math.atan2(ny, nx); }
    }
  }

  _peck(s, dt) {
    const o = this.o, p = this.pellets.find((q) => q.id === s.target);
    if (!p) { s.state = 'swim'; s.target = null; return; } // the pellet divided under it: let go
    const dx = this.delta(p.x, s.x, o.W), dy = this.delta(p.y, s.y, o.H), n = Math.hypot(dx, dy) || 1, rest = this.radiusOf(p) + o.swimmerRadius;
    s.peckClock += dt; s.lunge *= Math.exp(-dt / 0.08);
    if (s.peckClock >= o.peckPeriod) {
      s.peckClock -= o.peckPeriod; const bite = Math.min(s.streamer, o.peckCost * o.peckPeriod); s.streamer -= bite; p.mass += bite; s.lunge = o.peckLunge;
      this.events.push({ kind: 'peck', swimmer: s.id, pellet: p.id, bite });
      if (s.streamer <= 1e-9) { p.mass += s.mass + s.streamer; s.streamer = 0; this.swimmers.splice(this.swimmers.indexOf(s), 1); this.events.push({ kind: 'absorb', swimmer: s.id, pellet: p.id }); return; }
    }
    const r = rest + 2 - s.lunge * 0.5; s.x = this.wrap(p.x + (dx / n) * r, o.W); s.y = this.wrap(p.y + (dy / n) * r, o.H); s.th = Math.atan2(dy, dx); // tail points away from the pellet
  }

  // Two streamers per grown swimmer as Verlet chains. Segment count follows stored streamer mass.
  _tails(s) {
    const o = this.o, segs = Math.min(o.maxSegs, Math.ceil(s.streamer * o.streamerPerMass / o.segLen));
    const bx = -Math.cos(s.th) * s.dir, by = -Math.sin(s.th) * s.dir, px = -by, py = bx;
    for (let k = 0; k < 2; k++) {
      const tail = s.tails[k], side = k ? 1 : -1, ax = s.x + bx * 4 + px * side * 2.2, ay = s.y + by * 4 + py * side * 2.2;
      while (tail.length > segs) tail.pop();
      while (tail.length < segs) { const last = tail[tail.length - 1] ?? { x: ax, y: ay }; tail.push({ x: last.x + bx * o.segLen, y: last.y + by * o.segLen, px: last.x + bx * o.segLen, py: last.y + by * o.segLen }); }
      let prev = { x: ax, y: ay };
      for (let i = 0; i < tail.length; i++) {
        const q = tail[i], vx = (q.x - q.px) * 0.86, vy = (q.y - q.py) * 0.86; q.px = q.x; q.py = q.y;
        q.x += vx + px * side * 0.04 * Math.sin(this.t * 6 + i * 0.7); q.y += vy + py * side * 0.04 * Math.sin(this.t * 6 + i * 0.7);
        // unwrapped chains: pull each node to segLen from the previous one, measured across the wrap seam
        let dx = q.x - prev.x, dy = q.y - prev.y;
        if (dx > o.W / 2) q.x -= o.W, q.px -= o.W; if (dx < -o.W / 2) q.x += o.W, q.px += o.W; if (dy > o.H / 2) q.y -= o.H, q.py -= o.H; if (dy < -o.H / 2) q.y += o.H, q.py += o.H;
        dx = q.x - prev.x; dy = q.y - prev.y; const d = Math.hypot(dx, dy) || 1e-6; q.x = prev.x + (dx / d) * o.segLen; q.y = prev.y + (dy / d) * o.segLen;
        prev = q;
      }
    }
  }
}

// Splat the world into two scalar fields on an R-wide grid: heat (bodies, cores) and cool (streamers, rims).
// A renderer maps heat through a ramp and adds cool as a second ink. Returns { heat, cool, w, h }.
export function splat(world, w = 250) {
  const o = world.o, h = Math.round((w * o.H) / o.W), sx = w / o.W, heat = new Float32Array(w * h), cool = new Float32Array(w * h);
  const dab = (F, x, y, r, a) => {
    const gx = x * sx, gy = y * sx, rr = Math.max(0.6, r * sx), R = Math.ceil(rr * 2.5);
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      const X = ((Math.floor(gx) + i) % w + w) % w, Y = ((Math.floor(gy) + j) % h + h) % h, d2 = ((Math.floor(gx) + i - gx) ** 2 + (Math.floor(gy) + j - gy) ** 2) / (rr * rr);
      if (d2 < 6) F[Y * w + X] += a * Math.exp(-d2);
    }
  };
  for (const p of world.pellets) {
    const r = world.radiusOf(p), k = p.split ? Math.min(1, p.split.t / o.splitTime) : 0;
    const parts = p.split ? [-1, 1].map((sg) => [p.x + Math.cos(p.split.a) * r * 0.55 * k * sg, p.y + Math.sin(p.split.a) * r * 0.55 * k * sg, r * (1 - 0.25 * k)]) : [[p.x, p.y, r]];
    for (const [x, y, rr] of parts) {
      dab(heat, x, y, rr * 0.75, 1.0); dab(heat, x, y, rr * 0.3, 0.8);
      const beads = Math.max(10, Math.round(rr * 1.6));
      for (let b = 0; b < beads; b++) { const a = (b / beads) * TAU + world.t * 0.3; dab(cool, x + Math.cos(a) * rr * 1.05, y + Math.sin(a) * rr * 1.05, 0.9, 0.5); }
    }
  }
  for (const s of world.swimmers) {
    const hx = Math.cos(s.th) * s.dir, hy = Math.sin(s.th) * s.dir, size = 1.8 + s.mass * 0.6;
    dab(heat, s.x + hx * 2, s.y + hy * 2, size * 0.8, 0.55); dab(cool, s.x - hx * 2, s.y - hy * 2, size, 0.45);
    for (const tail of s.tails) {
      let prev = { x: s.x - hx * 4, y: s.y - hy * 4 };
      tail.forEach((q, i) => { // dab along each link so the streamer reads as a line, thinning toward the tip
        const a = 0.5 * (1 - i / (tail.length + 2)), steps = Math.max(2, Math.ceil(Math.hypot(q.x - prev.x, q.y - prev.y) * sx * 1.5));
        for (let k = 1; k <= steps; k++) dab(cool, prev.x + ((q.x - prev.x) * k) / steps, prev.y + ((q.y - prev.y) * k) / steps, 1.2 - i * 0.04, a);
        prev = q;
      });
    }
  }
  return { heat, cool, w, h };
}
