// Camera controllers (runtime stage G1, ADR 0014). Pure: runs in Node. Each controller is
// plain data plus a step function, so it lives inside a game's state, steps on the fixed
// loop, interpolates for rendering and serialises with a save.
//
//   view2d    a 2D or isometric camera for Motion scenes: pan, zoom about a point, follow
//   firstPerson  position, yaw and pitch; walk and look; collision through a solid(x, z) test
//   orbit     drives web/camera.mjs's OrbitCamera from actions
//
// Every step takes dt and plain numbers (from action axes), never device events.

import { OrbitCamera } from "../camera.mjs";
import { mix, mixAngle } from "./loop.mjs";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Exponential approach toward a goal, frame-rate independent: after dt the gap shrinks by
// exp(-rate * dt). Used for follow and zoom smoothing.
export const approach = (v, goal, rate, dt) => goal + (v - goal) * Math.exp(-rate * dt);

// ---- 2D and isometric -------------------------------------------------------------------
// Motion's camera maps a scene point p to design units as centre + (p - [x, y]) * zoom
// (web/motion/vector.mjs, at depth 0). view2d keeps { x, y, zoom } plus a zoom goal.
export const DESIGN = [1920, 1080];

export function view2d({ x = 960, y = 540, zoom = 1, minZoom = 0.5, maxZoom = 4, bounds = null } = {}) {
  return { x, y, zoom, zoomGoal: zoom, minZoom, maxZoom, bounds };
}
// Scene point -> design units, and back (the exact inverse).
export function toDesign(cam, [px, py], design = DESIGN) { return [design[0] / 2 + (px - cam.x) * cam.zoom, design[1] / 2 + (py - cam.y) * cam.zoom]; }
export function toScene(cam, [dx, dy], design = DESIGN) { return [cam.x + (dx - design[0] / 2) / cam.zoom, cam.y + (dy - design[1] / 2) / cam.zoom]; }

// One step: pan by axes (design units per second at zoom 1), zoom by steps (each step
// multiplies the goal by 1.15) about an anchor in design units so the point under the
// pointer stays put, and follow a target when given.
export function stepView2d(cam, dt, { panX = 0, panY = 0, zoomSteps = 0, anchor = null, follow = null, followRate = 6, panSpeed = 900, zoomRate = 12 } = {}, design = DESIGN) {
  const c = { ...cam };
  c.x += (panX * panSpeed * dt) / c.zoom; c.y += (panY * panSpeed * dt) / c.zoom;
  if (follow) { c.x = approach(c.x, follow[0], followRate, dt); c.y = approach(c.y, follow[1], followRate, dt); }
  if (zoomSteps) c.zoomGoal = clamp(c.zoomGoal * Math.pow(1.15, -zoomSteps), c.minZoom, c.maxZoom);
  const z0 = c.zoom, z1 = clamp(approach(z0, c.zoomGoal, zoomRate, dt), c.minZoom, c.maxZoom);
  if (anchor && z1 !== z0) {
    // Keep the scene point under the anchor fixed: p = cam + (a - centre) / zoom before and after.
    const ax = anchor[0] - design[0] / 2, ay = anchor[1] - design[1] / 2;
    c.x += ax / z0 - ax / z1; c.y += ay / z0 - ay / z1;
  }
  c.zoom = z1;
  if (c.bounds) { const [x0, y0, x1, y1] = c.bounds; c.x = clamp(c.x, x0, x1); c.y = clamp(c.y, y0, y1); }
  return c;
}
// Keep the whole view inside a world rectangle [x0, y0, x1, y1] (scene units) at the current
// zoom; on an axis where the view is larger than the rectangle, centre it.
export function keepInside(cam, [x0, y0, x1, y1], design = DESIGN) {
  const hw = design[0] / 2 / cam.zoom, hh = design[1] / 2 / cam.zoom;
  const fit = (v, a, b, h) => (b - a <= 2 * h ? (a + b) / 2 : clamp(v, a + h, b - h));
  return { ...cam, x: fit(cam.x, x0, x1, hw), y: fit(cam.y, y0, y1, hh) };
}
export const lerpView2d = (a, b, t) => ({ ...b, x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), zoom: mix(a.zoom, b.zoom, t) });
export const motionCamera = (c) => ({ x: c.x, y: c.y, zoom: c.zoom });

// ---- first person ----------------------------------------------------------------------
// Yaw turns about +y (0 looks along -z); pitch lifts the view, clamped short of straight up.
export function firstPerson({ pos = [0, 1.6, 0], yaw = 0, pitch = 0, fov = 1.2, radius = 0.25 } = {}) {
  return { pos: [...pos], yaw, pitch, fov, radius };
}
export function fpBasis(c) {
  const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
  return { fwd: [-sy * cp, sp, -cy * cp], right: [cy, 0, -sy], up: [sy * sp, cp, cy * sp] };
}
// moveX strafes, moveY walks (+1 forward), lookX and lookY turn (radians per second at 1).
// solid(x, z) returns true inside a wall; the move is tried per axis so walls slide.
export function stepFirstPerson(c, dt, { moveX = 0, moveY = 0, lookX = 0, lookY = 0, speed = 3, turn = 2.2, solid = null } = {}) {
  const n = { ...c, pos: [...c.pos] };
  n.yaw -= lookX * turn * dt;
  n.pitch = clamp(n.pitch + lookY * turn * dt, -1.4, 1.4);
  const sy = Math.sin(n.yaw), cy = Math.cos(n.yaw);
  let mx = (-sy * moveY + cy * moveX), mz = (-cy * moveY - sy * moveX);
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const dx = mx * speed * dt, dz = mz * speed * dt, r = n.radius;
  const blocked = (x, z) => solid && (solid(x + r, z) || solid(x - r, z) || solid(x, z + r) || solid(x, z - r));
  if (!blocked(n.pos[0] + dx, n.pos[2])) n.pos[0] += dx;
  if (!blocked(n.pos[0], n.pos[2] + dz)) n.pos[2] += dz;
  return n;
}
// The world ray through normalized device coordinates (x, y in -1..1, y up).
export function fpRay(c, x, y, aspect) {
  const { fwd, right, up } = fpBasis(c), f = Math.tan(c.fov / 2);
  const d = [0, 1, 2].map((i) => fwd[i] + right[i] * x * f * aspect + up[i] * y * f), n = Math.hypot(...d);
  return { origin: [...c.pos], dir: d.map((v) => v / n) };
}
export const lerpFirstPerson = (a, b, t) => ({ ...b, pos: a.pos.map((v, i) => mix(v, b.pos[i], t)), yaw: mixAngle(a.yaw, b.yaw, t), pitch: mix(a.pitch, b.pitch, t) });

// ---- orbit -----------------------------------------------------------------------------
// The existing explorer camera (web/camera.mjs) as a controller on actions.
export function orbit(opts) { return new OrbitCamera(opts); }
export function stepOrbit(cam, dt, { orbitX = 0, orbitY = 0, panX = 0, panY = 0, zoomSteps = 0, rate = 1.5 } = {}) {
  if (orbitX || orbitY) cam.orbit(orbitX * rate * dt, orbitY * rate * dt);
  if (panX || panY) cam.pan(panX * dt, -panY * dt);
  if (zoomSteps) cam.zoom(Math.pow(1.15, zoomSteps));
  cam.step(dt);
  return cam;
}
