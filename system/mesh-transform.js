// mesh-transform.js: model-space transforms and preview rendering for imported meshes.
// Mesh shape: { vertices:[[x,y,z],...], faces:[[i,j,k],...], normals? }.
// Pure transform helpers plus a Canvas2D wireframe preview. Zero dependencies.

export function cloneMesh(mesh) {
  return {
    vertices: (mesh && mesh.vertices || []).map((v) => [v[0] || 0, v[1] || 0, v[2] || 0]),
    faces: (mesh && mesh.faces || []).map((f) => f.slice()),
    normals: mesh && Array.isArray(mesh.normals) ? mesh.normals.map((n) => [n[0] || 0, n[1] || 0, n[2] || 0]) : undefined,
  };
}

export function meshBounds(mesh) {
  const vertices = mesh && mesh.vertices || [];
  if (!vertices.length) {
    return { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0], size: [0, 0, 0], radius: 0 };
  }
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const v of vertices) {
    for (let i = 0; i < 3; i++) {
      const x = Number(v[i]) || 0;
      if (x < min[i]) min[i] = x;
      if (x > max[i]) max[i] = x;
    }
  }
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  let radius = 0;
  for (const v of vertices) {
    radius = Math.max(radius, Math.hypot((v[0] || 0) - center[0], (v[1] || 0) - center[1], (v[2] || 0) - center[2]));
  }
  return { min, max, center, size, radius };
}

export function normalizeMesh(mesh) {
  const out = cloneMesh(mesh);
  const b = meshBounds(out);
  const scale = b.radius > 1e-9 ? 1 / b.radius : 1;
  out.vertices = out.vertices.map((v) => [
    (v[0] - b.center[0]) * scale,
    (v[1] - b.center[1]) * scale,
    (v[2] - b.center[2]) * scale,
  ]);
  return out;
}

export function transformMesh(mesh, opts = {}) {
  const source = opts.normalize ? normalizeMesh(mesh) : cloneMesh(mesh);
  const scale = finite(opts.scale, 1);
  const rotateX = degToRad(finite(opts.rotateX, 0));
  const rotateY = degToRad(finite(opts.rotateY, 0));
  const rotateZ = degToRad(finite(opts.rotateZ, 0));
  const tx = finite(opts.translateX, 0);
  const ty = finite(opts.translateY, 0);
  const tz = finite(opts.translateZ, 0);
  source.vertices = source.vertices.map((v) => {
    let p = [v[0] * scale, v[1] * scale, v[2] * scale];
    p = rotX(p, rotateX);
    p = rotY(p, rotateY);
    p = rotZ(p, rotateZ);
    return [p[0] + tx, p[1] + ty, p[2] + tz];
  });
  if (source.normals) {
    source.normals = source.normals.map((n) => rotZ(rotY(rotX(n, rotateX), rotateY), rotateZ));
  }
  return source;
}

export function drawMeshPreview(canvas, mesh, opts = {}) {
  if (!canvas || !mesh) return false;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  const maxBacking = opts.maxBacking || 1600;
  const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
  if (rect && rect.width && rect.height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.min(maxBacking, Math.max(2, Math.round(rect.width * dpr)));
    canvas.height = Math.min(maxBacking, Math.max(2, Math.round(rect.height * dpr)));
  } else {
    canvas.width = opts.width || 960;
    canvas.height = opts.height || 640;
  }
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#0d1b1c";
  ctx.fillRect(0, 0, w, h);
  const vertices = mesh.vertices || [];
  if (!vertices.length) return true;
  const b = meshBounds(mesh);
  const radius = Math.max(b.radius, 1e-6);
  const camera = {
    yaw: degToRad(finite(opts.cameraYaw, 35)),
    pitch: degToRad(finite(opts.cameraPitch, -18)),
    dist: Math.max(1.5, finite(opts.cameraDist, 3.4)),
  };
  const projected = vertices.map((v) => project(v, b.center, radius, camera, w, h));
  const edges = meshEdges(mesh);
  const sorted = edges.map(([a, b]) => ({
    a, b,
    z: ((projected[a] && projected[a].z) || 0) + ((projected[b] && projected[b].z) || 0),
  })).sort((p, q) => q.z - p.z);
  ctx.lineWidth = Math.max(1, Math.min(2.5, Math.sqrt(w * h) / 760));
  for (const e of sorted) {
    const a = projected[e.a];
    const bpt = projected[e.b];
    if (!a || !bpt || a.behind || bpt.behind) continue;
    const shade = Math.max(0.25, Math.min(1, 1 - (a.depth + bpt.depth) * 0.25));
    ctx.strokeStyle = `rgba(${Math.round(88 * shade)},${Math.round(214 * shade)},${Math.round(196 * shade)},0.78)`;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(bpt.x, bpt.y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(239,171,48,.7)";
  for (let i = 0; i < projected.length; i += Math.max(1, Math.ceil(projected.length / 1200))) {
    const p = projected[i];
    if (!p || p.behind) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  return true;
}

export function meshStats(mesh) {
  const b = meshBounds(mesh);
  return {
    vertices: (mesh && mesh.vertices || []).length,
    faces: (mesh && mesh.faces || []).length,
    center: b.center,
    size: b.size,
    radius: b.radius,
  };
}

function meshEdges(mesh) {
  const faces = mesh.faces || [];
  const set = new Set();
  for (const f of faces) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      if (!Number.isInteger(a) || !Number.isInteger(b)) continue;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      set.add(key);
    }
  }
  if (!set.size) {
    const vertices = mesh.vertices || [];
    for (let i = 0; i + 1 < vertices.length; i++) set.add(`${i}:${i + 1}`);
  }
  return [...set].map((k) => k.split(":").map(Number));
}

function project(v, center, radius, camera, w, h) {
  const p = [(v[0] - center[0]) / radius, (v[1] - center[1]) / radius, (v[2] - center[2]) / radius];
  const cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
  const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
  const x1 = p[0] * cy - p[2] * sy;
  const z1 = p[0] * sy + p[2] * cy;
  const y2 = p[1] * cp - z1 * sp;
  const z2 = p[1] * sp + z1 * cp;
  const depth = z2 + camera.dist;
  const behind = depth <= 0.08;
  const f = Math.min(w, h) * 0.42 / Math.max(0.08, depth);
  return { x: w / 2 + x1 * f, y: h / 2 - y2 * f, z: z2, depth, behind };
}

function rotX(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}
function rotY(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}
function rotZ(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}
function degToRad(v) { return v * Math.PI / 180; }
function finite(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
