// Walk or fly the island. One WebGPU device from the engine's web host (native/web/raw-gpu.mjs).
// A frame is: the mirror pass where still water is near, the world in linear light (sky, ground,
// what stands on it, water, weather, lamps), then fog, bloom and the film curve (post.wgsl).
// The clock, the weather and the sky events come from world/weather.mjs; the ground, the
// settlements and the landmarks from the generated world.
//
//   ?world=out/20261118   which generated world to load (under games/low-water/world/)
//   ?x=&z=&alt=&yaw=&pitch=&clock=&day=&fly=1   a starting view (km, m, degrees, hours)
//   ?still=1              hold the clock (for stills); ?quality=0.5 scales how far detail reaches
//   ?mirror=0 ?scale=0.5  switch the mirror pass off; draw at a share of the window's size
import { createHost } from "/rn/web/raw-gpu.mjs";
import { loadWorld, groundAt, regionAt, waterAt, bakeMaps, bakeRect, heightPyramid, refreshPyramid } from "./data.mjs";
import { selectNodes, frustumPlanes } from "./lod.mjs";
import { frameLight, groundState } from "./light.mjs";
import { sky as skyAt, makeRegionField } from "../weather.mjs";
import { viewProj, invert, mirrored } from "./mat.mjs";
import { makeStage, OFF, FRAME_FLOATS } from "./stage.mjs";
import { makeRoads } from "./roads.mjs";
import { makeNear } from "./near.mjs";
import { makeLights } from "./lights.mjs";
import { makeScene } from "./scene.mjs";

const Q = new URLSearchParams(location.search), num = (k, d) => Q.has(k) ? +Q.get(k) : d;
const canvas = document.getElementById("view"), hud = document.getElementById("hud"), note = document.getElementById("note");
const say = (t) => { note.textContent = t; note.hidden = !t; };
const REGION_NAMES = ["Open Sea", "Thaw Country", "The Folded Uplands", "The Fog Forest", "The Storm Coast", "The Canyon and Badlands", "The Marsh", "The City Across the Water", "The Works", "The Monument Ground", "The Drowned Quarter", "The Far-North Works Town"];

