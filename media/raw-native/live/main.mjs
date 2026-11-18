// The live renderer's page: loads the engine and a scene, flies the camera, draws every frame, measures each pass
// against the references while the camera holds still, and says what it measured in words.
import { loadEngine } from "./engine.mjs";
import { SCENES, loadScene } from "./scene.mjs";
import { createGpu, uploadScene } from "./gpu.mjs";
import { Frame, PASSES } from "./frame.mjs";
import { Camera } from "./camera.mjs";
import { skyModel, sunDirection } from "./sky.mjs";
import { Hud } from "./hud.mjs";

const q = new URLSearchParams(location.search);
const canvas = document.getElementById("view"), hud = new Hud(document);
const tell = (msg) => { try { if (parent !== window) parent.postMessage({ rawLive: msg.kind, ...msg }, location.origin); } catch (_) { /* no parent */ } };
const still = matchMedia("(prefers-reduced-motion: reduce)");
let frame = null, gpu = null, engine = null, current = null, moved = true, sweep = null, last = performance.now(), busy = false;

function settingsFor(def, st) {
  const sun = sunDirection(st.azimuth, st.elevation), sky = skyModel(sun);
  const avg = sky.amb.reduce((a, c) => a + (c[0] + c[1] + c[2]) / 3, 0) / 6;
  const cam = frame.camera, { f } = cam.basis();
  // the tilted plane of focus: through the point `focus` metres ahead, its normal turned from the view axis
  // towards the camera's up by `tilt` radians (a tilt-shift lens tilted down)
  const up = [0, 1, 0], c = Math.cos(st.tilt), s = Math.sin(st.tilt);
  const nrm = [f[0] * c + up[0] * s, f[1] * c + up[1] * s, f[2] * c + up[2] * s], l = Math.hypot(...nrm);
  const n = nrm.map((v) => v / l), pt = cam.eye.map((v, k) => v + f[k] * st.focus);
  return { sun, sky, exposure: 1 / (1.2 * 2 ** st.ev), aoRadius: def.aoRadius, fog: st.air ? def.fog * st.air : 0, fogAmbient: avg / Math.PI * 0.3,
    tiltPlane: [...n, -(n[0] * pt[0] + n[1] * pt[1] + n[2] * pt[2])], lensRadius: st.aperture, lensOn: st.aperture > 0 };
}

async function openScene(id) {
  const def = SCENES[id];
  hud.note(def.bytes ? `Loading ${def.name.toLowerCase()}: ${(def.bytes / 1e6).toFixed(1)} MB, checked against the engine's SHA-256` : `Building ${def.name.toLowerCase()}`);
  const scene = await loadScene(id, (got, total) => hud.note(`Loading ${def.name.toLowerCase()}: ${(got / 1e6).toFixed(1)} of ${(total / 1e6 || def.bytes / 1e6).toFixed(1)} MB`));
  hud.note(`Building the tree over ${scene.triMat.length.toLocaleString("en")} triangles`);
  const tree = await new Promise((resolve, reject) => {
    const w = new Worker(new URL("./bvh-worker.mjs", import.meta.url), { type: "module" });
    w.onmessage = ({ data }) => { w.terminate(); data.ok ? resolve(data) : reject(new Error(data.error)); };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || "the tree builder stopped")); };
    w.postMessage({ positions: scene.positions });
  });
  if (current) current.gpuScene.destroy();
  const gpuScene = uploadScene(gpu, scene, tree);
  current = { id, def, scene, gpuScene, tree };
  if (!frame) frame = new Frame(gpu, gpuScene, new Camera(canvas, () => { moved = true; }));
  frame.scene = gpuScene;
  hud.sceneLoaded(id, def, scene, tree);
  return current;
}

function applyState() {
  const st = hud.state;
  frame.on = st.on; frame.view = st.show; frame.split = st.split;
  frame.gtao = st.gtao; frame.settings = settingsFor(current.def, st);
  gpu.setColour(st.display);
  frame.reset(true); sweep = null; hud.clearMeasures();
}

function size() {
  const dpr = Math.min(devicePixelRatio || 1, 3), k = hud.state.pixels;
  let w = Math.round(canvas.clientWidth * dpr * k), h = Math.round(canvas.clientHeight * dpr * k);
  const cap = Math.min(1, Math.sqrt((3840 * 2160) / (w * h)), Math.sqrt(gpu.device.limits.maxBufferSize / 32 / (w * h)));
  w = Math.max(64, Math.floor(w * cap)); h = Math.max(64, Math.floor(h * cap));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  frame.resize(w, h);
}

