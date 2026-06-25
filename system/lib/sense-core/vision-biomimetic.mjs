// vision-biomimetic.mjs -- PURE reference (CPU) implementations of the vision-science readouts
// for Telos Studio's perception channel. Zero dependencies; no DOM / canvas / WebGL; no Math.random /
// Date.now. Plain arrays / Float32Array greyscale or RGBA buffers in, with explicit width/height.
//
// This is the BIOMIMETIC DEEPENING of SPEC-telos-sensory-engine.md section C + the WPIR metric
// (section D): linearize-first, Laplacian-pyramid bandpass + Gabor orientation, DoG centre-surround,
// spectral-residual saliency, CSF weighting, SSIM, CSF-weighted SSIM (WPIR), per-cell spatial coords
// and redundancy flags. Reference math first; integration + GPU acceleration are separate steps.
//
// Citations (canonical formulas):
//   sRGB EOTF: IEC 61966-2-1; Gritz and d'Eon, GPU Gems 3 ch. 24 (linearize first).
//   Gaussian / Laplacian pyramid: Burt and Adelson 1983.
//   DoG centre-surround: Kuffler 1953; Enroth-Cugell and Robson 1966.
//   Gabor / oriented energy: Daugman 1985; Jones and Palmer 1987.
//   Spectral residual saliency: Hou and Zhang 2007 ("Saliency Detection: A Spectral Residual Approach").
//   CSF: Barten 2003 (contrast sensitivity of the human eye); Ashraf/Mantiuk castleCSF 2024.
//   SSIM: Wang, Bovik, Sheikh, Simoncelli 2004 ("Image Quality Assessment: From Error Visibility ...").
//   WPIR (CSF-weighted SSIM): this spec, section D; SSIM (Wang 2004) x castleCSF (2024) weighting.

// -- (0) Colour: linearize sRGB first ------------------------------------------
// sRGB EOTF (IEC 61966-2-1): the standard piecewise inverse with exponent 2.4, threshold 0.04045.
// Input/output normalized 0..1. All colour/contrast/edge math runs in LINEAR light (where the CSF
// peaks in the darks + midtones); re-encode only for display.
export function srgbToLinear(c) {
  const x = c <= 0 ? 0 : c >= 1 ? 1 : c;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

// RGBA bytes (0..255) -> Float32 luma in LINEAR light. Rec.709 luma weights applied to the
// LINEARIZED channels (linearize each channel first, then weight). Returns one float per pixel.
export function toLinearLuma(rgba, w, h) {
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const r = srgbToLinear(rgba[o] / 255);
    const g = srgbToLinear(rgba[o + 1] / 255);
    const b = srgbToLinear(rgba[o + 2] / 255);
    out[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b; // Rec.709 on linear channels
  }
  return out;
}

// -- helpers: separable Gaussian blur + 2x down / up sampling ------------------
// Burt-Adelson 5-tap binomial generating kernel (a = 0.4): [0.05, 0.25, 0.4, 0.25, 0.05].
const W5 = [0.05, 0.25, 0.4, 0.25, 0.05];
function clampi(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// 1D separable convolution with an arbitrary symmetric kernel (clamped edges). Pure; allocates.
function convSep(src, w, h, kernel) {
  const half = (kernel.length - 1) >> 1;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let k = -half; k <= half; k++) s += src[y * w + clampi(x + k, 0, w - 1)] * kernel[k + half];
    tmp[y * w + x] = s;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let k = -half; k <= half; k++) s += tmp[clampi(y + k, 0, h - 1) * w + x] * kernel[k + half];
    out[y * w + x] = s;
  }
  return out;
}

// A normalized Gaussian kernel of standard deviation sigma (radius = ceil(3*sigma)).
function gaussKernel(sigma) {
  const r = Math.max(1, Math.ceil(3 * sigma)), k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); k[i + r] = v; sum += v; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  return k;
}
export function gaussianBlur(src, w, h, sigma) { return convSep(src, w, h, gaussKernel(sigma)); }

