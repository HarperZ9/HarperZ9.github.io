// estuary-field.mjs: continuous elemental property field for the site estuary.
// Zero-dependency ESM module representing refraction, fluid, measure, cad, and sound
// as continuous weighted properties [0..1] with deterministic halocline blending
// and full genotype-to-phenotype parity across visual and accessible environments.

export const ESTUARY_PROPERTIES = Object.freeze([
  'refraction',
  'fluid',
  'measure',
  'cad',
  'sound',
]);

export const PROPERTY_PAIRS = Object.freeze(
  ESTUARY_PROPERTIES.flatMap((a, i) =>
    ESTUARY_PROPERTIES.slice(i + 1).map((b) => Object.freeze([a, b])),
  ),
);

const PROPERTY_META = Object.freeze({
  refraction: { label: 'Refraction', unit: 'RI' },
  fluid: { label: 'Fluid flow', unit: 'mm/s' },
  measure: { label: 'Measurement probe', unit: 'gain' },
  cad: { label: 'CAD span', unit: 'mm' },
  sound: { label: 'Sound voice', unit: 'Hz' },
});

export function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function smoothstep(edge0, edge1, x) {
  if (edge1 <= edge0) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// Smooth C1 halocline mixing curve mapping t in [0, 1] -> [0, 1] with no jumps.
export function haloclineWeight(t, steepness = 2.0) {
  const u = clamp01(t);
  const k = Math.max(1, Math.min(6, Number.isFinite(steepness) ? steepness : 2.0));
  const a = Math.pow(u, k);
  const b = Math.pow(1 - u, k);
  const denom = a + b;
  return denom <= 0 ? u : a / denom;
}

// Deterministic 32-bit PCG-style PRNG step returning [0, 1).
export function createRng(seed = 1) {
  let state = (seed >>> 0) || 1;
  return function next() {
    state = (Math.imul(state, 747796405) + 2891336453) >>> 0;
    const shift = (state >>> 28) + 4;
    const word = Math.imul(((state >>> shift) ^ state) >>> 0, 277803737) >>> 0;
    return (((word >>> 22) ^ word) >>> 0) / 4294967296;
  };
}

export function normalizeWeights(raw = {}) {
  const out = {};
  for (const prop of ESTUARY_PROPERTIES) {
    out[prop] = clamp01(raw[prop] ?? 0);
  }
  return Object.freeze(out);
}

export function createGenotype(spec = {}) {
  const id = String(spec.id || 'element');
  const name = String(spec.name || id);
  const x = Number.isFinite(spec.x) ? spec.x : 0.5;
  const y = Number.isFinite(spec.y) ? spec.y : 0.5;
  const radius = Number.isFinite(spec.radius) && spec.radius > 0 ? spec.radius : 0.35;
  const rim = Number.isFinite(spec.rim) && spec.rim > 0 ? spec.rim : radius * 0.3;
  const seed = (Number.isFinite(spec.seed) ? spec.seed : 1) >>> 0;
  const weights = normalizeWeights(spec.weights);
  return Object.freeze({ id, name, x, y, radius, rim, seed, weights });
}

export function blendVectors(vecA, vecB, t, { steepness = 2.0 } = {}) {
  const a = normalizeWeights(vecA);
  const b = normalizeWeights(vecB);
  const h = haloclineWeight(t, steepness);
  const weights = {};
  for (const prop of ESTUARY_PROPERTIES) {
    weights[prop] = clamp01(a[prop] * (1 - h) + b[prop] * h);
  }
  const couplings = Object.freeze({
    causticShear: weights.refraction * weights.fluid,
    acousticAdvection: weights.fluid * weights.sound,
    probedTolerance: weights.measure * weights.cad,
    opticalResonance: weights.refraction * weights.sound,
    measuredIndex: weights.refraction * weights.measure,
  });
  const halocline = 4 * h * (1 - h);
  return Object.freeze({ t: clamp01(t), mix: h, halocline, weights: Object.freeze(weights), couplings });
}

export function recombineGenotypes(genA, genB, t, { id, name, steepness = 2.0 } = {}) {
  const a = createGenotype(genA);
  const b = createGenotype(genB);
  const blended = blendVectors(a.weights, b.weights, t, { steepness });
  const h = blended.mix;
  const nextSeed = ((Math.imul(a.seed, 2654435761) ^ Math.imul(b.seed, 2246822519)) >>> 0) || 1;
  return createGenotype({
    id: id || `${a.id}-${b.id}`,
    name: name || `${a.name} and ${b.name}`,
    x: a.x * (1 - h) + b.x * h,
    y: a.y * (1 - h) + b.y * h,
    radius: a.radius * (1 - h) + b.radius * h,
    rim: a.rim * (1 - h) + b.rim * h,
    seed: nextSeed,
    weights: blended.weights,
  });
}

function discMask(dx, dy, radius, rim) {
  return 1 - smoothstep(radius - rim, radius + rim, Math.hypot(dx, dy));
}

function unionStrength(a, b) {
  return 1 - (1 - a) * (1 - b);
}

function deriveObservables(w, phase, reducedMotion) {
  const refractiveIndex = 1 + 0.52 * w.refraction + 0.14 * w.refraction * w.fluid;
  const flowSpeedMmS = 48 * w.fluid * (1 + 0.25 * w.refraction);
  const motionScale = reducedMotion ? 0 : 1;
  const vx = flowSpeedMmS * Math.cos(phase) * motionScale;
  const vy = flowSpeedMmS * Math.sin(phase) * motionScale;
  const probeGain = w.measure * (1 + 0.15 * w.fluid);
  const spanMm = 20 + 180 * w.cad;
  const toleranceMm = 0.05 + 0.45 * (1 - 0.6 * w.measure) * (0.2 + 0.8 * w.cad);
  const freqHz = 110 + 330 * w.sound + 45 * w.sound * w.fluid;
  return Object.freeze({
    refractiveIndex,
    flowSpeedMmS,
    vx,
    vy,
    probeGain,
    spanMm,
    toleranceMm,
    freqHz,
  });
}

function sampleCell(genotypes, cx, cy, rng, time, reducedMotion) {
  const w = { refraction: 0, fluid: 0, measure: 0, cad: 0, sound: 0 };
  for (const el of genotypes) {
    const mask = discMask(cx - el.x, cy - el.y, el.radius, el.rim);
    if (mask <= 0) continue;
    for (const prop of ESTUARY_PROPERTIES) {
      w[prop] = unionStrength(w[prop], clamp01(mask * el.weights[prop]));
    }
  }
  const jitter = (rng() - 0.5) * 0.02;
  const phase = (cx * 3.1 + cy * 2.3 + (reducedMotion ? 0 : time * 0.5) + jitter) * Math.PI;
  const obs = deriveObservables(w, phase, reducedMotion);
  const spread =
    w.refraction * w.fluid +
    w.fluid * w.measure +
    w.measure * w.cad +
    w.cad * w.sound +
    w.sound * w.refraction;
  return Object.freeze({ x: cx, y: cy, weights: Object.freeze(w), observables: obs, halocline: clamp01(spread) });
}

function summarizeCells(cells) {
  const avg = { refraction: 0, fluid: 0, measure: 0, cad: 0, sound: 0 };
  let nSum = 0, flowSum = 0, probeSum = 0, spanSum = 0, tolSum = 0, freqSum = 0, haloSum = 0;
  const count = Math.max(1, cells.length);
  for (const c of cells) {
    for (const prop of ESTUARY_PROPERTIES) avg[prop] += c.weights[prop];
    nSum += c.observables.refractiveIndex;
    flowSum += c.observables.flowSpeedMmS;
    probeSum += c.observables.probeGain;
    spanSum += c.observables.spanMm;
    tolSum += c.observables.toleranceMm;
    freqSum += c.observables.freqHz;
    haloSum += c.halocline;
  }
  for (const prop of ESTUARY_PROPERTIES) avg[prop] /= count;
  return Object.freeze({
    weights: Object.freeze(avg),
    refractiveIndex: nSum / count,
    flowSpeedMmS: flowSum / count,
    probeGain: probeSum / count,
    spanMm: spanSum / count,
    toleranceMm: tolSum / count,
    freqHz: freqSum / count,
    halocline: haloSum / count,
  });
}

function buildVisualState(genotypes, summary, reducedMotion) {
  const w = summary.weights;
  const tint = Object.freeze({
    r: clamp01(0.18 + 0.52 * w.refraction + 0.18 * w.cad),
    g: clamp01(0.24 + 0.48 * w.fluid + 0.2 * w.measure),
    b: clamp01(0.28 + 0.5 * w.sound + 0.16 * w.fluid),
    a: 1,
  });
  const rims = Object.freeze(
    genotypes.map((el) =>
      Object.freeze({
        id: el.id,
        x: el.x,
        y: el.y,
        radius: el.radius,
        inner: Math.max(0, el.radius - el.rim),
        outer: el.radius + el.rim,
      }),
    ),
  );
  return Object.freeze({
    settled: Boolean(reducedMotion),
    tint,
    rayBendRad: (summary.refractiveIndex - 1) * 0.65,
    flowAmplitude: reducedMotion ? 0 : summary.flowSpeedMmS,
    waveAmplitude: reducedMotion ? 0 : w.sound,
    cadSpanMm: summary.spanMm,
    cadToleranceMm: summary.toleranceMm,
    rims,
  });
}

export function evaluateField(rawGenotypes, options = {}) {
  const genotypes = Object.freeze((rawGenotypes || []).map(createGenotype));
  const width = Math.max(2, Math.trunc(options.width ?? 12));
  const height = Math.max(2, Math.trunc(options.height ?? 8));
  const seed = (options.seed ?? 1) >>> 0;
  const reducedMotion = Boolean(options.reducedMotion);
  const time = reducedMotion ? 0 : Number.isFinite(options.time) ? options.time : 0;
  const rng = createRng(seed);
  const cells = [];
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      cells.push(sampleCell(genotypes, (i + 0.5) / width, (j + 0.5) / height, rng, time, reducedMotion));
    }
  }
  const summary = summarizeCells(cells);
  const visual = buildVisualState(genotypes, summary, reducedMotion);
  return Object.freeze({
    genotypes,
    seed,
    time,
    reducedMotion,
    grid: Object.freeze({ width, height, cells: Object.freeze(cells) }),
    summary,
    visual,
  });
}

