// probe.js: injected before any page script by tests/perf-budget.cjs. It counts what the budget limits and never
// changes what the page draws: canvas contexts by kind, draw calls per canvas, video play time, frame intervals,
// LCP and CLS. The gate reads window.__perf. A hidden tab is simulated through window.__perfHide(), which flips
// document.hidden and fires visibilitychange the way a real background tab does. A block, not a function, keeps its
// names out of the page.
{
  const P = (window.__perf = { contexts: [], draws: new Map(), frames: [], lcp: 0, cls: 0, lcpEl: "", hidden: false });
  let id = 0;
  const tag = (el) => { if (!el.__perfId) el.__perfId = ++id; return el.__perfId; };
  const bump = (canvas) => { if (!canvas) return; const k = tag(canvas); P.draws.set(k, (P.draws.get(k) || 0) + 1); };

  // contexts: every getContext that returns a context, on DOM canvases and offscreen ones
  for (const C of [window.HTMLCanvasElement, window.OffscreenCanvas].filter(Boolean)) {
    const get = C.prototype.getContext;
    C.prototype.getContext = function (kind, opts) {
      const ctx = get.call(this, kind, opts);
      if (ctx && !this.__perfKind) {
        this.__perfKind = kind; tag(this);
        P.contexts.push({ id: this.__perfId, kind, dom: C === window.HTMLCanvasElement, el: this });
      }
      return ctx;
    };
  }
  // draws: the calls that put pixels on a canvas, in 2D, WebGL and WebGPU
  const wrap = (proto, names) => { if (!proto) return; for (const n of names) { const f = proto[n]; if (typeof f !== "function") continue;
    proto[n] = function (...a) { bump(this.canvas); return f.apply(this, a); }; } };
  const D2 = ["fillRect", "strokeRect", "clearRect", "fill", "stroke", "drawImage", "putImageData", "fillText", "strokeText"];
  wrap(window.CanvasRenderingContext2D?.prototype, D2);
  wrap(window.OffscreenCanvasRenderingContext2D?.prototype, D2);
  wrap(window.WebGLRenderingContext?.prototype, ["drawArrays", "drawElements"]);
  wrap(window.WebGL2RenderingContext?.prototype, ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]);
  wrap(window.ImageBitmapRenderingContext?.prototype, ["transferFromImageBitmap"]);
  if (window.GPUCanvasContext) {
    const g = GPUCanvasContext.prototype.getCurrentTexture;
    GPUCanvasContext.prototype.getCurrentTexture = function () { bump(this.canvas); return g.call(this); };
  }

  // frames: the interval between animation frames, the page's own clock under the throttled CPU
  let last = 0;
  const raf = (t) => { if (last) P.frames.push(t - last); last = t; requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  P.resetFrames = () => { P.frames = []; last = 0; };
  P.resetDraws = () => { P.draws = new Map(); };

  // LCP and CLS, buffered so entries before the probe's observer count
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { P.lcp = e.startTime; P.lcpEl = e.element ? (e.element.tagName + "." + (e.element.className || "")).slice(0, 80) : e.url || ""; } })
      .observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) P.cls += e.value; })
      .observe({ type: "layout-shift", buffered: true });
  } catch (e) { console.warn("perf probe: an observer is unsupported", e); }

  // a hidden tab, simulated: document.hidden and visibilityState report hidden, then visibilitychange fires
  const hiddenDesc = Object.getOwnPropertyDescriptor(Document.prototype, "hidden");
  const stateDesc = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
  Object.defineProperty(document, "hidden", { configurable: true, get: () => P.hidden || hiddenDesc.get.call(document) });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (P.hidden ? "hidden" : stateDesc.get.call(document)) });
  window.__perfHide = (on) => { P.hidden = on; document.dispatchEvent(new Event("visibilitychange")); };

  // a summary the gate can read across the protocol boundary
  window.__perfSummary = () => {
    const vw = innerWidth, vh = innerHeight;
    const onScreen = (el) => { if (!el.isConnected) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw; };
    const live = P.contexts.filter((c) => c.dom ? c.el.isConnected : true);
    const gpu = live.filter((c) => /webgl|webgpu|bitmaprenderer/.test(c.kind));
    const domCanvases = document.querySelectorAll("canvas").length;
    const draws = [...P.draws.entries()].map(([k, n]) => { const c = P.contexts.find((x) => x.id === k); return { id: k, n, kind: c?.kind, dom: !!c?.dom, cls: c?.dom ? String(c.el.className || c.el.id || "") : "offscreen", on: c?.dom ? onScreen(c.el) : null }; });
    // the width the picture is drawn at, in CSS px: object-fit cover scales past the box, contain stays inside it
    const drawn = (el, nw, nh) => { const r = el.getBoundingClientRect(); if (!nw || !nh) return r.width; const fit = getComputedStyle(el).objectFit;
      const k = fit === "cover" ? Math.max(r.width / nw, r.height / nh) : fit === "contain" || fit === "scale-down" ? Math.min(r.width / nw, r.height / nh) : r.width / nw; return nw * k; };
    // a srcset image reports a density-corrected naturalWidth; the file's own width is its w descriptor
    const fileWidth = (i) => { if (!i.srcset) return i.naturalWidth; for (const c of i.srcset.split(",")) { const [u, d] = c.trim().split(/\s+/);
      if (d && d.endsWith("w") && new URL(u, location.href).href === i.currentSrc) return +d.slice(0, -1); } return i.naturalWidth; };
    const videos = [...document.querySelectorAll("video")].map((v) => ({ src: v.currentSrc, w: v.videoWidth, h: v.videoHeight, cw: drawn(v, v.videoWidth, v.videoHeight), ch: v.getBoundingClientRect().height,
      on: onScreen(v), playing: !v.paused && !v.ended && v.readyState > 2, poster: !!(v.poster || v.dataset.poster),
      types: [...v.querySelectorAll("source")].map((s) => s.type), cls: String(v.className) }));
    const imgs = [...document.images].filter((i) => i.complete && i.naturalWidth && onScreen(i)).map((i) => { const w = fileWidth(i); return { src: i.currentSrc, w, cw: drawn(i, w, w * i.naturalHeight / i.naturalWidth) }; });
    // the budget's count: canvases composited on the page (a DOM canvas with a context) plus every GPU context,
    // offscreen ones included; offscreen 2D scratch buffers are memory, not frames, and are left out
    const budgeted = live.filter((c) => c.dom || /webgl|webgpu/.test(c.kind)).length;
    return { domCanvases, live: budgeted, liveDom: live.filter((c) => c.dom).length, gpu: gpu.length, kinds: live.map((c) => c.kind),
      draws, videos, imgs, lcp: P.lcp, lcpEl: P.lcpEl, cls: P.cls, frames: P.frames.slice(), dpr: devicePixelRatio, vw, vh };
  };
}
