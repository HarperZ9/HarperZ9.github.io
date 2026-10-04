// SPDX-License-Identifier: MIT
// Run every vector in vectors/ against superstack.mjs.
// Usage: node tests/run_vectors.mjs [--impl PATH] [--summary OUT.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VEC = join(ROOT, 'vectors');
const argv = process.argv.slice(2);
const opt = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const impl = resolve(opt('--impl') || join(ROOT, 'superstack.mjs'));
const ss = await import(pathToFileURL(impl).href);

const counts = {}; const fails = []; let file = null;
const check = (ok, what) => { counts[file] = (counts[file] || 0) + 1; if (!ok) fails.push(`${file}: ${what}`); };
const raises = (fn, what) => { try { fn(); } catch { check(true, what); return; } check(false, what + ' (no error)'); };
const close = (a, b, tol) => (a === null || b === null ? a === null && b === null : Math.abs(a - b) <= tol);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hex = (h) => Uint8Array.from(h.match(/../g) || [], (x) => parseInt(x, 16));
const toHex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
const i16 = (vals) => { const u = new Uint8Array(vals.length * 2); const dv = new DataView(u.buffer); vals.forEach((v, i) => dv.setInt16(2 * i, v, true)); return u; };
const f32 = (vals) => { const u = new Uint8Array(vals.length * 4); const dv = new DataView(u.buffer); vals.forEach((v, i) => dv.setFloat32(4 * i, v, true)); return u; };

function synth(sig) {
  const { rate, channels: ch, frames: n } = sig;
  const out = [];
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    if (sig.kind === 'silence') { out.push(0); continue; }
    let amp = sig.amp[c];
    if (sig.kind === 'gated' && i >= Math.floor(n / 2)) amp = amp * sig.quiet_gain;
    out.push(amp * Math.sin(2 * Math.PI * sig.freq * i / rate));
  }
  return out;
}

