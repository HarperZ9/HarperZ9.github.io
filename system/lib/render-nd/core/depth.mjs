// depth.mjs — map normalized depth t∈[0,1] (0 = farthest, 1 = nearest) to render attributes.
// Colour follows the site palette: far = teal (200°), near = amber (40°).
function hslToRgb(h, s, l) {
  h /= 360;
  const f = (n) => {
    const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

export function depthCue(t) {
  const u = Math.max(0, Math.min(1, t));
  return {
    size: 1.5 + 3.5 * u,          // px radius 1.5..5
    opacity: 0.25 + 0.75 * u,     // 0.25..1
    color: hslToRgb(200 - 160 * u, 0.7, 0.55), // teal→amber
  };
}
