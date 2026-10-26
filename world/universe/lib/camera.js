// The camera: world (1600 x 1000) to screen, three named depths, eased moves, wheel, drag and pinch.
// Moves use the measured scene curve (sine in-out, QUALITY-SPEC M6); reduced motion jumps.
export const WORLD = { w: 1600, h: 1000 };
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("plain");
const sineInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

export function camera(el, onChange) {
  const cam = { x: WORLD.w / 2, y: WORLD.h / 2, k: 1, fit: 1, w: 1, h: 1, dpr: 1, anim: null };
  cam.toScreen = (x, y) => [(x - cam.x) * cam.k + cam.w / 2, (y - cam.y) * cam.k + cam.h / 2];
  cam.toWorld = (sx, sy) => [(sx - cam.w / 2) / cam.k + cam.x, (sy - cam.h / 2) / cam.k + cam.y];
  cam.depth = () => (cam.k < cam.fit * 1.7 ? 0 : cam.k < cam.fit * 4.5 ? 1 : 2);
  cam.levels = () => [cam.fit, cam.fit * 2.6, cam.fit * 6.5];
  cam.resize = () => {
    const r = el.getBoundingClientRect(), first = cam.w === 1;
    cam.w = r.width; cam.h = r.height; cam.dpr = Math.min(devicePixelRatio || 1, 2.5);
    const was = cam.fit > 0 ? cam.k / cam.fit : NaN;
    cam.fit = Math.min(cam.w / (WORLD.w * 1.02), cam.h / (WORLD.h * 1.02));
    cam.k = first || !Number.isFinite(was) || !(was > 0) ? cam.fit : cam.fit * was;  // a stage first measured at zero size starts from the fit
    onChange();
  };
  cam.clamp = () => {
    if (!Number.isFinite(cam.k) || !(cam.k > 0)) cam.k = cam.fit > 0 ? cam.fit : 1;  // never let a zero-size start poison the zoom
    cam.k = Math.min(cam.fit * 40, Math.max(cam.fit * 0.8, cam.k));
    cam.x = Math.min(WORLD.w, Math.max(0, cam.x)); cam.y = Math.min(WORLD.h, Math.max(0, cam.y));
  };
  // Move to (x, y, k) over `ms`, optionally along a path of world points (drifting down a thread).
  // The move is stepped by the page's one clock (cam.tick from the render loop), and a new move started
  // mid-flight begins from wherever the camera is, so every transition can be redirected.
  cam.go = (x, y, k, ms = 900, path = null) => {
    if (cam.anim) cam.anim.done();
    if (!(cam.k > 0) || !Number.isFinite(cam.k)) cam.k = cam.fit > 0 ? cam.fit : k;
    if (!(k > 0) || !Number.isFinite(k)) k = cam.fit > 0 ? cam.fit : 1;
    if (reduced() || ms === 0) { Object.assign(cam, { x, y, k }); cam.clamp(); cam.anim = null; onChange(); return Promise.resolve(); }
    return new Promise((done) => { cam.anim = { from: { x: cam.x, y: cam.y, k: cam.k }, x, y, k, ms, path, t0: performance.now(), done }; });
  };
  cam.tick = (now) => {
    const a = cam.anim; if (!a) return false;
    const t = Math.min(1, (now - a.t0) / a.ms), e = sineInOut(t);
    if (a.path) { const p = along(a.path, e); cam.x = p[0]; cam.y = p[1]; } else { cam.x = a.from.x + (a.x - a.from.x) * e; cam.y = a.from.y + (a.y - a.from.y) * e; }
    // zoom eases in log space so each power of ten takes the same time
    cam.k = Math.exp(Math.log(a.from.k) + (Math.log(a.k) - Math.log(a.from.k)) * e);
    cam.clamp(); onChange(t);
    if (t >= 1) { cam.anim = null; a.done(); }
    return true;
  };
  cam.stop = () => { if (cam.anim) { const a = cam.anim; cam.anim = null; a.done(); } };  // a hand on the map takes over
  cam.fitAll = (ms) => cam.go(WORLD.w / 2, WORLD.h / 2, cam.fit, ms);

  // Input: wheel zooms about the pointer; drag pans; two pointers pinch.
  const pts = new Map(); let pinch = null, moved = 0;
  el.addEventListener("wheel", (e) => {
    e.preventDefault(); cam.stop();
    // a plain scroll travels the tour (nav.js) at the wheel's own speed; a pinch or ctrl+wheel changes depth
    if (!e.ctrlKey && cam.onScroll) { cam.onScroll(e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1)); return; }
    const [wx, wy] = cam.toWorld(e.offsetX, e.offsetY), f = Math.exp(-e.deltaY * 0.0015);
    cam.k *= f; cam.clamp();
    const [nx, ny] = cam.toWorld(e.offsetX, e.offsetY); cam.x += wx - nx; cam.y += wy - ny; cam.clamp(); onChange();
  }, { passive: false });
  el.addEventListener("pointerdown", (e) => { if (e.target.closest("button,a,input")) return; pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; el.setPointerCapture(e.pointerId); });
  el.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); cam.stop();
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) { cam.k *= d / pinch; cam.clamp(); } pinch = d;
    } else { cam.x -= (e.clientX - prev[0]) / cam.k; cam.y -= (e.clientY - prev[1]) / cam.k; moved += Math.abs(e.clientX - prev[0]) + Math.abs(e.clientY - prev[1]); }
    cam.clamp(); onChange();
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
  el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  cam.dragged = () => moved > 6;
  new ResizeObserver(cam.resize).observe(el);
  return cam;
}

function along(path, t) {
  const L = [0]; for (let i = 1; i < path.length; i++) L.push(L[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const d = t * L[L.length - 1]; let i = 1; while (i < L.length - 1 && L[i] < d) i++;
  const u = (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1), a = path[i - 1], b = path[i];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}
