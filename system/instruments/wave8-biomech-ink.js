// wave8-biomech-ink.js — Giger-register biomechanical ballpoint: hatch density
// gradients carry the form, anatomy abstracted to machine parts, monochrome ink
// over the dark ground with one cold accent per plate. No figures, no faces.
// First-party, seed-derived, no assets.

function rand(seed, salt) {
  let x = Math.imul(seed ^ Math.imul(salt + 1013904223, 1664525), 2246822519);
  x ^= x >>> 13;
  x = Math.imul(x, 3266489917);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function tone(t, a) { return `rgba(${t[0]},${t[1]},${t[2]},${a})`; }

// Ink neutrals: bone highlight, steel midtone, occlusion black. Neutrals pass
// the palette alignment filter untouched, so all structure lives here.
const BONE = [227, 230, 233];
const STEEL = [170, 175, 182];
const OCCLUSION = [8, 9, 12];

// The single chromatic voice per plate: the coldest tone the palette offers,
// judged by blue-over-red excess. Falls back to ice when no fluid set exists.
function coldTone(palette) {
  const fluid = palette && palette.fluid;
  if (!fluid || !fluid.length) return [150, 200, 240];
  let best = fluid[0];
  for (let i = 1; i < fluid.length; i += 1) {
    if (fluid[i][2] - fluid[i][0] > best[2] - best[0]) best = fluid[i];
  }
  return best;
}

/* -------------------------------------------------------------------------
   vertebra-drive: a spinal column of repeated vertebra-machine segments that
   tapers as it crosses the plate. One joint dislocates hard, and that kink
   is where the cold light sits. Hatch spacing tightens at each body's crest.
------------------------------------------------------------------------- */
function drawVertebraDrive(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const cold = coldTone(palette);
  const phase = (tick % 7919) * 0.0013;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "round";

  // Walk the spine: the heading wanders, then breaks once at a chosen joint.
  const segs = 15 + Math.floor(rnd(10) * 6);
  const kinkAt = 4 + Math.floor(rnd(11) * (segs - 8));
  const kinkSign = rnd(16) > 0.5 ? 1 : -1;
  let x = width * (0.01 + rnd(12) * 0.06);
  let y = height * (0.28 + rnd(13) * 0.44);
  let heading = (rnd(14) - 0.5) * 0.5;
  const step = (width * 1.02) / segs;
  const pts = [];
  for (let i = 0; i <= segs; i += 1) {
    pts.push({ x, y, a: heading });
    heading += Math.sin(phase + i * (0.5 + rnd(15) * 0.35)) * 0.14
      + (rnd(100 + i * 7) - 0.5) * 0.24;
    if (i === kinkAt) heading += kinkSign * (0.55 + rnd(17) * 0.35);
    heading = clamp(heading, -0.85, 0.85);
    x += Math.cos(heading) * step;
    y += Math.sin(heading) * step;
    y = clamp(y, height * 0.14, height * 0.86);
  }

  // Airbrush bed: a soft bone mist under the whole column.
  ctx.strokeStyle = tone(BONE, 0.07);
  ctx.lineWidth = Math.min(width, height) * 0.075 * 3.4;
  ctx.beginPath();
  for (let i = 0; i <= segs; i += 1) {
    if (i === 0) ctx.moveTo(pts[i].x, pts[i].y); else ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.stroke();

  // Neural wires run beside the column, stitched loosely to it.
  for (let w = 0; w < 2; w += 1) {
    ctx.strokeStyle = tone(STEEL, 0.16);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let i = 0; i <= segs; i += 1) {
      const p = pts[i];
      const off = (w === 0 ? -1 : 1) * (16 + Math.sin(i * 0.9 + phase * 3 + w * 2.1) * 7);
      const nx = p.x + Math.cos(p.a + Math.PI / 2) * off;
      const ny = p.y + Math.sin(p.a + Math.PI / 2) * off;
      if (i === 0) ctx.moveTo(nx, ny); else ctx.lineTo(nx, ny);
    }
    ctx.stroke();
  }

  const baseR = Math.min(width, height) * 0.075;
  for (let i = 0; i < segs; i += 1) {
    const p = pts[i];
    const t = i / (segs - 1);
    const r = baseR * (1.05 - t * 0.62) * (0.9 + rnd(200 + i * 11) * 0.2);
    const l = step * 0.34;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    // Socket shadow behind the body.
    ctx.fillStyle = tone(OCCLUSION, 0.55);
    ctx.beginPath();
    ctx.ellipse(0, 0, l * 1.25, r * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hatch across the body: spacing tightens and alpha lifts at the crest.
    let hx = -l;
    let hs = 300 + i * 41;
    while (hx <= l) {
      const prof = Math.sqrt(Math.max(0.05, 1 - (hx / l) * (hx / l)));
      const crest = 1 - Math.abs(hx / l);
      const aHair = 0.1 + crest * 0.34 + (rnd(hs += 1) - 0.5) * 0.05;
      ctx.strokeStyle = tone(BONE, clamp(aHair, 0.05, 0.5));
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(hx, -r * prof);
      ctx.lineTo(hx + (rnd(hs += 1) - 0.5) * 1.2, r * prof);
      ctx.stroke();
      hx += 1.1 + (1 - crest) * 1.5;
    }
    // Rim arcs: the lit top edge and a fainter reflected lower edge.
    ctx.strokeStyle = tone(BONE, 0.4);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(0, 0, l, r, 0, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.strokeStyle = tone(STEEL, 0.22);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, l, r, 0, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    // Paired processes: three hairlines per horn, curling away from the body.
    for (let side = -1; side <= 1; side += 2) {
      const hornLen = r * (1.5 + rnd(600 + i * 13 + side) * 0.9);
      ctx.strokeStyle = tone(BONE, 0.3);
      ctx.lineWidth = 0.9;
      for (let k = 0; k < 3; k += 1) {
        ctx.beginPath();
        ctx.moveTo(-l * 0.2 + k * 2.2, side * r * 0.7);
        ctx.quadraticCurveTo(
          k * 2.2 + hornLen * 0.25, side * (r + hornLen * 0.55),
          k * 2.2 - hornLen * (0.3 + rnd(640 + i * 13 + k) * 0.25),
          side * (r + hornLen)
        );
        ctx.stroke();
      }
    }
    // Disc coupling in the gap to the next segment.
    ctx.strokeStyle = tone(BONE, 0.5);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(l * 1.45, -r * 0.55);
    ctx.lineTo(l * 1.45, r * 0.55);
    ctx.stroke();
    ctx.restore();
  }

  // The one cold mark: the dislocated joint glows.
  const kp = pts[kinkAt + 1];
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(kp.x, kp.y, 0, kp.x, kp.y, 34);
  glow.addColorStop(0, tone(cold, 0.5));
  glow.addColorStop(0.5, tone(cold, 0.16));
  glow.addColorStop(1, tone(cold, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(kp.x - 36, kp.y - 36, 72, 72);
  ctx.strokeStyle = tone(cold, 0.45);
  ctx.lineWidth = 0.8;
  for (let k = 0; k < 3; k += 1) {
    const a0 = rnd(700 + k) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(kp.x, kp.y, 8 + k * 5.5, a0, a0 + 2.2);
    ctx.stroke();
  }
  ctx.restore();
}

/* -------------------------------------------------------------------------
   ribbed-conduit: hose runs crossing the frame, each built from hundreds of
   rib rings whose spacing breathes along the run. Every hose lies in a dark
   occlusion bed so crossings read as depth. One hose stops mid-frame in an
   open coupling flange, and the cold light leaks out of its throat.
------------------------------------------------------------------------- */
function drawRibbedConduit(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const cold = coldTone(palette);
  const phase = (tick % 6271) * 0.001;
  const edgePoint = (edge, t, pad) => (
    edge === 0 ? [t * width, -pad]
      : edge === 1 ? [width + pad, t * height]
        : edge === 2 ? [t * width, height + pad]
          : [-pad, t * height]);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "round";
  const hoses = 3 + Math.floor(rnd(3000) * 3);
  const openHose = Math.floor(rnd(3001) * hoses);
  const M = 170;
  for (let h = 0; h < hoses; h += 1) {
    const s0 = 3010 + h * 91;
    const e0 = Math.floor(rnd(s0) * 4);
    const e1 = (e0 + 1 + Math.floor(rnd(s0 + 1) * 3)) % 4;
    const p0 = edgePoint(e0, 0.1 + rnd(s0 + 2) * 0.8, 20);
    const p3 = edgePoint(e1, 0.1 + rnd(s0 + 3) * 0.8, 20);
    const p1 = [width * (0.15 + rnd(s0 + 4) * 0.7), height * (0.15 + rnd(s0 + 5) * 0.7)];
    const p2 = [width * (0.15 + rnd(s0 + 6) * 0.7), height * (0.15 + rnd(s0 + 7) * 0.7)];
    const baseR = 8 + rnd(s0 + 8) * 9;
    const cut = h === openHose ? 0.55 + rnd(s0 + 9) * 0.2 : 1;
    const swellFreq = 1.5 + rnd(s0 + 11);
    const px = [];
    const py = [];
    for (let i = 0; i <= M; i += 1) {
      const t = (i / M) * cut;
      const u = 1 - t;
      px.push(u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]);
      py.push(u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]);
    }
    const swellAt = (tt) => 0.82 + 0.3 * Math.sin(tt * Math.PI * swellFreq + phase + h);
    // Occlusion bed under the whole run.
    ctx.strokeStyle = tone(OCCLUSION, 0.5);
    ctx.lineWidth = baseR * 2.7;
    ctx.beginPath();
    for (let i = 0; i <= M; i += 1) {
      if (i === 0) ctx.moveTo(px[0], py[0]); else ctx.lineTo(px[i], py[i]);
    }
    ctx.stroke();
    // Rib rings: spacing breathes, the lit arc stays on the world-up side.
    let dist = 0;
    let nextRib = 0;
    for (let i = 1; i <= M; i += 1) {
      const dx = px[i] - px[i - 1];
      const dy = py[i] - py[i - 1];
      dist += Math.hypot(dx, dy);
      if (dist < nextRib) continue;
      const tt = i / M;
      const r = baseR * swellAt(tt);
      const ang = Math.atan2(dy, dx);
      const lit = 0.1 + 0.26 * (0.5 + 0.5 * Math.sin(tt * Math.PI * 2.2 + phase * 2 + h * 1.7));
      ctx.strokeStyle = tone(STEEL, lit);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(px[i], py[i], r * 0.34, r, ang, 0, Math.PI * 2);
      ctx.stroke();
      const up = -Math.PI / 2 - ang;
      ctx.strokeStyle = tone(BONE, lit + 0.16);
      ctx.beginPath();
      ctx.ellipse(px[i], py[i], r * 0.34, r, ang, up - 1.1, up + 1.1);
      ctx.stroke();
      nextRib = dist + 2.1 + 2.6 * (0.5 + 0.5 * Math.cos(tt * Math.PI * 3 + h * 2 + rnd(s0 + 12) * 6));
    }
    // Silhouette rails along both flanks, the upper one brighter.
    for (let side = -1; side <= 1; side += 2) {
      ctx.strokeStyle = tone(BONE, side === -1 ? 0.34 : 0.18);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= M; i += 1) {
        const iA = Math.max(0, i - 1);
        const iB = Math.min(M, i + 1);
        const ang = Math.atan2(py[iB] - py[iA], px[iB] - px[iA]);
        const r = baseR * swellAt(i / M);
        const nx = px[i] + Math.cos(ang + Math.PI / 2) * r * side;
        const ny = py[i] + Math.sin(ang + Math.PI / 2) * r * side;
        if (i === 0) ctx.moveTo(nx, ny); else ctx.lineTo(nx, ny);
      }
      ctx.stroke();
    }
    // The open coupling: flange rings, bolt dots, and the plate's cold leak.
    if (h === openHose) {
      const ang = Math.atan2(py[M] - py[M - 1], px[M] - px[M - 1]);
      const r = baseR * 1.1;
      ctx.save();
      ctx.translate(px[M], py[M]);
      ctx.rotate(ang);
      for (let k = 0; k < 3; k += 1) {
        ctx.strokeStyle = tone(BONE, 0.5 - k * 0.12);
        ctx.lineWidth = 1.6 - k * 0.4;
        ctx.beginPath();
        ctx.ellipse(k * 3.2, 0, r * 0.36, r * (1.12 + k * 0.22), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = tone(BONE, 0.55);
      for (let k = 0; k < 6; k += 1) {
        const ba = (k / 6) * Math.PI * 2 + 0.3;
        ctx.beginPath();
        ctx.arc(6.4 + Math.cos(ba) * r * 0.3, Math.sin(ba) * r * 1.5, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "lighter";
      const leak = ctx.createRadialGradient(2, 0, 0, 2, 0, r * 3.4);
      leak.addColorStop(0, tone(cold, 0.5));
      leak.addColorStop(0.35, tone(cold, 0.18));
      leak.addColorStop(1, tone(cold, 0));
      ctx.fillStyle = leak;
      ctx.fillRect(-r * 3.4, -r * 3.4, r * 6.8, r * 6.8);
      ctx.fillStyle = tone(cold, 0.55);
      ctx.beginPath();
      ctx.ellipse(1.5, 0, r * 0.22, r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

/* -------------------------------------------------------------------------
   ossuary-arch: an airbrushed bone-metal arch spanning the plate on radii
   from a center below the frame. Radial hatch tightens at the lit crest,
   concentric dash cross-hatch darkens the soffit, seams carry rivet pairs,
   coupling collars drop hose bundles, and a keystone vent throws the one
   cold beam straight down.
------------------------------------------------------------------------- */
function drawOssuaryArch(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const cold = coldTone(palette);
  const shimmer = (tick % 4409) * 0.0007;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "round";
  const cx = width * (0.34 + rnd(5000) * 0.32);
  const cy = height * (1.06 + rnd(5001) * 0.12);
  const R1 = height * (0.82 + rnd(5002) * 0.2);
  const thick = 26 + rnd(5003) * 18;
  const R2 = R1 - thick;
  const a0 = Math.PI * (1.01 + rnd(5004) * 0.05);
  const a1 = Math.PI * (1.99 - rnd(5005) * 0.05);

  // Airbrush ribbon: dark soffit at the inner radius, lit bone at the outer.
  const ribbon = ctx.createRadialGradient(cx, cy, R2, cx, cy, R1);
  ribbon.addColorStop(0, "rgba(30,30,34,0.42)");
  ribbon.addColorStop(0.55, "rgba(120,122,126,0.3)");
  ribbon.addColorStop(1, "rgba(212,214,216,0.34)");
  ctx.fillStyle = ribbon;
  ctx.beginPath();
  ctx.arc(cx, cy, R1, a0, a1);
  ctx.arc(cx, cy, R2, a1, a0, true);
  ctx.closePath();
  ctx.fill();

  // Radial hatch: denser and brighter toward the crest.
  let a = a0 + 0.02;
  let hs = 5100;
  while (a < a1 - 0.02) {
    const lit = Math.pow(clamp(-Math.sin(a), 0, 1), 1.3);
    const alpha = 0.06 + lit * 0.3 + (rnd(hs += 1) - 0.5) * 0.04;
    const jitter = (rnd(hs += 1) - 0.5) * 0.004 * (1 + 0.5 * Math.sin(shimmer + a * 3));
    ctx.strokeStyle = tone(BONE, clamp(alpha, 0.03, 0.42));
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a + jitter) * (R2 + 1.5), cy + Math.sin(a + jitter) * (R2 + 1.5));
    ctx.lineTo(cx + Math.cos(a) * (R1 - 1.5), cy + Math.sin(a) * (R1 - 1.5));
    ctx.stroke();
    a += 0.006 + (1 - lit) * 0.009;
  }

  // Concentric dash cross-hatch, weighted toward the shadowed soffit.
  for (let band = 0; band < 5; band += 1) {
    const rr = R2 + (band + 0.5) * (thick / 5);
    const underside = 1 - band / 4;
    let aa = a0 + 0.03;
    let ds = 5300 + band * 211;
    while (aa < a1 - 0.03) {
      const run = 0.02 + rnd(ds += 1) * 0.05;
      const gap = 0.01 + rnd(ds += 1) * 0.05;
      const lit = clamp(-Math.sin(aa), 0, 1);
      ctx.strokeStyle = tone(STEEL, 0.05 + underside * 0.16 * (0.35 + 0.65 * lit));
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, aa, Math.min(a1 - 0.02, aa + run));
      ctx.stroke();
      aa += run + gap;
    }
  }

  // Segment seams with rivet pairs.
  const seamStep = 0.085 + rnd(5006) * 0.04;
  for (let sa = a0 + seamStep; sa < a1 - 0.02; sa += seamStep) {
    ctx.strokeStyle = tone(OCCLUSION, 0.6);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(sa) * R2, cy + Math.sin(sa) * R2);
    ctx.lineTo(cx + Math.cos(sa) * R1, cy + Math.sin(sa) * R1);
    ctx.stroke();
    ctx.strokeStyle = tone(BONE, 0.3);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(sa + 0.006) * R2, cy + Math.sin(sa + 0.006) * R2);
    ctx.lineTo(cx + Math.cos(sa + 0.006) * R1, cy + Math.sin(sa + 0.006) * R1);
    ctx.stroke();
    ctx.fillStyle = tone(BONE, 0.5);
    for (const rr of [R2 + 4.5, R1 - 4.5]) {
      ctx.beginPath();
      ctx.arc(cx + Math.cos(sa - 0.008) * rr, cy + Math.sin(sa - 0.008) * rr, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Coupling collars on the soffit, each dropping a ribbed hose bundle.
  const couplings = 2 + Math.floor(rnd(5007) * 2);
  for (let c = 0; c < couplings; c += 1) {
    const fc = (c + 0.25 + rnd(5400 + c * 17) * 0.5) / couplings;
    const ca = a0 + fc * (a1 - a0);
    const sx = cx + Math.cos(ca) * R2;
    const sy = cy + Math.sin(ca) * R2;
    ctx.strokeStyle = tone(BONE, 0.5);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(cx, cy, R2 + 2, ca - 0.035, ca + 0.035);
    ctx.stroke();
    ctx.strokeStyle = tone(STEEL, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R2 + 6, ca - 0.028, ca + 0.028);
    ctx.stroke();
    const drift = (rnd(5411 + c * 17) - 0.5) * width * 0.22;
    const ex2 = clamp(sx + drift, 10, width - 10);
    const cpx = sx + drift * 0.25;
    const cpy = sy + (height - sy) * (0.4 + rnd(5412 + c * 17) * 0.25);
    const qAt = (t, off) => {
      const u = 1 - t;
      return [
        u * u * (sx + off) + 2 * u * t * (cpx + off) + t * t * (ex2 + off),
        u * u * sy + 2 * u * t * cpy + t * t * (height + 12),
      ];
    };
    const strands = 3 + Math.floor(rnd(5413 + c * 17) * 3);
    for (let f = 0; f < strands; f += 1) {
      const off = (f - (strands - 1) / 2) * 2.1;
      ctx.strokeStyle = tone(STEEL, 0.14 + rnd(5430 + c * 31 + f * 7) * 0.16);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let s2 = 0; s2 <= 26; s2 += 1) {
        const q = qAt(s2 / 26, off * (0.5 + s2 / 26));
        if (s2 === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = tone(BONE, 0.24);
    ctx.lineWidth = 0.7;
    for (let s2 = 2; s2 <= 24; s2 += 3) {
      const q0 = qAt(s2 / 26, -strands * 1.3);
      const q1 = qAt(s2 / 26, strands * 1.3);
      ctx.beginPath();
      ctx.moveTo(q0[0], q0[1]);
      ctx.lineTo(q1[0], q1[1]);
      ctx.stroke();
    }
  }

  // Keystone vent: a dark slot in the soffit, then the one cold beam.
  const am = (a0 + a1) / 2 + (rnd(5008) - 0.5) * 0.08;
  const mx = cx + Math.cos(am) * R2;
  const my = cy + Math.sin(am) * R2;
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(am + Math.PI / 2);
  ctx.fillStyle = tone(OCCLUSION, 0.8);
  ctx.fillRect(-7, -3, 14, 6);
  ctx.restore();
  ctx.globalCompositeOperation = "lighter";
  const bx = -Math.cos(am);
  const by = -Math.sin(am);
  const bl = 70 + rnd(5009) * 50;
  const tipX = mx + bx * bl;
  const tipY = my + by * bl;
  const beam = ctx.createLinearGradient(mx, my, tipX, tipY);
  beam.addColorStop(0, tone(cold, 0.4));
  beam.addColorStop(1, tone(cold, 0));
  const perpX = -by;
  const perpY = bx;
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(mx + perpX * 3, my + perpY * 3);
  ctx.lineTo(tipX + perpX * 12, tipY + perpY * 12);
  ctx.lineTo(tipX - perpX * 12, tipY - perpY * 12);
  ctx.lineTo(mx - perpX * 3, my - perpY * 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = tone(cold, 0.5);
  ctx.fillRect(mx - 2.5, my - 1.5, 5, 3);
  ctx.restore();
}

/* -------------------------------------------------------------------------
   sinew-loom: hatched anchor plates bolted to the frame edges, with sinew
   bundles strung between their bosses. Each bundle is a sheaf of sagging
   fibers with wrap ticks where they cinch. One sinew has snapped: both
   halves recoil into curls, and the cold spark sits in the gap.
------------------------------------------------------------------------- */
function drawSinewLoom(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const cold = coldTone(palette);
  const sway = (tick % 5003) * 0.0011;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "round";

  const plates = [];
  const nP = 4 + Math.floor(rnd(7000) * 3);
  const edgeSpin = Math.floor(rnd(7001) * 4);
  for (let p = 0; p < nP; p += 1) {
    const edge = (p + edgeSpin) % 4;
    const t = 0.12 + rnd(7010 + p * 13) * 0.76;
    const w2 = 42 + rnd(7011 + p * 13) * 30;
    const h2 = 16 + rnd(7012 + p * 13) * 12;
    let x;
    let y;
    let ang;
    if (edge === 0) { x = t * width; y = h2 * 0.35; ang = 0; }
    else if (edge === 1) { x = width - h2 * 0.35; y = t * height; ang = Math.PI / 2; }
    else if (edge === 2) { x = t * width; y = height - h2 * 0.35; ang = 0; }
    else { x = h2 * 0.35; y = t * height; ang = Math.PI / 2; }
    plates.push({ x, y, w: w2, h: h2, ang, edge });
  }
  const bossOf = (pl, k) => {
    const along = (k === 0 ? -1 : 1) * pl.w * 0.28;
    const inward = pl.edge === 0 ? [0, 1] : pl.edge === 1 ? [-1, 0] : pl.edge === 2 ? [0, -1] : [1, 0];
    const axis = pl.edge % 2 === 0 ? [1, 0] : [0, 1];
    return [
      pl.x + axis[0] * along + inward[0] * pl.h * 0.55,
      pl.y + axis[1] * along + inward[1] * pl.h * 0.55,
    ];
  };

  // Anchor plates: corner-weighted diagonal hatch, rim, bolt line.
  for (let p = 0; p < nP; p += 1) {
    const pl = plates[p];
    ctx.save();
    ctx.translate(pl.x, pl.y);
    ctx.rotate(pl.ang);
    ctx.fillStyle = tone(OCCLUSION, 0.55);
    ctx.fillRect(-pl.w / 2, -pl.h / 2, pl.w, pl.h);
    let hx = -pl.w / 2 + 1.2;
    let hsalt = 7100 + p * 57;
    while (hx < pl.w / 2 - 1) {
      const d = Math.abs(hx) / (pl.w / 2);
      ctx.strokeStyle = tone(STEEL, clamp(0.12 + (1 - d) * 0.2 + (rnd(hsalt += 1) - 0.5) * 0.05, 0.05, 0.4));
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(hx, -pl.h / 2 + 1);
      ctx.lineTo(hx + pl.h * 0.5, pl.h / 2 - 1);
      ctx.stroke();
      hx += 1.5 + d * 2;
    }
    ctx.strokeStyle = tone(BONE, 0.42);
    ctx.lineWidth = 1.1;
    ctx.strokeRect(-pl.w / 2, -pl.h / 2, pl.w, pl.h);
    ctx.fillStyle = tone(BONE, 0.5);
    for (let b = 0; b < 3; b += 1) {
      ctx.beginPath();
      ctx.arc(-pl.w / 2 + 5 + (b * (pl.w - 10)) / 2, 0, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Sinews between plate bosses.
  const nS = 8 + Math.floor(rnd(7002) * 6);
  const snapAt = Math.floor(rnd(7003) * nS);
  for (let s = 0; s < nS; s += 1) {
    const sb = 7200 + s * 61;
    // rnd() is inclusive of 1.0, so clamp the derived indices
    const pa = Math.min(nP - 1, Math.floor(rnd(sb) * nP));
    let pb = Math.min(nP - 1, Math.floor(rnd(sb + 1) * nP));
    if (pb === pa) pb = (pa + 1) % nP;
    const A = bossOf(plates[pa], Math.floor(rnd(sb + 2) * 2));
    const B = bossOf(plates[pb], Math.floor(rnd(sb + 3) * 2));
    const midX = (A[0] + B[0]) / 2 + (rnd(sb + 4) - 0.5) * width * 0.16;
    const midY = (A[1] + B[1]) / 2 + (0.3 + rnd(sb + 5) * 0.5) * 40 + Math.sin(sway + s) * 6;
    const fibers = 5 + Math.floor(rnd(sb + 6) * 6);
    const snapped = s === snapAt;
    for (let f = 0; f < fibers; f += 1) {
      const fo = (f - (fibers - 1) / 2) * 1.4;
      ctx.strokeStyle = tone(f % 3 === 0 ? BONE : STEEL, 0.09 + rnd(sb + 20 + f) * 0.1);
      ctx.lineWidth = 0.65;
      if (!snapped) {
        ctx.beginPath();
        for (let s2 = 0; s2 <= 30; s2 += 1) {
          const t = s2 / 30;
          const u = 1 - t;
          const qx2 = u * u * A[0] + 2 * u * t * (midX + fo * 2) + t * t * B[0];
          const qy2 = u * u * A[1] + 2 * u * t * (midY + fo * 2) + t * t * B[1];
          if (s2 === 0) ctx.moveTo(qx2, qy2); else ctx.lineTo(qx2, qy2);
        }
        ctx.stroke();
      } else {
        // Both halves are drawn from their anchor toward the break, then curl.
        for (let half = 0; half < 2; half += 1) {
          const tEnd = half === 0
            ? 0.36 - rnd(sb + 40 + f) * 0.05
            : 0.64 + rnd(sb + 44 + f) * 0.05;
          const tStart = half === 0 ? 0 : 1;
          ctx.beginPath();
          let lx = 0;
          let ly = 0;
          let px2 = 0;
          let py2 = 0;
          for (let s2 = 0; s2 <= 20; s2 += 1) {
            const t = tStart + (tEnd - tStart) * (s2 / 20);
            const u = 1 - t;
            px2 = lx;
            py2 = ly;
            lx = u * u * A[0] + 2 * u * t * (midX + fo * 2) + t * t * B[0];
            ly = u * u * A[1] + 2 * u * t * (midY + fo * 2) + t * t * B[1];
            if (s2 === 0) ctx.moveTo(lx, ly); else ctx.lineTo(lx, ly);
          }
          let ha = Math.atan2(ly - py2, lx - px2);
          const spin = (half === 0 ? 1 : -1) * (0.5 + rnd(sb + 50 + f) * 0.3);
          let stepLen = 2.6;
          for (let s2 = 0; s2 < 12; s2 += 1) {
            ha += spin;
            lx += Math.cos(ha) * stepLen;
            ly += Math.sin(ha) * stepLen;
            ctx.lineTo(lx, ly);
            stepLen *= 0.86;
          }
          ctx.stroke();
        }
      }
    }
    if (!snapped) {
      // Wrap ticks where the bundle cinches.
      ctx.strokeStyle = tone(BONE, 0.3);
      ctx.lineWidth = 0.8;
      const wraps = 2 + Math.floor(rnd(sb + 7) * 3);
      for (let w2 = 0; w2 < wraps; w2 += 1) {
        const t = 0.2 + rnd(sb + 60 + w2 * 3) * 0.6;
        const u = 1 - t;
        const qx2 = u * u * A[0] + 2 * u * t * midX + t * t * B[0];
        const qy2 = u * u * A[1] + 2 * u * t * midY + t * t * B[1];
        const dxq = 2 * u * (midX - A[0]) + 2 * t * (B[0] - midX);
        const dyq = 2 * u * (midY - A[1]) + 2 * t * (B[1] - midY);
        const ln = Math.hypot(dxq, dyq) || 1;
        const nx2 = -dyq / ln;
        const ny2 = dxq / ln;
        const half2 = fibers * 0.9 + 1.5;
        for (let k = -1; k <= 1; k += 1) {
          const ox = (dxq / ln) * k * 2.2;
          const oy = (dyq / ln) * k * 2.2;
          ctx.beginPath();
          ctx.moveTo(qx2 + nx2 * half2 + ox, qy2 + ny2 * half2 + oy);
          ctx.lineTo(qx2 - nx2 * half2 + ox, qy2 - ny2 * half2 + oy);
          ctx.stroke();
        }
      }
    } else {
      // The one cold mark: the spark in the broken gap.
      const gx = 0.25 * A[0] + 0.5 * midX + 0.25 * B[0];
      const gy = 0.25 * A[1] + 0.5 * midY + 0.25 * B[1];
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const spark = ctx.createRadialGradient(gx, gy, 0, gx, gy, 22);
      spark.addColorStop(0, tone(cold, 0.55));
      spark.addColorStop(0.4, tone(cold, 0.18));
      spark.addColorStop(1, tone(cold, 0));
      ctx.fillStyle = spark;
      ctx.fillRect(gx - 24, gy - 24, 48, 48);
      ctx.strokeStyle = tone(cold, 0.5);
      ctx.lineWidth = 0.7;
      for (let k = 0; k < 3; k += 1) {
        const a0 = rnd(sb + 70 + k) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(gx, gy, 5 + k * 4, a0, a0 + 1.8);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

/* -------------------------------------------------------------------------
   chitin-shingles: overlapping armor plates laid in offset rows along a
   bowed swath. Each plate hatches downward from a bright crest ridge, with
   the spacing opening as the shading falls away. One plate carries a jagged
   crack, and the cold tone seeps through it.
------------------------------------------------------------------------- */
function drawChitinPlate(ctx, x, y, w, h, ang, seed, salt, cold) {
  const rnd = (s) => rand(seed, salt + s);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const hw = w / 2;
  const hh = h / 2;
  const shield = () => {
    ctx.beginPath();
    ctx.moveTo(-hw, -hh * 0.55);
    ctx.quadraticCurveTo(0, -hh * 1.15, hw, -hh * 0.55);
    ctx.quadraticCurveTo(hw * 0.92, hh * 0.35, 0, hh);
    ctx.quadraticCurveTo(-hw * 0.92, hh * 0.35, -hw, -hh * 0.55);
    ctx.closePath();
  };
  shield();
  ctx.fillStyle = "rgba(10,11,14,0.55)";
  ctx.fill();
  ctx.save();
  shield();
  ctx.clip();
  // Hatch down from the crest: spacing opens and alpha decays as it falls.
  let hy = -hh * 0.75;
  let k = 0;
  while (hy < hh) {
    const fall = (hy + hh * 0.75) / (hh * 1.75);
    const alpha = clamp(0.4 - fall * 0.34 + (rnd(10 + k) - 0.5) * 0.06, 0.04, 0.45);
    ctx.strokeStyle = tone(STEEL, alpha);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-hw, hy + Math.sin(hy * 0.3) * 1.2);
    ctx.quadraticCurveTo(0, hy - hh * 0.28, hw, hy + Math.sin(hy * 0.37) * 1.2);
    ctx.stroke();
    hy += 1.4 + fall * 2.6;
    k += 1;
  }
  // Pore dots low on the plate.
  ctx.fillStyle = "rgba(6,7,9,0.7)";
  const pores = 2 + Math.floor(rnd(60) * 3);
  for (let d = 0; d < pores; d += 1) {
    ctx.beginPath();
    ctx.arc((rnd(61 + d * 3) - 0.5) * w * 0.6, hh * (0.2 + rnd(62 + d * 3) * 0.5),
      0.9 + rnd(63 + d * 3) * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Crest highlight ridge and the exposed lower rim.
  ctx.strokeStyle = tone(BONE, 0.5);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.85, -hh * 0.6);
  ctx.quadraticCurveTo(0, -hh * 1.05, hw * 0.85, -hh * 0.6);
  ctx.stroke();
  ctx.strokeStyle = tone(BONE, 0.26);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(hw * 0.9, -hh * 0.4);
  ctx.quadraticCurveTo(hw * 0.88, hh * 0.3, 0, hh * 0.96);
  ctx.stroke();
  if (cold) {
    const cr = [];
    let cxp = -hw * 0.8;
    let cyp = (rnd(80) - 0.5) * hh * 0.5;
    cr.push([cxp, cyp]);
    for (let d = 0; d < 6; d += 1) {
      cxp += (hw * 1.6) / 6;
      cyp = clamp(cyp + (rnd(81 + d) - 0.5) * hh * 0.55, -hh * 0.7, hh * 0.7);
      cr.push([cxp, cyp]);
    }
    ctx.strokeStyle = "rgba(4,5,7,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let d = 0; d < cr.length; d += 1) {
      if (d === 0) ctx.moveTo(cr[d][0], cr[d][1]); else ctx.lineTo(cr[d][0], cr[d][1]);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = tone(cold, 0.55);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let d = 0; d < cr.length; d += 1) {
      if (d === 0) ctx.moveTo(cr[d][0], cr[d][1] + 0.6); else ctx.lineTo(cr[d][0], cr[d][1] + 0.6);
    }
    ctx.stroke();
    const mid = cr[3];
    const seep = ctx.createRadialGradient(mid[0], mid[1], 0, mid[0], mid[1], w * 0.7);
    seep.addColorStop(0, tone(cold, 0.35));
    seep.addColorStop(1, tone(cold, 0));
    ctx.fillStyle = seep;
    ctx.fillRect(-w, -h, w * 2, h * 2);
  }
  ctx.restore();
}

function drawChitinShingles(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const cold = coldTone(palette);
  const drift = (tick % 6659) * 0.0009;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "round";
  const y0 = height * (0.25 + rnd(9000) * 0.5);
  const y1 = height * (0.25 + rnd(9001) * 0.5);
  const bow = (rnd(9002) - 0.5) * height * 0.5;
  const cAt = (t) => {
    const u = 1 - t;
    return [t * width, u * u * y0 + 2 * u * t * ((y0 + y1) / 2 + bow) + t * t * y1];
  };
  const tangAt = (t) => {
    const p0 = cAt(Math.max(0, t - 0.01));
    const p1 = cAt(Math.min(1, t + 0.01));
    return Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
  };
  const band = height * (0.16 + rnd(9003) * 0.12);
  const rows = 4 + Math.floor(rnd(9004) * 3);
  const pw = 24 + rnd(9005) * 12;
  const nCols = Math.max(6, Math.round(width / pw));
  const crackedRow = Math.floor(rnd(9006) * rows);
  // Keep the cracked plate inside the taper envelope: columns near the swath
  // ends can be culled by the env < 0.25 skip, which would drop the accent.
  const crackedCol = 1 + Math.floor(rnd(9007) * (nCols * 0.85 - 1));
  // Rows draw back to front so each lower course overlaps the one behind it.
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c <= nCols; c += 1) {
      const t = (c + (r % 2) * 0.5) / nCols;
      if (t > 1) continue;
      const env = Math.pow(Math.sin(Math.PI * clamp(t, 0.02, 0.98)), 0.55);
      // the cracked plate is the layer's one cold mark: never cull it, even
      // at banner aspect ratios where its column drifts into the taper ends
      const isCracked = r === crackedRow && c === crackedCol;
      if (env < 0.25 && !isCracked) continue;
      const base = cAt(t);
      const ang = tangAt(t);
      const off = -band / 2 + band * (rows === 1 ? 0.5 : r / (rows - 1));
      const ps = 9100 + (r * (nCols + 2) + c) * 7;
      const x = base[0] + Math.cos(ang + Math.PI / 2) * off + (rnd(ps) - 0.5) * 3;
      const y = base[1] + Math.sin(ang + Math.PI / 2) * off + (rnd(ps + 1) - 0.5) * 3;
      const pw2 = pw * env * (0.9 + rnd(ps + 2) * 0.25);
      const ph2 = pw2 * (1.15 + rnd(ps + 3) * 0.3);
      const tilt = ang + (rnd(ps + 4) - 0.5) * 0.22 + Math.sin(drift + t * 4) * 0.04;
      drawChitinPlate(ctx, x, y, pw2, ph2, tilt, seed,
        20000 + (r * (nCols + 2) + c) * 101, isCracked ? cold : null);
    }
  }
  ctx.restore();
}

/* -------------------------------------------------------------------------
   spiracle-bank: a bowed rib line of lens-shaped vents, each ringed with
   radiating ballpoint hatch that lengthens at the lens tips and thickens on
   the upper lip. Sagging ducts link neighbors behind the line. One vent is
   awake: its throat holds the cold glow and a slow drip falls from its lip.
------------------------------------------------------------------------- */
function drawSpiracleBank(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const cold = coldTone(palette);
  const breath = (tick % 5501) * 0.0012;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "round";
  const n = 5 + Math.floor(rnd(11000) * 4);
  const awake = Math.floor(rnd(11001) * n);
  const yA = height * (0.3 + rnd(11002) * 0.4);
  const yB = yA + (rnd(11004) - 0.5) * height * 0.3;
  const midY = (yA + yB) / 2 + (rnd(11003) - 0.5) * height * 0.4;
  const ventAt = (t) => {
    const u = 1 - t;
    return [width * (0.07 + t * 0.86), u * u * yA + 2 * u * t * midY + t * t * yB];
  };
  const tangAt = (t) => Math.atan2(2 * (1 - t) * (midY - yA) + 2 * t * (yB - midY), width * 0.86);
  const vents = [];
  for (let v = 0; v < n; v += 1) {
    const t = clamp((v + 0.5) / n + (rnd(11010 + v * 7) - 0.5) * (0.3 / n), 0.03, 0.97);
    const p = ventAt(t);
    vents.push({
      x: p[0],
      y: p[1] + (rnd(11012 + v * 7) - 0.5) * 18,
      r: 12 + rnd(11011 + v * 7) * 11,
      a: tangAt(t) + (rnd(11013 + v * 7) - 0.5) * 0.3,
    });
  }
  // Ductwork behind the line: sagging strand triples with rib ticks.
  for (let v = 0; v < n - 1; v += 1) {
    const A = vents[v];
    const B = vents[v + 1];
    const sagMid = 14 + rnd(11100 + v * 17 + 5) * 26;
    for (let d = 0; d < 3; d += 1) {
      const sag = 10 + rnd(11100 + v * 17 + d * 5) * 26 + d * 4;
      ctx.strokeStyle = tone(STEEL, 0.12 + rnd(11101 + v * 17 + d * 5) * 0.1);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let s2 = 0; s2 <= 20; s2 += 1) {
        const t = s2 / 20;
        const u = 1 - t;
        const qx = u * u * A.x + 2 * u * t * ((A.x + B.x) / 2) + t * t * B.x;
        const qy = u * u * A.y + 2 * u * t * ((A.y + B.y) / 2 + sag) + t * t * B.y;
        if (s2 === 0) ctx.moveTo(qx, qy); else ctx.lineTo(qx, qy);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = tone(STEEL, 0.16);
    ctx.lineWidth = 0.7;
    for (let s2 = 3; s2 <= 17; s2 += 3) {
      const t = s2 / 20;
      const u = 1 - t;
      const qx = u * u * A.x + 2 * u * t * ((A.x + B.x) / 2) + t * t * B.x;
      const qy = u * u * A.y + 2 * u * t * ((A.y + B.y) / 2 + sagMid) + t * t * B.y;
      ctx.beginPath();
      ctx.moveTo(qx, qy - 3.2);
      ctx.lineTo(qx, qy + 3.2);
      ctx.stroke();
    }
  }
  // The vents themselves.
  for (let v = 0; v < n; v += 1) {
    const V = vents[v];
    const isAwake = v === awake;
    const L = V.r * 1.9;
    const W2 = V.r * 0.6;
    ctx.save();
    ctx.translate(V.x, V.y);
    ctx.rotate(V.a);
    // Radiating hatch: longer at the tips, heavier on the upper lip.
    const rays = 64 + Math.floor(rnd(11200 + v * 23) * 30);
    for (let k2 = 0; k2 < rays; k2 += 1) {
      const rs = 11300 + v * 997 + k2 * 7;
      const th = (k2 / rays) * Math.PI * 2 + rnd(rs) * 0.05 + breath * 0.3;
      const ex2 = Math.cos(th) * L;
      const ey2 = Math.sin(th) * W2;
      let nx2 = Math.cos(th) / L;
      let ny2 = Math.sin(th) / W2;
      const nl = Math.hypot(nx2, ny2) || 1;
      nx2 /= nl;
      ny2 /= nl;
      const tipBias = 0.45 + 0.85 * Math.abs(Math.cos(th));
      const upBias = ey2 < 0 ? 1.25 : 0.8;
      const len = (5 + rnd(rs + 1) * 13) * tipBias * upBias * (isAwake ? 1.5 : 1);
      const alpha = (0.08 + rnd(rs + 2) * 0.14) * upBias * (isAwake ? 1.35 : 1);
      const bend = (rnd(rs + 3) - 0.5) * 0.8;
      ctx.strokeStyle = tone(k2 % 4 === 0 ? BONE : STEEL, clamp(alpha, 0.04, 0.4));
      ctx.lineWidth = 0.65;
      ctx.beginPath();
      ctx.moveTo(ex2, ey2);
      ctx.quadraticCurveTo(
        ex2 + nx2 * len * 0.5 - ny2 * bend * len * 0.3,
        ey2 + ny2 * len * 0.5 + nx2 * bend * len * 0.3,
        ex2 + nx2 * len, ey2 + ny2 * len
      );
      ctx.stroke();
    }
    // Chitin lip: doubled outline, then the dark throat.
    ctx.strokeStyle = tone(BONE, 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, L, W2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = tone(STEEL, 0.3);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.86, W2 * 0.74, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(5,6,8,0.72)";
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.8, W2 * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();
    // Baffles across the throat.
    const baffles = 4 + Math.floor(rnd(11214 + v * 23) * 4);
    for (let b = 0; b < baffles; b += 1) {
      const bx = -L * 0.62 + (b + 0.5) * ((L * 1.24) / baffles);
      const bh = W2 * 0.6 * Math.sqrt(Math.max(0.05, 1 - (bx / (L * 0.8)) * (bx / (L * 0.8))));
      ctx.strokeStyle = tone(STEEL, 0.28);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx, -bh);
      ctx.lineTo(bx + 1, bh);
      ctx.stroke();
    }
    // Reflected light along the lower inner lip.
    ctx.strokeStyle = tone(BONE, 0.16);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.72, W2 * 0.58, 0, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
    if (isAwake) {
      // The one cold mark: this vent is breathing.
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, L * 1.1);
      glow.addColorStop(0, tone(cold, 0.5));
      glow.addColorStop(0.45, tone(cold, 0.16));
      glow.addColorStop(1, tone(cold, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(-L * 1.2, -L * 1.2, L * 2.4, L * 2.4);
      ctx.fillStyle = tone(cold, 0.4);
      ctx.beginPath();
      ctx.ellipse(0, 0, L * 0.66, W2 * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = tone(cold, 0.4);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, W2 * 0.8);
      ctx.quadraticCurveTo(2.5, W2 * 0.8 + 12,
        1 + Math.sin(breath) * 2, W2 * 0.8 + 24 + rnd(11215 + v * 23) * 12);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

export const WAVE8_BIOMECH = {
  "vertebra-drive": drawVertebraDrive,
  "ribbed-conduit": drawRibbedConduit,
  "ossuary-arch": drawOssuaryArch,
  "sinew-loom": drawSinewLoom,
  "chitin-shingles": drawChitinShingles,
  "spiracle-bank": drawSpiracleBank,
};

export const WAVE8_BIOMECH_META = [
  { name: "vertebra-drive", family: "biomech-ink", blurb: "a tapering machine spine of hatched vertebrae, one kinked joint glowing cold" },
  { name: "ribbed-conduit", family: "biomech-ink", blurb: "hose runs built from hundreds of rib rings, one open coupling leaking cold light" },
  { name: "ossuary-arch", family: "biomech-ink", blurb: "airbrushed bone-metal arch, riveted seams, hanging hose bundles, cold keystone vent" },
  { name: "sinew-loom", family: "biomech-ink", blurb: "fiber sinews strung between hatched anchor plates, one snapped bundle sparking cold" },
  { name: "chitin-shingles", family: "biomech-ink", blurb: "overlapping chitin armor plates, ridge-lit hatch shading, one plate cracked cold" },
  { name: "spiracle-bank", family: "biomech-ink", blurb: "a rib line of lens spiracles ringed with radiating hatch, one vent breathing cold" },
];
