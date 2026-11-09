// lib/ssim.mjs: structural similarity (Wang, Bovik, Sheikh and Simoncelli, 2004) on grayscale fields, for golden-image
// tests. Mean SSIM over 8 x 8 windows with stride 4, constants for a [0,1] range. Pure; runs in node and the browser.
export function ssim(a, b, w, h, { win = 8, stride = 4 } = {}) {
  if (a.length !== b.length || a.length !== w * h) throw new Error(`ssim: size mismatch ${a.length} ${b.length} ${w}x${h}`);
  const C1 = 0.01 ** 2, C2 = 0.03 ** 2; let sum = 0, n = 0;
  for (let y = 0; y + win <= h; y += stride) for (let x = 0; x + win <= w; x += stride) {
    let ma = 0, mb = 0; for (let j = 0; j < win; j++) for (let i = 0; i < win; i++) { const k = (y + j) * w + x + i; ma += a[k]; mb += b[k]; }
    const N = win * win; ma /= N; mb /= N; let va = 0, vb = 0, cov = 0;
    for (let j = 0; j < win; j++) for (let i = 0; i < win; i++) { const k = (y + j) * w + x + i, da = a[k] - ma, db = b[k] - mb; va += da * da; vb += db * db; cov += da * db; }
    va /= N - 1; vb /= N - 1; cov /= N - 1;
    sum += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2)); n++;
  }
  return n ? sum / n : 1;
}

// Box-downsample a field to tw x th (golden thumbnails stay small and tolerant of sub-pixel shifts).
export function thumb(f, w, h, tw, th) {
  const out = new Float32Array(tw * th), cnt = new Float32Array(tw * th);
  for (let y = 0; y < h; y++) { const ty = Math.min(th - 1, Math.floor(y * th / h)); for (let x = 0; x < w; x++) { const k = ty * tw + Math.min(tw - 1, Math.floor(x * tw / w)); out[k] += f[y * w + x]; cnt[k]++; } }
  for (let i = 0; i < out.length; i++) out[i] /= cnt[i] || 1;
  return out;
}

// Encode and decode a [0,1] field as 8-bit base64, the format of tests/golden/*.json.
export function encode(f) { const u = Uint8Array.from(f, v => Math.max(0, Math.min(255, Math.round(v * 255)))); return typeof Buffer !== 'undefined' ? Buffer.from(u).toString('base64') : btoa(String.fromCharCode(...u)); }
export function decode(s) { const u = typeof Buffer !== 'undefined' ? Uint8Array.from(Buffer.from(s, 'base64')) : Uint8Array.from(atob(s), c => c.charCodeAt(0)); return Float32Array.from(u, v => v / 255); }
