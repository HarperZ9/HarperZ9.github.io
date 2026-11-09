// Cameras for paint-over projection: orthographic (the isometric look) and perspective, one
// interface. A camera is { ortho, pos, fwd, right, up, scale, fovY }: scale is the half-height of
// an orthographic view in world units; fovY (radians) applies to a perspective view.
// Pixel coordinates have the pixel centre at integer + 0.5 - 0.5, i.e. the first pixel centre is
// (0, 0), matching the shader library's frames.
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function makeCamera({ ortho = true, pos, fwd, scale = 8, fovY = 0.9 }) {
  const f = norm(fwd), right = norm(cross(f, [0, 1, 0])), up = norm(cross(right, f));
  return { ortho, pos, fwd: f, right, up, scale, fovY };
}
// An isometric camera: yaw about the vertical (degrees; 45 is the classic corner view), elevation
// above the horizon (degrees; 35.264 is true isometric), looking at target from distance dist.
export function isoCamera({ yawDeg = 45, elevDeg = 35.264, target = [0, 1, 0], dist = 60, scale = 8, ortho = true, fovY = 0.5 }) {
  const y = (yawDeg * Math.PI) / 180, e = (elevDeg * Math.PI) / 180;
  const fwd = [-Math.sin(y) * Math.cos(e), -Math.sin(e), -Math.cos(y) * Math.cos(e)];
  return makeCamera({ ortho, pos: [target[0] - fwd[0] * dist, target[1] - fwd[1] * dist, target[2] - fwd[2] * dist], fwd, scale, fovY });
}
// The ray through pixel (x, y) of a w x h image: { o, d }.
export function ray(cam, w, h, x, y) {
  const asp = w / h, u = (((x + 0.5) / w) * 2 - 1) * asp, v = 1 - ((y + 0.5) / h) * 2;
  if (cam.ortho) {
    const s = cam.scale;
    return { o: [cam.pos[0] + (cam.right[0] * u + cam.up[0] * v) * s, cam.pos[1] + (cam.right[1] * u + cam.up[1] * v) * s, cam.pos[2] + (cam.right[2] * u + cam.up[2] * v) * s], d: cam.fwd };
  }
  const t = Math.tan(cam.fovY / 2);
  return { o: cam.pos, d: norm([cam.fwd[0] + (cam.right[0] * u + cam.up[0] * v) * t, cam.fwd[1] + (cam.right[1] * u + cam.up[1] * v) * t, cam.fwd[2] + (cam.right[2] * u + cam.up[2] * v) * t]) };
}
// World point to [pixel x, pixel y, depth along the view axis].
export function project(cam, w, h, P) {
  const r = [P[0] - cam.pos[0], P[1] - cam.pos[1], P[2] - cam.pos[2]], z = dot(r, cam.fwd), asp = w / h, a = dot(r, cam.right), b = dot(r, cam.up);
  let u, v;
  if (cam.ortho) { u = a / (cam.scale * asp); v = b / cam.scale; } else { const t = Math.tan(cam.fovY / 2); u = a / (z * t * asp); v = b / (z * t); }
  return [((u + 1) / 2) * w - 0.5, ((1 - v) / 2) * h - 0.5, z];
}
// Unit vector from a surface point toward the camera.
export function toCamera(cam, P) {
  if (cam.ortho) return [-cam.fwd[0], -cam.fwd[1], -cam.fwd[2]];
  return norm([cam.pos[0] - P[0], cam.pos[1] - P[1], cam.pos[2] - P[2]]);
}
// World size of one pixel at the camera's focal plane (orthographic: everywhere).
export const pixelWorld = (cam, h, depth = 1) => (cam.ortho ? (2 * cam.scale) / h : (2 * Math.tan(cam.fovY / 2) * depth) / h);
export { norm, dot, cross };
