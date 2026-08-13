// wave8-observatory.js — scientific-plate astronomy: engraved-atlas ink,
// hairline rules, precise ticks, ivory on dark, one glowing anomaly per plate.
// First-party, seed-derived, no assets.
function rand(seed, salt) {
  let x = Math.imul(seed ^ Math.imul(salt + 1013904223, 1664525), 2246822519);
  x ^= x >>> 13;
  x = Math.imul(x, 3266489917);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function ink(a) { return `rgba(232,228,214,${a})`; }
function toneRgba(t, a) { return `rgba(${t[0]},${t[1]},${t[2]},${a})`; }
function accentTone(palette, idx) {
  const fl = palette && Array.isArray(palette.fluid) && palette.fluid.length
    ? palette.fluid
    : [[255, 196, 120], [140, 200, 255], [220, 150, 240]];
  return fl[idx % fl.length];
}
// True anomaly from mean anomaly, Newton on Kepler's equation. Six steps is
// plenty at plate eccentricities.
function keplerNu(M, e) {
  let E = M;
  for (let i = 0; i < 6; i += 1) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2)
  );
}

/* ------------------------------------------------------------------ *
 * engraved-sky — a star chart pasted a few degrees askew inside its
 * straight tick frame: magnitude-sized points, constellation rules,
 * a great-circle grid that bows, and one ringed nova.
 * ------------------------------------------------------------------ */
