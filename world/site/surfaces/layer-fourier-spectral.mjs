// layer-fourier-spectral.mjs: Live Fourier epicycles + harmonic spectrum field coupled
// bidirectionally to the Unified /playground/ Studio DAW audio_features port (Wave 33A-1).

export const LAYER_META = Object.freeze({
  id: 'fourier',
  name: 'Fourier Epicycles & Spectrum',
  discipline: 'Type, Lettering & Epicycles',
  route: 'DAW <-> Fourier',
  takes: ['audio_features', 'type_field', 'frame'],
  gives: ['vector', 'frame', 'audio_features'],
  defaultOn: true,
  defaultOpacity: 0.84,
  defaultBlend: 'screen',
});

const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
const TAU = Math.PI * 2;

// Generate deterministic closed parametric contour from a word (or geometric loop)
export function generateWordContour(text = 'ESTUARY', nSamples = 64) {
  const s = (String(text || 'ESTUARY').trim().toUpperCase()) || 'ESTUARY';
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) hash = Math.imul(hash ^ s.charCodeAt(i), 16777619) >>> 0;
  const k1 = 2 + (hash % 4);
  const k2 = 3 + ((hash >>> 4) % 5);
  const k3 = 5 + ((hash >>> 9) % 7);
  const pts = [];
  for (let i = 0; i < nSamples; i++) {
    const a = (i / nSamples) * TAU;
    const r = 0.58 + 0.22 * Math.cos(k1 * a) + 0.14 * Math.sin(k2 * a + 0.6) + 0.08 * Math.cos(k3 * a - 0.4);
    pts.push([r * Math.cos(a), r * Math.sin(a) * 0.72]);
  }
  return pts;
}

// Complex DFT of closed 2D contour -> sorted epicycle terms [{ k, re, im, amp, phase }]
export function computeEpicycles(points, maxTerms = 24) {
  const N = points.length;
  if (N < 4) throw new RangeError('fourier: need at least 4 contour points');
  const terms = [];
  const half = Math.floor(N / 2);
  for (let k = -half; k < N - half; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const ang = -(TAU * k * n) / N;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const [x, y] = points[n];
      re += x * ca - y * sa;
      im += x * sa + y * ca;
    }
    re /= N; im /= N;
    terms.push({ k, re, im, amp: Math.hypot(re, im), phase: Math.atan2(im, re) });
  }
  terms.sort((a, b) => b.amp - a.amp);
  return terms.slice(0, Math.min(maxTerms, terms.length));
}

// Evaluate epicycle chain at angle theta in [0, 2*pi), returning final point + joint chain
export function evalEpicycles(terms, theta) {
  let x = 0, y = 0;
  const joints = [[0, 0]];
  for (let i = 0; i < terms.length; i++) {
    const tr = terms[i];
    const ang = tr.k * theta + tr.phase;
    x += tr.amp * Math.cos(ang);
    y += tr.amp * Math.sin(ang);
    joints.push([x, y]);
  }
  return { x, y, joints };
}

// Forward coupling: modulate epicycle amplitudes & phases from DAW audio_features
export function audioToHarmonics(audio, terms) {
  const bands = audio?.bands8 || [0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15];
  const rms = clamp(audio?.rms ?? 0.35);
  const beat = clamp(audio?.beatPhase ?? 0);
  return terms.map((tr, idx) => {
    const b = clamp(bands[idx % 8] ?? 0.3);
    const scale = tr.k === 0 ? 1 : 0.72 + b * 0.68 + rms * 0.22;
    const phaseShift = tr.k === 0 ? 0 : beat * Math.sign(tr.k) * 0.18;
    const amp = tr.amp * scale;
    const phase = tr.phase + phaseShift;
    return { k: tr.k, re: amp * Math.cos(phase), im: amp * Math.sin(phase), amp, phase };
  });
}

// Reverse coupling: synthesize valid patchbay audio_features from active epicycle harmonics
export function harmonicsToAudioFeatures(terms, { bpm = 128, beatPhase = 0.25 } = {}) {
  const bands8 = new Array(8).fill(0);
  let num = 0, den = 0;
  for (let i = 0; i < terms.length; i++) {
    const tr = terms[i];
    const bin = Math.min(7, Math.abs(tr.k) % 8);
    bands8[bin] += tr.amp;
    const hz = 80 * (1 + Math.abs(tr.k) * 1.45);
    num += hz * tr.amp;
    den += tr.amp;
  }
  const maxB = Math.max(1e-6, ...bands8);
  const norm = bands8.map((v) => Number(clamp(v / maxB, 0.04, 1).toFixed(4)));
  const rms = Number(clamp(Math.sqrt(norm.reduce((s, v) => s + v * v, 0) / 8), 0.05, 0.98).toFixed(4));
  const spectralCentroidHz = Number(clamp(den > 1e-6 ? num / den : 680, 80, 12000).toFixed(1));
  return {
    rms,
    spectralCentroidHz,
    bands8: norm,
    beatPhase: clamp(beatPhase),
    onset: norm[0] > 0.72,
    bpm: clamp(bpm, 40, 240),
    lufs: Number((-22 + rms * 10).toFixed(1)),
  };
}

