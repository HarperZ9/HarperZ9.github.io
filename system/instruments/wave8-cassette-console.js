// wave8-cassette-console.js — cassette futurism control surfaces: VU banks,
// patch bays, reel transports, phosphor readouts, toggle rails, strip-chart
// pens. Machined ivory on charcoal, one warm indicator per composition.
// First-party, seed-derived, no assets.

function rand(seed, salt) {
  let x = Math.imul(seed ^ Math.imul(salt + 1013904223, 1664525), 2246822519);
  x ^= x >>> 13;
  x = Math.imul(x, 3266489917);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function fl(palette, i) {
  const f = (palette && palette.fluid) || [[132, 245, 255], [167, 115, 255], [239, 171, 48]];
  return f[((i % f.length) + f.length) % f.length];
}

function rgba(t, a) { return `rgba(${t[0]},${t[1]},${t[2]},${a})`; }

/* --- shared hardware vocabulary ------------------------------------------ */

// Charcoal plate with brushed horizontal grain, a lit top-left bevel and a
// shadowed bottom-right edge. Translucent on purpose: stacked layers ghost
// through the metal.
function brushedPanel(ctx, x, y, w, h, seed, salt) {
  ctx.fillStyle = "rgba(26,28,31,0.5)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(210,214,218,0.045)";
  ctx.lineWidth = 0.7;
  const lines = Math.floor(h / 2.6);
  for (let i = 0; i < lines; i += 1) {
    const yy = y + 1.5 + (i + rand(seed, salt + i * 3) * 0.7) * 2.6;
    if (yy > y + h - 1) break;
    ctx.beginPath();
    ctx.moveTo(x + 1 + rand(seed, salt + i * 3 + 1) * 3, yy);
    ctx.lineTo(x + w - 1 - rand(seed, salt + i * 3 + 2) * 3, yy);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(235,238,240,0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 0.5, y + h - 0.5);
  ctx.lineTo(x + 0.5, y + 0.5);
  ctx.lineTo(x + w - 0.5, y + 0.5);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.moveTo(x + w - 0.5, y + 0.5);
  ctx.lineTo(x + w - 0.5, y + h - 0.5);
  ctx.lineTo(x + 0.5, y + h - 0.5);
  ctx.stroke();
}

function screw(ctx, x, y, r, a) {
  ctx.fillStyle = "rgba(148,152,156,0.5)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,252,0.3)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.arc(x, y, r - 0.3, Math.PI * 0.9, Math.PI * 1.7);
  ctx.stroke();
  ctx.strokeStyle = "rgba(8,9,11,0.75)";
  ctx.lineWidth = Math.max(0.7, r * 0.3);
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(a) * r * 0.72, y - Math.sin(a) * r * 0.72);
  ctx.lineTo(x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72);
  ctx.stroke();
}

function panelScrews(ctx, x, y, w, h, seed, salt) {
  const inset = 6;
  screw(ctx, x + inset, y + inset, 2.2, rand(seed, salt) * Math.PI);
  screw(ctx, x + w - inset, y + inset, 2.2, rand(seed, salt + 1) * Math.PI);
  screw(ctx, x + inset, y + h - inset, 2.2, rand(seed, salt + 2) * Math.PI);
  screw(ctx, x + w - inset, y + h - inset, 2.2, rand(seed, salt + 3) * Math.PI);
}

// Silkscreen label: a text-like run of tiny rules. Reads as printed words at
// arm's length without being a font.
function silkRule(ctx, x, y, w, seed, salt, alpha) {
  ctx.fillStyle = `rgba(214,218,214,${alpha})`;
  let cx = x;
  let k = 0;
  while (cx < x + w && k < 24) {
    const seg = 2 + rand(seed, salt + k * 7) * 4.5;
    if (rand(seed, salt + k * 7 + 3) > 0.2) ctx.fillRect(cx, y, Math.min(seg, x + w - cx), 1.1);
    cx += seg + 1.7;
    k += 1;
  }
}

// One warm indicator: dome, hot filament dot, additive halo. The single
// permitted warm mark per composition.
function warmLamp(ctx, x, y, r) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4.4);
  g.addColorStop(0, "rgba(255,196,120,0.8)");
  g.addColorStop(0.28, "rgba(255,150,60,0.34)");
  g.addColorStop(1, "rgba(255,150,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 4.4, y - r * 4.4, r * 8.8, r * 8.8);
  ctx.restore();
  ctx.fillStyle = "rgba(255,214,150,0.95)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,242,0.9)";
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.36, 0, Math.PI * 2);
  ctx.fill();
}

