// wave8-dark-monument.js — Beksinski-register dark monumental landscapes,
// fully abstract: strata towers, ash horizons, bone colonnades, buried forms,
// particulate veils, veiled apertures. First-party, seed-derived, no assets.
// Deep warm-dark grounds; structure carried by tonal masses, texture by
// dry-brush stroke clusters. No literal figures.

function rand(seed, salt) {
  let x = Math.imul(seed ^ Math.imul(salt + 1013904223, 1664525), 2246822519);
  x ^= x >>> 13;
  x = Math.imul(x, 3266489917);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function mix(a, b, t) { return a + (b - a) * t; }
function rgba(t, a) { return `rgba(${t[0]},${t[1]},${t[2]},${a.toFixed(3)})`; }

const BONE = [214, 202, 182];
const ASH = [126, 122, 116];

// Warm near-neutral grey: enough umber bias to sit in the register, close
// enough to neutral that the palette-alignment wrapper lets it pass.
function warmTone(l) {
  return [
    clamp(Math.round(l * 1.14), 0, 255),
    clamp(Math.round(l * 0.97), 0, 255),
    clamp(Math.round(l * 0.78), 0, 255),
  ];
}

// Smooth value noise on an integer lattice, one stream per salt.
function vnoise(seed, salt, x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const h = (ix, iy) => rand(seed, salt + ix * 374761393 + iy * 668265263);
  return mix(
    mix(h(xi, yi), h(xi + 1, yi), sx),
    mix(h(xi, yi + 1), h(xi + 1, yi + 1), sx),
    sy
  );
}
function fbm(seed, salt, x, y) {
  return vnoise(seed, salt, x, y) * 0.55
    + vnoise(seed, salt + 101, x * 2.13, y * 2.13) * 0.28
    + vnoise(seed, salt + 202, x * 4.31, y * 4.31) * 0.17;
}

// A dry-brush drag: a cluster of short parallel hairlines with ragged length
// and alpha, the bristle texture the whole family leans on. Caller sets
// lineWidth; every hair pulls its own randomness from the salt block.
function drybrush(ctx, seed, salt, x, y, len, ang, spread, tone, alpha, hairs) {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const nx = -sa;
  const ny = ca;
  for (let h = 0; h < hairs; h += 1) {
    const off = (rand(seed, salt + h * 3) - 0.5) * spread;
    const l = len * (0.5 + rand(seed, salt + h * 3 + 1) * 0.6);
    const a = alpha * (0.35 + rand(seed, salt + h * 3 + 2) * 0.65);
    ctx.strokeStyle = rgba(tone, a);
    ctx.beginPath();
    ctx.moveTo(x + nx * off, y + ny * off);
    ctx.lineTo(x + nx * off + ca * l, y + ny * off + sa * l);
    ctx.stroke();
  }
}

/* An eroded tower of strata rising off-centre into haze. Large gesture: the
   leaning mass. Mid rhythm: the strata bands. Fine detail: wind erosion drags,
   shed debris. The authored mark: one ember seam splitting the tower. */
function drawStrataMonolith(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const base = Math.min(width, height);
  const ember = ((palette && palette.fluid) || [[226, 158, 96]])[0];
  ctx.globalCompositeOperation = "source-over";
  const ground = ctx.createLinearGradient(0, 0, 0, height);
  ground.addColorStop(0, "rgba(22,19,16,0.16)");
  ground.addColorStop(0.6, "rgba(37,30,24,0.3)");
  ground.addColorStop(1, "rgba(50,40,30,0.42)");
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, width, height);

  const side = rand(seed, 101) < 0.5 ? -1 : 1;
  const footX = width * (0.5 + side * (0.1 + rand(seed, 102) * 0.15));
  const footY = height * 1.02;
  const topY = height * (0.05 + rand(seed, 103) * 0.1);
  const lean = (rand(seed, 104) - 0.5) * 0.2;
  const baseHalf = base * (0.14 + rand(seed, 105) * 0.07);
  const windDir = rand(seed, 106) < 0.5 ? -1 : 1;
  const seamT = 0.28 + rand(seed, 107) * 0.42;
  const drift = (tick % 90000) * 0.00011;

  const bandH = Math.max(2.2, base * 0.011);
  const bands = Math.floor((footY - topY) / bandH);
  ctx.lineCap = "round";
  for (let b = 0; b < bands; b += 1) {
    const blk = 10000 + b * 29;
    const t = b / bands;
    const y = footY - b * bandH;
    const cx = footX + lean * (footY - y)
      + (fbm(seed, 130, t * 5.2 + drift, 0.7) - 0.5) * base * 0.08;
    const half = baseHalf * (1 - t * 0.58)
      * (0.62 + fbm(seed, 140, t * 9.1, 3.1) * 0.66);
    const fade = clamp((1 - t) / 0.3, 0, 1); // dissolve into haze at the top
    const lum = 26 + fbm(seed, 150, t * 17.3, 8.8) * 44 + t * 8;
    ctx.fillStyle = rgba(warmTone(lum), 0.72 * fade + 0.04);
    ctx.fillRect(cx - half, y - bandH, half * 2, bandH + 0.7);
    // lit rim on the windward-opposite edge
    const litX = cx - windDir * half;
    ctx.strokeStyle = rgba(BONE, (0.05 + rand(seed, blk) * 0.22) * fade);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(litX, y - bandH);
    ctx.lineTo(litX + windDir * half * 0.16, y);
    ctx.stroke();
    // wind erosion trailing off the leeward edge
    if (rand(seed, blk + 1) < 0.34) {
      ctx.lineWidth = 0.7;
      drybrush(ctx, seed, blk + 3, cx + windDir * half, y - bandH * 0.5,
        base * (0.03 + rand(seed, blk + 2) * 0.1) * (0.6 + t),
        windDir > 0 ? 0.06 : Math.PI - 0.06, bandH * 1.4,
        warmTone(60 + t * 40), 0.1 * (0.3 + fade * 0.7), 6);
    }
  }

  // shed debris drifting downwind of the tower
  for (let d = 0; d < 90; d += 1) {
    const t = rand(seed, 18000 + d * 4);
    const y = footY - t * (footY - topY);
    const away = rand(seed, 18001 + d * 4);
    const x = footX + lean * (footY - y)
      + windDir * (baseHalf * (1 - t * 0.58) + away * away * base * 0.2);
    ctx.fillStyle = rgba(BONE, 0.03 + rand(seed, 18002 + d * 4) * 0.1);
    ctx.fillRect(x, y, 1.1, 1.1);
  }

  // the ember seam: one glowing fracture partway up
  const seamY = footY - seamT * (footY - topY);
  const seamX = footX + lean * (footY - seamY);
  const seamHalf = baseHalf * (1 - seamT * 0.58);
  ctx.globalCompositeOperation = "lighter";
  const seam = ctx.createRadialGradient(seamX, seamY, 0, seamX, seamY, seamHalf * 2.6);
  seam.addColorStop(0, rgba(ember, 0.32));
  seam.addColorStop(0.5, rgba(ember, 0.1));
  seam.addColorStop(1, rgba(ember, 0));
  ctx.fillStyle = seam;
  ctx.fillRect(seamX - seamHalf * 2.6, seamY - seamHalf * 2.6, seamHalf * 5.2, seamHalf * 5.2);
  ctx.strokeStyle = "rgba(255,236,208,0.6)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let i = 0; i <= 16; i += 1) {
    const u = i / 16;
    const x = seamX - seamHalf + u * seamHalf * 2;
    const y = seamY + (fbm(seed, 190, u * 7.7, 0.3) - 0.5) * bandH * 2.6;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // haze swallowing the summit
  const hazeY = topY + (footY - topY) * 0.12;
  const hazeX = footX + lean * (footY - hazeY);
  const haze = ctx.createRadialGradient(hazeX, hazeY, 0, hazeX, hazeY, base * 0.5);
  haze.addColorStop(0, "rgba(96,82,64,0.2)");
  haze.addColorStop(1, "rgba(96,82,64,0)");
  ctx.fillStyle = haze;
  ctx.fillRect(hazeX - base * 0.5, hazeY - base * 0.5, base, base);
  ctx.restore();
}

