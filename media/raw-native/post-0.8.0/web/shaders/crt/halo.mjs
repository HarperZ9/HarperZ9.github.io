// The faceplate halo, derived from the optics of the tube glass.
//
// Phosphor light enters the faceplate (thickness t, index n) with a Lambertian angular
// distribution: the power between theta and theta + d theta is sin(2 theta) d theta. At the
// front surface a ray is partly reflected (Fresnel, unpolarised), and totally reflected
// beyond the critical angle asin(1 / n). A reflected ray comes back to the phosphor layer
// at radius 2 t tan(theta), attenuated by the tinted glass over its path, T^(2 / cos theta)
// for a normal-incidence transmission T. There the phosphor powder scatters it again
// (albedo rho) as a new Lambertian source, so the screen's point-spread function is
// delta + rho K1 + rho^2 K1*K1 + ..., with K1 the single-return distribution. The sharp
// inner edge of the ring sits at 2 t tan(theta_c); it is the halo you see around a bright
// spot on a dark tube. The kernel here is that series to third order, on a grid of cells,
// normalised so a uniform white field keeps its level.

export function fresnelUnpolarised(n, theta) {
  const s = n * Math.sin(theta);
  if (s >= 1) return 1;
  const ci = Math.cos(theta), ct = Math.sqrt(1 - s * s);
  const rs = (n * ci - ct) / (n * ci + ct), rp = (n * ct - ci) / (n * ct + ci);
  return 0.5 * (rs * rs + rp * rp);
}

// Energy returned to the phosphor plane per radial bin (width dr, in mm), out to rMax.
export function radialReturn({ thickness: t, n, transmission: T, backReflectance = 0 }, dr, rMax) {
  const bins = new Float64Array(Math.ceil(rMax / dr) + 1);
  const steps = 40000, dth = Math.PI / 2 / steps;
  let kappa = 0;
  for (let i = 0; i < steps; i++) {
    const th = (i + 0.5) * dth, w = Math.sin(2 * th) * dth;
    const e = w * fresnelUnpolarised(n, th) * Math.pow(T, 2 / Math.cos(th));
    const r = 2 * t * Math.tan(th);
    kappa += e;
    if (r < rMax) bins[Math.floor(r / dr)] += e;
  }
  if (backReflectance > 0) kappa += backPlate(t, n, T, backReflectance, bins, dr, rMax);
  return { bins, kappa };
}

// A diffuse reflector just behind the back surface (a camera's pressure plate behind film
// with no remjet). Light under the critical angle leaves the back surface (displaced t tan
// theta), is scattered back by the plate with reflectance R, refracts in again (the re-entry
// angle theta' stays under the critical angle; Lambertian in air is uniform in sin^2 theta'
// n^2, and about 92% enters), and crosses the thickness again (displaced t tan theta'). The
// two displacements add as vectors at a uniform relative angle. This fills the disc inside
// the ring that total internal reflection leaves dark.
function backPlate(t, n, T, R, bins, dr, rMax) {
  const thc = Math.asin(1 / n), A = 160, B = 80, C = 48;
  let total = 0;
  for (let i = 0; i < A; i++) {
    const th = ((i + 0.5) * thc) / A, w = Math.sin(2 * th) * (thc / A) * (1 - fresnelUnpolarised(n, th)) * Math.pow(T, 1 / Math.cos(th)) * R * 0.92;
    const r1 = t * Math.tan(th);
    for (let j = 0; j < B; j++) {
      const s2 = (j + 0.5) / B, th2 = Math.asin(Math.sqrt(s2) / n), r2 = t * Math.tan(th2), w2 = (w / B) * Math.pow(T, 1 / Math.cos(th2));
      for (let k = 0; k < C; k++) {
        const r = Math.sqrt(r1 * r1 + r2 * r2 + 2 * r1 * r2 * Math.cos(((k + 0.5) * 2 * Math.PI) / C));
        if (r < rMax) bins[Math.floor(r / dr)] += w2 / C;
        total += w2 / C;
      }
    }
  }
  return total;
}

function convolve(a, b, R) {
  const S = 2 * R + 1, o = new Float64Array(S * S);
  for (let ay = 0; ay < S; ay++) for (let ax = 0; ax < S; ax++) {
    const va = a[ay * S + ax];
    if (va === 0) continue;
    for (let by = 0; by < S; by++) {
      const y = ay + by - R;
      if (y < 0 || y >= S) continue;
      for (let bx = 0; bx < S; bx++) { const x = ax + bx - R; if (x >= 0 && x < S) o[y * S + x] += va * b[by * S + bx]; }
    }
  }
  return o;
}

// haloKernel(glass, { mmPerPx, maxCells }) -> { q, cellMm, R, weights, direct, kappa, ringMm }
// q is the downsample factor in output pixels for the halo grid; weights is (2R+1)^2.
export function haloKernel(glass, { mmPerPx, maxCells = 25 }) {
  const { thickness: t, n, albedo: rho } = glass;
  const ringMm = 2 * t * Math.tan(Math.asin(1 / n));
  const reach = 3.2 * ringMm;
  let q = Math.max(1, Math.round((glass.cell || 1) / mmPerPx));
  while ((maxCells * q * mmPerPx) < reach) q++;
  const cellMm = q * mmPerPx, R = Math.min(maxCells, Math.ceil(reach / cellMm)), S = 2 * R + 1;
  const dr = cellMm / 8, { bins, kappa } = radialReturn(glass, dr, (R + 0.5) * cellMm);
  const K1 = new Float64Array(S * S), A = 96;
  for (let i = 0; i < bins.length; i++) {
    if (!bins[i]) continue;
    const r = (i + 0.5) * dr;
    for (let k = 0; k < A; k++) {
      const a = ((k + 0.5) * 2 * Math.PI) / A, x = Math.round((r * Math.cos(a)) / cellMm), y = Math.round((r * Math.sin(a)) / cellMm);
      if (Math.abs(x) <= R && Math.abs(y) <= R) K1[(y + R) * S + x + R] += bins[i] / A;
    }
  }
  const K2 = convolve(K1, K1, R), K3 = convolve(K2, K1, R), K = new Float64Array(S * S);
  let total = 0;
  for (let i = 0; i < K.length; i++) { K[i] = rho * K1[i] + rho * rho * K2[i] + rho * rho * rho * K3[i]; total += K[i]; }
  const centre = R * S + R, norm = 1 + total;
  const direct = (1 + K[centre]) / norm;
  const weights = new Float32Array(S * S);
  for (let i = 0; i < K.length; i++) weights[i] = i === centre ? 0 : K[i] / norm;
  return { q, cellMm, R, weights, direct, kappa, ringMm, haloFraction: 1 - direct };
}
