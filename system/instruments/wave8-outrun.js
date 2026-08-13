// wave8-outrun.js — outrun futurism drawn as fine line art: torn perspective
// grids, banded suns, chrome script, streaked starfields, dashboard night.
// Neon lives in layered strokes at falling alpha, never shadowBlur.
// First-party, seed-derived, no assets.

function rand(seed, salt) {
  let x = Math.imul(seed ^ Math.imul(salt + 1013904223, 1664525), 2246822519);
  x ^= x >>> 13;
  x = Math.imul(x, 3266489917);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

const BONE = [244, 247, 252];

function toneToRgba(t, a) {
  return `rgba(${Math.round(t[0])},${Math.round(t[1])},${Math.round(t[2])},${a.toFixed(3)})`;
}
function mixTone(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function fluidTones(palette) {
  return palette && Array.isArray(palette.fluid) && palette.fluid.length >= 3
    ? palette.fluid
    : [[96, 165, 250], [244, 114, 182], [252, 211, 77]];
}

// The neon discipline for this family: a stroke is drawn four times, wide and
// faint to narrow and hot, with the core pulled toward bone white. pathFn
// receives the context after beginPath and issues only moveTo/lineTo/arc.
function glowStroke(ctx, tone, w, alpha, pathFn) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const passes = [
    [w * 3.4, alpha * 0.07, tone],
    [w * 1.9, alpha * 0.16, tone],
    [w, alpha * 0.4, tone],
    [w * 0.45, alpha * 0.85, mixTone(tone, BONE, 0.72)],
  ];
  for (let p = 0; p < passes.length; p += 1) {
    ctx.strokeStyle = toneToRgba(passes[p][2], passes[p][1]);
    ctx.lineWidth = passes[p][0];
    ctx.beginPath();
    pathFn(ctx);
    ctx.stroke();
  }
  ctx.restore();
}

// Four-point specular glint, shared by the chrome and the starfield.
function starGlint(ctx, gx, gy, r, tone) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const arms = [[2.4, 0.08, 1], [1.2, 0.2, 0.82], [0.55, 0.55, 0.6]];
  for (let i = 0; i < arms.length; i += 1) {
    const rr = r * arms[i][2];
    ctx.strokeStyle = toneToRgba(tone, arms[i][1]);
    ctx.lineWidth = arms[i][0];
    ctx.beginPath();
    ctx.moveTo(gx - rr, gy);
    ctx.lineTo(gx + rr, gy);
    ctx.moveTo(gx, gy - rr * 1.25);
    ctx.lineTo(gx, gy + rr * 1.25);
    ctx.stroke();
  }
  ctx.fillStyle = toneToRgba(BONE, 0.9);
  ctx.fillRect(gx - 0.9, gy - 0.9, 1.8, 1.8);
  ctx.restore();
}

/* horizon-tear — the perspective floor grid every sleeve promised, except the
   fabric misbehaves: a buried hill swells the lattice and one seam rips it,
   the far side dropped and skewed, the rip edge burning. */
