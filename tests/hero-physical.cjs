// The home hero in a browser (30 October 2026). Part 1 compiles the hero's own GLSL optics (world/site/hero/
// optics.js) on the GPU and checks known answers in float32 readback: N-BK7 reflects 4.2 % at normal incidence, a
// zero film equals the bare interface, a quarter-wave MgF2 film on BK7 reflects 1.27 % at 550 nm, and the slab
// displaces blue further than red. Part 2 loads the home page and checks the live render, the measured frame time,
// reduced motion (one still frame) and Plain view (the poster). Writes tests/.out/hero-physical.json.
//   BASE=http://127.0.0.1:8791/ ANGLE=d3d11|swiftshader node tests/hero-physical.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("fs"), path = require("path");
const BASE = process.env.BASE || "http://127.0.0.1:8791/", ANGLE = process.env.ANGLE || "d3d11";
const fails = [], ok = (c, m) => { if (!c) fails.push(m); console.log((c ? "pass " : "FAIL ") + m); };

const PROBE = `async () => {
  const { OPTICS } = await import("/world/site/hero/optics.js");
  const { SPECTRA } = await import("/world/site/hero/spectra.js");
  const L = SPECTRA.layouts[8], nd = SPECTRA.check.n_bk7_587_56;
  const n550 = 1.518493; // N-BK7 at 550 nm from the same table (3-bin centroid 550.18 nm)
  const fs = "#version 300 es\\nprecision highp float;\\n" + OPTICS + \`
    uniform float nd, n550, nb, nr; out vec4 o;
    void main() {
      int px = int(gl_FragCoord.x);
      vec3 tilt = normalize(vec3(0.6, 0.2, 1.0));
      if (px == 0) o = vec4(fresnelDielectric(1.0, nd), filmReflect(1.0, 1.38, n550, 0.0, 550.0), fresnelDielectric(1.0, n550), filmReflect(1.0, 1.38, n550, 550.0 / (4.0 * 1.38), 550.0));
      else o = vec4(length(slabOffset(tilt, nb, 0.05, 0.3).xy), length(slabOffset(tilt, nr, 0.05, 0.3).xy), fresnelDielectric(0.0, nd), fresnelDielectric(0.5, 1.5));
    }\`;
  const c = document.createElement("canvas"), gl = c.getContext("webgl2"); gl.getExtension("EXT_color_buffer_float");
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, "#version 300 es\\nin vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }")); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, "a"); gl.linkProgram(p); gl.useProgram(p);
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 2, 1, 0, gl.RGBA, gl.FLOAT, null);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); gl.viewport(0, 0, 2, 1);
  gl.uniform1f(gl.getUniformLocation(p, "nd"), nd); gl.uniform1f(gl.getUniformLocation(p, "n550"), n550);
  gl.uniform1f(gl.getUniformLocation(p, "nb"), L.n_bk7[0]); gl.uniform1f(gl.getUniformLocation(p, "nr"), L.n_bk7[7]);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
  const out = new Float32Array(8); gl.readPixels(0, 0, 2, 1, gl.RGBA, gl.FLOAT, out);
  return { out: [...out], nd, n550, renderer: gl.getParameter(gl.RENDERER) };
}`;

(async () => {
  const args = [`--use-angle=${ANGLE}`, "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"];
  const browser = await chromium.launch({ headless: true, args });
  const report = { angle: ANGLE, when: new Date().toISOString() };
  // part 1: the optics on the GPU
  let page = await browser.newPage();
  await page.goto(BASE + "robots.txt");
  const r = await page.evaluate(`(${PROBE})()`), [F0, film0, bare550, quarter, offB, offR, grazing, f05] = r.out;
  report.optics = { renderer: r.renderer, F0, film0, bare550, quarter, offB, offR, grazing, f05 };
  ok(Math.abs(F0 - 0.04216) < 1e-4, `N-BK7 normal-incidence reflectance ${(F0 * 100).toFixed(3)} % (known 4.22 %)`);
  ok(Math.abs(film0 - bare550) < 1e-6, `zero-thickness film equals the bare interface (${film0} vs ${bare550})`);
  ok(Math.abs(quarter - 0.0127) < 3e-4, `quarter-wave MgF2 on BK7 at 550 nm reflects ${(quarter * 100).toFixed(3)} % (known 1.27 %)`);
  ok(offB > offR, `blue displaced further than red (${offB.toFixed(5)} > ${offR.toFixed(5)})`);
  ok(grazing > 0.999, `grazing incidence reflects all (${grazing})`);
  // Fresnel at cos 0.5, n 1.5, from the closed form
  const c = 0.5, w = Math.sqrt(2.25 - 0.75), rs = (c - w) / (c + w), rp = (2.25 * c - w) / (2.25 * c + w);
  ok(Math.abs(f05 - 0.5 * (rs * rs + rp * rp)) < 1e-6, `Fresnel at 60 degrees matches the closed form (${f05})`);
  await page.close();
  // part 2: the live hero
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(BASE, { waitUntil: "load" });
  // a software GL needs longer to fill its first 60-frame window; wait for a measurement or a settled still
  await page.waitForFunction(() => window.__hero && (window.__hero.frameMs != null || /still/.test(window.__hero.state)), null, { timeout: 60000 }).catch(() => {});
  const live = await page.evaluate(() => ({ ...window.__hero, glOn: document.querySelector(".arrival-art")?.classList.contains("gl-on") }));
  report.live = live;
  ok(live.glOn && /live|still/.test(live.state), `hero drew (state ${live.state}, tier ${live.tier}, ${live.N} bins, scale ${live.scale})`);
  ok(live.frameMs != null || /still: slow/.test(live.state), `frame time measured: median ${live.frameMs} ms (${live.fps} fps), GPU ${live.gpuMedianMs ?? "n/a"} ms, ladder ${JSON.stringify(live.ladder)} on ${r.renderer}`);
  ok(errs.length === 0, `no page errors ${errs.join("; ")}`);
  await page.evaluate(() => document.documentElement.classList.add("plain")); await page.waitForTimeout(300);
  ok(await page.evaluate(() => getComputedStyle(document.querySelector(".hero-physical")).display === "none" && getComputedStyle(document.querySelector(".arrival-art video")).visibility === "visible"), "Plain view shows the poster, not the render");
  await ctx.close();
  const rm = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: "light" });
  page = await rm.newPage(); await page.goto(BASE, { waitUntil: "load" }); await page.waitForTimeout(3000);
  const still = await page.evaluate(() => window.__hero);
  report.reduced = still;
  ok(/still/.test(still.state), `reduced motion draws one still frame (${still.state})`);
  await rm.close(); await browser.close();
  const dir = path.join(__dirname, ".out"); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `hero-physical-${ANGLE}.json`), JSON.stringify(report, null, 1));
  if (fails.length) { console.error(`${fails.length} failed`); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
