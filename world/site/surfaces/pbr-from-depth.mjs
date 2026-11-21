// pbr-from-depth.mjs: deterministic, discontinuity-aware Depth-to-Normal and PBR
// material map synthesizer (normal, roughness, ambient occlusion, height, and
// silhouette discontinuity mask) for The Playground, Estuary, and native/ bridges.
// Zero-dependency ESM; runs identically in Node and browser.

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function fnv1aHex(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Compute edge-preserving central/one-sided derivative along one axis so a
 * sharp foreground-background depth jump is not smeared into a false 3D wall.
 */
function safeDerivative(center, left, right, jumpThreshold) {
  const dl = Math.abs(center - left);
  const dr = Math.abs(right - center);
  const lValid = dl <= jumpThreshold;
  const rValid = dr <= jumpThreshold;
  if (lValid && rValid) return { grad: 0.5 * (right - left), jump: false };
  if (rValid && !lValid) return { grad: right - center, jump: true };
  if (lValid && !rValid) return { grad: center - left, jump: true };
  return { grad: 0, jump: true };
}

/**
 * Synthesize tangent-space Normal RGBA, Roughness, Cavity/AO, Height, and
 * Discontinuity Mask maps from a scalar depth/height field (Float32Array or Array).
 *
 * Options:
 * - scale: world height-to-pixel scale (default 1.0)
 * - jumpThreshold: depth delta treated as a silhouette discontinuity (default 0.25)
 * - baseRoughness: baseline material roughness in [0, 1] (default 0.35)
 * - roughnessGain: slope-variance contribution to roughness (default 0.55)
 * - aoStrength: local cavity darkening gain (default 1.4)
 */
export function synthesizePbrFromDepth(depth, width, height, options = {}) {
  const w = Math.max(3, Math.floor(width));
  const h = Math.max(3, Math.floor(height));
  if (depth.length < w * h) throw new Error(`depth length ${depth.length} < ${w * h}`);

  const scale = Number(options.scale ?? 1.0);
  const jumpThreshold = Number(options.jumpThreshold ?? 0.25);
  const baseRoughness = clamp01(Number(options.baseRoughness ?? 0.35));
  const roughnessGain = Number(options.roughnessGain ?? 0.55);
  const aoStrength = Number(options.aoStrength ?? 1.4);

  const count = w * h;
  const normalRgba = new Uint8Array(count * 4);
  const roughness = new Uint8Array(count);
  const ao = new Uint8Array(count);
  const heightMap = new Uint8Array(count);
  const discontinuity = new Uint8Array(count);

  let minD = Infinity;
  let maxD = -Infinity;
  for (let i = 0; i < count; i++) {
    const v = depth[i];
    if (v < minD) minD = v;
    if (v > maxD) maxD = v;
  }
  const span = maxD - minD > 1e-9 ? maxD - minD : 1.0;

  let jumpPixels = 0;
  for (let y = 0; y < h; y++) {
    const ym = Math.max(0, y - 1);
    const yp = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const xm = Math.max(0, x - 1);
      const xp = Math.min(w - 1, x + 1);
      const idx = y * w + x;
      const c = depth[idx];

      const dx = safeDerivative(c, depth[y * w + xm], depth[y * w + xp], jumpThreshold);
      const dy = safeDerivative(c, depth[ym * w + x], depth[yp * w + x], jumpThreshold);

      if (dx.jump || dy.jump) {
        discontinuity[idx] = 255;
        jumpPixels++;
      }

      // Tangent-space normal: n = normalize(-dz/dx * scale, -dz/dy * scale, 1)
      const nxRaw = -dx.grad * scale;
      const nyRaw = -dy.grad * scale;
      const nzRaw = 1.0;
      const invLen = 1.0 / Math.hypot(nxRaw, nyRaw, nzRaw);
      const nx = nxRaw * invLen;
      const ny = nyRaw * invLen;
      const nz = nzRaw * invLen;

      const o = idx * 4;
      normalRgba[o] = Math.round((nx * 0.5 + 0.5) * 255);
      normalRgba[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normalRgba[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normalRgba[o + 3] = 255;

      // Local micro-roughness from gradient magnitude (clamped across jumps)
      const slopeMag = Math.hypot(dx.grad, dy.grad) * scale;
      const roughVal = clamp01(baseRoughness + roughnessGain * Math.min(1.0, slopeMag));
      roughness[idx] = Math.round(roughVal * 255);

      // Local cavity / ambient occlusion from neighbor heights within jump bound
      let neighSum = 0;
      let neighCount = 0;
      const neighbors = [depth[y * w + xm], depth[y * w + xp], depth[ym * w + x], depth[yp * w + x]];
      for (const nv of neighbors) {
        if (Math.abs(nv - c) <= jumpThreshold) {
          neighSum += nv;
          neighCount++;
        }
      }
      const meanNeigh = neighCount > 0 ? neighSum / neighCount : c;
      const cavity = Math.max(0, (meanNeigh - c) * scale);
      ao[idx] = Math.round(clamp01(1.0 - cavity * aoStrength) * 255);

      heightMap[idx] = Math.round(clamp01((c - minD) / span) * 255);
    }
  }

  return {
    width: w,
    height: h,
    normalRgba,
    roughness,
    ao,
    heightMap,
    discontinuity,
    stats: {
      discontinuityFraction: Number((jumpPixels / count).toFixed(4)),
      minDepth: Number(minD.toFixed(6)),
      maxDepth: Number(maxD.toFixed(6)),
    },
    receipt: fnv1aHex(normalRgba),
  };
}