const RUNNERS = {
  canonical(v) {
    for (const c of v.numbers) check(ss.canonicalNumber(c.type === 'float' ? Number(c.in) : BigInt(c.in)) === c.out, `number ${c.in}`);
    for (const c of v.reject_numbers) raises(() => ss.canonicalNumber(c.type === 'float' ? Number(c.in) : BigInt(c.in)), `reject ${c.in}`);
    for (const c of v.docs) {
      const out = ss.canonical(JSON.parse(c.in));
      check(out === c.out, `doc ${c.in}`);
      check(ss.sha256(new TextEncoder().encode(out)) === c.sha256, `doc sha ${c.in}`);
    }
    for (const t of v.reject_docs) raises(() => ss.canonical(JSON.parse(t)), `reject doc ${t}`);
  },
  hash(v) {
    for (const c of v.cases) check(ss.sha256(hex(c.hex)) === c.sha256, `sha256 len ${c.hex.length / 2}`);
  },
  seed(v) {
    check(ss.substream(v.substream.seed, v.substream.tag) === v.substream.out, 'substream');
    for (const c of v.seeds) {
      check(ss.xmur3(c.seed) === c.u32, `xmur3 ${JSON.stringify(c.seed)}`);
      check(c.seed.length === c.utf16_units, `utf16 length ${JSON.stringify(c.seed)}`);
      let g = ss.rng(c.seed);
      check(eq(c.draws_u32.map(() => g.nextU32()), c.draws_u32), `draws ${c.seed}`);
      g = ss.rng(c.seed);
      check(eq(c.floats.map(() => g.nextFloat()), c.floats), `floats ${c.seed}`);
    }
    for (const c of v.mulberry32) { const m = new ss.Mulberry32(c.state); check(eq(c.draws_u32.map(() => m.nextU32()), c.draws_u32), `mulberry32 ${c.state}`); }
    for (const c of v.pixel_hash) {
      check(ss.pixelHash(c.x, c.y, c.s) === c.u32, `pixel_hash ${c.x},${c.y},${c.s}`);
      check(ss.pixelHash01(c.x, c.y, c.s) === c.unit, `pixel_hash01 ${c.x},${c.y},${c.s}`);
    }
    const g = ss.rng(v.site_make_rng.seed);
    check(eq([0, 1, 2, 3, 4].map(() => g.nextFloat()), v.site_make_rng.first_five), 'site makeRng parity');
  },
  clock(v) {
    check(ss.FLICKS_PER_SECOND === v.per_second, 'per_second');
    check(eq([...ss.SAMPLE_RATES], v.sample_rates), 'sample rate set');
    for (const c of v.per_sample) check(ss.flicksPerSample(c.rate) === c.flicks, `per_sample ${c.rate}`);
    for (const c of v.per_frame) check(ss.flicksPerFrame(c.num, c.den) === c.flicks, `per_frame ${c.num}/${c.den}`);
    for (const rate of v.reject_rates) raises(() => ss.flicksPerSample(rate), `reject rate ${rate}`);
    for (const [n, d] of v.reject_frames) raises(() => ss.flicksPerFrame(n, d), `reject frames ${n}/${d}`);
    for (const c of v.durations) check(c.samples * ss.flicksPerSample(c.rate) === c.flicks, `duration ${c.rate}`);
  },
  sound(v) {
    for (const c of v.quantize) check(new DataView(ss.quantizeS16([c.in]).buffer).getInt16(0, true) === c.out, `quantize ${c.in}`);
    for (const [rate, filt] of Object.entries(v.k_weighting)) {
      const got = ss.kWeighting(Number(rate));
      check(got.every((fa, i) => fa.every((a, j) => Math.abs(a - filt[i][j]) <= v.k_tolerance)), `k_weighting ${rate}`);
    }
    for (const c of v.loudness) {
      const x = synth(c);
      check(close(ss.integratedLufs(x, c.rate, c.channels), c.integrated_lufs, c.tolerance_lu), `lufs ${c.name}`);
      check(close(ss.peakDbfs(x), c.peak_dbfs, 1e-9), `peak ${c.name}`);
    }
    for (const c of v.loudness_check) check(ss.loudnessCheck(c.class, c.lufs, c.peak) === c.verdict, `loudness_check ${c.class} ${c.lufs} ${c.peak}`);
    check(ss.canonical(JSON.parse(JSON.stringify(ss.LOUDNESS_TARGETS))) === ss.canonical(v.targets), 'targets');
  },
  export(v) {
    for (const c of v.cases) {
      let out;
      if (c.format === 'wav') { out = ss.wavS16(hex(c.pcm_hex), c.rate, c.channels); check(toHex(out.subarray(0, 44)) === c.header_hex, `wav header ${c.rate}`); }
      else if (c.format === 'ppm') out = ss.ppmRgb8(hex(c.body_hex), c.width, c.height);
      else out = ss.pgmU8(hex(c.body_hex), c.width, c.height);
      check(createHash('sha256').update(out).digest('hex') === c.sha256, `export ${c.format}`);
    }
  },
  colour(v) {
    const tol = v.tolerance;
    for (const c of v.oklab) check(ss.hexToOklab(c.hex).every((a, i) => Math.abs(a - c.oklab[i]) <= tol), `oklab ${c.hex}`);
    for (const c of v.oklab_inverse) check(ss.oklabToLinearSrgb(...c.oklab).every((a, i) => Math.abs(a - c.linear_srgb[i]) <= tol), `oklab inverse ${c.oklab}`);
    check(eq([...ss.RISK_LEVELS], v.risk_levels), 'risk levels');
    check(ss.canonical(JSON.parse(JSON.stringify(ss.RISK_TOKENS))) === ss.canonical(v.risk_tokens), 'risk tokens');
    check(ss.canonical(JSON.parse(JSON.stringify(ss.RISK_GROUNDS))) === ss.canonical(v.risk_grounds), 'risk grounds');
    for (const c of v.contrast) { const cr = ss.contrastRatio(c.fg, c.bg); check(Math.abs(cr - c.ratio) <= tol && (cr >= 4.5) === c.aa_text, `contrast ${c.fg} ${c.bg}`); }
    for (const c of v.risk_of) check(ss.riskOf(c.in) === c.out, `risk_of ${JSON.stringify(c.in)}`);
    for (const c of v.hot_mark) check(ss.hotMark(c.in) === c.out, `hot_mark ${c.in}`);
  },
  reconcile(v) {
    for (const c of v.identity) check(ss.identity(c.ref, c.cand) === c.out, 'identity');
    for (const c of v.pcm_s16) check(ss.canonical(ss.reconcilePcmS16(i16(c.ref), i16(c.cand))) === ss.canonical(c.expected), `pcm ${c.name}`);
    for (const c of v.rgb8) check(ss.canonical(ss.reconcileRgb8(Uint8Array.from(c.ref), Uint8Array.from(c.cand))) === ss.canonical(c.expected), `rgb8 ${c.name}`);
    for (const c of v.f32_rmse) check(ss.f32Rmse(f32(c.ref), f32(c.cand), c.mask === null ? null : Uint8Array.from(c.mask)) === c.rmse, `f32_rmse ${c.mask}`);
    for (const c of v.round6) check(ss.round6(c.in) === c.out, `round6 ${c.in}`);
  },
  receipt(v) {
    for (const c of v.make) {
      const a = c.args;
      const got = ss.makeReceipt({ producer: a.producer, version: a.version, backend: a.backend, scene: a.scene, media: a.media,
        content: hex(a.content_hex), outputs: a.outputs, reference: a.reference ?? null, reconcile: a.reconcile ?? null, doesNotProve: a.does_not_prove });
      check(ss.canonical(got) === c.canonical, `make ${a.producer}`);
      check(got.receipt_sha256 === c.receipt_sha256, `make sha ${a.producer}`);
    }
    for (const c of v.verify) check(eq(ss.verifyReceipt(c.receipt), c.errors), `verify ${c.name}: ${JSON.stringify(ss.verifyReceipt(c.receipt))}`);
  },
  scene(v) {
    for (const c of v.hashes) check(ss.canonicalSha256(c.scene) === c.sha256, `scene hash ${c.name}`);
    for (const c of v.validate) check(eq(ss.validateScene(c.scene), c.errors), `validate ${c.name}`);
  },
};

const manifest = JSON.parse(readFileSync(join(VEC, 'MANIFEST.json'), 'utf8'));
file = 'MANIFEST.json';
check(ss.CONTRACT === manifest.contract, 'contract id');
for (const [name, digest] of Object.entries(manifest.files)) {
  file = name;
  const raw = readFileSync(join(VEC, name));
  check(createHash('sha256').update(raw).digest('hex') === digest, 'file hash matches MANIFEST');
  const run = RUNNERS[name.slice(0, -5)];
  if (!run) { check(false, 'no runner for this file'); continue; }
  try { run(JSON.parse(raw.toString('utf8'))); } catch (e) { check(false, `crashed: ${e && e.stack || e}`); }
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);
for (const f of fails.slice(0, 40)) console.log('FAIL', f);
console.log(`javascript: ${total - fails.length}/${total} checks passed`);
const out = opt('--summary');
if (out) writeFileSync(out, JSON.stringify(Object.fromEntries(Object.entries(counts).sort()), null, 1));
process.exit(fails.length ? 1 : 0);
