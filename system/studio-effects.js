// studio-effects.js: deterministic canvas effects for the Studio media lab.
// Each transform mutates ImageData in-place or rewrites the canvas from that data.
// No randomness, no dependencies, and no raw media leaves the browser.

export const TRANSFORM_GROUPS = Object.freeze([
  {
    label: "Tone",
    items: [
      ["grayscale", "gray"],
      ["invert", "invert"],
      ["threshold", "threshold"],
      ["posterize", "posterize"],
      ["duotone", "duotone"],
    ],
  },
  {
    label: "Print",
    items: [
      ["dither", "dither"],
      ["halftone", "halftone"],
      ["scanlines", "scanlines"],
    ],
  },
  {
    label: "Glitch",
    items: [
      ["pixelSort", "pixel sort"],
      ["chromatic", "chromatic"],
      ["glitch", "glitch"],
    ],
  },
  {
    label: "Geometry",
    items: [
      ["mirror", "mirror"],
      ["edges", "edges"],
    ],
  },
]);

const EFFECT_KEYS = new Set(TRANSFORM_GROUPS.flatMap((g) => g.items.map(([key]) => key)));

export function isEffectKey(key) {
  return EFFECT_KEYS.has(key);
}

export function applyCanvasEffect(ctx, canvas, key) {
  if (!ctx || !canvas || !isEffectKey(key)) return false;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const out = runEffect(img, key);
  ctx.putImageData(out, 0, 0);
  return true;
}

export function runEffect(imageData, key) {
  const w = imageData.width;
  const h = imageData.height;
  const d = imageData.data;
  if (key === "grayscale") grayscale(d);
  else if (key === "invert") invert(d);
  else if (key === "threshold") threshold(d);
  else if (key === "posterize") posterize(d);
  else if (key === "duotone") duotone(d);
  else if (key === "dither") orderedDither(d, w, h);
  else if (key === "halftone") halftone(d, w, h);
  else if (key === "scanlines") scanlines(d, w, h);
  else if (key === "pixelSort") pixelSortRows(d, w, h);
  else if (key === "chromatic") return chromaticAberration(imageData);
  else if (key === "glitch") glitchRows(d, w, h);
  else if (key === "mirror") mirrorRows(d, w, h);
  else if (key === "edges") return sobelEdges(imageData);
  else throw new Error("unknown Studio effect: " + key);
  return imageData;
}

function luma(d, i) {
  return (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
}

function grayscale(d) {
  for (let i = 0; i < d.length; i += 4) {
    const g = luma(d, i);
    d[i] = d[i + 1] = d[i + 2] = g;
  }
}

function invert(d) {
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i];
    d[i + 1] = 255 - d[i + 1];
    d[i + 2] = 255 - d[i + 2];
  }
}

function threshold(d) {
  for (let i = 0; i < d.length; i += 4) {
    const g = luma(d, i) > 127 ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = g;
  }
}

function posterize(d) {
  const q = (v) => Math.round(v / 85) * 85;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = q(d[i]);
    d[i + 1] = q(d[i + 1]);
    d[i + 2] = q(d[i + 2]);
  }
}

function duotone(d) {
  const lo = [13, 27, 28];
  const hi = [239, 171, 48];
  for (let i = 0; i < d.length; i += 4) {
    const t = luma(d, i) / 255;
    d[i] = lo[0] + (hi[0] - lo[0]) * t;
    d[i + 1] = lo[1] + (hi[1] - lo[1]) * t;
    d[i + 2] = lo[2] + (hi[2] - lo[2]) * t;
  }
}

