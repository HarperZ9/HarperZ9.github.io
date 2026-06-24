// rotate.mjs — nD rotation: Givens planar rotations + the full C(n,2) rotor.

// Identical semantics to the shipped ndim.js rotateND (parity): apply each {a,b,angle} in order.
export function rotateND(verts, planes) {
  return verts.map((v) => {
    const w = new Float64Array(v);
    for (const { a, b, angle } of planes) {
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const x = w[a], y = w[b];
      w[a] = x * cos - y * sin;
      w[b] = x * sin + y * cos;
    }
    return w;
  });
}

export function allPlanes(n) {
  const P = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) P.push({ a, b });
  return P;
}

// Build the spinning planes for time t.
//  spec "all":       every C(n,2) plane spins; plane k spins at rate (0.30 + 0.07k) for visible independence.
//  spec "isoclinic": (n>=4) the double rotation {0,1} & {2,3} at equal rate — the classic 4-D "no fixed point".
//  spec [{a,b,rate}]: explicit planes/rates.
export function spinningPlanes(n, t, spec = "all") {
  if (Array.isArray(spec)) return spec.map(({ a, b, rate }) => ({ a, b, angle: t * rate }));
  if (spec === "isoclinic") {
    if (n < 4) throw new RangeError("isoclinic needs n>=4");
    return [{ a: 0, b: 1, angle: t }, { a: 2, b: 3, angle: t }];
  }
  if (spec !== "all") throw new RangeError(`unknown rotation spec: ${spec}`);
  // "all"
  return allPlanes(n).map((p, k) => ({ a: p.a, b: p.b, angle: t * (0.30 + 0.07 * k) }));
}
