// The near maps: two 512 x 512 pictures of the ground round the walker at one metre a texel,
// baked on the processor and read by the ground shader, the fog and the walker's feet.
//   A: crowns overhead, broadleaf share of them, shelter (a roof over the ground), trunk or wall close by
//   B: road or yard, its surface kind, a height offset in metres (128 is none, 64 to a metre), wear
// Anything that shapes the ground stamps itself here: roads, trees, houses, the works.
export const NEAR = 512, KIND = { gravel: 0, concrete: 64, asphalt: 128, sett: 255 };

export function makeNear(roads) {
  const N = NEAR, A = new Uint8Array(N * N * 4), B = new Uint8Array(N * N * 4), stampers = [];
  const st = { ox: 0, oz: 0, baked: false, A, B, serial: 0 };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // a soft disc: the channel takes the larger of what is there and v at the centre falling to 0 at r
  function disc(tex, ch, x, z, r, v, hard = 0) {
    const x0 = Math.max(0, Math.floor(x - st.ox - r)), x1 = Math.min(N - 1, Math.ceil(x - st.ox + r)), z0 = Math.max(0, Math.floor(z - st.oz - r)), z1 = Math.min(N - 1, Math.ceil(z - st.oz + r));
    for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) {
      const d = Math.hypot(i + 0.5 + st.ox - x, j + 0.5 + st.oz - z) / r; if (d >= 1) continue;
      const val = v * (hard ? Math.min(1, (1 - d) / (1 - hard)) : (1 - d * d)), k = (j * N + i) * 4 + ch;
      if (val > tex[k]) tex[k] = val;
    }
  }
  // a turned rectangle: visit(k, u, v) for every texel within `pad` of it; u and v are metres
  // from its centre along its own axes, k the texel's place in a map
  function rect(cx, cz, turn, halfU, halfV, pad, visit) {
    const c = Math.cos(turn), s = Math.sin(turn), R = Math.hypot(halfU + pad, halfV + pad);
    const x0 = Math.max(0, Math.floor(cx - st.ox - R)), x1 = Math.min(N - 1, Math.ceil(cx - st.ox + R)), z0 = Math.max(0, Math.floor(cz - st.oz - R)), z1 = Math.min(N - 1, Math.ceil(cz - st.oz + R));
    for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) {
      const dx = i + 0.5 + st.ox - cx, dz = j + 0.5 + st.oz - cz, u = dx * c - dz * s, v = dx * s + dz * c;
      if (Math.abs(u) <= halfU + pad && Math.abs(v) <= halfV + pad) visit((j * N + i) * 4, u, v);
    }
  }
  function stampRoads() {
    roads.within(st.ox - 8, st.oz - 8, st.ox + N + 8, st.oz + N + 8, (L, p, q) => {
      const h = L.half, R = 2 * h + 2.5, vx = q[0] - p[0], vz = q[1] - p[1], ll = vx * vx + vz * vz || 1;
      const x0 = Math.max(0, Math.floor(Math.min(p[0], q[0]) - st.ox - R)), x1 = Math.min(N - 1, Math.ceil(Math.max(p[0], q[0]) - st.ox + R)), z0 = Math.max(0, Math.floor(Math.min(p[1], q[1]) - st.oz - R)), z1 = Math.min(N - 1, Math.ceil(Math.max(p[1], q[1]) - st.oz + R));
      for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) {
        const x = i + 0.5 + st.ox, z = j + 0.5 + st.oz, t = Math.max(0, Math.min(1, ((x - p[0]) * vx + (z - p[1]) * vz) / ll)), d = Math.hypot(x - p[0] - vx * t, z - p[1] - vz * t);
        const w = Math.max(0, 1 - d / (2 * h)) * 255, k = (j * N + i) * 4;
        if (w <= B[k]) continue;
        B[k] = w; B[k + 1] = KIND.gravel;
        // a road is cut a hand into the ground, with a low berm thrown up at each verge
        const cut = -0.10 * (1 - smooth(h * 0.7, h * 1.2, d)) + 0.07 * Math.max(0, 1 - Math.abs(d - h - 0.7) / 0.9);
        B[k + 2] = 128 + cut * 64;
        // two wheel tracks on a road, one trodden line on a path
        B[k + 3] = (L.kind === "path" ? Math.max(0, 1 - d / 0.5) : Math.max(0, 1 - Math.abs(d - 0.78) / 0.42)) * 255;
      }
    });
  }

  // bake the maps centred on a point; returns true when it did
  function bake(x, z, force = false) {
    if (!force && st.baked && Math.abs(x - (st.ox + N / 2)) < 72 && Math.abs(z - (st.oz + N / 2)) < 72) return false;
    st.ox = Math.round(x / 32) * 32 - N / 2; st.oz = Math.round(z / 32) * 32 - N / 2;
    A.fill(0); B.fill(0);
    for (let k = 2; k < B.length; k += 4) B[k] = 128;
    stampRoads();
    const tools = { A, B, N, ox: st.ox, oz: st.oz, disc, rect, smooth, KIND };
    for (const f of stampers) f(tools);
    st.baked = true; st.serial++;
    return true;
  }
  // B at a point in metres, bilinear: road, kind, offset in metres, wear, and the map's edge weight
  function sampleB(x, z, out) {
    out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0; out[4] = 0;
    if (!st.baked) return out;
    const u = x - st.ox, v = z - st.oz, e = Math.min(u, v, N - u, N - v);
    if (e <= 0) return out;
    const qx = Math.min(N - 1.001, Math.max(0, u - 0.5)), qz = Math.min(N - 1.001, Math.max(0, v - 0.5)), ix = Math.floor(qx), iz = Math.floor(qz), fx = qx - ix, fz = qz - iz;
    const a = (iz * N + ix) * 4, b = a + 4, c = a + N * 4, d = c + 4;
    for (let k = 0; k < 4; k++) out[k] = ((B[a + k] * (1 - fx) + B[b + k] * fx) * (1 - fz) + (B[c + k] * (1 - fx) + B[d + k] * fx) * fz) / 255;
    out[2] = (out[2] - 128 / 255) * 255 / 64;
    out[4] = Math.min(1, e / 24);
    return out;
  }
  // A at a point, nearest texel: [canopy, broadleaf, shelter, trunk] 0..1
  function sampleA(x, z, ch) {
    const i = Math.floor(x - st.ox), j = Math.floor(z - st.oz);
    return st.baked && i >= 0 && j >= 0 && i < N && j < N ? A[(j * N + i) * 4 + ch] / 255 : 0;
  }
  return { state: st, stampers, bake, sampleB, sampleA };
}
