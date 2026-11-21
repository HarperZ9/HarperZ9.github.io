// estuary-homology.mjs: deterministic 2D Betti numbers (beta0, beta1),
// circular phase monodromy winding, and cross-medium homeomorphism certification.
// Zero-dependency ESM module.

const TAU = Math.PI * 2;
const DIRS4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIRS8 = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];

function cellScalar(cell) {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : 0;
  if (cell && typeof cell.energy === 'number') return Number.isFinite(cell.energy) ? cell.energy : 0;
  if (cell && cell.weights && typeof cell.weights === 'object') {
    const vals = Object.values(cell.weights).filter((v) => Number.isFinite(v));
    if (!vals.length) return 0;
    let sum = 0;
    for (let i = 0; i < vals.length; i++) sum += vals[i];
    return sum / vals.length;
  }
  return 0;
}

function normalizeScalarGrid(grid, width, height) {
  const src = grid?.grid || grid;
  const cells = ArrayBuffer.isView(src) ? src : (Array.isArray(src) ? src : (Array.isArray(src?.cells) ? src.cells : []));
  const w = Math.max(1, Math.trunc(width ?? src?.width ?? Math.round(Math.sqrt(cells.length)) ?? 1));
  const h = Math.max(1, Math.trunc(height ?? src?.height ?? Math.ceil(cells.length / w) ?? 1));
  const values = new Float64Array(w * h);
  const len = Math.min(values.length, cells.length);
  for (let i = 0; i < len; i++) values[i] = cellScalar(cells[i]);
  return { w, h, values };
}

function bfsRegion(mask, visited, start, w, h, dirs) {
  const queue = [start];
  visited[start] = 1;
  let touchesBorder = false;
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head];
    const x = idx % w;
    const y = (idx - x) / w;
    if (x === 0 || x === w - 1 || y === 0 || y === h - 1) touchesBorder = true;
    for (let d = 0; d < dirs.length; d++) {
      const nx = x + dirs[d][0];
      const ny = y + dirs[d][1];
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const ni = ny * w + nx;
      if (mask[ni] && !visited[ni]) {
        visited[ni] = 1;
        queue.push(ni);
      }
    }
  }
  return touchesBorder;
}

// Compute exact 0D foreground components (beta0, 4-connected) and
// 1D enclosed interior holes (beta1, 8-connected background not touching border).
export function computeBettiNumbers(grid, width, height, threshold = 0.45) {
  const thresh = Number.isFinite(threshold) ? threshold : 0.45;
  const { w, h, values } = normalizeScalarGrid(grid, width, height);
  const n = w * h;
  const fg = new Uint8Array(n);
  const bg = new Uint8Array(n);
  let foregroundCount = 0;
  for (let i = 0; i < n; i++) {
    if (values[i] >= thresh) {
      fg[i] = 1;
      foregroundCount++;
    } else {
      bg[i] = 1;
    }
  }

  const fgVisited = new Uint8Array(n);
  let beta0 = 0;
  for (let i = 0; i < n; i++) {
    if (fg[i] && !fgVisited[i]) {
      beta0++;
      bfsRegion(fg, fgVisited, i, w, h, DIRS4);
    }
  }

  const bgVisited = new Uint8Array(n);
  let beta1 = 0;
  for (let i = 0; i < n; i++) {
    if (bg[i] && !bgVisited[i]) {
      const touchesBorder = bfsRegion(bg, bgVisited, i, w, h, DIRS8);
      if (!touchesBorder) beta1++;
    }
  }

  return Object.freeze({
    beta0,
    beta1,
    eulerCharacteristic: beta0 - beta1,
    width: w,
    height: h,
    threshold: thresh,
    foregroundCount,
    backgroundCount: n - foregroundCount,
  });
}

function wrapDelta(delta) {
  let d = ((delta % TAU) + TAU) % TAU;
  if (d > Math.PI) d -= TAU;
  return d;
}

