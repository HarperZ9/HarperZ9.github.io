// studio-spatial.js: the Studio's Spatial source.
//
// Serves certified world packages in three modes:
//   atlas         the Spatial Atlas: 27 NGSF v5 scenes, one per artwork,
//                 loaded per scene and re-hashed against manifest receipts
//   crystal-city  the directed hybrid scene (textured depth meshes + splats)
//   folded-light  the authored lane (seed-generated veils + splats)
// Every rendered sidecar is SHA-256 checked in the browser first; a DRIFT
// package is refused, not softened.

import { validateWorldPackage } from "./engine/world-package.js";
import { startSpatialScene } from "./spatial-scene.js";
import { startTexturedScene } from "./spatial-textured.js";
import { startAtlasScene } from "./spatial-atlas.js";
import { acquireContext } from "./spatial-gl.js";

const PACKAGES = Object.freeze({
  "atlas": "art/spatial/atlas/atlas.world.json",
  "crystal-city": "art/spatial/crystal-city/crystal-city.world.json",
  "folded-light": "art/spatial/folded-light.world.json",
});
const DEFAULT_WORLD = "atlas";

let scene = null;
let paused = false;
let currentWorld = DEFAULT_WORLD;
let currentCanvas = null;
let currentOpts = null;

function $(id) { return document.getElementById(id); }

function status(text, tone) {
  const el = $("sp-status");
  if (!el) return;
  el.textContent = text;
  el.dataset.tone = tone || "";
}

function setVerdict(verdict) {
  const el = $("sp-verdict");
  if (!el) return;
  el.textContent = verdict;
  el.dataset.verdict = verdict;
}

