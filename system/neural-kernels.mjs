// neural-kernels.mjs: the living neural instruments' frames as pixel buffers.
//
// studio-neural.js draws a frame with one fillRect per field cell and a fresh array per network
// layer per sample. At the Studio's canvas size that is about 100,000 network evaluations and as
// many fillStyle strings a frame, so the main thread could not keep up (1.1 s of script a second).
// These kernels compute the same frames into typed arrays, with the same arithmetic in the same
// order, so a worker can draw them and the page only copies the result onto its canvas.
//
// Exactness: the forward pass reads the seed-built weights from neural.js and repeats mlpForward's
// sums and activations operation for operation, so every value is the same double. The field's
// cells and the solid's march are copied from studio-neural.js. neural-kernels.test.mjs checks
// both against the reference functions bit for bit. No DOM; runs in a worker or under node.

const ACT_CODE = { tanh: 0, sin: 1, gauss: 2, fold: 3 };

/* An allocation-free forward pass over an mlp from neural.js buildMlp. Write the input into
   `input` and call `run()`; it returns the output layer's Float64Array (reused between calls). */
export function compileMlp(mlp) {
  const L = mlp.W.length;
  const sizes = mlp.layers;
  const bufs = sizes.map((n) => new Float64Array(n));
  const codes = mlp.acts.map((a) => {
    if (!(a in ACT_CODE)) throw new Error(`neural-kernels: unknown activation ${a}`);
    return ACT_CODE[a];
  });
  const W = mlp.W, B = mlp.B;
  function run() {
    for (let l = 0; l < L; l += 1) {
      const inN = sizes[l];
      const outN = sizes[l + 1];
      const w = W[l];
      const b = B[l];
      const cur = bufs[l];
      const out = bufs[l + 1];
      const code = l < codes.length ? codes[l] : -1;
      for (let o = 0; o < outN; o += 1) {
        let sum = b[o];
        const base = o * inN;
        for (let i = 0; i < inN; i += 1) sum += w[base + i] * cur[i];
        // The four activations exactly as neural.js writes them.
        if (code === 0) out[o] = Math.tanh(sum);
        else if (code === 1) out[o] = Math.sin(sum * 2.2);
        else if (code === 2) out[o] = Math.exp(-sum * sum * 1.6) * 2 - 1;
        else if (code === 3) out[o] = Math.abs((sum * 0.7 + 1) % 2 - 1) * 2 - 1;
        else out[o] = sum;
      }
    }
    return bufs[L];
  }
  return { input: bufs[0], run };
}

/* The CPPN's colour at (nx, ny), written into out3. Same as buildCppn(...).eval. */
export function fastCppn(cppn) {
  const f = compileMlp(cppn.mlp);
  const fx = cppn.fx, fy = cppn.fy, inp = f.input;
  return function colorAt(nx, ny, out3) {
    const r = Math.sqrt(nx * nx + ny * ny);
    inp[0] = nx;
    inp[1] = ny;
    inp[2] = r;
    inp[3] = Math.sin(nx * fx);
    inp[4] = Math.sin(ny * fy);
    inp[5] = 1;
    const o = f.run();
    out3[0] = (Math.tanh(o[0]) + 1) * 0.5;
    out3[1] = (Math.tanh(o[1]) + 1) * 0.5;
    out3[2] = (Math.tanh(o[2]) + 1) * 0.5;
  };
}

/* The reference colour function, through the network's own eval (allocating). */
export function referenceCppn(cppn) {
  return function colorAt(nx, ny, out3) {
    const c = cppn.eval(nx, ny);
    out3[0] = c[0]; out3[1] = c[1]; out3[2] = c[2];
  };
}

