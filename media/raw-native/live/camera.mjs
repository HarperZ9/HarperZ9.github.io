// A camera you can fly: drag to look, W A S D or the arrows to move, Q and E to sink and rise, the wheel to go
// forward, Shift to go faster. It starts at one of the engine's views and says when it has moved, so the
// references start again.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export class Camera {
  constructor(el, onMove) {
    this.el = el; this.onMove = onMove; this.keys = new Set(); this.speed = 2;
    this.eye = [0, 1, 5]; this.yaw = 0; this.pitch = 0; this.fovy = 0.9;
    let drag = null;
    el.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); el.focus({ preventScroll: true }); });
    el.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const s = 0.0042 * this.fovy;
      this.yaw -= (e.clientX - drag.x) * s; this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - (e.clientY - drag.y) * s));
      drag = { x: e.clientX, y: e.clientY }; this.onMove();
    });
    const up = () => { drag = null; };
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", (e) => { e.preventDefault(); this.step([0, 0, -Math.sign(e.deltaY) * this.speed * 0.25]); }, { passive: false });
    el.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) { this.keys.add(k); if (k.startsWith("arrow")) e.preventDefault(); }
    });
    el.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    el.addEventListener("blur", () => this.keys.clear());
  }
  set(view, speed) {
    this.eye = view.eye.slice(); this.fovy = view.fovy; this.speed = speed;
    const f = norm(sub(view.target, view.eye));
    this.yaw = Math.atan2(f[0], -f[2]); this.pitch = Math.asin(Math.max(-1, Math.min(1, f[1])));
  }
  basis() {
    const cp = Math.cos(this.pitch), f = [Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
    const r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
    return { f, r, u };
  }
  // local move: x right, y up, z back
  step(d) {
    const { f, r } = this.basis();
    for (let k = 0; k < 3; k++) this.eye[k] += r[k] * d[0] + (k === 1 ? d[1] : 0) - f[k] * d[2];
    this.onMove();
  }
  tick(dt) {
    if (!this.keys.size) return;
    const v = this.speed * (this.keys.has("shift") ? 4 : 1) * dt, K = this.keys;
    const x = (K.has("d") || K.has("arrowright") ? 1 : 0) - (K.has("a") || K.has("arrowleft") ? 1 : 0);
    const z = (K.has("s") || K.has("arrowdown") ? 1 : 0) - (K.has("w") || K.has("arrowup") ? 1 : 0);
    const y = (K.has("e") ? 1 : 0) - (K.has("q") ? 1 : 0);
    if (x || y || z) this.step([x * v, y * v, z * v]);
  }
  // column-major matrices for WGSL; jitter in pixels
  matrices(w, h, jx = 0, jy = 0, near = 0.05, far = 5000) {
    // the engine's views are square; on a tall screen the field widens so the sides stay in frame
    const { f, r, u } = this.basis(), e = this.eye, a = w / h, t = Math.tan(this.fovy / 2) * Math.max(1, 1 / a);
    const view = [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, e), -dot(u, e), dot(f, e), 1];
    const inv = [r[0], r[1], r[2], 0, u[0], u[1], u[2], 0, -f[0], -f[1], -f[2], 0, e[0], e[1], e[2], 1];
    const proj = (dx, dy) => [1 / (t * a), 0, 0, 0, 0, 1 / t, 0, 0, -dx, -dy, far / (near - far), -1, 0, 0, near * far / (near - far), 0];
    return { view, inv, proj: proj(2 * jx / w, -2 * jy / h), projNoJit: proj(0, 0), f, r, u, tanHalf: t, aspect: a, near };
  }
}

export function mul4(a, b) {   // column-major a * b
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) for (let k = 0; k < 4; k++) o[c * 4 + rr] += a[k * 4 + rr] * b[c * 4 + k];
  return o;
}
