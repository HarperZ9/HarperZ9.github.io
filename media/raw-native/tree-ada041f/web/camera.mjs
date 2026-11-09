// An explorer camera for 3D scenes on the web host: orbit, pan, zoom, fly,
// focus and an idle tour. The math (OrbitCamera) is pure and runs in Node
// (camera.test.mjs); bindControls() attaches it to an element.
//
//   middle-drag          orbit          shift + middle-drag, right-drag  pan
//   wheel                zoom           W A S D, Q E                     fly
//   arrows               orbit          + and -                          zoom
//   double-click         focus there    R                                reset
//   one finger           orbit          two fingers                      pinch and pan
// Left-drag also orbits, so a mouse without a wheel button still works.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const lerp = (a, b, t) => a + (b - a) * t;

export class OrbitCamera {
  constructor({ target = [0, 0.6, 0], distance = 4.5, yaw = 0.6, pitch = 0.32, fov = 0.9, minDistance = 0.4, maxDistance = 14 } = {}) {
    this.home = { target: [...target], distance, yaw, pitch };
    this.fov = fov; this.minDistance = minDistance; this.maxDistance = maxDistance;
    this.reset();
  }
  reset() {
    const h = this.home;
    this.target = [...h.target]; this.distance = h.distance; this.yaw = h.yaw; this.pitch = h.pitch;
    this.goal = null;
  }
  setHome(h) { this.home = { ...this.home, ...h, target: [...(h.target || this.home.target)] }; this.reset(); }
  // Unit vectors of the camera frame. Yaw turns about +y; pitch lifts the eye.
  basis() {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch), cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const back = [cp * sy, sp, cp * cy];                  // from target to eye
    const fwd = scale(back, -1);
    const right = [cy, 0, -sy];
    const up = [-sp * sy, cp, -sp * cy];
    return { fwd, right, up, back };
  }
  eye() { return add(this.target, scale(this.basis().back, this.distance)); }
  orbit(dx, dy) {   // radians
    this.yaw -= dx;
    this.pitch = clamp(this.pitch + dy, -0.15, 1.45);
    this.goal = null;
  }
  pan(dx, dy) {     // in view-plane units of distance
    const { right, up } = this.basis();
    const k = this.distance;
    this.target = add(this.target, add(scale(right, -dx * k), scale(up, dy * k)));
    this.goal = null;
  }
  zoom(factor) { this.distance = clamp(this.distance * factor, this.minDistance, this.maxDistance); this.goal = null; }
  // Fly: move eye and target together along the view axes (metres).
  fly(forward, strafe, rise) {
    const { fwd, right } = this.basis();
    const flat = [fwd[0], 0, fwd[2]];
    const n = Math.hypot(flat[0], flat[2]) || 1;
    const move = add(add(scale([flat[0] / n, 0, flat[2] / n], forward), scale(right, strafe)), [0, rise, 0]);
    this.target = add(this.target, move);
    this.goal = null;
  }
  // Ease toward a new target and distance (double-click focus).
  focus(point, distance = Math.max(this.minDistance, this.distance * 0.6)) {
    this.goal = { target: [...point], distance: clamp(distance, this.minDistance, this.maxDistance) };
  }
  // The world-space ray through normalized device coordinates (x, y in -1..1, y up).
  ray(x, y, aspect) {
    const { fwd, right, up } = this.basis();
    const f = Math.tan(this.fov / 2);
    const d = add(fwd, add(scale(right, x * f * aspect), scale(up, y * f)));
    const n = Math.hypot(...d);
    return { origin: this.eye(), dir: scale(d, 1 / n) };
  }
  step(dt, { tour = false } = {}) {
    if (this.goal) {
      const k = 1 - Math.exp(-dt * 6);
      this.target = this.target.map((v, i) => lerp(v, this.goal.target[i], k));
      this.distance = lerp(this.distance, this.goal.distance, k);
      if (Math.hypot(...this.target.map((v, i) => v - this.goal.target[i])) < 1e-3) this.goal = null;
    }
    if (tour) {
      this.yaw += dt * 0.12;
      this.pitch = lerp(this.pitch, this.home.pitch + 0.08 * Math.sin(this.yaw * 0.7), 1 - Math.exp(-dt));
    }
  }
  // 16 floats for the shader: eye + tan(fov/2), forward, right, up.
  uniforms(out = new Float32Array(16)) {
    const { fwd, right, up } = this.basis();
    out.set([...this.eye(), Math.tan(this.fov / 2), ...fwd, 0, ...right, 0, ...up, 0]);
    return out;
  }
}

