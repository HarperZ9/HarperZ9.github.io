// The drawn cards: boughs, twigs, fronds, blades, and the steelwork lattices of the works, each
// drawn by rule on a 2D canvas into one 2048 x 2048 sheet of sixteen cells. A tree's foliage is
// these cards hung on its branches; a truss is a lattice card between two chords.
// The sheet is uploaded with its own mip levels. Empty texels take the cell's mean colour with
// no alpha, so a far card thins out without a dark fringe.
export const CELLS = { spruceFlat: 0, pine: 1, cedar: 2, birchBare: 3, birchLeaf: 4, fern: 5, bracken: 6, grass: 7, dryGrass: 8, lattice: 9, rail: 10, ladder: 11, shrub: 12, spruceHang: 13, icicle: 14, reed: 15 };
export const SHEET = 2048, CELL = 512;
// the uv rectangle of a cell: [u0, v0, u1, v1], pulled in by two texels
export const cellUV = (i) => { const x = i % 4, y = Math.floor(i / 4), e = 2 / SHEET; return [x / 4 + e, y / 4 + e, (x + 1) / 4 - e, (y + 1) / 4 - e]; };

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hsl = (h, s, l, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;

function stroke(c, x0, y0, x1, y1, w, col) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
// needles along a twig from (x, y) on heading a for len pixels
function needled(c, R, x, y, a, len, o) {
  const n = Math.max(2, Math.round(len / o.gap));
  for (let i = 0; i <= n; i++) {
    const t = i / n, px = x + Math.cos(a) * len * t, py = y + Math.sin(a) * len * t;
    for (const side of [-1, 1]) {
      const na = a + side * (o.spread + (R() - 0.5) * 0.35), nl = o.long * (0.7 + 0.6 * R()) * (1 - 0.35 * t);
      stroke(c, px, py, px + Math.cos(na) * nl, py + Math.sin(na) * nl, o.wide, hsl(o.hue + (R() - 0.5) * 16, o.sat, o.light * (0.7 + 0.6 * R()) + (t > 0.8 ? o.tip : 0)));
    }
  }
  stroke(c, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, o.stem, hsl(24, 22, 11));
}

const DRAW = {
  // a spruce bough from above: a shoot with side shoots leaning forward, widest a third along
  spruceFlat(c, R) {
    const o = { gap: 4.5, spread: 0.95, long: 10, wide: 2.2, hue: 152, sat: 28, light: 15, tip: 9, stem: 2.5 };
    for (let i = 0; i < 17; i++) {
      const t = i / 17 + (R() - 0.5) * 0.02, x = 16 + t * 470, shape = Math.sin((t * 0.84 + 0.1) * Math.PI) ** 0.7, len = 24 + 185 * shape * (0.8 + 0.4 * R());
      for (const side of [-1, 1]) {
        const a = side * (0.95 - 0.35 * t + (R() - 0.5) * 0.2);
        needled(c, R, x, 256, a, len, o);
        // second-order shoots
        for (let k = 1; k < 4; k++) { const q = k / 4, sx = x + Math.cos(a) * len * q, sy = 256 + Math.sin(a) * len * q; needled(c, R, sx, sy, a - side * 0.7, len * 0.24 * (1 - q * 0.5), o); needled(c, R, sx, sy, a + side * 0.5, len * 0.18 * (1 - q * 0.5), o); }
      }
    }
    needled(c, R, 16, 256, 0, 480, { ...o, stem: 5 });
  },
  // a spruce bough from the side: the shoots hang from the branch like a fringe
  spruceHang(c, R) {
    const o = { gap: 4.5, spread: 0.9, long: 9, wide: 2.2, hue: 155, sat: 26, light: 14, tip: 9, stem: 2.2 };
    for (let i = 0; i < 25; i++) {
      const t = i / 25 + (R() - 0.5) * 0.02, x = 10 + t * 490, y = 34 + 26 * Math.sin(t * 3.0) + t * 40, len = (70 + 340 * Math.sin((t * 0.8 + 0.12) * Math.PI) ** 0.8) * (0.55 + 0.6 * R());
      const a = Math.PI / 2 - 0.35 + R() * 0.5 + t * 0.25;
      needled(c, R, x, y, a, len, o);
      for (let k = 1; k < 4; k++) { const q = k / 4, sx = x + Math.cos(a) * len * q, sy = y + Math.sin(a) * len * q; needled(c, R, sx, sy, a + (R() > 0.5 ? 0.55 : -0.55), len * 0.16, o); }
    }
    c.strokeStyle = hsl(24, 22, 10); c.lineWidth = 7; c.beginPath(); c.moveTo(4, 30);
    for (let i = 0; i <= 20; i++) { const t = i / 20; c.lineTo(10 + t * 490, 34 + 26 * Math.sin(t * 3.0) + t * 40); }
    c.stroke();
  },
  // pine: bursts of long needles at the shoot ends
  pine(c, R) {
    const burst = (x, y, a, size) => {
      for (let i = 0; i < 120; i++) { const na = a + (R() - 0.5) * 3.6, l = size * (0.35 + 0.75 * R()); stroke(c, x, y, x + Math.cos(na) * l, y + Math.sin(na) * l, 1.9, hsl(88 + (R() - 0.5) * 22, 26, 14 + 12 * R())); }
    };
    const limb = (x, y, a, len, depth) => {
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      stroke(c, x, y, ex, ey, 2 + depth * 2.2, hsl(22, 30, 13));
      if (depth === 0) { burst(ex, ey, a, 58); return; }
      const n = 2 + Math.floor(R() * 2);
      for (let i = 0; i < n; i++) limb(ex, ey, a + (i - (n - 1) / 2) * 0.72 + (R() - 0.5) * 0.4, len * (0.6 + 0.22 * R()), depth - 1);
      burst(ex, ey, a, 44);
    };
    for (let i = 0; i < 5; i++) limb(256 + (i - 2) * 26, 508, -Math.PI / 2 + (i - 2) * 0.42 + (R() - 0.5) * 0.3, 95 + 40 * R(), 3);
  },
  // cedar: flat sprays hanging off a drooping stem
  cedar(c, R) {
    const spray = (x, y, a, len) => {
      for (let i = 0; i < 9; i++) {
        const t = i / 9, px = x + Math.cos(a) * len * t, py = y + Math.sin(a) * len * t;
        for (const side of [-1, 1]) {
          const sa = a + side * (0.65 - 0.25 * t), sl = len * 0.42 * (1 - t * 0.7);
          // scale leaves read as a braided strip: short thick strokes end to end
          for (let k = 0; k < 6; k++) { const q0 = k / 6, q1 = (k + 0.85) / 6; stroke(c, px + Math.cos(sa) * sl * q0, py + Math.sin(sa) * sl * q0, px + Math.cos(sa) * sl * q1, py + Math.sin(sa) * sl * q1, 5.5 - 3 * q0, hsl(98 + (R() - 0.5) * 18, 30, 13 + 9 * R() + 5 * q0)); }
        }
      }
      stroke(c, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, 2.2, hsl(22, 30, 14));
    };
    for (let i = 0; i < 15; i++) {
      const t = i / 15, x = 256 + Math.sin(t * 4.0) * 26, y = 12 + t * 340;
      for (const side of [-1, 1]) spray(x, y, Math.PI / 2 + side * (0.95 - 0.5 * t) + (R() - 0.5) * 0.2, 170 * (0.55 + 0.6 * Math.sin((t * 0.9 + 0.1) * Math.PI)) * (0.8 + 0.4 * R()));
    }
    spray(256 + Math.sin(3.7) * 26, 340, Math.PI / 2, 160);
    stroke(c, 256, 0, 256 + Math.sin(3.7) * 26, 345, 4, hsl(20, 30, 13));
  },
  // birch: fine hanging twigs; the leafed sheet keeps a thin autumn of yellow
  birchBare(c, R, leaves = false) {
    const twig = (x, y, a, len, w) => {
      const n = Math.ceil(len / 16); let px = x, py = y, pa = a;
      for (let i = 0; i < n; i++) {
        pa += (R() - 0.5) * 0.28 + (Math.PI / 2 - pa) * 0.12;        // gravity bends each twig down
        const nx = px + Math.cos(pa) * 16, ny = py + Math.sin(pa) * 16;
        stroke(c, px, py, nx, ny, Math.max(1.5, w * (1 - i / n)), hsl(12 + R() * 10, 22, 12 + 5 * R()));
        if (leaves && R() < 0.30) { c.fillStyle = hsl(42 + R() * 12, 58, 34 + 12 * R()); c.beginPath(); c.ellipse(nx + (R() - 0.5) * 12, ny + (R() - 0.5) * 12, 6.5, 4.6, R() * 3, 0, 7); c.fill(); }
        if (len > 50 && R() < 0.34) twig(nx, ny, pa + (R() > 0.5 ? 0.7 : -0.7), len * 0.55, w * 0.7);
        px = nx; py = ny;
      }
    };
    for (let i = 0; i < 9; i++) twig(256 + (i - 4) * 9, 6, Math.PI / 2 + (i - 4) * 0.27 + (R() - 0.5) * 0.2, 330 + 150 * R(), 5.5);
  },
  birchLeaf(c, R) { DRAW.birchBare(c, R, true); },
  // a fern frond: pinnae in pairs, longest a third up
  fern(c, R, hue = 100, sat = 34, light = 27) {
    for (let i = 0; i < 26; i++) {
      const t = i / 26, y = 500 - t * 480, x = 256 + Math.sin(t * 2.2) * 12, len = (215 * (1 - t) ** 0.75 * Math.min(1, t * 5 + 0.3) + 6) * (0.85 + 0.3 * R());
      for (const side of [-1, 1]) {
        const a = -Math.PI / 2 + side * (1.25 - 0.3 * t), ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
        stroke(c, x, y, ex, ey, 2, hsl(hue, sat, light * 0.7));
        for (let k = 1; k < 11; k++) { const q = k / 11, px = x + (ex - x) * q, py = y + (ey - y) * q, pl = 15 * (1 - q * 0.75); for (const s2 of [-1, 1]) stroke(c, px, py, px + Math.cos(a + s2 * 1.2) * pl, py + Math.sin(a + s2 * 1.2) * pl, 4.2, hsl(hue + (R() - 0.5) * 14, sat, light * (0.75 + 0.6 * R()))); }
      }
    }
    stroke(c, 256, 508, 256 + Math.sin(2.2) * 12, 20, 3.5, hsl(hue - 30, sat, light * 0.55));
  },
  bracken(c, R) { DRAW.fern(c, R, 24, 58, 33); },
  grass(c, R, hue = 74, sat = 22, light = 17, heads = false) {
    for (let i = 0; i < 46; i++) {
      const lean = (R() - 0.5) * 1.5, h = 260 + 230 * R(), x0 = 256 + (R() - 0.5) * 110, x1 = x0 + lean * h * 0.55, y1 = 508 - h * (1 - Math.abs(lean) * 0.25);
      const dead = R() < 0.14, col = dead ? hsl(40, 28, 22 + 8 * R()) : hsl(hue + (R() - 0.5) * 20, sat, light * (0.7 + 0.6 * R()));
      c.fillStyle = col; c.beginPath(); c.moveTo(x0 - 5, 510); c.quadraticCurveTo(x0 + lean * h * 0.1, 508 - h * 0.6, x1, y1); c.quadraticCurveTo(x0 + lean * h * 0.1 + 5, 508 - h * 0.6, x0 + 5, 510); c.fill();
      if (heads && R() < 0.5) { c.fillStyle = hsl(34, 34, 34); c.beginPath(); c.ellipse(x1, y1, 5, 22, lean * 0.5, 0, 7); c.fill(); }
    }
  },
  dryGrass(c, R) { DRAW.grass(c, R, 42, 32, 27, true); },
  reed(c, R) {
    for (let i = 0; i < 26; i++) {
      const x0 = 256 + (R() - 0.5) * 220, lean = (R() - 0.5) * 0.3, x1 = x0 + lean * 480, y1 = 20 + 90 * R();
      stroke(c, x0, 510, x1, y1, 5, hsl(46, 36, 32 + 10 * R()));
      c.fillStyle = hsl(28, 30, 20); c.beginPath(); c.ellipse(x1, y1 + 8, 6.5, 30, lean, 0, 7); c.fill();
      for (let k = 0; k < 2; k++) { const y = 200 + R() * 220, s = R() > 0.5 ? 1 : -1; c.strokeStyle = hsl(50, 34, 34); c.lineWidth = 4; c.beginPath(); c.moveTo(x0 + lean * (510 - y), y); c.quadraticCurveTo(x0 + s * 50, y - 80, x0 + s * 95, y - 40); c.stroke(); }
    }
  },
  // a leafless shrub: forks all the way up, a few rust leaves left on it
  shrub(c, R) {
    const fork = (x, y, a, len, w, depth) => {
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      stroke(c, x, y, ex, ey, w, hsl(10 + R() * 12, 28, 12 + 6 * R()));
      if (depth === 0) { if (R() < 0.5) { c.fillStyle = hsl(18 + R() * 16, 55, 26 + 10 * R()); c.beginPath(); c.ellipse(ex, ey, 7, 4.5, R() * 3, 0, 7); c.fill(); } return; }
      const n = 2 + (R() < 0.35 ? 1 : 0);
      for (let i = 0; i < n; i++) fork(ex, ey, a + (i - (n - 1) / 2) * 0.62 + (R() - 0.5) * 0.4, len * (0.66 + 0.2 * R()), Math.max(1.6, w * 0.68), depth - 1);
    };
    for (let i = 0; i < 5; i++) fork(256 + (i - 2) * 14, 510, -Math.PI / 2 + (i - 2) * 0.28, 105 + 40 * R(), 7, 5);
  },
  // steelwork: a truss panel that tiles sideways, chords top and bottom, an X between posts
  lattice(c) {
    const col = hsl(0, 0, 62), dark = hsl(0, 0, 44);
    for (let i = 0; i < 4; i++) { const x = i * 128; stroke(c, x, 8, x + 128, 504, 13, dark); stroke(c, x + 128, 8, x, 504, 13, col); stroke(c, x, 0, x, 512, 16, col); }
    stroke(c, 0, 10, 512, 10, 20, col); stroke(c, 0, 502, 512, 502, 20, col); stroke(c, 0, 256, 512, 256, 9, dark);
  },
  // a hand rail: posts, a top rail, a knee rail, a kick plate
  rail(c) {
    const col = hsl(0, 0, 60);
    for (let i = 0; i <= 4; i++) stroke(c, Math.min(506, Math.max(6, i * 128)), 0, Math.min(506, Math.max(6, i * 128)), 512, 13, col);
    stroke(c, 0, 12, 512, 12, 22, col); stroke(c, 0, 250, 512, 250, 13, col); stroke(c, 0, 486, 512, 486, 52, hsl(0, 0, 46));
  },
  // a ladder in its safety hoops
  ladder(c) {
    const col = hsl(0, 0, 60);
    stroke(c, 190, 0, 190, 512, 14, col); stroke(c, 322, 0, 322, 512, 14, col);
    for (let i = 0; i < 12; i++) stroke(c, 190, 22 + i * 43, 322, 22 + i * 43, 8, col);
    for (let i = 0; i < 4; i++) { c.strokeStyle = hsl(0, 0, 50); c.lineWidth = 9; c.beginPath(); c.ellipse(256, 64 + i * 128, 150, 26, 0, 0, 7); c.stroke(); }
    stroke(c, 106, 0, 106, 512, 7, hsl(0, 0, 50)); stroke(c, 406, 0, 406, 512, 7, hsl(0, 0, 50));
  },
  // ice hanging from an eave
  icicle(c, R) {
    for (let i = 0; i < 26; i++) {
      const x = 8 + i * 19.5 + (R() - 0.5) * 8, len = 60 + 380 * R() ** 2.2, w = 5 + 9 * R();
      const g = c.createLinearGradient(0, 0, 0, len); g.addColorStop(0, hsl(205, 30, 86, 0.95)); g.addColorStop(1, hsl(205, 45, 94, 0.75));
      c.fillStyle = g; c.beginPath(); c.moveTo(x - w, 0); c.quadraticCurveTo(x - w * 0.3, len * 0.5, x, len); c.quadraticCurveTo(x + w * 0.3, len * 0.5, x + w, 0); c.fill();
    }
    c.fillStyle = hsl(205, 25, 90); c.fillRect(0, 0, 512, 10);
  },
};

// draw the sheet; returns { data: Uint8Array RGBA, levels: [{ w, h, data }] }
export function drawAtlas(seed = 20261118) {
  const cv = new OffscreenCanvas(SHEET, SHEET), c = cv.getContext("2d", { willReadFrequently: true });
  c.lineCap = "round"; c.lineJoin = "round";
  for (const [name, i] of Object.entries(CELLS)) {
    c.save(); c.translate((i % 4) * CELL, Math.floor(i / 4) * CELL); c.beginPath(); c.rect(0, 0, CELL, CELL); c.clip();
    DRAW[name](c, rng(seed + i * 977)); c.restore();
  }
  const img = c.getImageData(0, 0, SHEET, SHEET).data, data = new Uint8Array(img.buffer.slice(0));
  // empty texels take the cell's mean colour, so filtering never pulls black into an edge
  for (let cell = 0; cell < 16; cell++) {
    const x0 = (cell % 4) * CELL, y0 = Math.floor(cell / 4) * CELL; let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y0 + CELL; y += 2) for (let x = x0; x < x0 + CELL; x += 2) { const k = (y * SHEET + x) * 4; if (data[k + 3] > 128) { r += data[k]; g += data[k + 1]; b += data[k + 2]; n++; } }
    if (!n) continue; r /= n; g /= n; b /= n;
    for (let y = y0; y < y0 + CELL; y++) for (let x = x0; x < x0 + CELL; x++) { const k = (y * SHEET + x) * 4, a = data[k + 3]; if (a < 255) { const t = a / 255; data[k] = data[k] * t + r * (1 - t); data[k + 1] = data[k + 1] * t + g * (1 - t); data[k + 2] = data[k + 2] * t + b * (1 - t); } }
  }
  const levels = [{ w: SHEET, h: SHEET, data }];
  while (levels[levels.length - 1].w > 16) {
    const p = levels[levels.length - 1], w = p.w >> 1, h = p.h >> 1, d = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let ch = 0; ch < 4; ch++) { const k = (2 * y * p.w + 2 * x) * 4 + ch; d[(y * w + x) * 4 + ch] = (p.data[k] + p.data[k + 4] + p.data[k + p.w * 4] + p.data[k + p.w * 4 + 4] + 2) >> 2; }
    levels.push({ w, h, data: d });
  }
  return { levels };
}
export function uploadAtlas(dev, atlas) {
  const tex = dev.createTexture({ size: [SHEET, SHEET], format: "rgba8unorm-srgb", mipLevelCount: atlas.levels.length, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
  atlas.levels.forEach((l, i) => dev.queue.writeTexture({ texture: tex, mipLevel: i }, l.data, { bytesPerRow: l.w * 4 }, [l.w, l.h]));
  return tex;
}