async function sha256Hex(bytes) {
  if (!(globalThis.crypto && crypto.subtle)) return null;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Fetch a package. Hybrid worlds prefetch and re-hash every receipted file;
// the atlas verifies per scene at load time instead (81 files, 25 MB, so
// upfront verification would punish entry).
async function fetchPackage(world) {
  const manifestUrl = PACKAGES[world];
  const base = manifestUrl.slice(0, manifestUrl.lastIndexOf("/") + 1);
  // Default HTTP caching everywhere: every sidecar is re-hashed against its
  // manifest receipt before rendering, so a stale or corrupted cache entry is
  // caught as DRIFT rather than dodged with no-cache refetches. Crystal City
  // is 5.7 MB; refusing the cache made every visit a multi-second black wait.
  const manifestResponse = await fetch(manifestUrl);
  if (!manifestResponse.ok) throw new Error(`manifest: HTTP ${manifestResponse.status}`);
  const manifest = await manifestResponse.json();
  const shape = validateWorldPackage(manifest);
  if (!shape.ok) throw new Error(`world package refused: ${shape.failureCode} at ${shape.field}`);
  if (manifest.mode === "ngsf-atlas") {
    return { manifest, base, files: null, verdict: "PER-SCENE", checked: 0 };
  }
  const names = Object.keys(manifest.receipts);
  const files = {};
  let verdict = "MATCH";
  for (const name of names) {
    const response = await fetch(base + name);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    files[name] = bytes;
    const actual = await sha256Hex(bytes);
    if (!actual) verdict = "UNVERIFIABLE";
    else if (actual !== manifest.receipts[name] && verdict !== "UNVERIFIABLE") verdict = "DRIFT";
  }
  return { manifest, base, files, verdict, checked: names.length };
}

function syncBlocks(mode) {
  const atlasBlock = $("sp-atlas-block");
  const hybridBlock = $("sp-hybrid-block");
  if (atlasBlock) atlasBlock.hidden = mode !== "ngsf-atlas";
  if (hybridBlock) hybridBlock.hidden = mode === "ngsf-atlas";
}

function wireHybridControls() {
  const map = currentWorld === "crystal-city"
    ? { "sp-drift": "atmosphereFlow", "sp-glow": "glow", "sp-water": "waterFlow", "sp-parallax": "parallax" }
    : { "sp-drift": "drift", "sp-glow": "glow", "sp-water": "water", "sp-parallax": "parallax" };
  for (const [id, valueId] of [["sp-parallax", "sp-parallax-val"], ["sp-drift", "sp-drift-val"], ["sp-glow", "sp-glow-val"], ["sp-water", "sp-water-val"]]) {
    const el = $(id);
    if (!el) continue;
    el.oninput = () => {
      if (scene) scene.setControl(map[id], el.value);
      const out = $(valueId);
      if (out) out.textContent = Number(el.value).toFixed(2);
    };
  }
}

function wireAtlasControls() {
  const select = $("sp-scene");
  if (select && scene && scene.sceneList) {
    select.innerHTML = "";
    for (const s of scene.sceneList) {
      const option = document.createElement("option");
      option.value = s.id;
      option.textContent = `${String(s.sequence).padStart(2, "0")} · ${s.title}`;
      select.appendChild(option);
    }
    if (scene.currentMeta) select.value = scene.currentMeta.id;
    select.disabled = false;
    select.onchange = async () => {
      // The picker can fire mid-transition (a world switch in flight) when
      // the live scene is not an atlas scene, or not a scene at all.
      if (!scene || typeof scene.loadScene !== "function") return;
      const target = scene;
      select.disabled = true;
      try {
        status(`loading ${select.value}…`, "");
        const { meta, verdict } = await target.loadScene(select.value);
        if (scene === target) {
          setVerdict(verdict);
          announceAtlasScene(meta, verdict);
        }
      } catch (err) {
        if (scene === target) status("scene failed: " + (err && err.message ? err.message : String(err)), "bad");
      } finally {
        select.disabled = false;
      }
    };
  }
  document.querySelectorAll("[data-atlas-mode]").forEach((chip) => {
    chip.onclick = () => {
      if (!scene || typeof scene.loadScene !== "function") return;
      document.querySelectorAll("[data-atlas-mode]").forEach((b) => b.classList.toggle("active", b === chip));
      scene.setControl("mode", chip.dataset.atlasMode);
    };
  });
  const sliders = [["sp-depth", "depthScale", "sp-depth-val"], ["sp-size", "splatScale", "sp-size-val"], ["sp-exposure", "exposure", "sp-exposure-val"]];
  for (const [id, control, valueId] of sliders) {
    const el = $(id);
    if (!el) continue;
    el.oninput = () => {
      if (scene) scene.setControl(control, el.value);
      const out = $(valueId);
      if (out) out.textContent = Number(el.value).toFixed(2);
    };
  }
}

function announceAtlasScene(meta, verdict) {
  const psnr = meta.mean_psnr_after ? ` · held-out PSNR ${meta.mean_psnr_after.toFixed(1)}` : "";
  status(`${meta.title} · ${meta.profile} profile · ${(meta.gaussian_count || 0).toLocaleString()} gaussians · receipt ${verdict}${psnr}`,
    verdict === "MATCH" ? "good" : "");
  const splatStatus = $("engine-status-splats");
  if (splatStatus && scene) splatStatus.textContent = `${scene.splatCount.toLocaleString()} active`;
}

function wireShared() {
  const pause = $("sp-pause");
  if (pause) {
    pause.onclick = () => {
      paused = !paused;
      if (scene) scene.setPaused(paused);
      pause.textContent = paused ? "resume motion" : "pause motion";
      pause.setAttribute("aria-pressed", String(paused));
    };
  }
  const receipt = $("sp-receipt");
  if (receipt) {
    receipt.onclick = () => {
      if (!scene) return;
      const blob = new Blob([JSON.stringify(scene.receipt(), null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${currentWorld}-run-receipt.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    };
  }
  document.querySelectorAll("[data-world]").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.world === currentWorld);
    chip.onclick = () => {
      // Same-world clicks are ignored ONLY while that world is actually
      // running; after a failed start the chip must retry, not no-op.
      if ((chip.dataset.world === currentWorld && scene) || !currentCanvas) return;
      currentWorld = chip.dataset.world;
      startSpatial(currentCanvas, currentOpts || {}).catch((err) => {
        status("the world failed to start: " + (err && err.message ? err.message : String(err)), "bad");
      });
    };
  });
}

// Hybrid worlds use the narrow drag boundary; the atlas binds its own orbit.
function wireHybridCamera(canvas) {
  if (canvas.dataset.spatialCameraWired === "1") return;
  canvas.dataset.spatialCameraWired = "1";
  let dragging = false;
  let last = [0, 0];
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    last = [e.clientX, e.clientY];
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging || !scene || !scene.nudgeCamera) return;
    const dx = e.clientX - last[0], dy = e.clientY - last[1];
    last = [e.clientX, e.clientY];
    scene.nudgeCamera(dx * 0.00032, -dy * 0.00028, 0);
  });
  const stop = () => { dragging = false; };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  canvas.addEventListener("wheel", (e) => {
    if (!scene || !scene.nudgeCamera) return;
    e.preventDefault();
    scene.nudgeCamera(0, 0, e.deltaY * 0.00022);
  }, { passive: false });
}

// A canvas owns exactly one context TYPE for its lifetime, and the atlas
// (WebGL2) and hybrid worlds (WebGL1) differ, so every world start renders
// into a fresh canvas node. The fresh node is built DETACHED and its GL
// context is claimed off-DOM before any package bytes download: a naked
// canvas in the DOM gets claimed as 2d by the Studio's perception plumbing
// within milliseconds, which poisons it for GL forever.
function detachedCanvas(like) {
  const next = document.createElement("canvas");
  next.id = like.id;
  next.width = like.width;
  next.height = like.height;
  next.style.cssText = like.style.cssText;
  next.dataset.spatialUsed = "1";
  return next;
}

