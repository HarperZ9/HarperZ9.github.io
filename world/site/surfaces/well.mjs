// well.mjs: the bench's well. A sheet of paper (or a body of dark water) that carries up to four elements, each
// a pigment drawn from its own measured numbers, and that answers the visitor: drag stirs it, a press pours, the
// arrow keys tilt it.
//
//   const well = createWell(canvas, { reduced, ground: 'paper' });   (a ground id from grounds.mjs)
//   (each part may carry links: [0..1 to every other part], the measured link strengths that open the reaction)
//   well.set([{ ok: [L, a, b], weight, drive: { wavelength, orientation, peak, beta, softness, coverage, density,
//               saturation, rows, speed, curl, coherence, opacity, granulation, rim, bleed, scale } }]);
//   well.pour(slot, x, y); well.stir(x, y, vx, vy); well.tilt(dx, dy); well.reset(); well.ground(id); well.destroy();
//   well.transform(id, op, seconds)   the ground changes state to another ground behind a front (heat, cool, grind, ...)
//   well.write(mask, w, h)            letters as a coverage mask, laid as ink on a layered ground; write(null) lifts them
//   well.brush()                      the layer the site's brush engine paints in (brush-field.mjs), made when first asked for
//   On the glass and ice grounds the pane refracts: glass-ground.mjs asks the site's glass renderer for the map.
//   well.fade(slot, share)            a pigment loses its colour by this share, as a fugitive dye does in light
//
// What happens in the well is well-sim.mjs (the water, the pigment it carries and conserves, the reaction). How
// it looks is well-shader.mjs (a ground for each medium, each with its own rule for combining colour). The optics
// are km.mjs, the same module that paints the glaze swatches in the blend table. Coordinates are fractions of the
// well, x right, y down. Reduced motion: no drift; each act settles at once into a still, shown dry.
import { createSim, STEP, NX, NY, RX, RY } from './well-sim.mjs';
import { VERT, FRAG } from './well-shader.mjs';
import { pigment, okToLinear, productOk, PRODUCT_OPACITY, ksOf, BAND_RGB } from './km.mjs';
import { GROUNDS, behaviour } from './grounds.mjs';
import { createLayer, clearLayer, coverage, dissolve, held, FX, FY } from './brush-field.mjs';