/* A horizon of layered atmospheric bands with wind-dragged texture. Large
   gesture: the tilted line and its low glow. Mid rhythm: the stacked bands.
   Fine detail: thousands of drag strokes and slanting ashfall flecks. */
function drawAshfallHorizon(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const base = Math.min(width, height);
  const ember = ((palette && palette.fluid) || [[228, 150, 92]])[0];
  const tilt = (rand(seed, 1001) - 0.5) * 0.15; // the horizon tilts
  const horizonY = height * (0.46 + rand(seed, 1002) * 0.2);
  const ext = Math.hypot(width, height) * 0.62;
  const gust = (tick % 80000) * 0.00009;
  ctx.translate(width / 2, horizonY);
  ctx.rotate(tilt);
  ctx.lineCap = "round";
  ctx.globalCompositeOperation = "source-over";

  // the land: a deep translucent mass below the line
  const land = ctx.createLinearGradient(0, 0, 0, ext);
  land.addColorStop(0, "rgba(16,13,11,0.55)");
  land.addColorStop(1, "rgba(30,24,19,0.35)");
  ctx.fillStyle = land;
  ctx.fillRect(-ext, 0, ext * 2, ext);

  // stacked sky bands, glow decaying with height
  const bandsN = 13 + Math.floor(rand(seed, 1003) * 8);
  let yTop = 0;
  for (let i = 0; i < bandsN; i += 1) {
    const gap = base * (0.02 + i * 0.004 + rand(seed, 51000 + i * 11) * 0.03);
    const y0 = yTop - gap;
    const glow = Math.exp(-i / 4.2);
    const tone = i % 2 === 0 ? [98, 94, 90] : warmTone(88);
    ctx.fillStyle = rgba(tone, 0.05 + glow * 0.13 + rand(seed, 51001 + i * 11) * 0.04);
    ctx.fillRect(-ext, y0, ext * 2, gap);
    const strokes = 34 + Math.floor(rand(seed, 51002 + i * 11) * 60);
    for (let s = 0; s < strokes; s += 1) {
      const blk = 52000 + i * 541 + s * 5;
      const sx = -ext + rand(seed, blk) * ext * 2;
      const sy = y0 + rand(seed, blk + 1) * gap + Math.sin(sx * 0.013 + gust + i) * gap * 0.18;
      const len = base * (0.06 + rand(seed, blk + 2) * 0.34) * (0.5 + glow);
      const bright = rand(seed, blk + 3);
      ctx.strokeStyle = bright > 0.86
        ? rgba(BONE, 0.05 + glow * 0.1)
        : rgba(tone, 0.028 + bright * 0.05 + glow * 0.035);
      ctx.lineWidth = 0.65 + bright * 0.8;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + len * 0.5, sy + (rand(seed, blk + 4) - 0.5) * 2.4,
        sx + len, sy + (rand(seed, blk + 4) - 0.5) * 3);
      ctx.stroke();
    }
    yTop = y0;
  }

  // one low ember glow sitting on the line
  ctx.globalCompositeOperation = "lighter";
  const gx = (rand(seed, 1004) - 0.5) * width * 0.5;
  const gr = base * (0.3 + rand(seed, 1005) * 0.2);
  const glowGrad = ctx.createRadialGradient(gx, 0, 0, gx, 0, gr);
  glowGrad.addColorStop(0, rgba(ember, 0.22));
  glowGrad.addColorStop(1, rgba(ember, 0));
  ctx.fillStyle = glowGrad;
  ctx.fillRect(gx - gr, -gr, gr * 2, gr * 2);

  // silhouetted shards standing on the horizon
  ctx.globalCompositeOperation = "source-over";
  const shardN = 3 + Math.floor(rand(seed, 1006) * 5);
  for (let s = 0; s < shardN; s += 1) {
    const x = (rand(seed, 68000 + s * 11) - 0.5) * width * 0.9;
    const h = base * (0.02 + rand(seed, 68001 + s * 11) * 0.09);
    const w = h * (0.16 + rand(seed, 68002 + s * 11) * 0.3);
    ctx.fillStyle = "rgba(12,10,9,0.85)";
    ctx.beginPath();
    ctx.moveTo(x - w, 1);
    ctx.lineTo(x + (rand(seed, 68003 + s * 11) - 0.5) * w, -h);
    ctx.lineTo(x + w, 1);
    ctx.closePath();
    ctx.fill();
  }

  // pull marks across the land
  for (let s = 0; s < 130; s += 1) {
    const sx = -ext + rand(seed, 64000 + s * 7) * ext * 2;
    const sy = rand(seed, 64001 + s * 7) ** 2 * ext * 0.5 + 2;
    const len = base * (0.04 + rand(seed, 64002 + s * 7) * 0.22);
    ctx.strokeStyle = rgba(warmTone(40 + rand(seed, 64003 + s * 7) * 26), 0.06);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + len, sy + len * 0.02);
    ctx.stroke();
  }

  // ashfall slanting with the wind
  const slant = 0.2 + rand(seed, 1007) * 0.5;
  for (let d = 0; d < 240; d += 1) {
    const x = -ext + rand(seed, 66000 + d * 5) * ext * 2;
    const y = -(rand(seed, 66001 + d * 5) ** 1.6) * base * 0.8;
    const l = 1.5 + rand(seed, 66002 + d * 5) * 4.5;
    ctx.strokeStyle = rgba(ASH, 0.05 + rand(seed, 66003 + d * 5) * 0.09);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + l, y + l * slant);
    ctx.stroke();
  }
  ctx.restore();
}

