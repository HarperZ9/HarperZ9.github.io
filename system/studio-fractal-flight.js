// studio-fractal-flight.js: the 2D Fractal source's Flight group: keyframes, a preview on the
// stage, and export as WebM video (fractal-flight.js). Keyframes ride on the view (view.flight), so
// Undo, the kept view and project files carry them.

import { flightView, renderFlightVideo } from "./fractal-flight.js";

const $ = (id) => document.getElementById(id);
const SIZES = { "720p": [1280, 720], "1080p": [1920, 1080], "4k": [3840, 2160] };

export function mountFractalFlight({ getView, setView, repaintFast, repaint, draw, decorate, say, isActive }) {
  let previewRaf = 0, fps = 30, size = "1080p", busy = false;
  const status = (t) => { const s = $("fractal-flight-status"); if (s) s.textContent = t; };
  const seconds = () => Math.max(0.5, parseFloat(($("fractal-flight-seconds") || {}).value) || 6);
  const keys = () => ((getView() || {}).flight || []);
  const strip = (v) => { const k = { ...v }; delete k.flight; return k; };

  function list() {
    const host = $("fractal-flight-keys");
    if (!host) return;
    host.innerHTML = "";
    keys().forEach((k, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip";
      b.textContent = `${i + 1}: ${(3.5 / k.scale).toExponential(1).replace("e+", "e")}x`;
      b.title = "Show this keyframe";
      b.addEventListener("click", () => { const v = getView(); setView({ ...strip(k), flight: v.flight }); repaint(); });
      host.appendChild(b);
    });
    const n = keys().length;
    status(n < 2 ? `${n} keyframe${n === 1 ? "" : "s"}. Add another to fly between them.` : `${n} keyframes, ${((n - 1) * seconds()).toFixed(1)} s of flight.`);
  }

  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };
  on("fractal-flight-add", () => {
    const v = getView(); if (!v) return;
    setView({ ...v, flight: [...keys(), strip(v)] });
    list();
  });
  on("fractal-flight-clear", () => { const v = getView(); if (!v) return; setView({ ...v, flight: [] }); list(); });
  const sec = $("fractal-flight-seconds");
  if (sec) sec.addEventListener("input", () => { const o = $("fractal-flight-seconds-val"); if (o) o.textContent = (+sec.value).toFixed(1); list(); });
  document.querySelectorAll("[data-flight-fps]").forEach((b) => b.addEventListener("click", () => {
    fps = +b.dataset.flightFps; document.querySelectorAll("[data-flight-fps]").forEach((x) => x.classList.toggle("active", x === b));
  }));
  document.querySelectorAll("[data-flight-size]").forEach((b) => b.addEventListener("click", () => {
    size = b.dataset.flightSize; document.querySelectorAll("[data-flight-size]").forEach((x) => x.classList.toggle("active", x === b));
  }));

  // Position along the flight, 0 to 1: an ordinary slider, so the Studio's shared timeline can key
  // it like any other control, and playing or rendering the timeline flies the path.
  const pos = $("fractal-flight-pos");
  if (pos) pos.addEventListener("input", () => {
    const k = keys();
    const o = $("fractal-flight-pos-val"); if (o) o.textContent = (+pos.value).toFixed(3);
    if (k.length < 2) return;
    setView({ ...flightView(k, +pos.value * (k.length - 1) * seconds(), seconds()), flight: k });
    repaintFast();
  });

  // Preview: the flight plays on the stage at the stage's own size, as fast as frames allow.
  function stopPreview() { if (previewRaf) cancelAnimationFrame(previewRaf); previewRaf = 0; const b = $("fractal-flight-preview"); if (b) b.textContent = "Preview"; }
  on("fractal-flight-preview", () => {
    if (previewRaf) { stopPreview(); repaint(); return; }
    const k = keys();
    if (k.length < 2) { status("Add two keyframes or more first."); return; }
    const home = getView(), total = (k.length - 1) * seconds();
    const t0 = performance.now();
    const b = $("fractal-flight-preview"); if (b) b.textContent = "Stop";
    const step = () => {
      previewRaf = 0;
      if (!isActive()) { stopPreview(); return; }
      const t = (performance.now() - t0) / 1000;
      if (t > total) { stopPreview(); setView(home); repaint(); return; }
      setView({ ...flightView(k, t, seconds()), flight: k });
      repaintFast();
      previewRaf = requestAnimationFrame(step);
    };
    previewRaf = requestAnimationFrame(step);
  });

  on("fractal-flight-export", async () => {
    const k = keys();
    if (k.length < 2) { status("Add two keyframes or more first."); return; }
    if (busy) return;
    busy = true;
    stopPreview();
    const [w, h] = SIZES[size];
    const t0 = performance.now();
    try {
      const blob = await renderFlightVideo({
        keys: k.map(decorate), seconds: seconds(), fps, width: w, height: h, draw,
        onProgress: (d, n) => status(`Rendering frame ${d} of ${n}.`),
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `fractal-flight-${w}x${h}-${fps}fps.webm`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      const s = ((performance.now() - t0) / 1000).toFixed(1);
      status(`Saved ${a.download}, ${(blob.size / 1e6).toFixed(1)} MB, rendered in ${s} s.`);
      say(`The flight is saved as video: ${w} x ${h} at ${fps} frames a second, ${(blob.size / 1e6).toFixed(1)} MB, rendered in ${s} s.`);
    } catch (e) {
      console.error("[studio] flight export failed:", e);
      status(`The video was not saved: ${e.message}.`);
    } finally { busy = false; }
  });

  return { sync: () => list(), stop: stopPreview };
}