function orderedDither(d, w, h) {
  const bayer = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5,
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const t = (bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      const v = luma(d, i) / 255 > t ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
}

function halftone(d, w, h) {
  const src = new Uint8ClampedArray(d);
  const cell = 6;
  for (let by = 0; by < h; by += cell) {
    for (let bx = 0; bx < w; bx += cell) {
      let sum = 0;
      let count = 0;
      for (let y = by; y < Math.min(h, by + cell); y++) {
        for (let x = bx; x < Math.min(w, bx + cell); x++) {
          sum += luma(src, (y * w + x) * 4);
          count++;
        }
      }
      const avg = count ? sum / count : 0;
      const radius = (1 - avg / 255) * cell * 0.55;
      const cx = bx + cell / 2;
      const cy = by + cell / 2;
      for (let y = by; y < Math.min(h, by + cell); y++) {
        for (let x = bx; x < Math.min(w, bx + cell); x++) {
          const i = (y * w + x) * 4;
          const inside = Math.hypot(x - cx, y - cy) <= radius;
          const v = inside ? 18 : 232;
          d[i] = d[i + 1] = d[i + 2] = v;
        }
      }
    }
  }
}

function scanlines(d, w, h) {
  for (let y = 0; y < h; y++) {
    const f = (y % 4 < 2) ? 0.72 : 1.08;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      d[i] = clampByte(d[i] * f);
      d[i + 1] = clampByte(d[i + 1] * f);
      d[i + 2] = clampByte(d[i + 2] * f);
    }
  }
}

function pixelSortRows(d, w, h) {
  for (let y = 0; y < h; y++) {
    if (y % 2) continue;
    const row = [];
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      row.push([d[i], d[i + 1], d[i + 2], d[i + 3], luma(d, i)]);
    }
    row.sort((a, b) => a[4] - b[4]);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const p = row[x];
      d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = p[3];
    }
  }
}

function chromaticAberration(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const out = new ImageData(w, h);
  const d = out.data;
  const sample = (x, y, c) => {
    const xx = Math.max(0, Math.min(w - 1, x));
    const yy = Math.max(0, Math.min(h - 1, y));
    return src[(yy * w + xx) * 4 + c];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      d[i] = sample(x - 3, y, 0);
      d[i + 1] = sample(x, y, 1);
      d[i + 2] = sample(x + 3, y, 2);
      d[i + 3] = src[i + 3];
    }
  }
  return out;
}

function glitchRows(d, w, h) {
  const src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) {
    const block = Math.floor(y / 9);
    const shift = ((block * 37) % 17) - 8;
    const tint = (block % 5) * 8;
    for (let x = 0; x < w; x++) {
      const sx = (x + shift + w) % w;
      const si = (y * w + sx) * 4;
      const i = (y * w + x) * 4;
      d[i] = clampByte(src[si] + tint);
      d[i + 1] = src[si + 1];
      d[i + 2] = clampByte(src[si + 2] + (block % 3) * 10);
      d[i + 3] = src[si + 3];
    }
  }
}

function mirrorRows(d, w, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < Math.floor(w / 2); x++) {
      const a = (y * w + x) * 4;
      const b = (y * w + (w - 1 - x)) * 4;
      for (let c = 0; c < 4; c++) {
        const t = d[a + c];
        d[a + c] = d[b + c];
        d[b + c] = t;
      }
    }
  }
}

function sobelEdges(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const out = new ImageData(w, h);
  const od = out.data;
  const lum = (x, y) => {
    const xx = Math.max(0, Math.min(w - 1, x));
    const yy = Math.max(0, Math.min(h - 1, y));
    return luma(src, (yy * w + xx) * 4);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = -lum(x - 1, y - 1) - 2 * lum(x - 1, y) - lum(x - 1, y + 1)
        + lum(x + 1, y - 1) + 2 * lum(x + 1, y) + lum(x + 1, y + 1);
      const sy = -lum(x - 1, y - 1) - 2 * lum(x, y - 1) - lum(x + 1, y - 1)
        + lum(x - 1, y + 1) + 2 * lum(x, y + 1) + lum(x + 1, y + 1);
      const v = Math.min(255, Math.hypot(sx, sy));
      const i = (y * w + x) * 4;
      od[i] = od[i + 1] = od[i + 2] = v;
      od[i + 3] = 255;
    }
  }
  return out;
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}
