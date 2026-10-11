// studio-fractal-deep.js: the 2D Fractal source's Deep zoom group.
//
// The renderer (fractal-gl.js and fractal-gl-deep.js) decides the arithmetic from the view; this
// module owns the controls around it: iterations that follow the depth, the bilinear-approximation
// switch, the glitch view, a readout of what the last frame ran, and a location box that copies the
// current centre and width out and flies to a pasted one. studio.js mounts it once the fractal
// graph has loaded and calls decorate() on every view it paints and painted() after.

import { autoIterations, DEEP_MIN_SCALE } from "./fractal-gl-deep.js";
import { viewCentre } from "./fractal-hp.js";

const $ = (id) => document.getElementById(id);

// Depth below which iterations follow the depth. Shallower views keep their preset's budget, so
// the eighteen presets draw exactly as they did.
const AUTO_BELOW = 1e-5;

/** Format a zoom factor (3.5 / width) the way deep-zoom tools do: 1.2e35x. */
export function formatDepth(scale) {
  const z = 3.5 / scale;
  if (!(z > 0) || !Number.isFinite(z)) return "beyond 1e300x";
  if (z < 1e4) return (z < 10 ? z.toFixed(1) : Math.round(z).toString()) + "x";
  return z.toExponential(1).replace("e+", "e") + "x";
}

/**
 * Parse a location. Accepts our own form (re / im / width / iterations, one per line, a colon or
 * spaces between key and value) and the common "Re: Im: Zoom:" form, where a zoom Z means a width
 * of 4 / Z. Returns { re, im, scale, maxIter? } or throws with a plain reason.
 */
export function parseLocation(text) {
  const out = {};
  for (const raw of String(text).split(/[\n;,]+/)) {
    const m = /^\s*([a-zA-Z]+)\s*[:=]?\s*([-+0-9.eE]+)\s*$/.exec(raw);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2];
    if (k === "re" || k === "real" || k === "x") out.re = v;
    else if (k === "im" || k === "imag" || k === "y") out.im = v;
    else if (k === "width" || k === "scale") out.scale = parseFloat(v);
    else if (k === "zoom" || k === "magn") out.scale = 4 / parseFloat(v);
    else if (k === "iterations" || k === "iter" || k === "maxiter") out.maxIter = Math.round(parseFloat(v));
  }
  if (out.re == null || out.im == null) throw new Error("a location needs both re and im");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(out.re) || !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(out.im)) {
    throw new Error("re and im must be decimal numbers");
  }
  if (!(out.scale > 0)) throw new Error("a location needs a width (or a zoom)");
  out.scale = Math.max(DEEP_MIN_SCALE, out.scale);
  return out;
}

/** The location text for a view. */
export function formatLocation(view) {
  const c = viewCentre(view);
  const digits = Math.min(c.re.length, Math.max(20, Math.ceil(-Math.log10(view.scale)) + 8));
  const trim = (s) => {
    const dot = s.indexOf(".");
    return dot < 0 ? s : s.slice(0, Math.min(s.length, dot + 1 + digits));
  };
  return `re ${trim(c.re)}\nim ${trim(c.im)}\nwidth ${view.scale.toExponential(6)}\niterations ${view.maxIter}`;
}