// the per-pass measure: with each pass flipped, the frame's error against the path-traced reference
async function runSweep() {
  const bits = hud.availablePasses();
  const base = frame.on, out = {};
  for (const b of bits) {
    frame.on = base ^ b; frame.fresh = true;
    for (let k = 0; k < 14; k++) frame.draw(true, { reference: false, keep: false, present: false });
    const r = await frame.draw(true, { reference: false, keep: false, present: false, measure: true });
    if (r) out[b] = Math.sqrt(r.v[6] / Math.max(r.v[7], 1));
    if (moved || !sweep) break;
  }
  frame.on = base; frame.fresh = true;
  return out;
}

async function loop(t) {
  requestAnimationFrame(loop);
  if (busy || !current || document.hidden) return;
  const dt = Math.min(0.1, (t - last) / 1000); last = t;
  frame.camera.tick(dt);
  size();
  if (moved) { frame.settings = settingsFor(current.def, hud.state); sweep = null; hud.clearMeasures(); }
  const holding = !moved; moved = false;
  const wantRef = hud.state.reference;
  const measure = holding && frame.ref > 0 && frame.ref % 8 === 0;
  const p = frame.draw(holding, { reference: wantRef, measure });
  hud.tick(frame, gpu);
  if (p) p.then((r) => { if (r) hud.measures(r, frame); });
  // once the reference has 48 samples, measure each pass flipped, a short pause while it runs
  if (holding && wantRef && frame.ref === 48 && !sweep) {
    sweep = {}; busy = true; hud.note("Measuring each pass against the reference");
    runSweep().then((errs) => { if (sweep) { sweep = errs; hud.sweep(errs, frame); } hud.note(""); }).catch((e) => { console.error("[raw live] measure failed:", e); hud.note(""); }).finally(() => { busy = false; });
  }
}

async function start() {
  try {
    hud.note("Checking the engine's shader files");
    engine = await loadEngine();
    gpu = await createGpu(canvas, engine);
    hud.adapter(gpu.host);
    hud.bind({ onScene: async (id) => { busy = true; try { await openScene(id); hud.pickView(Object.keys(current.def.views)[0]); } finally { busy = false; } },
      onView: (k) => { const v = current.def.views[k]; frame.camera.set(v, current.id === "hall" ? 3 : 1.5); moved = true; },
      onChange: () => { applyState(); moved = true; } });
    await openScene(SCENES[q.get("scene")] ? q.get("scene") : "hall");
    hud.pickView(q.get("view") && current.def.views[q.get("view")] ? q.get("view") : Object.keys(current.def.views)[0]);
    applyState();
    hud.note("");
    globalThis.__rawLive = { get frame() { return frame; }, get gpu() { return gpu; }, get scene() { return current; } };   // for the page's tests
    tell({ kind: "started" });
    if (still.matches) hud.say("Reduced motion is on: the picture holds still until you move the camera.");
    requestAnimationFrame(loop);
    gpu.device.lost.then((e) => { hud.note(`The GPU stopped: ${e.message || e.reason}`); tell({ kind: "error", error: e.message || "the GPU stopped" }); });
  } catch (e) {
    console.error("[raw live] start failed:", e);
    hud.note(`The renderer could not start here: ${e.message || e}`);
    tell({ kind: "error", error: String(e.message || e) });
  }
}

document.getElementById("leave").addEventListener("click", () => tell({ kind: "leave" }));
const hide = document.getElementById("rl-hide"), panel = document.getElementById("rl-panel");
const setPanel = (open) => { panel.hidden = !open; hide.setAttribute("aria-expanded", String(open)); hide.textContent = open ? "Hide the panel" : "Show the panel"; };
hide.addEventListener("click", () => setPanel(panel.hidden));
if (matchMedia("(max-width: 760px)").matches) setPanel(false);   // a phone opens on the picture; the panel is a press away
addEventListener("keydown", (e) => { if (e.key === "Escape" && document.activeElement !== canvas) tell({ kind: "leave" }); else if (e.key === "Escape") canvas.blur(); });
start();