async function start() {
  say("Opening the GPU");
  const host = await createHost({ canvas, timing: false }), dev = host.device;
  say("Reading the island");
  // the tiles round where the walker will stand are read first
  const startAt = (json) => { const s = json.settlements.find((q) => q.name === "Gullet") || json.settlements[0]; return [num("x", s.x * 0.064 + 1.2) * 1000, num("z", s.y * 0.064 + 0.4) * 1000]; };
  const world = await loadWorld(`/world/${Q.get("world") || "out/20261118"}`, (p, n) => say(`Reading the island: ${n} (${Math.round(p * 100)} %)`), startAt);
  say("Drawing the ground maps");
  const maps = bakeMaps(world), pyramid = heightPyramid(world), seed = world.json.seed;
  const shares = makeRegionField((x, z) => regionAt(world, x, z), world.width, world.depth);
  const stage = await makeStage(dev, host.format, world, maps);
  const roads = makeRoads(world), near = makeNear(roads), lights = makeLights(), quality = num("quality", 1);
  world.near = near;

  const skyM = await stage.module("sky.wgsl"), terrainM = await stage.module("materials.wgsl", "terrain.wgsl"), lampM = await stage.module("lamp.wgsl");
  const gridBuffers = [{ arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }] }, { arrayStride: 16, stepMode: "instance", attributes: [{ shaderLocation: 1, offset: 0, format: "float32x4" }] }];
  const skyPipe = stage.pipe(skyM, "vsSky", "fsSky", [], { depth: "none" });
  const groundPipe = stage.pipe(terrainM, "vsGround", "fsGround", gridBuffers);
  const waterPipe = stage.pipe(terrainM, "vsWater", "fsWater", gridBuffers, { blend: "alpha" });
  const lampPipe = stage.pipe(lampM, "vsLamp", "fsLamp", [{ arrayStride: 32, stepMode: "instance", attributes: [{ shaderLocation: 0, offset: 0, format: "float32x4" }, { shaderLocation: 1, offset: 16, format: "float32x4" }] }], { depth: "test", blend: "add", topology: "triangle-strip" });

  // the 32 x 32 grid every terrain node is drawn with
  const N = 32, grid = new Float32Array(N * N * 12);
  for (let j = 0, o = 0; j < N; j++) for (let i = 0; i < N; i++) for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) { grid[o++] = (i + a) / N; grid[o++] = (j + b) / N; }
  const vbuf = (data, usage = GPUBufferUsage.VERTEX) => { const b = dev.createBuffer({ size: Math.max(16, data.byteLength), usage: usage | GPUBufferUsage.COPY_DST }); dev.queue.writeBuffer(b, 0, data); return b; };
  const gridBuf = vbuf(grid), MAX_NODES = 4096, nodes = new Float32Array(MAX_NODES * 4), nodesM = new Float32Array(MAX_NODES * 4);
  const nodeBuf = dev.createBuffer({ size: nodes.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }), nodeBufM = dev.createBuffer({ size: nodes.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  let lampBuf = null, lampCount = 0;

  say("Raising what stands on the island");
  const scene = await makeScene({ dev, stage, world, roads, near, lights, quality, vbuf, say });

  // ---------------------------------------------------------------- the walker
  const seat = world.json.settlements.find((s) => s.name === "Gullet") || world.json.settlements[0];
  const cam = { x: num("x", seat.x * 0.064 + 1.2) * 1000, z: num("z", seat.y * 0.064 + 0.4) * 1000, y: 0, yaw: num("yaw", 80) * Math.PI / 180, pitch: num("pitch", -4) * Math.PI / 180, fly: Q.get("fly") === "1", alt: num("alt", 1.7), speed: 0, fov: num("fov", 60) };
  const time = { day: num("day", 3), clock: num("clock", 17.2), hold: Q.get("still") === "1", rate: num("rate", 30), t: 0 };   // rate: game seconds per real second
  const keys = new Set();
  addEventListener("keydown", (e) => { keys.add(e.code); if (e.code === "KeyF") cam.fly = !cam.fly; if (e.code === "KeyT") time.hold = !time.hold; if (e.code === "KeyH") hud.hidden = !hud.hidden; if (e.code.startsWith("Digit") || e.code === "Minus") jump(e.code === "Minus" ? 11 : e.code === "Digit0" ? 10 : +e.code.slice(5)); });
  addEventListener("keyup", (e) => keys.delete(e.code));
  canvas.addEventListener("click", () => canvas.requestPointerLock && canvas.requestPointerLock());
  addEventListener("mousemove", (e) => { if (document.pointerLockElement === canvas) { cam.yaw += e.movementX * 0.0022; cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - e.movementY * 0.0022)); } });
  addEventListener("wheel", (e) => { time.clock = (time.clock + Math.sign(e.deltaY) * 0.25 + 24) % 24; });
  function jump(region) {
    const s = world.json.settlements.find((q) => q.kind === "seat" && q.region === region) || world.json.regions.find((r) => r.id === region);
    if (!s) return;
    cam.x = ((s.x ?? s.cx) + 6) * world.cell; cam.z = ((s.y ?? s.cy) + 9) * world.cell; cam.yaw = -0.6; cam.pitch = -0.05;
  }
  const surfaceAt = (x, z) => Math.max(groundAt(world, x, z), waterAt(world, x, z) > -500 ? waterAt(world, x, z) - 1.1 : -1e9);
  let route = null;   // a line to walk for a capture: { pts, s, speed }
  function move(dt) {
    const fwd = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0), side = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0), rise = (keys.has("Space") ? 1 : 0) - (keys.has("KeyC") ? 1 : 0);
    const fast = keys.has("ShiftLeft") || keys.has("ShiftRight"), x0 = cam.x, z0 = cam.z;
    if (keys.has("BracketRight")) time.clock = (time.clock + dt * 2) % 24;
    if (keys.has("BracketLeft")) time.clock = (time.clock - dt * 2 + 24) % 24;
    if (route) followRoute(dt);
    else if (cam.fly) {
      const v = (fast ? 1200 : 120) * Math.max(1, cam.alt / 300), cp = Math.cos(cam.pitch);
      cam.x += (Math.sin(cam.yaw) * cp * fwd + Math.cos(cam.yaw) * side) * v * dt; cam.z += (-Math.cos(cam.yaw) * cp * fwd + Math.sin(cam.yaw) * side) * v * dt;
      cam.alt = Math.max(2, cam.alt + (Math.sin(cam.pitch) * fwd + rise) * v * dt);
    } else {
      const v = fast ? 5.5 : 1.4;                                                                                        // a walk and a run, in metres a second
      cam.x += (Math.sin(cam.yaw) * fwd + Math.cos(cam.yaw) * side) * v * dt; cam.z += (-Math.cos(cam.yaw) * fwd + Math.sin(cam.yaw) * side) * v * dt;
      cam.alt = 1.7;
    }
    cam.x = Math.max(-20000, Math.min(world.width + 20000, cam.x)); cam.z = Math.max(-20000, Math.min(world.depth + 20000, cam.z));
    if (near.bake(cam.x, cam.z)) stage.uploadNear(near);
    cam.y = surfaceAt(cam.x, cam.z) + cam.alt;
    cam.speed = dt > 0 ? Math.hypot(cam.x - x0, cam.z - z0) / dt : 0;
    // a walker's head rises and falls a little with each stride
    if (!cam.fly && cam.speed > 0.2) { cam.stride = (cam.stride || 0) + cam.speed * dt; cam.y += Math.sin(cam.stride * 4.2) * 0.022; }
  }
  function followRoute(dt) {
    const r = route; r.s += r.speed * dt;
    const at = (s) => { const f = Math.min(r.pts.length - 1.001, Math.max(0, s / r.step)), i = Math.floor(f), t = f - i, a = r.pts[i], b = r.pts[i + 1]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
    const p = at(r.s), q = at(r.s + 9), want = Math.atan2(q[0] - p[0], -(q[1] - p[1]));
    let d = want - cam.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    cam.yaw += d * Math.min(1, dt * 2.2) + (r.look || 0) * dt; cam.x = p[0]; cam.z = p[1]; cam.alt = r.alt ?? 1.7; cam.fly = false;
    if (r.s > (r.pts.length - 1) * r.step) route = null;
  }

  // where the walker has just been, so the fog can open there and close again (about a second)
  const trail = [];
  function leaveTrail(dt) {
    for (const t of trail) t.age += dt;
    while (trail.length && trail[0].age > 1.2) trail.shift();
    const lastT = trail[trail.length - 1];
    if (!lastT || Math.hypot(cam.x - lastT.x, cam.z - lastT.z) > 0.9) { trail.push({ x: cam.x, y: cam.y - 0.6, z: cam.z, age: 0 }); if (trail.length > 7) trail.shift(); }
  }
  // still water near the walker: its level, or null
  function waterNear() {
    if (cam.alt > 600) return null;
    for (const r of [0, 120, 400, 1000, 2200]) for (let a = 0; a < (r ? 8 : 1); a++) {
      const x = cam.x + Math.sin(cam.yaw + a * Math.PI / 4) * r, z = cam.z - Math.cos(cam.yaw + a * Math.PI / 4) * r;
      if (x < 0 || z < 0 || x >= world.width || z >= world.depth) return 0;
      const w = waterAt(world, x, z); if (w > -500 && w < cam.y) return w;
    }
    return null;
  }

  // ---------------------------------------------------------------- a frame
  const frame = new Float32Array(FRAME_FLOATS), frameM = new Float32Array(FRAME_FLOATS), nbProbe = new Float32Array(5);
  let last = performance.now(), frames = 0, nodeCount = 0, state = null, grabbing = null, manual = false;
  const gaps = [], wantMirror = Q.get("mirror") !== "0";
  function drawWorld(pass, which, nBuf, nCount) {
    pass.setBindGroup(0, stage.st.binds[which]);
    pass.setPipeline(skyPipe); pass.draw(3);
    pass.setPipeline(groundPipe); pass.setVertexBuffer(0, gridBuf); pass.setVertexBuffer(1, nBuf); pass.draw(N * N * 6, nCount);
    scene.draw(pass, which);
    if (which === "main") { pass.setPipeline(waterPipe); pass.setVertexBuffer(0, gridBuf); pass.setVertexBuffer(1, nBuf); pass.draw(N * N * 6, nCount); scene.drawAir(pass); }
    if (lampCount) { pass.setPipeline(lampPipe); pass.setVertexBuffer(0, lampBuf); pass.draw(4, lampCount); }
  }
  function draw(now, fixedDt = null) {
    const dt = fixedDt ?? Math.min(0.1, (now - last) / 1000); gaps.push(now - last); if (gaps.length > 240) gaps.shift(); last = now;
    const scale = num("scale", 1), cw = Math.max(2, Math.floor(canvas.clientWidth * scale)), chh = Math.max(2, Math.floor(canvas.clientHeight * scale));
    if (canvas.width !== cw || canvas.height !== chh) { canvas.width = cw; canvas.height = chh; }
    stage.resize(cw, chh);
    move(dt); leaveTrail(dt); time.t += dt;
    if (!time.hold) { time.clock += dt * time.rate / 3600; if (time.clock >= 24) { time.clock -= 24; time.day++; } }
    const vp = viewProj(cam, cw / chh, cam.fov * Math.PI / 180), s = skyAt(seed, shares, cam.x, cam.z, world.depth, time.day, time.clock), sh = shares(cam.x, cam.z);
    // lightning strikes only while the clock runs, so a held still is never caught mid-flash
    const flash = !time.hold && s.events.cells.some((c) => c.flash) && ((now / 90) | 0) % 3 === 0 ? 1 : 0, L = frameLight(s, flash), G = groundState(s, sh);
    // the works are never dry: steam settles on everything; the city across the water is seldom dry
    L.wx[3] = Math.max(L.wx[3], sh[8] * 0.7, sh[7] * 0.4);
    L.fogp[0] = Math.max(0, groundAt(world, cam.x, cam.z)) * (s.weather.cloudSea > 0 ? 0 : 0.85);
    scene.update({ cam, vp, dt, time, sky: s, shares: sh, light: L, ground: G });
    const sp = lights.spriteData();
    if (sp.changed) { if (lampBuf) lampBuf.destroy(); lampBuf = vbuf(sp.data); lampCount = sp.count; }
    lights.select([cam.x, cam.y, cam.z], vp.f, 260 * Math.max(0.5, quality), Math.min(1, Math.max(0, (L.misc[0] - 0.2) / 0.55))); stage.writeLights(lights.block);

    // still water mirrors the world; so does wet paving, in a plane at the walker's feet
    let level = wantMirror ? waterNear() : null;
    if (wantMirror && level === null && !cam.fly && L.wx[3] + G.snowp[1] > 0.12 && near.sampleB(cam.x, cam.z, nbProbe)[0] > 0.5 && nbProbe[1] > 0.1) level = groundAt(world, cam.x, cam.z) - 0.02;
    frame.set(vp.M, OFF.viewProj); frame.set(invert(vp.M), OFF.invViewProj); frame.set([cam.x, cam.y, cam.z, time.t], OFF.cam);
    for (const k of ["key", "sun", "moon", "zenith", "horizon", "fog", "fogp", "wx", "ev", "misc", "keyCol", "amb", "lamp", "glow"]) frame.set(L[k], OFF[k]);
    frame.set([world.width, world.depth, world.cell, world.W], OFF.world);
    frame.set([near.state.ox, near.state.oz, 512, near.state.baked ? 1 : 0], OFF.near);
    frame.set(G.snowp, OFF.snowp); frame.set(G.gfog, OFF.gfog);
    frame.set([cw, chh, level ?? 0, level === null ? 0 : 1], OFF.view);
    frame.set([cam.x, cam.y, cam.z, cam.speed], OFF.walk);
    frame.fill(0, OFF.trail, OFF.trail + 32);
    trail.forEach((t, i) => frame.set([t.x, t.y, t.z, 0.85 * Math.max(0, 1 - t.age / 1.1)], OFF.trail + i * 4));
    frame.set([cam.x, cam.y - 0.6, cam.z, cam.fly ? 0 : 0.8], OFF.trail + 28);
    frame.fill(0, OFF.shadowVP, OFF.clip + 4);
    scene.shadow(frame, { cam, light: L });
    stage.writeFrame("main", frame);
    nodeCount = selectNodes(pyramid, [cam.x, cam.y, cam.z], frustumPlanes(vp.M), nodes);
    dev.queue.writeBuffer(nodeBuf, 0, nodes, 0, nodeCount * 4);

    const enc = dev.createCommandEncoder(), T = stage.st.targets;
    scene.before(enc);
    if (level !== null) {
      // the world upside down in the water: the same view reflected in the water's plane
      const mm = mirrored(vp.M, level), my = 2 * level - cam.y;
      frameM.set(frame); frameM.set(mm, OFF.viewProj); frameM.set(invert(mm), OFF.invViewProj); frameM.set([cam.x, my, cam.z, time.t], OFF.cam);
      frameM.set([cw >> 1, chh >> 1, level, 0], OFF.view); frameM.set([level - 0.05, 1, 1, 0], OFF.clip);
      stage.writeFrame("mirror", frameM);
      const nm = selectNodes(pyramid, [cam.x, cam.y, cam.z], frustumPlanes(mm), nodesM);
      dev.queue.writeBuffer(nodeBufM, 0, nodesM, 0, nm * 4);
      const mp = enc.beginRenderPass({ colorAttachments: [{ view: T.mirror.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }], depthStencilAttachment: { view: T.mirrorDepth.createView(), depthClearValue: 0, depthLoadOp: "clear", depthStoreOp: "store" } });
      drawWorld(mp, "mirror", nodeBufM, nm); mp.end();
    }
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: T.scene.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }], depthStencilAttachment: { view: T.depth.createView(), depthClearValue: 0, depthLoadOp: "clear", depthStoreOp: "store" } });
    drawWorld(pass, "main", nodeBuf, nodeCount); pass.end();
    stage.post(enc, host.context.getCurrentTexture().createView());
    dev.queue.submit([enc.finish()]);
    if (grabbing) { const g = grabbing; grabbing = null; g(canvas.toDataURL(g.type || "image/png", g.q)); }   // read the canvas in the frame that drew it
    frames++; state = s;
    if (frames % 12 === 0 && !hud.hidden) writeHud(s);
    if (!manual) requestAnimationFrame(draw);
  }
  const hh = (c) => `${String(Math.floor(c)).padStart(2, "0")}:${String(Math.floor((c % 1) * 60)).padStart(2, "0")}`;
  function writeHud(s) {
    const g = gaps.slice(-60), ms = g.reduce((a, b) => a + b, 0) / Math.max(1, g.length);
    hud.querySelector(".place").textContent = REGION_NAMES[s.weather.region] || "";
    hud.querySelector(".air").textContent = `${s.weather.name}, ${s.part}`;
    hud.querySelector(".where").textContent = `day ${time.day}  ${hh(time.clock)}   ${(cam.x / 1000).toFixed(1)} km E  ${(cam.z / 1000).toFixed(1)} km S   ${Math.round(cam.y)} m   ${cam.fly ? "flying" : "on foot"}   ${ms.toFixed(1)} ms`;
  }

  // what a capture or a test can drive
  globalThis.__lwWorld = {
    world, cam, time, roads, lights, scene, near,
    view(v) { Object.assign(cam, { x: (v.x ?? cam.x / 1000) * 1000, z: (v.z ?? cam.z / 1000) * 1000, alt: v.alt ?? cam.alt, fly: v.fly ?? cam.fly }); if (v.yaw !== undefined) cam.yaw = v.yaw * Math.PI / 180; if (v.pitch !== undefined) cam.pitch = v.pitch * Math.PI / 180; if (v.clock !== undefined) time.clock = v.clock; if (v.day !== undefined) time.day = v.day; if (v.hold !== undefined) time.hold = v.hold; cam.fov = v.fov ?? 60; route = null; trail.length = 0; },
    async settle(n = 3) { if (world.stream) await world.stream.done; const f = frames; while (frames < f + n) await new Promise((r) => requestAnimationFrame(r)); await dev.queue.onSubmittedWorkDone(); return this.stats(); },
    stats() { const g = gaps.slice(2).sort((a, b) => a - b); return { frames, nodes: nodeCount, ...scene.stats(), lamps: lights.all.length, frameMs: g.length ? +(g.reduce((a, b) => a + b, 0) / g.length).toFixed(2) : 0, p95: g.length ? +g[Math.floor(g.length * 0.95)].toFixed(2) : 0, region: state && state.weather.region, air: state && state.weather.name, part: state && state.part, adapter: host.info || null, at: [cam.x, cam.y, cam.z] }; },
    clearGaps() { gaps.length = 0; },
    grab(type, q) { return new Promise((ok) => { ok.type = type; ok.q = q; grabbing = ok; }); },
    // walk a line: pts are [x, z] in metres, 3 m apart (roads.walkFrom), at `speed` metres a second
    walk(pts, speed = 1.4, o = {}) { route = { pts, s: 0, speed, step: 3, ...o }; const a = pts[0], b = pts[Math.min(3, pts.length - 1)]; cam.x = a[0]; cam.z = a[1]; cam.yaw = Math.atan2(b[0] - a[0], -(b[1] - a[1])); },
    // for a capture at a steady rate whatever the machine does: stop the loop, then draw one frame per call
    hold(on = true) { manual = on; if (!on) requestAnimationFrame(draw); },
    async step(dt, type = "image/jpeg", q = 0.92) { const p = this.grab(type, q); draw(performance.now(), dt); const url = await p; await dev.queue.onSubmittedWorkDone(); return url; },
    // time for the GPU to finish n frames drawn back to back, in ms a frame: the cost of a frame without the display's wait
    async bench(n = 60) { manual = true; await dev.queue.onSubmittedWorkDone(); const t = performance.now(); for (let i = 0; i < n; i++) draw(performance.now(), 1 / 60); await dev.queue.onSubmittedWorkDone(); const ms = (performance.now() - t) / n; manual = false; requestAnimationFrame(draw); return +ms.toFixed(2); },
  };
  // a tile that lands behind the walk: redo the maps, the quadtree and whatever stood on that ground
  if (world.stream) {
    world.stream.onTile(({ x0, y0, w, h }) => {
      const ax = Math.max(0, x0 - 1), ay = Math.max(0, y0 - 1), bx = Math.min(world.W, x0 + w + 1), by = Math.min(world.H, y0 + h + 1);
      bakeRect(world, maps, ax, ay, bx, by); refreshPyramid(world, pyramid, x0, y0, x0 + w, y0 + h);
      stage.updateRect(ax, ay, bx - ax, by - ay);
      scene.landed(ax * world.cell, ay * world.cell, bx * world.cell, by * world.cell);
      if (near.bake(cam.x, cam.z, true)) stage.uploadNear(near);
    });
    world.stream.done.then(() => stage.refreshMips());
    world.stream.start();
  }
  say("");
  move(0);
  requestAnimationFrame(draw);
}
start().catch((e) => { say(String(e && e.message || e)); console.error(e); globalThis.__lwWorldError = String(e && e.stack || e); });
