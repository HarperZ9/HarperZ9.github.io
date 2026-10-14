// The scene hierarchy (runtime stage G0, ADR 0014): nodes with local transforms in a
// tree, and the world transforms they compose to. Node kinds are the ones the 2D and
// 2.5D pipeline and the style templates need: group, mesh, sprite, tilemap, camera and
// light. A node's props are plain JSON. Pure: runs in Node.
//
//   const s = new Scene();
//   const room = s.add({ name: "room" });
//   const lamp = s.add({ kind: "light", parent: room, t: [0, 3, 0], props: { intensity: 2 } });
//   s.world(lamp)                      // Float64Array(16), column-major
//   const doc = toSuperstack(s, { width: 1920, height: 1080 });   // superstack.scene/1
//   const back = fromSuperstack(doc);  // the same tree
//
// superstack.scene/1 has no hierarchy. The export carries one twice:
// - flattened for any reader, as meshes in world space, the active camera and the lights;
// - whole, under "x_raw_native_hierarchy" (raw-native.hierarchy/1), which the import
//   rebuilds exactly.

export const KINDS = ["group", "mesh", "sprite", "tilemap", "camera", "light"];
export const HIERARCHY = "raw-native.hierarchy/1";

const I4 = () => { const m = new Float64Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; };

// Translation, rotation (unit quaternion x, y, z, w) and scale to a column-major matrix.
export function compose(t = [0, 0, 0], r = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = r, m = new Float64Array(16);
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  m[0] = (1 - 2 * (yy + zz)) * s[0]; m[1] = 2 * (xy + wz) * s[0]; m[2] = 2 * (xz - wy) * s[0];
  m[4] = 2 * (xy - wz) * s[1]; m[5] = (1 - 2 * (xx + zz)) * s[1]; m[6] = 2 * (yz + wx) * s[1];
  m[8] = 2 * (xz + wy) * s[2]; m[9] = 2 * (yz - wx) * s[2]; m[10] = (1 - 2 * (xx + yy)) * s[2];
  m[12] = t[0]; m[13] = t[1]; m[14] = t[2]; m[15] = 1;
  return m;
}
export function mul(a, b) {
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let v = 0;
    for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = v;
  }
  return o;
}
export const apply = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const applyDir = (m, d) => [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]];

export class Scene {
  constructor() { this.nodes = new Map(); this.roots = []; this.next = 1; this.activeCamera = null; this.cache = new Map(); }
  // Add a node; returns its id. Ids are strings; give one to keep it, or one is made.
  add({ id = null, name = "", kind = "group", parent = null, t = [0, 0, 0], r = [0, 0, 0, 1], s = [1, 1, 1], props = {} } = {}) {
    if (!KINDS.includes(kind)) throw new Error(`scene: unknown node kind ${kind}`);
    if (parent !== null && !this.nodes.has(parent)) throw new Error(`scene: no parent ${parent}`);
    const nid = id ?? `n${this.next++}`;
    if (this.nodes.has(nid)) throw new Error(`scene: duplicate id ${nid}`);
    this.nodes.set(nid, { id: nid, name, kind, parent, children: [], t: [...t], r: [...r], s: [...s], props: structuredClone(props) });
    if (parent === null) this.roots.push(nid); else this.nodes.get(parent).children.push(nid);
    if (kind === "camera" && this.activeCamera === null) this.activeCamera = nid;
    this.cache.clear();
    return nid;
  }
  get(id) { return this.nodes.get(id); }
  set(id, { t, r, s, props } = {}) {
    const n = this.nodes.get(id);
    if (t) n.t = [...t]; if (r) n.r = [...r]; if (s) n.s = [...s]; if (props) n.props = structuredClone(props);
    this.cache.clear();
  }
  // Move a node under a new parent (null for a root), keeping its local transform.
  reparent(id, parent) {
    for (let p = parent; p !== null; p = this.nodes.get(p).parent) if (p === id) throw new Error("scene: a node cannot be its own ancestor");
    const n = this.nodes.get(id), from = n.parent === null ? this.roots : this.nodes.get(n.parent).children;
    from.splice(from.indexOf(id), 1);
    n.parent = parent;
    (parent === null ? this.roots : this.nodes.get(parent).children).push(id);
    this.cache.clear();
  }
  local(id) { const n = this.nodes.get(id); return compose(n.t, n.r, n.s); }
  world(id) {
    let m = this.cache.get(id);
    if (!m) {
      const n = this.nodes.get(id);
      m = n.parent === null ? this.local(id) : mul(this.world(n.parent), this.local(id));
      this.cache.set(id, m);
    }
    return m;
  }
  // Depth-first, children in order: the order every export and draw list uses.
  *walk(ids = this.roots) { for (const id of ids) { yield this.nodes.get(id); yield* this.walk(this.nodes.get(id).children); } }
}

