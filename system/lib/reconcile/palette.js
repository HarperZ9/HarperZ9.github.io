// palette.js -- a tiny deterministic hue-ramp palette (zero-dep). Not OKLab; a clean, seeded ramp
// the chamber themes from. Same (seed, n, scheme) -> same hex list.
function hslToHex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const col = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * col).toString(16).padStart(2, "0");
  };
  return "#" + f(0) + f(8) + f(4);
}

export function palette(seed = 0, n = 6, scheme = "analogous") {
  const base = ((seed * 2654435761) >>> 0) / 4294967296;
  const span = scheme === "triadic" ? 0.66 : scheme === "complementary" ? 0.5 : scheme === "wide" ? 0.85 : 0.22;
  const out = [];
  const d = n > 1 ? n - 1 : 1;
  for (let i = 0; i < n; i++) { const h = (base + (i / d) * span + 1) % 1; out.push(hslToHex(h, 0.52, 0.30 + 0.42 * i / d)); }
  return out;
}