// Blur with the binomial kernel then drop every other sample (REDUCE). Returns {data,w,h}.
function reduce(src, w, h) {
  const blurred = convSep(src, w, h, W5);
  const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1);
  const out = new Float32Array(nw * nh);
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) out[y * nw + x] = blurred[(y * 2) * w + (x * 2)];
  return { data: out, w: nw, h: nh };
}

// Bilinear upsample a level to a target (tw,th) -> EXPAND. (Burt-Adelson use kernel re-weighting;
// bilinear is the standard zero-dep stand-in and is accurate enough for the bandpass split + tests.)
function expandTo(src, sw, sh, tw, th) {
  const out = new Float32Array(tw * th);
  const sx = sw / tw, sy = sh / th;
  for (let y = 0; y < th; y++) {
    const fy = (y + 0.5) * sy - 0.5, y0 = clampi(Math.floor(fy), 0, sh - 1), y1 = clampi(y0 + 1, 0, sh - 1), wy = fy - Math.floor(fy);
    for (let x = 0; x < tw; x++) {
      const fx = (x + 0.5) * sx - 0.5, x0 = clampi(Math.floor(fx), 0, sw - 1), x1 = clampi(x0 + 1, 0, sw - 1), wx = fx - Math.floor(fx);
      const a = src[y0 * sw + x0], b = src[y0 * sw + x1], c = src[y1 * sw + x0], d = src[y1 * sw + x1];
      out[y * tw + x] = a * (1 - wx) * (1 - wy) + b * wx * (1 - wy) + c * (1 - wx) * wy + d * wx * wy;
    }
  }
  return out;
}

function meanSquare(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return a.length ? s / a.length : 0; }

// -- (1) Gaussian + Laplacian pyramids (Burt-Adelson 1983) ---------------------
// Gaussian pyramid: successive blur+downsample. Returns an array of {data,w,h} per octave.
export function gaussianPyramid(gray, w, h, octaves = 5) {
  const levels = [{ data: Float32Array.from(gray), w, h }];
  for (let o = 1; o < octaves; o++) {
    const prev = levels[o - 1];
    if (prev.w <= 1 || prev.h <= 1) break;
    levels.push(reduce(prev.data, prev.w, prev.h));
  }
  return levels;
}

// Laplacian pyramid: each level = Gaussian level minus the upsampled next coarser level (the bandpass
// residual). The coarsest level is the residual lowpass. Also returns per-octave bandpass `energy`
// (mean-square of each bandpass level) and a `reconstruct()` that sums the pyramid back to the original.
export function laplacianPyramid(gray, w, h, octaves = 5) {
  const g = gaussianPyramid(gray, w, h, octaves);
  const bands = [], energy = [];
  for (let o = 0; o < g.length - 1; o++) {
    const up = expandTo(g[o + 1].data, g[o + 1].w, g[o + 1].h, g[o].w, g[o].h);
    const lap = new Float32Array(g[o].w * g[o].h);
    for (let i = 0; i < lap.length; i++) lap[i] = g[o].data[i] - up[i];
    bands.push({ data: lap, w: g[o].w, h: g[o].h });
    energy.push(meanSquare(lap));
  }
  const baseLevel = g[g.length - 1];
  bands.push({ data: Float32Array.from(baseLevel.data), w: baseLevel.w, h: baseLevel.h, lowpass: true });
  // Reconstruct: start at the coarsest lowpass, expand + add each finer band back up the pyramid.
  function reconstruct() {
    let cur = Float32Array.from(bands[bands.length - 1].data), cw = bands[bands.length - 1].w, ch = bands[bands.length - 1].h;
    for (let o = bands.length - 2; o >= 0; o--) {
      const up = expandTo(cur, cw, ch, bands[o].w, bands[o].h);
      const next = new Float32Array(bands[o].w * bands[o].h);
      for (let i = 0; i < next.length; i++) next[i] = up[i] + bands[o].data[i];
      cur = next; cw = bands[o].w; ch = bands[o].h;
    }
    return { data: cur, w: cw, h: ch };
  }
  return { bands, energy, reconstruct };
}