function buildReadoutItems(summary) {
  const w = summary.weights;
  const measurements = {
    refraction: { value: Number(summary.refractiveIndex.toFixed(4)), unit: PROPERTY_META.refraction.unit, text: `n = ${summary.refractiveIndex.toFixed(3)}` },
    fluid: { value: Number(summary.flowSpeedMmS.toFixed(3)), unit: PROPERTY_META.fluid.unit, text: `${summary.flowSpeedMmS.toFixed(1)} mm/s` },
    measure: { value: Number(summary.probeGain.toFixed(4)), unit: PROPERTY_META.measure.unit, text: `${(summary.probeGain * 100).toFixed(1)}% probe gain` },
    cad: { value: Number(summary.spanMm.toFixed(3)), tolerance: Number(summary.toleranceMm.toFixed(3)), unit: PROPERTY_META.cad.unit, text: `${summary.spanMm.toFixed(1)} mm +/- ${summary.toleranceMm.toFixed(2)} mm` },
    sound: { value: Number(summary.freqHz.toFixed(2)), unit: PROPERTY_META.sound.unit, text: `${summary.freqHz.toFixed(1)} Hz` },
  };
  return Object.freeze(
    ESTUARY_PROPERTIES.map((prop) =>
      Object.freeze({
        property: prop,
        label: PROPERTY_META[prop].label,
        weight: Number(w[prop].toFixed(4)),
        percent: Math.round(w[prop] * 100),
        measurement: Object.freeze(measurements[prop]),
      }),
    ),
  );
}