function drawHorizonTear(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const rnd = (salt) => rand(seed, salt);
  const f = fluidTones(palette);
  const gridTone = f[0];
  const seamTone = f[1];
  const horizonY = height * (0.34 + rnd(5001) * 0.13);
  const vx = width * (0.30 + rnd(5002) * 0.40);
  const floorH = height - horizonY;
  const bulgeX = width * (0.22 + rnd(5003) * 0.56);
  const bulgeR = width * (0.10 + rnd(5004) * 0.10);
  const bulgeH = floorH * (0.16 + rnd(5005) * 0.22);
  const tearX = width * (0.28 + rnd(5006) * 0.44);
  const tearDrop = floorH * (0.10 + rnd(5007) * 0.14);
  const tearSkew = width * (rnd(5008) - 0.5) * 0.10;
  const jagA = rnd(5009) * Math.PI * 2 + tick * 0.00007;
  const jagB = rnd(5010) * Math.PI * 2;
  const tearEdge = (t) => tearX
    + Math.sin(t * 21 + jagA) * width * 0.016 * t
    + Math.sin(t * 47 + jagB) * width * 0.008 * t;
  // t runs 0 at the horizon to 1 at the bottom edge.
  const warp = (x, t) => {
    const d = (x - bulgeX) / bulgeR;
    let px = x;
    let py = horizonY + floorH * t - bulgeH * t * Math.exp(-d * d);
    if (x > tearEdge(t)) { px += tearSkew * t; py += tearDrop * t; }
    return [px, py];
  };
  // Horizon bloom, then the hard bright horizon line.
  ctx.globalCompositeOperation = "lighter";
  const bloom = ctx.createLinearGradient(0, horizonY - height * 0.16, 0, horizonY + height * 0.05);
  bloom.addColorStop(0, toneToRgba(gridTone, 0));
  bloom.addColorStop(0.85, toneToRgba(mixTone(gridTone, BONE, 0.3), 0.2));
  bloom.addColorStop(1, toneToRgba(gridTone, 0.02));
  ctx.fillStyle = bloom;
  ctx.fillRect(0, horizonY - height * 0.16, width, height * 0.21);
  ctx.globalCompositeOperation = "source-over";
  glowStroke(ctx, gridTone, 1.1, 0.7, (c) => {
    c.moveTo(-4, horizonY);
    c.lineTo(width + 4, horizonY);
  });
  // Latitude polylines, perspective-packed toward the horizon. The path
  // breaks with a moveTo wherever it crosses the tear.
  const rows = 11 + Math.floor(rnd(5011) * 4);
  for (let i = 1; i <= rows; i += 1) {
    const t = Math.pow(i / rows, 2.1);
    glowStroke(ctx, gridTone, 0.6 + t, 0.16 + t * 0.5, (c) => {
      let prevSide = null;
      for (let x = -8; x <= width + 8; x += 6) {
        const side = x > tearEdge(t);
        const p = warp(x, t);
        if (prevSide === null || side !== prevSide) c.moveTo(p[0], p[1]);
        else c.lineTo(p[0], p[1]);
        prevSide = side;
      }
    });
  }
  // Longitudes fan out from the vanishing point and inherit the same warp.
  const cols = 9 + Math.floor(rnd(5012) * 4);
  const spread = width * (0.16 + rnd(5013) * 0.08);
  for (let k = -cols; k <= cols; k += 1) {
    const xb = vx + k * spread;
    const a = 0.14 + 0.3 * Math.exp(-Math.abs(k) * 0.16);
    glowStroke(ctx, gridTone, 0.7, a, (c) => {
      let prevSide = null;
      for (let s = 0.02; s <= 1.001; s += 0.045) {
        const x = vx + (xb - vx) * s;
        const side = x > tearEdge(s);
        const p = warp(x, s);
        if (prevSide === null || side !== prevSide) c.moveTo(p[0], p[1]);
        else c.lineTo(p[0], p[1]);
        prevSide = side;
      }
    });
  }
  // The rip: a hot ragged seam on the near lip, a dimmer echo on the dropped
  // side, sparks scattered where the lattice let go.
  glowStroke(ctx, seamTone, 1.5, 0.85, (c) => {
    for (let j = 0; j <= 30; j += 1) {
      const t = 0.05 + (j / 30) * 0.95;
      const p = warp(tearEdge(t) - 0.4, t);
      if (j === 0) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]);
    }
  });
  glowStroke(ctx, seamTone, 0.8, 0.4, (c) => {
    for (let j = 0; j <= 30; j += 1) {
      const t = 0.05 + (j / 30) * 0.95;
      const p = warp(tearEdge(t) + 0.4, t);
      if (j === 0) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]);
    }
  });
  ctx.globalCompositeOperation = "lighter";
  const sparks = 10 + Math.floor(rnd(5014) * 8);
  for (let s = 0; s < sparks; s += 1) {
    const t = 0.1 + rnd(5100 + s * 4) * 0.88;
    const p = warp(tearEdge(t) + (rnd(5101 + s * 4) - 0.5) * 14 * t, t);
    const r = 0.6 + rnd(5102 + s * 4) * 1.6;
    ctx.fillStyle = toneToRgba(mixTone(seamTone, BONE, 0.5), 0.3 + rnd(5103 + s * 4) * 0.5);
    ctx.fillRect(p[0] - r / 2, p[1] - r / 2, r, r);
  }
  ctx.restore();
}

/* venetian-sun — the banded sunset disc built as layered occluded arcs: a
   solid crown, slats thinning as the gaps widen, each slat with a lit top
   edge, one slat slipped out of register, shimmer road on dark water. */