// Attach mouse, wheel, touch and keyboard input on `el` to `cam`. Returns
// { detach(), keys(dt), idle(ms) }. onPick(x, y) is called on double-click
// with device coordinates (-1..1, y up); onInput fires on any user input.
export function bindControls(el, cam, { onPick = null, onInput = null, onReset = null } = {}) {
  const held = new Set();
  let drag = null, lastInput = performance.now();
  const touches = new Map();
  let pinch = null;
  const poke = () => { lastInput = performance.now(); if (onInput) onInput(); };
  const ndc = (e) => {
    const r = el.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2];
  };
  const on = (t, f, o) => { el.addEventListener(t, f, o); return () => el.removeEventListener(t, f, o); };
  const offs = [
    on("contextmenu", (e) => e.preventDefault()),
    on("mousedown", (e) => { if (e.button === 1) e.preventDefault(); }),   // no autoscroll on wheel click
    on("pointerdown", (e) => {
      if (e.pointerType === "touch") { touches.set(e.pointerId, [e.clientX, e.clientY]); pinch = null; poke(); return; }
      const mode = e.button === 2 || (e.button === 1 && e.shiftKey) ? "pan" : (e.button === 0 || e.button === 1 ? "orbit" : null);
      if (!mode) return;
      e.preventDefault();
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      drag = { mode, x: e.clientX, y: e.clientY };
      el.focus && el.focus({ preventScroll: true });
      poke();
    }),
    on("pointermove", (e) => {
      if (e.pointerType === "touch" && touches.has(e.pointerId)) {
        const prev = touches.get(e.pointerId);
        touches.set(e.pointerId, [e.clientX, e.clientY]);
        const h = el.clientHeight || 1;
        if (touches.size === 1) cam.orbit((e.clientX - prev[0]) / h * 3, (e.clientY - prev[1]) / h * 3);
        else if (touches.size === 2) {
          const [a, b] = [...touches.values()];
          const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (pinch) { cam.zoom(pinch.dist / Math.max(1, dist)); cam.pan((mid[0] - pinch.mid[0]) / h, (mid[1] - pinch.mid[1]) / h); }
          pinch = { mid, dist };
        }
        e.preventDefault(); poke(); return;
      }
      if (!drag) return;
      const h = el.clientHeight || 1, dx = (e.clientX - drag.x) / h, dy = (e.clientY - drag.y) / h;
      drag.x = e.clientX; drag.y = e.clientY;
      if (drag.mode === "orbit") cam.orbit(dx * 3, dy * 3); else cam.pan(dx, dy);
      poke();
    }),
    on("pointerup", (e) => { touches.delete(e.pointerId); pinch = null; drag = null; }),
    on("pointercancel", (e) => { touches.delete(e.pointerId); pinch = null; drag = null; }),
    on("wheel", (e) => { e.preventDefault(); cam.zoom(Math.exp(clamp(e.deltaY, -200, 200) * 0.0015)); poke(); }, { passive: false }),
    on("dblclick", (e) => { e.preventDefault(); if (onPick) onPick(...ndc(e)); poke(); }),
    on("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "r") { cam.reset(); if (onReset) onReset(); poke(); e.preventDefault(); return; }
      if ("wasdqe".includes(k) || k.startsWith("arrow") || k === "+" || k === "=" || k === "-") { held.add(k); e.preventDefault(); poke(); }
    }),
    on("keyup", (e) => held.delete(e.key.toLowerCase())),
    on("blur", () => held.clear()),
  ];
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
  return {
    detach() { offs.forEach((f) => f()); held.clear(); },
    // Apply held keys for dt seconds.
    keys(dt) {
      if (!held.size) return;
      const v = 1.6 * dt * Math.max(0.5, cam.distance / 4);
      const f = (held.has("w") ? 1 : 0) - (held.has("s") ? 1 : 0);
      const s = (held.has("d") ? 1 : 0) - (held.has("a") ? 1 : 0);
      const u = (held.has("e") ? 1 : 0) - (held.has("q") ? 1 : 0);
      if (f || s || u) cam.fly(f * v, s * v, u * v);
      const oy = (held.has("arrowleft") ? 1 : 0) - (held.has("arrowright") ? 1 : 0);
      const op = (held.has("arrowup") ? 1 : 0) - (held.has("arrowdown") ? 1 : 0);
      if (oy || op) cam.orbit(-oy * dt * 1.5, op * dt * 1.0);
      if (held.has("+") || held.has("=")) cam.zoom(Math.exp(-dt * 1.2));
      if (held.has("-")) cam.zoom(Math.exp(dt * 1.2));
      poke();
    },
    idle() { return performance.now() - lastInput; },
  };
}