export function expressPhenotype(fieldOrGenotypes, environment = {}) {
  const reducedMotion = Boolean(environment.reducedMotion || environment.plain);
  const plain = Boolean(environment.plain);
  const screenReader = Boolean(environment.screenReader);
  const field = fieldOrGenotypes && fieldOrGenotypes.grid
    ? (reducedMotion && !fieldOrGenotypes.reducedMotion
      ? evaluateField(fieldOrGenotypes.genotypes, {
          width: fieldOrGenotypes.grid.width,
          height: fieldOrGenotypes.grid.height,
          seed: fieldOrGenotypes.seed,
          time: 0,
          reducedMotion: true,
        })
      : fieldOrGenotypes)
    : evaluateField(Array.isArray(fieldOrGenotypes) ? fieldOrGenotypes : [fieldOrGenotypes], {
        seed: environment.seed ?? 1,
        time: environment.time ?? 0,
        reducedMotion,
      });

  const items = buildReadoutItems(field.summary);
  const mode = plain ? 'plain' : reducedMotion ? 'settled' : 'live';
  const parts = items.map((it) => `${it.label} ${it.percent}% (${it.measurement.text})`);
  const summaryText = `Estuary field (${mode}): ${parts.join(', ')}. Halocline mix ${(field.summary.halocline * 100).toFixed(1)}%.`;
  return Object.freeze({
    mode,
    environment: Object.freeze({
      reducedMotion,
      plain,
      screenReader,
      contrast: String(environment.contrast || 'aa'),
      input: String(environment.input || 'keyboard'),
    }),
    visual: plain ? null : field.visual,
    readout: Object.freeze({
      items,
      halocline: Number(field.summary.halocline.toFixed(4)),
      ariaLabel: summaryText,
      summaryText,
    }),
    parity: Object.freeze({
      genotypeProperties: ESTUARY_PROPERTIES,
      exposedProperties: Object.freeze(items.map((it) => it.property)),
      complete: items.length === ESTUARY_PROPERTIES.length,
    }),
    seed: field.seed,
  });
}