/* The neural SDF's distance. Same as buildNeuralSdf(...).dist. */
export function fastSdf(sdf) {
  const f = compileMlp(sdf.mlp);
  const freq = sdf.freq, amp = sdf.amp, R = sdf.R, inp = f.input;
  return function dist(x, y, z) {
    const rr = Math.sqrt(x * x + y * y + z * z);
    inp[0] = x * freq;
    inp[1] = y * freq;
    inp[2] = z * freq;
    inp[3] = 1;
    return (rr - R) + Math.tanh(f.run()[0]) * amp;
  };
}

/* The field's cell grid, as studio-neural.js renderField lays it out. */
export function fieldGrid(W, H) {
  const cell = Math.max(2, Math.round(Math.min(W, H) / 240));
  return { cell, cols: Math.ceil(W / cell), rows: Math.ceil(H / cell) };
}

/* One field frame into out (RGBA, W*H*4). renderField paints cell (gx, gy) as a (cell+1)-square at
   (gx*cell, gy*cell), so each later cell covers the extra row and column of the one before, and the
   last cells cover the canvas edge: pixel (x, y) takes cell (floor(x/cell), floor(y/cell)). Returns
   false, drawing nothing, when the grid has fewer than two cells on a side (renderField divides by
   cols - 1 and rows - 1 there; the caller falls back to the reference). */
export function fieldPixels(colorAt, W, H, time, tint, out) {
  const { cell, cols, rows } = fieldGrid(W, H);
  if (cols < 2 || rows < 2) return false;
  const ox = 0.16 * Math.sin(time * 0.6);
  const oy = 0.13 * Math.sin(time * 0.41);
  const c = new Float64Array(3);
  const rowRGB = new Uint8Array(cols * 3);
  const t00 = tint[0][0], t10 = tint[1][0], t20 = tint[2][0];
  const t01 = tint[0][1], t11 = tint[1][1], t21 = tint[2][1];
  const t02 = tint[0][2], t12 = tint[1][2], t22 = tint[2][2];
  for (let gy = 0; gy < rows; gy += 1) {
    const ny = (gy / (rows - 1)) * 2 - 1;
    for (let gx = 0; gx < cols; gx += 1) {
      const nx = (gx / (cols - 1)) * 2 - 1;
      colorAt(nx + ox, ny + oy, c);
      const w0 = c[0], w1 = c[1], w2 = c[2];
      const sum = w0 + w1 + w2 + 1e-4;
      const r = (t00 * w0 + t10 * w1 + t20 * w2) / sum;
      const g = (t01 * w0 + t11 * w1 + t21 * w2) / sum;
      const b = (t02 * w0 + t12 * w1 + t22 * w2) / sum;
      const lift = 0.35 + 0.65 * Math.max(w0, w1, w2);
      rowRGB[gx * 3] = Math.round(r * lift);
      rowRGB[gx * 3 + 1] = Math.round(g * lift);
      rowRGB[gx * 3 + 2] = Math.round(b * lift);
    }
    const y0 = gy * cell;
    const y1 = Math.min(H, y0 + cell);
    if (y0 >= H) break;
    // Paint the first pixel row of this cell row, then copy it down.
    let o = y0 * W * 4;
    for (let x = 0; x < W; x += 1, o += 4) {
      const k = Math.floor(x / cell) * 3;
      out[o] = rowRGB[k]; out[o + 1] = rowRGB[k + 1]; out[o + 2] = rowRGB[k + 2]; out[o + 3] = 255;
    }
    const first = y0 * W * 4, len = W * 4;
    for (let y = y0 + 1; y < y1; y += 1) out.copyWithin(y * len, first, first + len);
  }
  return true;
}

/* The solid's march buffer, as studio-neural.js renderSolid fills it: RW x RH RGBA, opaque where a
   ray hit the surface and transparent elsewhere. The caller paints the background and scales the
   buffer onto the canvas with smoothing, as renderSolid does. Values go through a
   Uint8ClampedArray, which rounds them exactly as renderSolid's ImageData does. */
