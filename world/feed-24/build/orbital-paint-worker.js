// orbital-paint-worker.js: paints orbital frames off the main thread. It holds the snapshots the
// physics worker made, interpolates positions between the two around the requested display time,
// and returns sRGB bytes at device pixels. The main thread only blits.
import { splatOpaque, VIEW } from './orbital-render.js';

let snaps = new Map(), size = null, extent = 10, step = 0.2, view = { ...VIEW }, job = 0;

onmessage = e => {
  const m = e.data;
  if (m.type === 'reset') { snaps = new Map(); job = m.job; extent = m.extent; step = m.step; return; }
  if (m.type === 'size') { size = m; return; }
  if (m.type === 'view') { view = { ...view, ...m.view }; return; }
  if (m.type === 'snap') { if (m.job === job) snaps.set(m.k, m); return; }
  if (m.type === 'export') size = { ...size, keep: size, W: m.W, H: m.W, dpr: m.W / 600 };   // QUALITY-SPEC O1, one frame at 3840
  else if (m.type !== 'frame' || !size) return;
  const f = m.tau / step, k0 = Math.floor(f), a = snaps.get(k0), b = snaps.get(k0 + 1) ?? a;
  if (!a) { if (m.type === 'export') size = size.keep; postMessage({ type: m.type, id: m.id, ready: false }); return; }
  for (const k of snaps.keys()) if (k < k0 - 1) snaps.delete(k);
  const u = b === a ? 0 : f - k0, n = a.pos.length, pos = new Float32Array(n);
  for (let i = 0; i < n; i++) pos[i] = a.pos[i] + (b.pos[i] - a.pos[i]) * u;
  const w = new Float32Array(a.w.length);
  for (let i = 0; i < w.length; i++) w[i] = a.w[i] + (b.w[i] - a.w[i]) * u;
  const near = u < 0.5 ? a : b, W = size.W, H = size.H, rgba = new Uint8ClampedArray(W * H * 4);
  splatOpaque(rgba, W, H, pos, w, { ...view, yaw: view.yaw + (m.spin ?? 0) }, extent, size.dpr, { vis: near.vis, dens: near.d, bg: size.bg, radius: 1.6, relief: 0.2 });
  if (m.type === 'export') { size = size.keep; postMessage({ type: 'export', W, H, rgba }, [rgba.buffer]); return; }
  postMessage({ type: 'frame', id: m.id, ready: true, W, H, rgba, k: k0 }, [rgba.buffer]);
};
