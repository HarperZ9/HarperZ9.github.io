// An exact meridional ray trace of a prescription (Snell's law at every spherical surface,
// mirror reflection where a ghost reflects). Written separately from the paraxial matrices in
// prescription.mjs so the two can check each other: at small field angles they must agree.
// Coordinates: z along the axis, y up; a ray is { z, y, dz, dy } with a unit direction.
import { GLASS, cauchy, LAMBDA_D } from "./spectrum.mjs";
import { LENS, firstOrder } from "./prescription.mjs";

const n = (lens, k, nm) => (k < 0 ? 1 : cauchy(GLASS[lens.surfaces[k].glass], nm));
function vertices(lens) { const z = [0]; for (let k = 0; k < lens.surfaces.length - 1; k++) z.push(z[k] + lens.surfaces[k].t); return z; }

// Intersect a ray with surface k; returns the point and the unit normal (pointing toward -z side).
function hit(lens, zs, k, r) {
  const R = lens.surfaces[k].R, zv = zs[k];
  if (!Number.isFinite(R)) { const t = (zv - r.z) / r.dz; return { z: zv, y: r.y + t * r.dy, nz: -1, ny: 0 }; }
  const cz = zv + R, oz = r.z - cz, oy = r.y, b = oz * r.dz + oy * r.dy, c = oz * oz + oy * oy - R * R, disc = b * b - c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc), t1 = -b - s, t2 = -b + s;
  const pick = [t1, t2].map((t) => ({ t, z: r.z + t * r.dz, y: r.y + t * r.dy })).filter((p) => p.t > 1e-9).sort((a, b) => Math.abs(a.z - zv) - Math.abs(b.z - zv))[0];
  if (!pick) return null;
  let nz = (pick.z - cz) / R, ny = pick.y / R; // outward from the centre, scaled by sign of R
  if (nz > 0) { nz = -nz; ny = -ny; }
  return { z: pick.z, y: pick.y, nz, ny };
}
function refract(r, h, n1, n2) {
  let nz = h.nz, ny = h.ny, c = -(nz * r.dz + ny * r.dy);
  if (c < 0) { nz = -nz; ny = -ny; c = -c; }
  const eta = n1 / n2, k = 1 - eta * eta * (1 - c * c);
  if (k < 0) return null;
  const f = eta * c - Math.sqrt(k);
  return { z: h.z, y: h.y, dz: eta * r.dz + f * nz, dy: eta * r.dy + f * ny };
}
function reflect(r, h) { const d = r.dz * h.nz + r.dy * h.ny; return { z: h.z, y: h.y, dz: r.dz - 2 * d * h.nz, dy: r.dy - 2 * d * h.ny }; }

// Trace the ghost (i, j) or, with i = -1, the main path; returns y on the sensor plane.
export function traceExact(r, { lens = LENS, nm = LAMBDA_D, i = -1, j = -1 } = {}) {
  const zs = vertices(lens), N = lens.surfaces.length, sensorZ = zs[N - 1] + firstOrder(lens).bfd;
  const step = (k, from, to) => { const h = hit(lens, zs, k, r); if (!h) return false; r = refract(r, h, n(lens, from, nm), n(lens, to, nm)); return !!r; };
  if (i < 0) { for (let k = 0; k < N; k++) if (!step(k, k - 1, k)) return NaN; }
  else {
    for (let k = 0; k < i; k++) if (!step(k, k - 1, k)) return NaN;
    let h = hit(lens, zs, i, r); if (!h) return NaN; r = reflect(r, h);
    for (let k = i - 1; k > j; k--) if (!step(k, k, k - 1)) return NaN;
    h = hit(lens, zs, j, r); if (!h) return NaN; r = reflect(r, h);
    for (let k = j + 1; k < N; k++) if (!step(k, k - 1, k)) return NaN;
  }
  const t = (sensorZ - r.z) / r.dz;
  return r.y + t * r.dy;
}
// Height on the stop plane of a ray entering at height y0 and angle theta (forward path).
function stopHeight(lens, y0, theta, nm) {
  const zs = vertices(lens), zStop = zs[lens.stopAfter] + lens.stopAt;
  // start 5 mm in front of the first vertex, aimed to pass height y0 at z = 0
  let r = { z: -5, y: y0 - 5 * Math.tan(theta), dz: Math.cos(theta), dy: Math.sin(theta) };
  for (let k = 0; k <= lens.stopAfter; k++) { const h = hit(lens, zs, k, r); r = refract(r, h, n(lens, k - 1, nm), n(lens, k, nm)); }
  return r.y + ((zStop - r.z) / r.dz) * r.dy;
}
// The chief ray at field angle theta: the entry height whose ray crosses the stop centre.
export function chiefRay(theta, { lens = LENS, nm = LAMBDA_D } = {}) {
  let a = -1, b = 1, fa = stopHeight(lens, a, theta, nm), fb = stopHeight(lens, b, theta, nm);
  for (let it = 0; it < 60; it++) { const c = b - (fb * (b - a)) / (fb - fa); a = b; fa = fb; b = c; fb = stopHeight(lens, b, theta, nm); if (Math.abs(fb) < 1e-13) break; }
  return { z: -5, y: b - 5 * Math.tan(theta), dz: Math.cos(theta), dy: Math.sin(theta) };
}