function drawVenetianSun(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const rnd = (salt) => rand(seed, salt);
  const f = fluidTones(palette);
  const topTone = mixTone(f[2], BONE, 0.25);
  const botTone = f[1];
  const short = Math.min(width, height);
  const cx = width * (0.34 + rnd(6001) * 0.32);
  const cy = height * (0.30 + rnd(6002) * 0.16);
  const R = short * (0.24 + rnd(6003) * 0.10);
  // Corona: a soft radial lift plus broken concentric arcs falling off.
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.2);
  halo.addColorStop(0, toneToRgba(botTone, 0.16));
  halo.addColorStop(0.55, toneToRgba(botTone, 0.05));
  halo.addColorStop(1, toneToRgba(botTone, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(cx - R * 2.3, cy - R * 2.3, R * 4.6, R * 4.6);
  const rings = 7 + Math.floor(rnd(6004) * 5);
  for (let i = 0; i < rings; i += 1) {
    const rr = R * (1.08 + i * (0.09 + rnd(6005) * 0.03));
    const a0 = rnd(6100 + i * 5) * Math.PI * 2;
    const sweep = Math.PI * (0.5 + rnd(6101 + i * 5) * 1.1);
    ctx.strokeStyle = toneToRgba(mixTone(botTone, topTone, i / rings), 0.02 + 0.1 * (1 - i / rings));
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, a0, a0 + sweep);
    ctx.stroke();
  }
  // The banded disc. One vertical ramp is shared by every slat so the sunset
  // gradient stays continuous across the gaps.
  ctx.globalCompositeOperation = "source-over";
  const discGrad = ctx.createLinearGradient(0, cy - R, 0, cy + R);
  discGrad.addColorStop(0, toneToRgba(mixTone(topTone, BONE, 0.5), 0.95));
  discGrad.addColorStop(0.45, toneToRgba(topTone, 0.92));
  discGrad.addColorStop(1, toneToRgba(botTone, 0.9));
  const chord = (y) => {
    const dy = (y - cy) / R;
    const s = 1 - dy * dy;
    return s > 0 ? R * Math.sqrt(s) : 0;
  };
  const bandPath = (c, bx, y0, y1) => {
    const a0 = Math.asin(clamp((y0 - cy) / R, -1, 1));
    const a1 = Math.asin(clamp((y1 - cy) / R, -1, 1));
    c.beginPath();
    c.arc(bx, cy, R, a0, a1);
    c.arc(bx, cy, R, Math.PI - a1, Math.PI - a0);
    c.closePath();
  };
  const slipIdx = 2 + Math.floor(rnd(6006) * 5);
  const slipDx = R * (0.10 + rnd(6007) * 0.10) * (rnd(6008) > 0.5 ? 1 : -1);
  let y = cy - R;
  let th = R * 0.30;
  let gap = R * 0.028;
  let bandI = 0;
  while (y < cy + R - 1) {
    const y1 = Math.min(y + th, cy + R);
    const bx = cx + (bandI === slipIdx ? slipDx : 0);
    ctx.fillStyle = discGrad;
    bandPath(ctx, bx, y, y1);
    ctx.fill();
    const hw = chord(y + 0.6);
    if (hw > 2) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = toneToRgba(mixTone(topTone, BONE, 0.6), clamp(0.55 - bandI * 0.04, 0.12, 0.55));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx - hw, y + 0.6);
      ctx.lineTo(bx + hw, y + 0.6);
      ctx.stroke();
      ctx.restore();
    }
    y = y1 + gap;
    th = Math.max(R * 0.05, th * (0.74 + rnd(6120 + bandI * 3) * 0.05));
    gap *= 1.28 + rnd(6121 + bandI * 3) * 0.12;
    bandI += 1;
  }
  // A thin cloud slat occluding the disc, edges dissolving, lit underneath.
  if (rnd(6012) > 0.3) {
    const cyBar = cy - R * (0.05 + rnd(6015) * 0.35);
    const hBar = R * (0.06 + rnd(6016) * 0.06);
    const barGrad = ctx.createLinearGradient(cx - R * 1.4, 0, cx + R * 1.4, 0);
    barGrad.addColorStop(0, "rgba(6,8,14,0)");
    barGrad.addColorStop(0.25, "rgba(6,8,14,0.52)");
    barGrad.addColorStop(0.75, "rgba(6,8,14,0.52)");
    barGrad.addColorStop(1, "rgba(6,8,14,0)");
    ctx.fillStyle = barGrad;
    ctx.fillRect(cx - R * 1.4, cyBar, R * 2.8, hBar);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = toneToRgba(topTone, 0.3);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(cx - R * 1.05, cyBar + hBar + 0.5);
    ctx.lineTo(cx + R * 1.05, cyBar + hBar + 0.5);
    ctx.stroke();
    ctx.restore();
  }
  // Shimmer road: rows of broken specular dashes walking down dark water.
  ctx.globalCompositeOperation = "lighter";
  const wTop = cy + R * (1.06 + rnd(6013) * 0.1);
  const rowsW = 10 + Math.floor(rnd(6014) * 8);
  for (let i = 0; i < rowsW; i += 1) {
    const t = i / rowsW;
    const yw = wTop + t * t * height * 0.3;
    if (yw > height + 4) break;
    const half = R * (0.9 - t * 0.5) * (0.5 + rnd(6200 + i * 17) * 0.7);
    const segs = 1 + Math.floor(rnd(6201 + i * 17) * 3);
    for (let g = 0; g < segs; g += 1) {
      const off = (rnd(6202 + i * 17 + g * 5) - 0.5) * half * 1.6;
      const len = half * (0.25 + rnd(6203 + i * 17 + g * 5) * 0.55);
      ctx.strokeStyle = toneToRgba(mixTone(botTone, BONE, 0.25),
        (0.34 - t * 0.26) * (0.5 + rnd(6204 + i * 17 + g * 5) * 0.5));
      ctx.lineWidth = 1.1 - t * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx + off - len / 2, yw);
      ctx.lineTo(cx + off + len / 2, yw);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* chrome-ribbon — a script ribbon written in one stroke of chrome: sky above
   the reflection horizon, warm ground below, the white specular line sliding
   along the band, one loop-de-loop flourish, glints at the bright points. */
function drawChromeRibbon(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const rnd = (salt) => rand(seed, salt);
  const f = fluidTones(palette);
  const skyTone = mixTone(f[0], BONE, 0.35);
  const warmTone = f[1];
  const short = Math.min(width, height);
  const steps = 150;
  const loopLen = 22 + Math.floor(rnd(7001) * 8);
  const loopAt = Math.floor(steps * (0.28 + rnd(7002) * 0.36));
  const stepLen = (width * 1.16) / (steps - loopLen);
  const penAngle = Math.PI * (0.15 + rnd(7003) * 0.2);
  const wMax = short * (0.055 + rnd(7004) * 0.03);
  const p1 = rnd(7005) * Math.PI * 2 + tick * 0.00005;
  const p2 = rnd(7006) * Math.PI * 2;
  const driftT = (rnd(7007) - 0.5) * 0.003;
  let x = -width * 0.06;
  let y = height * (0.38 + rnd(7008) * 0.26);
  let a = (rnd(7009) - 0.5) * 0.3;
  const pts = [];
  const hs = [];
  const ws = [];
  for (let i = 0; i < steps; i += 1) {
    pts.push([x, y]);
    hs.push(a);
    ws.push(wMax * (0.35 + 0.65 * Math.abs(Math.sin(a - penAngle))));
    const inLoop = i >= loopAt && i < loopAt + loopLen;
    let turn = Math.cos(i * 0.043 + p1) * 0.045 + Math.cos(i * 0.011 + p2) * 0.03 + driftT;
    if (inLoop) turn += (Math.PI * 2) / loopLen;
    else turn += clamp((height * 0.52 - y) * 0.0007, -0.02, 0.02) * (Math.cos(a) >= 0 ? 1 : -1);
    a += turn;
    x += Math.cos(a) * stepLen;
    y += Math.sin(a) * stepLen;
  }
  const eL = [];
  const eR = [];
  for (let i = 0; i < steps; i += 1) {
    const nx = Math.cos(hs[i] + Math.PI / 2) * ws[i];
    const ny = Math.sin(hs[i] + Math.PI / 2) * ws[i];
    eL.push([pts[i][0] + nx, pts[i][1] + ny]);
    eR.push([pts[i][0] - nx, pts[i][1] - ny]);
  }
  // Chrome fill, one gradient per segment across the band. The white
  // specular horizon slides along the ribbon as the sweep.
  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < steps - 1; i += 1) {
    const sheen = 0.5 + 0.5 * Math.sin(i * 0.09 + p2);
    const wPos = 0.44 + sheen * 0.08;
    const g = ctx.createLinearGradient(eL[i][0], eL[i][1], eR[i][0], eR[i][1]);
    g.addColorStop(0, toneToRgba(mixTone(skyTone, BONE, 0.55), 0.92));
    g.addColorStop(Math.max(0.05, wPos - 0.06), toneToRgba(skyTone, 0.85));
    g.addColorStop(wPos, toneToRgba(BONE, 0.95));
    g.addColorStop(Math.min(0.95, wPos + 0.055), toneToRgba(mixTone(warmTone, [24, 18, 30], 0.5), 0.9));
    g.addColorStop(1, toneToRgba([28, 26, 42], 0.88));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(eL[i][0], eL[i][1]);
    ctx.lineTo(eL[i + 1][0], eL[i + 1][1]);
    ctx.lineTo(eR[i + 1][0], eR[i + 1][1]);
    ctx.lineTo(eR[i][0], eR[i][1]);
    ctx.closePath();
    ctx.fill();
  }
  // Dark under-edge grounds the band; lit top edge carries the neon.
  ctx.strokeStyle = "rgba(8,8,16,0.55)";
  ctx.lineWidth = 1.4;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i < steps; i += 1) {
    if (i === 0) ctx.moveTo(eR[i][0], eR[i][1]); else ctx.lineTo(eR[i][0], eR[i][1]);
  }
  ctx.stroke();
  glowStroke(ctx, skyTone, 0.9, 0.6, (c) => {
    for (let i = 0; i < steps; i += 1) {
      if (i === 0) c.moveTo(eL[i][0], eL[i][1]); else c.lineTo(eL[i][0], eL[i][1]);
    }
  });
  // Broad diagonal specular sweep, clipped inside the ribbon silhouette.
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < steps; i += 1) {
    if (i === 0) ctx.moveTo(eL[i][0], eL[i][1]); else ctx.lineTo(eL[i][0], eL[i][1]);
  }
  for (let i = steps - 1; i >= 0; i -= 1) ctx.lineTo(eR[i][0], eR[i][1]);
  ctx.closePath();
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";
  const sa = -Math.PI / 5;
  const sx = width * (0.3 + rnd(7010) * 0.4);
  const sw = short * 0.5;
  const dxs = Math.cos(sa + Math.PI / 2);
  const dys = Math.sin(sa + Math.PI / 2);
  const g2 = ctx.createLinearGradient(sx - dxs * sw, height * 0.5 - dys * sw,
    sx + dxs * sw, height * 0.5 + dys * sw);
  g2.addColorStop(0, "rgba(255,255,255,0)");
  g2.addColorStop(0.5, "rgba(255,255,255,0.34)");
  g2.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(-width * 0.1, -height * 0.1, width * 1.2, height * 1.2);
  ctx.restore();
  // Glints at the loop apex, one early, one late.
  const gi = [
    Math.floor(steps * 0.12),
    loopAt + Math.floor(loopLen * 0.25),
    Math.floor(steps * (0.72 + rnd(7011) * 0.2)),
  ];
  for (let k = 0; k < gi.length; k += 1) {
    const i = clamp(gi[k], 0, steps - 1);
    starGlint(ctx, eL[i][0], eL[i][1], 4 + ws[i] * 0.25, mixTone(skyTone, BONE, 0.5));
  }
  ctx.restore();
}