// One arch of the colonnade: ribbed bone ring, tapered piers, foot shadows.
// A broken arch keeps an angular gap and scatters chips on the floor.
function archOssuary(ctx, seed, salt, cx, cy, R, ringW, legLen, hazeA, isBroken, breathe) {
  const rIn = R - ringW;
  const gapA = Math.PI * (1.18 + rand(seed, salt) * 0.5);
  const gapW = 0.32 + rand(seed, salt + 1) * 0.3;
  const steps = Math.max(26, Math.floor(R * 0.55));
  for (let s = 0; s <= steps; s += 1) {
    const a = Math.PI + (s / steps) * Math.PI;
    if (isBroken && a > gapA && a < gapA + gapW) continue;
    const lit = 0.35 + 0.65 * Math.max(0, -Math.cos(a + 0.5));
    const wob = 1 + (vnoise(seed, salt + 2, a * 3.1, breathe) - 0.5) * 0.1;
    const bright = lit * (0.3 + rand(seed, salt + 10 + s * 5) * 0.5);
    ctx.strokeStyle = rgba(BONE, (0.1 + bright * 0.5) * hazeA);
    ctx.lineWidth = 0.9 + rand(seed, salt + 11 + s * 5) * 1.4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * rIn * wob, cy + Math.sin(a) * rIn * wob);
    ctx.lineTo(cx + Math.cos(a) * R * wob, cy + Math.sin(a) * R * wob);
    ctx.stroke();
  }
  // rims binding the ribs into a mass
  const rimPass = (rr, alpha, lw) => {
    ctx.strokeStyle = rgba(BONE, alpha * hazeA);
    ctx.lineWidth = lw;
    if (isBroken) {
      ctx.beginPath();
      ctx.arc(cx, cy, rr, Math.PI, gapA);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, rr, gapA + gapW, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, rr, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
  };
  rimPass(R, 0.34, 1.2);
  rimPass(rIn, 0.2, 0.8);
  // piers descending from the ring ends
  for (let p = 0; p < 2; p += 1) {
    const sgn = p === 0 ? -1 : 1;
    const px = cx + sgn * (R - ringW * 0.5);
    for (let v = 0; v < 14; v += 1) {
      const u = v / 13;
      const wv = ringW * (0.55 + u * 0.5);
      const lum = 120 + rand(seed, salt + 500 + p * 90 + v * 5) * 60 - u * 46;
      ctx.fillStyle = rgba([
        Math.round(lum * 1.02), Math.round(lum * 0.96), Math.round(lum * 0.84),
      ], 0.5 * hazeA);
      ctx.fillRect(px - wv * 0.5, cy + u * legLen, wv, legLen / 13 + 0.6);
    }
    ctx.fillStyle = rgba([8, 7, 6], 0.4 * hazeA);
    ctx.beginPath();
    ctx.ellipse(px, cy + legLen + 1.5, ringW * 1.3, ringW * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // fallen chips beneath the break
  if (isBroken) {
    const gx = cx + Math.cos(gapA + gapW * 0.5) * (R - ringW * 0.5);
    const gy = cy + legLen * 0.9;
    for (let f = 0; f < 8; f += 1) {
      const fx = gx + (rand(seed, salt + 700 + f * 9) - 0.5) * R * 0.5;
      const fy = gy + rand(seed, salt + 701 + f * 9) * ringW * 1.6;
      const fr = 1 + rand(seed, salt + 702 + f * 9) * ringW * 0.32;
      ctx.fillStyle = rgba(BONE, 0.4 * hazeA);
      ctx.beginPath();
      ctx.moveTo(fx - fr, fy + fr * 0.5);
      ctx.lineTo(fx + (rand(seed, salt + 703 + f * 9) - 0.5) * fr, fy - fr);
      ctx.lineTo(fx + fr, fy + fr * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/* A colonnade of bone-like arches receding toward a luminous fog. Large
   gesture: the perspective march. Mid rhythm: ring after ribbed ring. Fine
   detail: striations, floor drags, chips. The authored mark: one broken arch. */
function drawOssuaryColonnade(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const base = Math.min(width, height);
  const ember = ((palette && palette.fluid) || [[230, 168, 104]])[0];
  const vx = width * (0.32 + rand(seed, 2001) * 0.36);
  const vy = height * (0.4 + rand(seed, 2002) * 0.18);
  const c0x = width * (0.5 + (rand(seed, 2003) - 0.5) * 0.24);
  const c0y = height * (0.6 + rand(seed, 2004) * 0.12);
  const R0 = base * (0.34 + rand(seed, 2005) * 0.14);
  const k = 0.7 + rand(seed, 2006) * 0.08;
  const n = 6 + Math.floor(rand(seed, 2007) * 3);
  const broken = 1 + Math.floor(rand(seed, 2008) * (n - 2));
  const breathe = (tick % 70000) * 0.00007;

  // the fog the corridor recedes into
  ctx.globalCompositeOperation = "lighter";
  const fog = ctx.createRadialGradient(vx, vy, 0, vx, vy, base * 0.4);
  fog.addColorStop(0, rgba(ember, 0.16));
  fog.addColorStop(0.6, "rgba(120,100,80,0.07)");
  fog.addColorStop(1, "rgba(120,100,80,0)");
  ctx.fillStyle = fog;
  ctx.fillRect(vx - base * 0.4, vy - base * 0.4, base * 0.8, base * 0.8);
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "round";

  // floor drags converging on the vanishing point
  for (let f = 0; f < 30; f += 1) {
    const bx = width * rand(seed, 80000 + f * 7);
    const t0 = 0.35 + rand(seed, 80001 + f * 7) * 0.4;
    const t1 = t0 + 0.1 + rand(seed, 80002 + f * 7) * 0.3;
    ctx.strokeStyle = rgba(warmTone(52), 0.05 + rand(seed, 80003 + f * 7) * 0.05);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(vx + (bx - vx) * t0, vy + (height + 8 - vy) * t0);
    ctx.lineTo(vx + (bx - vx) * t1, vy + (height + 8 - vy) * t1);
    ctx.stroke();
  }

  // arches back to front, a breath of warm haze between each
  for (let i = n - 1; i >= 0; i -= 1) {
    const f = Math.pow(k, i);
    const cx = vx + (c0x - vx) * f;
    const cy = vy + (c0y - vy) * f;
    const R = R0 * f;
    const hazeA = clamp(1 - (1 - f) * 0.85, 0.18, 1);
    ctx.fillStyle = "rgba(58,48,38,0.04)";
    ctx.fillRect(0, 0, width, height);
    archOssuary(ctx, seed, 70000 + i * 900, cx, cy, R,
      R * (0.16 + rand(seed, 2010 + i) * 0.07),
      R * (0.55 + rand(seed, 2020 + i) * 0.35),
      hazeA, i === broken, breathe);
  }
  ctx.restore();
}

/* A buried colossus reading as terrain, the form suggested by contour shading
   only. Large gesture: the swells along a diagonal spine. Mid rhythm: hidden-
   line contour slices. Fine detail: dry gaps, crest dust. The authored mark:
   one contour that smoulders. */
function drawBuriedColossus(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const base = Math.min(width, height);
  const ember = ((palette && palette.fluid) || [[232, 150, 88]])[0];
  const sx0 = width * (0.06 + rand(seed, 3001) * 0.14);
  const sy0 = height * (0.62 + rand(seed, 3002) * 0.18);
  const sx1 = width * (0.72 + rand(seed, 3003) * 0.22);
  const sy1 = height * (0.5 + rand(seed, 3004) * 0.2);
  const bn = 4 + Math.floor(rand(seed, 3005) * 3);
  const big = Math.floor(rand(seed, 3006) * bn); // the shoulder swell
  const bumps = [];
  for (let i = 0; i < bn; i += 1) {
    const t = i / (bn - 1);
    const g = i === big ? 1 : 0;
    bumps.push({
      x: sx0 + (sx1 - sx0) * t + (rand(seed, 3010 + i * 7) - 0.5) * width * 0.08,
      z: sy0 + (sy1 - sy0) * t + (rand(seed, 3011 + i * 7) - 0.5) * height * 0.1,
      rx: base * (0.1 + rand(seed, 3012 + i * 7) * 0.12) * (1 + g * 0.7),
      rz: base * (0.06 + rand(seed, 3013 + i * 7) * 0.07) * (1 + g * 0.4),
      amp: base * (0.06 + rand(seed, 3014 + i * 7) * 0.08) * (1 + g * 0.9),
    });
  }
  const elev = (x, zy) => {
    let e = 0;
    for (let i = 0; i < bumps.length; i += 1) {
      const b = bumps[i];
      const dx2 = (x - b.x) / b.rx;
      const dz = (zy - b.z) / b.rz;
      const q = dx2 * dx2 + dz * dz;
      if (q < 9) e += b.amp * Math.exp(-q);
    }
    return e;
  };

  // tonal mass beneath the lines, so the form is shadow before it is contour
  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < bumps.length; i += 1) {
    const b = bumps[i];
    const cy2 = b.z - b.amp * 0.5;
    const g = ctx.createRadialGradient(b.x, cy2, 0, b.x, cy2, b.rx * 1.7);
    g.addColorStop(0, "rgba(46,38,30,0.34)");
    g.addColorStop(1, "rgba(46,38,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(b.x - b.rx * 1.7, cy2 - b.rx * 1.7, b.rx * 3.4, b.rx * 3.4);
  }

  const rows = 52;
  const nearZ = height;
  const farZ = height * 0.3;
  const dx = Math.max(2, Math.round(width / 170));
  const cols = Math.floor(width / dx) + 2;
  const sky = new Float32Array(cols).fill(1e9);
  const ys = new Float32Array(cols);
  const emberRow = Math.floor(rows * 0.28) + Math.floor(rand(seed, 3007) * rows * 0.34);
  const ripple = (tick % 60000) * 0.0001;
  let emberX = 0;
  let emberY = 1e9;
  ctx.lineCap = "round";
  for (let r = 0; r < rows; r += 1) {
    const zr = r / (rows - 1);
    const zy = nearZ - zr * (nearZ - farZ);
    const persp = 1 - zr * 0.3;
    const isEmber = r === emberRow;
    for (let c = 0; c < cols; c += 1) {
      const x = c * dx;
      ys[c] = zy - elev(x, zy) * persp
        - (vnoise(seed, 81000, x * 0.02, zy * 0.03 + ripple) - 0.5) * base * 0.016;
    }
    // stroke in 4-column runs sharing one style, so a row costs dozens of
    // strokes rather than hundreds; hidden-line breaks become subpaths
    for (let c = 0; c < cols - 1; c += 4) {
      const end = Math.min(cols - 1, c + 4);
      const slope = (ys[end] - ys[c]) / ((end - c) * dx);
      const elevN = clamp((zy - ys[c]) / (base * 0.24), 0, 1);
      const lit = clamp(0.55 - slope * 1.9, 0.06, 1);
      if (rand(seed, 82000 + r * 40 + (c >> 3)) < 0.08 && elevN < 0.25) continue;
      const hot = isEmber && elevN > 0.15;
      const a = hot ? 0.5 : (0.045 + elevN * 0.42) * lit + 0.03;
      ctx.strokeStyle = hot ? rgba(ember, a) : rgba(BONE, a);
      ctx.lineWidth = hot ? 1.3 : 0.75 + elevN * 0.7;
      ctx.beginPath();
      let open = false;
      let drew = 0;
      for (let q = c; q < end; q += 1) {
        if (ys[q] < sky[q] - 0.35 && ys[q + 1] < sky[q + 1] - 0.35) {
          if (!open) { ctx.moveTo(q * dx, ys[q]); open = true; }
          ctx.lineTo((q + 1) * dx, ys[q + 1]);
          drew += 1;
          if (hot && ys[q] < emberY) {
            emberY = ys[q];
            emberX = q * dx;
          }
        } else {
          open = false;
        }
      }
      if (drew > 0) ctx.stroke();
    }
    for (let c = 0; c < cols; c += 1) if (ys[c] < sky[c]) sky[c] = ys[c];
  }

  // dust lifting off the crest, and the smoulder bloom
  ctx.globalCompositeOperation = "lighter";
  for (let d = 0; d < 110; d += 1) {
    const c = Math.floor(rand(seed, 85000 + d * 5) * (cols - 1));
    if (sky[c] > 1e8) continue;
    const y = sky[c] - rand(seed, 85001 + d * 5) ** 2 * base * 0.14 - 1;
    ctx.fillStyle = rgba(BONE, 0.04 + rand(seed, 85002 + d * 5) * 0.08);
    ctx.fillRect(c * dx, y, 1, 1);
  }
  if (emberY < 1e8) {
    const bloom = ctx.createRadialGradient(emberX, emberY, 0, emberX, emberY, base * 0.11);
    bloom.addColorStop(0, rgba(ember, 0.3));
    bloom.addColorStop(1, rgba(ember, 0));
    ctx.fillStyle = bloom;
    ctx.fillRect(emberX - base * 0.11, emberY - base * 0.11, base * 0.22, base * 0.22);
  }
  ctx.restore();
}

/* Drift-veils of particulate light falling across a void. Large gesture: the
   curtains' sweep. Mid rhythm: clumping density waves. Fine detail: each streak
   its own hairline. The authored marks: one veil bent hard by wind, one mote
   falling with a long trail. */
function drawMourningVeils(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const base = Math.min(width, height);
  const tones = (palette && palette.fluid) || [[190, 210, 255], [255, 200, 150], [200, 160, 255]];
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  const veils = 4 + Math.floor(rand(seed, 4001) * 3);
  const bent = Math.floor(rand(seed, 4002) * veils);
  const sway = (tick % 80000) * 0.00008;
  for (let v = 0; v < veils; v += 1) {
    const x0 = width * (0.08 + rand(seed, 4010 + v * 13) * 0.84);
    const driftX = (rand(seed, 4011 + v * 13) - 0.5) * width * 0.4;
    const bendK = v === bent ? 1 : 0.25;
    const cxq = x0 + driftX * 0.5 + Math.sin(sway + v * 2.1) * base * 0.04
      + (rand(seed, 4012 + v * 13) - 0.5) * width * 0.5 * bendK;
    const x1 = x0 + driftX;
    const wdt = base * (0.05 + rand(seed, 4013 + v * 13) * 0.09);
    const waveF = 3 + rand(seed, 4014 + v * 13) * 5;
    const count = 700 + Math.floor(rand(seed, 4015 + v * 13) * 500);
    const toneV = tones[v % tones.length];
    // the gauze itself: a wide translucent curtain behind the particulate,
    // so each veil reads as cloth catching light, not scattered dust
    ctx.strokeStyle = rgba([214, 208, 196], 0.05);
    ctx.lineWidth = wdt * 2.4;
    ctx.beginPath();
    ctx.moveTo(x0, -8);
    ctx.quadraticCurveTo(cxq, height * 0.5, x1, height + 8);
    ctx.stroke();
    for (let p = 0; p < count; p += 1) {
      const blk = 90000 + v * 3900 + p * 6;
      const t = rand(seed, blk);
      const clump = 0.55 + 0.45 * Math.sin(t * waveF * Math.PI + v);
      if (rand(seed, blk + 1) > clump) continue;
      const omt = 1 - t;
      const bx = omt * omt * x0 + 2 * omt * t * cxq + t * t * x1;
      const by = t * (height + 14) - 7;
      const tx = 2 * (omt * (cxq - x0) + t * (x1 - cxq));
      const lat = rand(seed, blk + 2) + rand(seed, blk + 3) - 1;
      const px = bx + lat * wdt * (1 + t * 0.6);
      const len = 2.5 + rand(seed, blk + 4) * 8;
      const ang = Math.atan2(height + 14, tx);
      const bright = rand(seed, blk + 5);
      const a = (bright > 0.9 ? 0.3 : 0.1 + bright * 0.12) * clump;
      ctx.strokeStyle = bright > 0.9
        ? rgba([236, 232, 222], a)
        : rgba(toneV, a * 0.55);
      ctx.lineWidth = 0.8 + bright * 0.9;
      ctx.beginPath();
      ctx.moveTo(px, by);
      ctx.lineTo(px + Math.cos(ang) * len * 0.25, by + Math.sin(ang) * len);
      ctx.stroke();
    }
  }

  // bright motes riding the veils
  const motes = 8 + Math.floor(rand(seed, 4003) * 7);
  for (let m = 0; m < motes; m += 1) {
    const mx = width * rand(seed, 111000 + m * 9);
    const my = height * rand(seed, 111001 + m * 9);
    const mr = 4 + rand(seed, 111002 + m * 9) * 7;
    const toneM = tones[m % tones.length];
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
    g.addColorStop(0, "rgba(255,250,240,0.5)");
    g.addColorStop(0.4, rgba(toneM, 0.16));
    g.addColorStop(1, rgba(toneM, 0));
    ctx.fillStyle = g;
    ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    ctx.fillStyle = "rgba(255,252,244,0.75)";
    ctx.fillRect(mx - 0.8, my - 0.8, 1.6, 1.6);
  }
  // one mote falls with a long trail
  const fm = Math.floor(rand(seed, 4004) * motes);
  const fx = width * rand(seed, 111000 + fm * 9);
  const fy = height * rand(seed, 111001 + fm * 9);
  const trail = base * (0.1 + rand(seed, 4005) * 0.12);
  const tg = ctx.createLinearGradient(fx, fy - trail, fx, fy);
  tg.addColorStop(0, "rgba(240,236,226,0)");
  tg.addColorStop(1, "rgba(240,236,226,0.55)");
  ctx.strokeStyle = tg;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fx + trail * 0.06, fy - trail);
  ctx.lineTo(fx, fy);
  ctx.stroke();

  // faint drift piles where each veil meets the ground
  for (let v = 0; v < veils; v += 1) {
    const x1 = width * (0.08 + rand(seed, 4010 + v * 13) * 0.84)
      + (rand(seed, 4011 + v * 13) - 0.5) * width * 0.4;
    for (let d = 0; d < 46; d += 1) {
      const blk = 115000 + v * 300 + d * 5;
      const off = (rand(seed, blk) + rand(seed, blk + 1) - 1) * base * 0.12;
      const y = height - Math.abs(off) * 0.35 - rand(seed, blk + 2) * 4;
      ctx.fillStyle = "rgba(224,220,210,0.07)";
      ctx.fillRect(clamp(x1 + off, 0, width), y, 1.2, 1.2);
    }
  }
  ctx.restore();
}

// One eroded monolith slab: noisy-edged silhouette, rim light on the side
// facing the aperture, bright chips where the edge catches the glow.
function slabMonolith(ctx, seed, salt, sx, topY, w, height, lean, ox, oy, R) {
  const footY = height + 8;
  const hgt = footY - topY;
  const n = 12;
  const left = [];
  const right = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const y = topY + t * hgt;
    const cx = sx + lean * (1 - t) * hgt;
    left.push([cx - w * 0.5 + (vnoise(seed, salt, 0.5, t * 6.2) - 0.5) * w * 0.5, y]);
    right.push([cx + w * 0.5 + (vnoise(seed, salt + 1, 3.5, t * 6.2) - 0.5) * w * 0.5, y]);
  }
  ctx.fillStyle = rgba(warmTone(15 + rand(seed, salt + 2) * 9), 0.92);
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  ctx.lineTo((left[0][0] + right[0][0]) / 2 + (rand(seed, salt + 3) - 0.5) * w * 0.4,
    topY - w * (0.2 + rand(seed, salt + 4) * 0.5));
  ctx.lineTo(right[0][0], right[0][1]);
  for (let i = 1; i <= n; i += 1) ctx.lineTo(right[i][0], right[i][1]);
  ctx.lineTo(left[n][0], left[n][1]);
  for (let i = n - 1; i >= 0; i -= 1) ctx.lineTo(left[i][0], left[i][1]);
  ctx.closePath();
  ctx.fill();
  const facing = ox > sx ? right : left;
  ctx.lineCap = "round";
  for (let i = 0; i < n; i += 1) {
    const midY = (facing[i][1] + facing[i + 1][1]) / 2;
    const d = Math.hypot(facing[i][0] - ox, midY - oy);
    const a = clamp(0.66 - d / (R * 5), 0, 0.6) * (0.5 + rand(seed, salt + 20 + i) * 0.5);
    if (a < 0.02) continue;
    ctx.strokeStyle = rgba([244, 232, 208], a);
    ctx.lineWidth = 1 + a;
    ctx.beginPath();
    ctx.moveTo(facing[i][0], facing[i][1]);
    ctx.lineTo(facing[i + 1][0], facing[i + 1][1]);
    ctx.stroke();
  }
  for (let c = 0; c < 3; c += 1) {
    const idx = clamp(Math.floor(rand(seed, salt + 40 + c * 3) * n), 0, n - 1);
    const d = Math.hypot(facing[idx][0] - ox, facing[idx][1] - oy);
    const a = clamp(0.5 - d / (R * 5), 0, 0.4);
    if (a < 0.03) continue;
    ctx.fillStyle = rgba([246, 236, 214], a + rand(seed, salt + 41 + c * 3) * 0.2);
    ctx.fillRect(facing[idx][0] - 0.8, facing[idx][1] - 0.8, 1.6, 1.6);
  }
}

/* A dim luminous aperture low in haze behind eroded monoliths. Large gesture:
   disc and slabs. Mid rhythm: haze drags smearing the light. Fine detail:
   motes, rim chips, a halo ring. The authored mark: one slab leans, and the
   gap beside it lets a shaft of light through. */
function drawPaleAperture(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const base = Math.min(width, height);
  const ember = ((palette && palette.fluid) || [[236, 168, 100]])[0];
  const ox = width * (0.3 + rand(seed, 5001) * 0.4);
  const oy = height * (0.3 + rand(seed, 5002) * 0.24);
  const R = base * (0.15 + rand(seed, 5003) * 0.11);
  const flick = (tick % 50000) * 0.00013;

  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(ox, oy, 0, ox, oy, R * 3.1);
  glow.addColorStop(0, "rgba(244,234,214,0.34)");
  glow.addColorStop(0.32, rgba(ember, 0.14));
  glow.addColorStop(1, rgba(ember, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(ox - R * 3.1, oy - R * 3.1, R * 6.2, R * 6.2);
  ctx.fillStyle = "rgba(240,230,210,0.28)";
  ctx.beginPath();
  ctx.arc(ox, oy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(246,238,220,0.12)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(ox, oy, R * (1.42 + Math.sin(flick) * 0.02), 0, Math.PI * 2);
  ctx.stroke();

  // wind-torn haze dragged across the disc
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "round";
  const dragTilt = (rand(seed, 5004) - 0.5) * 0.1;
  const drags = 30 + Math.floor(rand(seed, 5005) * 14);
  for (let h = 0; h < drags; h += 1) {
    const blk = 126000 + h * 9;
    const hy = oy + (rand(seed, blk) + rand(seed, blk + 1) - 1) * R * 1.7;
    const hw = R * (1.4 + rand(seed, blk + 2) * 2.4);
    const hx = ox - hw * (0.3 + rand(seed, blk + 3) * 0.55);
    ctx.strokeStyle = rand(seed, blk + 4) < 0.75
      ? rgba(warmTone(22 + rand(seed, blk + 5) * 16), 0.13 + rand(seed, blk + 6) * 0.16)
      : "rgba(226,216,196,0.07)";
    ctx.lineWidth = 1.4 + rand(seed, blk + 7) * 3.6;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.quadraticCurveTo(hx + hw * 0.5, hy + hw * dragTilt * 0.5 + (rand(seed, blk + 8) - 0.5) * 3,
      hx + hw, hy + hw * dragTilt);
    ctx.stroke();
  }

  // motes suspended in the glow, and a faint pool of light on the ground
  ctx.globalCompositeOperation = "lighter";
  for (let m = 0; m < 80; m += 1) {
    const a = rand(seed, 128000 + m * 5) * Math.PI * 2;
    const rr = R * (0.2 + rand(seed, 128001 + m * 5) ** 0.6 * 2.6);
    ctx.fillStyle = rgba([238, 230, 214], 0.04 + rand(seed, 128002 + m * 5) * 0.1);
    ctx.fillRect(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr * 0.8, 1.1, 1.1);
  }
  ctx.fillStyle = "rgba(220,208,188,0.08)";
  ctx.beginPath();
  ctx.ellipse(ox, height * (0.9 + rand(seed, 5006) * 0.06), R * 1.9, R * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // the monoliths, one leaning; the shaft falls in the gap beside it
  ctx.globalCompositeOperation = "source-over";
  const slabs = 3 + Math.floor(rand(seed, 5007) * 3);
  const leanIdx = Math.floor(rand(seed, 5008) * slabs);
  const gapIdx = Math.floor(rand(seed, 5009) * (slabs - 1));
  const spread = width * 0.86;
  const sxArr = [];
  for (let s = 0; s < slabs; s += 1) {
    const salt = 120000 + s * 700;
    const sx = width * 0.07 + spread * ((s + 0.5) / slabs)
      + (rand(seed, salt) - 0.5) * (spread / slabs) * 0.5;
    sxArr.push(sx);
    const sw = base * (0.05 + rand(seed, salt + 1) * 0.085);
    const topY = oy - R * (0.9 - rand(seed, salt + 2) * 1.7);
    const leanA = s === leanIdx
      ? (rand(seed, salt + 3) < 0.5 ? -1 : 1) * (0.07 + rand(seed, salt + 4) * 0.06)
      : (rand(seed, salt + 4) - 0.5) * 0.02;
    slabMonolith(ctx, seed, salt + 10, sx, topY, sw, height, leanA, ox, oy, R);
  }
  ctx.globalCompositeOperation = "lighter";
  const shaftX = (sxArr[gapIdx] + sxArr[gapIdx + 1]) / 2 + (rand(seed, 5010) - 0.5) * 8;
  const shaftTop = oy - R * 2.2;
  const shaft = ctx.createLinearGradient(0, shaftTop, 0, height);
  shaft.addColorStop(0, "rgba(244,234,214,0)");
  shaft.addColorStop(0.45, rgba(ember, 0.2));
  shaft.addColorStop(1, "rgba(244,234,214,0.02)");
  ctx.fillStyle = shaft;
  const shaftW = 2.5 + rand(seed, 5011) * 4;
  ctx.fillRect(shaftX - shaftW / 2, shaftTop, shaftW, height - shaftTop);
  ctx.restore();
}

export const WAVE8_MONUMENT = {
  "strata-monolith": drawStrataMonolith,
  "ashfall-horizon": drawAshfallHorizon,
  "ossuary-colonnade": drawOssuaryColonnade,
  "buried-colossus": drawBuriedColossus,
  "mourning-veils": drawMourningVeils,
  "pale-aperture": drawPaleAperture,
};

export const WAVE8_MONUMENT_META = [
  { name: "strata-monolith", family: "dark-monument", blurb: "an eroded tower of strata leans off-centre, shedding dust, one ember seam splitting it" },
  { name: "ashfall-horizon", family: "dark-monument", blurb: "a tilted horizon of ash and umber bands, wind-dragged, one low ember glow on the line" },
  { name: "ossuary-colonnade", family: "dark-monument", blurb: "bone-pale arches recede into warm fog, ribbed and rim-lit, one arch broken mid-span" },
  { name: "buried-colossus", family: "dark-monument", blurb: "contour slices raise a sleeping mass from the plain, one ridge line smoulders" },
  { name: "mourning-veils", family: "dark-monument", blurb: "curtains of falling particulate light drift across the void, one veil bent by wind" },
  { name: "pale-aperture", family: "dark-monument", blurb: "a dim disc low in dragged haze behind eroded monoliths, one gap letting light through" },
];