function drawEngravedSky(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const short = Math.min(width, height);
  const acc = accentTone(palette, 0);
  const m = short * 0.055;
  const x0 = m, y0 = m, x1 = width - m, y1 = height - m;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  // Double plate frame with an RA/dec tick hierarchy on all four rules.
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = ink(0.45);
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = ink(0.18);
  ctx.strokeRect(x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6);
  ctx.strokeStyle = ink(0.5);
  const hstep = (x1 - x0) / 24;
  for (let i = 1; i < 24; i += 1) {
    const tx = x0 + i * hstep;
    const len = i % 6 === 0 ? 6 : 3;
    ctx.beginPath();
    ctx.moveTo(tx, y0); ctx.lineTo(tx, y0 + len);
    ctx.moveTo(tx, y1); ctx.lineTo(tx, y1 - len);
    ctx.stroke();
  }
  const vstep = (y1 - y0) / 12;
  for (let i = 1; i < 12; i += 1) {
    const ty = y0 + i * vstep;
    const len = i % 3 === 0 ? 6 : 3;
    ctx.beginPath();
    ctx.moveTo(x0, ty); ctx.lineTo(x0 + len, ty);
    ctx.moveTo(x1, ty); ctx.lineTo(x1 - len, ty);
    ctx.stroke();
  }
  // The chart itself, clipped to the frame and tilted: the plate reads as a
  // sky survey mounted slightly off square, which is the authored gesture.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
  const tiltA = (rnd(1010) - 0.5) * 0.12 + tick * 0.0000004;
  ctx.translate(cx, cy);
  ctx.rotate(tiltA);
  ctx.translate(-cx, -cy);
  const gw = (x1 - x0) * 1.16, gh = (y1 - y0) * 1.16;
  const gx0 = cx - gw / 2, gy0 = cy - gh / 2;
  // Declination hairlines bow away from the mid-parallel.
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = ink(0.14);
  const rows = 9;
  for (let j = 0; j <= rows; j += 1) {
    const yb = gy0 + (gh * j) / rows;
    const bow = ((j - rows / 2) / rows) * gh * 0.16;
    ctx.beginPath();
    for (let x = gx0; x <= gx0 + gw; x += 8) {
      const u = (x - cx) / (gw / 2);
      const y = yb + bow * u * u;
      if (x === gx0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Hour meridians pinch toward the pole edge of the plate.
  const poleSign = rnd(1015) > 0.5 ? 1 : -1;
  const cols = 14;
  for (let j = 0; j <= cols; j += 1) {
    const xb = gx0 + (gw * j) / cols;
    ctx.beginPath();
    for (let y = gy0; y <= gy0 + gh; y += 8) {
      const v = ((y - cy) / (gh / 2)) * poleSign;
      const pinch = Math.pow((v + 1) / 2, 2) * 0.22;
      const x = xb + (cx - xb) * pinch;
      if (y === gy0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // The ecliptic crosses as a dotted great circle, one register brighter.
  ctx.strokeStyle = ink(0.26);
  ctx.setLineDash([1, 3.5]);
  const eclPhase = rnd(1025) * Math.PI * 2;
  ctx.beginPath();
  for (let x = gx0; x <= gx0 + gw; x += 6) {
    const u = (x - gx0) / gw;
    const y = cy + Math.sin(u * Math.PI * 1.1 + eclPhase) * gh * 0.26;
    if (x === gx0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Star field, magnitude-sized; the bright few get diffraction ticks.
  const stars = 150 + Math.floor(rnd(1030) * 80);
  for (let s = 0; s < stars; s += 1) {
    const sx = gx0 + rnd(10000 + s * 7) * gw;
    const sy = gy0 + rnd(10001 + s * 7) * gh;
    const mag = Math.pow(rnd(10002 + s * 7), 2.4);
    const r = 0.4 + mag * 1.9;
    ctx.fillStyle = ink(0.3 + mag * 0.62);
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    if (mag > 0.62) {
      ctx.strokeStyle = ink(0.3);
      ctx.lineWidth = 0.5;
      const sp = r + 2.4 + mag * 2;
      ctx.beginPath();
      ctx.moveTo(sx - sp, sy); ctx.lineTo(sx + sp, sy);
      ctx.moveTo(sx, sy - sp); ctx.lineTo(sx, sy + sp);
      ctx.stroke();
    }
  }
  // Constellation figures: hairline rules joining ringed anchor stars.
  const groups = 3 + Math.floor(rnd(1040) * 3);
  for (let g = 0; g < groups; g += 1) {
    const nPts = 4 + Math.floor(rnd(12000 + g * 97) * 4);
    const gr = short * (0.09 + rnd(12001 + g * 97) * 0.09);
    let rx = x0 + (0.14 + rnd(12002 + g * 97) * 0.72) * (x1 - x0);
    let ry = y0 + (0.14 + rnd(12003 + g * 97) * 0.72) * (y1 - y0);
    let ang = rnd(12004 + g * 97) * Math.PI * 2;
    const px = [], py = [];
    for (let p = 0; p < nPts; p += 1) {
      px.push(rx);
      py.push(ry);
      ang += (rnd(12010 + g * 97 + p * 5) - 0.5) * 1.7;
      const hop = gr * (0.45 + rnd(12011 + g * 97 + p * 5) * 0.6);
      rx += Math.cos(ang) * hop;
      ry += Math.sin(ang) * hop;
    }
    ctx.strokeStyle = ink(0.34);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let p = 0; p < nPts; p += 1) {
      if (p === 0) ctx.moveTo(px[p], py[p]); else ctx.lineTo(px[p], py[p]);
    }
    ctx.stroke();
    for (let p = 0; p < nPts; p += 1) {
      const mr = 1.2 + rnd(12012 + g * 97 + p * 5) * 1.4;
      ctx.fillStyle = ink(0.85);
      ctx.beginPath();
      ctx.arc(px[p], py[p], mr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ink(0.2);
      ctx.beginPath();
      ctx.arc(px[p], py[p], mr + 2.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
  // The anomaly: one new star, double-ringed in the plate's accent, with a
  // straight dashed pointer from the frame that ignores the chart's tilt.
  const ax = x0 + (0.2 + rnd(1300) * 0.6) * (x1 - x0);
  const ay = y0 + (0.2 + rnd(1301) * 0.6) * (y1 - y0);
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = toneRgba(acc, 0.8);
  ctx.beginPath(); ctx.arc(ax, ay, 5.5, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = toneRgba(acc, 0.4);
  ctx.beginPath(); ctx.arc(ax, ay, 9, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = ink(0.4);
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(ax, ay < cy ? y0 : y1);
  ctx.lineTo(ax, ay + (ay < cy ? -12 : 12));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(ax, ay, 0, ax, ay, 24);
  glow.addColorStop(0, toneRgba(acc, 0.5));
  glow.addColorStop(0.4, toneRgba(acc, 0.16));
  glow.addColorStop(1, toneRgba(acc, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(ax - 26, ay - 26, 52, 52);
  ctx.fillStyle = ink(0.95);
  ctx.beginPath(); ctx.arc(ax, ay, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * apsis-ledger — an orbital mechanics diagram: nested ellipses off a
 * shared focus, apside ticks, Kepler time beads that crowd apoapsis,
 * two equal-area sweep wedges, and a dashed transfer arc.
 * ------------------------------------------------------------------ */
function drawApsisLedger(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const short = Math.min(width, height);
  const acc = accentTone(palette, 1);
  const fx = width * (0.4 + rnd(2100) * 0.2);
  const fy = height * (0.42 + rnd(2101) * 0.16);
  const baseTilt = rnd(2102) * Math.PI + tick * 0.0000006;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = ink(0.3);
  ctx.lineWidth = 0.7;
  ctx.strokeRect(width * 0.04, height * 0.055, width * 0.92, height * 0.89);
  ctx.save();
  ctx.beginPath();
  ctx.rect(width * 0.04, height * 0.055, width * 0.92, height * 0.89);
  ctx.clip();
  // Surveyor's graticule under everything: dashed range rings about the
  // focus, quartered by cardinal ticks, and a fine degree fan close in.
  ctx.setLineDash([1, 3]);
  ctx.lineWidth = 0.5;
  const rings = 6 + Math.floor(rnd(2150) * 3);
  for (let q = 1; q <= rings; q += 1) {
    const rq = short * 0.075 * q;
    ctx.strokeStyle = ink(0.09);
    ctx.beginPath();
    ctx.arc(fx, fy, rq, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = ink(0.22);
  for (let q = 1; q <= rings; q += 1) {
    const rq = short * 0.075 * q;
    for (let c = 0; c < 4; c += 1) {
      const ca = baseTilt + (c * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(fx + Math.cos(ca) * (rq - 2), fy + Math.sin(ca) * (rq - 2));
      ctx.lineTo(fx + Math.cos(ca) * (rq + 2), fy + Math.sin(ca) * (rq + 2));
      ctx.stroke();
    }
  }
  const fanR = short * 0.085;
  ctx.strokeStyle = ink(0.28);
  for (let c = 0; c < 24; c += 1) {
    const ca = baseTilt + (c * Math.PI) / 12;
    const fl = c % 6 === 0 ? 5 : 2.5;
    ctx.beginPath();
    ctx.moveTo(fx + Math.cos(ca) * fanR, fy + Math.sin(ca) * fanR);
    ctx.lineTo(fx + Math.cos(ca) * (fanR + fl), fy + Math.sin(ca) * (fanR + fl));
    ctx.stroke();
  }
  // The orbit family. Eccentricity eases outward so the ledger reads as a
  // system, not a scribble.
  const orbits = 3 + Math.floor(rnd(2103) * 3);
  const params = [];
  for (let k = 0; k < orbits; k += 1) {
    const a = short * (0.13 + (k + 1) * 0.085 + rnd(2110 + k * 9) * 0.03);
    const e = clamp(0.14 + rnd(2111 + k * 9) * 0.42 - k * 0.04, 0.05, 0.6);
    const w = baseTilt + (rnd(2112 + k * 9) - 0.5) * 0.9;
    const b = a * Math.sqrt(1 - e * e);
    params.push({ a, e, w, b });
    ctx.strokeStyle = ink(k === orbits - 1 ? 0.42 : 0.32);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(
      fx - a * e * Math.cos(w), fy - a * e * Math.sin(w),
      a, b, w, 0, Math.PI * 2
    );
    ctx.stroke();
    // Apside ticks: a cross-tick at each end of the major axis, and a bead
    // on the periapsis.
    const per = [fx + a * (1 - e) * Math.cos(w), fy + a * (1 - e) * Math.sin(w)];
    const apo = [fx - a * (1 + e) * Math.cos(w), fy - a * (1 + e) * Math.sin(w)];
    ctx.strokeStyle = ink(0.55);
    for (const pt of [per, apo]) {
      ctx.beginPath();
      ctx.moveTo(pt[0] - Math.cos(w) * 3.5, pt[1] - Math.sin(w) * 3.5);
      ctx.lineTo(pt[0] + Math.cos(w) * 3.5, pt[1] + Math.sin(w) * 3.5);
      ctx.stroke();
    }
    ctx.fillStyle = ink(0.6);
    ctx.beginPath();
    ctx.arc(per[0], per[1], 1.4, 0, Math.PI * 2);
    ctx.fill();
    // Faint equal-time beads on every orbit; the measured one gets its
    // brighter set further down.
    ctx.fillStyle = ink(0.3);
    for (let i = 0; i < 14; i += 1) {
      const nu = keplerNu((i / 14) * Math.PI * 2, e);
      const rr = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
      ctx.beginPath();
      ctx.arc(fx + rr * Math.cos(w + nu), fy + rr * Math.sin(w + nu), 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The measured orbit: the most eccentric one carries equal-time beads.
  // Kepler's equation places them, so they crowd honestly at apoapsis.
  let ke = 0;
  for (let k = 1; k < orbits; k += 1) if (params[k].e > params[ke].e) ke = k;
  const P = params[ke];
  const posAt = (M) => {
    const nu = keplerNu(M, P.e);
    const r = (P.a * (1 - P.e * P.e)) / (1 + P.e * Math.cos(nu));
    return [fx + r * Math.cos(P.w + nu), fy + r * Math.sin(P.w + nu)];
  };
  const beads = 22;
  ctx.fillStyle = ink(0.6);
  for (let i = 0; i < beads; i += 1) {
    const p = posAt((i / beads) * Math.PI * 2);
    ctx.beginPath();
    ctx.arc(p[0], p[1], 1.05, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = ink(0.22);
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(fx + P.a * (1 - P.e) * Math.cos(P.w), fy + P.a * (1 - P.e) * Math.sin(P.w));
  ctx.lineTo(fx - P.a * (1 + P.e) * Math.cos(P.w), fy - P.a * (1 + P.e) * Math.sin(P.w));
  ctx.stroke();
  ctx.setLineDash([]);
  // Equal areas in equal times: a thin sliver at periapsis, a fat fan at
  // apoapsis, same sweep of mean anomaly. This is the plate's lesson.
  const wedge = (M0, M1) => {
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    for (let t = 0; t <= 12; t += 1) {
      const p = posAt(M0 + ((M1 - M0) * t) / 12);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();
    ctx.fillStyle = toneRgba(acc, 0.08);
    ctx.fill();
    ctx.strokeStyle = toneRgba(acc, 0.4);
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // Engraver's hatch: fine radii from the focus out to the arc.
    ctx.strokeStyle = toneRgba(acc, 0.18);
    ctx.lineWidth = 0.45;
    for (let t = 0; t <= 24; t += 1) {
      const p = posAt(M0 + ((M1 - M0) * t) / 24);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(p[0], p[1]);
      ctx.stroke();
    }
  };
  const dM = (Math.PI * 2) / beads;
  wedge(0, dM * 1.6);
  wedge(Math.PI - dM * 0.8, Math.PI + dM * 0.8);
  // A dashed transfer arc between the innermost and outermost orbits, with
  // a departure bead and an arrival arrowhead.
  const r1 = params[0].a, r2 = params[orbits - 1].a;
  const at = (r1 + r2) / 2, et = (r2 - r1) / (r2 + r1);
  const bt = at * Math.sqrt(1 - et * et);
  const wt = baseTilt + 0.6 + rnd(2130) * 1.2;
  ctx.strokeStyle = toneRgba(acc, 0.6);
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(
    fx - at * et * Math.cos(wt), fy - at * et * Math.sin(wt),
    at, bt, wt, 0, Math.PI
  );
  ctx.stroke();
  ctx.setLineDash([]);
  const dep = [fx + at * (1 - et) * Math.cos(wt), fy + at * (1 - et) * Math.sin(wt)];
  const arr = [fx - at * (1 + et) * Math.cos(wt), fy - at * (1 + et) * Math.sin(wt)];
  ctx.strokeStyle = toneRgba(acc, 0.7);
  ctx.beginPath();
  ctx.arc(dep[0], dep[1], 2.2, 0, Math.PI * 2);
  ctx.stroke();
  const ta = wt + Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(arr[0] - Math.cos(ta - 0.5) * 5.5, arr[1] - Math.sin(ta - 0.5) * 5.5);
  ctx.lineTo(arr[0], arr[1]);
  ctx.lineTo(arr[0] - Math.cos(ta + 0.5) * 5.5, arr[1] - Math.sin(ta + 0.5) * 5.5);
  ctx.stroke();
  // The primary: an engraved sphere, hatched with curved latitude strokes.
  const rb = short * 0.034;
  ctx.save();
  ctx.beginPath();
  ctx.arc(fx, fy, rb, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "rgba(8,9,12,0.85)";
  ctx.fillRect(fx - rb, fy - rb, rb * 2, rb * 2);
  ctx.strokeStyle = ink(0.5);
  ctx.lineWidth = 0.55;
  for (let i = -4; i <= 4; i += 1) {
    const yy = fy + (i / 4.6) * rb;
    const hw = Math.sqrt(Math.max(0, 1 - Math.pow(i / 4.6, 2))) * rb;
    ctx.beginPath();
    ctx.moveTo(fx - hw, yy);
    ctx.quadraticCurveTo(fx, yy + rb * 0.16, fx + hw, yy);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = ink(0.8);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.arc(fx, fy, rb, 0, Math.PI * 2);
  ctx.stroke();
  // The anomaly: the body itself, caught mid-orbit on the outer ellipse at
  // this frozen instant, glowing, with its radius vector back to the focus.
  const PO = params[orbits - 1];
  const Mb = rnd(2140) * Math.PI * 2 + tick * 0.00003;
  const nuB = keplerNu(Mb % (Math.PI * 2), PO.e);
  const rB = (PO.a * (1 - PO.e * PO.e)) / (1 + PO.e * Math.cos(nuB));
  const bx = fx + rB * Math.cos(PO.w + nuB);
  const by = fy + rB * Math.sin(PO.w + nuB);
  ctx.strokeStyle = ink(0.3);
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(bx, by, 0, bx, by, 15);
  halo.addColorStop(0, toneRgba(acc, 0.55));
  halo.addColorStop(1, toneRgba(acc, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(bx - 16, by - 16, 32, 32);
  ctx.fillStyle = ink(0.95);
  ctx.beginPath();
  ctx.arc(bx, by, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Scale bar, bottom-left inside the frame.
  ctx.globalCompositeOperation = "source-over";
  const sy0 = height * 0.895, sx0 = width * 0.075;
  ctx.strokeStyle = ink(0.5);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(sx0, sy0); ctx.lineTo(sx0 + short * 0.16, sy0);
  ctx.moveTo(sx0, sy0 - 3); ctx.lineTo(sx0, sy0 + 3);
  ctx.moveTo(sx0 + short * 0.08, sy0 - 2); ctx.lineTo(sx0 + short * 0.08, sy0 + 2);
  ctx.moveTo(sx0 + short * 0.16, sy0 - 3); ctx.lineTo(sx0 + short * 0.16, sy0 + 3);
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * spectral-ladder — stacked spectra: fine-stroke continua, shared
 * absorption and emission lines, tie-lines tracking a redshift that
 * jumps on the last strip, and one flaring emission line.
 * ------------------------------------------------------------------ */
function drawSpectralLadder(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const acc = accentTone(palette, 2);
  const x0 = width * 0.09, x1 = width * 0.91;
  const y0 = height * 0.13, y1 = height * 0.72;
  const strips = 3 + (rnd(3100) > 0.45 ? 1 : 0);
  const laneH = (y1 - y0) / strips;
  const bandH = laneH * 0.64;
  const L = 10 + Math.floor(rnd(3101) * 7);
  const doppler = (0.007 + rnd(3102) * 0.013) * (rnd(3103) > 0.5 ? 1 : -1);
  const lines = [];
  for (let l = 0; l < L; l += 1) {
    lines.push({
      u: 0.06 + rnd(3300 + l * 11) * 0.88,
      em: rnd(3301 + l * 11) < 0.38,
      d: 0.35 + rnd(3302 + l * 11) * 0.6,
      w: 1 + rnd(3303 + l * 11) * 1.6,
    });
  }
  // rnd() is inclusive of 1.0, so clamp the derived index
  const anom = Math.min(L - 1, Math.floor(rnd(3104) * L));
  lines[anom].em = true;
  lines[anom].d = 1;
  // The last strip belongs to a receding object: its shift is nearly three
  // times the ladder step, and the tie-lines kink to reach it.
  const shiftOf = (s) =>
    (s === strips - 1 ? doppler * 2.8 : doppler * s) * (x1 - x0);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  for (let s = 0; s < strips; s += 1) {
    const ty = y0 + s * laneH + (laneH - bandH) / 2;
    const peak = 0.24 + rnd(3110 + s * 7) * 0.38 + Math.sin(tick * 0.00007 + s) * 0.02;
    // Continuum: a run of fine vertical strokes, brightest near the peak.
    for (let c = 0; c * 2 <= x1 - x0; c += 1) {
      const cxp = x0 + c * 2;
      const u = (c * 2) / (x1 - x0);
      const g = (u - peak) / 0.34;
      const al = (0.07 + 0.27 * Math.exp(-g * g)) *
        (0.8 + rand(seed, 32000 + s * 997 + c * 3) * 0.4);
      ctx.strokeStyle = ink(al);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cxp, ty);
      ctx.lineTo(cxp, ty + bandH);
      ctx.stroke();
    }
    ctx.strokeStyle = ink(0.3);
    ctx.lineWidth = 0.6;
    ctx.strokeRect(x0, ty, x1 - x0, bandH);
    // Exposure count as a dash group in the left margin.
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = ink(0.45);
    for (let d = 0; d <= s; d += 1) {
      ctx.beginPath();
      ctx.moveTo(x0 - 14, ty + 3 + d * 4);
      ctx.lineTo(x0 - 7, ty + 3 + d * 4);
      ctx.stroke();
    }
    const sh = shiftOf(s);
    for (let l = 0; l < L; l += 1) {
      const ln = lines[l];
      const lx = x0 + ln.u * (x1 - x0) + sh;
      if (lx < x0 + 1 || lx > x1 - 1) continue;
      if (l === anom) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const bloom = ctx.createLinearGradient(lx - 7, 0, lx + 7, 0);
        bloom.addColorStop(0, toneRgba(acc, 0));
        bloom.addColorStop(0.5, toneRgba(acc, 0.3));
        bloom.addColorStop(1, toneRgba(acc, 0));
        ctx.fillStyle = bloom;
        ctx.fillRect(lx - 7, ty, 14, bandH);
        ctx.fillStyle = toneRgba(acc, 0.85);
        ctx.fillRect(lx - 0.9, ty, 1.8, bandH);
        ctx.restore();
      } else if (ln.em) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = ink(0.34 * ln.d);
        ctx.fillRect(lx - ln.w / 2, ty, ln.w, bandH);
        ctx.restore();
      } else {
        ctx.fillStyle = `rgba(5,6,9,${(0.5 * ln.d + 0.2).toFixed(3)})`;
        ctx.fillRect(lx - ln.w / 2, ty, ln.w, bandH);
      }
    }
  }
  // Tie-lines track the four deepest lines down the ladder.
  ctx.strokeStyle = ink(0.16);
  ctx.lineWidth = 0.5;
  const strongest = lines
    .map((ln, i) => [ln.d, i])
    .sort((a, b) => b[0] - a[0])
    .slice(0, 4);
  for (const pair of strongest) {
    const li = pair[1];
    for (let s = 0; s < strips - 1; s += 1) {
      const xA = x0 + lines[li].u * (x1 - x0) + shiftOf(s);
      const xB = x0 + lines[li].u * (x1 - x0) + shiftOf(s + 1);
      const yA = y0 + s * laneH + (laneH + bandH) / 2;
      const yB = y0 + (s + 1) * laneH + (laneH - bandH) / 2;
      ctx.beginPath();
      ctx.moveTo(xA, yA);
      ctx.lineTo(xB, yB);
      ctx.stroke();
    }
  }
  // Wavelength rule with a minor/major tick hierarchy and index dots.
  const ay = y1 + height * 0.06;
  ctx.strokeStyle = ink(0.5);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x0, ay);
  ctx.lineTo(x1, ay);
  ctx.stroke();
  const minor = (x1 - x0) / 64;
  for (let i = 0; i <= 64; i += 1) {
    const tx = x0 + i * minor;
    const big = i % 8 === 0;
    ctx.strokeStyle = ink(big ? 0.55 : 0.32);
    ctx.beginPath();
    ctx.moveTo(tx, ay);
    ctx.lineTo(tx, ay + (big ? 7 : 3));
    ctx.stroke();
    if (big) {
      ctx.fillStyle = ink(0.5);
      ctx.fillRect(tx - 0.7, ay + 9.5, 1.4, 1.4);
    }
  }
  // Caret beneath the flaring line, placed at its most-shifted position.
  const axA = x0 + lines[anom].u * (x1 - x0) + shiftOf(strips - 1);
  if (axA > x0 && axA < x1) {
    ctx.strokeStyle = toneRgba(acc, 0.8);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(axA - 3.4, ay + 12);
    ctx.lineTo(axA, ay + 7);
    ctx.lineTo(axA + 3.4, ay + 12);
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * occultation-strip — an eclipse sequence: limb-darkened discs eaten
 * by an occluder, frames crowding toward totality, a corona flare at
 * the middle frame and an ivory diamond-ring spark just after.
 * ------------------------------------------------------------------ */
function drawOccultationStrip(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const acc = accentTone(palette, 1);
  const n = 7 + 2 * Math.floor(rnd(4100) * 2.5);
  const mid = (n - 1) / 2;
  const cy = height * (0.44 + rnd(4101) * 0.12);
  const bx0 = width * 0.085, bx1 = width * 0.915;
  const r0 = Math.min((bx1 - bx0) / (n * 2.3), height * 0.105);
  const dirA = (rnd(4102) - 0.5) * 0.5 + Math.sin(tick * 0.0001) * 0.05;
  // Frame abscissae cluster toward totality: time runs slow mid-plate.
  const xs = [];
  for (let i = 0; i < n; i += 1) {
    const u = i / (n - 1);
    const g = u - 0.5;
    const v = 0.5 + Math.sign(g) * Math.pow(Math.abs(g) * 2, 1.5) * 0.5;
    xs.push(bx0 + r0 * 1.3 + v * (bx1 - bx0 - r0 * 2.6));
  }
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = ink(0.16);
  ctx.beginPath();
  ctx.moveTo(bx0, cy);
  ctx.lineTo(bx1, cy);
  ctx.stroke();
  ctx.strokeStyle = ink(0.3);
  for (const yy of [cy - r0 * 1.9, cy + r0 * 1.9]) {
    ctx.beginPath();
    ctx.moveTo(bx0, yy);
    ctx.lineTo(bx1, yy);
    ctx.stroke();
  }
  // Minor time ticks subdivide each interval on the lower rule, so the
  // crowding toward totality is measurable, not just felt.
  ctx.strokeStyle = ink(0.2);
  ctx.lineWidth = 0.5;
  for (let i = 0; i < n - 1; i += 1) {
    for (let k = 1; k <= 3; k += 1) {
      const tx = xs[i] + ((xs[i + 1] - xs[i]) * k) / 4;
      ctx.beginPath();
      ctx.moveTo(tx, cy + r0 * 1.9);
      ctx.lineTo(tx, cy + r0 * 1.9 + 2);
      ctx.stroke();
    }
  }
  for (let i = 0; i < n; i += 1) {
    const isTot = i === mid;
    const rr = isTot ? r0 * 1.24 : r0;
    const x = xs[i];
    const ph = i / (n - 1);
    // Contact ticks on both rules; totality gets the long double tick.
    ctx.strokeStyle = ink(isTot ? 0.7 : 0.42);
    ctx.lineWidth = 0.7;
    const tl = isTot ? 7 : 3.5;
    ctx.beginPath();
    ctx.moveTo(x, cy + r0 * 1.9);
    ctx.lineTo(x, cy + r0 * 1.9 + tl);
    ctx.moveTo(x, cy - r0 * 1.9);
    ctx.lineTo(x, cy - r0 * 1.9 - tl);
    ctx.stroke();
    if (isTot) {
      ctx.beginPath();
      ctx.moveTo(x - 2.4, cy + r0 * 1.9);
      ctx.lineTo(x - 2.4, cy + r0 * 1.9 + tl);
      ctx.moveTo(x + 2.4, cy + r0 * 1.9);
      ctx.lineTo(x + 2.4, cy + r0 * 1.9 + tl);
      ctx.stroke();
    }
    // The disc, clipped, with its occluder sliding through.
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, cy, rr, 0, Math.PI * 2);
    ctx.clip();
    if (isTot) {
      ctx.fillStyle = "rgba(7,8,11,0.92)";
      ctx.fillRect(x - rr, cy - rr, rr * 2, rr * 2);
    } else {
      const limb = ctx.createRadialGradient(x, cy, rr * 0.1, x, cy, rr);
      limb.addColorStop(0, ink(0.8));
      limb.addColorStop(0.75, ink(0.62));
      limb.addColorStop(1, ink(0.4));
      ctx.fillStyle = limb;
      ctx.fillRect(x - rr, cy - rr, rr * 2, rr * 2);
      const off = (1 - 2 * ph) * r0 * 2.15;
      const ox = x + Math.cos(dirA) * off;
      const oy = cy + Math.sin(dirA) * off;
      ctx.fillStyle = "rgba(6,7,10,0.94)";
      ctx.beginPath();
      ctx.arc(ox, oy, rr * 1.02, 0, Math.PI * 2);
      ctx.fill();
      // Engraved shadow: the occluding body carries its own fine hatch
      // where it crosses the disc.
      ctx.save();
      ctx.beginPath();
      ctx.arc(ox, oy, rr * 1.02, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = ink(0.13);
      ctx.lineWidth = 0.5;
      const hg = Math.max(2.6, rr * 0.24);
      for (let hh = -rr * 1.2; hh <= rr * 1.2; hh += hg) {
        ctx.beginPath();
        ctx.moveTo(ox - rr * 1.2, oy + hh - rr * 0.35);
        ctx.lineTo(ox + rr * 1.2, oy + hh + rr * 0.35);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.strokeStyle = ink(isTot ? 0.75 : 0.5);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(x, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
    // Phase fraction as a dot tally under each frame.
    const tally = Math.round((1 - Math.abs(2 * ph - 1)) * 8);
    ctx.fillStyle = ink(0.42);
    for (let k = 0; k < tally; k += 1) {
      ctx.beginPath();
      ctx.arc(x - (tally - 1) * 1.6 + k * 3.2, cy + r0 * 1.9 + 12, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    if (isTot) {
      // Corona: the plate's one glow, with hairline streamers.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const halo = ctx.createRadialGradient(x, cy, rr * 0.95, x, cy, rr * 2.5);
      halo.addColorStop(0, toneRgba(acc, 0.4));
      halo.addColorStop(0.45, toneRgba(acc, 0.12));
      halo.addColorStop(1, toneRgba(acc, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(x - rr * 2.6, cy - rr * 2.6, rr * 5.2, rr * 5.2);
      const streams = 10 + Math.floor(rnd(4110) * 5);
      ctx.lineWidth = 0.6;
      for (let s = 0; s < streams; s += 1) {
        const sa = rnd(4120 + s * 3) * Math.PI * 2;
        const sl = rr * (1.25 + rnd(4121 + s * 3) * 1.1);
        ctx.strokeStyle = toneRgba(acc, 0.14 + rnd(4122 + s * 3) * 0.2);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(sa) * rr * 1.02, cy + Math.sin(sa) * rr * 1.02);
        ctx.lineTo(x + Math.cos(sa) * sl, cy + Math.sin(sa) * sl);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (i === mid + 1) {
      // Diamond-ring spark at the trailing limb, kept neutral ivory.
      const sx = x + Math.cos(dirA + Math.PI) * rr;
      const sy = cy + Math.sin(dirA + Math.PI) * rr;
      ctx.fillStyle = ink(0.95);
      ctx.beginPath();
      ctx.arc(sx, sy, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ink(0.5);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(sx - 5.5, sy);
      ctx.lineTo(sx + 5.5, sy);
      ctx.moveTo(sx, sy - 5.5);
      ctx.lineTo(sx, sy + 5.5);
      ctx.stroke();
    }
  }
  // Catalogue dash group, top-left of the strip.
  ctx.strokeStyle = ink(0.4);
  ctx.lineWidth = 0.8;
  for (let d = 0; d < 4; d += 1) {
    ctx.beginPath();
    ctx.moveTo(bx0 + d * 6, cy - r0 * 1.9 - 12);
    ctx.lineTo(bx0 + d * 6 + 3.5, cy - r0 * 1.9 - 12);
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * pulsar-stack — a radio waterfall: stacked signal traces occluding
 * the rows behind them, a pulse column drifting off vertical, and
 * one giant glowing pulse with its margin marker.
 * ------------------------------------------------------------------ */
function drawPulsarStack(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const acc = accentTone(palette, 0);
  const bx0 = width * 0.17, bx1 = width * 0.83;
  const by0 = height * 0.12, by1 = height * 0.88;
  const n = 30 + Math.floor(rnd(5100) * 12);
  const rowH = (by1 - by0) / n;
  const c0 = 0.42 + rnd(5101) * 0.16;
  const drift = (rnd(5102) - 0.5) * 0.005;
  const pw = 0.018 + rnd(5103) * 0.02;
  const anomRow = Math.floor(n * (0.28 + rnd(5104) * 0.44));
  const phase0 = tick * 0.00012;
  let anomX = 0, anomY = 0;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = ink(0.3);
  ctx.lineWidth = 0.7;
  ctx.strokeRect(bx0 - 6, by0 - 6, bx1 - bx0 + 12, by1 - by0 + 12);
  const xsArr = [], ysArr = [];
  for (let r = 0; r < n; r += 1) {
    const yb = by0 + (r + 0.72) * rowH;
    const cR = c0 + drift * r + 0.018 * Math.sin(r * 0.53 + phase0);
    const isA = r === anomRow;
    const A = isA
      ? rowH * 4.2
      : rowH * (1.1 + rnd(51100 + r * 17) * 1.5);
    const f1 = 0.045 + rnd(51101 + r * 17) * 0.03;
    const p1 = rnd(51102 + r * 17) * Math.PI * 2;
    const f2 = 0.11 + rnd(51103 + r * 17) * 0.05;
    const p2 = rnd(51104 + r * 17) * Math.PI * 2;
    xsArr.length = 0;
    ysArr.length = 0;
    for (let x = bx0; x <= bx1; x += 3) {
      const u = (x - bx0) / (bx1 - bx0);
      let h = (Math.sin(x * f1 + p1) * 0.3 + Math.sin(x * f2 + p2) * 0.18) * rowH * 0.5;
      h += (rand(seed, 52000 + r * 997 + Math.round(x - bx0)) - 0.5) * rowH * 0.34;
      const d1 = (u - cR) / pw;
      const d2 = (u - cR + 0.055) / (pw * 1.6);
      h += Math.exp(-d1 * d1) * A + Math.exp(-d2 * d2) * A * 0.22;
      xsArr.push(x);
      ysArr.push(yb - h);
    }
    // Fill under the trace first so this row occludes the rows behind it.
    ctx.beginPath();
    ctx.moveTo(xsArr[0], ysArr[0]);
    for (let i = 1; i < xsArr.length; i += 1) ctx.lineTo(xsArr[i], ysArr[i]);
    ctx.lineTo(bx1, yb + rowH * 1.5);
    ctx.lineTo(bx0, yb + rowH * 1.5);
    ctx.closePath();
    ctx.fillStyle = "rgba(5,6,9,0.85)";
    ctx.fill();
    // Then the crest, brighter toward the front of the stack.
    ctx.strokeStyle = isA
      ? toneRgba(acc, 0.95)
      : ink(0.38 + 0.3 * (r / n));
    ctx.lineWidth = isA ? 1.1 : 0.8;
    ctx.beginPath();
    ctx.moveTo(xsArr[0], ysArr[0]);
    for (let i = 1; i < xsArr.length; i += 1) ctx.lineTo(xsArr[i], ysArr[i]);
    ctx.stroke();
    if (isA) {
      anomX = bx0 + cR * (bx1 - bx0);
      anomY = yb - A;
    }
  }
  // Row ticks left, phase ticks below, and a small header dash group.
  ctx.strokeStyle = ink(0.45);
  ctx.lineWidth = 0.6;
  for (let r = 0; r < n; r += 5) {
    const yy = by0 + (r + 0.72) * rowH;
    const big = r % 10 === 0;
    ctx.beginPath();
    ctx.moveTo(bx0 - 6, yy);
    ctx.lineTo(bx0 - 6 - (big ? 7 : 4), yy);
    ctx.stroke();
  }
  for (let i = 0; i <= 20; i += 1) {
    const tx = bx0 + ((bx1 - bx0) * i) / 20;
    const big = i % 5 === 0;
    ctx.beginPath();
    ctx.moveTo(tx, by1 + 6);
    ctx.lineTo(tx, by1 + 6 + (big ? 6 : 3));
    ctx.stroke();
  }
  ctx.lineWidth = 0.8;
  for (let d = 0; d < 3; d += 1) {
    ctx.beginPath();
    ctx.moveTo(bx0 - 6 + d * 6, by0 - 13);
    ctx.lineTo(bx0 - 6 + d * 6 + 3.5, by0 - 13);
    ctx.stroke();
  }
  // Margin marker for the anomalous row: the observer's double tick.
  const ayy = by0 + (anomRow + 0.72) * rowH;
  ctx.strokeStyle = toneRgba(acc, 0.85);
  ctx.beginPath();
  ctx.moveTo(bx0 - 15, ayy - 1.6);
  ctx.lineTo(bx0 - 8, ayy - 1.6);
  ctx.moveTo(bx0 - 15, ayy + 1.6);
  ctx.lineTo(bx0 - 8, ayy + 1.6);
  ctx.stroke();
  // The giant pulse glows over the whole stack.
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(anomX, anomY, 0, anomX, anomY, rowH * 4);
  glow.addColorStop(0, toneRgba(acc, 0.4));
  glow.addColorStop(0.5, toneRgba(acc, 0.12));
  glow.addColorStop(1, toneRgba(acc, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(anomX - rowH * 4.2, anomY - rowH * 4.2, rowH * 8.4, rowH * 8.4);
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * analemma-trace — the sun's figure-eight above a hatched horizon:
 * weekly suns on a hairline path, fainter companion hours, solstice
 * and equinox rings, winter suns dipping open-circled below the
 * horizon on low plates, and one glowing eclipse day.
 * ------------------------------------------------------------------ */
function drawAnalemmaTrace(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const short = Math.min(width, height);
  const acc = accentTone(palette, 2);
  const yH = height * (0.7 + rnd(6100) * 0.12);
  const cx = width * (0.44 + rnd(6101) * 0.14);
  const ky2 = short * 0.0075;
  const kx2 = short * (0.02 + rnd(6103) * 0.012);
  const noonAlt = 20 + rnd(6104) * 18;
  const sunPos = (d, hx, drop) => {
    const B = Math.PI * 2 * (d - 81 / 365);
    const eotMin = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
    const dec = 23.44 * Math.sin(Math.PI * 2 * (d - 80 / 365));
    return [
      cx + hx + (eotMin / 4) * kx2 * 1.9,
      yH - (noonAlt + dec - drop) * ky2 * 2.1,
    ];
  };
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  // Plate frame with corner registration ticks.
  ctx.strokeStyle = ink(0.28);
  ctx.lineWidth = 0.7;
  ctx.strokeRect(width * 0.045, height * 0.05, width * 0.91, height * 0.9);
  ctx.strokeStyle = ink(0.45);
  for (const [cxx, cyy] of [
    [width * 0.045, height * 0.05], [width * 0.955, height * 0.05],
    [width * 0.045, height * 0.95], [width * 0.955, height * 0.95],
  ]) {
    ctx.beginPath();
    ctx.moveTo(cxx - 4, cyy); ctx.lineTo(cxx + 4, cyy);
    ctx.moveTo(cxx, cyy - 4); ctx.lineTo(cxx, cyy + 4);
    ctx.stroke();
  }
  // Ground: hatched rows under the horizon rule, with azimuth ticks on it.
  const hx0 = width * 0.045, hx1 = width * 0.955;
  ctx.strokeStyle = ink(0.55);
  ctx.beginPath();
  ctx.moveTo(hx0, yH);
  ctx.lineTo(hx1, yH);
  ctx.stroke();
  ctx.lineWidth = 0.5;
  for (let row = 0; row < 3; row += 1) {
    const gy = yH + 4 + row * 5;
    if (gy > height * 0.94) break;
    ctx.strokeStyle = ink(0.15 - row * 0.035);
    for (let x = hx0 + 2; x < hx1 - 4; x += 5) {
      ctx.beginPath();
      ctx.moveTo(x, gy + 2);
      ctx.lineTo(x + 3, gy - 2);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = ink(0.4);
  ctx.lineWidth = 0.6;
  const azStep = (hx1 - hx0) / 40;
  for (let i = 1; i < 40; i += 1) {
    const tx = hx0 + i * azStep;
    const big = i % 5 === 0;
    ctx.beginPath();
    ctx.moveTo(tx, yH);
    ctx.lineTo(tx, yH - (big ? 5 : 2.5));
    ctx.stroke();
  }
  // Altitude scale in the left margin, every ten degrees.
  const lx = width * 0.075;
  ctx.strokeStyle = ink(0.35);
  ctx.beginPath();
  ctx.moveTo(lx, yH);
  ctx.lineTo(lx, yH - 60 * ky2 * 2.1);
  ctx.stroke();
  for (let a = 0; a <= 60; a += 10) {
    const ty = yH - a * ky2 * 2.1;
    ctx.beginPath();
    ctx.moveTo(lx, ty);
    ctx.lineTo(lx + (a % 30 === 0 ? 6 : 3), ty);
    ctx.stroke();
  }
  // The meridian, dotted, from the top margin down to the horizon.
  ctx.strokeStyle = ink(0.14);
  ctx.setLineDash([1, 4]);
  ctx.beginPath();
  ctx.moveTo(cx, height * 0.06);
  ctx.lineTo(cx, yH);
  ctx.stroke();
  ctx.setLineDash([]);
  // Companion hours: two fainter eights flanking noon, hung lower.
  const hourOff = short * 0.17 + Math.sin(tick * 0.0001) * 2;
  for (const side of [-1, 1]) {
    ctx.strokeStyle = ink(0.13);
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    for (let i = 0; i <= 104; i += 1) {
      const p = sunPos(i / 104, side * hourOff, 7);
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
  }
  // The noon eight: hairline path, then the fifty-two weekly suns.
  ctx.strokeStyle = ink(0.3);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let i = 0; i <= 104; i += 1) {
    const p = sunPos(i / 104, 0, 0);
    if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
  }
  ctx.stroke();
  const iA = Math.floor(rnd(6150) * 52);
  let anomP = null;
  for (let i = 0; i < 52; i += 1) {
    const p = sunPos(i / 52, 0, 0);
    if (i === iA) { anomP = p; continue; }
    const big = i % 4 === 0;
    if (p[1] > yH) {
      // A sun below the horizon is recorded, not shown lit: open circle.
      ctx.strokeStyle = ink(0.35);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(p[0], p[1], big ? 1.7 : 1.15, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = ink(big ? 0.85 : 0.55);
      ctx.beginPath();
      ctx.arc(p[0], p[1], big ? 1.7 : 1.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Solstice and equinox stations: ringed, ticked, dash-labelled.
  const stations = [172 / 365, 355 / 365, 79 / 365, 265 / 365];
  ctx.lineWidth = 0.6;
  for (let s = 0; s < stations.length; s += 1) {
    const p = sunPos(stations[s], 0, 0);
    ctx.strokeStyle = ink(0.5);
    ctx.beginPath();
    ctx.arc(p[0], p[1], 3.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p[0] + 5, p[1]);
    ctx.lineTo(p[0] + 11, p[1]);
    ctx.stroke();
    for (let d = 0; d <= s % 2; d += 1) {
      ctx.beginPath();
      ctx.moveTo(p[0] + 13, p[1] - 2 + d * 4);
      ctx.lineTo(p[0] + 17, p[1] - 2 + d * 4);
      ctx.stroke();
    }
  }
  // The anomaly: the eclipse day, ringed in accent with a dashed pointer
  // dropped from the top margin.
  if (anomP) {
    ctx.strokeStyle = ink(0.35);
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(anomP[0], height * 0.06);
    ctx.lineTo(anomP[0], anomP[1] - 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = toneRgba(acc, 0.8);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(anomP[0], anomP[1], 4.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(anomP[0], anomP[1], 0, anomP[0], anomP[1], 14);
    glow.addColorStop(0, toneRgba(acc, 0.5));
    glow.addColorStop(1, toneRgba(acc, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(anomP[0] - 15, anomP[1] - 15, 30, 30);
    ctx.fillStyle = ink(0.95);
    ctx.beginPath();
    ctx.arc(anomP[0], anomP[1], 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export const WAVE8_OBSERVATORY = {
  "engraved-sky": drawEngravedSky,
  "apsis-ledger": drawApsisLedger,
  "spectral-ladder": drawSpectralLadder,
  "occultation-strip": drawOccultationStrip,
  "pulsar-stack": drawPulsarStack,
  "analemma-trace": drawAnalemmaTrace,
};
export const WAVE8_OBSERVATORY_META = [
  { name: "engraved-sky", family: "observatory", blurb: "tilted star chart: magnitude points, constellation rules, bowed grid, one ringed nova" },
  { name: "apsis-ledger", family: "observatory", blurb: "nested ellipses off one focus, kepler beads, equal-area wedges, dashed transfer arc" },
  { name: "spectral-ladder", family: "observatory", blurb: "stacked emission and absorption spectra, redshift tie-lines, one flaring line" },
  { name: "occultation-strip", family: "observatory", blurb: "eclipse sequence strip, frames crowding totality, corona flare and diamond spark" },
  { name: "pulsar-stack", family: "observatory", blurb: "banded radio traces with a drifting pulse column and one giant glowing pulse" },
  { name: "analemma-trace", family: "observatory", blurb: "the sun's figure-eight over a hatched horizon, solstice rings, one eclipse-day flare" },
];
