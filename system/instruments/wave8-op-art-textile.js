// wave8-op-art-textile.js — op-art and woven-textile interference: Riley
// displacement fields, a Vasarely bulge in a grid, pick-and-float cloth,
// beating line families, tonal drape engraving, and warp ikat. Density is the
// medium: hundreds of fine strokes, precision spacing, one deliberate flaw in
// the cloth. First-party, seed-derived, no assets.

function rand(seed, salt) {
  let x = Math.imul(seed ^ Math.imul(salt + 1013904223, 1664525), 2246822519);
  x ^= x >>> 13;
  x = Math.imul(x, 3266489917);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function toneToRgba(t, a) { return `rgba(${t[0]},${t[1]},${t[2]},${a})`; }
function mixTone(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
function fluidTones(palette) {
  return palette && Array.isArray(palette.fluid) && palette.fluid.length >= 3
    ? palette.fluid
    : [[132, 245, 255], [167, 115, 255], [239, 171, 48]];
}
// 0..1 triangle wave over unit period.
function tri01(u) {
  const f = u - Math.floor(u);
  return Math.abs(f * 2 - 1);
}

/* -------------------------------------------------------------------------
   riley-swell: a full-frame field of parallel hairlines displaced by two or
   three invisible gaussian forms. Lines compress on the near side of each
   form and stretch on the far side, so the forms read as pressure under
   cloth. One line refuses to bend (the unbent thread), and a narrow band of
   lines near the main crest carries the plate's chroma.
------------------------------------------------------------------------- */
function drawRileySwell(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const flu = fluidTones(palette);
  const phase = ((tick % 4096) / 4096) * Math.PI * 2;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "butt";
  const nForms = 2 + Math.floor(rnd(1001) * 2);
  const forms = [];
  for (let f = 0; f < nForms; f += 1) {
    forms.push({
      x: width * (0.18 + rnd(1010 + f * 7) * 0.64),
      y: height * (0.22 + rnd(1011 + f * 7) * 0.56),
      r: Math.min(width, height) * (0.15 + rnd(1012 + f * 7) * 0.19),
      amp: (rnd(1013 + f * 7) > 0.5 ? 1 : -1) * (10 + rnd(1014 + f * 7) * 22),
    });
  }
  const gap = 2.6 + rnd(1002) * 0.9;
  const tilt = (rnd(1003) - 0.5) * 0.1;
  const total = Math.ceil((height + 16) / gap);
  const straightIdx = 3 + Math.floor(rnd(1004) * (total - 6));
  const bandIdx = clamp(Math.round((forms[0].y - forms[0].r * 0.55 + 8) / gap), 2, total - 3);
  const accent = flu[Math.floor(rnd(1005) * flu.length) % flu.length];
  for (let idx = 0; idx < total; idx += 1) {
    const y0 = -8 + idx * gap;
    const straight = idx === straightIdx;
    const wob = rnd(1100 + idx) * Math.PI * 2;
    let maxG = 0;
    ctx.beginPath();
    for (let x = -6, first = true; x <= width + 6; x += 4, first = false) {
      let y = y0 + (x - width / 2) * tilt;
      if (!straight) {
        for (let f = 0; f < forms.length; f += 1) {
          const fm = forms[f];
          const dx = x - fm.x;
          const dy = y0 - fm.y;
          const g = Math.exp(-(dx * dx + dy * dy) / (2 * fm.r * fm.r));
          y += fm.amp * g;
          if (g > maxG) maxG = g;
        }
        y += Math.sin(x * 0.045 + wob + phase) * 0.3;
      }
      if (first) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    if (straight) {
      ctx.strokeStyle = "rgba(240,243,246,0.8)";
      ctx.lineWidth = 1.25;
    } else if (Math.abs(idx - bandIdx) <= 1) {
      ctx.strokeStyle = toneToRgba(accent, 0.5);
      ctx.lineWidth = 1.05;
    } else {
      ctx.strokeStyle = `rgba(214,222,232,${(0.2 + maxG * 0.26).toFixed(3)})`;
      ctx.lineWidth = 0.75 + maxG * 0.5;
    }
    ctx.stroke();
  }
  // fine dust caught on the swell shoulders
  for (let d = 0; d < 120; d += 1) {
    const fm = forms[d % forms.length];
    const a = rnd(1500 + d * 3) * Math.PI * 2;
    const rr = fm.r * (0.45 + rnd(1501 + d * 3) * 1.0);
    const g = Math.exp(-(rr * rr) / (2 * fm.r * fm.r));
    ctx.fillStyle = `rgba(232,238,244,${(0.06 + g * 0.3).toFixed(3)})`;
    ctx.fillRect(fm.x + Math.cos(a) * rr, fm.y + Math.sin(a) * rr, 1.3, 1.3);
  }
  ctx.restore();
}

/* -------------------------------------------------------------------------
   vega-bulge: a fine line grid inflated by a spherical magnifier, in the
   spirit of Vasarely's Vega canvases. Alternate warped cells inside the
   bulge are shaded like a checker lit from the upper left, warped nodes get
   catch-light dots, and exactly one tile inside the sphere stays flat.
------------------------------------------------------------------------- */
function vegaWarp(px, py, cx, cy, R, amt) {
  const dx = px - cx;
  const dy = py - cy;
  const d = Math.hypot(dx, dy);
  if (d >= R || d < 0.0001) return [px, py];
  const dd = R * Math.sin((d / R) * Math.PI * 0.5);
  const k = (dd * amt + d * (1 - amt)) / d;
  return [cx + dx * k, cy + dy * k];
}

function drawVegaBulge(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const flu = fluidTones(palette);
  const cx = width * (0.36 + rnd(2001) * 0.28);
  const cy = height * (0.38 + rnd(2002) * 0.24);
  const R = Math.min(width, height) * (0.3 + rnd(2003) * 0.14);
  const amt = 0.72 + rnd(2004) * 0.22;
  const g = 8 + rnd(2005) * 3;
  const rot = (rnd(2006) - 0.5) * 0.12 + ((tick % 2048) / 2048 - 0.5) * 0.02;
  const accent = flu[Math.floor(rnd(2007) * flu.length) % flu.length];
  const pad = 34;
  const gx0 = -pad;
  const gy0 = -pad;
  const nx = Math.ceil((width + pad * 2) / g);
  const ny = Math.ceil((height + pad * 2) / g);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(rot);
  ctx.translate(-width / 2, -height / 2);
  // soft cast shadow low-right of the sphere, under the grid
  const sh = ctx.createRadialGradient(cx + R * 0.3, cy + R * 0.34, R * 0.1, cx + R * 0.3, cy + R * 0.34, R * 1.15);
  sh.addColorStop(0, "rgba(2,3,6,0.32)");
  sh.addColorStop(1, "rgba(2,3,6,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(cx - R * 1.2, cy - R * 1.2, R * 3, R * 3);
  // checker shading inside the bulge
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      if ((i + j) % 2 !== 0) continue;
      const x0 = gx0 + i * g;
      const y0 = gy0 + j * g;
      const mx = x0 + g / 2 - cx;
      const my = y0 + g / 2 - cy;
      if (Math.hypot(mx, my) > R * 0.985) continue;
      const light = clamp(0.55 - (mx / R) * 0.4 - (my / R) * 0.4, 0.05, 1);
      const p00 = vegaWarp(x0, y0, cx, cy, R, amt);
      const p10 = vegaWarp(x0 + g, y0, cx, cy, R, amt);
      const p11 = vegaWarp(x0 + g, y0 + g, cx, cy, R, amt);
      const p01 = vegaWarp(x0, y0 + g, cx, cy, R, amt);
      ctx.fillStyle = toneToRgba(accent, +(0.07 + light * 0.15).toFixed(3));
      ctx.beginPath();
      ctx.moveTo(p00[0], p00[1]);
      ctx.lineTo(p10[0], p10[1]);
      ctx.lineTo(p11[0], p11[1]);
      ctx.lineTo(p01[0], p01[1]);
      ctx.closePath();
      ctx.fill();
    }
  }
  // the warped line grid, both directions
  ctx.strokeStyle = "rgba(210,218,228,0.3)";
  ctx.lineWidth = 0.75;
  for (let i = 0; i <= nx; i += 1) {
    const x = gx0 + i * g;
    ctx.beginPath();
    for (let y = gy0, first = true; y <= gy0 + ny * g; y += 5, first = false) {
      const p = vegaWarp(x, y, cx, cy, R, amt);
      if (first) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
  }
  for (let j = 0; j <= ny; j += 1) {
    const y = gy0 + j * g;
    ctx.beginPath();
    for (let x = gx0, first = true; x <= gx0 + nx * g; x += 5, first = false) {
      const p = vegaWarp(x, y, cx, cy, R, amt);
      if (first) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
  }
  // catch-light nodes on warped intersections inside the bulge
  ctx.globalCompositeOperation = "lighter";
  for (let j = 0; j <= ny; j += 1) {
    for (let i = 0; i <= nx; i += 1) {
      const x = gx0 + i * g;
      const y = gy0 + j * g;
      const dxn = (x - cx) / R;
      const dyn = (y - cy) / R;
      if (dxn * dxn + dyn * dyn > 0.96) continue;
      const light = clamp(0.5 - dxn * 0.42 - dyn * 0.42, 0.04, 1);
      const p = vegaWarp(x, y, cx, cy, R, amt);
      ctx.fillStyle = `rgba(236,240,246,${(0.1 + light * 0.3).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 0.6 + light * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // rim, and a faint sheen where the sphere meets the light
  ctx.strokeStyle = "rgba(234,239,245,0.26)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  const sheen = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.42, 2, cx - R * 0.4, cy - R * 0.42, R * 0.9);
  sheen.addColorStop(0, "rgba(240,244,250,0.13)");
  sheen.addColorStop(1, "rgba(240,244,250,0)");
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.arc(cx, cy, R - 0.5, 0, Math.PI * 2);
  ctx.fill();
  // the one tile that stays flat: unwarped square inside the bulge
  ctx.globalCompositeOperation = "source-over";
  const aF = rnd(2008) * Math.PI * 2;
  const rF = R * (0.32 + rnd(2009) * 0.34);
  const fi = Math.round((cx + Math.cos(aF) * rF - gx0) / g);
  const fj = Math.round((cy + Math.sin(aF) * rF - gy0) / g);
  const fx = gx0 + fi * g;
  const fy = gy0 + fj * g;
  ctx.fillStyle = "rgba(238,242,246,0.12)";
  ctx.fillRect(fx, fy, g, g);
  ctx.strokeStyle = "rgba(244,247,250,0.8)";
  ctx.lineWidth = 1.1;
  ctx.strokeRect(fx, fy, g, g);
  ctx.restore();
}

/* -------------------------------------------------------------------------
   pick-and-float: a woven panel in the Albers workshop register. Vertical
   warp threads with a sinuous wobble, weft picks laid cell by cell through
   a block draft that alternates plain weave with weft floats, stripe rows
   in the plate's chroma, hand-spun slubs, and one pick that breaks mid-row
   and frays.
------------------------------------------------------------------------- */
function weftOver(i, j, bw, bh, fl) {
  const blk = (Math.floor(i / bw) + Math.floor(j / bh)) % 2;
  if (blk === 0) return (i + j) % 2 === 0;
  return (i + (j % 2) * 2) % (fl + 1) !== 0;
}

function drawPickAndFloat(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const flu = fluidTones(palette);
  const mx = width * (0.06 + rnd(3001) * 0.03);
  const my = height * (0.08 + rnd(3002) * 0.04);
  const pw = width - mx * 2;
  const ph = height - my * 2;
  const rot = (rnd(3003) - 0.5) * 0.05;
  const cw = 7.5 + rnd(3004) * 2.5;
  const ch = cw * 0.92;
  const cols = Math.floor(pw / cw);
  const rows = Math.floor(ph / ch);
  const bw = 3 + Math.floor(rnd(3005) * 3);
  const bh = 2 + Math.floor(rnd(3006) * 3);
  const fl = 2 + Math.floor(rnd(3007) * 2);
  const stripeP = 5 + Math.floor(rnd(3008) * 4);
  const stripeM = Math.floor(rnd(3009) * stripeP);
  const accentA = flu[0];
  const accentB = flu[1 % flu.length];
  const flawJ = 2 + Math.floor(rnd(3010) * (rows - 4));
  const flawI = Math.floor(cols * (0.5 + rnd(3011) * 0.35));
  ctx.save();
  ctx.translate(mx + pw / 2, my + ph / 2);
  ctx.rotate(rot);
  ctx.translate(-(mx + pw / 2), -(my + ph / 2));
  ctx.fillStyle = "rgba(24,18,12,0.42)";
  ctx.fillRect(mx, my, pw, ph);
  ctx.strokeStyle = "rgba(220,222,218,0.18)";
  ctx.lineWidth = 1;
  ctx.strokeRect(mx - 2, my - 2, pw + 4, ph + 4);
  // warp threads: dark body plus a thin lit crown
  ctx.lineCap = "round";
  for (let i = 0; i <= cols; i += 1) {
    const x = mx + i * cw + cw / 2;
    const phw = rnd(3100 + i) * Math.PI * 2;
    for (let pass = 0; pass < 2; pass += 1) {
      ctx.strokeStyle = pass === 0 ? "rgba(32,27,20,0.5)" : "rgba(198,188,168,0.32)";
      ctx.lineWidth = pass === 0 ? cw * 0.38 : cw * 0.14;
      ctx.beginPath();
      for (let y = my, first = true; y <= my + ph; y += ch, first = false) {
        const wx = x + Math.sin(y * 0.05 + phw) * 0.8;
        if (first) ctx.moveTo(wx, y); else ctx.lineTo(wx, y);
      }
      ctx.stroke();
    }
  }
  // weft picks laid cell by cell through the draft
  for (let j = 0; j < rows; j += 1) {
    const y = my + (j + 0.5) * ch;
    const isStripe = j % stripeP === stripeM;
    const boneL = 214 + Math.floor(rnd(3200 + j) * 20);
    const tone = isStripe
      ? (Math.floor(j / stripeP) % 2 === 0 ? accentA : accentB)
      : [boneL, boneL - 8, boneL - 26];
    const alpha = isStripe ? 0.5 : 0.42;
    for (let i = 0; i < cols; i += 1) {
      if (j === flawJ && i >= flawI) continue;
      if (!weftOver(i, j, bw, bh, fl)) continue;
      const x0 = mx + i * cw + 0.7;
      const x1 = mx + (i + 1) * cw - 0.7 + (rnd(3300 + i * 61 + j) - 0.5) * 1.2;
      const yj = y + (rnd(3301 + i * 61 + j) - 0.5) * 0.9;
      ctx.strokeStyle = "rgba(14,11,8,0.3)";
      ctx.lineWidth = ch * 0.55;
      ctx.beginPath();
      ctx.moveTo(x0, yj + 0.7);
      ctx.lineTo(x1, yj + 0.7);
      ctx.stroke();
      ctx.strokeStyle = toneToRgba(tone, alpha);
      ctx.lineWidth = ch * 0.44;
      ctx.beginPath();
      ctx.moveTo(x0, yj);
      ctx.lineTo(x1, yj);
      ctx.stroke();
    }
  }
  // hand-spun slubs riding the threads
  const slubs = 20 + Math.floor(rnd(3012) * 14);
  for (let s = 0; s < slubs; s += 1) {
    const along = rnd(3400 + s * 5) > 0.5;
    const sx = mx + rnd(3401 + s * 5) * pw;
    const sy = my + rnd(3402 + s * 5) * ph;
    ctx.fillStyle = `rgba(226,218,200,${(0.3 + rnd(3403 + s * 5) * 0.25).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, along ? cw * 0.34 : cw * 0.12, along ? ch * 0.12 : ch * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // the broken pick: a shadow where the weft should be, and a frayed end
  const fx = mx + flawI * cw;
  const fy = my + (flawJ + 0.5) * ch;
  ctx.strokeStyle = "rgba(8,6,4,0.45)";
  ctx.lineWidth = ch * 0.2;
  ctx.beginPath();
  ctx.moveTo(fx + 2, fy);
  ctx.lineTo(mx + pw - 2, fy);
  ctx.stroke();
  for (let h = 0; h < 4; h += 1) {
    ctx.strokeStyle = `rgba(232,226,210,${(0.4 + rnd(3500 + h) * 0.3).toFixed(3)})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.quadraticCurveTo(
      fx + 3 + rnd(3501 + h * 3) * 6, fy + 2 + rnd(3502 + h * 3) * 5,
      fx + 1 + rnd(3503 + h * 3) * 9, fy + 6 + rnd(3504 + h * 3) * 8
    );
    ctx.stroke();
  }
  // selvages
  ctx.lineCap = "butt";
  ctx.strokeStyle = "rgba(230,232,228,0.4)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(mx + 1, my);
  ctx.lineTo(mx + 1, my + ph);
  ctx.moveTo(mx + pw - 1, my);
  ctx.lineTo(mx + pw - 1, my + ph);
  ctx.stroke();
  ctx.restore();
}

/* -------------------------------------------------------------------------
   zebra-beat: two families of straight parallel lines, close in angle and
   spacing, overlaid additively inside one large disc so their sum beats
   into broad moire bands. A jagged seam tears across the disc where the
   second family slips half a period out of register, with one hot thread
   stitched along the tear.
------------------------------------------------------------------------- */
function zebraFamily(ctx, R, angle, spacing, phase, tone, alpha, slowPh) {
  ctx.save();
  ctx.rotate(angle);
  ctx.lineWidth = 1;
  for (let t = -R + phase; t <= R; t += spacing) {
    const chord = Math.sqrt(Math.max(R * R - t * t, 0)) + 3;
    const a = alpha * (0.7 + 0.3 * Math.sin(t * 0.05 + slowPh));
    ctx.strokeStyle = toneToRgba(tone, +a.toFixed(3));
    ctx.beginPath();
    ctx.moveTo(-chord, t);
    ctx.lineTo(chord, t);
    ctx.stroke();
  }
  ctx.restore();
}

function buildSeam(R, angle, rnd, base) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const px = -dy;
  const py = dx;
  const half = 6 + rnd(base) * 7;
  const n = 14;
  const top = [];
  const bot = [];
  for (let k = 0; k <= n; k += 1) {
    const u = (k / n - 0.5) * 2 * (R + 12);
    const jag = (rnd(base + 1 + k) - 0.5) * 12;
    const w = half * (0.55 + rnd(base + 40 + k) * 0.85);
    const bx = dx * u + px * jag;
    const by = dy * u + py * jag;
    top.push([bx + px * w, by + py * w]);
    bot.push([bx - px * w, by - py * w]);
  }
  return { top, bot };
}

function drawZebraBeat(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const flu = fluidTones(palette);
  const cx = width * (0.34 + rnd(4001) * 0.32);
  const cy = height * (0.36 + rnd(4002) * 0.28);
  const R = Math.min(width, height) * (0.44 + rnd(4003) * 0.14);
  const a0 = rnd(4004) * Math.PI;
  const sA = 2.9 + rnd(4005) * 0.7;
  const sB = sA + 0.16 + rnd(4006) * 0.22;
  const aB = a0 + 0.025 + rnd(4007) * 0.05;
  const slowPh = ((tick % 719) / 719) * Math.PI * 2;
  const phB = ((tick % 977) / 977 - 0.5) * sB;
  const toneA = [204, 216, 230];
  const toneB = flu[Math.floor(rnd(4008) * flu.length) % flu.length];
  const seam = buildSeam(R, a0 + Math.PI * (0.32 + rnd(4009) * 0.36), rnd, 4100);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = "lighter";
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.clip();
  zebraFamily(ctx, R, a0, sA, 0, toneA, 0.16, slowPh);
  zebraFamily(ctx, R, aB, sB, phB, toneB, 0.13, slowPh + 1.7);
  // the tear: darken the strip, then lay the second family back in,
  // half a period out of register and slightly skewed
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(seam.top[0][0], seam.top[0][1]);
  for (let k = 1; k < seam.top.length; k += 1) ctx.lineTo(seam.top[k][0], seam.top[k][1]);
  for (let k = seam.bot.length - 1; k >= 0; k -= 1) ctx.lineTo(seam.bot[k][0], seam.bot[k][1]);
  ctx.closePath();
  ctx.clip();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(6,8,10,0.55)";
  ctx.fillRect(-R - 14, -R - 14, R * 2 + 28, R * 2 + 28);
  ctx.globalCompositeOperation = "lighter";
  zebraFamily(ctx, R, aB + 0.05, sB, phB + sB * 0.5, toneB, 0.2, slowPh + 3.1);
  ctx.restore();
  ctx.restore();
  // one hot thread stitched along the tear's upper lip
  ctx.strokeStyle = toneToRgba(toneB, 0.6);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (let k = 0; k < seam.top.length; k += 1) {
    const p = seam.top[k];
    if (Math.hypot(p[0], p[1]) > R) continue;
    if (k === 0 || Math.hypot(seam.top[k - 1][0], seam.top[k - 1][1]) > R) ctx.moveTo(p[0], p[1]);
    else ctx.lineTo(p[0], p[1]);
  }
  ctx.stroke();
  // quiet rim so the disc sits as an object
  ctx.strokeStyle = "rgba(226,232,238,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, R + 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* -------------------------------------------------------------------------
   drape-tone: an engraved panel of hung cloth. Horizontal scanlines carry
   the tone: their thickness and brightness follow the lit faces of folds
   that gather at a hem and deepen as they fall. The deepest valley holds a
   low chroma glow, one scanline is missing where a weft was pulled, and a
   single loose thread drops from the hem across the folds.
------------------------------------------------------------------------- */
function drapeField(x, t, folds) {
  let h = 0;
  let dhdx = 0;
  for (let k = 0; k < folds.length; k += 1) {
    const fd = folds[k];
    const depth = 0.35 + 0.65 * t;
    const u = x * fd.w + fd.ph + fd.sway * t;
    h += fd.amp * depth * Math.cos(u);
    dhdx -= fd.amp * depth * fd.w * Math.sin(u);
  }
  return [h, dhdx];
}

function drawDrapeTone(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const flu = fluidTones(palette);
  const mx = width * 0.09;
  const my = height * 0.08;
  const pw = width - mx * 2;
  const ph = height - my * 2;
  const nF = 4 + Math.floor(rnd(5001) * 2);
  const folds = [];
  for (let k = 0; k < nF; k += 1) {
    const lam = pw / (1.8 + k * 1.1 + rnd(5010 + k * 5) * 1.6);
    folds.push({
      amp: (12 - k * 2.2) * (0.6 + rnd(5011 + k * 5) * 0.7),
      w: (Math.PI * 2) / lam,
      ph: rnd(5012 + k * 5) * Math.PI * 2 + ((tick % 1024) / 1024) * 0.4,
      sway: (rnd(5013 + k * 5) - 0.5) * 2.6,
    });
  }
  const accent = flu[Math.floor(rnd(5002) * flu.length) % flu.length];
  const ivory = [228, 226, 216];
  const vxBase = mx + pw * (0.28 + rnd(5003) * 0.44);
  const vxDrift = (rnd(5004) - 0.5) * pw * 0.1;
  const step = 5.2;
  const lineGap = 3.1;
  const nLines = Math.floor((ph - 10) / lineGap);
  const flawLine = 4 + Math.floor(rnd(5005) * (nLines - 8));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "butt";
  for (let li = 0; li < nLines; li += 1) {
    if (li === flawLine) continue;
    const y = my + 9 + li * lineGap;
    const t = (y - my) / ph;
    const vx = vxBase + (t - 0.5) * vxDrift * 2;
    let prev = null;
    for (let x = mx; x <= mx + pw - step * 0.5; x += step) {
      const fld = drapeField(x, t, folds);
      const shade = clamp(0.5 + fld[1] * 0.42, 0.04, 1);
      const yy = y - fld[0] * 0.12;
      if (prev) {
        const dv = x - vx;
        const tint = Math.exp(-(dv * dv) / 512) * 0.85;
        ctx.strokeStyle = toneToRgba(mixTone(ivory, accent, tint), +(0.14 + shade * 0.34).toFixed(3));
        ctx.lineWidth = 0.3 + shade * 1.7;
        ctx.beginPath();
        ctx.moveTo(prev[0], prev[1]);
        ctx.lineTo(x + 0.5, yy);
        ctx.stroke();
      }
      prev = [x, yy];
    }
  }
  // the hem: a doubled rod line and gathering ticks on the dominant fold
  ctx.strokeStyle = "rgba(236,238,232,0.5)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(mx - 3, my + 2);
  ctx.lineTo(mx + pw + 3, my + 2);
  ctx.stroke();
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(mx - 3, my + 5);
  ctx.lineTo(mx + pw + 3, my + 5);
  ctx.stroke();
  const lam0 = (Math.PI * 2) / folds[0].w;
  const tick0 = mx + (1 - (folds[0].ph % (Math.PI * 2)) / (Math.PI * 2)) * lam0;
  for (let m = -1; m < pw / lam0 + 1; m += 1) {
    const xc = tick0 + m * lam0;
    if (xc < mx || xc > mx + pw) continue;
    const len = m % 2 === 0 ? 9 : 5;
    ctx.strokeStyle = "rgba(232,234,228,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xc, my + 2);
    ctx.lineTo(xc, my + 2 + len);
    ctx.stroke();
  }
  // one loose thread falling from the hem across the folds
  const lx = mx + pw * (0.52 + rnd(5006) * 0.32);
  const swing = (rnd(5007) - 0.5) * 90;
  ctx.strokeStyle = toneToRgba(accent, 0.75);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(lx, my + 4);
  ctx.bezierCurveTo(
    lx + swing * 0.3, my + ph * 0.32,
    lx + swing, my + ph * 0.6,
    lx + swing * 0.7, my + ph * 0.86
  );
  ctx.stroke();
  ctx.fillStyle = toneToRgba(accent, 0.85);
  ctx.beginPath();
  ctx.arc(lx + swing * 0.7, my + ph * 0.86, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* -------------------------------------------------------------------------
   ikat-drift: warp ikat. Every vertical thread carries the same dyed
   chevron-diamond motif, but each thread hangs a little out of register,
   so the motif's edges blur the way resist-dyed cloth blurs. Registration
   also slides steadily toward the right selvage, faint weft ghosts cross
   the panel, threads fray past the bottom hem, and one warp end was dyed
   wrong on purpose.
------------------------------------------------------------------------- */
function ikatDye(x, y, mot) {
  const chev = Math.abs(tri01(x / mot.lx) * 2 - 1);
  const v = (y + mot.amp * chev) / mot.band;
  let b = Math.floor(v) % mot.seq.length;
  if (b < 0) b += mot.seq.length;
  return mot.seq[b];
}

function drawIkatDrift(ctx, width, height, tick, seed, palette) {
  const rnd = (salt) => rand(seed, salt);
  const flu = fluidTones(palette);
  const mx = width * 0.08;
  const my = height * 0.09;
  const pw = width - mx * 2;
  const ph = height - my * 2;
  const s = 3.0 + rnd(6001) * 0.8;
  const n = Math.floor(pw / s);
  const mot = {
    lx: pw / (3 + Math.floor(rnd(6002) * 3)),
    band: ph / (5 + rnd(6003) * 4),
    amp: ph * (0.22 + rnd(6004) * 0.3),
    seq: [0, 1, 2, 0, 3, 1],
  };
  const rotSeq = Math.floor(rnd(6005) * 6);
  for (let r = 0; r < rotSeq; r += 1) mot.seq.push(mot.seq.shift());
  const dyes = [
    { tone: [52, 42, 36], a: 0.62 },
    { tone: [230, 222, 206], a: 0.5 },
    { tone: flu[0], a: 0.46 },
    { tone: flu[2 % flu.length], a: 0.46 },
  ];
  const blur = 10 + rnd(6006) * 14;
  const shear = (rnd(6007) > 0.5 ? 1 : -1) * (0.5 + rnd(6008) * 0.7);
  const wrongI = 3 + Math.floor(rnd(6009) * (n - 6));
  const phTick = ((tick % 1536) / 1536) * mot.band;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(28,20,14,0.45)";
  ctx.fillRect(mx, my, pw, ph);
  ctx.lineCap = "butt";
  for (let i = 0; i < n; i += 1) {
    const x = mx + (i + 0.5) * s;
    const off = (rnd(6100 + i) - 0.5) * blur
      + shear * Math.pow(i / n, 2) * mot.band * 0.9 + phTick;
    const wrong = i === wrongI;
    const wxj = (rnd(6101 + i) - 0.5) * 0.8;
    let spanStart = my;
    let cur = ikatDye(x - mx, my + off, mot);
    for (let k = 1; ; k += 1) {
      let yc = my + k * 4;
      const closing = yc >= my + ph;
      if (closing) yc = my + ph;
      const d = closing ? cur : ikatDye(x - mx, yc + off, mot);
      if (d !== cur || closing) {
        const dye = dyes[cur];
        ctx.strokeStyle = wrong
          ? "rgba(244,238,222,0.78)"
          : toneToRgba(dye.tone, dye.a);
        ctx.lineWidth = wrong ? 2.5 : 2.1;
        ctx.beginPath();
        ctx.moveTo(x + wxj, spanStart);
        ctx.lineTo(x + wxj, yc);
        ctx.stroke();
        spanStart = yc;
        cur = d;
      }
      if (closing) break;
    }
  }
  // faint weft ghosts: the cloth's cross-grain
  ctx.strokeStyle = "rgba(210,205,196,0.05)";
  ctx.lineWidth = 1;
  for (let y = my + 3; y < my + ph; y += 5.5) {
    ctx.beginPath();
    ctx.moveTo(mx, y);
    ctx.lineTo(mx + pw, y);
    ctx.stroke();
  }
  // header band at the top hem
  ctx.fillStyle = "rgba(10,8,6,0.5)";
  ctx.fillRect(mx, my, pw, 5);
  ctx.strokeStyle = "rgba(232,228,216,0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(mx, my + 5.5);
  ctx.lineTo(mx + pw, my + 5.5);
  ctx.stroke();
  // fringe: every third thread runs past the bottom hem and curls
  for (let i = 0; i < n; i += 3) {
    const x = mx + (i + 0.5) * s;
    const len = 6 + rnd(6200 + i) * 9;
    const swing = (rnd(6201 + i) - 0.5) * 8;
    const dye = dyes[ikatDye(x - mx, my + ph - 1 + (rnd(6100 + i) - 0.5) * blur, mot)];
    ctx.strokeStyle = toneToRgba(dye.tone, dye.a * 0.8);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x, my + ph);
    ctx.quadraticCurveTo(x + swing * 0.3, my + ph + len * 0.6, x + swing, my + ph + len);
    ctx.stroke();
  }
  ctx.restore();
}

export const WAVE8_OPART = {
  "riley-swell": drawRileySwell,
  "vega-bulge": drawVegaBulge,
  "pick-and-float": drawPickAndFloat,
  "zebra-beat": drawZebraBeat,
  "drape-tone": drawDrapeTone,
  "ikat-drift": drawIkatDrift,
};

export const WAVE8_OPART_META = [
  { name: "riley-swell", family: "op-art-textile", blurb: "parallel hairlines swell around hidden forms; one thread refuses to bend" },
  { name: "vega-bulge", family: "op-art-textile", blurb: "a fine line grid inflates over a sphere; shaded checker, one tile stays flat" },
  { name: "pick-and-float", family: "op-art-textile", blurb: "woven pick-and-float cloth with stripe wefts, slubs, and one broken pick" },
  { name: "zebra-beat", family: "op-art-textile", blurb: "two straight-line families beat moire in a disc, torn along a jagged seam" },
  { name: "drape-tone", family: "op-art-textile", blurb: "engraved scanlines carry the tonal folds of hung cloth; a loose thread falls" },
  { name: "ikat-drift", family: "op-art-textile", blurb: "warp ikat chevrons blurred by thread drift; one warp end dyed wrong on purpose" },
];