export async function startSpatial(canvas, opts = {}) {
  // Rapid world switches can overlap async starts; the newest start wins and
  // any superseded one tears its scene down instead of clobbering.
  const token = (startSpatial._token = (startSpatial._token || 0) + 1);
  const superseded = () => token !== startSpatial._token;
  currentOpts = opts;
  if (!startSpatial._bootConsumed) {
    startSpatial._bootConsumed = true;
    const want = (window.__studioBootWorld || "").trim();
    if (want && PACKAGES[want]) currentWorld = want;
  }
  // Fetch and verify the incoming package BEFORE tearing the current world
  // down: the old scene keeps rendering during the download instead of the
  // stage sitting as a black empty rectangle for the whole transfer. The
  // replacement canvas is prepared detached, with its context type (decided
  // by the manifest's mode) claimed off-DOM before the heavy sidecars load.
  status("loading the world package…", "");
  const { manifest, base, files, verdict, checked } = await fetchPackage(currentWorld);
  if (superseded()) return { animating: false, splatCount: 0, world: currentWorld, superseded: true };
  const domCanvas = currentCanvas && currentCanvas.isConnected ? currentCanvas : canvas;
  const next = detachedCanvas(domCanvas);
  const wantsWebgl2 = manifest.mode === "ngsf-atlas";
  const gl = await acquireContext(next, wantsWebgl2 ? "webgl2" : "webgl",
    wantsWebgl2
      ? { antialias: false, alpha: false, premultipliedAlpha: true, preserveDrawingBuffer: true }
      : { preserveDrawingBuffer: true, antialias: true, alpha: false, premultipliedAlpha: true });
  if (!gl) {
    throw new Error(wantsWebgl2
      ? "The Spatial Atlas needs WebGL2; this device reports none. The hybrid worlds still run."
      : "WebGL is unavailable on this device");
  }
  if (superseded()) return { animating: false, splatCount: 0, world: currentWorld, superseded: true };
  stopSpatial();
  domCanvas.replaceWith(next);
  canvas = next;
  currentCanvas = canvas;
  syncBlocks(manifest.mode);
  if (verdict === "DRIFT") {
    setVerdict(verdict);
    status("receipt DRIFT: a sidecar does not match its manifest hash. Refusing to render.", "bad");
    throw new Error("world package receipt DRIFT");
  }

  const budget = opts.plan && Number(opts.plan.splatBudget) > 0 ? Number(opts.plan.splatBudget) : Infinity;
  const sceneOpts = { splatBudget: budget, reducedMotion: !!opts.reducedMotion, gl };
  let started;
  if (manifest.mode === "ngsf-atlas") {
    const bootScene = (window.__studioBootScene || "").trim();
    started = await startAtlasScene(canvas, { manifest, baseUrl: base }, {
      ...sceneOpts,
      sceneId: bootScene && manifest.scenes.some((s) => s.id === bootScene) ? bootScene : undefined,
    });
  } else if (manifest.mode === "textured-hybrid") {
    started = await startTexturedScene(canvas, { manifest, files }, sceneOpts);
  } else {
    started = await startSpatialScene(canvas, { manifest, splatBytes: files[manifest.splats.sidecar] }, sceneOpts);
  }
  if (superseded()) {
    try { started.stop(); } catch (_) { /* torn down either way */ }
    return { animating: false, splatCount: 0, world: currentWorld, superseded: true };
  }
  scene = started;
  if (manifest.mode === "ngsf-atlas") {
    setVerdict(scene.sceneVerdict);
    wireAtlasControls();
    announceAtlasScene(scene.currentMeta, scene.sceneVerdict);
  } else {
    setVerdict(verdict);
    wireHybridControls();
    wireHybridCamera(canvas);
    announceHybrid(manifest, verdict, checked);
  }
  window.__spatialScene = scene;   // honest, inspectable (same pattern as __studioCapability)
  paused = false;
  wireShared();
  // Real GPU loss recovery. Intentional teardown (world switch, source exit)
  // marks the canvas first, so this only speaks up for genuine device loss.
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    // Ignore every intentional path: flagged teardown, a canvas leave3D()
    // already detached, or a canvas a later world start superseded.
    if (canvas.dataset.spatialTeardown === "1" || !canvas.isConnected || canvas !== currentCanvas) return;
    stopSpatial();
    status("the GPU context was lost; pick a world to bring it back", "bad");
  }, { once: true });
  return { animating: scene.animating, splatCount: scene.splatCount, world: currentWorld };
}

function announceHybrid(manifest, verdict, checked) {
  const budgetNote = scene.splatsDropped
    ? `${scene.splatCount.toLocaleString()} drawn, ${scene.splatsDropped.toLocaleString()} held back for this tier`
    : `${scene.splatCount.toLocaleString()} drawn`;
  status(`${manifest.title} · ${manifest.lane} lane · receipt ${verdict} across ${checked} files · ${budgetNote}`,
    verdict === "MATCH" ? "good" : "");
  const splatStatus = $("engine-status-splats");
  if (splatStatus) splatStatus.textContent = String(scene.splatCount.toLocaleString());
}

export function stopSpatial() {
  if (scene) {
    if (currentCanvas) currentCanvas.dataset.spatialTeardown = "1";
    try { scene.stop(); } catch (_) { /* context may already be lost */ }
    if (window.__spatialScene === scene) window.__spatialScene = null;
    scene = null;
  }
}

export function spatialAnimating() {
  return !!(scene && scene.animating && !paused);
}

export default { startSpatial, stopSpatial, spatialAnimating };