// -- (2) DoG centre-surround (Kuffler 1953; Enroth-Cugell and Robson 1966) -----
// Difference of Gaussians: a narrow centre minus a broad surround (sigma_c : sigma_s ~ 1:3).
// Contrast-coded edge map (signed response); `magnitude` is |response|. Flat field -> ~0.
export function dogEdges(gray, w, h, sigmaC, sigmaS) {
  const center = gaussianBlur(gray, w, h, sigmaC);
  const surround = gaussianBlur(gray, w, h, sigmaS);
  const map = new Float32Array(w * h), magnitude = new Float32Array(w * h);
  let energy = 0;
  for (let i = 0; i < w * h; i++) { const d = center[i] - surround[i]; map[i] = d; magnitude[i] = Math.abs(d); energy += d * d; }
  return { map, magnitude, w, h, energy: w * h ? energy / (w * h) : 0 };
}

// -- (3) Gabor orientation energy (Daugman 1985; Jones and Palmer 1987) --------
// Oriented edge energy per orientation. We use steerable Sobel-at-orientation (a documented
// first-derivative oriented filter): the directional gradient g_theta = gx*cos(theta) + gy*sin(theta),
// summed-of-squares per orientation. A grating yields max energy at the orientation aligned to its bars.
function sobelXY(gray, w, h) {
  const gx = new Float32Array(w * h), gy = new Float32Array(w * h);
  const at = (x, y) => gray[clampi(y, 0, h - 1) * w + clampi(x, 0, w - 1)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    gx[y * w + x] = -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)
      + at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
    gy[y * w + x] = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)
      + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
  }
  return { gx, gy };
}

export function gaborOrientationEnergy(gray, w, h, orientations = [0, 45, 90, 135]) {
  const { gx, gy } = sobelXY(gray, w, h);
  const out = {};
  for (const deg of orientations) {
    // A bar at orientation `deg` has its gradient ACROSS the bar (perpendicular). Project the gradient
    // onto the perpendicular direction so a grating peaks at the orientation aligned to its bars.
    const a = (deg + 90) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    let e = 0;
    for (let i = 0; i < w * h; i++) { const d = gx[i] * ca + gy[i] * sa; e += d * d; }
    out[deg] = w * h ? e / (w * h) : 0;
  }
  return out;
}

// -- (4) Spectral-residual saliency (Hou and Zhang 2007) -----------------------
// Iterative radix-2 Cooley-Tukey FFT (power-of-two only). In-place on re/im Float64Array pairs.
function fft1d(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { // bit-reversal permutation
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inverse ? 2 : -2) * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < (len >> 1); k++) {
        const a = i + k, b = i + k + (len >> 1);
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
// 2D FFT by rows then columns (square power-of-two side `n`).
function fft2d(re, im, n, inverse) {
  const rowR = new Float64Array(n), rowI = new Float64Array(n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) { rowR[x] = re[y * n + x]; rowI[x] = im[y * n + x]; }
    fft1d(rowR, rowI, inverse);
    for (let x = 0; x < n; x++) { re[y * n + x] = rowR[x]; im[y * n + x] = rowI[x]; }
  }
  const colR = new Float64Array(n), colI = new Float64Array(n);
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) { colR[y] = re[y * n + x]; colI[y] = im[y * n + x]; }
    fft1d(colR, colI, inverse);
    for (let y = 0; y < n; y++) { re[y * n + x] = colR[y]; im[y * n + x] = colI[y]; }
  }
}
function nextPow2(v) { let p = 1; while (p < v) p <<= 1; return p; }
// Resample (nearest) the saliency-sized square map back to (w,h).
function resampleNearest(src, sw, sh, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    out[y * w + x] = src[clampi(Math.round(y * sh / h), 0, sh - 1) * sw + clampi(Math.round(x * sw / w), 0, sw - 1)];
  return out;
}