function dimLamp(ctx, x, y, r) {
  ctx.fillStyle = "rgba(52,50,46,0.85)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(190,192,188,0.3)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

// Glyph-shaped marks, not a font: five strokes gated by bits, so every cell
// lands as a plausible character. Caller sets fillStyle.
function glyphMarks(ctx, x, y, s, bits) {
  if (bits & 1) ctx.fillRect(x, y, s * 3.4, s);
  if (bits & 2) ctx.fillRect(x, y + s * 5, s * 3.4, s);
  if (bits & 4) ctx.fillRect(x, y, s, s * 6);
  if (bits & 8) ctx.fillRect(x + s * 2.6, y, s, s * 6);
  if (bits & 16) ctx.fillRect(x, y + s * 2.4, s * 3.4, s);
}

function hexPath(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = rot + (i * Math.PI) / 3;
    const vx = x + Math.cos(a) * r;
    const vy = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(vx, vy);
    else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
}

/* --- 1. vu-bank ---------------------------------------------------------- */

function vuMeter(ctx, x, y, w, h, seed, salt, hot) {
  ctx.fillStyle = "rgba(14,15,17,0.78)";
  ctx.fillRect(x, y, w, h);
  const fx = x + 3, fy = y + 3, fw = w - 6, fh = h - 6;
  ctx.fillStyle = "rgba(226,221,206,0.88)";
  ctx.fillRect(fx, fy, fw, fh);
  const shade = ctx.createLinearGradient(0, fy, 0, fy + fh);
  shade.addColorStop(0, "rgba(112,108,96,0.26)");
  shade.addColorStop(0.4, "rgba(112,108,96,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(fx, fy, fw, fh);
  const cx = x + w / 2;
  const cy = y + h * 0.94;
  const r = h * 0.74;
  const a0 = -Math.PI / 2 - 0.66;
  const sweep = 1.32;
  ctx.strokeStyle = "rgba(30,28,24,0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a0 + sweep);
  ctx.stroke();
  // the red sector: printed scale ink, thicker, sitting just proud of the arc
  ctx.strokeStyle = "rgba(212,58,36,0.88)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1.6, a0 + sweep * 0.78, a0 + sweep);
  ctx.stroke();
  for (let t = 0; t <= 20; t += 1) {
    const major = t % 4 === 0;
    const a = a0 + (sweep * t) / 20;
    const r1 = r - (major ? 6 : 3.4);
    ctx.strokeStyle = t / 20 > 0.78 ? "rgba(212,58,36,0.8)" : "rgba(30,28,24,0.8)";
    ctx.lineWidth = major ? 1.1 : 0.6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * (r - 0.5), cy + Math.sin(a) * (r - 0.5));
    ctx.stroke();
    if (major) {
      // numeral stand-ins: a short printed dash under each major tick
      ctx.fillStyle = "rgba(46,42,36,0.6)";
      ctx.fillRect(cx + Math.cos(a) * (r - 10) - 1.6, cy + Math.sin(a) * (r - 10) - 0.6, 3.2, 1.2);
    }
  }
  const defl = hot
    ? 0.85 + rand(seed, salt + 5) * 0.11
    : 0.08 + rand(seed, salt + 5) * 0.58;
  const na = a0 + sweep * defl;
  ctx.strokeStyle = "rgba(20,18,14,0.25)";
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(cx + 1.2, cy + 1.4);
  ctx.lineTo(cx + Math.cos(na) * r * 0.94 + 1.2, cy + Math.sin(na) * r * 0.94 + 1.4);
  ctx.stroke();
  ctx.strokeStyle = "rgba(24,20,16,0.95)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(na) * r * 0.1, cy - Math.sin(na) * r * 0.1);
  ctx.lineTo(cx + Math.cos(na) * r * 0.94, cy + Math.sin(na) * r * 0.94);
  ctx.stroke();
  ctx.fillStyle = "rgba(24,22,18,0.95)";
  ctx.beginPath();
  ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
  ctx.fill();
  // "VU" stand-in: two printed rules mid-face
  ctx.fillStyle = "rgba(46,42,36,0.7)";
  ctx.fillRect(cx - 5.4, fy + fh * 0.6, 4.2, 1.3);
  ctx.fillRect(cx + 1.2, fy + fh * 0.6, 4.2, 1.3);
  // glass glare
  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy, fw, fh);
  ctx.clip();
  const glare = ctx.createLinearGradient(fx, fy, fx + fw * 0.5, fy + fh);
  glare.addColorStop(0, "rgba(255,255,255,0.15)");
  glare.addColorStop(0.45, "rgba(255,255,255,0.02)");
  glare.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glare;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(fx + fw * 0.55, fy);
  ctx.lineTo(fx + fw * 0.18, fy + fh);
  ctx.lineTo(fx, fy + fh);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// A bank of VU meters at plausible deflections. One needle is pinned into the
// red and its channel lamp burns warm: the authored gesture.
function drawVuBank(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const short = Math.min(width, height);
  const mw = clamp(short * 0.36, 84, 118);
  const mh = mw * 0.64;
  const gap = mw * 0.08;
  const fit = Math.max(2, Math.floor((width * 0.88 + gap) / (mw + gap)));
  const n = Math.min(fit, 3 + Math.floor(rand(seed, 101) * 2));
  const bw = n * mw + (n - 1) * gap;
  const rail = 26;
  const px = (width - bw) / 2 + (rand(seed, 103) - 0.5) * width * 0.05;
  const py = height * (0.5 + (rand(seed, 105) - 0.5) * 0.16) - (mh + rail) / 2;
  brushedPanel(ctx, px - 12, py - 12, bw + 24, mh + rail + 22, seed, 110);
  panelScrews(ctx, px - 12, py - 12, bw + 24, mh + rail + 22, seed, 115);
  const hot = Math.floor(rand(seed, 107) * n);
  for (let i = 0; i < n; i += 1) {
    const mx = px + i * (mw + gap);
    vuMeter(ctx, mx, py, mw, mh, seed, 130 + i * 37, i === hot);
    const lx = mx + mw / 2;
    const ly = py + mh + 9;
    if (i === hot) warmLamp(ctx, lx, ly, 3);
    else dimLamp(ctx, lx, ly, 3);
    silkRule(ctx, lx - mw * 0.24, ly + 8, mw * 0.48, seed, 170 + i * 9, 0.42);
  }
  ctx.restore();
}

/* --- 2. patch-catenary --------------------------------------------------- */

function jack(ctx, x, y, seed, salt) {
  ctx.strokeStyle = "rgba(198,202,206,0.5)";
  ctx.lineWidth = 1.3;
  hexPath(ctx, x, y, 7, rand(seed, salt) * Math.PI);
  ctx.stroke();
  ctx.fillStyle = "rgba(206,208,204,0.55)";
  ctx.beginPath();
  ctx.arc(x, y, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(6,7,9,0.92)";
  ctx.beginPath();
  ctx.arc(x, y, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,252,0.4)";
  ctx.beginPath();
  ctx.arc(x - 1.6, y - 1.6, 0.8, 0, Math.PI * 2);
  ctx.fill();
}

function cablePath(ctx, ax, ay, bx, by, cpx, cpy, ox, oy) {
  ctx.beginPath();
  ctx.moveTo(ax + ox, ay + oy);
  ctx.quadraticCurveTo(cpx + ox, cpy + oy, bx + ox, by + oy);
  ctx.stroke();
}

function patchCable(ctx, ax, ay, bx, by, sag, tone) {
  // quadratic control 2*sag below the chord midpoint puts the curve's lowest
  // point sag below it: gravity, not a decorative arc
  const cpx = (ax + bx) / 2;
  const cpy = (ay + by) / 2 + sag * 2;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 3.6;
  cablePath(ctx, ax, ay, bx, by, cpx, cpy, 1.4, 2.6);
  ctx.strokeStyle = "rgba(15,15,18,0.9)";
  ctx.lineWidth = 3.2;
  cablePath(ctx, ax, ay, bx, by, cpx, cpy, 0, 0);
  ctx.strokeStyle = rgba(tone, 0.5);
  ctx.lineWidth = 1.9;
  cablePath(ctx, ax, ay, bx, by, cpx, cpy, 0, 0);
  ctx.strokeStyle = "rgba(240,242,238,0.32)";
  ctx.lineWidth = 0.8;
  cablePath(ctx, ax, ay, bx, by, cpx, cpy, 0, -1);
  // plug boots seated in the jacks
  ctx.fillStyle = "rgba(20,20,23,0.95)";
  ctx.beginPath();
  ctx.arc(ax, ay, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, by, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(225,228,230,0.4)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(ax, ay, 3.4, Math.PI * 0.9, Math.PI * 1.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(bx, by, 3.4, Math.PI * 0.9, Math.PI * 1.8);
  ctx.stroke();
}

// A patch bay under gravity: hexagonal jacks in rank and file, patched pairs
// sagging in true catenary bellies. One cable hangs dead from its jack, its
// free plug dangling below the panel; that jack's ring burns warm.
function drawPatchCatenary(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const rows = 2 + Math.floor(rand(seed, 401) * 2);
  const cols = 7 + Math.floor(rand(seed, 403) * 4);
  const sx = clamp((width * 0.82) / cols, 24, 40);
  const sy = clamp(height * 0.15, 26, 42);
  const gw = (cols - 1) * sx;
  const gh = (rows - 1) * sy;
  const gx = (width - gw) / 2 + (rand(seed, 405) - 0.5) * width * 0.04;
  const gy = height * 0.36 + (rand(seed, 407) - 0.5) * height * 0.1 - gh / 2;
  const bx0 = gx - sx * 0.7, by0 = gy - sy * 0.85;
  const bw0 = gw + sx * 1.4, bh0 = gh + sy * 1.6;
  brushedPanel(ctx, bx0, by0, bw0, bh0, seed, 410);
  panelScrews(ctx, bx0, by0, bw0, bh0, seed, 415);
  for (let c = 0; c < cols; c += 1) {
    silkRule(ctx, gx + c * sx - 7, gy - sy * 0.58, 14, seed, 420 + c * 3, 0.38);
  }
  const jx = (c) => gx + c * sx;
  const jyv = (r) => gy + r * sy;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      jack(ctx, jx(c), jyv(r), seed, 430 + (r * cols + c) * 7);
    }
  }
  // the dead cable's jack, ringed warm before its cable is drawn over it
  const total = rows * cols;
  const dIdx = Math.floor(rand(seed, 480) * total);
  const dx0 = jx(dIdx % cols);
  const dy0 = jyv(Math.floor(dIdx / cols));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = "rgba(255,170,80,0.7)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(dx0, dy0, 6.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,150,60,0.2)";
  ctx.lineWidth = 4.4;
  ctx.beginPath();
  ctx.arc(dx0, dy0, 7.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // patched pairs
  const m = 2 + Math.floor(rand(seed, 409) * 3);
  for (let k = 0; k < m; k += 1) {
    let a = Math.min(total - 1, Math.floor(rand(seed, 460 + k * 11) * total));
    let b = Math.min(total - 1, Math.floor(rand(seed, 461 + k * 11) * total));
    if (a === dIdx) a = (a + 1) % total;
    // walk b forward until it is neither the other end nor the dead jack;
    // the remap itself can land on dIdx, so re-check both every step
    while (b === a || b === dIdx) b = (b + 1) % total;
    const ax = jx(a % cols), ay = jyv(Math.floor(a / cols));
    const bxx = jx(b % cols), byy = jyv(Math.floor(b / cols));
    const dist = Math.hypot(bxx - ax, byy - ay);
    const sag = dist * 0.2 + 7 + rand(seed, 462 + k * 11) * 13;
    patchCable(ctx, ax, ay, bxx, byy, sag, fl(palette, k));
  }
  // the dead cable: hangs straight down with a slight seeded bow
  const drop = Math.min(height - 8 - dy0, height * 0.42);
  const drift = (rand(seed, 482) - 0.5) * 18;
  const ex = dx0 + drift;
  const ey = dy0 + drop;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(15,15,18,0.9)";
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(dx0, dy0);
  ctx.quadraticCurveTo(dx0 + drift * 0.15, dy0 + drop * 0.55, ex, ey);
  ctx.stroke();
  ctx.strokeStyle = rgba(fl(palette, m), 0.5);
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  ctx.moveTo(dx0, dy0);
  ctx.quadraticCurveTo(dx0 + drift * 0.15, dy0 + drop * 0.55, ex, ey);
  ctx.stroke();
  // free plug: sleeve, collar, tip
  ctx.fillStyle = "rgba(20,20,23,0.95)";
  ctx.fillRect(ex - 2, ey, 4, 8);
  ctx.fillStyle = "rgba(210,214,218,0.8)";
  ctx.fillRect(ex - 1.4, ey + 8, 2.8, 3.4);
  ctx.fillStyle = "rgba(240,242,238,0.6)";
  ctx.fillRect(ex - 0.9, ey + 11.4, 1.8, 2.2);
  ctx.restore();
}

/* --- 3. tape-transport --------------------------------------------------- */

function reel(ctx, x, y, R, rp, hub, phase, seed, salt) {
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.arc(x + 2, y + 3, R, 0, Math.PI * 2);
  ctx.fill();
  // tape pack, wound to its true radius
  ctx.fillStyle = "rgba(42,34,28,0.92)";
  ctx.beginPath();
  ctx.arc(x, y, rp, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 0.7;
  let ring = 0;
  for (let rr = hub + 2.6; rr < rp - 1; rr += 3.1) {
    ctx.strokeStyle = `rgba(214,194,164,${0.05 + rand(seed, salt + ring * 3) * 0.09})`;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.stroke();
    ring += 1;
  }
  // smoked flange over the pack
  ctx.fillStyle = "rgba(120,126,132,0.1)";
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(215,220,224,0.5)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.stroke();
  // three flange windows and the spokes between them
  for (let w = 0; w < 3; w += 1) {
    const a = phase + w * 2.0944;
    ctx.strokeStyle = "rgba(225,228,232,0.26)";
    ctx.lineWidth = R * 0.17;
    ctx.beginPath();
    ctx.arc(x, y, R * 0.6, a + 0.3, a + 1.5);
    ctx.stroke();
    ctx.strokeStyle = "rgba(190,194,198,0.42)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * hub * 0.9, y + Math.sin(a) * hub * 0.9);
    ctx.lineTo(x + Math.cos(a) * R * 0.94, y + Math.sin(a) * R * 0.94);
    ctx.stroke();
  }
  // hub, its bore, three tiny screws turning with the reel
  ctx.fillStyle = "rgba(200,198,190,0.75)";
  ctx.beginPath();
  ctx.arc(x, y, hub, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(20,21,24,0.9)";
  ctx.beginPath();
  ctx.arc(x, y, hub * 0.42, 0, Math.PI * 2);
  ctx.fill();
  for (let s = 0; s < 3; s += 1) {
    const a = phase * 0.5 + s * 2.0944 + 0.5;
    screw(ctx, x + Math.cos(a) * hub * 0.7, y + Math.sin(a) * hub * 0.7, 1.4, a);
  }
  ctx.strokeStyle = "rgba(255,255,252,0.5)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(x, y, R, -2.4, -1.55);
  ctx.stroke();
}

// A reel pair with radius-true spooling: the pack radii obey tape-area
// conservation, so one reel is visibly spending itself into the other. The
// tape threads guides, capstan and pinch roller. The record lamp burns warm.
function drawTapeTransport(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const short = Math.min(width, height);
  const R = clamp(short * 0.2, 42, 62);
  const dxr = clamp(width * 0.19, R * 1.45, R * 2.4);
  const cx = width / 2 + (rand(seed, 801) - 0.5) * width * 0.06;
  const cy = height * 0.42 + (rand(seed, 803) - 0.5) * height * 0.08;
  const deckW = dxr * 2 + R * 2.9;
  const deckH = R * 2 + 76;
  const deckX = cx - deckW / 2;
  const deckY = cy - R - 28;
  brushedPanel(ctx, deckX, deckY, deckW, deckH, seed, 805);
  panelScrews(ctx, deckX, deckY, deckW, deckH, seed, 811);
  const hub = R * 0.22;
  const packMax = R * 0.94;
  // take-up share: always past half, so the asymmetry reads at a glance
  const t = 0.58 + rand(seed, 807) * 0.34;
  const rs = Math.sqrt(hub * hub + (1 - t) * (packMax * packMax - hub * hub));
  const rt = Math.sqrt(hub * hub + t * (packMax * packMax - hub * hub));
  const phase = ((tick % 6283) / 1000) + rand(seed, 809) * 6.28;
  // tape path first, so reels overlap its ends
  const gy = cy + R + 16;
  const g1x = cx - dxr * 0.42;
  const g2x = cx + dxr * 0.02;
  const capX = cx + dxr * 0.45;
  const p0x = cx - dxr + rs * 0.3, p0y = cy + rs * 0.95;
  const p3x = cx + dxr - rt * 0.3, p3y = cy + rt * 0.95;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(46,38,30,0.9)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(p0x, p0y);
  ctx.lineTo(g1x, gy);
  ctx.lineTo(g2x, gy);
  ctx.lineTo(capX, gy);
  ctx.lineTo(p3x, p3y);
  ctx.stroke();
  ctx.strokeStyle = "rgba(230,225,210,0.32)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(p0x, p0y - 1);
  ctx.lineTo(g1x, gy - 1);
  ctx.lineTo(g2x, gy - 1);
  ctx.lineTo(capX, gy - 1);
  ctx.lineTo(p3x, p3y - 1);
  ctx.stroke();
  reel(ctx, cx - dxr, cy, R, rs, hub, phase, seed, 820);
  reel(ctx, cx + dxr, cy, R, rt, hub, phase * 1.7 + 1.1, seed, 860);
  // guides, capstan, pinch roller
  for (const gx of [g1x, g2x]) {
    ctx.fillStyle = "rgba(206,208,204,0.7)";
    ctx.beginPath();
    ctx.arc(gx, gy, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(20,21,24,0.9)";
    ctx.beginPath();
    ctx.arc(gx, gy, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(30,31,34,0.95)";
  ctx.beginPath();
  ctx.arc(capX, gy, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(44,44,48,0.9)";
  ctx.beginPath();
  ctx.arc(capX + 6.8, gy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(210,214,218,0.35)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(capX + 6.8, gy, 5, Math.PI * 0.8, Math.PI * 1.9);
  ctx.stroke();
  // mechanical counter: four ivory glyph digits in a dark window
  const cwX = cx - 19, cwY = cy - R - 22;
  ctx.fillStyle = "rgba(8,9,11,0.85)";
  ctx.fillRect(cwX, cwY, 38, 13);
  ctx.strokeStyle = "rgba(210,214,218,0.3)";
  ctx.lineWidth = 0.8;
  ctx.strokeRect(cwX, cwY, 38, 13);
  ctx.fillStyle = "rgba(228,224,208,0.85)";
  for (let d = 0; d < 4; d += 1) {
    const bits = 1 + Math.floor(rand(seed, 900 + d * 7) * 30);
    glyphMarks(ctx, cwX + 4 + d * 8.6, cwY + 3, 1.15, bits);
  }
  warmLamp(ctx, cwX + 47, cwY + 6.5, 2.6);
  silkRule(ctx, cwX - 34, cwY + 5.5, 28, seed, 910, 0.4);
  ctx.restore();
}

/* --- 4. phosphor-readout ------------------------------------------------- */

// A recessed phosphor terminal: seeded lines of glyph-shaped marks aging
// dimmer up the tube, one line held in inverse video, a cursor still lit.
// Scanlines and a corner glare keep it glass. Bezel LED burns warm.
function drawPhosphorReadout(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const gw = clamp(width * 0.62, 180, 330);
  const gh = clamp(height * 0.52, 105, 175);
  const gx = (width - gw) / 2 + (rand(seed, 1201) - 0.5) * width * 0.07;
  const gy = (height - gh) / 2 + (rand(seed, 1203) - 0.5) * height * 0.08;
  brushedPanel(ctx, gx - 14, gy - 14, gw + 28, gh + 28, seed, 1205);
  panelScrews(ctx, gx - 14, gy - 14, gw + 28, gh + 28, seed, 1206);
  ctx.fillStyle = "rgba(6,10,8,0.55)";
  ctx.fillRect(gx, gy, gw, gh);
  // recess: shadow along top and left, lit lip bottom and right
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(gx + 1, gy + gh - 1);
  ctx.lineTo(gx + 1, gy + 1);
  ctx.lineTo(gx + gw - 1, gy + 1);
  ctx.stroke();
  ctx.strokeStyle = "rgba(235,238,240,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(gx + gw - 0.5, gy + 1);
  ctx.lineTo(gx + gw - 0.5, gy + gh - 0.5);
  ctx.lineTo(gx + 1, gy + gh - 0.5);
  ctx.stroke();
  const ph = fl(palette, 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(gx, gy, gw, gh);
  ctx.clip();
  // tube glow pooling at centre
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const pool = ctx.createRadialGradient(gx + gw / 2, gy + gh / 2, 0, gx + gw / 2, gy + gh / 2, gw * 0.55);
  pool.addColorStop(0, rgba(ph, 0.09));
  pool.addColorStop(1, rgba(ph, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(gx, gy, gw, gh);
  ctx.restore();
  const rowH = 11;
  const rows = Math.max(4, Math.floor((gh - 14) / rowH));
  const cols = Math.max(12, Math.floor((gw - 18) / 6));
  const invRow = rows - 2 - Math.floor(rand(seed, 1207) * Math.min(4, rows - 2));
  for (let r = 0; r < rows; r += 1) {
    const age = rows <= 1 ? 1 : r / (rows - 1);
    const ry = gy + 8 + r * rowH;
    const inverse = r === invRow;
    if (inverse) {
      ctx.fillStyle = rgba(ph, 0.5);
      ctx.fillRect(gx + 5, ry - 2, gw - 10, rowH - 1.5);
      ctx.fillStyle = "rgba(6,10,8,0.85)";
    } else {
      ctx.fillStyle = rgba(ph, 0.2 + age * 0.5);
    }
    let c = rand(seed, 1210 + r * 13) < 0.3 ? 2 + Math.floor(rand(seed, 1211 + r * 13) * 4) : 0;
    while (c < cols) {
      const wordLen = 1 + Math.floor(rand(seed, 1300 + r * 53 + c * 7) * 7);
      for (let k = 0; k < wordLen && c < cols; k += 1, c += 1) {
        const bits = 1 + Math.floor(rand(seed, 1400 + r * 61 + c * 11) * 30);
        glyphMarks(ctx, gx + 9 + c * 6, ry, 1.05, bits);
      }
      c += 1;
      if (rand(seed, 1310 + r * 53 + c * 7) < 0.14) break;
    }
  }
  // cursor: a solid cell on the last line, still burning
  const curC = 2 + Math.floor(rand(seed, 1209) * cols * 0.6);
  const curX = gx + 9 + curC * 6;
  const curY = gy + 8 + (rows - 1) * rowH;
  ctx.fillStyle = rgba(ph, 0.95);
  ctx.fillRect(curX, curY - 0.5, 4.6, 7.5);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const cg = ctx.createRadialGradient(curX + 2.3, curY + 3.5, 0, curX + 2.3, curY + 3.5, 12);
  cg.addColorStop(0, rgba(ph, 0.5));
  cg.addColorStop(1, rgba(ph, 0));
  ctx.fillStyle = cg;
  ctx.fillRect(curX - 12, curY - 10, 29, 27);
  ctx.restore();
  // scanlines
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  for (let yy = gy; yy < gy + gh; yy += 2.4) ctx.fillRect(gx, yy, gw, 1);
  // corner glare
  const glare = ctx.createLinearGradient(gx, gy, gx + gw * 0.4, gy + gh * 0.7);
  glare.addColorStop(0, "rgba(255,255,255,0.09)");
  glare.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glare;
  ctx.fillRect(gx, gy, gw * 0.5, gh * 0.8);
  ctx.restore();
  warmLamp(ctx, gx + gw + 7, gy + gh + 7, 2.4);
  silkRule(ctx, gx, gy + gh + 8, 44, seed, 1215, 0.4);
  ctx.restore();
}

/* --- 5. toggle-rail ------------------------------------------------------ */

function toggle(ctx, x, y, dir, seed, salt) {
  ctx.fillStyle = "rgba(18,19,22,0.85)";
  ctx.fillRect(x - 9, y - 9, 18, 18);
  ctx.strokeStyle = "rgba(198,202,206,0.5)";
  ctx.lineWidth = 1.3;
  hexPath(ctx, x, y, 7, rand(seed, salt) * Math.PI);
  ctx.stroke();
  ctx.fillStyle = "rgba(118,122,126,0.8)";
  ctx.beginPath();
  ctx.arc(x, y, 3.2, 0, Math.PI * 2);
  ctx.fill();
  const ex = x + (rand(seed, salt + 1) - 0.5) * 1.6;
  const ey = y - dir * 13;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(30,31,34,0.95)";
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.strokeStyle = "rgba(225,228,230,0.65)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(x, y - dir * 2);
  ctx.lineTo(ex, ey + dir * 1);
  ctx.stroke();
  ctx.fillStyle = "rgba(230,232,234,0.9)";
  ctx.beginPath();
  ctx.arc(ex, ey, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.arc(ex - 0.8, ey - 0.9, 0.9, 0, Math.PI * 2);
  ctx.fill();
}

// Ranks of bat toggles under silkscreen rules, a guard box printed around one
// group. Every lever in a row throws the same way except one: the maverick,
// and its lamp is the one burning.
function drawToggleRail(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const cols = 5 + Math.floor(rand(seed, 1601) * 4);
  const rows = 1 + Math.floor(rand(seed, 1603) * 2);
  const sx = clamp((width * 0.8) / cols, 28, 46);
  const sy = 54;
  const gw = cols * sx;
  const gh = rows * sy;
  const gx = (width - gw) / 2 + (rand(seed, 1605) - 0.5) * width * 0.05;
  const gy = height / 2 - gh / 2 + (rand(seed, 1607) - 0.5) * height * 0.14;
  brushedPanel(ctx, gx - 10, gy - 8, gw + 20, gh + 16, seed, 1609);
  panelScrews(ctx, gx - 10, gy - 8, gw + 20, gh + 16, seed, 1611);
  // printed guard box around a seeded group in the top row
  const gStart = Math.floor(rand(seed, 1613) * Math.max(1, cols - 3));
  const gLen = Math.min(2 + Math.floor(rand(seed, 1615) * 2), cols - gStart);
  ctx.strokeStyle = "rgba(216,220,214,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(gx + gStart * sx + 3, gy + 1, gLen * sx - 6, sy - 4);
  silkRule(ctx, gx + gStart * sx + 8, gy - 2.5, gLen * sx - 20, seed, 1617, 0.5);
  const maverick = Math.floor(rand(seed, 1619) * cols * rows);
  for (let r = 0; r < rows; r += 1) {
    const rowDir = rand(seed, 1620 + r * 7) < 0.5 ? -1 : 1;
    for (let c = 0; c < cols; c += 1) {
      const idx = r * cols + c;
      const cx = gx + c * sx + sx / 2;
      const cy = gy + r * sy + sy * 0.64;
      const dir = idx === maverick ? -rowDir : rowDir;
      const ly = gy + r * sy + 11;
      if (idx === maverick) warmLamp(ctx, cx, ly, 2.6);
      else dimLamp(ctx, cx, ly, 2.6);
      toggle(ctx, cx, cy, dir, seed, 1650 + idx * 17);
      silkRule(ctx, cx - 8, cy + 13.5, 16, seed, 1700 + idx * 5, 0.36);
    }
  }
  ctx.restore();
}

/* --- 6. chart-recorder --------------------------------------------------- */

// A two-pen strip chart: sepia grid on ivory paper feeding off a drum, both
// traces breathing until one sharp anomaly spikes off the band. The pen arm
// still touches the trace head; the pilot lamp burns warm over the event.
function drawChartRecorder(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const px = width * 0.06;
  const pw = width * 0.88;
  const ph = clamp(height * 0.42, 92, 152);
  const py = height * 0.5 - ph / 2 + (rand(seed, 2001) - 0.5) * height * 0.14;
  brushedPanel(ctx, px - 8, py - 24, pw + 16, ph + 48, seed, 2003);
  panelScrews(ctx, px - 8, py - 24, pw + 16, ph + 48, seed, 2005);
  ctx.fillStyle = "rgba(232,228,212,0.52)";
  ctx.fillRect(px, py, pw, ph);
  // seeded trace parameters, shared with the pen arm below
  const base = py + ph * (0.42 + rand(seed, 2007) * 0.16);
  const amps = [
    ph * (0.05 + rand(seed, 2009) * 0.07),
    ph * (0.02 + rand(seed, 2011) * 0.05),
    ph * (0.008 + rand(seed, 2013) * 0.02),
  ];
  const freqs = [
    0.008 + rand(seed, 2015) * 0.01,
    0.03 + rand(seed, 2017) * 0.02,
    0.09 + rand(seed, 2019) * 0.06,
  ];
  const phs = [
    tick * 0.0004 + rand(seed, 2021) * 6.28,
    rand(seed, 2023) * 6.28,
    rand(seed, 2025) * 6.28,
  ];
  const spikeX = px + pw * (0.22 + rand(seed, 2027) * 0.5);
  const spikeA = ph * (0.26 + rand(seed, 2029) * 0.14) * (rand(seed, 2031) < 0.5 ? -1 : 1);
  const traceY = (x) => {
    let y = base;
    for (let i = 0; i < 3; i += 1) y += Math.sin(x * freqs[i] + phs[i]) * amps[i];
    const d = (x - spikeX) / 4;
    y += spikeA * Math.exp(-d * d);
    return clamp(y, py + 5, py + ph - 5);
  };
  const penX = px + pw - 18;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  // grid: minor and major rules both ways, sepia ink
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = "rgba(122,106,88,0.2)";
  for (let x = px; x <= px + pw; x += 5.2) {
    ctx.beginPath();
    ctx.moveTo(x, py);
    ctx.lineTo(x, py + ph);
    ctx.stroke();
  }
  for (let y = py + 5.2; y < py + ph; y += 5.2) {
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px + pw, y);
    ctx.stroke();
  }
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = "rgba(122,106,88,0.38)";
  for (let x = px; x <= px + pw; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, py);
    ctx.lineTo(x, py + ph);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(px, py + ph / 2);
  ctx.lineTo(px + pw, py + ph / 2);
  ctx.stroke();
  // event line at the anomaly
  if (ctx.setLineDash) ctx.setLineDash([2, 3]);
  ctx.strokeStyle = "rgba(150,96,72,0.5)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(spikeX, py);
  ctx.lineTo(spikeX, py + ph);
  ctx.stroke();
  if (ctx.setLineDash) ctx.setLineDash([]);
  // second pen: dimmer, offset channel, lags the head
  ctx.strokeStyle = rgba(fl(palette, 1), 0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = px; x <= penX - 9; x += 2) {
    const y = clamp(
      traceY(x + 40) + ph * 0.2 - Math.sin(x * freqs[1] * 1.7 + phs[2]) * amps[1],
      py + 4, py + ph - 4
    );
    if (x === px) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // main pen trace
  ctx.strokeStyle = "rgba(34,30,26,0.9)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let x = px; x <= penX; x += 2) {
    const y = traceY(x);
    if (x === px) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // sprocket holes
  ctx.fillStyle = "rgba(10,10,12,0.55)";
  for (let x = px + 8; x < px + pw - 4; x += 16) {
    ctx.beginPath();
    ctx.arc(x, py + 4.5, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, py + ph - 4.5, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  // feed drum shading on the left edge
  const drum = ctx.createLinearGradient(px, 0, px + 16, 0);
  drum.addColorStop(0, "rgba(0,0,0,0.38)");
  drum.addColorStop(0.55, "rgba(255,255,250,0.1)");
  drum.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = drum;
  ctx.fillRect(px, py, 16, ph);
  ctx.restore();
  // pen arm from the bridge down to the trace head
  const headY = traceY(penX);
  const pivX = penX + 9;
  const pivY = py - 13;
  ctx.fillStyle = "rgba(24,25,28,0.9)";
  ctx.fillRect(pivX - 5, pivY - 5, 16, 10);
  screw(ctx, pivX + 6, pivY, 1.8, rand(seed, 2033) * Math.PI);
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(28,29,32,0.95)";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(pivX, pivY);
  ctx.lineTo(penX, headY);
  ctx.stroke();
  ctx.strokeStyle = "rgba(222,226,228,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pivX - 0.6, pivY);
  ctx.lineTo(penX - 0.6, headY);
  ctx.stroke();
  ctx.fillStyle = "rgba(34,30,26,0.95)";
  ctx.beginPath();
  ctx.arc(penX, headY, 1.9, 0, Math.PI * 2);
  ctx.fill();
  warmLamp(ctx, px + 10, py - 13, 2.6);
  silkRule(ctx, px + 20, py - 15, 30, seed, 2035, 0.45);
  silkRule(ctx, spikeX - 12, py + ph + 6, 24, seed, 2037, 0.42);
  ctx.restore();
}

/* --- exports ------------------------------------------------------------- */

export const WAVE8_CASSETTE = {
  "vu-bank": drawVuBank,
  "patch-catenary": drawPatchCatenary,
  "tape-transport": drawTapeTransport,
  "phosphor-readout": drawPhosphorReadout,
  "toggle-rail": drawToggleRail,
  "chart-recorder": drawChartRecorder,
};

export const WAVE8_CASSETTE_META = [
  { name: "vu-bank", family: "cassette-console", blurb: "a rank of vu meters, needles at plausible throws, one pinned into the red" },
  { name: "patch-catenary", family: "cassette-console", blurb: "hex-jack patch bay, cables sagging under gravity, one hanging dead and warm-ringed" },
  { name: "tape-transport", family: "cassette-console", blurb: "reel pair spooled radius-true, tape threading capstan and guides, record lamp lit" },
  { name: "phosphor-readout", family: "cassette-console", blurb: "recessed phosphor terminal of glyph-mark lines, one inverse row, cursor still burning" },
  { name: "toggle-rail", family: "cassette-console", blurb: "silkscreened bat-toggle ranks, guard box printed, one maverick thrown and lamp lit" },
  { name: "chart-recorder", family: "cassette-console", blurb: "two-pen strip chart on sepia grid, one anomaly spike, pen arm on the trace head" },
];