// The flattened view for readers of superstack.scene/1: mesh nodes with a box or quad
// shape (props.shape, props.half or props.corners) placed in world space.
function flatten(scene) {
  const meshes = [], lights = [];
  for (const n of scene.walk()) {
    const W = scene.world(n.id);
    if (n.kind === "mesh" && n.props.shape === "quad") {
      meshes.push({ id: n.id, shape: "quad", corners: (n.props.corners || [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1]]).map((c) => apply(W, c)),
        normal: unit(applyDir(W, n.props.normal || [0, 1, 0])), albedo: n.props.albedo || [0.8, 0.8, 0.8] });
    } else if (n.kind === "mesh" && n.props.shape === "box") {
      // superstack's box is axis-aligned with one half size: the scale's largest axis sets it.
      const h = (n.props.half ?? 1) * Math.max(Math.hypot(W[0], W[1], W[2]), Math.hypot(W[4], W[5], W[6]), Math.hypot(W[8], W[9], W[10]));
      meshes.push({ id: n.id, shape: "box", center: [W[12], W[13], W[14]], half: h, albedo: n.props.albedo || [0.8, 0.8, 0.8] });
    } else if (n.kind === "light") {
      lights.push({ kind: "directional", dir: unit(applyDir(W, n.props.dir || [0, -1, 0])), intensity: n.props.intensity ?? 1 });
    }
  }
  return { meshes, lights };
}
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

export function toSuperstack(scene, { width = 1920, height = 1080, seed = "raw-default" } = {}) {
  const { meshes, lights } = flatten(scene);
  const doc = { kind: "superstack.scene/1", seed, t_flicks: 0, frame: { width, height, pixel_center: 0.5, origin: "top-left" }, meshes, lights };
  if (scene.activeCamera !== null) {
    const W = scene.world(scene.activeCamera), c = scene.get(scene.activeCamera);
    const eye = [W[12], W[13], W[14]], fwd = unit(applyDir(W, [0, 0, -1]));
    doc.camera = { eye, target: eye.map((x, i) => x + fwd[i]), up: unit(applyDir(W, [0, 1, 0])), fovy: c.props.fovy ?? 0.9 };
  }
  doc.x_raw_native_hierarchy = {
    schema: HIERARCHY, active_camera: scene.activeCamera, next: scene.next,
    nodes: [...scene.walk()].map((n) => ({ id: n.id, name: n.name, kind: n.kind, parent: n.parent, t: n.t, r: n.r, s: n.s, props: n.props })),
  };
  return doc;
}

export function fromSuperstack(doc) {
  if (!doc || doc.kind !== "superstack.scene/1") throw new Error("fromSuperstack: not a superstack.scene/1 document");
  const s = new Scene(), h = doc.x_raw_native_hierarchy;
  if (h && h.schema === HIERARCHY) {
    for (const n of h.nodes) s.add(n);            // parents come before children (depth-first order)
    s.activeCamera = h.active_camera; s.next = h.next;
    return s;
  }
  // A plain superstack scene: one root per mesh and light, the camera as a camera node.
  for (const m of doc.meshes || []) {
    if (m.shape === "box") s.add({ id: m.id, kind: "mesh", t: m.center, props: { shape: "box", half: m.half, albedo: m.albedo } });
    else if (m.shape === "quad") s.add({ id: m.id, kind: "mesh", props: { shape: "quad", corners: m.corners, normal: m.normal, albedo: m.albedo } });
  }
  (doc.lights || []).forEach((l, i) => s.add({ id: `light${i}`, kind: "light", props: { dir: l.dir, intensity: l.intensity } }));
  if (doc.camera) {
    const { eye, target, up } = doc.camera, f = unit(target.map((x, i) => x - eye[i])), r = unit(cross(f, up)), u = cross(r, f);
    s.add({ id: "camera", kind: "camera", t: eye, r: quatFromBasis(r, u, f.map((x) => -x)), props: { fovy: doc.camera.fovy } });
  }
  return s;
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// The quaternion of the rotation whose columns are x, y, z.
function quatFromBasis(x, y, z) {
  const tr = x[0] + y[1] + z[2];
  if (tr > 0) { const k = Math.sqrt(tr + 1) * 2; return [(y[2] - z[1]) / k, (z[0] - x[2]) / k, (x[1] - y[0]) / k, k / 4]; }
  if (x[0] > y[1] && x[0] > z[2]) { const k = Math.sqrt(1 + x[0] - y[1] - z[2]) * 2; return [k / 4, (y[0] + x[1]) / k, (z[0] + x[2]) / k, (y[2] - z[1]) / k]; }
  if (y[1] > z[2]) { const k = Math.sqrt(1 + y[1] - x[0] - z[2]) * 2; return [(y[0] + x[1]) / k, k / 4, (z[1] + y[2]) / k, (z[0] - x[2]) / k]; }
  const k = Math.sqrt(1 + z[2] - x[0] - y[1]) * 2; return [(z[0] + x[2]) / k, (z[1] + y[2]) / k, k / 4, (x[1] - y[0]) / k];
}
