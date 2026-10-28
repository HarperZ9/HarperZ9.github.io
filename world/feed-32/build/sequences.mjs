// sequences.mjs: integer sequences as plain number arrays, for the strata tool. Every generator is our own and returns
// a strictly increasing Float64Array of exact integers below 2^53. A caller may also hand in any array of its own.
//
// SPEC
//   inputs : name (one of SEQUENCES), n (terms, 2 .. 2e6) or limit (largest value, for sieved sequences)
//   output : Float64Array, strictly increasing integers
//   determinism : pure functions, no randomness

// Smallest-prime-factor sieve up to `limit` (Int32Array; spf[0] = spf[1] = 0).
export function spfSieve(limit) {
  const spf = new Int32Array(limit + 1);
  for (let i = 2; i <= limit; i++) {
    if (spf[i]) continue;
    spf[i] = i;
    if (i * i > limit) continue;
    for (let j = i * i; j <= limit; j += i) if (!spf[j]) spf[j] = i;
  }
  return spf;
}

export function primesBelow(limit) {
  const spf = spfSieve(limit), out = [];
  for (let i = 2; i < limit; i++) if (spf[i] === i) out.push(i);
  return Float64Array.from(out);
}

const popcount = n => { let c = 0; while (n) { c += n & 1; n = Math.floor(n / 2); } return c; };
const take = (n, f) => { const out = []; for (let i = 0; out.length < n; i++) { const v = f(i); if (v !== null) out.push(v); } return Float64Array.from(out); };
const isPal = n => { const s = String(n); return s === [...s].reverse().join(''); };

// name -> { label, make(n) }. Labels are plain descriptions in our words.
export const SEQUENCES = {
  primes: { label: 'the primes', make: n => primesBelow(Math.max(30, Math.ceil(n * (Math.log(n) + Math.log(Math.log(n + 2)) + 2)))).slice(0, n) },
  naturals: { label: 'the counting numbers from 1', make: n => take(n, i => i + 1) },
  squares: { label: 'perfect squares', make: n => take(n, i => (i + 1) * (i + 1)) },
  cubes: { label: 'perfect cubes', make: n => take(n, i => (i + 1) ** 3) },
  triangular: { label: 'triangular numbers', make: n => take(n, i => ((i + 1) * (i + 2)) / 2) },
  evil: { label: 'numbers with an even count of 1 bits', make: n => take(n, i => (popcount(i) % 2 ? null : i)).filter((v, i, a) => i === 0 || v > a[i - 1]) },
  odious: { label: 'numbers with an odd count of 1 bits', make: n => take(n, i => (popcount(i) % 2 ? i : null)) },
  palindromes: { label: 'base-10 palindromes', make: n => take(n, i => (isPal(i) ? i : null)) },
  semiprimes: {
    label: 'products of two primes',
    make: n => { const lim = Math.max(64, Math.ceil(n * 5)); const spf = spfSieve(lim * 4), out = [];
      for (let i = 4; out.length < n && i <= lim * 4; i++) { const p = spf[i], q = i / p; if (p && q > 1 && spf[q] === q) out.push(i); }
      return Float64Array.from(out); },
  },
  primeSquares: { label: 'squares of primes', make: n => SEQUENCES.primes.make(n).map(p => p * p) },
};

export function sequence(name, n) {
  const s = SEQUENCES[name];
  if (!s) throw new Error(`unknown sequence "${name}"; known: ${Object.keys(SEQUENCES).join(', ')}`);
  return s.make(n);
}