// Package a phenotype readout into the site bus envelope shape.
export function toBusEnvelope(phenotype, {
  module = 'field',
  surface = 'playground',
  form = 'live',
  at = '2026-11-20T00:00:00.000Z',
  refs = [],
} = {}) {
  return Object.freeze({
    medium: 'numbers',
    refs: Object.freeze([...refs]),
    value: Object.freeze({
      mode: phenotype.mode,
      halocline: phenotype.readout.halocline,
      readings: phenotype.readout.items,
    }),
    from: Object.freeze({
      module,
      surface,
      form,
      at,
      recipe: Object.freeze({ seed: phenotype.seed, mode: phenotype.mode }),
    }),
  });
}

// Verify continuity by checking that max adjacent delta shrinks when sampling doubles.
export function measureContinuity(fn, { steps = 64, shrink = 0.75, floor = 1e-9 } = {}) {
  const maxStep = (n) => {
    let prev = fn(0), worst = 0;
    for (let i = 1; i <= n; i++) {
      const cur = fn(i / n);
      const delta = Math.abs(cur - prev);
      if (delta > worst) worst = delta;
      prev = cur;
    }
    return worst;
  };
  const coarse = maxStep(steps);
  const fine = maxStep(steps * 2);
  const ratio = coarse > floor ? fine / coarse : 0;
  return Object.freeze({
    coarse,
    fine,
    ratio,
    continuous: coarse <= floor || fine <= shrink * coarse,
  });
}