// Compute integer winding number around a closed loop of circular phase angles in [0, 2*pi).
export function computeMonodromyWinding(phases, loopIndices) {
  const src = ArrayBuffer.isView(phases) || Array.isArray(phases) ? phases : [];
  const indices = Array.isArray(loopIndices)
    ? loopIndices
    : Array.from({ length: src.length }, (_, i) => i);
  const count = indices.length;
  if (count < 2 || src.length === 0) {
    return Object.freeze({
      winding: 0,
      totalDelta: 0,
      hasSingularity: false,
      phaseFlip: false,
      direction: 'none',
      steps: 0,
    });
  }

  let totalDelta = 0;
  let phaseFlip = false;
  for (let i = 0; i < count; i++) {
    const a = Number(src[indices[i]]) || 0;
    const b = Number(src[indices[(i + 1) % count]]) || 0;
    const step = wrapDelta(b - a);
    if (Math.abs(Math.abs(step) - Math.PI) < 1e-6) phaseFlip = true;
    totalDelta += step;
  }

  const winding = Math.round(totalDelta / TAU) || 0;
  const hasSingularity = winding !== 0 || phaseFlip;
  const direction = winding > 0 ? 'ccw' : winding < 0 ? 'cw' : 'none';
  return Object.freeze({
    winding,
    totalDelta: Number(totalDelta.toFixed(6)),
    hasSingularity,
    phaseFlip,
    direction,
    steps: count,
  });
}

function extractBetti(topo) {
  const src = topo?.homology || topo || {};
  return {
    beta0: Math.max(0, Math.trunc(Number(src.beta0) || 0)),
    beta1: Math.max(0, Math.trunc(Number(src.beta1) || 0)),
  };
}

function fmtDelta(v) {
  return v > 0 ? `+${v}` : String(v);
}

// Certify whether a continuous cross-medium deformation preserved Betti invariants.
export function certifyHomeomorphism(topoA, topoB) {
  const a = extractBetti(topoA);
  const b = extractBetti(topoB);
  const deltaBeta0 = b.beta0 - a.beta0;
  const deltaBeta1 = b.beta1 - a.beta1;
  const preserved = deltaBeta0 === 0 && deltaBeta1 === 0;
  const status = preserved ? 'HOMEOMORPHIC_PRESERVED' : 'TOPOLOGY_CHANGED';
  const summary = preserved
    ? `Homeomorphism preserved (beta0=${b.beta0}, beta1=${b.beta1}, deltaBeta0=0, deltaBeta1=0).`
    : `Topology changed (deltaBeta0=${fmtDelta(deltaBeta0)}, deltaBeta1=${fmtDelta(deltaBeta1)}).`;
  return Object.freeze({
    status,
    preserved,
    deltaBeta0,
    deltaBeta1,
    eulerDelta: (b.beta0 - b.beta1) - (a.beta0 - a.beta1),
    from: Object.freeze(a),
    to: Object.freeze(b),
    summary,
  });
}

// Ordered perimeter cell indices around a width x height grid (clockwise).
export function perimeterLoopIndices(width, height) {
  const w = Math.max(1, Math.trunc(width));
  const h = Math.max(1, Math.trunc(height));
  const loop = [];
  for (let x = 0; x < w; x++) loop.push(x);
  for (let y = 1; y < h; y++) loop.push(y * w + (w - 1));
  if (h > 1) {
    for (let x = w - 2; x >= 0; x--) loop.push((h - 1) * w + x);
  }
  if (w > 1) {
    for (let y = h - 2; y >= 1; y--) loop.push(y * w);
  }
  return Object.freeze(loop);
}

// Combined homology and monodromy summary for a lantern aperture lattice.
export function analyzeLanternHomology(apertures, cols, rows, threshold = 0.45) {
  const betti = computeBettiNumbers(apertures, cols, rows, threshold);
  const phases = apertures.map((ap) => Number(ap?.spectrum?.harmonicPhase) || 0);
  const monodromy = computeMonodromyWinding(phases, perimeterLoopIndices(cols, rows));
  return Object.freeze({
    beta0: betti.beta0,
    beta1: betti.beta1,
    eulerCharacteristic: betti.eulerCharacteristic,
    threshold: betti.threshold,
    winding: monodromy.winding,
    hasSingularity: monodromy.hasSingularity,
    phaseFlip: monodromy.phaseFlip,
    direction: monodromy.direction,
  });
}