/* star-streak — a starfield under hard acceleration: every star drags a
   radial streak away from an off-centre vanishing point, longer and hotter
   near the edge, a slanted galactic band thickening the field, one meteor
   crossing against the flow. */
function drawStarStreak(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const rnd = (salt) => rand(seed, salt);
  const f = fluidTones(palette);
  const short = Math.min(width, height);
  const vx = width * (0.28 + rnd(8001) * 0.44);
  const vy = height * (0.30 + rnd(8002) * 0.40);
  const maxR = Math.hypot(Math.max(vx, width - vx), Math.max(vy, height - vy));
  const speed = 0.5 + rnd(8003) * 0.9;
  const bandAng = rnd(8004) * Math.PI + tick * 0.00004;
  ctx.globalCompositeOperation = "lighter";
  const haze = ctx.createRadialGradient(vx, vy, 0, vx, vy, maxR);
  haze.addColorStop(0, toneToRgba(mixTone(f[0], BONE, 0.5), 0.13));
  haze.addColorStop(0.5, toneToRgba(f[0], 0.05));
  haze.addColorStop(1, toneToRgba(f[0], 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 3; i += 1) {
    ctx.strokeStyle = toneToRgba(f[2], 0.05 + rnd(8100 + i * 7) * 0.03);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(vx, vy, maxR * (0.24 + rnd(8103 + i * 7) * 0.6), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.lineCap = "round";
  const n = 240 + Math.floor(rnd(8005) * 120);
  const bright = [];
  for (let i = 0; i < n; i += 1) {
    let ang = rnd(8200 + i * 11) * Math.PI * 2;
    if (rnd(8201 + i * 11) < 0.42) {
      const target = (rnd(8202 + i * 11) < 0.5 ? bandAng : bandAng + Math.PI)
        + (rnd(8203 + i * 11) - 0.5) * 0.7;
      ang = ang * 0.25 + target * 0.75;
    }
    const d = maxR * (0.05 + Math.pow(rnd(8204 + i * 11), 0.62) * 0.95);
    const dn = d / maxR;
    const len = 1.4 + speed * Math.pow(dn, 1.7) * (18 + rnd(8205 + i * 11) * 30);
    const ca = Math.cos(ang);
    const sn = Math.sin(ang);
    const x0 = vx + ca * d;
    const y0 = vy + sn * d;
    const x1 = vx + ca * (d + len);
    const y1 = vy + sn * (d + len);
    if ((x0 < -20 && x1 < -20) || (x0 > width + 20 && x1 > width + 20)
      || (y0 < -20 && y1 < -20) || (y0 > height + 20 && y1 > height + 20)) continue;
    const pick = rnd(8206 + i * 11);
    const tone = pick < 0.12 ? f[1] : pick < 0.24 ? f[2] : mixTone(f[0], BONE, 0.75);
    const alpha = 0.22 + rnd(8207 + i * 11) * 0.5 + dn * 0.2;
    const w = 0.5 + dn * 1.3;
    const layers = [[3.0, 0.10], [1.4, 0.3], [0.6, 0.9]];
    for (let l = 0; l < layers.length; l += 1) {
      ctx.strokeStyle = toneToRgba(tone, alpha * layers[l][1]);
      ctx.lineWidth = w * layers[l][0];
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.fillStyle = toneToRgba(mixTone(tone, BONE, 0.6), Math.min(0.95, alpha + 0.25));
    const hr = 0.7 + dn * 1.1;
    ctx.fillRect(x1 - hr / 2, y1 - hr / 2, hr, hr);
    if (alpha > 0.8 && len > 20 && bright.length < 5) bright.push([x1, y1, 3 + dn * 5, tone]);
  }
  for (let b = 0; b < bright.length; b += 1) {
    starGlint(ctx, bright[b][0], bright[b][1], bright[b][2], mixTone(bright[b][3], BONE, 0.4));
  }
  // The meteor: a dashed tail decaying behind a hot head, cutting across the
  // radial flow rather than obeying it.
  const mAng = bandAng + Math.PI * (0.35 + rnd(8006) * 0.3);
  const mx = width * (0.2 + rnd(8007) * 0.6);
  const my = height * (0.12 + rnd(8008) * 0.35);
  const mLen = short * (0.5 + rnd(8009) * 0.4);
  const mdx = Math.cos(mAng);
  const mdy = Math.sin(mAng);
  for (let i = 0; i < 16; i += 1) {
    const t0 = i / 16;
    const t1 = (i + 0.55) / 16;
    const fall = (1 - t0) * 0.75;
    const tail = [[2.6, 0.12], [1.0, 0.4]];
    for (let l = 0; l < tail.length; l += 1) {
      ctx.strokeStyle = toneToRgba(f[1], fall * tail[l][1]);
      ctx.lineWidth = tail[l][0] * (1 - t0 * 0.6);
      ctx.beginPath();
      ctx.moveTo(mx + mdx * mLen * t0, my + mdy * mLen * t0);
      ctx.lineTo(mx + mdx * mLen * t1, my + mdy * mLen * t1);
      ctx.stroke();
    }
  }
  starGlint(ctx, mx, my, 6, mixTone(f[1], BONE, 0.3));
  ctx.restore();
}

/* night-gauges — dashboard at night: two instrument arcs cropped by the
   frame bottom, fine tick combs, a redline segment, indicator bars, a faint
   windshield reflection, and the main needle buried past the redline with
   its motion-ghost still hanging behind it. */
function drawNightGauges(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const rnd = (salt) => rand(seed, salt);
  const f = fluidTones(palette);
  const dialTone = f[0];
  const redTone = f[1];
  const litTone = f[2];
  const short = Math.min(width, height);
  const A0 = Math.PI * 0.76;
  const SW = Math.PI * 1.48;
  const ang = (t) => A0 + SW * t;
  const cx1 = width * (0.30 + rnd(9001) * 0.10);
  const cy1 = height * (0.80 + rnd(9002) * 0.08);
  const R1 = short * (0.34 + rnd(9003) * 0.07);
  const cx2 = cx1 + R1 * (1.7 + rnd(9006) * 0.3);
  const cy2 = cy1 + R1 * 0.10;
  const R2 = R1 * (0.55 + rnd(9007) * 0.12);
  // Windshield ghosts first, faint mirrored arcs floating above the cluster.
  const yM = cy1 - R1 * 1.30;
  const ghosts = [[cx1, cy1, R1], [cx2, cy2, R2]];
  for (let gI = 0; gI < ghosts.length; gI += 1) {
    ctx.strokeStyle = toneToRgba(dialTone, 0.06);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(ghosts[gI][0], 2 * yM - ghosts[gI][1], ghosts[gI][2], -(A0 + SW), -A0);
    ctx.stroke();
  }
  const gauge = (cx, cy, R, saltBase, needleT, main) => {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const bl = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.15);
    bl.addColorStop(0, toneToRgba(dialTone, main ? 0.10 : 0.07));
    bl.addColorStop(0.8, toneToRgba(dialTone, 0.03));
    bl.addColorStop(1, toneToRgba(dialTone, 0));
    ctx.fillStyle = bl;
    ctx.fillRect(cx - R * 1.2, cy - R * 1.2, R * 2.4, R * 2.4);
    ctx.restore();
    glowStroke(ctx, dialTone, main ? 1.5 : 1.1, 0.65, (c) => c.arc(cx, cy, R, ang(0), ang(1)));
    glowStroke(ctx, dialTone, 0.7, 0.3, (c) => c.arc(cx, cy, R * 0.84, ang(0), ang(1)));
    const redFrom = 0.80 + rand(seed, saltBase + 1) * 0.06;
    glowStroke(ctx, redTone, main ? 2.4 : 1.7, 0.8,
      (c) => c.arc(cx, cy, R * 0.94, ang(redFrom), ang(1)));
    const majors = 8 + Math.floor(rand(seed, saltBase + 2) * 5);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let m = 0; m <= majors; m += 1) {
      const t = m / majors;
      const aa = ang(t);
      const c0 = Math.cos(aa);
      const s0 = Math.sin(aa);
      const tn = t >= redFrom ? redTone : mixTone(dialTone, BONE, 0.35);
      const tickPasses = [[2.2, 0.10], [0.9, 0.6]];
      for (let l = 0; l < tickPasses.length; l += 1) {
        ctx.strokeStyle = toneToRgba(tn, tickPasses[l][1]);
        ctx.lineWidth = tickPasses[l][0];
        ctx.beginPath();
        ctx.moveTo(cx + c0 * R * 0.86, cy + s0 * R * 0.86);
        ctx.lineTo(cx + c0 * R * 0.985, cy + s0 * R * 0.985);
        ctx.stroke();
      }
      if (m < majors) {
        for (let sm = 1; sm <= 4; sm += 1) {
          const as2 = ang(t + (sm / 5) / majors);
          ctx.strokeStyle = toneToRgba(dialTone, 0.22);
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(as2) * R * 0.90, cy + Math.sin(as2) * R * 0.90);
          ctx.lineTo(cx + Math.cos(as2) * R * 0.965, cy + Math.sin(as2) * R * 0.965);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
    const needle = (aOff, mul) => {
      const aN = ang(clamp(needleT, 0, 1.05)) + aOff;
      const tx = cx + Math.cos(aN) * R * 0.90;
      const ty = cy + Math.sin(aN) * R * 0.90;
      const bx = cx - Math.cos(aN) * R * 0.14;
      const by = cy - Math.sin(aN) * R * 0.14;
      const nx = Math.cos(aN + Math.PI / 2) * R * 0.02;
      const ny = Math.sin(aN + Math.PI / 2) * R * 0.02;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = toneToRgba(mixTone(redTone, BONE, 0.25), 0.5 * mul);
      ctx.beginPath();
      ctx.moveTo(bx + nx, by + ny);
      ctx.lineTo(bx - nx, by - ny);
      ctx.lineTo(tx, ty);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = toneToRgba(BONE, 0.9 * mul);
      ctx.fillRect(tx - 1.2, ty - 1.2, 2.4, 2.4);
      ctx.restore();
      glowStroke(ctx, redTone, 1.0, 0.85 * mul, (c) => {
        c.moveTo(bx, by);
        c.lineTo(tx, ty);
      });
    };
    needle(-0.10 - rand(seed, saltBase + 3) * 0.06, 0.25);
    needle(0, 1);
    ctx.fillStyle = "rgba(8,9,14,0.9)";
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.07, 0, Math.PI * 2);
    ctx.fill();
    glowStroke(ctx, dialTone, 0.8, 0.5, (c) => c.arc(cx, cy, R * 0.07, 0, Math.PI * 2));
  };
  gauge(cx1, cy1, R1, 9200, 0.92 + rnd(9004) * 0.12, true);
  gauge(cx2, cy2, R2, 9300, 0.35 + rnd(9005) * 0.30, false);
  // Indicator bar row above the cluster, a few segments lit.
  const bars = 8 + Math.floor(rnd(9008) * 6);
  const bw = short * 0.022;
  const bh = short * 0.012;
  const bgap = bw * 0.55;
  const bx0 = clamp((cx1 + cx2) / 2 - (bars * (bw + bgap) - bgap) / 2, width * 0.06, width * 0.5);
  const by0 = Math.min(cy1, cy2) - R1 * (1.06 + rnd(9009) * 0.10);
  for (let b = 0; b < bars; b += 1) {
    const lx = bx0 + b * (bw + bgap);
    if (rnd(9100 + b * 3) < 0.42) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = toneToRgba(litTone, 0.16);
      ctx.fillRect(lx - 1.5, by0 - 1.5, bw + 3, bh + 3);
      ctx.fillStyle = toneToRgba(mixTone(litTone, BONE, 0.4), 0.8);
      ctx.fillRect(lx, by0, bw, bh);
      ctx.restore();
    } else {
      ctx.strokeStyle = toneToRgba(dialTone, 0.16);
      ctx.lineWidth = 0.7;
      ctx.strokeRect(lx, by0, bw, bh);
    }
  }
  ctx.restore();
}

/* laser-ridge — wireframe mountain ridgelines receding to a glowing horizon,
   each with vertical drop-lines making the mesh, a dark apron for depth,
   nearer ridges hotter, and one mid ridge carrying a horizontal sync glitch
   where a slice of the terrain slips sideways with bright caps. */
function drawLaserRidge(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const rnd = (salt) => rand(seed, salt);
  const f = fluidTones(palette);
  const farTone = f[1];
  const nearTone = f[0];
  const horizonY = height * (0.30 + rnd(11001) * 0.12);
  const ridges = 7 + Math.floor(rnd(11002) * 3);
  const ph = [];
  for (let k = 0; k < 3; k += 1) ph.push(rnd(11100 + k) * Math.PI * 2);
  ph[0] += tick * 0.00006;
  const massifX = width * (0.25 + rnd(11003) * 0.5);
  const relief = (x, det, detPh) => {
    const u = x / width;
    let v = 0.5 + 0.5 * Math.sin(u * 4.1 + ph[0]);
    v *= 0.55 + 0.45 * Math.sin(u * 2.2 + ph[1]);
    v += 0.30 * Math.abs(Math.sin(u * 9.7 + ph[2]));
    v += det * 0.2 * Math.sin(u * 23 + detPh);
    const e = Math.exp(-Math.pow((x - massifX) / (width * 0.38), 2));
    return v * (0.35 + 0.65 * e);
  };
  // VHS sky: whisper-level scan bands, then the horizon line itself.
  ctx.fillStyle = "rgba(210,225,245,0.028)";
  const bandsN = 3 + Math.floor(rnd(11004) * 3);
  for (let i = 0; i < bandsN; i += 1) {
    const yb = horizonY * (0.15 + rnd(11200 + i * 3) * 0.8);
    ctx.fillRect(0, yb, width, 2 + rnd(11201 + i * 3) * 5);
  }
  glowStroke(ctx, farTone, 1.0, 0.5, (c) => {
    c.moveTo(-4, horizonY);
    c.lineTo(width + 4, horizonY);
  });
  const gRidge = 2 + Math.floor(rnd(11005) * (ridges - 4));
  const gDx = width * (0.02 + rnd(11006) * 0.03) * (rnd(11007) < 0.5 ? -1 : 1);
  const gY0f = 0.35 + rnd(11008) * 0.3;
  for (let r = 0; r < ridges; r += 1) {
    const t = r / (ridges - 1);
    const baseY = horizonY + (height * 1.04 - horizonY) * Math.pow(t, 1.5);
    const amp = height * (0.035 + 0.30 * Math.pow(t, 1.25));
    const parallax = 0.55 + 0.45 * t;
    const drift = (rnd(11300 + r * 7) - 0.5) * width * 0.18;
    const detPh = rnd(11301 + r * 7) * Math.PI * 2;
    const det = 0.4 + rnd(11302 + r * 7) * 0.6;
    const yAt = (x) => baseY
      - amp * clamp(relief((x - width / 2) / parallax + width / 2 + drift, det, detPh), 0, 1.4);
    const tone = mixTone(farTone, nearTone, t);
    const alpha = 0.18 + 0.6 * t;
    // Dark apron under the ridgeline, fading down, so depth reads without
    // burying the layers underneath.
    const apron = ctx.createLinearGradient(0, baseY - amp, 0, baseY + amp * 0.6);
    apron.addColorStop(0, "rgba(5,7,13,0.45)");
    apron.addColorStop(1, "rgba(5,7,13,0)");
    ctx.fillStyle = apron;
    ctx.beginPath();
    ctx.moveTo(-4, yAt(-4));
    for (let x = 2; x <= width + 4; x += 6) ctx.lineTo(x, yAt(x));
    ctx.lineTo(width + 4, baseY + amp * 0.6);
    ctx.lineTo(-4, baseY + amp * 0.6);
    ctx.closePath();
    ctx.fill();
    // Drop-lines: the wireframe mesh hanging off the ridge.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = toneToRgba(tone, alpha * 0.22);
    ctx.lineWidth = 0.7;
    const stepD = 26 - t * 12;
    for (let x = stepD * 0.4; x <= width; x += stepD) {
      const yr = yAt(x);
      const yBot = baseY + amp * 0.28;
      if (yBot - yr > 2) {
        ctx.beginPath();
        ctx.moveTo(x, yr + 1);
        ctx.lineTo(x, yBot);
        ctx.stroke();
      }
    }
    ctx.restore();
    // Ridgeline, glitch band applied on the chosen ridge only.
    const ptsR = [];
    for (let x = -4; x <= width + 4; x += 5) {
      let px = x;
      const py = yAt(x);
      let cut = false;
      if (r === gRidge) {
        const bandTop = baseY - amp * (gY0f + 0.18);
        const bandBot = baseY - amp * gY0f;
        if (py > bandTop && py < bandBot) { px += gDx; cut = true; }
      }
      ptsR.push([px, py, cut]);
    }
    glowStroke(ctx, tone, 0.6 + t * 1.1, alpha, (c) => {
      for (let i = 0; i < ptsR.length; i += 1) {
        if (i === 0 || ptsR[i][2] !== ptsR[i - 1][2]) c.moveTo(ptsR[i][0], ptsR[i][1]);
        else c.lineTo(ptsR[i][0], ptsR[i][1]);
      }
    });
    if (r === gRidge) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = toneToRgba(mixTone(f[2], BONE, 0.4), 0.85);
      for (let i = 1; i < ptsR.length; i += 1) {
        if (ptsR[i][2] !== ptsR[i - 1][2]) {
          ctx.fillRect(ptsR[i][0] - 1.4, ptsR[i][1] - 1.4, 2.8, 2.8);
        }
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

export const WAVE8_OUTRUN = {
  "horizon-tear": drawHorizonTear,
  "venetian-sun": drawVenetianSun,
  "chrome-ribbon": drawChromeRibbon,
  "star-streak": drawStarStreak,
  "night-gauges": drawNightGauges,
  "laser-ridge": drawLaserRidge,
};

export const WAVE8_OUTRUN_META = [
  { name: "horizon-tear", family: "outrun", blurb: "perspective floor grid swells over a buried hill and rips along one glowing seam" },
  { name: "venetian-sun", family: "outrun", blurb: "banded sunset disc of occluded arcs, one slat slipped, shimmer road on dark water" },
  { name: "chrome-ribbon", family: "outrun", blurb: "chrome script ribbon loops once across the frame, specular horizon sliding along it" },
  { name: "star-streak", family: "outrun", blurb: "warp starfield streaking from an off-centre vanishing point, one meteor cuts across" },
  { name: "night-gauges", family: "outrun", blurb: "dashboard at night: two glowing instrument arcs, needle buried past the redline" },
  { name: "laser-ridge", family: "outrun", blurb: "wireframe ridgelines recede to a glowing horizon; one carries a sideways sync glitch" },
];
