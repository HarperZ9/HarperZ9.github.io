// An owned SDF still life for the hatching shader: a ground plane, a sphere, a torus lying flat
// (its inner equator is a saddle), an upright capsule (a cylinder between two caps) and a rounded
// box. The same distance function exists in JavaScript (float64) and WGSL (STILL_SDF_WGSL), written
// to do the same operations in the same order.
export const STILL = {
  sphere: { c: [-0.9, 0.55, 0.2], r: 0.55 },
  torus: { c: [0.75, 0.18, 0.45], R: 0.5, r: 0.18 },
  capsule: { a: [0.05, 0.25, -0.95], b: [0.05, 1.55, -0.95], r: 0.25 },
  box: { c: [1.65, 0.3, -0.6], b: [0.22, 0.22, 0.22], r: 0.08 },
  camera: { eye: [3.2, 2.3, 3.7], target: [0.25, 0.5, -0.15], tan: 0.42 },
  light: [-0.5, 0.8, 0.45],
};
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
export const sdSphere = (p, s = STILL.sphere) => len3(p[0] - s.c[0], p[1] - s.c[1], p[2] - s.c[2]) - s.r;
export const sdTorus = (p, t = STILL.torus) => { const qx = Math.sqrt((p[0] - t.c[0]) ** 2 + (p[2] - t.c[2]) ** 2) - t.R, qy = p[1] - t.c[1]; return Math.sqrt(qx * qx + qy * qy) - t.r; };
export const sdCapsule = (p, c = STILL.capsule) => {
  const pa = [p[0] - c.a[0], p[1] - c.a[1], p[2] - c.a[2]], ba = [c.b[0] - c.a[0], c.b[1] - c.a[1], c.b[2] - c.a[2]];
  const h = Math.min(1, Math.max(0, (pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]) / (ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2])));
  return len3(pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h) - c.r;
};
export const sdRoundBox = (p, b = STILL.box) => {
  const q = [Math.abs(p[0] - b.c[0]) - b.b[0], Math.abs(p[1] - b.c[1]) - b.b[1], Math.abs(p[2] - b.c[2]) - b.b[2]];
  return len3(Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)) + Math.min(Math.max(q[0], q[1], q[2]), 0) - b.r;
};
export const sdPlane = (p) => p[1];
export function stillSdf(p) { return Math.min(sdPlane(p), sdSphere(p), sdTorus(p), sdCapsule(p), sdRoundBox(p)); }

export const STILL_SDF_WGSL = /* wgsl */ `
fn sd_sphere(p: vec3f) -> f32 { return length(p - vec3f(${STILL.sphere.c.join(", ")})) - ${STILL.sphere.r}; }
fn sd_torus(p: vec3f) -> f32 { let qx = length(vec2f(p.x - ${STILL.torus.c[0]}, p.z - ${STILL.torus.c[2]})) - ${STILL.torus.R}; let qy = p.y - ${STILL.torus.c[1]}; return sqrt(qx * qx + qy * qy) - ${STILL.torus.r}; }
fn sd_capsule(p: vec3f) -> f32 {
  let pa = p - vec3f(${STILL.capsule.a.join(", ")}); let ba = vec3f(${STILL.capsule.b.map((v, i) => v - STILL.capsule.a[i]).join(", ")});
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - ${STILL.capsule.r};
}
fn sd_round_box(p: vec3f) -> f32 {
  let q = abs(p - vec3f(${STILL.box.c.join(", ")})) - vec3f(${STILL.box.b.join(", ")});
  return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0) - ${STILL.box.r};
}
fn still_sdf(p: vec3f) -> f32 { return min(min(min(min(p.y, sd_sphere(p)), sd_torus(p)), sd_capsule(p)), sd_round_box(p)); }
`;