// Hou and Zhang 2007: FFT -> log amplitude -> subtract a smoothed log amplitude (the spectral
// residual) -> inverse FFT -> square the magnitude -> blur. Returns a saliency map normalized 0..1
// at the original (w,h). The image is resampled onto an n x n power-of-two grid for the FFT.
export function spectralResidualSaliency(gray, w, h) {
  const n = Math.max(4, nextPow2(Math.max(w, h)));
  const re = new Float64Array(n * n), im = new Float64Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
    re[y * n + x] = gray[clampi(Math.round(y * h / n), 0, h - 1) * w + clampi(Math.round(x * w / n), 0, w - 1)];
  fft2d(re, im, n, false);
  const logAmp = new Float32Array(n * n), phaseR = new Float64Array(n * n), phaseI = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) {
    const amp = Math.hypot(re[i], im[i]) || 1e-12;
    logAmp[i] = Math.log(amp);
    phaseR[i] = re[i] / amp; phaseI[i] = im[i] / amp; // unit phasor exp(j*phase)
  }
  const smooth = gaussianBlur(logAmp, n, n, 1.5); // local average of the log spectrum (3x3-ish box ~ sigma 1.5)
  // Spectral residual R = logAmp - smooth; reconstruct with exp(R) on the original phase, inverse FFT.
  for (let i = 0; i < n * n; i++) {
    const e = Math.exp(logAmp[i] - smooth[i]);
    re[i] = e * phaseR[i]; im[i] = e * phaseI[i];
  }
  fft2d(re, im, n, true);
  const sal = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) sal[i] = re[i] * re[i] + im[i] * im[i]; // squared magnitude
  const blurred = gaussianBlur(sal, n, n, 2.5); // smooth the saliency map (Hou-Zhang use a small Gaussian)
  const map = resampleNearest(blurred, n, n, w, h);
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < map.length; i++) { if (map[i] < mn) mn = map[i]; if (map[i] > mx) mx = map[i]; }
  const range = mx - mn || 1;
  for (let i = 0; i < map.length; i++) map[i] = (map[i] - mn) / range; // normalize 0..1
  return { map, w, h };
}

// -- (5) CSF weight (Barten 2003 / castleCSF 2024 closed form) -----------------
// Band-pass spatial contrast-sensitivity function peaking near the empirical 4 cpd (Barten 2003;
// Ashraf/Mantiuk castleCSF 2024 both place the foveal peak at ~3-5 cpd), falling at low and high
// spatial frequency. Modelled as a log-Gaussian band-pass in spatial frequency (a standard CSF shape;
// the difference-of-exponentials and log-Gaussian forms both reproduce the band-pass peak). Eccentricity
// falloff (Curcio et al 1990; acuity drops ~an order of magnitude within a few degrees) uses the
// cortical-magnification model E2 ~ 2.3 deg: peripheral cells lose sensitivity AND shift the peak lower.
const CSF_PEAK_CPD = 4;     // foveal peak spatial frequency (cpd)
const CSF_SIGMA = 0.85;     // log-frequency bandwidth (octave-ish); broad band-pass
function csfBandpass(u, peakCpd) {
  if (u <= 0) return 0;
  const lr = Math.log(u / peakCpd);          // 0 at the peak frequency
  return Math.exp(-(lr * lr) / (2 * CSF_SIGMA * CSF_SIGMA)); // 1 at the peak, falls both sides
}
export function csfWeight(cyclesPerDegree, eccentricityDeg = 0) {
  const u = Math.max(0, cyclesPerDegree), e = Math.max(0, eccentricityDeg);
  const e2 = 2.3, ecScale = e2 / (e2 + e);   // 1 at fovea, -> 0 in the periphery (sensitivity gain)
  const peak = CSF_PEAK_CPD * ecScale;       // the peak frequency shifts lower with eccentricity
  const w = csfBandpass(u, peak) * ecScale;  // band-pass shape x eccentricity sensitivity gain
  return w < 0 ? 0 : w;
}

