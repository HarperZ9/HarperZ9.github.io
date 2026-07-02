// Corpus -- grounds NOVELTY: how unlike everything made before. Novelty = normalized nearest-
// neighbour distance in feature space. Without a corpus an engine repeats itself; with one,
// "novel" is a checkable claim, not a vibe. Persistable as plain JSON (node file / browser
// localStorage). Ported from studio-engine corpus.py.
const KEYS = ["coverage", "centroid_offset", "contrast", "entropy"];
const DIAG = Math.sqrt(KEYS.length);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Corpus {
  constructor(vectors = []) { this.vectors = vectors; }
  static from(arr) { return new Corpus(Array.isArray(arr) ? arr.slice() : []); }
  _vec(f) { return KEYS.map((k) => clamp(f[k] ?? 0, 0, 1)); }

  novelty(f) {
    if (!this.vectors.length) return 1;
    const v = this._vec(f);
    let dmin = Infinity;
    for (const u of this.vectors) {
      let d = 0; for (let i = 0; i < KEYS.length; i++) { const e = v[i] - (u[i] ?? 0); d += e * e; }
      d = Math.sqrt(d); if (d < dmin) dmin = d;
    }
    return clamp(dmin / DIAG, 0, 1);
  }

  add(f) { this.vectors.push(this._vec(f)); return this; }
  get length() { return this.vectors.length; }
  toJSON() { return this.vectors; }
}