export function solidSize(W, H) {
  const RW = Math.min(150, Math.max(48, Math.round(W / 6)));
  const RH = Math.max(32, Math.round(RW * (H / Math.max(1, W))));
  return { RW, RH };
}

export function solidPixels(dist, W, H, time, tint, seedNum, buf) {
  const { RW, RH } = solidSize(W, H);
  const aspect = RW / RH;
  const yaw = -0.55 + ((seedNum % 1000) / 1000) * 1.1 + time * 0.25;
  const distC = 3.0;
  const eye = [Math.sin(yaw) * distC, 0.85, Math.cos(yaw) * distC];
  let fx = -eye[0], fy = -eye[1], fz = -eye[2];
  const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  let rgx = fy * 0 - fz * 1, rgy = fz * 0 - fx * 0, rgz = fx * 1 - fy * 0;
  const rl = Math.hypot(rgx, rgy, rgz) || 1; rgx /= rl; rgy /= rl; rgz /= rl;
  const upx = rgy * fz - rgz * fy, upy = rgz * fx - rgx * fz, upz = rgx * fy - rgy * fx;
  const fov = 0.72;
  const light = [-0.5, 0.75, 0.55];
  const ll = Math.hypot(light[0], light[1], light[2]);
  light[0] /= ll; light[1] /= ll; light[2] /= ll;
  const eps = 0.01;
  const maxSteps = 40;
  buf.fill(0);
  for (let j = 0; j < RH; j += 1) {
    const v = (0.5 - j / RH) * 2 * fov;
    for (let i = 0; i < RW; i += 1) {
      const u = (i / RW - 0.5) * 2 * fov * aspect;
      let dx = fx + u * rgx + v * upx;
      let dy = fy + u * rgy + v * upy;
      let dz = fz + u * rgz + v * upz;
      const dl = Math.hypot(dx, dy, dz) || 1;
      dx /= dl; dy /= dl; dz /= dl;
      let t = 0, hit = false;
      for (let s = 0; s < maxSteps; s += 1) {
        const x = eye[0] + dx * t, y = eye[1] + dy * t, z = eye[2] + dz * t;
        const d = dist(x, y, z);
        if (d < eps) { hit = true; break; }
        t += Math.max(0.014, d * 0.85);
        if (t > 6) break;
      }
      if (!hit) continue;
      const x = eye[0] + dx * t, y = eye[1] + dy * t, z = eye[2] + dz * t;
      const gnx = dist(x + eps, y, z) - dist(x - eps, y, z);
      const gny = dist(x, y + eps, z) - dist(x, y - eps, z);
      const gnz = dist(x, y, z + eps) - dist(x, y, z - eps);
      const nl = Math.hypot(gnx, gny, gnz) || 1;
      const nX = gnx / nl, nY = gny / nl, nZ = gnz / nl;
      const lam = Math.max(0.1, nX * light[0] + nY * light[1] + nZ * light[2]);
      const rim = Math.pow(1 - Math.max(0, -(dx * gnx + dy * gny + dz * gnz) / nl), 2.5);
      const w0 = (nX + 1) * 0.5, w1 = (nY + 1) * 0.5, w2 = (nZ + 1) * 0.5;
      const sum = w0 + w1 + w2 + 1e-4;
      const cr = (tint[0][0] * w0 + tint[1][0] * w1 + tint[2][0] * w2) / sum;
      const cg = (tint[0][1] * w0 + tint[1][1] * w1 + tint[2][1] * w2) / sum;
      const cb = (tint[0][2] * w0 + tint[1][2] * w1 + tint[2][2] * w2) / sum;
      const shade = 0.22 + lam * 0.78;
      const o = (j * RW + i) * 4;
      buf[o] = Math.min(255, cr * shade + rim * 72);
      buf[o + 1] = Math.min(255, cg * shade + rim * 82);
      buf[o + 2] = Math.min(255, cb * shade + rim * 98);
      buf[o + 3] = 255;
    }
  }
  return { RW, RH };
}
