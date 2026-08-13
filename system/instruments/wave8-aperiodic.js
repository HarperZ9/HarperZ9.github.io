// wave8-aperiodic.js — Penrose and aperiodic order: deflation-grown kite-and-dart
// patches, Ammann bars over ghost tiles, quasicrystal line-grating interference,
// girih strapwork with woven crossings, pinwheel drift, Fibonacci-word combs.
// First-party, seed-derived, no assets.

const PHI = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;
const TAU = Math.PI * 2;

function rand(seed, salt) {
  let x = Math.imul(seed ^ Math.imul(salt + 1013904223, 1664525), 2246822519);
  x ^= x >>> 13;
  x = Math.imul(x, 3266489917);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function toneRgba(t, a) { return `rgba(${t[0]},${t[1]},${t[2]},${a})`; }
function fluidTones(palette) {
  return (palette && palette.fluid) || [[132, 245, 255], [167, 115, 255], [239, 171, 48]];
}

/* ---- Penrose P2 (kite and dart) by Robinson-triangle deflation ----------
   Triangles are [type, ax, ay, bx, by, cx, cy] with type 0 = half-kite
   (36 degrees at B) and type 1 = half-dart (108 degrees at B). The scheme
   was verified numerically: children tile the parent exactly (area drift
   1e-14 over four rounds) and every child carries the correct angle set.
   Edge B-C is the mirror seam between twin halves of one tile, so tile
   outlines stroke A-B and C-A and skip B-C. */
function penroseSun(cx, cy, scale, rot) {
  const out = [];
  const r = PHI * scale;
  for (let i = 0; i < 10; i += 1) {
    const t1 = ((2 * i - 1) * Math.PI) / 10 + rot;
    const t2 = ((2 * i + 1) * Math.PI) / 10 + rot;
    let p1x = cx + Math.cos(t1) * r, p1y = cy + Math.sin(t1) * r;
    let p2x = cx + Math.cos(t2) * r, p2y = cy + Math.sin(t2) * r;
    if (i % 2 === 0) {
      const tx = p1x, ty = p1y;
      p1x = p2x; p1y = p2y; p2x = tx; p2y = ty;
    }
    out.push([0, p1x, p1y, cx, cy, p2x, p2y]);
  }
  return out;
}

function penroseDeflate(tris) {
  const out = [];
  for (const [ty, ax, ay, bx, by, cx, cy] of tris) {
    if (ty === 0) {
      const qx = ax + (bx - ax) * INV_PHI, qy = ay + (by - ay) * INV_PHI;
      const rx = bx + (cx - bx) * INV_PHI, ry = by + (cy - by) * INV_PHI;
      out.push([1, rx, ry, qx, qy, bx, by]);
      out.push([0, qx, qy, ax, ay, rx, ry]);
      out.push([0, cx, cy, ax, ay, rx, ry]);
    } else {
      const px = cx + (ax - cx) * INV_PHI, py = cy + (ay - cy) * INV_PHI;
      out.push([1, bx, by, px, py, ax, ay]);
      out.push([0, px, py, cx, cy, bx, by]);
    }
  }
  return out;
}

// Twin halves share the seam B-C, so a hash of the seam midpoint gives one
// stable jitter value per whole kite or dart.
function seamHash(t) {
  const mx = Math.round(((t[3] + t[5]) / 2) * 4);
  const my = Math.round(((t[4] + t[6]) / 2) * 4);
  return (Math.imul(mx, 73856093) ^ Math.imul(my, 19349663)) >>> 0;
}

// The Fibonacci word L -> LS, S -> L: the 1D quasiperiodic rhythm behind
// Ammann bars and the comb rulings. Twelve rounds is 233 letters.
function fibWord(rounds) {
  let w = "L";
  for (let i = 0; i < rounds; i += 1) {
    let next = "";
    for (let j = 0; j < w.length; j += 1) next += w[j] === "L" ? "LS" : "L";
    w = next;
  }
  return w;
}

// Stroke the chord that a line (direction dx,dy through centre + normal*off)
// cuts from the circle of radius rc. Returns false when the line misses.
function chordPath(ctx, cx, cy, dx, dy, nx, ny, off, rc) {
  const h2 = rc * rc - off * off;
  if (h2 <= 0) return false;
  const hl = Math.sqrt(h2);
  const px = cx + nx * off, py = cy + ny * off;
  ctx.moveTo(px - dx * hl, py - dy * hl);
  ctx.lineTo(px + dx * hl, py + dy * hl);
  return true;
}

/* ---- 1. kite-and-dart --------------------------------------------------- */
// A sun seed deflated five rounds. Kites wash warm bone, darts cool slate,
// a lit angular sector sweeps the patch, and one round-two relic triangle is
// outlined over the fine tiling so the self-similarity reads.
function drawKiteAndDart(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const tones = fluidTones(palette);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const cx = width * (0.40 + rnd(8100) * 0.20);
  const cy = height * (0.42 + rnd(8101) * 0.16);
  const rot = rnd(8102) * TAU + tick * 0.00002;
  const scale = (Math.max(width, height) * (0.55 + rnd(8103) * 0.22)) / PHI;
  let tris = penroseSun(cx, cy, scale, rot);
  let relics = null;
  for (let r = 0; r < 5; r += 1) {
    tris = penroseDeflate(tris);
    if (r === 1) relics = tris;
  }
  const a0 = rnd(8104) * TAU;
  const sectorBoost = (t) => {
    const gx = (t[1] + t[3] + t[5]) / 3 - cx;
    const gy = (t[2] + t[4] + t[6]) / 3 - cy;
    let d = Math.abs((((Math.atan2(gy, gx) - a0) % TAU) + TAU) % TAU);
    if (d > Math.PI) d = TAU - d;
    const b = Math.max(0, 1 - d / 0.75);
    return b * b;
  };
  // Tile washes, one jitter per whole tile via the seam hash.
  for (const t of tris) {
    const j = rand(seed, 8150 + (seamHash(t) % 100003));
    const boost = sectorBoost(t);
    ctx.fillStyle = t[0] === 0
      ? `rgba(228,222,206,${(0.07 + j * 0.09 + boost * 0.17).toFixed(3)})`
      : `rgba(142,158,182,${(0.10 + j * 0.10 + boost * 0.12).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(t[1], t[2]);
    ctx.lineTo(t[3], t[4]);
    ctx.lineTo(t[5], t[6]);
    ctx.closePath();
    ctx.fill();
  }
  // Tile edges: A-B and C-A only, the seam stays silent inside each tile.
  ctx.lineWidth = 0.7;
  for (const t of tris) {
    const boost = sectorBoost(t);
    ctx.strokeStyle = `rgba(214,220,214,${(0.14 + boost * 0.30).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(t[1], t[2]);
    ctx.lineTo(t[3], t[4]);
    ctx.moveTo(t[5], t[6]);
    ctx.lineTo(t[1], t[2]);
    ctx.stroke();
  }
  // Plotter grain: one vertex dot per triangle.
  ctx.fillStyle = "rgba(222,226,220,0.22)";
  for (const t of tris) ctx.fillRect(t[1] - 0.5, t[2] - 0.5, 1, 1);
  // The relic: one coarse-generation triangle outlined over its descendants.
  const kites = relics.filter((t) => t[0] === 0);
  // rnd() is inclusive of 1.0, so clamp the derived index
  const relic = kites[Math.min(kites.length - 1, Math.floor(rnd(8105) * kites.length))];
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(relic[1], relic[2]);
    ctx.lineTo(relic[3], relic[4]);
    ctx.lineTo(relic[5], relic[6]);
    ctx.closePath();
  };
  ctx.strokeStyle = toneRgba(tones[0], 0.10);
  ctx.lineWidth = 4.5;
  outline();
  ctx.stroke();
  ctx.strokeStyle = toneRgba(tones[0], 0.55);
  ctx.lineWidth = 1.5;
  outline();
  ctx.stroke();
  ctx.restore();
}

/* ---- 2. ammann-ghost ---------------------------------------------------- */
// The same deflated patch drawn as a whisper, then five families of bars at
// 36 degree steps spaced by the Fibonacci word. The bars carry the ink; one
// bar runs hot.
function drawAmmannGhost(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const tones = fluidTones(palette);
  const short = Math.min(width, height);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const cx = width * (0.42 + rnd(8400) * 0.16);
  const cy = height * (0.44 + rnd(8401) * 0.12);
  const rot = rnd(8402) * TAU + tick * 0.00002;
  const scale = (Math.max(width, height) * (0.55 + rnd(8403) * 0.20)) / PHI;
  let tris = penroseSun(cx, cy, scale, rot);
  for (let r = 0; r < 5; r += 1) tris = penroseDeflate(tris);
  // Ghost tiles: hairline outlines, darts get a breath of fill.
  ctx.lineWidth = 0.6;
  for (const t of tris) {
    if (t[0] === 1) {
      ctx.fillStyle = "rgba(150,162,184,0.045)";
      ctx.beginPath();
      ctx.moveTo(t[1], t[2]);
      ctx.lineTo(t[3], t[4]);
      ctx.lineTo(t[5], t[6]);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = t[0] === 0 ? "rgba(206,212,208,0.10)" : "rgba(206,212,208,0.14)";
    ctx.beginPath();
    ctx.moveTo(t[1], t[2]);
    ctx.lineTo(t[3], t[4]);
    ctx.moveTo(t[5], t[6]);
    ctx.lineTo(t[1], t[2]);
    ctx.stroke();
  }
  // Bars: five directions at 36 degree steps, Fibonacci L/S spacing.
  const word = fibWord(12);
  const u = short * (0.082 + rnd(8420) * 0.030);
  const Lw = u * PHI;
  const rc = Math.max(width, height) * 0.72;
  const hotFam = Math.floor(rnd(8460) * 5);
  let hot = null;
  for (let k = 0; k < 5; k += 1) {
    const ang = rot + (k * Math.PI) / 5;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const nx = -dy, ny = dx;
    let pos = -rc + rnd(8440 + k) * Lw;
    let idx = Math.floor(rnd(8430 + k) * 80);
    while (pos <= rc) {
      const isL = word[idx % word.length] === "L";
      const step = isL ? Lw : u;
      // The bar at this boundary: heavier after a long interval.
      ctx.strokeStyle = `rgba(226,230,222,${isL ? 0.42 : 0.20})`;
      ctx.lineWidth = isL ? 1.3 : 0.8;
      ctx.beginPath();
      if (chordPath(ctx, cx, cy, dx, dy, nx, ny, pos, rc)) ctx.stroke();
      if (isL) {
        // Interior golden division of the long interval, a hairline echo.
        ctx.strokeStyle = "rgba(226,230,222,0.11)";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        if (chordPath(ctx, cx, cy, dx, dy, nx, ny, pos + Lw * INV_PHI, rc)) ctx.stroke();
      }
      if (k === hotFam && (hot === null || Math.abs(pos) < Math.abs(hot.off))) {
        hot = { dx, dy, nx, ny, off: pos };
      }
      pos += step;
      idx += 1;
    }
  }
  // The hot bar: the family's bar nearest the patch centre, glow then core.
  if (hot) {
    ctx.strokeStyle = toneRgba(tones[0], 0.10);
    ctx.lineWidth = 6;
    ctx.beginPath();
    if (chordPath(ctx, cx, cy, hot.dx, hot.dy, hot.nx, hot.ny, hot.off, rc)) ctx.stroke();
    ctx.strokeStyle = toneRgba(tones[0], 0.75);
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    if (chordPath(ctx, cx, cy, hot.dx, hot.dy, hot.nx, hot.ny, hot.off, rc)) ctx.stroke();
  }
  ctx.restore();
}

/* ---- 3. starburst-grating ----------------------------------------------- */
// Five- or sevenfold superposed line gratings, additive, every family sharing
// one line through the core so the interference blooms into a star. A second
// pass at golden-ratio spacing beats moire rings against the first.
function drawStarburstGrating(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const tones = fluidTones(palette);
  const short = Math.min(width, height);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const n = rnd(8700) < 0.5 ? 5 : 7;
  const cx = width * (0.44 + rnd(8701) * 0.12);
  const cy = height * (0.44 + rnd(8706) * 0.12);
  const rc = Math.max(width, height) * (0.40 + rnd(8702) * 0.14);
  const g = 5.2 + rnd(8703) * 2.6;
  const baseA = rnd(8704) * Math.PI + tick * 0.00001;
  const alpha = n === 7 ? 0.052 : 0.068;
  const tintA = Math.floor(rnd(8705) * n);
  const tintB = (tintA + 2) % n;
  const grating = (spacing, angOff, aMul, lw) => {
    for (let k = 0; k < n; k += 1) {
      const ang = baseA + (k * Math.PI) / n + angOff;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const nx = -dy, ny = dx;
      const a = alpha * aMul;
      ctx.strokeStyle = k === tintA
        ? toneRgba(tones[0], a * 1.15)
        : k === tintB
          ? toneRgba(tones[1], a * 1.15)
          : `rgba(224,228,222,${a.toFixed(4)})`;
      ctx.lineWidth = lw;
      const m = Math.ceil(rc / spacing);
      ctx.beginPath();
      for (let i = -m; i <= m; i += 1) {
        chordPath(ctx, cx, cy, dx, dy, nx, ny, i * spacing, rc);
      }
      ctx.stroke();
    }
  };
  grating(g, 0, 1, 1);
  grating(g * PHI, 0.013, 0.55, 0.8);
  // Core bloom where every family crosses.
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, short * 0.30);
  bloom.addColorStop(0, "rgba(255,242,214,0.26)");
  bloom.addColorStop(0.5, "rgba(255,242,214,0.08)");
  bloom.addColorStop(1, "rgba(255,242,214,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(cx - short * 0.32, cy - short * 0.32, short * 0.64, short * 0.64);
  // The axis: family zero's centre line, drawn as the one deliberate stroke.
  const ax = Math.cos(baseA), ay = Math.sin(baseA);
  ctx.strokeStyle = "rgba(255,244,220,0.45)";
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  chordPath(ctx, cx, cy, ax, ay, -ay, ax, 0, rc);
  ctx.stroke();
  ctx.restore();
}

/* ---- 4. girih-strapwork ------------------------------------------------- */
// Tenfold rosettes as {10/3} star chords plus continuation rays and long
// lattice straps, every strap a dark casing under a bright core. A patch pass
// re-paints alternate straps at each crossing so the lattice weaves over and
// under; the dominant rosette runs gilded.
function drawGirihStrapwork(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const tones = fluidTones(palette);
  const short = Math.min(width, height);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const casing = "rgba(7,8,14,0.90)";
  const straps = [];
  const addStrap = (x1, y1, x2, y2, coreW, coreStyle) => {
    straps.push({ x1, y1, x2, y2, coreW, casW: coreW * 2.1, coreStyle });
  };
  const sites = [];
  const nSites = 2 + (rnd(8900) < 0.55 ? 1 : 0);
  sites.push({
    x: width * (0.26 + rnd(8901) * 0.16), y: height * (0.34 + rnd(8902) * 0.22),
    r: short * (0.26 + rnd(8903) * 0.09), rot: rnd(8904) * TAU, gilded: true,
  });
  sites.push({
    x: width * (0.64 + rnd(8905) * 0.14), y: height * (0.50 + rnd(8906) * 0.24),
    r: short * (0.16 + rnd(8907) * 0.08), rot: rnd(8908) * TAU, gilded: false,
  });
  if (nSites === 3) {
    sites.push({
      x: width * (0.42 + rnd(8909) * 0.18), y: height * (0.12 + rnd(8910) * 0.16),
      r: short * (0.12 + rnd(8911) * 0.07), rot: rnd(8912) * TAU, gilded: false,
    });
  }
  // Ghost geometry first: the construction decagons the straps grew from.
  ctx.lineWidth = 0.7;
  for (const s of sites) {
    for (const mul of [1, 1.32]) {
      ctx.strokeStyle = "rgba(200,208,204,0.085)";
      ctx.beginPath();
      for (let i = 0; i <= 10; i += 1) {
        const a = s.rot + (i * TAU) / 10;
        const x = s.x + Math.cos(a) * s.r * mul, y = s.y + Math.sin(a) * s.r * mul;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  // Rosette chords {10/3} and continuation rays.
  let saltRay = 8930;
  for (const s of sites) {
    const vx = [], vy = [];
    for (let i = 0; i < 10; i += 1) {
      const a = s.rot + (i * TAU) / 10;
      vx.push(s.x + Math.cos(a) * s.r);
      vy.push(s.y + Math.sin(a) * s.r);
    }
    const coreW = s.gilded ? 3.1 : 2.5;
    const style = s.gilded ? toneRgba(tones[1], 0.72) : "rgba(222,226,216,0.60)";
    for (let i = 0; i < 10; i += 1) {
      const j = (i + 3) % 10;
      addStrap(vx[i], vy[i], vx[j], vy[j], coreW, style);
    }
    for (let i = 0; i < 10; i += 1) {
      if (rand(seed, (saltRay += 1)) > 0.48) continue;
      const back = (i + 7) % 10;
      let dxr = vx[i] - vx[back], dyr = vy[i] - vy[back];
      const dl = Math.hypot(dxr, dyr);
      dxr /= dl; dyr /= dl;
      const len = short * (0.45 + rand(seed, (saltRay += 1)) * 0.55);
      addStrap(vx[i], vy[i], vx[i] + dxr * len, vy[i] + dyr * len, 2.0, "rgba(214,220,212,0.50)");
    }
  }
  // Long lattice straps at multiples of 36 degrees tie the field together.
  const latN = 3 + Math.floor(rnd(8913) * 3);
  const latRot = rnd(8914) * (Math.PI / 5) + tick * 0.00001;
  const diag = width + height;
  for (let i = 0; i < latN; i += 1) {
    const ang = latRot + (Math.floor(rnd(8950 + i * 3) * 5) * Math.PI) / 5;
    const px = width * (0.2 + rnd(8951 + i * 3) * 0.6);
    const py = height * (0.2 + rnd(8952 + i * 3) * 0.6);
    addStrap(px - Math.cos(ang) * diag, py - Math.sin(ang) * diag,
      px + Math.cos(ang) * diag, py + Math.sin(ang) * diag, 1.7, "rgba(206,212,206,0.42)");
  }
  const drawSeg = (x1, y1, x2, y2, s) => {
    ctx.lineCap = "round";
    ctx.strokeStyle = casing;
    ctx.lineWidth = s.casW;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = s.coreStyle;
    ctx.lineWidth = s.coreW;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = "rgba(10,11,18,0.16)";
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  for (const s of straps) drawSeg(s.x1, s.y1, s.x2, s.y2, s);
  // Weave pass: at each crossing the strap chosen by index parity is drawn
  // back on top for a short patch, alternating over and under.
  for (let i = 0; i < straps.length; i += 1) {
    for (let j = i + 1; j < straps.length; j += 1) {
      const a = straps[i], b = straps[j];
      const d1x = a.x2 - a.x1, d1y = a.y2 - a.y1;
      const d2x = b.x2 - b.x1, d2y = b.y2 - b.y1;
      const det = d1x * d2y - d1y * d2x;
      if (Math.abs(det) < 1e-6) continue;
      const t = ((b.x1 - a.x1) * d2y - (b.y1 - a.y1) * d2x) / det;
      const v = ((b.x1 - a.x1) * d1y - (b.y1 - a.y1) * d1x) / det;
      if (t < 0.06 || t > 0.94 || v < 0.06 || v > 0.94) continue;
      const px = a.x1 + d1x * t, py = a.y1 + d1y * t;
      const over = (i + j) % 2 === 0 ? a : b;
      const odx = over.x2 - over.x1, ody = over.y2 - over.y1;
      const ol = Math.hypot(odx, ody);
      const hl = (a.casW + b.casW) * 0.75;
      const ux = (odx / ol) * hl, uy = (ody / ol) * hl;
      drawSeg(px - ux, py - uy, px + ux, py + uy, over);
    }
  }
  // Node dots at rosette star points, the finest ink weight.
  ctx.fillStyle = "rgba(236,238,230,0.5)";
  for (const s of sites) {
    for (let i = 0; i < 10; i += 1) {
      const a = s.rot + (i * TAU) / 10;
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r, 1.3, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ---- 5. pinwheel-drift -------------------------------------------------- */
// The Conway-Radin pinwheel: a 1:2 right triangle split into five copies of
// itself, verified exact. Tiles take tone from their orientation, which the
// pinwheel scatters through infinitely many angles; a seeded focus circle is
// subdivided two rounds deeper, a zoom into the self-similarity.
function pinwheelChildren(t) {
  const [rx, ry, fx, fy, nx, ny] = t;
  const ex = fx + (nx - fx) * 0.8, ey = fy + (ny - fy) * 0.8;
  const gx = (rx + ex) / 2, gy = (ry + ey) / 2;
  const mx = (rx + fx) / 2, my = (ry + fy) / 2;
  const hx = (ex + fx) / 2, hy = (ey + fy) / 2;
  return [
    [ex, ey, rx, ry, nx, ny],
    [gx, gy, mx, my, rx, ry],
    [ex, ey, hx, hy, gx, gy],
    [hx, hy, fx, fy, mx, my],
    [mx, my, gx, gy, hx, hy],
  ];
}

function drawPinwheelDrift(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const tones = fluidTones(palette);
  const short = Math.min(width, height);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const tilt = (rnd(9200) - 0.5) * 0.14 + tick * 0.000004;
  ctx.translate(width / 2, height / 2);
  ctx.rotate(tilt);
  ctx.translate(-width / 2, -height / 2);
  const rectW = Math.max(width + 90, 2 * (height + 90));
  const rectH = rectW / 2;
  const x0 = width / 2 - rectW / 2, y0 = height / 2 - rectH / 2;
  const x1 = x0 + rectW, y1 = y0 + rectH;
  const fx0 = width * (0.30 + rnd(9201) * 0.40);
  const fy0 = height * (0.30 + rnd(9202) * 0.40);
  const r1 = short * (0.13 + rnd(9203) * 0.07);
  const r2 = r1 * 2.3;
  const theta0 = rnd(9204) * Math.PI;
  const driftDir = rnd(9205) * TAU;
  const depthFor = (gx, gy) => {
    const d = Math.hypot(gx - fx0, gy - fy0);
    return d < r1 ? 6 : d < r2 ? 5 : 4;
  };
  const salt = { n: 9210 };
  const paint = (t) => {
    const [rx, ry, fx, fy, nx, ny] = t;
    const gx = (rx + fx + nx) / 3, gy = (ry + fy + ny) / 3;
    const orient = 0.5 + 0.5 * Math.cos(2 * Math.atan2(fy - ry, fx - rx) - theta0);
    const drift = 0.5 + 0.5 * (((gx - width / 2) * Math.cos(driftDir)
      + (gy - height / 2) * Math.sin(driftDir)) / (short * 0.9));
    const j = rand(seed, (salt.n += 1));
    const focus = Math.max(0, 1 - Math.hypot(gx - fx0, gy - fy0) / r2);
    const a = clamp(0.05 + orient * 0.16 + clamp(drift, 0, 1) * 0.08
      + focus * 0.10 + j * 0.05, 0.04, 0.42);
    ctx.fillStyle = j < 0.018
      ? toneRgba(tones[Math.floor(j * 160) % 3], 0.22)
      : `rgba(216,222,232,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(fx, fy);
    ctx.lineTo(nx, ny);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(9,11,17,0.32)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  };
  const recurse = (t, depth) => {
    const gx = (t[0] + t[2] + t[4]) / 3, gy = (t[1] + t[3] + t[5]) / 3;
    if (depth >= depthFor(gx, gy)) { paint(t); return; }
    for (const ch of pinwheelChildren(t)) recurse(ch, depth + 1);
  };
  recurse([x1, y0, x0, y0, x1, y1], 0);
  recurse([x0, y1, x1, y1, x0, y0], 0);
  // Survey mark: the focus circle drawn as a hairline instrument ring.
  ctx.strokeStyle = "rgba(232,236,228,0.16)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(fx0, fy0, r1, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/* ---- 6. fibonacci-comb -------------------------------------------------- */
// Two quasiperiodic rulings, vertical and horizontal, spaced by the Fibonacci
// word at golden-ratio scales. Long-long cell overlaps shade faintly, tones
// drift along a seeded diagonal, and a chroma crosshair sits at the golden
// section of the frame.
function drawFibonacciComb(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const tones = fluidTones(palette);
  const short = Math.min(width, height);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const word = fibWord(12);
  const u = short * (0.030 + rnd(9500) * 0.014);
  const walk = (extent, unit, phaseSalt, idxSalt) => {
    // Boundaries of the ruling: [position, followsLongInterval].
    const out = [];
    let pos = -rnd(phaseSalt) * unit * PHI * 2;
    let idx = Math.floor(rnd(idxSalt) * 60);
    while (pos < extent + unit) {
      const isL = word[idx % word.length] === "L";
      pos += isL ? unit * PHI : unit;
      out.push([pos, isL]);
      idx += 1;
    }
    return out;
  };
  const cols = walk(width, u, 9501, 9502);
  const rows = walk(height, u * PHI, 9503, 9504);
  const driftFlip = rnd(9505) < 0.5 ? -1 : 1;
  const driftAt = (x, y) => {
    const d = (x / width + y / height) / 2;
    return 0.55 + 0.9 * (driftFlip > 0 ? d : 1 - d);
  };
  // Cells where a long column meets a long row: the quasiperiodic checker.
  for (let ci = 1; ci < cols.length; ci += 1) {
    if (!cols[ci][1]) continue;
    const cxa = cols[ci - 1][0], cw = cols[ci][0] - cxa;
    for (let ri = 1; ri < rows.length; ri += 1) {
      if (!rows[ri][1]) continue;
      const rya = rows[ri - 1][0], rh = rows[ri][0] - rya;
      const a = 0.040 * driftAt(cxa, rya);
      ctx.fillStyle = `rgba(226,228,218,${a.toFixed(4)})`;
      ctx.fillRect(cxa, rya, cw, rh);
    }
  }
  // Vertical rules, heavier after long intervals, hairline golden echoes.
  let js = 9520;
  for (let ci = 0; ci < cols.length; ci += 1) {
    const [x, isL] = cols[ci];
    if (x < -1 || x > width + 1) continue;
    const jit = rand(seed, (js += 1)) * 0.08;
    const a = (isL ? 0.34 : 0.15) * driftAt(x, height * 0.5) + jit;
    ctx.strokeStyle = `rgba(228,232,224,${clamp(a, 0.05, 0.6).toFixed(3)})`;
    ctx.lineWidth = isL ? 1.1 : 0.6;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    if (isL && ci + 1 < cols.length) {
      const nxt = x + (cols[ci + 1][0] - x) * INV_PHI;
      ctx.strokeStyle = "rgba(228,232,224,0.09)";
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(nxt, 0); ctx.lineTo(nxt, height); ctx.stroke();
    }
  }
  // Horizontal rules, a quieter counter-rhythm.
  for (let ri = 0; ri < rows.length; ri += 1) {
    const [y, isL] = rows[ri];
    if (y < -1 || y > height + 1) continue;
    const jit = rand(seed, (js += 1)) * 0.06;
    const a = (isL ? 0.22 : 0.10) * driftAt(width * 0.5, y) + jit;
    ctx.strokeStyle = `rgba(222,226,220,${clamp(a, 0.04, 0.45).toFixed(3)})`;
    ctx.lineWidth = isL ? 0.9 : 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  // The golden crosshair: the frame's own division, in chroma, with a bloom.
  const gx = rnd(9506) < 0.5 ? width * INV_PHI : width * (1 - INV_PHI);
  const gy = height * INV_PHI + (tick % 977) * 0.004 - 1.95;
  ctx.strokeStyle = toneRgba(tones[2], 0.10);
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height); ctx.stroke();
  ctx.strokeStyle = toneRgba(tones[2], 0.62);
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height); ctx.stroke();
  ctx.strokeStyle = toneRgba(tones[2], 0.40);
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke();
  ctx.fillStyle = "rgba(255,246,224,0.65)";
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-2.6, -2.6, 5.2, 5.2);
  ctx.restore();
  ctx.restore();
}

export const WAVE8_APERIODIC = {
  "kite-and-dart": drawKiteAndDart,
  "ammann-ghost": drawAmmannGhost,
  "starburst-grating": drawStarburstGrating,
  "girih-strapwork": drawGirihStrapwork,
  "pinwheel-drift": drawPinwheelDrift,
  "fibonacci-comb": drawFibonacciComb,
};

export const WAVE8_APERIODIC_META = [
  { name: "kite-and-dart", family: "aperiodic", blurb: "penrose p2 patch, five deflation rounds, a lit sector and one relic outlined" },
  { name: "ammann-ghost", family: "aperiodic", blurb: "ghost penrose tiles under five fibonacci-spaced bar families; bars carry the ink" },
  { name: "starburst-grating", family: "aperiodic", blurb: "five or sevenfold line gratings; the interference blooms into a star core" },
  { name: "girih-strapwork", family: "aperiodic", blurb: "girih straps weaving over and under, one gilded rosette, ghost decagons" },
  { name: "pinwheel-drift", family: "aperiodic", blurb: "conway-radin pinwheel tiling, tone drifting with orientation, a zoomed focus" },
  { name: "fibonacci-comb", family: "aperiodic", blurb: "two fibonacci-word rulings weave a quasiperiodic comb with a golden crosshair" },
];
