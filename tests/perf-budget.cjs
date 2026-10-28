// perf-budget.cjs: the performance budget as a gate. Every page in tests/perf/budget.json, on every profile, is
// measured by tests/perf/measure.cjs and held to the limits; any breach fails the run with the reason printed.
//
//   SITE_BASE_URL=http://127.0.0.1:8820 BROWSER_CHANNEL=chrome node tests/perf-budget.cjs [--out DIR] [--only /index.html]
//
// The report (perf-report.json) and one Chrome trace per page and profile go to --out (default perf-out/).
const fs = require('fs');
const path = require('path');
const { launch } = require('./lib/browser.cjs');
const { measure } = require('./perf/measure.cjs');

const budget = JSON.parse(fs.readFileSync(path.join(__dirname, 'perf', 'budget.json'), 'utf8'));
const base = (process.env.SITE_BASE_URL || 'http://127.0.0.1:8820').replace(/\/$/, '');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('--out', 'perf-out');
const only = arg('--only', null);
const L = budget.limits;

// Frame times mean something only on a real GPU: on a software rasteriser (a CI runner has no GPU) every page with
// a canvas misses frames, the budgeted ones included. There the frame limits are reported and not enforced; every
// other limit is enforced everywhere. PERF_FRAMES=enforce forces them on.
let framesEnforced = true;
function breaches(r) {
  const b = [];
  const over = (v, lim, what, unit = '') => { if (v > lim) b.push(`${what} ${v}${unit} > ${lim}${unit}`); };
  if (framesEnforced) { over(r.idleP95, L.idleP95Ms, 'idle p95 frame', ' ms'); over(r.scrollP95, L.scrollP95Ms, 'scroll p95 frame', ' ms'); }
  over(r.liveCanvases, L.liveCanvases, 'live canvases and GPU contexts');
  over(r.domCanvases, L.domCanvases, 'canvas elements');
  over(r.offscreenDraws.length, L.offscreenDraws, 'canvases drawing offscreen');
  over(r.hiddenDraws.length + r.hiddenVideos.length, L.hiddenDraws, 'things animating in a hidden tab');
  over(r.offscreenVideos.length, 0, 'videos playing offscreen');
  over(r.lcpMs, L.lcpMs, 'LCP', ' ms');
  over(r.cls, L.cls, 'CLS');
  over(r.firstViewJsKB, L.firstViewJsKB, 'first-view JS', ' KB gz');
  for (const m of r.media) b.push(`media: ${m}`);
  return b;
}

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await launch({ channel: process.env.BROWSER_CHANNEL || undefined, headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', ...(process.env.PERF_SOFTWARE === '1' ? ['--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--enable-unsafe-webgpu'])] });
  const probe = await browser.newPage();
  const renderer = await probe.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g?.getExtension('WEBGL_debug_renderer_info'); return g ? String(g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER)) : 'none'; });
  await probe.close();
  framesEnforced = process.env.PERF_FRAMES === 'enforce' || !/swiftshader|llvmpipe|software|none/i.test(renderer);
  console.log(`perf: renderer ${renderer}; frame limits ${framesEnforced ? 'enforced' : 'reported only (no GPU)'}`);
  // gated pages fail the run; watched pages are measured and reported against the same limits without failing it
  const watched = new Set(budget.watch || []);
  const pages = only ? [only] : [...budget.pages, ...(process.env.PERF_WATCH === '0' ? [] : watched)], results = [];
  let failed = 0;
  for (const p of pages) for (const prof of budget.profile.viewports) {
    const slug = `${p.replace(/[^a-z0-9]+/gi, '_')}-${prof.name}`;
    let r;
    try { r = await measure(browser, base + p, prof, budget, path.join(out, `${slug}.trace.json`)); }
    catch (e) { console.error(`perf: ${p} on ${prof.name} could not be measured`, e); r = { url: base + p, profile: prof.name, error: e.message, media: [], offscreenDraws: [], hiddenDraws: [], hiddenVideos: [], offscreenVideos: [] }; }
    r.breaches = r.error ? [`not measured: ${r.error}`] : breaches(r);
    r.gated = !watched.has(p) || only === p;
    if (r.breaches.length && r.gated) failed++;
    results.push(r);
    console.log(`${r.breaches.length ? (r.gated ? 'FAIL' : 'OVER (watched)') : 'PASS'} ${p} ${prof.name}: LCP ${r.lcpMs} ms, CLS ${r.cls}, p95 idle ${r.idleP95} / scroll ${r.scrollP95} ms, ` +
      `canvases ${r.domCanvases} (live ${r.liveCanvases}, GPU ${r.gpuContexts}), JS ${r.firstViewJsKB} KB gz`);
    for (const b of r.breaches) console.log(`     ${b}`);
  }
  await browser.close();
  fs.writeFileSync(path.join(out, 'perf-report.json'), JSON.stringify({ at: new Date().toISOString(), base, renderer, framesEnforced, budget: budget.limits, results }, null, 2));
  const gated = results.filter((r) => r.gated).length;
  console.log(`perf: ${gated - failed} of ${gated} gated runs inside the budget; report in ${path.join(out, 'perf-report.json')}`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('perf: the gate crashed', e); process.exit(2); });