// -- (6) SSIM (Wang et al 2004) ------------------------------------------------
// Structural similarity with a Gaussian window (11x11, sigma 1.5 as in Wang 2004), C1=(0.01*L)^2,
// C2=(0.03*L)^2 for dynamic range L=1 (inputs are 0..1 floats). Returns the mean SSIM over the image.
export function ssim(a, b, w, h) {
  const L = 1, C1 = (0.01 * L) ** 2, C2 = (0.03 * L) ** 2;
  const fa = a instanceof Float32Array ? a : Float32Array.from(a);
  const fb = b instanceof Float32Array ? b : Float32Array.from(b);
  const k = gaussKernel(1.5);
  const muA = convSep(fa, w, h, k), muB = convSep(fb, w, h, k);
  const aa = new Float32Array(w * h), bb = new Float32Array(w * h), ab = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { aa[i] = fa[i] * fa[i]; bb[i] = fb[i] * fb[i]; ab[i] = fa[i] * fb[i]; }
  const sAA = convSep(aa, w, h, k), sBB = convSep(bb, w, h, k), sAB = convSep(ab, w, h, k);
  const map = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    const ma = muA[i], mb = muB[i], ma2 = ma * ma, mb2 = mb * mb;
    const vA = sAA[i] - ma2, vB = sBB[i] - mb2, cov = sAB[i] - ma * mb;
    const s = ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma2 + mb2 + C1) * (vA + vB + C2));
    map[i] = s; sum += s;
  }
  return { mssim: w * h ? sum / (w * h) : 1, map, w, h };
}

// -- (7) WPIR: CSF-weighted SSIM (spec section D) ------------------------------
// Weighted Perceptual Information Retention: the local SSIM map weighted by per-cell CSF sensitivity
// and normalized by the total CSF weight, over a cols x rows cell layout. 0..1; high when the
// reconstruction matches the (already-linearized) original, lower when degraded. `csfWeights` is a
// flat array of per-cell weights (row-major cols x rows); if omitted, all cells weigh 1 (-> mean SSIM).
export function wpir(reconstructed, original, w, h, csfWeights, cols = 8, rows = 8) {
  const { map } = ssim(reconstructed, original, w, h);
  let num = 0, den = 0, idx = 0;
  for (let cy = 0; cy < rows; cy++) {
    const y0 = Math.floor(cy * h / rows), y1 = Math.max(y0 + 1, Math.floor((cy + 1) * h / rows));
    for (let cx = 0; cx < cols; cx++, idx++) {
      const x0 = Math.floor(cx * w / cols), x1 = Math.max(x0 + 1, Math.floor((cx + 1) * w / cols));
      let cellSum = 0, count = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { cellSum += map[y * w + x]; count++; }
      const cellSsim = count ? cellSum / count : 1;
      const wgt = csfWeights && csfWeights.length ? Math.max(0, csfWeights[idx] || 0) : 1;
      num += wgt * cellSsim; den += wgt;
    }
  }
  return den ? Math.max(0, Math.min(1, num / den)) : 1;
}

// -- (8) Per-cell spatial coords + redundancy (spec section C) -----------------
// Explicit normalized coordinates per cell of a cols x rows aspect-native grid (survives connector
// spatial scrambling): {xFrac,yFrac,wFrac,hFrac}, row-major.
export function perCellSpatialCoords(cols, rows) {
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    out.push({ xFrac: c / cols, yFrac: r / rows, wFrac: 1 / cols, hFrac: 1 / rows });
  return out;
}

// Redundancy flags: a cell is redundant when its colour is close (LAB-ish distance below a threshold)
// to ALL of its existing 4-neighbours, so the model can skip duplicate cells. `cellLabs` is row-major
// [L,a,b] per cell; `cols`/`rows` give the grid shape; `threshold` is a dE-like distance (default 5,
// the "just distinct" JND). Returns a boolean per cell.
export function redundancyFlags(cellLabs, cols, rows, threshold = 5) {
  const n = cols * rows, flags = new Array(n).fill(false);
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c, neigh = [];
    if (c > 0) neigh.push(i - 1);
    if (c < cols - 1) neigh.push(i + 1);
    if (r > 0) neigh.push(i - cols);
    if (r < rows - 1) neigh.push(i + cols);
    if (!neigh.length) continue;
    flags[i] = neigh.every(j => dist(cellLabs[i], cellLabs[j]) < threshold);
  }
  return flags;
}
