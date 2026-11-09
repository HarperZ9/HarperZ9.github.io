// Two-bone inverse kinematics (an arm or a leg), CPU reference. Pure: runs in Node and the browser.
//
//   const { mid, end } = twoBone(root, mid, end, target, pole);
// Given the current root, middle and end joint positions, returns new middle and end positions that
// keep both bone lengths, put the end on the target when it is in reach (on the line toward it when
// not), and keep the middle joint on the pole's side of the root-target line. The rotations that
// carry each bone from its old direction to its new one come from rotationBetween().

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]), nrm = (a) => scl(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function twoBone(root, mid, end, target, pole = null) {
  const a = len(sub(mid, root)), b = len(sub(end, mid)), toT = sub(target, root);
  const d = Math.min(a + b - 1e-9, Math.max(Math.abs(a - b) + 1e-9, len(toT))), dir = len(toT) > 0 ? nrm(toT) : nrm(sub(end, root));
  let side = pole ? sub(pole, root) : sub(mid, root);
  side = sub(side, scl(dir, dot(side, dir)));
  if (len(side) < 1e-9) { const any = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; side = cross(dir, any); }
  const n = nrm(side), cosA = (a * a + d * d - b * b) / (2 * a * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const m = add(root, add(scl(dir, a * cosA), scl(n, a * sinA)));
  return { mid: m, end: add(root, scl(dir, d)), reached: len(toT) <= a + b && len(toT) >= Math.abs(a - b) };
}

// The smallest rotation carrying direction u onto direction v, as a unit quaternion (x, y, z, w).
export function rotationBetween(u, v) {
  const a = nrm(u), b = nrm(v), c = dot(a, b);
  if (c < -1 + 1e-12) { const axis = nrm(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0])); return [axis[0], axis[1], axis[2], 0]; }
  const k = cross(a, b), w = 1 + c, l = Math.hypot(k[0], k[1], k[2], w);
  return [k[0] / l, k[1] / l, k[2] / l, w / l];
}
