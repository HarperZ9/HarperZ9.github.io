// lib/fourier/fft.mjs: in-place radix-2 FFT, n a power of two. Forward is unscaled with e^(-2 pi i jk / n); the
// inverse (sign = 1) is unscaled too, so the caller divides by n. Kept here so lettering runs on its own when the
// site copies it; tests check it against the kernel's DFT and the packages' FFT.
export function fft(re, im, sign = -1) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; while (j & bit) { j ^= bit; bit >>= 1; } j |= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (sign * 2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a), h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let q = 0; q < h; q++) {
        const u = i + q, v = u + h, tr = re[v] * cr - im[v] * ci, ti = re[v] * ci + im[v] * cr;
        re[v] = re[u] - tr; im[v] = im[u] - ti; re[u] += tr; im[u] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
