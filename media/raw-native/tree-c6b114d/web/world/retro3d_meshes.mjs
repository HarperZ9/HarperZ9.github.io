// The committed mesh set of ROADMAP M2 criterion 8 (evidence/m2-retro3d-bounds.json):
// generated, so the set is exactly this code. Each mesh is { positions, uvs, indices } in
// world units, with UVs in texel repeats (values past 1 tile the texture).
//   cube()      a unit cube seen from a corner, one texture per face
//   floor()     quads receding to the horizon: where affine mapping visibly bends
//   cylinder()  a ring of quads around the camera's view
// scene(name) gives the mesh with its camera, as the check draws it.

function push(m, p, uv) { m.positions.push(...p); m.uvs.push(...uv); }
function quad(m, a, b, c, d, ua, ub, uc, ud) {
  const i = m.positions.length / 3;
  push(m, a, ua); push(m, b, ub); push(m, c, uc); push(m, d, ud);
  m.indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
}
const done = (m) => ({ positions: new Float32Array(m.positions), uvs: new Float32Array(m.uvs), indices: new Uint32Array(m.indices) });

export function cube() {
  const m = { positions: [], uvs: [], indices: [] }, s = 1;
  const f = [[[-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s]], [[s, -s, -s], [-s, -s, -s], [-s, s, -s], [s, s, -s]],
    [[s, -s, s], [s, -s, -s], [s, s, -s], [s, s, s]], [[-s, -s, -s], [-s, -s, s], [-s, s, s], [-s, s, -s]],
    [[-s, s, s], [s, s, s], [s, s, -s], [-s, s, -s]], [[-s, -s, -s], [s, -s, -s], [s, -s, s], [-s, -s, s]]];
  for (const [a, b, c, d] of f) quad(m, a, b, c, d, [0, 1], [1, 1], [1, 0], [0, 0]);
  return done(m);
}
export function floor() {
  const m = { positions: [], uvs: [], indices: [] };
  for (let j = 0; j < 12; j++) for (let i = -3; i < 3; i++) {
    const z0 = -1 - j * 2.5, z1 = z0 - 2.5;
    quad(m, [i, -1, z0], [i + 1, -1, z0], [i + 1, -1, z1], [i, -1, z1], [0, 0], [1, 0], [1, 1], [0, 1]);
  }
  return done(m);
}
export function cylinder() {
  const m = { positions: [], uvs: [], indices: [] }, n = 18, r = 1.2;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
    const p = (a, y) => [Math.cos(a) * r, y, Math.sin(a) * r - 4];
    quad(m, p(a0, -1.2), p(a1, -1.2), p(a1, 1.2), p(a0, 1.2), [(k / n) * 3, 2], [((k + 1) / n) * 3, 2], [((k + 1) / n) * 3, 0], [(k / n) * 3, 0]);
  }
  return done(m);
}

// Column-major 4x4 matrices, as WGSL's mat4x4f takes them.
export function perspective(fovy, aspect, near, far) {
  const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
  m[0] = t / aspect; m[5] = t; m[10] = far / (near - far); m[11] = -1; m[14] = (far * near) / (near - far);   // depth 0..1
  return m;
}
export function lookAt(eye, at, up) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const f = norm(sub(at, eye)), s = norm(cross(f, up)), u = cross(s, f);
  return new Float32Array([s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -dot(s, eye), -dot(u, eye), dot(f, eye), 1]);
}
export function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
  return o;
}

export const SCENES = {
  cube: () => ({ mesh: cube(), eye: [2.6, 2.0, 3.4], at: [0, 0, 0] }),
  floor: () => ({ mesh: floor(), eye: [0, 0.2, 0.5], at: [0, -0.6, -10] }),
  cylinder: () => ({ mesh: cylinder(), eye: [0.3, 0.4, 0.8], at: [0, 0, -4] }),
};
export function scene(name, width, height) {
  const s = SCENES[name]();
  s.mvp = mul(perspective(1.0, width / height, 0.1, 100), lookAt(s.eye, s.at, [0, 1, 0]));
  return s;
}