export function renderFourierLayer(ctx, state = {}, opts = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  const t = Number(state.time) || 0;
  const word = state.text || 'ESTUARY';
  const baseTerms = computeEpicycles(generateWordContour(word, 64), opts.maxTerms ?? 18);
  const terms = audioToHarmonics(state.audio, baseTerms);
  const cx = W * (opts.cx ?? 0.5), cy = H * (opts.cy ?? 0.5), scale = Math.min(W, H) * 0.36;
  const theta = (t * 0.75) % TAU;
  const cur = evalEpicycles(terms, theta);

  // Draw rotating epicycle circles and linkage arms
  ctx.lineWidth = 1;
  for (let i = 0; i < terms.length; i++) {
    const [jx, jy] = cur.joints[i], [nx, ny] = cur.joints[i + 1];
    const r = terms[i].amp * scale;
    if (r < 1.2) continue;
    ctx.strokeStyle = 'rgba(130, 198, 212, 0.28)';
    ctx.beginPath();
    ctx.arc(cx + jx * scale, cy + jy * scale, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(236, 229, 214, 0.52)';
    ctx.beginPath();
    ctx.moveTo(cx + jx * scale, cy + jy * scale);
    ctx.lineTo(cx + nx * scale, cy + ny * scale);
    ctx.stroke();
  }

  // Draw glowing traced Fourier curve
  ctx.beginPath();
  const traceSteps = 96;
  for (let s = 0; s <= traceSteps; s++) {
    const pt = evalEpicycles(terms, (s / traceSteps) * TAU);
    const px = cx + pt.x * scale, py = cy + pt.y * scale;
    if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = 'rgba(215, 158, 53, 0.92)';
  ctx.lineWidth = 2.0;
  ctx.stroke();

  // Draw bottom harmonic spectrum ribbon synced to bands8
  const bands = state.audio?.bands8 || harmonicsToAudioFeatures(terms).bands8;
  const bw = (W - 96) / bands.length;
  for (let i = 0; i < bands.length; i++) {
    const bh = clamp(bands[i]) * (H * 0.16);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(215, 158, 53, 0.35)' : 'rgba(130, 198, 212, 0.35)';
    ctx.fillRect(48 + i * bw + 4, H - 24 - bh, bw - 8, bh);
  }
  return { terms, cur };
}

export function fourierTransform(input, ctx, digestFn) {
  const word = ctx.inPort === 'type_field' ? input.text : 'ESTUARY';
  const audioIn = ctx.inPort === 'audio_features' ? input : ctx.lastByEnginePort?.get('daw:audio_features');
  const baseTerms = computeEpicycles(generateWordContour(word, 64), 16);
  const terms = audioToHarmonics(audioIn, baseTerms);
  const pts = [];
  for (let s = 0; s <= 32; s++) {
    const p = evalEpicycles(terms, (s / 32) * TAU);
    pts.push(`${(128 + p.x * 96).toFixed(1)} ${(80 + p.y * 62).toFixed(1)}`);
  }
  const d = `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 160" width="256" height="160"><path d="${d}" fill="none" stroke="#d79e35" stroke-width="1.6"/></svg>`;
  const audioOut = harmonicsToAudioFeatures(terms, { bpm: audioIn?.bpm ?? 128, beatPhase: audioIn?.beatPhase ?? 0.25 });
  const lumaGrid = Array.from({ length: 32 }, (_, i) => Math.round(clamp(0.18 + audioOut.bands8[i % 8] * 0.78) * 255));
  return {
    vector: { svg, paths: [d], viewBox: '0 0 256 160', strokeCount: 1 },
    audio_features: audioOut,
    frame: {
      width: 8, height: 4, lumaGrid,
      pixelsSha256: digestFn({ width: 8, height: 4, lumaGrid, source: 'fourier' }),
      transfer: 'srgb-u8', source: 'fourier',
    },
  };
}
