// Scan-causal EHT sag: a CRT raster that breathes with what the beam has just drawn.
//
// The tube's anode (EHT) supply has a source impedance, and its reservoir is the tube's own
// capacitance, so the anode voltage falls while the beam draws current and recovers with a time
// constant. Magnetic deflection for a given yoke current goes as 1/sqrt(V), so a lower voltage
// throws the beam further: the raster grows. The electron energy falls too, so the spot dims and
// defocuses. Because the beam draws the picture line by line, the sag at a line depends only on the
// lines drawn before it (this frame and, through vertical blanking, the last): a bright window bows
// the lines below it outward and leaves everything above alone. Physics: deflection sensitivity in
// 1/sqrt(Va) and HV regulation, US patents 4297618, 5945791 and 4885510 (moderate confidence).
// Written independently; the literature check found frame-level "raster bloom" in shaders, not this.
//
// Per source line y (top to bottom), in line periods:
//   I_y = mean over x of (R^g + G^g + B^g) / 3                  beam current, full white = 1
//   v_y = v_{y-1} + alpha (S I_y - v_{y-1}),  alpha = 1 - exp(-1 / tauLines)   relative sag
//   k_y = 1 / sqrt(1 - v_y)                                      deflection gain
//   line y is drawn at height cy + (y + 0.5 - cy) k_y, from cx + (x - cx) k_y across
//   spot sigma_y = sigma0 + focus v_y (pixels), brightness (1 - v_y)^bright in linear light
// Blanking lines carry zero current. With settle on, the frame runs twice and the second pass
// starts from the first pass's end, decayed through the blanking interval.
export const SAG_PRESETS = {
  consumer: { S: 0.02, tauFrame: 0.1, focus: 4, sigma0: 0.45, bright: 1, gamma: 2.4, blankFrac: 0.08 },
  thriller: { S: 0.08, tauFrame: 0.05, focus: 14, sigma0: 0.5, bright: 1.5, gamma: 2.4, blankFrac: 0.08 },
};

export function resolveSag(preset, overrides = {}, size) {
  const p = { ...SAG_PRESETS[preset], settle: true, initial: 0, ...overrides };
  const blank = Math.round(size.h * p.blankFrac), tauLines = p.tauFrame * (size.h + blank);
  return { p, w: size.w, h: size.h, blank, tauLines, alpha: 1 - Math.exp(-1 / tauLines), R: Math.ceil(3 * (p.sigma0 + p.focus * p.S)) + 1 };
}

// Per-line beam current.
export function lineCurrents(plan, src) {
  const { w, h, p } = plan, I = new Float64Array(h);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; s += (Math.pow(Math.max(0, src.data[o]), p.gamma) + Math.pow(Math.max(0, src.data[o + 1]), p.gamma) + Math.pow(Math.max(0, src.data[o + 2]), p.gamma)) / 3; }
    I[y] = s / w;
  }
  return I;
}

// The scan: sag, gain, line height and spot per line.
export function scan(plan, I) {
  const { h, p, alpha, blank } = plan, cy = h / 2;
  const v = new Float64Array(h), k = new Float64Array(h), Y = new Float64Array(h), sig = new Float64Array(h);
  let s = p.initial;
  const pass = () => { for (let y = 0; y < h; y++) { s = s + alpha * (p.S * I[y] - s); v[y] = s; } };
  pass();
  if (p.settle) { s = s * Math.pow(1 - alpha, blank); pass(); }
  for (let y = 0; y < h; y++) { k[y] = 1 / Math.sqrt(1 - v[y]); Y[y] = cy + (y + 0.5 - cy) * k[y]; sig[y] = p.sigma0 + p.focus * v[y]; }
  return { v, k, Y, sig, end: s };
}

// One source line sampled at fractional x with a gaussian spot of sigma pixels (R'G'B' in, linear out).
function sampleLine(plan, src, y, xs, sigma, out) {
  const { w, p, R } = plan, x0 = Math.floor(xs);
  let ws = 0; out[0] = out[1] = out[2] = 0;
  for (let j = x0 - R; j <= x0 + R; j++) {
    if (j < 0 || j >= w) continue;
    const d = (j + 0.5 - xs) / sigma, wt = Math.exp(-0.5 * d * d), o = (y * w + j) * 4;
    ws += wt;
    for (let c = 0; c < 3; c++) out[c] += wt * Math.pow(Math.max(0, src.data[o + c]), p.gamma);
  }
  if (ws > 0) for (let c = 0; c < 3; c++) out[c] /= ws;
}

// The resampled frame, as R'G'B' signal (ready for the CRT pass).
export function resample(plan, src, sc) {
  const { w, h, p } = plan, cx = w / 2, out = new Float32Array(w * h * 4), a = [0, 0, 0], b = [0, 0, 0];
  for (let yo = 0; yo < h; yo++) {
    const yc = yo + 0.5;
    let lo = 0, hi = h - 1;                                         // last line with Y <= yc
    if (yc < sc.Y[0] || yc > sc.Y[h - 1]) { for (let x = 0; x < w; x++) out.set([0, 0, 0, 1], (yo * w + x) * 4); continue; }
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (sc.Y[m] <= yc) lo = m; else hi = m; }
    const y1 = Math.min(h - 1, lo + 1), f = y1 === lo ? 0 : (yc - sc.Y[lo]) / (sc.Y[y1] - sc.Y[lo]);
    for (let x = 0; x < w; x++) {
      const xc = x + 0.5;
      sampleLine(plan, src, lo, cx + (xc - cx) / sc.k[lo], sc.sig[lo], a);
      sampleLine(plan, src, y1, cx + (xc - cx) / sc.k[y1], sc.sig[y1], b);
      const ga = Math.pow(1 - sc.v[lo], p.bright), gb = Math.pow(1 - sc.v[y1], p.bright), o = (yo * w + x) * 4;
      for (let c = 0; c < 3; c++) out[o + c] = Math.pow((a[c] * ga) * (1 - f) + (b[c] * gb) * f, 1 / p.gamma);
      out[o + 3] = 1;
    }
  }
  return { width: w, height: h, data: out };
}

export function runSag(plan, src) { const I = lineCurrents(plan, src), sc = scan(plan, I); return { I, sc, out: resample(plan, src, sc) }; }

export function signal8(f) {
  const o = new Uint8ClampedArray(f.width * f.height * 4);
  for (let i = 0; i < o.length; i++) o[i] = (i & 3) === 3 ? 255 : Math.round(Math.min(1, Math.max(0, f.data[i])) * 255);
  return o;
}