export function mountFractalDeep({ getView, setView, repaint, say, canvas, isActive }) {
  const auto = $("fractal-auto-iter"), bla = $("fractal-bla"), glitch = $("fractal-glitch");
  const box = $("fractal-location"), go = $("fractal-location-go"), copy = $("fractal-location-copy");
  const depthEl = $("fractal-depth"), readout = $("fractal-deep-readout");
  for (const el of [auto, bla, glitch]) if (el) el.addEventListener("change", () => { if (getView()) repaint(); });
  // A Buddhabrot finishes after its paint returned; its readout updates when it does.
  document.addEventListener("buddhabrot:done", () => { const v = getView(); if (v) painted(v, null); });

  if (go) go.addEventListener("click", () => {
    const v = getView();
    if (!v || !box) return;
    try {
      const loc = parseLocation(box.value);
      const next = { ...v, re: loc.re, im: loc.im, cx: parseFloat(loc.re), cy: parseFloat(loc.im), scale: loc.scale };
      if (loc.maxIter) next.maxIter = loc.maxIter;
      setView(next);
      repaint();
      // A centre written with fewer decimals than the width needs lands somewhere else.
      const need = Math.ceil(-Math.log10(loc.scale));
      const have = Math.min((loc.re.split(".")[1] || "").length, (loc.im.split(".")[1] || "").length);
      say(`Flew to ${formatDepth(loc.scale)} zoom.`
        + (have < need ? ` The centre carries ${have} decimals and this width needs about ${need}, so the frame shows a neighbour of the place you meant.` : " Scroll to keep diving."));
    } catch (e) {
      say("That location did not parse: " + e.message + ".");
    }
  });
  if (copy) copy.addEventListener("click", async () => {
    const v = getView();
    if (!v || !box) return;
    box.value = formatLocation(v);
    try { await navigator.clipboard.writeText(box.value); say("Location copied."); }
    catch (_) { box.select(); say("Location selected; copy it from the box."); }
  });

  // What the deep path changes about a view before it is drawn.
  function decorate(view) {
    const out = { ...view };
    if (bla && !bla.checked) out.bla = false;
    if (glitch && glitch.checked) out.glitchView = true;
    if ((!auto || auto.checked) && view.scale < AUTO_BELOW) {
      const detail = parseFloat(($("fractal-detail") || {}).value) || 1;
      out.maxIter = Math.max(view.maxIter || 0, Math.round(autoIterations(view.scale) * detail));
    }
    return out;
  }

  // After a settled frame: depth, path, budget, reference, BLA, time.
  let pending = 0;
  function painted(view, ms) {
    if (!isActive()) return;
    if (depthEl) depthEl.textContent = formatDepth(view.scale);
    const c = canvas();
    const used = c && c.__fractalPrecisionUsed;
    const st = c && c.__fractalDeepStats;
    let text;
    const buddha = c && (view.type === "buddhabrot" || view.type === "nebulabrot") && c.__fractalBuddhaStats;
    if (buddha) {
      const b = c.__fractalBuddhaStats();
      text = `${view.type === "nebulabrot" ? "Nebulabrot" : "Buddhabrot"} on the GPU: ${(b.drawn / 1e6).toFixed(1)} million orbits sampled (budget ${(b.target / 1e6).toFixed(0)} million), `
        + `${(b.points / 1e6).toFixed(0)} million points drawn` + (b.done ? `, done in ${(b.ms / 1000).toFixed(1)} s.` : ", accumulating.");
    } else if (used === "perturbation" && st) {
      text = `Perturbation, ${st.maxIter.toLocaleString()} iterations. Reference ${st.refLen.toLocaleString()} long at ${st.refBits} bits`
        + (st.refReused ? " (kept)" : `, ${Math.round(st.refMs)} ms`)
        + (st.blaEntries ? `; ${st.blaLevels} BLA levels` : "; no BLA")
        + (ms != null ? `. Frame ${Math.round(ms)} ms.` : ".");
    } else if (used === "double") text = "Emulated double precision (df64): this device has no WebGL2.";
    else if (used === "single") text = "Single precision: float32 holds every pixel at this depth." + (ms != null ? ` Frame ${Math.round(ms)} ms.` : "");
    else text = "CPU renderer.";
    if (readout) readout.textContent = text;
    if (box && document.activeElement !== box) box.value = formatLocation(view);
  }

  // Frame time: the draw call returns before the GPU finishes, so a settled frame is timed with a
  // one-pixel read, which waits for it. Interaction frames skip this (timed = false) and keep the
  // GPU pipelined.
  function timeFrame(view, t0, timed) {
    const c = canvas();
    const gl = c && c.__fractalGLContext;
    let ms = null;
    if (timed && gl) {
      const px = new Uint8Array(4);
      try { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); ms = performance.now() - t0; } catch (_) { ms = null; }
    }
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => painted(view, ms));
  }

  return { decorate, painted, timeFrame };
}
