// studio-spatial.js: the Studio's Spatial source.
//
// Serves certified world packages. Every sidecar the manifest receipts is
// fetched and re-hashed (SHA-256) in the browser before anything renders;
// a DRIFT package is refused, not softened. Two lanes ship today:
//   crystal-city  reconstruction lane: the spatial session's Crystal City
//                 hybrid scene, extracted byte-exact from the v1.3 proof.
//   folded-light  authored lane: seed-generated veils + Gaussian material.
// The manifest's mode field picks the renderer.

import { validateWorldPackage } from "./engine/world-package.js";
import { startSpatialScene } from "./spatial-scene.js";
import { startTexturedScene } from "./spatial-textured.js";

const PACKAGES = Object.freeze({
  "crystal-city": "art/spatial/crystal-city/crystal-city.world.json",
  "folded-light": "art/spatial/folded-light.world.json",
});
const DEFAULT_WORLD = "crystal-city";

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

async function sha256Hex(bytes) {
  if (!(globalThis.crypto && crypto.subtle)) return null;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchBytes(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

// Fetch the manifest plus every receipted sidecar, re-hash each, and return
// the package with one overall verdict: MATCH only if every file matches.
async function fetchPackage(world) {
  const manifestUrl = PACKAGES[world];
  const base = manifestUrl.slice(0, manifestUrl.lastIndexOf("/") + 1);
  const manifestResponse = await fetch(manifestUrl, { cache: "no-cache" });
  if (!manifestResponse.ok) throw new Error(`manifest: HTTP ${manifestResponse.status}`);
  const manifest = await manifestResponse.json();
  const verdictOf = validateWorldPackage(manifest);
  if (!verdictOf.ok) throw new Error(`world package refused: ${verdictOf.failureCode} at ${verdictOf.field}`);

  const names = Object.keys(manifest.receipts);
  const files = {};
  let verdict = "MATCH";
  for (const name of names) {
    const bytes = await fetchBytes(base + name);
    files[name] = bytes;
    const actual = await sha256Hex(bytes);
    if (!actual) verdict = "UNVERIFIABLE";
    else if (actual !== manifest.receipts[name] && verdict !== "UNVERIFIABLE") verdict = "DRIFT";
  }
  return { manifest, files, verdict, checked: names.length };
}

function wireControls() {
  const map = {
    "crystal-city": { "sp-drift": "atmosphereFlow", "sp-glow": "glow", "sp-water": "waterFlow", "sp-parallax": "parallax" },
    "folded-light": { "sp-drift": "drift", "sp-glow": "glow", "sp-water": "water", "sp-parallax": "parallax" },
  }[currentWorld];
  const bindings = [
    ["sp-parallax", "sp-parallax-val"],
    ["sp-drift", "sp-drift-val"],
    ["sp-glow", "sp-glow-val"],
    ["sp-water", "sp-water-val"],
  ];
  for (const [id, valueId] of bindings) {
    const el = $(id);
    if (!el) continue;
    el.oninput = () => {
      if (scene) scene.setControl(map[id], el.value);
      const out = $(valueId);
      if (out) out.textContent = Number(el.value).toFixed(2);
    };
  }
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
      if (chip.dataset.world === currentWorld || !currentCanvas) return;
      currentWorld = chip.dataset.world;
      startSpatial(currentCanvas, currentOpts || {}).catch((err) => {
        status("the world failed to start: " + (err && err.message ? err.message : String(err)), "bad");
      });
    };
  });
}

// Camera drag on the canvas: the narrow-boundary interaction grammar from the
// session's proof. The package's clamps are enforced inside the scene.
function wireCamera(canvas) {
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
    if (!dragging || !scene) return;
    const dx = e.clientX - last[0], dy = e.clientY - last[1];
    last = [e.clientX, e.clientY];
    scene.nudgeCamera(dx * 0.00032, -dy * 0.00028, 0);
  });
  const stop = () => { dragging = false; };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  canvas.addEventListener("wheel", (e) => {
    if (!scene) return;
    e.preventDefault();
    scene.nudgeCamera(0, 0, e.deltaY * 0.00022);
  }, { passive: false });
}

// Entry point for studio.js. canvas is the mounted GL canvas; opts carries the
// hardware render plan (splat budget) and the reduced-motion flag. A ?world=
// deep link (snapshotted at head, before the Atelier rewrites the URL) picks
// the package on first entry.
export async function startSpatial(canvas, opts = {}) {
  stopSpatial();
  currentCanvas = canvas;
  currentOpts = opts;
  if (!startSpatial._bootConsumed) {
    startSpatial._bootConsumed = true;
    const want = (window.__studioBootWorld || "").trim();
    if (want && PACKAGES[want]) currentWorld = want;
  }
  status("loading the world package…", "");
  const { manifest, files, verdict, checked } = await fetchPackage(currentWorld);

  const verdictEl = $("sp-verdict");
  if (verdictEl) {
    verdictEl.textContent = verdict;
    verdictEl.dataset.verdict = verdict;
  }
  if (verdict === "DRIFT") {
    status("receipt DRIFT: a sidecar does not match its manifest hash. Refusing to render.", "bad");
    throw new Error("world package receipt DRIFT");
  }

  const budget = opts.plan && Number(opts.plan.splatBudget) > 0
    ? Number(opts.plan.splatBudget)
    : Infinity;
  const sceneOpts = { splatBudget: budget, reducedMotion: !!opts.reducedMotion };
  scene = manifest.mode === "textured-hybrid"
    ? await startTexturedScene(canvas, { manifest, files }, sceneOpts)
    : await startSpatialScene(canvas, {
        manifest,
        splatBytes: files[manifest.splats.sidecar],
      }, sceneOpts);
  window.__spatialScene = scene;   // honest, inspectable (same pattern as __studioCapability)
  paused = false;
  wireControls();
  wireCamera(canvas);

  const budgetNote = scene.splatsDropped
    ? `${scene.splatCount.toLocaleString()} drawn, ${scene.splatsDropped.toLocaleString()} held back for this tier`
    : `${scene.splatCount.toLocaleString()} drawn`;
  status(`${manifest.title} · ${manifest.lane} lane · receipt ${verdict} across ${checked} files · ${budgetNote}`,
    verdict === "MATCH" ? "good" : "");
  const splatStatus = $("engine-status-splats");
  if (splatStatus) {
    splatStatus.textContent = Number.isFinite(budget)
      ? `${scene.splatCount.toLocaleString()} / ${budget.toLocaleString()}`
      : String(scene.splatCount.toLocaleString());
  }
  return {
    animating: scene.animating,
    splatCount: scene.splatCount,
    verdict,
    world: currentWorld,
  };
}

export function stopSpatial() {
  if (scene) {
    try { scene.stop(); } catch (_) { /* context may already be lost */ }
    if (window.__spatialScene === scene) window.__spatialScene = null;
    scene = null;
  }
}

export function spatialAnimating() {
  return !!(scene && scene.animating && !paused);
}

export default { startSpatial, stopSpatial, spatialAnimating };
