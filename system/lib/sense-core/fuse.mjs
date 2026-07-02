/**
 * fuse.mjs — balanced multi-channel feature fusion.
 *
 * Naive concatenation of channels with very different dimensionalities or
 * magnitudes lets the high-dimensional / high-variance channel dominate
 * Euclidean distance, drowning discriminative signal from smaller channels
 * (E8 finding: 192-dim noisy visual channel killed 16-dim perfect sound channel,
 * V_combined=27.8% < V_sound=100%).
 *
 * Two sources of dominance:
 *   1. Magnitude: a high-magnitude channel shifts distances more per dimension.
 *      Fix: z-normalize each channel independently (mean=0, std=1 within channel).
 *   2. Dimensionality: a 192-dim channel contributes ~√(192/16) ≈ 3.5× more total
 *      L2 mass than a 16-dim channel even after per-dimension z-norm, because
 *      L2 ∝ √(n_dims · per_dim_variance).
 *      Fix: scale each channel's normalized vector by 1/√(dim) so every channel
 *      contributes equal expected L2 mass regardless of dimension count.
 *
 * Default weighting: 'equalmass' — each channel scaled by 1/sqrt(features.length).
 * Override with opts.weights for explicit per-channel control.
 *
 * Deterministic, pure, zero-dep.
 */

/**
 * zNormalize(features) — per-dimension z-normalization.
 *
 * Returns a new array the same length as `features` where each element i
 * becomes (x_i − mean_i) / std_i.
 *
 * Because this is a single vector (one sample), "per-dimension" normalizes
 * across the full vector together — mean and std are computed over all values.
 * Guard: if std === 0, leave every element as 0.
 *
 * @param {number[]} features
 * @returns {number[]}
 */
export function zNormalize(features) {
  const n = features.length;
  if (n === 0) return [];

  let sum = 0;
  for (let i = 0; i < n; i++) sum += features[i];
  const mean = sum / n;

  let varSum = 0;
  for (let i = 0; i < n; i++) varSum += (features[i] - mean) ** 2;
  const std = Math.sqrt(varSum / n);

  if (std === 0) return new Array(n).fill(0);
  return features.map(x => (x - mean) / std);
}

/**
 * fuseChannels(channels, opts?) — balanced multi-channel fusion.
 *
 * For each channel:
 *   1. z-normalize independently (per-channel mean/std, not global).
 *   2. Scale by per-channel weight.
 *   3. Concatenate all scaled, normalized channel vectors.
 *
 * Default weight mode: 'equalmass' — each channel's weight = 1/sqrt(dim).
 * This ensures every channel contributes equal expected L2 mass in the fused
 * vector regardless of how many dimensions it has.
 *
 * Override with opts.weights (array of numbers, one per channel) for explicit
 * per-channel control. Set opts.weights to channel.map(()=>1) to use
 * equal scalar weights without dimension normalization.
 *
 * @param {{ name: string, features: number[] }[]} channels
 * @param {{ weights?: number[] }} [opts]
 * @returns {number[]}
 */
export function fuseChannels(channels, opts = {}) {
  if (channels.length === 0) return [];

  const weights = opts.weights
    ?? channels.map(ch => ch.features.length > 0 ? 1 / Math.sqrt(ch.features.length) : 1);

  if (weights.length !== channels.length) {
    throw new Error(`fuseChannels: weights.length (${weights.length}) must equal channels.length (${channels.length})`);
  }

  const result = [];
  for (let c = 0; c < channels.length; c++) {
    const { features } = channels[c];
    const w = weights[c];
    const norm = zNormalize(features);
    for (let i = 0; i < norm.length; i++) result.push(norm[i] * w);
  }
  return result;
}

/**
 * coherenceWeights(channels, labels) — discriminative-coherence weights per channel.
 *
 * For each channel, measures how well its feature space separates classes:
 *   score = (mean inter-class pairwise Euclidean distance)
 *           / (mean intra-class pairwise Euclidean distance + ε)
 *
 * A channel where intra > inter (anti-discriminative) gets score < 1, receiving
 * low weight. Scores are normalized to sum to 1.
 *
 * @param {number[][][]} channels  Array of C channels; each channel is an array of
 *                                  N per-sample feature vectors (array of numbers).
 * @param {(string|number)[]} labels  Array of N class labels, one per sample.
 * @returns {number[]}  Weight per channel, summing to 1.
 */
export function coherenceWeights(channels, labels) {
  const EPS = 1e-9;

  function euclidean(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
    return Math.sqrt(s);
  }

  const scores = channels.map(ch => {
    let interSum = 0, interCount = 0;
    let intraSum = 0, intraCount = 0;

    for (let i = 0; i < ch.length; i++) {
      for (let j = i + 1; j < ch.length; j++) {
        const d = euclidean(ch[i], ch[j]);
        if (labels[i] === labels[j]) {
          intraSum += d;
          intraCount++;
        } else {
          interSum += d;
          interCount++;
        }
      }
    }

    const meanInter = interCount > 0 ? interSum / interCount : 0;
    const meanIntra = intraCount > 0 ? intraSum / intraCount : 0;
    return meanInter / (meanIntra + EPS);
  });

  const total = scores.reduce((s, x) => s + x, 0);
  if (total === 0) return scores.map(() => 1 / channels.length);
  return scores.map(s => s / total);
}

/**
 * fuseWeighted(channels, weights) — coherence-weighted multi-channel fusion.
 *
 * For each channel (array of per-sample feature vectors):
 *   1. Z-normalize the channel (per-sample vector normalization via zNormalize).
 *   2. Scale each normalized vector by sqrt(weight).
 *      Scaling by sqrt(w) means the squared Euclidean contribution scales by w,
 *      so weight acts directly on the L2² budget per channel.
 *   3. Concatenate all scaled vectors sample-wise.
 *
 * @param {number[][][]} channels  Array of C channels; each channel is an array of
 *                                  N per-sample feature vectors (array of numbers).
 * @param {number[]} weights  Per-channel weights (should sum to 1; e.g. from coherenceWeights).
 * @returns {number[][]}  Array of N fused feature vectors (one per sample).
 */
export function fuseWeighted(channels, weights) {
  if (channels.length === 0) return [];
  if (weights.length !== channels.length) {
    throw new Error(
      `fuseWeighted: weights.length (${weights.length}) must equal channels.length (${channels.length})`
    );
  }

  const nSamples = channels[0].length;
  const result = [];

  for (let s = 0; s < nSamples; s++) {
    const fused = [];
    for (let c = 0; c < channels.length; c++) {
      const norm = zNormalize(channels[c][s]);
      const scale = Math.sqrt(weights[c]);
      for (const v of norm) fused.push(v * scale);
    }
    result.push(fused);
  }

  return result;
}
