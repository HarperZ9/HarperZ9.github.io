// tools/tipsheet.mjs: every tip and preset as a single dab or short stroke, for inspection.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { Surface, paintStroke, preset, PRESET_NAMES, encodePNG, linear } from '../brush/index.js';
const W = 1200, H = 300, s = new Surface(W, H).fill(linear('#1b1c26'));
PRESET_NAMES.forEach((n, i) => {
  const x0 = 20 + i * (W / PRESET_NAMES.length), pts = [];
  for (let k = 0; k <= 10; k++) pts.push({ x: x0 + k * 7, y: 60 + k * 18 + Math.sin(k) * 6, p: 0.3 + 0.7 * Math.sin(Math.PI * k / 10) });
  paintStroke(s, preset(n), n === 'flare' ? [pts[5]] : pts, { unit: 600, seed: i + 1, color: '#c8cdf0' });
});
writeFileSync(process.argv[2] || 'shots/_tips.png', await encodePNG(W, H, s.toRGBA8(), (b) => deflateSync(b)));
console.log(PRESET_NAMES.join(' | '));
