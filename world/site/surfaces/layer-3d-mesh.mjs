// layer-3d-mesh.mjs: Lightweight procedural 3D wireframe/shaded mesh & camera rig
// rendering into the Unified /playground/ Studio Compositor (Wave 33A-1).
// Reuses exact projection modes (perspective/orthographic) from render-nd/core/project.mjs
// and lights faces dynamically from Low Water sun direction + Elements palette.

export const LAYER_META = Object.freeze({
  id: 'mesh-3d',
  name: '3D Studio Mesh & Camera',
  discipline: 'The Studio, Fractals, Attractors, Splats & 3D',
  route: 'Low Water Sun + Elements -> 3D Mesh',
  takes: ['audio_features', 'palette', 'frame'],
  gives: ['frame', 'vector'],
  defaultOn: false,
  defaultOpacity: 0.85,
  defaultBlend: 'normal',
});

const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
const norm3 = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function rotate3D([x, y, z], yaw = 0, pitch = 0, roll = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
  const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
  return [x1 * cr - y2 * sr, x1 * sr + y2 * cr, z2];
}

// Parity with system/lib/render-nd/core/project.mjs (perspective & orthographic)
export function project3D(vert, { mode = 'perspective', dist = 3.2 } = {}) {
  const [x, y, z] = vert;
  if (mode === 'orthographic') return { x, y, depth: 2 + z };
  const denom = dist - z;
  const f = Math.abs(denom) < 1e-6 ? 1.0 : dist / denom;
  return { x: x * f, y: y * f, depth: f };
}

export function buildMesh(kind = 'octahedron', audio = {}, t = 0) {
  const rms = clamp(audio?.rms ?? 0.3);
  const bands = audio?.bands8 || Array(8).fill(0.3);
  const pulse = 1 + rms * 0.24 + (audio?.onset ? 0.1 : 0);

  if (kind === 'torus') {
    const segU = 16, segV = 8, R = 0.72 * pulse, r0 = 0.26;
    const verts = [], faces = [];
    for (let u = 0; u < segU; u++) {
      const au = (u / segU) * Math.PI * 2;
      const bMod = 1 + (bands[u % 8] ?? 0.3) * 0.28;
      for (let v = 0; v < segV; v++) {
        const av = (v / segV) * Math.PI * 2;
        const rr = r0 * bMod;
        verts.push([(R + rr * Math.cos(av)) * Math.cos(au), rr * Math.sin(av), (R + rr * Math.cos(av)) * Math.sin(au)]);
        const i0 = u * segV + v, i1 = ((u + 1) % segU) * segV + v;
        const i2 = ((u + 1) % segU) * segV + ((v + 1) % segV), i3 = u * segV + ((v + 1) % segV);
        faces.push([i0, i1, i2, i3]);
      }
    }
    return { kind, verts, faces };
  }

  // Default: subdivided audio-breathing octahedron prism
  const b0 = 0.92 * pulse, b1 = (0.85 + bands[1] * 0.35) * pulse, b2 = (0.85 + bands[2] * 0.35) * pulse;
  const twist = Math.sin(t * 0.9) * 0.18;
  const verts = [
    [0, b0, 0], [b1, twist, 0], [0, -twist, b2], [-b1, twist, 0], [0, -twist, -b2], [0, -b0, 0],
  ];
  const faces = [
    [0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1],
    [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4],
  ];
  return { kind: 'octahedron', verts, faces };
}

