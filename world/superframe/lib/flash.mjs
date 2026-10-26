// flash.mjs: a guard for WCAG 2.3.1 (Three Flashes or Below Threshold) on generated motion.
//
// A general flash, per WCAG 2.x, is a pair of opposing changes in relative luminance of 10% or more of the maximum,
// where the darker image is below 0.80, over a combined area large enough to matter (a quarter of a 10 degree visual
// field; on a full frame this is approximated here by any one of 16 regions, each a 1/16 of the frame, which is
// stricter than the standard). A red flash is a pair of opposing changes into and out of saturated red. Content must
// not flash more than three times in any one-second period.
//
// analyseFlashes(motion) counts both kinds in every one-second window. guardFlashes(motion) returns motion that
// passes by slowing the frame rate; it runs the same analyser on its result, so the guard is tested by the check.
const REGIONS = 4; // 4 x 4 regions
const lin = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

// Per frame, per region: mean relative luminance and saturated-red share. Frames are linear RGBA already.
function readings(M) {
  const rw = Math.ceil(M.w / REGIONS), rh = Math.ceil(M.h / REGIONS);
  return M.frames.map(f => {
    const L = new Float64Array(REGIONS * REGIONS), red = new Float64Array(REGIONS * REGIONS), n = new Float64Array(REGIONS * REGIONS);
    for (let y = 0; y < M.h; y += 2) for (let x = 0; x < M.w; x += 2) {
      const i = 4 * (y * M.w + x), r = f[i], g = f[i + 1], b = f[i + 2], k = Math.floor(y / rh) * REGIONS + Math.floor(x / rw);
      L[k] += 0.2126 * r + 0.7152 * g + 0.0722 * b; n[k]++;
      if (r / (r + g + b + 1e-6) >= 0.8 && r > 0.05) red[k]++;
    }
    for (let k = 0; k < L.length; k++) { L[k] /= n[k] || 1; red[k] /= n[k] || 1; }
    return { L, red };
  });
}

// Flash times (frame indices) per region: a flash completes when a change reverses an earlier opposite change.
function flashEvents(R) {
  const events = [];
  for (let k = 0; k < REGIONS * REGIONS; k++) {
    let lastDir = 0, lastRed = 0;
    for (let i = 1; i < R.length; i++) {
      const a = R[i - 1].L[k], b = R[i].L[k], d = b - a;
      if (Math.abs(d) >= 0.1 && Math.min(a, b) < 0.8) { const dir = Math.sign(d); if (lastDir && dir !== lastDir) events.push(i); lastDir = dir; }
      const ra = R[i - 1].red[k] > 0.25, rb = R[i].red[k] > 0.25;
      if (ra !== rb) { const dir = rb ? 1 : -1; if (lastRed && dir !== lastRed) events.push(i); lastRed = dir; }
    }
  }
  return events.sort((p, q) => p - q);
}

export function analyseFlashes(M) {
  const ev = flashEvents(readings(M)), win = Math.max(1, Math.round(M.fps)); let worst = 0;
  // events from different regions at the same frame count once: a flash is an event in time
  const times = [...new Set(ev)];
  for (let i = 0; i < times.length; i++) { let j = i; while (j < times.length && times[j] - times[i] < win) j++; worst = Math.max(worst, j - i); }
  return { flashesPerSecond: worst, pass: worst <= 3, events: times.length };
}

export function guardFlashes(M) {
  // Slowing the clock is the only remedy used: it never blends two pictures, so a guarded story still never shows
  // two beats at once. Each pass lowers the frame rate by a quarter until no one-second window holds more than three.
  let out = { ...M }, a = analyseFlashes(out);
  while (!a.pass && out.fps > 0.25) { out = { ...out, fps: +(out.fps * 0.75).toFixed(4) }; a = analyseFlashes(out); }
  return { ...out, flash: a };
}
export { lin };