const OPS = { heat: 1, cool: 2, dry: 2, grind: 3, dissolve: 4, press: 5 }, INK = pigment([0.035, 0.035, 0.06], 0.6), PALE = [0.8, 0.78, 0.7];

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export function createWell(canvas, { reduced = false, ground = 'paper' } = {}) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  if (!gl) return null;
  const sh = (src, type) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('well shader: ' + gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram(); gl.attachShader(prog, sh(VERT, gl.VERTEX_SHADER)); gl.attachShader(prog, sh(FRAG, gl.FRAGMENT_SHADER));
  gl.bindAttribLocation(prog, 0, 'p'); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('well link: ' + gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  const tex = (unit) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k, val] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, val);
    return t; };
  const tDye = tex(0), tDisp = tex(1), tProd = tex(2), tBrush = tex(4), tGlass = tex(5), tWrite = tex(3);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(1));
  gl.uniform1i(U('uDye'), 0); gl.uniform1i(U('uDisp'), 1); gl.uniform1i(U('uProd'), 2); gl.uniform1i(U('uWrite'), 3); gl.uniform1i(U('uBrush'), 4); gl.uniform1i(U('uGlass'), 5); gl.uniform3fv(U('uPM'), BAND_RGB); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  const sim = createSim({ reduced }), n = NX * NY, bDye = new Uint8Array(n * 4), bDisp = new Uint8Array(n * 4), bProd = new Uint8Array(RX * RY);
  const gain = [1, 1, 1, 1], time = { sim: 0, gap: 0, frames: 0 };
  let raf = 0, last = 0, dead = false, idleAt = 0, soft = 0.1, strength = 0, flat = null, next = null, written = false, tl = [0, 0], done = null, layer = null, tick = 0, pane = null, paneWant = '', refract = 1;
  // the pane's refraction map, from the site's glass renderer; asked for when a clear ground is first shown
  function paneFor(id) { const g = GROUNDS[id]; if (!g || g.med !== 3) return; const kind = g.v ? 'ice' : 'glass'; if (paneWant === kind) return; paneWant = kind;
    import('./glass-ground.mjs').then((m) => m.glassMap(kind)).then((m) => { if (dead || paneWant !== kind) return; gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, tGlass);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, m.w, m.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, m.data); pane = m; draw(); }).catch((e) => console.info('well: the pane is shown without refraction:', e.message)); }
  // How fast a ground takes brushed paint off the mark and into the carried field, per step: a solid leaves it where it
  // was laid, a liquid and a gas carry it off, grains and the data lattice take it whole. Our numbers, none measured.
  const TAKES = { liquid: 0.03, gas: 0.05, powder: 1 }, takes = () => { const g = GROUNDS[ground] || GROUNDS.paper; return g.rule === 'partitive' ? 1 : TAKES[g.state] || 0; };
  function brushUp(share = 0) {
    if (!layer) return;
    if (share > 0 && layer.box) dissolve(layer, sim, share, sim.parts.length);
    const d = layer.surface.takeDirty(); if (!d) return;
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, tBrush); gl.texSubImage2D(gl.TEXTURE_2D, 0, d.x0, d.y0, d.x1 - d.x0 + 1, d.y1 - d.y0 + 1, gl.RGBA, gl.UNSIGNED_BYTE, coverage(layer, d));
  }
  sim.setMedium(behaviour(ground));

  function uniforms() {
    const parts = sim.parts, A = new Float32Array(16), B = new Float32Array(16), C = new Float32Array(16), D = new Float32Array(16), O = new Float32Array(15), K = new Float32Array(18), S = new Float32Array(18), Q = new Float32Array(64);
    parts.forEach((p, i) => {
      const d = p.drive, th = (d.orientation ?? 90) * Math.PI / 180, f = 0.85 * clamp(p.fade ?? 0, 0, 1), lin = okToLinear(p.ok, d.saturation).map((x, c) => x + (PALE[c] - x) * f), pg = pigment(lin, d.opacity);
      // dominant wavelength sets the feature size; the angle turns the grain; wave strength draws it out into bands
      A.set([clamp(0.085 / clamp(d.wavelength, 0.003, 0.3), 0.9, 22), Math.cos(th), Math.sin(th), 1 + 5 * clamp(d.peak, 0, 1.2)], i * 4);
      // spectral slope sets the roughness (a steeper slope keeps less fine detail); edge softness is the width of every gradient
      B.set([clamp(Math.pow(2, -(d.beta - 1.1)), 0.18, 0.8), clamp(d.softness * 0.035, 0.03, 0.5), clamp(d.coverage, 0, 1), clamp(d.density * 8, 0, 0.95)], i * 4);
      C.set([d.rows, 11.3 * (i + 1), 1, 0], i * 4);
      D.set([clamp(d.granulation ?? 0.5, 0, 1), clamp(d.rim ?? 0.5, 0, 1), clamp(d.bleed ?? 0.5, 0, 1.2), 0], i * 4);
      O.set(lin, i * 3); K.set(pg.K, i * 3); S.set(pg.S, i * 3); Q.set(ksOf(lin), i * 16);   // Q: the pigment's spectrum, for wet mixing
    });
    // the product: one pigment, computed from the linked pairs by the strength of their links
    let ok = [0, 0, 0], w = 0, sf = 0, pairs = 0;
    for (let a = 0; a < parts.length; a++) for (let b = a + 1; b < parts.length; b++) { const l = parts[a].links?.[b] ?? 0; if (l <= 0) continue; pairs++;
      const pk = productOk(parts[a].ok, parts[b].ok, l); ok = ok.map((x, c) => x + l * pk[c]); w += l; sf += l * ((parts[a].drive.bleed ?? 0.5) + (parts[b].drive.bleed ?? 0.5)) / 2; }
    const pl = okToLinear(w ? ok.map((x) => x / w) : [0.7, 0, 0]), pp = pigment(pl, PRODUCT_OPACITY);
    O.set(pl, 12); K.set(pp.K, 12); S.set(pp.S, 12); K.set(INK.K, 15); S.set(INK.S, 15); soft = w ? clamp(0.03 + 0.2 * sf / w, 0.03, 0.26) : 0.1; strength = w ? w / pairs : 0;
    gl.uniform4fv(U('uA'), A); gl.uniform4fv(U('uB'), B); gl.uniform4fv(U('uC'), C); gl.uniform4fv(U('uD'), D);
    gl.uniform4fv(U('uKS'), Q); gl.uniform3fv(U('uLin'), O); gl.uniform3fv(U('uK'), K); gl.uniform3fv(U('uS'), S);
  }
  function draw() {
    const { dye, dx, dy, RV, phase } = sim; brushUp(); paneFor(next ? next.id : ground); if (next) paneFor(ground);
    if (next && !sim.changing) { ground = next.id; next = null; const fn = done; if (fn) setTimeout(() => fn(ground), 0); }   // the front has crossed: the new ground stands
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 4; c++) bDye[i * 4 + c] = clamp(dye[c][i], 0, 1) * 255;
      bDisp[i * 4] = clamp(dx[i] + 0.5, 0, 1) * 255; bDisp[i * 4 + 1] = clamp(dy[i] + 0.5, 0, 1) * 255; bDisp[i * 4 + 2] = phase[i] * 255; bDisp[i * 4 + 3] = 255;
    }
    for (let i = 0; i < bProd.length; i++) bProd[i] = clamp(RV[i] * 2.4, 0, 1) * 255;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tDye); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, NX, NY, 0, gl.RGBA, gl.UNSIGNED_BYTE, bDye);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tDisp); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, NX, NY, 0, gl.RGBA, gl.UNSIGNED_BYTE, bDisp);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tProd); gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, RX, RY, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bProd);
    gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform1f(U('uAspect'), canvas.width / canvas.height);
    const g = GROUNDS[ground] || GROUNDS.paper, g2 = next ? GROUNDS[next.id] : g; gl.uniform3fv(U('uBase'), new Float32Array(g.base)); gl.uniform3fv(U('uBase2'), new Float32Array(g2.base));
    gl.uniform4f(U('uFx'), g.med, sim.dry, soft, strength); gl.uniform4fv(U('uGain'), gain); gl.uniform4f(U('uEnv'), g.v, tl[0], tl[1], 0); gl.uniform4f(U('uTo'), g2.med, g2.v, next ? OPS[next.op] || 1 : 0, next ? 1 : 0); gl.uniform4f(U('uInk'), 0, 0, 0, written ? 1 : 0); gl.uniform4f(U('uBr'), layer?.box ? 1 : 0, 0, 0, 0);
    gl.uniform4f(U('uGl'), pane && pane.kind === paneWant ? refract : 0, pane ? pane.reach[0] : 0, pane ? pane.reach[1] : 0, 0); gl.uniform4f(U('uGs'), pane ? pane.spread.r : 1, pane ? pane.spread.b : 1, 0, 0);
    gl.uniform1f(U('uFlatOn'), flat ? 1 : 0); gl.uniform4fv(U('uFlat'), flat || [0, 0, 0, 0]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function size() {
    const r = Math.min(devicePixelRatio || 1, 2), w = Math.max(2, Math.round(canvas.clientWidth * r)), h = Math.max(2, Math.round(canvas.clientHeight * r));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  function frame(now) {
    raf = 0; if (dead) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000), last0 = last;
    if (last) { time.gap += now - last; time.frames++; } last = now;
    if (dt > 0) { const t = performance.now(); if (layer?.box && takes() && !(tick++ & 3)) brushUp(Math.min(1, takes() * 4)); sim.step(STEP, true, 1, Math.min(0.25, (now - (last0 || now)) / 1000)); time.sim += performance.now() - t; } draw();
    if (now > idleAt || document.hidden) { last = 0; return; }    // the water has had its time: hold the still
    raf = requestAnimationFrame(frame);
  }
  // an act wakes the water for a while; under reduced motion it settles at once and holds a still
  function wake(ms = 45000) {
    if (dead) return;
    if (reduced) { if (takes()) brushUp(1); for (let i = 0; i < 24; i++) sim.step(STEP, false); draw(); return; }
    idleAt = performance.now() + ms; if (!raf) raf = requestAnimationFrame(frame);
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { size(); draw(); }) : null;
  ro?.observe(canvas);
  const onVis = () => { if (!document.hidden && !reduced && performance.now() < idleAt && !raf) raf = requestAnimationFrame(frame); };
  document.addEventListener('visibilitychange', onVis);
  size();

  const api = {
    reduced, grid: [NX, NY], reactionGrid: [RX, RY], sim,
    // parts: up to four. reseed false keeps the water as it is and only changes how the elements are drawn.
    // Under reduced motion the flow drives can only show in the still, so a change to one of them starts the still again.
    set(next, { reseed = true } = {}) { const was = JSON.stringify(sim.flow); sim.set(next); uniforms();
      if (reseed || (reduced && was !== JSON.stringify(sim.flow))) { sim.seed(); sim.settle(); if (reseed && layer) clearLayer(layer); } if (reduced) draw(); else wake(); return api; },
    pour(slot, x, y, amount = 0.5) { sim.pour(slot, x, y, amount); wake(); return api; },
    stir(x, y, vx, vy) { sim.stir(x, y, vx, vy); wake(); return api; },
    tilt(tx, ty) { tl = [clamp(tx, -1, 1), clamp(ty, -1, 1)]; sim.tilt(tx, ty); wake(); return api; },
    touch() { wake(); return api; },   // something outside changed the field (a brush): draw it and let the water run
    reset() { sim.seed(); sim.settle(); if (layer) clearLayer(layer); if (reduced) draw(); else wake(); return api; },
    // the ground the pigment lies on: an id from grounds.mjs
    ground(id) { if (id === undefined) return ground; if (GROUNDS[id]) { ground = id; next = null; sim.setMedium(behaviour(id)); } draw(); return api; },
    // the ground changes state: a front crosses the well over `seconds`, and the solver's medium changes behind it.
    // then(id) is called once the new ground stands. Under reduced motion the change is whole at once.
    transform(id, op, seconds = 9, then = null) { if (!GROUNDS[id] || id === ground) return api; next = { id, op }; done = then; sim.change(behaviour(id), op, seconds); wake(); return api; },
    changing: () => (next ? { to: next.id, op: next.op, f: sim.changing?.f ?? 1 } : null),
    write(mask, w, h) { written = !!mask; gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, tWrite); const b = mask ? Uint8Array.from(mask, (x) => clamp(x, 0, 1) * 255) : new Uint8Array(1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, mask ? w : 1, mask ? h : 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, b); draw(); return api; },
    brush() { if (!layer) { layer = createLayer(); gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, tBrush); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, FX, FY, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(FX * FY * 4)); } return layer; },
    brushed: () => (layer ? held(layer) : [0, 0, 0, 0]),   // the brushed paint still in the layer, per pigment, in the unit of amounts()
    fade(slot, share) { if (sim.parts[slot]) { sim.parts[slot].fade = share; uniforms(); draw(); } return api; },
    // for checks: each of granulation, rim, tooth and product can be switched off (0) to see what it adds
    gain(g = {}) { ['granulation', 'rim', 'tooth', 'product'].forEach((k, i) => { if (typeof g[k] === 'number') gain[i] = g[k]; }); if (typeof g.refract === 'number') refract = g.refract; draw(); return api; },
    pane: () => (pane && pane.kind === paneWant ? { kind: pane.kind, spread: pane.spread, reach: pane.reach } : null),   // the refraction map in use, once it has come
    // for checks: the shader's answer for flat layers of these thicknesses on untextured paper, as [r, g, b] on 0 to 255
    optics(d) { flat = new Float32Array(4); flat.set(d.slice(0, 4)); draw(); const px = new Uint8Array(4); gl.readPixels(canvas.width >> 1, canvas.height >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); flat = null; draw(); return [px[0], px[1], px[2]]; },
    // the picture as it stands, drawn now
    still() { draw(); return canvas; },
    read(w = 48, h = 36) { draw(); const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(canvas, 0, 0, w, h); return x.getImageData(0, 0, w, h).data; },
    // mean milliseconds per frame spent in the simulation, and between frames, since the last call
    timing() { const o = { frames: time.frames, sim: time.frames ? time.sim / time.frames : 0, frame: time.frames ? time.gap / time.frames : 0 }; time.sim = time.gap = time.frames = 0; return o; },
    energy: () => sim.energy(), product: () => sim.product(), amounts: () => sim.amounts(),
    conservation: () => ({ put: sim.put(), now: sim.amounts(), error: sim.error(), worstStepBeforeCorrection: sim.drift() }),
    destroy() { dead = true; cancelAnimationFrame(raf); ro?.disconnect(); document.removeEventListener('visibilitychange', onVis); gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
  return api;
}