function hexToRgb(hex) {
  const h = String(hex || '#2b5f73').replace(/^#/, '').padEnd(6, '0');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function shadeMeshFaces(mesh, { yaw = 0.4, pitch = 0.32, roll = 0, mode = 'perspective', dist = 3.2, sunLight = null, paletteHex = ['#2b5f73', '#d79e35'] } = {}) {
  const rVerts = mesh.verts.map((v) => rotate3D(v, yaw, pitch, roll));
  const pVerts = rVerts.map((v) => project3D(v, { mode, dist }));
  const sunDir = norm3(sunLight?.sunDir || [-0.4, 0.65, 0.65]);
  const keyCol = sunLight?.keyCol || [1.0, 0.85, 0.68];
  const keyPow = sunLight?.keyPower ?? 1.4;
  const amb = sunLight?.amb || [0.16, 0.22, 0.28];
  const baseRgb = hexToRgb(paletteHex[1] || paletteHex[0]);
  const viewDir = [0, 0, 1];
  const halfVec = norm3([sunDir[0] + viewDir[0], sunDir[1] + viewDir[1], sunDir[2] + viewDir[2]]);

  const drawList = [];
  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const f = mesh.faces[fi];
    const v0 = rVerts[f[0]], v1 = rVerts[f[1]], v2 = rVerts[f[2]];
    const n = norm3(cross3(sub3(v1, v0), sub3(v2, v0)));
    if (dot3(n, viewDir) <= -0.05) continue; // back-face cull
    const diff = Math.max(0, dot3(n, sunDir)) * clamp(keyPow * 0.45, 0.2, 1.3);
    const spec = Math.pow(Math.max(0, dot3(n, halfVec)), 28) * 0.55;
    const zAvg = f.reduce((s, idx) => s + rVerts[idx][2], 0) / f.length;
    const rgb = [0, 1, 2].map((c) => Math.round(clamp((baseRgb[c] / 255) * (amb[c] + diff * keyCol[c]) + spec * keyCol[c], 0, 1) * 255));
    drawList.push({
      faceIndex: fi,
      zAvg,
      shade: Number((amb[0] + diff).toFixed(4)),
      fill: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`,
      pts: f.map((idx) => pVerts[idx]),
    });
  }
  drawList.sort((a, b) => a.zAvg - b.zAvg);
  return drawList;
}

export function render3DMeshLayer(ctx, state = {}, opts = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  const t = Number(state.time) || 0;
  const mesh = buildMesh(opts.kind || 'torus', state.audio, t);
  const faces = shadeMeshFaces(mesh, {
    yaw: t * 0.65 + (state.stirX ?? 0.52) * 2.4,
    pitch: 0.35 + ((state.stirY ?? 0.46) - 0.5) * 1.4,
    mode: opts.mode || 'perspective',
    sunLight: opts.sunLight || state.sunLight,
    paletteHex: state.palette || ['#132a3a', '#2b5f73', '#d79e35', '#ece5d6'],
  });
  const cx = W * 0.5, cy = H * 0.5, sc = Math.min(W, H) * 0.32;
  ctx.lineWidth = 1.1;
  for (const f of faces) {
    ctx.beginPath();
    f.pts.forEach((p, i) => (i ? ctx.lineTo(cx + p.x * sc, cy - p.y * sc) : ctx.moveTo(cx + p.x * sc, cy - p.y * sc)));
    ctx.closePath();
    ctx.fillStyle = f.fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 239, 230, 0.36)';
    ctx.stroke();
  }
  return faces;
}

export function mesh3dTransform(input, ctx, digestFn) {
  const audio = ctx.inPort === 'audio_features' ? input : ctx.lastByEnginePort?.get('daw:audio_features') || { rms: 0.35, bands8: Array(8).fill(0.35) };
  const lwFrame = ctx.inPort === 'frame' && input?.sunLight ? input : ctx.lastByEnginePort?.get('low-water:frame');
  const pal = ctx.inPort === 'palette' ? input : ctx.lastByEnginePort?.get('elements:palette');
  const mesh = buildMesh('octahedron', audio, 0.85);
  const faces = shadeMeshFaces(mesh, { sunLight: lwFrame?.sunLight || null, paletteHex: pal?.hex || ['#2b5f73', '#d79e35'] });
  const lumaGrid = Array.from({ length: 32 }, (_, i) => Math.round(clamp(faces[i % Math.max(1, faces.length)]?.shade ?? 0.3) * 255));
  const paths = faces.map((f) => 'M ' + f.pts.map((p) => `${(128 + p.x * 70).toFixed(1)} ${(80 - p.y * 55).toFixed(1)}`).join(' L ') + ' Z');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 160" width="256" height="160">${paths.map((d) => `<path d="${d}" fill="none" stroke="#ece5d6" stroke-width="1"/>`).join('')}</svg>`;
  return {
    frame: {
      width: 8, height: 4, lumaGrid,
      pixelsSha256: digestFn({ width: 8, height: 4, lumaGrid, source: 'mesh-3d' }),
      transfer: 'srgb-u8', source: 'mesh-3d', visibleFaces: faces.length,
    },
    vector: { svg, paths, viewBox: '0 0 256 160', strokeCount: paths.length },
  };
}
