// studio-spatial.js: the Studio's Spatial source.
//
// Loads the authored world package, re-checks its receipts byte for byte in
// the browser (SHA-256 of the sidecar against the manifest), clamps the splat
// block to the device tier's budget, starts the hybrid renderer, and wires the
// rail controls. The receipt verdict is spoken in the site's own vocabulary:
// MATCH, DRIFT, or UNVERIFIABLE, and a DRIFT package is refused, not softened.

import { startSpatialScene } from "./spatial-scene.js";

const PACKAGE_URL = "art/spatial/folded-light.world.json";

let scene = null;
let paused = false;

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

async function fetchPackage() {
  const manifestResponse = await fetch(PACKAGE_URL, { cache: "no-cache" });
  if (!manifestResponse.ok) throw new Error(`manifest: HTTP ${manifestResponse.status}`);
  const manifest = await manifestResponse.json();
  const sidecar = manifest.splats && manifest.splats.sidecar;
  if (!sidecar) throw new Error("manifest names no splat sidecar");
  const binResponse = await fetch(`art/spatial/${sidecar}`, { cache: "no-cache" });
  if (!binResponse.ok) throw new Error(`sidecar: HTTP ${binResponse.status}`);
  const bytes = new Uint8Array(await binResponse.arrayBuffer());

  const expected = manifest.receipts && manifest.receipts[sidecar];
  const actual = await sha256Hex(bytes);
  let verdict = "UNVERIFIABLE";
  if (actual && expected) verdict = actual === expected ? "MATCH" : "DRIFT";
  return { manifest, splatBytes: bytes, verdict };
}

function wireControls() {
  const bindings = [
    ["sp-parallax", "parallax", "sp-parallax-val"],
    ["sp-drift", "drift", "sp-drift-val"],
    ["sp-glow", "glow", "sp-glow-val"],
    ["sp-water", "water", "sp-water-val"],
  ];
  for (const [id, control, valueId] of bindings) {
    const el = $(id);
    if (!el) continue;
    el.oninput = () => {
      if (scene) scene.setControl(control, el.value);
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
      a.download = "folded-light-run-receipt.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    };
  }
}

// Camera drag on the canvas: the same narrow-boundary interaction grammar as
// the session's proof. The package's clamps are enforced inside the scene.
function wireCamera(canvas) {
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
// hardware render plan (for the splat budget) and the reduced-motion flag.
export async function startSpatial(canvas, opts = {}) {
  stopSpatial();
  status("loading the world package…", "");
  const { manifest, splatBytes, verdict } = await fetchPackage();

  const verdictEl = $("sp-verdict");
  if (verdictEl) {
    verdictEl.textContent = verdict;
    verdictEl.dataset.verdict = verdict;
  }
  if (verdict === "DRIFT") {
    status("receipt DRIFT: the sidecar does not match its manifest hash. Refusing to render.", "bad");
    throw new Error("world package receipt DRIFT");
  }

  const budget = opts.plan && Number(opts.plan.splatBudget) > 0
    ? Number(opts.plan.splatBudget)
    : Infinity;
  scene = await startSpatialScene(canvas, { manifest, splatBytes }, {
    splatBudget: budget,
    reducedMotion: !!opts.reducedMotion,
  });
  paused = false;
  wireControls();
  wireCamera(canvas);

  const budgetNote = scene.splatsDropped
    ? `${scene.splatCount.toLocaleString()} drawn, ${scene.splatsDropped.toLocaleString()} held back for this tier`
    : `${scene.splatCount.toLocaleString()} drawn`;
  status(`${manifest.title} · receipt ${verdict} · ${budgetNote}`, verdict === "MATCH" ? "good" : "");
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
  };
}

export function stopSpatial() {
  if (scene) {
    try { scene.stop(); } catch (_) { /* context may already be lost */ }
    scene = null;
  }
}

export function spatialAnimating() {
  return !!(scene && scene.animating && !paused);
}

export default { startSpatial, stopSpatial, spatialAnimating };
