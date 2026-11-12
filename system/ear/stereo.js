// stereo.js: the two channels against each other, and gaps in the sound.
//   correlation    +1 when left and right are the same signal, 0 when unrelated, -1 when one is the other upside down
//   width          side level over mid level in dB (mid = the sum of the channels, side = their difference)
//   mono loss      what the level does when both channels are summed to one speaker, in dB; 0 is no loss, and a large
//                  negative number means parts of the mix cancel on a phone or a single speaker
//   dropout        a stretch inside the programme where the level falls far under its surroundings
export function stereo(channels, sr, { window = 1 } = {}) {
  if (channels.length < 2) return { correlation: 1, minWindowCorrelation: 1, widthDb: -Infinity, monoLossDb: 0, balanceDb: 0 };
  const [L, R] = channels, n = L.length, W = Math.round(window * sr); let ll = 0, rr = 0, lr = 0, wl = 0, wr = 0, wx = 0, minC = 1;
  for (let i = 0; i < n; i++) {
    const a = L[i], b = R[i]; ll += a * a; rr += b * b; lr += a * b; wl += a * a; wr += b * b; wx += a * b;
    if ((i + 1) % W === 0) { if (wl > 1e-7 * W && wr > 1e-7 * W) minC = Math.min(minC, wx / Math.sqrt(wl * wr)); wl = wr = wx = 0; }
  }
  const mid = (ll + rr + 2 * lr) / 4, side = (ll + rr - 2 * lr) / 4, each = (ll + rr) / 2;
  return { correlation: lr / (Math.sqrt(ll * rr) || 1e-20), minWindowCorrelation: minC, widthDb: 10 * Math.log10((side || 1e-20) / (mid || 1e-20)),
    monoLossDb: 10 * Math.log10((mid || 1e-20) / (each || 1e-20)), balanceDb: 10 * Math.log10((ll || 1e-20) / (rr || 1e-20)) };
}

// Gaps: 5 ms level frames per channel. A frame is a gap when it sits under -70 dBFS or more than `dropDb` under the median
// of the two seconds around it; gaps of `minMs` or longer between the first and last sounding frame are reported.
export function gaps(channels, sr, { frameMs = 5, minMs = 12, dropDb = 30, headDb = -55 } = {}) {
  const F = Math.round(frameMs / 1000 * sr), found = []; let lead = 0, trail = 0;
  channels.forEach((c, ch) => {
    const lv = []; for (let s = 0; s + F <= c.length; s += F) { let e = 0; for (let i = s; i < s + F; i++) e += c[i] * c[i]; lv.push(10 * Math.log10(e / F + 1e-14)); }
    let first = lv.findIndex((v) => v > headDb), last = lv.length - 1; while (last > 0 && lv[last] <= headDb) last--;
    if (first < 0) { first = 0; last = -1; }
    if (ch === 0) { lead = first * F / sr; trail = (lv.length - 1 - last) * F / sr; }
    const half = Math.round(1000 / frameMs), med = new Map(); let run = 0;   // one median per second of frames, over the two seconds around it
    const around = (i) => { const k = Math.floor(i / half); if (!med.has(k)) { const w = lv.slice(Math.max(first, (k - 1) * half + (half >> 1)), Math.min(last, (k + 1) * half + (half >> 1)) + 1).sort((x, y) => x - y); med.set(k, w[w.length >> 1]); } return med.get(k); };
    for (let i = first; i <= last + 1; i++) {
      let gap = false;
      if (i <= last) gap = lv[i] < -70 || lv[i] < around(i) - dropDb;
      if (gap) run++; else { if (run * frameMs >= minMs) found.push({ channel: ch, t: (i - run) * F / sr, ms: run * frameMs }); run = 0; }
    }
  });
  return { dropouts: found, leadingSilence: lead, trailingSilence: trail };
}
