// glaze.mjs: one pair of elements as two washes on paper, one over the other. Painted by km.mjs, the optics the
// well's shader uses, with the same rules for the paper's tooth, granulation and the dried rim. Computed.
//
//   const a = paintOf(ix, element, settings), b = paintOf(ix, other, settings);
//   glazeOf(a, b, ground)         { hex, lin } of a over b where they overlap, at full strength, on that ground (smooth)
//   orderGap(a, b)                how far a over b is from b over a, on the screen's 0 to 255 scale
//   paintGlaze(canvas, a, b)      the swatch: b laid first (left and up), a over it (right and down)
//
// The washes are at unit thickness, which is the thickness at which a pigment alone on white shows the element's
// measured colour. They do not follow the blend's shares.
import { pigment, layer, onGround, apart, linToHex, linToSrgb, okToLinear, PAPER } from './km.mjs';
import { driveFor } from './elements-data.mjs';
import { GROUNDS, mixOn } from './grounds.mjs';
import { hexToOk } from '../../studio/lib/blend.mjs';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x), smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (hash(i, j) * (1 - u) + hash(i + 1, j) * u) * (1 - v) + (hash(i, j + 1) * (1 - u) + hash(i + 1, j + 1) * u) * v; }
// the paper's tooth, as in the shader: a height from 0 (a low point) to 1
const tooth = (x, y) => 0.5 * vnoise(x, y) + 0.3 * vnoise(x * 2.1 + 9, y * 2.1 + 9) + 0.2 * vnoise(x * 4.3 + 31, y * 4.3 + 31);

// An element as paint: its pigment (K and S from its measured colour and ink coverage) and how it handles.
export function paintOf(ix, el, settings) {
  const d = driveFor(ix, el, settings), s = d.shader;
  const lin = okToLinear(hexToOk(el.colour?.hex || '#8a8a8a'), s.saturation);
  return { id: el.id, name: el.name, lin, pig: pigment(lin, s.opacity), opacity: s.opacity, opacityFrom: d.source.coverage,
    granulation: clamp(s.granulation, 0, 1), rim: clamp(s.rim, 0, 1), bleed: clamp(s.bleed, 0, 1.2) };
}
export const glazeOf = (top, under, ground = 'paper') => { const lin = mixOn(ground, [under, top]); return { lin, hex: linToHex(lin) }; };
export const orderGap = (a, b, ground = 'paper') => apart(mixOn(ground, [b, a]), mixOn(ground, [a, b]));

// thickness of one wash at a point: e is how far inside the wash's edge the point is (in fractions of the swatch)
function thickness(p, e, th) {
  const s = 0.006 + 0.03 * p.bleed, m = smooth(-s, s, e), rim = Math.exp(-(((e - s - 0.012) / (0.012 + 0.5 * s)) ** 2));
  return Math.max(0, (m + p.rim * rim * 0.7) * (1 + p.granulation * 1.9 * (0.5 - th)));
}
const inside = (x, y, x0, y0, x1, y1, wob) => Math.min(x - x0, x1 - x, (y - y0) * 0.667, (y1 - y) * 0.667) + wob;

export function paintGlaze(canvas, top, under, ground = 'paper') {
  const paper = ground === 'paper' || !GROUNDS[ground];
  const w = canvas.width, h = canvas.height, x = canvas.getContext('2d'), img = x.createImageData(w, h), px = img.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = (i + 0.5) / w, v = (j + 0.5) / h, th = tooth(u * 46, v * 31), wob = 0.02 * (vnoise(u * 7 + 3, v * 5 + 11) - 0.5);
    const dU = thickness(under, inside(u, v, 0.05, 0.08, 0.66, 0.70, wob), th), dT = thickness(top, inside(u, v, 0.34, 0.30, 0.95, 0.92, -wob), th);
    const R = paper ? onGround([layer(under.pig, dU), layer(top.pig, dT)], PAPER.map((c) => c * (1 + 0.16 * (th - 0.5)))) : mixOn(ground, [under, top], [Math.min(dU, 1.2), Math.min(dT, 1.2)]), k = (j * w + i) * 4;
    for (let c = 0; c < 3; c++) px[k + c] = Math.round(clamp(linToSrgb(clamp(R[c], 0, 1)), 0, 1) * 255); px[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return canvas;
}
