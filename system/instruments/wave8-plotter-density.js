// wave8-plotter-density.js — r/PlotterArt single-pen density: one ink per
// piece, tone carried only by spacing, weight, and direction. Every mark is a
// stroke a pen could make. First-party, seed-derived, no assets.
//
// Reference space: width/height arrive with the short edge ~300 units, so all
// absolute constants below are authored against that scale.

function rand(seed, salt) {
  let x = Math.imul(seed ^ Math.imul(salt + 1013904223, 1664525), 2246822519);
  x ^= x >>> 13;
  x = Math.imul(x, 3266489917);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

// One ink per piece. palette.fluid tones give the pen its colour when the
// plate has one; the runtime alignment wrapper snaps chroma to the plate hues
// and lets the neutral inks pass untouched.
function penInk(palette, idx, alpha) {
  const tones = (palette && palette.fluid) || [[132, 245, 255], [167, 115, 255], [239, 171, 48]];
  const t = tones[idx % tones.length] || [226, 232, 224];
  return `rgba(${t[0]},${t[1]},${t[2]},${alpha})`;
}

// Soft gaussian bumps: the hidden tonal ground the field instruments read.
function makeBlobs(seed, saltBase, count, width, height, base) {
  const blobs = [];
  for (let i = 0; i < count; i += 1) {
    blobs.push({
      x: width * (0.12 + rand(seed, saltBase + i * 7) * 0.76),
      y: height * (0.12 + rand(seed, saltBase + 1 + i * 7) * 0.76),
      r: base * (0.16 + rand(seed, saltBase + 2 + i * 7) * 0.22),
      w: 0.5 + rand(seed, saltBase + 3 + i * 7) * 0.7,
    });
  }
  return blobs;
}

function blobField(blobs, x, y) {
  let v = 0;
  for (let i = 0; i < blobs.length; i += 1) {
    const b = blobs[i];
    const dx = x - b.x;
    const dy = y - b.y;
    v += b.w * Math.exp(-(dx * dx + dy * dy) / (b.r * b.r));
  }
  return v;
}

/* One continuous Archimedean spiral; the pen never lifts. Line weight swells
   against a hidden tonal field (three soft blobs plus one crisp moon disc), so
   the whole picture lives in stroke width played against the groove pitch.
   Width changes are batched into runs so the path count stays low. */
function drawSpiralTone(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const base = Math.min(width, height);
  const cx = width * (0.42 + rand(seed, 8101) * 0.16);
  const cy = height * (0.42 + rand(seed, 8102) * 0.16);
  const stretch = clamp(width / height, 1, 1.3);
  const R = Math.min(base * (0.42 + rand(seed, 8103) * 0.06), (width * 0.46) / stretch);
  const pitch = base * (0.0105 + rand(seed, 8104) * 0.0025);
  const phase = ((tick % 4096) / 4096) * Math.PI * 2;
  // The tonal ground stays inside the spiral's reach so no swell is wasted.
  const blobs = [];
  for (let i = 0; i < 3; i += 1) {
    const a = rand(seed, 8110 + i * 5) * Math.PI * 2;
    const rr = R * (0.15 + rand(seed, 8111 + i * 5) * 0.75);
    blobs.push({
      x: cx + Math.cos(a) * rr * stretch,
      y: cy + Math.sin(a) * rr,
      r: R * (0.24 + rand(seed, 8112 + i * 5) * 0.3),
      w: 0.55 + rand(seed, 8113 + i * 5) * 0.65,
    });
  }
  const moonA = rand(seed, 8120) * Math.PI * 2;
  const moonD = R * (0.25 + rand(seed, 8121) * 0.5);
  const moonX = cx + Math.cos(moonA) * moonD * stretch;
  const moonY = cy + Math.sin(moonA) * moonD;
  const moonR = R * (0.2 + rand(seed, 8122) * 0.16);
  const minW = 0.3;
  const maxW = pitch * 0.85;
  const tone = (x, y) => {
    let v = 0.12 + blobField(blobs, x, y) * 0.42;
    const d = Math.hypot(x - moonX, y - moonY);
    if (d < moonR) v += 0.8 * (1 - Math.pow(d / moonR, 3));
    return clamp(v, 0, 1);
  };
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(233,237,231,0.82)";
  ctx.lineCap = "round";
  let theta = phase;
  let r = pitch * 0.75;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(theta) * r * stretch, cy + Math.sin(theta) * r);
  let curW = -1;
  while (r < R) {
    const dth = clamp(2.6 / r, 0.04, 0.9);
    theta += dth;
    r += pitch * (dth / (Math.PI * 2));
    const x = cx + Math.cos(theta) * r * stretch;
    const y = cy + Math.sin(theta) * r;
    const rim = clamp((R - r) / (pitch * 5), 0.18, 1);
    const w = (minW + tone(x, y) * (maxW - minW)) * rim;
    if (curW < 0) curW = w;
    if (Math.abs(w - curW) > 0.16) {
      ctx.lineWidth = curW;
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      curW = w;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.lineWidth = Math.max(curW, minW);
  ctx.stroke();
  ctx.restore();
}

/* A travelling-pen tour: seeded density clusters plus thin background scatter,
   every city visited once by a single greedy nearest-neighbour polyline. Tone
   is purely point density. One cluster is an annulus, so the tour orbits a
   void that reads as an eye; a pen-down dot marks where the walk began. */
function drawClusterTour(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const base = Math.min(width, height);
  const clusters = 4 + Math.floor(rand(seed, 8201) * 3);
  const ringIdx = Math.floor(rand(seed, 8202) * clusters);
  const px = [];
  const py = [];
  for (let c = 0; c < clusters; c += 1) {
    const ccx = width * (0.14 + rand(seed, 8210 + c * 17) * 0.72);
    const ccy = height * (0.16 + rand(seed, 8211 + c * 17) * 0.68);
    const rad = base * (0.09 + rand(seed, 8212 + c * 17) * 0.12);
    const squash = 0.8 + rand(seed, 8213 + c * 17) * 0.35;
    const n = 60 + Math.floor(rand(seed, 8214 + c * 17) * 60);
    for (let i = 0; i < n; i += 1) {
      const s = 8240000 + c * 9001 + i * 11;
      const a = rand(seed, s) * Math.PI * 2;
      const rr = c === ringIdx
        ? rad * (0.78 + rand(seed, s + 3) * 0.3)
        : rad * Math.pow(rand(seed, s + 3), 0.62);
      px.push(ccx + Math.cos(a) * rr);
      py.push(ccy + Math.sin(a) * rr * squash);
    }
  }
  const scatter = 50 + Math.floor(rand(seed, 8203) * 40);
  for (let i = 0; i < scatter; i += 1) {
    px.push(width * (0.05 + rand(seed, 8205000 + i * 7) * 0.9));
    py.push(height * (0.06 + rand(seed, 8205003 + i * 7) * 0.88));
  }
  const n = px.length;
  const used = new Uint8Array(n);
  // rand() is inclusive of 1.0, so clamp the derived index
  let cur = Math.min(n - 1, Math.floor(rand(seed, 8204) * n));
  used[cur] = 1;
  const order = [cur];
  for (let k = 1; k < n; k += 1) {
    let bi = -1;
    let bd = Infinity;
    const x = px[cur];
    const y = py[cur];
    for (let j = 0; j < n; j += 1) {
      if (used[j]) continue;
      const dx = px[j] - x;
      const dy = py[j] - y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; bi = j; }
    }
    used[bi] = 1;
    order.push(bi);
    cur = bi;
  }
  const ink = penInk(palette, 0, 0.75);
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 0.8;
  ctx.lineJoin = "round";
  // The cities themselves, stippled, so the density ground reads under the walk.
  for (let i = 0; i < n; i += 1) ctx.fillRect(px[i] - 0.45, py[i] - 0.45, 0.9, 0.9);
  ctx.beginPath();
  ctx.moveTo(px[order[0]], py[order[0]]);
  for (let k = 1; k < n; k += 1) ctx.lineTo(px[order[k]], py[order[k]]);
  ctx.stroke();
  // The pen-down mark: where the tour began.
  ctx.beginPath();
  ctx.arc(px[order[0]], py[order[0]], 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* Hatched isoline terrain: a coarse elevation grid quantised into bands, each
   band hatched at its own angle and its own gap, so the terraces turn against
   each other as the ground climbs. The lowest band is left as water with a few
   rippled horizontals; the shoreline gap between water and first terrace is
   the seam that makes the terrain read. */
function drawTerraceHatch(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const base = Math.min(width, height);
  const gw = 92;
  const gh = clamp(Math.round((gw * height) / width), 24, 64);
  const blobs = makeBlobs(seed, 8310, 4, width, height, base);
  const tiltA = rand(seed, 8301) * Math.PI * 2;
  const tx = Math.cos(tiltA) / width;
  const ty = Math.sin(tiltA) / height;
  const grid = new Float32Array(gw * gh);
  let lo = Infinity;
  let hi = -Infinity;
  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      const x = (gx / (gw - 1)) * width;
      const y = (gy / (gh - 1)) * height;
      const v = blobField(blobs, x, y) + (x * tx + y * ty) * 0.55;
      grid[gy * gw + gx] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const span = Math.max(1e-6, hi - lo);
  const sample = (x, y) => {
    const fx = clamp(x / width, 0, 1) * (gw - 1);
    const fy = clamp(y / height, 0, 1) * (gh - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(gw - 1, x0 + 1);
    const y1 = Math.min(gh - 1, y0 + 1);
    const ax = fx - x0;
    const ay = fy - y0;
    const v0 = grid[y0 * gw + x0] * (1 - ax) + grid[y0 * gw + x1] * ax;
    const v1 = grid[y1 * gw + x0] * (1 - ax) + grid[y1 * gw + x1] * ax;
    return (v0 * (1 - ay) + v1 * ay - lo) / span;
  };
  const bands = 6 + Math.floor(rand(seed, 8302) * 3);
  const a0 = rand(seed, 8303) * Math.PI;
  const da = 0.42 + rand(seed, 8304) * 0.22;
  const diag = Math.hypot(width, height);
  const cx = width / 2;
  const cy = height / 2;
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(224,229,223,0.7)";
  ctx.lineWidth = 0.8;
  ctx.lineCap = "butt";
  for (let b = 1; b < bands; b += 1) {
    const ang = a0 + b * da;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const nx = -dy;
    const ny = dx;
    const gap = 5.4 - (b / (bands - 1)) * 3.5;
    const t0 = b / bands;
    const t1 = (b + 1) / bands;
    ctx.beginPath();
    for (let o = -diag / 2; o <= diag / 2; o += gap) {
      const bx = cx + nx * o;
      const by = cy + ny * o;
      let open = false;
      for (let t = -diag / 2; t <= diag / 2; t += 3) {
        const x = bx + dx * t;
        const y = by + dy * t;
        let inBand = false;
        if (x >= 0 && x <= width && y >= 0 && y <= height) {
          const v = sample(x, y);
          inBand = v >= t0 && (b === bands - 1 ? v <= 1.0001 : v < t1);
        }
        if (inBand && !open) {
          ctx.moveTo(x, y);
          open = true;
        } else if (inBand) {
          ctx.lineTo(x, y);
        } else if (open) {
          open = false;
        }
      }
    }
    ctx.stroke();
  }
  // The water: sparse rippled horizontals in the lowest band only, pulled back
  // from the band edge so a dark shoreline seam survives.
  const lakeT = (1 / bands) * 0.9;
  const ripplePh = (tick % 6283) / 1000;
  ctx.beginPath();
  for (let y = 4; y < height; y += 7) {
    let open = false;
    for (let x = 0; x <= width; x += 3) {
      const v = sample(x, y);
      const yy = y + Math.sin(x * 0.05 + y * 0.6 + ripplePh) * 1.1;
      if (v < lakeT && !open) {
        ctx.moveTo(x, yy);
        open = true;
      } else if (v < lakeT) {
        ctx.lineTo(x, yy);
      } else if (open) {
        open = false;
      }
    }
  }
  ctx.stroke();
  ctx.restore();
}

/* A comb of short streamline dashes through a rotor field: hundreds of pen
   ticks that stay parallel to their neighbours because they all obey the same
   flow. Density follows a tonal mask, and one long hero thread runs the field
   end to end without lifting. */
function drawFlowComb(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const base = Math.min(width, height);
  const rotorN = 2 + Math.floor(rand(seed, 8401) * 2);
  const rotors = [];
  for (let i = 0; i < rotorN; i += 1) {
    rotors.push({
      x: width * (0.15 + rand(seed, 8410 + i * 13) * 0.7),
      y: height * (0.15 + rand(seed, 8411 + i * 13) * 0.7),
      r: base * (0.24 + rand(seed, 8412 + i * 13) * 0.3),
      s: (rand(seed, 8413 + i * 13) < 0.5 ? -1 : 1) * (0.9 + rand(seed, 8414 + i * 13) * 1.3),
    });
  }
  const drift = rand(seed, 8402) * Math.PI * 2 + ((tick % 6283) / 6283) * 0.5;
  const dvx = Math.cos(drift) * 0.5;
  const dvy = Math.sin(drift) * 0.5;
  const mask = makeBlobs(seed, 8420, 3, width, height, base);
  const v = [0, 0];
  const dir = (x, y) => {
    let vx = dvx;
    let vy = dvy;
    for (let i = 0; i < rotors.length; i += 1) {
      const ro = rotors[i];
      const rdx = x - ro.x;
      const rdy = y - ro.y;
      const d2 = rdx * rdx + rdy * rdy;
      const d = Math.sqrt(d2) + 1e-3;
      const w = ro.s * Math.exp(-d2 / (ro.r * ro.r));
      vx += (-rdy / d) * w;
      vy += (rdx / d) * w;
    }
    const len = Math.hypot(vx, vy) + 1e-6;
    v[0] = vx / len;
    v[1] = vy / len;
  };
  const ink = penInk(palette, 1, 0.7);
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.75;
  ctx.lineCap = "round";
  const g = base * 0.024;
  const cols = Math.ceil(width / g);
  const rows = Math.ceil(height / g);
  ctx.beginPath();
  for (let gy = 0; gy < rows; gy += 1) {
    for (let gx = 0; gx < cols; gx += 1) {
      const s = 8430 + (gy * 1021 + gx) * 7;
      let x = (gx + rand(seed, s)) * g;
      let y = (gy + rand(seed, s + 1)) * g;
      const p = clamp(0.1 + blobField(mask, x, y) * 0.5, 0, 0.9);
      if (rand(seed, s + 2) > p) continue;
      const steps = 7 + Math.floor(rand(seed, s + 3) * 7);
      ctx.moveTo(x, y);
      for (let k = 0; k < steps; k += 1) {
        dir(x, y);
        x += v[0] * 2.1;
        y += v[1] * 2.1;
        ctx.lineTo(x, y);
      }
    }
  }
  ctx.stroke();
  // The hero thread: one streamline the pen refuses to lift from.
  let hx = width * (0.1 + rand(seed, 8403) * 0.3);
  let hy = height * (0.15 + rand(seed, 8404) * 0.7);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  for (let k = 0; k < 260; k += 1) {
    dir(hx, hy);
    hx += v[0] * 2.3;
    hy += v[1] * 2.3;
    if (hx < -20 || hx > width + 20 || hy < -20 || hy > height + 20) break;
    ctx.lineTo(hx, hy);
  }
  ctx.stroke();
  ctx.restore();
}

/* A mark ladder: one tonal ramp, and the pen changes vocabulary as tone
   climbs: bare paper, stipple, short ticks, hatch, cross-hatch. A comet band
   brightens the ramp diagonally, and an eclipse disc is punched dark out of
   the tone, rimmed by the piece's one clean curve. */
function drawStippleLadder(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const base = Math.min(width, height);
  const m = base * 0.055;
  const rampA = (rand(seed, 8501) - 0.5) * 0.66;
  const flip = rand(seed, 8502) < 0.5 ? -1 : 1;
  const rdx = Math.cos(rampA) * flip;
  const rdy = Math.sin(rampA) * flip;
  const denom = (Math.abs(rdx) * width + Math.abs(rdy) * height) * 0.62;
  const bandA = rampA + Math.PI / 2 + (rand(seed, 8503) - 0.5) * 0.7;
  const bshift = ((tick % 997) / 997 - 0.5) * base * 0.06;
  const bx = width * (0.3 + rand(seed, 8504) * 0.4) + bshift;
  const by = height * (0.3 + rand(seed, 8505) * 0.4);
  const bnx = -Math.sin(bandA);
  const bny = Math.cos(bandA);
  const bw = base * (0.08 + rand(seed, 8506) * 0.07);
  const ex = width * (0.28 + rand(seed, 8507) * 0.44);
  const ey = height * (0.3 + rand(seed, 8508) * 0.4);
  const er = base * (0.09 + rand(seed, 8509) * 0.07);
  const tone = (x, y) => {
    let t = 0.5 + ((x - width / 2) * rdx + (y - height / 2) * rdy) / denom;
    const db = Math.abs((x - bx) * bnx + (y - by) * bny);
    t += 0.34 * Math.exp(-(db * db) / (bw * bw));
    const de = Math.hypot(x - ex, y - ey);
    if (de < er) t *= Math.pow(de / er, 1.6);
    return clamp(t, 0, 1);
  };
  const ink = "rgba(236,240,234,0.7)";
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 0.7;
  ctx.lineCap = "round";
  // The plotter frame the panel lives in.
  ctx.strokeRect(m, m, width - m * 2, height - m * 2);
  const hatchA = rampA + Math.PI / 3.1;
  const hx = Math.cos(hatchA);
  const hy = Math.sin(hatchA);
  const cxA = Math.cos(hatchA + Math.PI / 2);
  const cyA = Math.sin(hatchA + Math.PI / 2);
  const g = base * 0.0135;
  const cols = Math.floor((width - m * 2) / g);
  const rows = Math.floor((height - m * 2) / g);
  ctx.beginPath();
  for (let gy = 0; gy < rows; gy += 1) {
    for (let gx = 0; gx < cols; gx += 1) {
      const s = 8520 + (gy * 613 + gx) * 5;
      const x = m + (gx + 0.5) * g + (rand(seed, s) - 0.5) * g * 0.9;
      const y = m + (gy + 0.5) * g + (rand(seed, s + 1) - 0.5) * g * 0.9;
      const t = tone(x, y) + (rand(seed, s + 2) - 0.5) * 0.05;
      if (t < 0.14) continue;
      if (t < 0.42) {
        // Stipple: dot density itself ramps with tone.
        if (rand(seed, s + 3) < (t - 0.14) / 0.28) ctx.fillRect(x, y, 1.2, 1.2);
      } else if (t < 0.6) {
        const l = g * 0.42;
        ctx.moveTo(x - hx * l, y - hy * l);
        ctx.lineTo(x + hx * l, y + hy * l);
      } else if (t < 0.8) {
        const l = g * 0.72;
        ctx.moveTo(x - hx * l, y - hy * l);
        ctx.lineTo(x + hx * l, y + hy * l);
      } else {
        const l = g * 0.72;
        ctx.moveTo(x - hx * l, y - hy * l);
        ctx.lineTo(x + hx * l, y + hy * l);
        ctx.moveTo(x - cxA * l, y - cyA * l);
        ctx.lineTo(x + cxA * l, y + cyA * l);
      }
    }
  }
  ctx.stroke();
  // One clean pen circle rims the eclipse.
  ctx.beginPath();
  ctx.arc(ex, ey, er, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* Hidden-line ridge scans: rows drawn front to back against a rising horizon
   buffer, so nearer terrain occludes farther terrain the way a plotter's
   hidden-line pass would. One skewed massif dominates, its left face steeper
   than its right, and one groove is deliberately left out of the sweep. */
function drawRidgeScan(ctx, width, height, tick, seed, palette) {
  ctx.save();
  const base = Math.min(width, height);
  const rows = 42 + Math.floor(rand(seed, 8601) * 14);
  const x0 = width * 0.06;
  const x1 = width * 0.94;
  const step = 2;
  const cols = Math.floor((x1 - x0) / step) + 1;
  const frontY = height * 0.9;
  const backY = height * 0.24;
  const rowGap = (frontY - backY) / rows;
  const mx = 0.3 + rand(seed, 8602) * 0.4;
  const mrow = 0.35 + rand(seed, 8603) * 0.3;
  const sigL = 0.1 + rand(seed, 8604) * 0.08;
  const sigR = 0.16 + rand(seed, 8605) * 0.14;
  const amp = base * (0.3 + rand(seed, 8606) * 0.1);
  const skip = 6 + Math.floor(rand(seed, 8607) * (rows - 12));
  const ph1 = rand(seed, 8608) * Math.PI * 2;
  const ph2 = rand(seed, 8609) * Math.PI * 2;
  const tphase = (tick % 6283) / 1000;
  const elevAt = (u, rowT, i) => {
    const du = u - mx;
    const sig = du < 0 ? sigL : sigR;
    const dv = rowT - mrow;
    const massif = Math.exp(-(du * du) / (2 * sig * sig) - (dv * dv) / 0.045);
    const rough = Math.sin(u * 23 + i * 1.7 + ph1) * 0.5
      + Math.sin(u * 47 + i * 3.3 + ph2) * 0.32
      + Math.sin(u * 91 + i * 0.7 + tphase) * 0.18;
    return amp * massif * (0.7 + 0.3 * Math.abs(rough)) + base * 0.045 * (rough * 0.5 + 0.5);
  };
  const horizon = new Float32Array(cols).fill(Infinity);
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = penInk(palette, 2, 0.8);
  ctx.lineWidth = 0.95;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i < rows; i += 1) {
    const rowT = i / (rows - 1);
    const baseY = frontY - i * rowGap;
    const persp = 0.62 + 0.38 * (1 - rowT);
    const drawRow = i !== skip;
    let open = false;
    for (let c = 0; c < cols; c += 1) {
      const x = x0 + c * step;
      const u = (x - x0) / (x1 - x0);
      const y = baseY - elevAt(u, rowT, i) * persp;
      const visible = y < horizon[c] - 0.45;
      if (visible) {
        if (drawRow) {
          if (!open) {
            ctx.moveTo(x, y);
            open = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        horizon[c] = Math.min(horizon[c], y);
      } else {
        open = false;
      }
    }
  }
  ctx.stroke();
  ctx.restore();
}

export const WAVE8_PLOTTER = {
  "spiral-tone": drawSpiralTone,
  "cluster-tour": drawClusterTour,
  "terrace-hatch": drawTerraceHatch,
  "flow-comb": drawFlowComb,
  "stipple-ladder": drawStippleLadder,
  "ridge-scan": drawRidgeScan,
};

export const WAVE8_PLOTTER_META = [
  { name: "spiral-tone", family: "plotter-density", blurb: "one unbroken archimedean spiral, pen weight swelling to carry blobs and a bright moon" },
  { name: "cluster-tour", family: "plotter-density", blurb: "greedy travelling-pen tour through seeded clusters, one ring cluster reads as an eye" },
  { name: "terrace-hatch", family: "plotter-density", blurb: "isoline terraces hatched at band-turned angles, the lowest band left as rippled water" },
  { name: "flow-comb", family: "plotter-density", blurb: "hundreds of combed streamline dashes over hidden rotors, one long hero thread" },
  { name: "stipple-ladder", family: "plotter-density", blurb: "tone ramp climbing stipple to cross-hatch, an eclipse disc punched from the marks" },
  { name: "ridge-scan", family: "plotter-density", blurb: "hidden-line ridge scans over a skewed massif, one groove deliberately left out" },
];
