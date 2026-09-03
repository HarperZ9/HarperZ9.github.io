/* retro-studio.js — the Retro Engine page controller.

   A source (generative plate, uploaded image, or live GLSL shader) is rendered
   to a source canvas, pushed through renderRetro() with the panel's settings,
   then through a stackable rack of glitch / manipulation effects. Shaders and
   glitch can animate; the preview reacts to the pointer; Randomize rolls the
   whole chain. Everything is local; nothing uploads. */

import { renderRetro } from "./retro-engine.js?v=20260902-crt";
import { createShaderRunner, DEFAULT_FRAG } from "./shader-runner.js?v=20260805-react";
import { applyOps, OP_META, rngFrom } from "./glitch-ops.js?v=20260813-wave2";
import { SHADER_PRESETS } from "./shader-presets.js?v=20260812-wave7";
import { sendPiece, receiveTrail, mountFlow } from "./workbench.js?v=20260812-cohesion";
import { setUserPalette } from "./retro-palettes.js";
import { MOD_SOURCES, evalSources, computeOffsets, modValue } from "./mod-matrix.js?v=20260812-motion";

const $ = (id) => document.getElementById(id);
const rand = () => Math.random().toString(36).slice(2, 9);

function boot() {
  const out = $("re-out");
  if (!out) return;

  const srcCanvas = document.createElement("canvas"); srcCanvas.width = 1280; srcCanvas.height = 800;
  const shaderCanvas = document.createElement("canvas"); shaderCanvas.width = 1024; shaderCanvas.height = 640;

  let state = "shader";
  let runner = null, animRaf = 0, lastRetro = 0, uploaded = null, renderSpecimen = null;
  const activeFx = new Set();

  // shader stack: extra shader layers composited onto the base (editor) shader
  const stackCanvas = document.createElement("canvas"); stackCanvas.width = 1024; stackCanvas.height = 640;

  // the XY scope: sound drawing the picture. Lazily loaded with its own canvas
  // that acts as a source like any other; phosphor persistence lives in the
  // canvas itself (faded, never cleared).
  const scopeCanvas = document.createElement("canvas"); scopeCanvas.width = 1024; scopeCanvas.height = 640;
  let scopeMod = null, scopeLoading = false;

  // the Draw source: the user's hand, straight into the pipeline
  const drawCanvas = document.createElement("canvas"); drawCanvas.width = 1024; drawCanvas.height = 640;
  { const g = drawCanvas.getContext("2d"); g.fillStyle = "#07070c"; g.fillRect(0, 0, 1024, 640); }
  let drawing = false, lastPt = null;
  // the drawn beam figure: normalized [-1,1] points and its looping sound.
  // beamGen invalidates in-flight lifts: release or a new stroke bumps it,
  // and a lift that finishes late must not resurrect a released figure.
  let beamPath = [], beamFigure = null, beamDrawing = false, beamGen = 0;

  // the motion rack: routes patch sources into parameters; offsets are
  // fractions of each slider's range, recomputed every frame, never written
  // into the DOM so the user's set point survives under the movement.
  const MOD_TARGETS = [
    ["tw", "re-tw", "Pixel size"], ["bloom", "re-bloom", "Bloom"], ["curv", "re-curv", "Curvature"],
    ["vig", "re-vig", "Vignette"], ["scan", "re-scan", "Scanlines"], ["gam", "re-gam", "Gamma"],
    ["amount", "re-fxamount", "Effect amount"], ["knobA", "re-knobA", "Knob A"],
    ["knobB", "re-knobB", "Knob B"], ["knobC", "re-knobC", "Knob C"], ["fb", "re-fb-amt", "Feedback decay"],
  ];
  let modRoutes = [], modOffsets = {};
  const mv = (key, id) => {
    const el = $(id);
    if (!el) return 0;
    return modValue(+el.value, +el.min, +el.max, modOffsets[key]);
  };

  // video feedback: the previous OUT frame folded back over the next one
  const fbCanvas = document.createElement("canvas");
  const fbOn = () => { const el = $("re-fb"); return !!(el && el.checked); };

  // draw undo: a short stack of ground truth, one entry per stroke
  const drawUndo = [];
  // a running clip keeps the loop alive even on a still source
  let clipActive = false;

  // temporal op state, after entro_play's practice: datamosh feeds on a
  // snapshot of the last composed frame; slit scan reads a short half-res
  // ring of past frames. Both maintained only while their op is active.
  const moshPrev = document.createElement("canvas");
  const SLIT_LEN = 16;
  const slitRing = { frames: [], head: 0 };
  const extraLayers = []; // [{canvas, runner, glsl, name, blend, opacity}]
  const MAX_LAYERS = 4;
  const BLENDS = [["lighter", "Add"], ["screen", "Screen"], ["multiply", "Multiply"],
    ["difference", "Difference"], ["overlay", "Overlay"], ["lighten", "Lighten"], ["source-over", "Normal"]];

  // audio instrument (lazily created on first Sound press). ping = play a note
  // for a physical edit; guarded so it is a no-op until sound is on.
  let audio = null, micOn = false;
  const ping = (k, v) => { recEvent(k, v); try { if (audio && audio.isOn()) audio.ping(k, v); } catch (_) {} };
  let _lastPing = 0;
  const pingSlide = (k, v) => { const n = performance.now(); if (n - _lastPing > 70) { _lastPing = n; ping(k, v); } };

  // Per-effect amounts. The master Amount sets them all at once; each active
  // effect then keeps its own dial, so a chain can be tuned part by part.
  const fxAmount = new Map();
  const masterAmt = () => ($("re-fxamount") ? mv("amount", "re-fxamount") : 50) / 100;
  const ampOf = (op) => (fxAmount.has(op) ? fxAmount.get(op) : masterAmt());

  // Where the cursor sits over the picture, 0..1. Effects that model light
  // (the mosaic's raking glint) read this, so the light follows your hand.
  const MOUSE = { x: 0.5, y: 0.35 };

  // Live audio analysis, refreshed each frame when sound is on.
  const AU = { bass: 0, mid: 0, treble: 0, level: 0 };
  const reactOn = new Set(["shader"]);
  const reactAmt = () => (+($("re-react") ? $("re-react").value : 60)) / 100;
  const knobVals = () => [mv("knobA", "re-knobA") / 100, mv("knobB", "re-knobB") / 100, mv("knobC", "re-knobC") / 100];

  const fxAnimOn = () => $("re-fxanim").checked;
  const sourceCanvas = () => (state === "shader" ? (extraLayers.length ? stackCanvas : shaderCanvas)
    : state === "scope" ? scopeCanvas : state === "draw" ? drawCanvas : srcCanvas);
  // Sound keeps the loop alive too: a still plate should still move to music.
  const loopActive = () => state === "shader" || state === "scope" || (fxAnimOn() && activeFx.size > 0)
    || !!(audio && audio.isOn() && reactOn.size) || modRoutes.length > 0 || fbOn() || clipActive;

  function opts() {
    let tw = Math.round(mv("tw", "re-tw")); const scan = mv("scan", "re-scan") / 100;
    let bloom = mv("bloom", "re-bloom") / 100;
    const r = reactAmt();
    // sound reaching into the picture: bass coarsens the pixel grid, level blooms
    if (reactOn.has("pixel")) tw = Math.max(24, Math.round(tw * (1 - AU.bass * 0.45 * r)));
    if (reactOn.has("bloom")) bloom = Math.min(1.4, bloom + AU.level * 0.9 * r);
    return {
      palette: $("re-palette").value, targetWidth: tw, dither: $("re-dither").value,
      gamma: mv("gam", "re-gam") / 100, sdfShade: $("re-sdf").checked,
      curvature: mv("curv", "re-curv") / 100, bloom,
      vignette: mv("vig", "re-vig") / 100, scanStrength: scan, scanlines: scan > 0.02,
      ditherStrength: +$("re-dstr").value / 100, mask: $("re-mask").value,
      maskStrength: +$("re-maskamt").value / 100, halation: +$("re-hal").value / 100,
      aberration: +$("re-abr").value / 100,
      upscale: Math.max(2, Math.min(12, Math.round(900 / tw))),
    };
  }

  function buildFx(t) {
    if (!activeFx.size) return [];
    const base = ($("re-fxseed").value || "glitch") + "|" + (fxAnimOn() ? Math.floor(t * 2) : "0");
    const rng = rngFrom(base);
    const ph = fxAnimOn() ? t : 0;
    // sound pushing the whole rack harder, when it is routed to the effects
    const lift = reactOn.has("effects") ? AU.level * reactAmt() * 0.55 : 0;
    const list = [];
    for (const m of OP_META) {
      if (!activeFx.has(m.op)) continue;
      const op = m.op;
      const amt = Math.max(0, Math.min(1, ampOf(op) + lift));
      // Every op scales with its own dial, so one knob per effect means something.
      if (op === "pixelSort") list.push({ op, low: 0.5 - amt * 0.42, high: 0.5 + amt * 0.45, axis: rng() > 0.5 ? "col" : "row" });
      else if (op === "databend") list.push({ op, shift: 3 + Math.floor(amt * (9 + rng() * 90)), xor: Math.floor(rng() * 255 * amt) });
      else if (op === "rgbShift") list.push({ op, dx: amt * (6 + rng() * 22), dy: (rng() * 2 - 1) * amt * 12 });
      else if (op === "slice") list.push({ op, count: 4 + Math.floor(rng() * 14), maxShift: amt * (0.05 + rng() * 0.3), seed: base });
      else if (op === "wave") list.push({ op, amp: amt * (0.02 + rng() * 0.09), freq: 2 + Math.floor(rng() * 7), phase: ph, axis: rng() > 0.5 ? "col" : "row" });
      else if (op === "mirror") list.push({ op, mode: ["quad", "x", "y"][Math.floor(rng() * 3)] });
      else if (op === "echo") list.push({ op, dx: amt * (8 + rng() * 34), dy: amt * (4 + rng() * 26), alpha: 0.18 + amt * 0.6 });
      else if (op === "posterize") list.push({ op, levels: Math.max(2, Math.round(10 - amt * 8)) });
      else if (op === "dither") list.push({ op, levels: Math.max(2, Math.round(9 - amt * 7)) });
      else if (op === "halftone") list.push({ op, cell: Math.max(3, Math.round(3 + amt * 12)), color: rng() > 0.5 ? "source" : "mono" });
      else if (op === "ascii") list.push({ op, cell: Math.max(5, Math.round(5 + amt * 14)), color: ["source", "green", "amber", "ink"][Math.floor(rng() * 4)] });
      else if (op === "scanlines") list.push({ op, strength: 0.08 + amt * 0.7, gap: 2 + Math.floor(rng() * 2) });
      else if (op === "bleed") list.push({ op, radius: Math.max(1, Math.round(1 + amt * 16)) });
      else if (op === "mosaic") {
        // the seed picks the tradition: matte smalti, gold ground, glass, or broken shards
        const modes = ["stone", "gold", "glass", "trencadis"];
        list.push({ op, amount: amt, phase: t, seed: base, mode: modes[Math.floor(rng() * 4)],
          lightX: MOUSE.x, lightY: MOUSE.y, glint: 0.35 + amt * 0.5 });
      }
      else if (op === "datamosh") list.push({ op, amount: amt, phase: t, seed: base, prev: moshPrev });
      else if (op === "slitscan") list.push({ op, amount: amt, phase: t, ring: slitRing.frames, head: slitRing.head, len: slitRing.frames.length, axis: rng() > 0.72 ? "col" : "row" });
      else if (op === "crystallize" || op === "melt") list.push({ op, amount: amt, phase: ph, seed: base });
      else if (op === "kaleido") list.push({ op, amount: amt, phase: ph });
      else if (op === "wavy") list.push({ op, amount: amt, phase: ph, freq: 2 + Math.floor(rng() * 4) });
      else if (op === "bubbly" || op === "sparkle") list.push({ op, amount: amt, phase: ph, seed: base });
      else if (op === "goop" || op === "starry") list.push({ op, amount: amt, phase: ph });
      else list.push({ op, amount: amt });
    }
    return list;
  }

  function status(msg, kind) { const el = $("re-status"); el.textContent = msg || ""; el.className = "re-status" + (kind ? " " + kind : ""); }

  // --- your own colors as hardware: six swatches become the "yours" palette
  const YOURPAL_KEY = "re.userpal.v1";
  function palInputs() { return [...document.querySelectorAll("#re-yourpal-row .re-color")]; }
  function hexTriple(h) { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function applyUserPalette(save) {
    const inputs = palInputs();
    if (!inputs.length) return;
    if (setUserPalette(inputs.map((i) => hexTriple(i.value))) && save) {
      try { localStorage.setItem(YOURPAL_KEY, JSON.stringify(inputs.map((i) => i.value))); } catch (_) {}
    }
  }
  function syncYourPal() { const f = $("re-yourpal"); if (f) f.hidden = $("re-palette").value !== "yours"; }

  // Render the base shader, then composite the extra shader layers on top with
  // their blend modes — novel combinations of shader math in one frame.
  // Push the live knob values into every running program (no recompile).
  function pushKnobs() {
    const k = knobVals();
    if (runner && runner.setKnobs) runner.setKnobs(k[0], k[1], k[2]);
    for (const L of extraLayers) if (L.runner && L.runner.setKnobs) L.runner.setKnobs(k[0], k[1], k[2]);
  }

  // Read the analyser and hand the bands to the shaders + the meters. This is
  // the other half of the loop: the picture already sings, now sound paints.
  function pumpAudio(t) {
    // With no sound connected the bands breathe on a slow synthetic pulse, so an
    // audio-reactive shader is alive the moment you open it. Real sound, once
    // you start it, replaces the pulse entirely.
    const scanLive = !!(audio && audio.scanPlaying && audio.scanPlaying());
    const loopLive = !!(audio && audio.loopPlaying && audio.loopPlaying());
    if (!audio || !audio.hasInput || (!audio.isOn() && !audio.hasInput() && !scanLive && !loopLive)) {
      const s = t || 0;
      AU.bass = 0.34 + 0.30 * Math.sin(s * 0.85);
      AU.mid = 0.30 + 0.24 * Math.sin(s * 1.33 + 1.1);
      AU.treble = 0.24 + 0.20 * Math.sin(s * 2.05 + 2.3);
      AU.level = (AU.bass + AU.mid + AU.treble) / 3;
    } else {
      const b = audio.bands();
      AU.bass = b.bass; AU.mid = b.mid; AU.treble = b.treble; AU.level = b.level;
    }
    if (reactOn.has("shader")) {
      const r = reactAmt();
      const a = [AU.bass * r, AU.mid * r, AU.treble * r, AU.level * r];
      if (runner && runner.setAudio) runner.setAudio(a[0], a[1], a[2], a[3]);
      for (const L of extraLayers) if (L.runner && L.runner.setAudio) L.runner.setAudio(a[0], a[1], a[2], a[3]);
    }
    const m = (id, v) => { const el = $(id); if (el) el.style.setProperty("--m", String(Math.round((1 - Math.max(0, Math.min(1, v))) * 100)) + "%"); };
    m("re-m-bass", AU.bass); m("re-m-mid", AU.mid); m("re-m-treb", AU.treble);
    if (REC.on && REC.bands.length < 4000 && performance.now() - REC.lastBand > 150) {
      REC.lastBand = performance.now();
      REC.bands.push([performance.now() - REC.t0, AU.bass, AU.mid, AU.treble]);
    }
  }

  function renderShaderFrame(t) {
    if (state !== "shader") return;
    if (runner) runner.renderFrame(t);
    if (!extraLayers.length) return;
    const ctx = stackCanvas.getContext("2d");
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, stackCanvas.width, stackCanvas.height);
    ctx.drawImage(shaderCanvas, 0, 0, stackCanvas.width, stackCanvas.height);
    for (const L of extraLayers) {
      if (!L.runner || !L.runner.ok) continue;
      try { L.runner.renderFrame(t); } catch (_) { continue; }
      ctx.globalCompositeOperation = L.blend; ctx.globalAlpha = L.opacity;
      ctx.drawImage(L.canvas, 0, 0, stackCanvas.width, stackCanvas.height);
    }
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  }

  // The scope frame: the beam idles on a knob-steered figure until real sound
  // is connected, then the sound itself draws via phase-space embedding.
  function ensureScope() {
    if (scopeMod || scopeLoading) return;
    scopeLoading = true;
    import("./scope-voice.js?v=20260811-crossings")
      .then((m) => { scopeMod = m; })
      .catch((e) => { status("scope unavailable: " + e.message, "err"); })
      .finally(() => { scopeLoading = false; });
  }
  function renderScopeFrame(t) {
    if (state !== "scope" || !scopeMod) return;
    const ctx = scopeCanvas.getContext("2d");
    const persist = (+($("re-scope-persist") ? $("re-scope-persist").value : 70)) / 100;
    scopeMod.fadeTrace(ctx, scopeCanvas.width, scopeCanvas.height, 0.03 + (1 - persist) * 0.45);
    let pts = null;
    // Priority: the figure the user drew, then the partial path under the
    // finger, then live audio, then the idle knob-steered Lissajous.
    if (beamFigure) pts = beamFigure;
    else if (beamDrawing && beamPath.length >= 4) pts = Float32Array.from(beamPath);
    else {
      const wf = audio && audio.waveform ? audio.waveform() : null;
      if (wf) {
        let rms = 0; for (let i = 0; i < wf.length; i += 8) rms += wf[i] * wf[i];
        if (Math.sqrt(rms / (wf.length / 8)) > 0.004) pts = scopeMod.delayEmbed(wf, 96, 2);
      }
    }
    if (!pts) { const k = knobVals(); pts = scopeMod.idlePath($("re-fxseed").value || "beam", t, k[0], k[1], k[2]); }
    scopeMod.drawTrace(ctx, pts, scopeCanvas.width, scopeCanvas.height, { beam: 0.9 });
  }

  // Sonify the render: split a mid scanline into six brightness bands and let
  // the shader drive the harmonics of the audio voice. No-op when sound is off.
  function sampleAudio() {
    if (!audio || !audio.isOn()) return;
    const w = out.width, h = out.height; if (!w || !h) return;
    let row; try { row = out.getContext("2d").getImageData(0, h >> 1, w, 1).data; } catch (_) { return; }
    const N = 48, B = 6, luma = new Array(N);
    for (let i = 0; i < N; i++) { const x = Math.min(w - 1, (i / N * w) | 0), o = x * 4; luma[i] = (row[o] * 0.299 + row[o + 1] * 0.587 + row[o + 2] * 0.114) / 255; }
    const per = N / B, bands = new Array(B);
    for (let b = 0; b < B; b++) {
      const s = (b * per) | 0, e = ((b + 1) * per) | 0; let m = 0, c = 0;
      for (let i = s; i < e; i++) { m += luma[i]; c++; } m /= c || 1;
      let ac = 0; for (let i = s; i < e; i++) ac += Math.abs(luma[i] - m);
      bands[b] = Math.min(1, (ac / (c || 1)) * 3.5 + m * 0.18);
    }
    audio.feed(bands);
  }

  // Sources drive parameters through the routes; offsets refresh per frame.
  // Knob routes push the modulated values into the running shaders too.
  function modPass(t) {
    if (!modRoutes.length) {
      if (modOffsets.tw !== undefined || Object.keys(modOffsets).length) modOffsets = {};
      try { paintModMarkers(); } catch (_) {}   // drop any stale markers
      return;
    }
    const env = {
      bass: AU.bass, mid: AU.mid, treble: AU.treble, level: AU.level,
      mx: MOUSE.x, my: MOUSE.y,
      knobA: (+$("re-knobA").value) / 100, knobB: (+$("re-knobB").value) / 100, knobC: (+$("re-knobC").value) / 100,
    };
    modOffsets = computeOffsets(modRoutes, evalSources(t, env));
    if (modRoutes.some((r) => r.tgt === "knobA" || r.tgt === "knobB" || r.tgt === "knobC")) pushKnobs();
    try { paintModMarkers(); } catch (_) {}
  }



  // ── the palette a frame actually resolved to ─────────────────────────────
  // "Auto (from image)" median-cuts a palette out of the picture. Until the
  // renderer started returning its entries, the visitor could see the result
  // and never the colours it chose, and could not keep them. The strip shows
  // them for every mode, hardware palettes included, and Adopt copies them into
  // Your colors so they can be edited rather than only accepted.
  let lastEntries = [], _palAt = 0;
  function paintPalStrip() {
    const host = document.getElementById("re-palstrip");
    if (!host || !lastMeasure) return;
    const ent = lastMeasure.entries;
    if (!ent || !ent.length) return;
    const key = ent.join(",");
    if (host.dataset.key === key) return;      // only repaint on a real change
    const now = performance.now();
    if (now - _palAt < 300) return;
    _palAt = now;
    host.dataset.key = key;
    lastEntries = ent.slice(0);
    host.innerHTML = "";
    for (const hex of ent) {
      const sw = document.createElement("i");
      sw.style.background = hex;
      sw.title = hex;
      host.appendChild(sw);
    }
    const note = document.getElementById("re-palstrip-note");
    if (note) {
      note.textContent = ent.length + " colours"
        + ($("re-palette").value === "auto" ? ", cut from the picture" : ", from " + $("re-palette").value);
    }
  }
  const adopt = document.getElementById("re-pal-adopt");
  if (adopt) adopt.addEventListener("click", () => {
    if (!lastEntries.length) { status("nothing to adopt yet", "err"); return; }
    const inputs = palInputs();
    if (!inputs.length) { status("no colour inputs to adopt into", "err"); return; }
    // the strip can be longer or shorter than the six slots: sample across it
    // so an adopted palette keeps its range instead of only its darkest end
    inputs.forEach((el, i) => {
      const at = inputs.length === 1 ? 0
        : Math.round((i / (inputs.length - 1)) * (lastEntries.length - 1));
      el.value = lastEntries[Math.max(0, Math.min(lastEntries.length - 1, at))];
    });
    const sel = $("re-palette");
    if (sel) {
      const mine = [...sel.options].find((o) => /your|custom|mine/i.test(o.textContent));
      if (mine) { sel.value = mine.value; sel.dispatchEvent(new Event("change")); }
    }
    ping("preset");
    status("adopted " + inputs.length + " colours into Your colors", "ok");
    sync();
  });

  // ── modulation, made visible ─────────────────────────────────────────────
  // Routes deliberately never write the DOM, so the user's own setting is never
  // clobbered by an LFO. The cost was that a swept control looked completely
  // inert: the thumb sat still and nothing said the value was moving. A ghost
  // marker rides the track at the modulated value instead, leaving the real
  // thumb exactly where it was put.
  let _modPaintAt = 0;
  function paintModMarkers() {
    const now = performance.now();
    if (now - _modPaintAt < 90) return;      // ~11fps is plenty for a marker
    _modPaintAt = now;
    const routed = new Set(modRoutes.map((r) => r.tgt));
    for (const [key, id] of MOD_TARGETS) {
      const el = $(id);
      if (!el || !el.parentElement) continue;
      let mark = el.parentElement.querySelector('[data-mod-for="' + id + '"]');
      if (!routed.has(key)) { if (mark) mark.remove(); continue; }
      if (!mark) {
        mark = document.createElement("span");
        mark.className = "re-modmark";
        mark.dataset.modFor = id;
        mark.setAttribute("aria-hidden", "true");
        if (getComputedStyle(el.parentElement).position === "static") {
          el.parentElement.style.position = "relative";
        }
        el.parentElement.appendChild(mark);
      }
      const lo = +el.min, hi = +el.max;
      const span = hi - lo;
      if (!(span > 0)) continue;
      const v = mv(key, id);
      const f = Math.max(0, Math.min(1, (v - lo) / span));
      mark.style.left = (f * 100).toFixed(2) + "%";
      // the label reads the live value, so the number is legible too
      mark.title = String(Math.round(v * 100) / 100);
    }
  }

  // The live measurement of the frame, painted under the stage on a throttle so
  // a 60fps loop does not write the DOM 60 times a second.
  let lastMeasure = null, _measureAt = 0;
  function paintMeasure() {
    const el = document.getElementById("re-measure");
    if (!el || !lastMeasure) return;
    const now = performance.now();
    if (now - _measureAt < 400) return;
    _measureAt = now;
    const m = lastMeasure;
    el.textContent = `${m.cells} cells · ${m.colors} colours from ${m.palette}`
      + ` · ${activeFx.size} effect${activeFx.size === 1 ? "" : "s"}`
      + ` · output ${m.w}×${m.h}`;
  }

  function retroPass(t = 0) {
    const s = sourceCanvas(); if (!s.width) return;
    try {
      // renderRetro reports the grid it just built ({w,h,palette,cells,colors});
      // the call site used to drop it, so the one surface whose whole subject is
      // the pixel grid never told you what the grid was.
      lastMeasure = renderRetro(s, out, opts()) || null;
      if (activeFx.size) applyOps(out, buildFx(t));
    }
    catch (e) { status("render error: " + e.message, "err"); }
    try { paintMeasure(); paintPalStrip(); } catch (_) {}
    // Feedback: the previous frame folded back over this one (zoomed and
    // rotated a little), then the blend becomes the next frame's memory.
    if (fbOn()) {
      const g = out.getContext("2d");
      // Blend the memory even across size changes (a modulated pixel grid
      // resizes the canvas nearly every frame): the old frame scale-blits
      // into the new dimensions instead of being thrown away.
      if (fbCanvas.width > 0 && fbCanvas.height > 0) {
        g.save();
        g.globalAlpha = Math.max(0, Math.min(0.95, mv("fb", "re-fb-amt") / 100));
        g.translate(out.width / 2, out.height / 2);
        g.rotate(((+$("re-fb-rot").value) / 10) * Math.PI / 180);
        const z = 1 + (+$("re-fb-zoom").value) / 1000;
        g.scale(z, z);
        g.drawImage(fbCanvas, -out.width / 2, -out.height / 2, out.width, out.height);
        g.restore();
      }
      if (fbCanvas.width !== out.width || fbCanvas.height !== out.height) {
        fbCanvas.width = out.width; fbCanvas.height = out.height;
      }
      fbCanvas.getContext("2d").drawImage(out, 0, 0);
    }
    // temporal op memory, refreshed from the frame just composed
    if (activeFx.has("datamosh")) {
      if (moshPrev.width !== out.width || moshPrev.height !== out.height) { moshPrev.width = out.width; moshPrev.height = out.height; }
      moshPrev.getContext("2d").drawImage(out, 0, 0);
    }
    if (activeFx.has("slitscan")) {
      const rw = Math.max(2, out.width >> 1), rh = Math.max(2, out.height >> 1);
      slitRing.head = (slitRing.head + 1) % SLIT_LEN;
      let f = slitRing.frames[slitRing.head];
      if (!f) { f = document.createElement("canvas"); slitRing.frames[slitRing.head] = f; }
      if (f.width !== rw || f.height !== rh) { f.width = rw; f.height = rh; }
      f.getContext("2d").drawImage(out, 0, 0, rw, rh);
    }
    sampleAudio();
  }

  async function renderPlate() {
    if (!renderSpecimen) { const mod = await import("./generative-field.js"); renderSpecimen = mod.renderSpecimen || mod.renderPlate || null; }
    if (!renderSpecimen) { status("generative engine unavailable", "err"); return; }
    const layers = $("re-layers").value.split(",").map((s) => s.trim()).filter(Boolean);
    try { renderSpecimen(srcCanvas, $("re-seed").value || "folded-light", layers); status(""); }
    catch (e) { status("plate error: " + e.message, "err"); }
    if (!animRaf) retroPass(0);
  }

  function renderUpload() {
    if (!uploaded) { status("choose an image to pixel-art", ""); return; }
    const c = srcCanvas, ctx = c.getContext("2d");
    const scale = Math.min(c.width / uploaded.naturalWidth, c.height / uploaded.naturalHeight);
    const w = uploaded.naturalWidth * scale, h = uploaded.naturalHeight * scale;
    ctx.fillStyle = "#07070c"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(uploaded, (c.width - w) / 2, (c.height - h) / 2, w, h);
    if (!animRaf) retroPass(0);
  }

  function ensureShader() {
    if (runner) return runner;
    if (!$("re-code").value) $("re-code").value = DEFAULT_FRAG;
    runner = createShaderRunner(shaderCanvas, $("re-code").value);
    if (!runner.ok) status(runner.error, "err");
    return runner;
  }
  function runShader() {
    const r = ensureShader(), res = r.setSource($("re-code").value);
    if (!res.ok) { status(res.error, "err"); return false; }
    status("shader compiled", "ok");
    if (!$("re-animate").checked) { renderShaderFrame(1.3); if (!animRaf) retroPass(0); }
    return true;
  }

  function startLoop() {
    stopLoop();
    if (state === "shader") ensureShader();
    const loop = (now) => {
      const t = now / 1000;
      pumpAudio(t);
      modPass(t);
      if (state === "shader") renderShaderFrame(t);
      if (state === "scope") renderScopeFrame(t);
      if (now - lastRetro > 45) { retroPass(t); lastRetro = now; }
      animRaf = requestAnimationFrame(loop);
    };
    animRaf = requestAnimationFrame(loop);
  }
  function stopLoop() { if (animRaf) cancelAnimationFrame(animRaf); animRaf = 0; }

  // Decide whether to animate or draw one still frame.
  function sync() { if (loopActive()) startLoop(); else { stopLoop(); retroPass(0); }
    try { sessionSnapshot(); } catch (_) {} }

  function refreshSource() {
    stopLoop();
    if (state === "plate") renderPlate();
    else if (state === "upload") renderUpload();
    else if (state === "shader") { if (!runShader()) return; }
    else if (state === "scope") ensureScope();
    sync();
  }

  // Redraw after an engine/effects control change without touching the source.
  const redraw = () => { if (!animRaf) retroPass(0); };

  // --- effects rack chips (grouped by category) + vibe presets ------------
  const fxHost = $("re-fxchips");
  function syncFxCount() { $("re-fx-count").textContent = activeFx.size + " on"; }
  const chipEls = {};
  [["feel", "Feel"], ["glitch", "Glitch"], ["tone", "Tone"]].forEach(([cat, label]) => {
    const row = document.createElement("div"); row.className = "re-fxgroup";
    const lab = document.createElement("span"); lab.className = "re-fxgrouplab"; lab.textContent = label; row.appendChild(lab);
    OP_META.forEach((m, mi) => {
      if (m.cat !== cat) return;
      const b = document.createElement("button");
      b.className = "re-chip"; b.type = "button"; b.textContent = m.label; b.setAttribute("aria-pressed", "false");
      // every effect ships a plain-language line; a chip that is one word with
      // no explanation is a control the visitor has to guess at
      if (m.desc) { b.title = m.desc; b.setAttribute("aria-label", m.label + ": " + m.desc); }
      b.addEventListener("click", () => {
        if (activeFx.has(m.op)) activeFx.delete(m.op); else activeFx.add(m.op);
        b.setAttribute("aria-pressed", String(activeFx.has(m.op)));
        ping("chip", mi / OP_META.length); syncFxCount(); renderFxParams(); sync();
      });
      chipEls[m.op] = b; row.appendChild(b);
    });
    fxHost.appendChild(row);
  });
  function syncFxChips() { for (const op in chipEls) chipEls[op].setAttribute("aria-pressed", String(activeFx.has(op))); syncFxCount(); renderFxParams(); }

  // One labelled dial per active effect, in pipeline order.
  const paramHost = $("re-fxparams");
  function renderFxParams() {
    if (!paramHost) return;
    paramHost.textContent = "";
    for (const m of OP_META) {
      if (!activeFx.has(m.op)) continue;
      const row = document.createElement("div"); row.className = "re-prow";
      const nm = document.createElement("span"); nm.textContent = m.label; row.appendChild(nm);
      const sl = document.createElement("input");
      sl.type = "range"; sl.min = "0"; sl.max = "100"; sl.value = String(Math.round(ampOf(m.op) * 100));
      sl.setAttribute("aria-label", m.label + " amount");
      const out = document.createElement("b"); out.textContent = (ampOf(m.op)).toFixed(2);
      sl.addEventListener("input", () => {
        const v = +sl.value / 100; fxAmount.set(m.op, v); out.textContent = v.toFixed(2);
        pingSlide("slider", v); redraw();
      });
      row.appendChild(sl); row.appendChild(out); paramHost.appendChild(row);
    }
  }

  // vibe presets — named starting points people then bend
  const VIBES = [
    ["Dreamy", ["soften", "sparkle", "starry"], 55],
    ["Cosmic", ["starry", "goop", "bleed"], 70],
    ["Goopy", ["goop", "bubbly", "wavy"], 65],
    ["Shattered", ["crystallize", "sharpen", "rgbShift"], 75],
    ["Wavy", ["wavy", "soften", "bleed"], 55],
    ["Cathode", ["dither", "scanlines", "bleed", "rgbShift"], 60],
  ];
  const vibeHost = $("re-vibes");
  if (vibeHost) VIBES.forEach(([name, ops, amt]) => {
    const b = document.createElement("button"); b.className = "re-vibe"; b.type = "button"; b.textContent = name;
    b.addEventListener("click", () => {
      activeFx.clear(); ops.forEach((o) => activeFx.add(o));
      if ($("re-fxamount")) { $("re-fxamount").value = String(amt); $("re-fxamount-v").textContent = (amt / 100).toFixed(2); }
      syncFxChips(); ping("button"); sync();
    });
    vibeHost.appendChild(b);
  });

  function randomize() {
    ping("button");
    const pals = ["outrun", "gameboy", "nes", "c64", "zx", "ega", "teletext", "pico8", "vboy", "amber", "mono1", "aurora", "auto"];
    $("re-palette").value = pals[Math.floor(Math.random() * pals.length)];
    syncYourPal();
    const setR = (id, v, vid, div) => { $(id).value = v; if (vid) $(vid).textContent = (v / (div || 1)).toFixed(div ? 2 : 0); };
    setR("re-tw", 60 + Math.floor(Math.random() * 240), "re-tw-v", 1);
    setR("re-curv", Math.floor(Math.random() * 40), "re-curv-v", 100);
    setR("re-bloom", Math.floor(Math.random() * 60), "re-bloom-v", 100);
    setR("re-vig", Math.floor(Math.random() * 50), "re-vig-v", 100);
    setR("re-dstr", 50 + Math.floor(Math.random() * 51), "re-dstr-v", 100);
    setR("re-maskamt", Math.floor(Math.random() * 55), "re-maskamt-v", 100);
    setR("re-hal", Math.floor(Math.random() * 45), "re-hal-v", 100);
    setR("re-abr", Math.floor(Math.random() * 35), "re-abr-v", 100);
    $("re-dither").value = ["bayer8", "bayer4", "bayer2", "noise", "diffusion", "none"][Math.floor(Math.random() * 6)];
    $("re-mask").value = ["grille", "slot", "dot", "none"][Math.floor(Math.random() * 4)];
    $("re-fxseed").value = rand();
    activeFx.clear();
    OP_META.forEach((m) => { if (Math.random() < 0.4) activeFx.add(m.op); });
    syncFxChips(); refreshSource();
    if (typeof retuneAudio === "function") retuneAudio();
  }

  // --- wiring -------------------------------------------------------------
  document.querySelectorAll(".re-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const leaving = state;
      state = tab.dataset.src;
      document.querySelectorAll(".re-tab").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      document.querySelectorAll(".re-srcpanel").forEach((p) => { p.hidden = p.dataset.panel !== state; });
      // Leaving the Scope releases a sounding figure: its only controls live
      // in the Scope panel, so it must never outlive the visit.
      if (leaving === "scope" && state !== "scope" && (beamFigure || beamDrawing)) {
        beamFigure = null; beamPath = []; beamDrawing = false; beamGen++;
        if (audio && audio.stopLoop) audio.stopLoop();
      }
      // Uploads default to the extracted palette, but a deliberate "yours"
      // is the user's choice and stays.
      if (state === "upload" && $("re-palette").value !== "auto" && $("re-palette").value !== "yours") $("re-palette").value = "auto";
      syncYourPal();
      // A new source starts with a clean feedback memory: the old source
      // must not ghost over the first seconds of the new one.
      if (leaving !== state) fbCanvas.width = 0;
      ping("bell"); refreshSource();
    });
  });
  // The tablist keeps its keyboard contract: arrows walk the tabs, Home and
  // End jump, and moving focus activates the source.
  const tablist = document.querySelector(".re-sources");
  if (tablist) tablist.addEventListener("keydown", (e) => {
    const tabs = [...tablist.querySelectorAll(".re-tab")];
    const cur = tabs.indexOf(document.activeElement);
    if (cur < 0) return;
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (cur + 1) % tabs.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (cur - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    tabs[next].focus(); tabs[next].click();
  });
  ["re-palette", "re-dither", "re-mask", "re-sdf"].forEach((id) => $(id).addEventListener("change", () => {
    if (id === "re-palette") syncYourPal();
    redraw(); ping(id === "re-sdf" ? "chip" : "preset", 0.5);
  }));
  // Boot the user palette: saved swatches, or the defaults in the markup.
  try {
    const saved = JSON.parse(localStorage.getItem(YOURPAL_KEY) || "null");
    if (Array.isArray(saved)) palInputs().forEach((i, k) => { if (saved[k]) i.value = saved[k]; });
  } catch (_) {}
  applyUserPalette(false);
  syncYourPal();
  palInputs().forEach((i) => i.addEventListener("input", () => {
    applyUserPalette(true); pingSlide("slider", 0.5);
    if ($("re-palette").value === "yours") redraw();
  }));
  [["re-tw", "re-tw-v", 1], ["re-curv", "re-curv-v", 100], ["re-bloom", "re-bloom-v", 100],
   ["re-vig", "re-vig-v", 100], ["re-scan", "re-scan-v", 100], ["re-gam", "re-gam-v", 100],
   ["re-dstr", "re-dstr-v", 100], ["re-maskamt", "re-maskamt-v", 100], ["re-hal", "re-hal-v", 100],
   ["re-abr", "re-abr-v", 100], ["re-fxamount", "re-fxamount-v", 100]]
    .forEach(([id, vid, div]) => $(id).addEventListener("input", () => {
      const el = $(id); $(vid).textContent = (+el.value / div).toFixed(div === 1 ? 0 : 2);
      pingSlide("slider", (el.value - el.min) / ((el.max - el.min) || 1)); redraw();
    }));

  // The master dial takes every effect back under its control.
  $("re-fxamount").addEventListener("input", () => { fxAmount.clear(); renderFxParams(); });
  // Live shader knobs: push straight into the running program, no recompile.
  [["re-knobA", "re-knobA-v"], ["re-knobB", "re-knobB-v"], ["re-knobC", "re-knobC-v"]].forEach(([id, vid]) => {
    $(id).addEventListener("input", () => {
      $(vid).textContent = (+$(id).value / 100).toFixed(2);
      pushKnobs(); pingSlide("slider", +$(id).value / 100);
      if (!animRaf) { renderShaderFrame(performance.now() / 1000); retroPass(0); }
    });
  });

  $("re-seed").addEventListener("input", () => { pingSlide("slider", 0.4); renderPlate(); });
  $("re-layers").addEventListener("change", () => { ping("preset"); renderPlate(); });
  $("re-reseed").addEventListener("click", () => { $("re-seed").value = rand(); ping("button"); renderPlate(); });
  $("re-file").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => { uploaded = img; URL.revokeObjectURL(img.src); ping("bell"); renderUpload(); };
    img.onerror = () => status("could not read that image", "err");
    img.src = URL.createObjectURL(f);
  });
  $("re-run").addEventListener("click", () => { ping("button"); if (runShader()) sync(); });
  // --- your own saved shaders (kept in this browser) ----------------------
  const MINE_KEY = "re.myshaders.v1";
  const loadMine = () => { try { return JSON.parse(localStorage.getItem(MINE_KEY) || "[]"); } catch (_) { return []; } };
  const saveMine = (arr) => { try { localStorage.setItem(MINE_KEY, JSON.stringify(arr)); } catch (_) {} };
  let mine = loadMine();

  const presetSel = $("re-preset");
  function buildYoursGroup() {
    if (!presetSel) return;
    const old = presetSel.querySelector('optgroup[data-yours="1"]');
    if (old) old.remove();
    if (!mine.length) return;
    const g = document.createElement("optgroup"); g.label = "Yours (saved)"; g.setAttribute("data-yours", "1");
    mine.forEach((m, i) => { const o = document.createElement("option"); o.value = "mine:" + i; o.textContent = m.name; g.appendChild(o); });
    presetSel.insertBefore(g, presetSel.children[1] || null); // after the "— custom —" option
  }
  function resolveGlsl(val) {
    if (val && val.indexOf("mine:") === 0) { const m = mine[+val.slice(5)]; return m ? m.glsl : null; }
    const p = SHADER_PRESETS[+val]; return p ? p.glsl : null;
  }
  // Some pieces are drawn in fine line work (a twin helix, vector line art, a
  // pencil hatch). The default pixel grid averages those strokes into the
  // ground, so a preset can ask for a finer grid and get one on load.
  function honourFineGrid(preset) {
    if (!preset || !preset.fine) return;
    const tw = $("re-tw");
    if (+tw.value < 300) { tw.value = "300"; tw.dispatchEvent(new Event("input")); }
  }

  // Every one of the 254 presets ships a plain-language line naming what its
  // three knobs do ("A=tessera size B=grout width C=glint sharpness"). The page
  // used to show a static developer note instead, so three of the strongest
  // controls on the surface were unlabelled. Parse the line and name the dials.
  function nameKnobs(preset) {
    const fallback = { A: "A", B: "B", C: "C", note: "iKnobA / B / C in your code" };
    const raw = preset && typeof preset.knobs === "string" ? preset.knobs : "";
    const found = { ...fallback };
    if (raw) {
      // "A=tessera size B=grout width C=glint sharpness  (cursor = the lamp)"
      // Parsed by slicing between the A=/B=/C= markers rather than by one regex:
      // the values themselves can contain spaces and an equals sign.
      const note = raw.indexOf("(");
      const body = note >= 0 ? raw.slice(0, note) : raw;
      if (note >= 0) {
        const close = raw.indexOf(")", note);
        found.note = raw.slice(note + 1, close < 0 ? undefined : close).trim();
      } else {
        found.note = "";
      }
      const marks = [];
      for (const k of ["A", "B", "C"]) {
        const at = body.indexOf(k + "=");
        if (at >= 0) marks.push({ k, at });
      }
      marks.sort((x, y) => x.at - y.at);
      marks.forEach((mk, i) => {
        const from = mk.at + 2;
        const to = i + 1 < marks.length ? marks[i + 1].at : body.length;
        const val = body.slice(from, to).trim();
        if (val) found[mk.k] = val;
      });
    }
    for (const k of ["A", "B", "C"]) {
      const lab = document.querySelector("#re-knob" + k + "-v");
      if (!lab || !lab.parentElement) continue;
      const first = lab.parentElement.firstChild;
      if (first && first.nodeType === 3) first.nodeValue = found[k] + " ";
      const slider = $("re-knob" + k);
      if (slider) slider.setAttribute("aria-label", "Shader knob " + k + ": " + found[k]);
    }
    const help = $("re-knob-help");
    if (help) help.textContent = found.note;
  }


  function loadShader(glsl, preset) {
    if (glsl == null) return;
    honourFineGrid(preset);
    try { nameKnobs(preset); } catch (_) {}
    $("re-code").value = glsl;
    if (state !== "shader") document.querySelector('.re-tab[data-src="shader"]').click();
    else if (runShader()) sync();
  }
  if (presetSel) {
    // Group presets into optgroups by era so the generations read as shelves
    // you can mix across. The filter matches a preset's name OR its shelf, so
    // "eva", "psx" or "audio" narrows a long library to what you meant.
    function rebuildPresets(q) {
      const term = (q || "").trim().toLowerCase();
      [...presetSel.querySelectorAll("optgroup:not([data-yours])")].forEach((g) => g.remove());
      const groups = new Map();
      SHADER_PRESETS.forEach((p, i) => {
        const key = p.group || "Library";
        if (term && (p.name + " " + key).toLowerCase().indexOf(term) < 0) return;
        let g = groups.get(key);
        if (!g) { g = document.createElement("optgroup"); g.label = key; groups.set(key, g); presetSel.appendChild(g); }
        const o = document.createElement("option"); o.value = String(i); o.textContent = p.name; g.appendChild(o);
      });
      const cnt = $("re-preset-count");
      if (cnt) {
        const n = presetSel.querySelectorAll("optgroup:not([data-yours]) option").length;
        cnt.textContent = term ? n + " of " + SHADER_PRESETS.length + " match" : SHADER_PRESETS.length + " on the shelf";
      }
    }
    rebuildPresets("");
    const filt = $("re-preset-filter");
    if (filt) filt.addEventListener("input", () => rebuildPresets(filt.value));
    buildYoursGroup();
    presetSel.addEventListener("change", () => {
      ping("bell");
      const v = presetSel.value;
      const preset = (v && v.indexOf("mine:") !== 0) ? SHADER_PRESETS[+v] : null;
      loadShader(resolveGlsl(v), preset);
    });
    // ── the contact sheet ────────────────────────────────────────────────────
    // 254 shaders behind a dropdown can only be browsed one load at a time. The
    // sheet renders each preset as a single still frame into a small canvas,
    // lazily via IntersectionObserver, through ONE shared runner and one shared
    // offscreen GL canvas: 254 live contexts would exhaust the browser's WebGL
    // limit long before the sheet finished.
    (function buildContactSheet() {
      const host = $("re-sheet"), toggle = $("re-sheet-toggle");
      if (!host || !toggle) return;
      let built = false, shared = null, io = null;

      function thumbRunner() {
        if (shared) return shared;
        const c = document.createElement("canvas");
        c.width = 168; c.height = 168;
        const r = createShaderRunner(c, DEFAULT_FRAG);
        shared = r.ok ? r : null;
        return shared;
      }

      function paint(cell, preset) {
        const r = thumbRunner();
        const cv = cell.querySelector("canvas");
        if (!r || !cv) return;
        const res = r.setSource(preset.glsl);
        if (!res || !res.ok) { cell.dataset.failed = "true"; return; }
        // a frozen instant well past zero: most pieces are dull at t=0
        r.renderFrame(6.5);
        const ctx = cv.getContext("2d");
        if (ctx) { try { ctx.drawImage(r.canvas, 0, 0, cv.width, cv.height); } catch (_) {} }
      }

      function build() {
        if (built) return;
        built = true;
        io = ("IntersectionObserver" in window) ? new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const cell = e.target;
            io.unobserve(cell);
            if (cell.dataset.painted === "true") continue;
            cell.dataset.painted = "true";
            const idx = +cell.dataset.idx;
            const preset = SHADER_PRESETS[idx];
            if (preset) requestAnimationFrame(() => paint(cell, preset));
          }
        }, { root: host, rootMargin: "120px" }) : null;

        SHADER_PRESETS.forEach((preset, i) => {
          const cell = document.createElement("button");
          cell.type = "button";
          cell.dataset.idx = String(i);
          cell.setAttribute("aria-pressed", "false");
          cell.title = preset.name;
          cell.setAttribute("aria-label", "Load shader " + preset.name);
          const cv = document.createElement("canvas");
          cv.width = 84; cv.height = 84;
          const nm = document.createElement("span");
          nm.className = "sh-name";
          nm.textContent = preset.name;
          cell.append(cv, nm);
          cell.addEventListener("click", () => {
            presetSel.value = String(i);
            presetSel.dispatchEvent(new Event("change"));
            [...host.children].forEach((c) => c.setAttribute("aria-pressed", String(c === cell)));
          });
          host.appendChild(cell);
          if (io) io.observe(cell); else { cell.dataset.painted = "true"; paint(cell, preset); }
        });
      }

      toggle.addEventListener("click", () => {
        const open = host.hidden;
        host.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        if (open) build();
      });
    })();

    $("re-code").addEventListener("input", () => { presetSel.value = ""; });

    // Browse the shelf without hunting the dropdown: previous, next, or a jump.
    const pickable = () => [...presetSel.querySelectorAll("option")].filter((o) => o.value !== "");
    function step(dir) {
      const opts = pickable(); if (!opts.length) return;
      const cur = opts.findIndex((o) => o.value === presetSel.value);
      const next = opts[((cur < 0 ? (dir > 0 ? -1 : 0) : cur) + dir + opts.length * 2) % opts.length];
      presetSel.value = next.value; presetSel.dispatchEvent(new Event("change"));
      status(next.textContent, "ok");
    }
    $("re-prev").addEventListener("click", () => step(-1));
    $("re-next").addEventListener("click", () => step(1));
    $("re-lucky").addEventListener("click", () => {
      const opts = pickable(); if (!opts.length) return;
      const pick = opts[Math.floor(Math.random() * opts.length)];
      presetSel.value = pick.value; presetSel.dispatchEvent(new Event("change"));
      status("surprise: " + pick.textContent, "ok");
    });
  }

  // Save the current editor shader to the browser shelf (name = first comment
  // line, else "Yours N"); dedupe identical code.
  $("re-save-shader").addEventListener("click", () => {
    const glsl = ($("re-code").value || "").trim();
    if (!glsl) { status("write a shader first", ""); return; }
    if (mine.some((m) => m.glsl.trim() === glsl)) { status("already saved to yours", "ok"); return; }
    const first = (glsl.split("\n")[0] || "").replace(/^\s*\/\/\s?/, "").trim();
    const name = (first && first.length <= 32 ? first : "Yours " + (mine.length + 1)).slice(0, 40);
    mine.push({ name, glsl }); saveMine(mine); buildYoursGroup();
    if (presetSel) presetSel.value = "mine:" + (mine.length - 1);
    ping("preset"); status("saved to yours: " + name, "ok");
  });

  // Copy a link that carries the whole shader in the URL hash.
  const encodeShader = (glsl) => { try { return btoa(unescape(encodeURIComponent(glsl))); } catch (_) { return ""; } };
  const decodeShader = (b) => { try { return decodeURIComponent(escape(atob(b))); } catch (_) { return null; } };
  $("re-share").addEventListener("click", async () => {
    const glsl = ($("re-code").value || "").trim();
    if (!glsl) { status("write a shader first", ""); return; }
    const url = location.origin + location.pathname + "#s=" + encodeShader(glsl);
    history.replaceState(null, "", url);
    ping("preset");
    try { await navigator.clipboard.writeText(url); status("link copied to clipboard", "ok"); }
    catch (_) { status("link is in the address bar", "ok"); }
  });
  // --- patches: the whole setup, saved or shared as one link --------------
  const PATCH_KEY = "re.patches.v1";
  const loadPatches = () => { try { return JSON.parse(localStorage.getItem(PATCH_KEY) || "[]"); } catch (_) { return []; } };
  let patches = loadPatches();

  function collectPatch() {
    const amts = {}; fxAmount.forEach((v, k) => { amts[k] = v; });
    return {
      v: 1, src: state, glsl: $("re-code").value,
      pal: $("re-palette").value, tw: +$("re-tw").value, dith: $("re-dither").value,
      gam: +$("re-gam").value, sdf: $("re-sdf").checked, curv: +$("re-curv").value,
      bloom: +$("re-bloom").value, vig: +$("re-vig").value, scan: +$("re-scan").value,
      dstr: +$("re-dstr").value, mask: $("re-mask").value, maskA: +$("re-maskamt").value,
      hal: +$("re-hal").value, abr: +$("re-abr").value,
      fx: [...activeFx], amts, master: +$("re-fxamount").value,
      fxseed: $("re-fxseed").value, fxanim: $("re-fxanim").checked,
      knobs: [+$("re-knobA").value, +$("re-knobB").value, +$("re-knobC").value],
      react: [...reactOn], reactAmt: +$("re-react").value,
      seed: $("re-seed").value, plate: $("re-layers").value,
      layers: extraLayers.map((L) => ({ name: L.name, glsl: L.glsl, blend: L.blend, opacity: L.opacity })),
      userPal: $("re-palette").value === "yours" ? palInputs().map((i) => i.value) : undefined,
      mod: modRoutes.map((r) => ({ src: r.src, tgt: r.tgt, depth: r.depth })),
      fb: { on: fbOn(), amt: +$("re-fb-amt").value, zoom: +$("re-fb-zoom").value, rot: +$("re-fb-rot").value },
    };
  }

  function applyPatch(p) {
    if (!p || typeof p !== "object") return;
    const setV = (id, v, vid, div) => { if (v == null || !$(id)) return; $(id).value = String(v); if (vid && $(vid)) $(vid).textContent = div ? (v / div).toFixed(2) : String(v); };
    if (Array.isArray(p.userPal)) {
      // A shared patch shows its author's colors for this session; it never
      // overwrites the palette the visitor saved for themselves.
      palInputs().forEach((i, k) => { if (p.userPal[k]) i.value = p.userPal[k]; });
      applyUserPalette(false);
    }
    setV("re-palette", p.pal); setV("re-dither", p.dith);
    syncYourPal();
    setV("re-tw", p.tw, "re-tw-v"); setV("re-gam", p.gam, "re-gam-v", 100);
    setV("re-curv", p.curv, "re-curv-v", 100); setV("re-bloom", p.bloom, "re-bloom-v", 100);
    setV("re-vig", p.vig, "re-vig-v", 100); setV("re-scan", p.scan, "re-scan-v", 100);
    setV("re-dstr", p.dstr, "re-dstr-v", 100); setV("re-mask", p.mask);
    setV("re-maskamt", p.maskA, "re-maskamt-v", 100); setV("re-hal", p.hal, "re-hal-v", 100);
    setV("re-abr", p.abr, "re-abr-v", 100);
    if (p.sdf != null) $("re-sdf").checked = !!p.sdf;
    setV("re-fxamount", p.master, "re-fxamount-v", 100);
    setV("re-react", p.reactAmt, "re-react-v", 100);
    if (p.knobs) { setV("re-knobA", p.knobs[0], "re-knobA-v", 100); setV("re-knobB", p.knobs[1], "re-knobB-v", 100); setV("re-knobC", p.knobs[2], "re-knobC-v", 100); }
    if (p.fxseed != null) $("re-fxseed").value = p.fxseed;
    if (p.fxanim != null) $("re-fxanim").checked = !!p.fxanim;
    if (p.seed != null) $("re-seed").value = p.seed;
    if (p.plate != null) $("re-layers").value = p.plate;
    activeFx.clear(); (p.fx || []).forEach((o) => activeFx.add(o));
    fxAmount.clear(); if (p.amts) for (const k in p.amts) fxAmount.set(k, p.amts[k]);
    reactOn.clear(); (p.react || ["shader"]).forEach((k) => reactOn.add(k));
    document.querySelectorAll("#re-react-targets .re-chip").forEach((b) => b.setAttribute("aria-pressed", String(reactOn.has(b.dataset.react))));
    // rebuild the shader stack
    extraLayers.splice(0).forEach((L) => { try { L.runner && L.runner.destroy && L.runner.destroy(); } catch (_) {} });
    for (const L of (p.layers || [])) {
      const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 640;
      const r = createShaderRunner(cv, L.glsl);
      if (r.ok) extraLayers.push({ canvas: cv, runner: r, glsl: L.glsl, name: L.name || "layer", blend: L.blend || "lighter", opacity: L.opacity == null ? 0.7 : L.opacity });
    }
    rebuildStackUI(); stackCount();
    modRoutes = Array.isArray(p.mod)
      ? p.mod.filter((r) => r && r.src && r.tgt).map((r) => ({ src: r.src, tgt: r.tgt, depth: Math.max(-1, Math.min(1, +r.depth || 0)) })).slice(0, 12)
      : [];
    renderModRows();
    if (p.fb) {
      if ($("re-fb")) $("re-fb").checked = !!p.fb.on;
      fbCanvas.width = 0;
      if (p.fb.amt != null && $("re-fb-amt")) { $("re-fb-amt").value = String(p.fb.amt); $("re-fb-amt-v").textContent = String(p.fb.amt); }
      if (p.fb.zoom != null && $("re-fb-zoom")) { $("re-fb-zoom").value = String(p.fb.zoom); $("re-fb-zoom-v").textContent = (p.fb.zoom / 10).toFixed(1); }
      if (p.fb.rot != null && $("re-fb-rot")) { $("re-fb-rot").value = String(p.fb.rot); $("re-fb-rot-v").textContent = (p.fb.rot / 10).toFixed(1); }
    }
    if (p.glsl) $("re-code").value = p.glsl;
    syncFxChips();
    const tab = document.querySelector('.re-tab[data-src="' + (p.src || "shader") + '"]');
    if (tab) tab.click(); else refreshSource();
    // The upload tab's auto-palette convenience must not undo the patch's
    // own palette choice.
    if (p.pal != null && $("re-palette").value !== p.pal) { $("re-palette").value = p.pal; redraw(); }
    syncYourPal();
    pushKnobs();
  }

  function refreshPatchList() {
    const sel = $("re-patches"); if (!sel) return;
    sel.textContent = "";
    const o0 = document.createElement("option"); o0.value = ""; o0.textContent = patches.length ? "your patches (" + patches.length + ")" : "your patches"; sel.appendChild(o0);
    patches.forEach((p, i) => { const o = document.createElement("option"); o.value = String(i); o.textContent = p.name; sel.appendChild(o); });
  }
  refreshPatchList();
  $("re-patches").addEventListener("change", () => {
    const i = +$("re-patches").value; const p = patches[i];
    if (!p) return;
    applyPatch(p.patch); ping("bell"); status("loaded patch: " + p.name, "ok");
  });
  $("re-save-patch").addEventListener("click", () => {
    const name = "patch " + (patches.length + 1) + " · " + $("re-palette").value;
    patches.push({ name, patch: collectPatch() });
    try { localStorage.setItem(PATCH_KEY, JSON.stringify(patches)); } catch (_) { status("could not save (storage full)", "err"); return; }
    refreshPatchList(); ping("preset"); status("saved " + name, "ok");
  });
  $("re-share-patch").addEventListener("click", async () => {
    const enc = encodeShader(JSON.stringify(collectPatch()));
    const url = location.origin + location.pathname + "#p=" + enc;
    history.replaceState(null, "", url);
    ping("preset");
    try { await navigator.clipboard.writeText(url); status("patch link copied", "ok"); }
    catch (_) { status("patch link is in the address bar", "ok"); }
  });

  $("re-animate").addEventListener("change", () => { ping("chip", 0.3); sync(); });
  $("re-fxseed").addEventListener("input", () => { pingSlide("slider", 0.6); redraw(); });
  $("re-fxanim").addEventListener("change", () => { ping("chip", 0.7); sync(); });
  $("re-randomize").addEventListener("click", randomize);

  // ── the session: autosave, undo, and a way out ───────────────────────────
  // A refresh used to drop everything back to the default patch, and there was
  // no way to take back a Randomize. The patch is already a complete snapshot
  // (collectPatch/applyPatch), so both are a matter of keeping copies of it.
  const SESSION_KEY = "re.session.v1";
  const HISTORY_MAX = 20;
  const undoHistory = [];
  let histAt = -1;              // where we are in the ring while undoing
  let restoring = false;        // suppress recording while applyPatch runs
  let saveTimer = 0;

  function sessionSnapshot(reason) {
    if (restoring) return;
    let patch;
    try { patch = collectPatch(); } catch (_) { return; }
    const json = JSON.stringify(patch);
    // ignore no-op changes: a slider fires many events for one gesture
    if (undoHistory.length && undoHistory[undoHistory.length - 1].json === json) return;
    // a new change after undoing truncates the redo tail, as in any editor
    if (histAt >= 0 && histAt < undoHistory.length - 1) undoHistory.length = histAt + 1;
    undoHistory.push({ json, reason: reason || "" });
    while (undoHistory.length > HISTORY_MAX) undoHistory.shift();
    histAt = undoHistory.length - 1;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(SESSION_KEY, json); } catch (_) {}
    }, 600);
    const u = document.getElementById("re-undo");
    if (u) u.disabled = undoHistory.length < 2;
  }

  function undoStep() {
    if (histAt <= 0) { status("nothing further to undo", "err"); return; }
    histAt -= 1;
    const entry = undoHistory[histAt];
    try {
      restoring = true;
      applyPatch(JSON.parse(entry.json));
      status("stepped back" + (entry.reason ? " past " + entry.reason : ""), "ok");
    } catch (e) { status("could not undo: " + e.message, "err"); }
    finally { restoring = false; }
    try { localStorage.setItem(SESSION_KEY, entry.json); } catch (_) {}
    const u = document.getElementById("re-undo");
    if (u) u.disabled = histAt <= 0;
  }

  // Snapshot on any settled control change. Hooking sync() alone missed most of
  // the panel, because plenty of controls call redraw() instead; listening to
  // the panel itself catches every one of them, and the debounce plus the
  // identical-JSON guard keep one gesture to one entry.
  (function watchPanel() {
    const panel = document.querySelector(".re-panel");
    if (!panel) return;
    let t = 0;
    const bump = (ev) => {
      const el = ev.target;
      if (!el || el.id === "re-undo" || el.id === "re-fresh") return;
      clearTimeout(t);
      t = setTimeout(() => { try { sessionSnapshot(); } catch (_) {} }, 420);
    };
    panel.addEventListener("change", bump, true);
    panel.addEventListener("input", bump, true);
    panel.addEventListener("click", (ev) => {
      if (ev.target && ev.target.closest(".re-chip, .re-btn, .re-vibe")) bump(ev);
    }, true);
  })();

  const undoBtn = document.getElementById("re-undo");
  if (undoBtn) { undoBtn.disabled = true; undoBtn.addEventListener("click", undoStep); }
  const freshBtn = document.getElementById("re-fresh");
  if (freshBtn) freshBtn.addEventListener("click", () => {
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
    undoHistory.length = 0; histAt = -1;
    if (undoBtn) undoBtn.disabled = true;
    location.href = location.origin + location.pathname;
  });

  // Pixel-exact export. Save PNG writes the upscaled canvas, so the grid the
  // whole engine is about could never leave at its true resolution. This writes
  // one image pixel per cell, nearest-neighbour, no CRT stage.
  const save1x = document.getElementById("re-save-1x");
  if (save1x) save1x.addEventListener("click", () => {
    const src = sourceCanvas();
    if (!src || !src.width) { status("nothing to export yet", "err"); return; }
    try {
      const o = opts();
      const one = document.createElement("canvas");
      renderRetro(src, one, Object.assign({}, o, {
        upscale: 1, scanlines: false, bloom: 0, curvature: 0, vignette: 0,
        halation: 0, aberration: 0, mask: "none",
      }));
      if (activeFx.size) applyOps(one, buildFx(0));
      ping("preset");
      const a = document.createElement("a");
      a.download = "retro-" + $("re-palette").value + "-1x-" + one.width + "x" + one.height + ".png";
      a.href = one.toDataURL("image/png");
      a.click();
      status("saved " + one.width + "\u00d7" + one.height + ", one pixel per cell", "ok");
    } catch (e) { status("1x export failed: " + e.message, "err"); }
  });

  $("re-save").addEventListener("click", () => { ping("preset"); const a = document.createElement("a"); a.download = "retro-" + $("re-palette").value + ".png"; a.href = out.toDataURL("image/png"); a.click(); });

  // What this piece is right now, for the trail it carries onward.
  function pieceLabel() {
    let what = state;
    if (state === "shader") {
      const sel = $("re-preset");
      what = sel && sel.selectedIndex > 0 ? sel.options[sel.selectedIndex].text : "custom shader";
      if (extraLayers.length) what += " +" + extraLayers.length;
    }
    return what + ", " + $("re-palette").value;
  }

  // Hand the current render onward through the workbench: the legacy key the
  // receiver reads plus the trail the piece carries.
  $("re-send-studio").addEventListener("click", () => {
    if (!sendPiece("studio", out.toDataURL("image/png"), { surface: "retro", label: pieceLabel() })) {
      status("render too large to hand off", "err"); return;
    }
    ping("bell"); status("opening the Studio…", "ok");
  });
  const sendLoom = $("re-send-loom");
  if (sendLoom) sendLoom.addEventListener("click", () => {
    if (!sendPiece("loom", out.toDataURL("image/png"), { surface: "retro", label: pieceLabel() })) {
      status("render too large to hand off", "err"); return;
    }
    ping("bell"); status("opening the Loom…", "ok");
  });

  // --- make it physical: the render leaves the screen -----------------------
  const saveBlob = (name, blob) => {
    const a = document.createElement("a"); a.download = name;
    a.href = URL.createObjectURL(blob); a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  // Relief STL: the frame's luminance as touchable depth. Bright prints thin,
  // so held to a light the print IS the picture (lithophane practice).
  const reliefBtn = $("re-relief");
  if (reliefBtn) reliefBtn.addEventListener("click", async () => {
    ping("bell"); status("building the relief…", "");
    try {
      const m = await import("./relief-stl.js?v=20260811-crossings");
      const gw = 180, gh = Math.max(24, Math.round(gw * out.height / out.width));
      const g = document.createElement("canvas"); g.width = gw; g.height = gh;
      const ctx = g.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(out, 0, 0, gw, gh);
      const px = ctx.getImageData(0, 0, gw, gh).data;
      const heights = new Float32Array(gw * gh);
      for (let i = 0; i < gw * gh; i++) {
        const o = i * 4;
        heights[i] = (px[o] * 0.299 + px[o + 1] * 0.587 + px[o + 2] * 0.114) / 255;
      }
      const buf = m.heightmapToSTL(heights, gw, gh, { widthMM: 100, invert: true });
      saveBlob("retro-relief.stl", new Blob([buf], { type: "application/octet-stream" }));
      status("relief saved: print it and hold it to a light", "ok");
    } catch (e) { status("relief failed: " + e.message, "err"); }
  });

  // Twelve frames of the animation around one loop, shared by the disc and
  // the strip. Capturing walks the real pipeline at each phase.
  function captureFrames(N, loopSec) {
    const frames = [];
    for (let k = 0; k < N; k++) {
      const tk = (k / N) * loopSec;
      modPass(tk);
      if (state === "shader") renderShaderFrame(tk);
      if (state === "scope" && scopeMod) renderScopeFrame(tk);
      retroPass(tk);
      const f = document.createElement("canvas"); f.width = out.width; f.height = out.height;
      f.getContext("2d").drawImage(out, 0, 0);
      frames.push(f);
    }
    redraw();
    return frames;
  }

  // Phenakistoscope disc: printed, cut, pinned, and spun in front of a
  // mirror. The strip is its zoetrope sibling: rolled into a drum instead.
  const spinBtn = $("re-spin");
  if (spinBtn) spinBtn.addEventListener("click", async () => {
    ping("bell"); status("catching twelve frames…", "");
    try {
      const m = await import("./zoetrope-compose.js?v=20260812-cohesion");
      const disc = document.createElement("canvas");
      m.composeDisc(disc, captureFrames(12, 2.4), { diameterPx: 2400, label: "zentropyLabs retro engine" });
      saveBlob("retro-spin-disc.png", await new Promise((r) => disc.toBlob(r, "image/png")));
      status(loopActive() ? "disc saved: print, cut, pin, spin at a mirror" : "disc saved: a still source spins into a still image", "ok");
    } catch (e) { status("disc failed: " + e.message, "err"); }
  });
  const stripBtn = $("re-strip");
  if (stripBtn) stripBtn.addEventListener("click", async () => {
    ping("bell"); status("catching twelve frames…", "");
    try {
      const m = await import("./zoetrope-compose.js?v=20260812-cohesion");
      const strip = document.createElement("canvas");
      m.composeStrip(strip, captureFrames(12, 2.4), { widthPx: 3300 });
      saveBlob("retro-zoetrope-strip.png", await new Promise((r) => strip.toBlob(r, "image/png")));
      status("strip saved: roll it into a drum, tape the tab, spin", "ok");
    } catch (e) { status("strip failed: " + e.message, "err"); }
  });

  const persistSlider = $("re-scope-persist");
  if (persistSlider) persistSlider.addEventListener("input", () => {
    $("re-scope-persist-v").textContent = persistSlider.value;
    pingSlide("slider", persistSlider.value / 100);
  });

  // --- the performance score: the playing itself becomes a medium -----------
  // While armed, every physical edit (each ping) is captured with its offset
  // and the audio bands are sampled as a contour; the record replays as sound
  // and exports as a standard MIDI file any DAW opens. Playback pings the
  // audio directly, not through the wrapped ping, so it cannot re-record.
  const REC = { on: false, t0: 0, events: [], bands: [], lastBand: 0, timers: [] };
  function recEvent(k, v) {
    if (!REC.on || REC.events.length >= 4000) return;
    REC.events.push([performance.now() - REC.t0, k, v === undefined ? 0.6 : v]);
  }
  const PENTA = [0, 3, 5, 7, 10];
  const KIND_STEP = { chip: 0, slider: 1, preset: 2, tab: 3, bell: 4 };
  const recNote = (k, v) => {
    const base = 57 + PENTA[(KIND_STEP[k] !== undefined ? KIND_STEP[k] : 2) % 5];
    return Math.max(24, Math.min(96, base + Math.round((v || 0) * 12)));
  };
  const recBtn = $("re-rec");
  if (recBtn) recBtn.addEventListener("click", () => {
    REC.on = !REC.on;
    recBtn.setAttribute("aria-pressed", String(REC.on));
    if (REC.on) {
      REC.t0 = performance.now(); REC.events = []; REC.bands = [];
      status("recording: every edit is a note, sound on or off", "ok");
    } else {
      const secs = REC.events.length ? (REC.events[REC.events.length - 1][0] / 1000).toFixed(1) : "0";
      status("recorded " + REC.events.length + " gestures across " + secs + "s", "ok");
    }
  });
  const recPlay = $("re-rec-play");
  if (recPlay) recPlay.addEventListener("click", async () => {
    if (!REC.events.length) { status("nothing recorded yet: press Record and play the panel", ""); return; }
    try { await ensureAudio(); if (!audio.isOn()) await audio.start(audioSeed()); } catch (_) { status("sound needs a click to start", "err"); return; }
    REC.timers.forEach(clearTimeout); REC.timers = [];
    for (const [t, k, v] of REC.events) REC.timers.push(setTimeout(() => { try { audio.ping(k, v); } catch (_) {} }, t));
    status("playing the performance back: " + REC.events.length + " gestures", "ok");
  });
  const recMidi = $("re-rec-midi");
  if (recMidi) recMidi.addEventListener("click", async () => {
    if (!REC.events.length) { status("nothing recorded yet: press Record and play the panel", ""); return; }
    try {
      const m = await import("./midi-writer.js?v=20260811-crossings");
      const TPQ = 480, BPM = 96, tick = (ms) => Math.round((ms * TPQ * BPM) / 60000);
      const ev = [];
      for (const [t, k, v] of REC.events) {
        const n = recNote(k, v);
        ev.push({ tick: tick(t), type: "on", ch: 0, a: n, b: Math.min(127, 48 + Math.round((v || 0.5) * 70)) });
        ev.push({ tick: tick(t) + 240, type: "off", ch: 0, a: n, b: 0 });
      }
      for (const [t, bass, mid, treb] of REC.bands) {
        ev.push({ tick: tick(t), type: "cc", ch: 0, a: 1, b: Math.min(127, Math.round(((bass + mid + treb) / 3) * 127)) });
      }
      const bytes = m.writeMIDI({ ticksPerQuarter: TPQ, tempoBPM: BPM, events: ev });
      saveBlob("retro-performance.mid", new Blob([bytes], { type: "audio/midi" }));
      ping("bell"); status("performance saved as MIDI: " + REC.events.length + " notes", "ok");
    } catch (e) { status("MIDI failed: " + e.message, "err"); }
  });

  // --- the ANS voice: the picture itself is the score -----------------------
  // Rows are frequencies folded onto the instrument's scale, the scan is
  // time, brightness is loudness. Playing routes through the analysis tap,
  // so switching to the Scope while it plays draws the picture's own sound.
  const playPic = $("re-play-pic");
  let picRun = null, picTimer = 0, picBusy = false;
  if (playPic) playPic.addEventListener("click", async () => {
    if (picBusy) return;
    if (picRun) {
      clearTimeout(picTimer);
      picRun.stop(); picRun = null;
      playPic.setAttribute("aria-pressed", "false"); status("scan stopped", "");
      return;
    }
    picBusy = true;
    try {
      await ensureAudio();
      const m = await import("./ans-voice.js?v=20260812-cohesion");
      const scan = m.scanImage(out, 40, 96);
      const freqs = m.rowFrequencies(scan.rows, { mode: "penta" });
      picRun = await audio.playScan(scan, freqs, 9);
    } catch (_) { status("could not play the picture", "err"); picBusy = false; return; }
    picBusy = false;
    playPic.setAttribute("aria-pressed", "true");
    status("playing the picture: rows are pitches, the scan is time", "ok");
    clearTimeout(picTimer);
    picTimer = setTimeout(() => { picRun = null; playPic.setAttribute("aria-pressed", "false"); }, 9700);
  });
  const picMidi = $("re-pic-midi");
  if (picMidi) picMidi.addEventListener("click", async () => {
    try {
      const a = await import("./ans-voice.js?v=20260812-cohesion");
      const w = await import("./midi-writer.js?v=20260811-crossings");
      const scan = a.scanImage(out, 40, 96);
      const freqs = a.rowFrequencies(scan.rows, { mode: "penta" });
      const ev = a.scanToMIDI(scan, freqs, {});
      if (!ev.length) { status("the picture is too dark to transcribe: brighten it first", ""); return; }
      const bytes = w.writeMIDI({ ticksPerQuarter: 480, tempoBPM: 96, events: ev });
      saveBlob("retro-picture.mid", new Blob([bytes], { type: "audio/midi" }));
      ping("bell"); status("picture transcribed: " + ev.filter((e) => e.type === "on").length + " notes", "ok");
    } catch (e) { status("transcription failed: " + e.message, "err"); }
  });

  // --- shader stack: composite extra shader layers with blend modes ---------
  function stackCount() { const el = $("re-stack-count"); if (el) el.textContent = (extraLayers.length + 1) + (extraLayers.length ? " layers" : " layer"); }
  function addLayer(idx) {
    const p = SHADER_PRESETS[idx]; if (!p) return;
    if (extraLayers.length >= MAX_LAYERS) { status("stack is full (" + (MAX_LAYERS + 1) + " shaders max)", ""); return; }
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 640;
    const r = createShaderRunner(cv, p.glsl);
    if (!r.ok) { status("layer shader error: " + r.error, "err"); return; }
    extraLayers.push({ canvas: cv, runner: r, glsl: p.glsl, name: p.name, blend: "lighter", opacity: 0.7 });
    ping("button"); rebuildStackUI(); stackCount(); if (state !== "shader") document.querySelector('.re-tab[data-src="shader"]').click(); else sync();
  }
  function removeLayer(i) {
    const L = extraLayers[i]; if (!L) return;
    try { L.runner && L.runner.destroy && L.runner.destroy(); } catch (_) {}
    extraLayers.splice(i, 1); ping("click"); rebuildStackUI(); stackCount(); sync();
  }
  function rebuildStackUI() {
    const host = $("re-slayers"); if (!host) return;
    host.textContent = "";
    extraLayers.forEach((L, i) => {
      const row = document.createElement("div"); row.className = "re-layerrow";
      const nm = document.createElement("span"); nm.className = "re-layername"; nm.textContent = L.name; nm.title = L.name; row.appendChild(nm);
      const bl = document.createElement("select"); bl.className = "re-in re-blend";
      BLENDS.forEach(([v, lab]) => { const o = document.createElement("option"); o.value = v; o.textContent = lab; if (v === L.blend) o.selected = true; bl.appendChild(o); });
      bl.addEventListener("change", () => { L.blend = bl.value; ping("preset"); redraw(); });
      row.appendChild(bl);
      const op = document.createElement("input"); op.type = "range"; op.min = "0"; op.max = "100"; op.value = String(Math.round(L.opacity * 100)); op.className = "re-op"; op.title = "layer opacity";
      op.addEventListener("input", () => { L.opacity = +op.value / 100; pingSlide("slider", L.opacity); redraw(); });
      row.appendChild(op);
      const rm = document.createElement("button"); rm.type = "button"; rm.className = "re-chip re-rm"; rm.textContent = "×"; rm.setAttribute("aria-label", "remove layer");
      rm.addEventListener("click", () => removeLayer(i));
      row.appendChild(rm);
      host.appendChild(row);
    });
  }
  const slayerAdd = $("re-slayer-add");
  if (slayerAdd) {
    const g2 = new Map();
    SHADER_PRESETS.forEach((p, i) => {
      const key = p.group || "Library"; let grp = g2.get(key);
      if (!grp) { grp = document.createElement("optgroup"); grp.label = key; g2.set(key, grp); slayerAdd.appendChild(grp); }
      const o = document.createElement("option"); o.value = String(i); o.textContent = p.name; grp.appendChild(o);
    });
    slayerAdd.addEventListener("change", () => { const v = slayerAdd.value; slayerAdd.value = ""; if (v !== "") addLayer(+v); });
  }
  stackCount();

  // --- sound: three sources, all optional, all user-started ----------------
  const audioSeed = () => ($("re-fxseed").value || "drone") + "-" + $("re-palette").value;
  async function ensureAudio() {
    if (audio) return audio;
    const m = await import("./retro-audio.js?v=20260812-cohesion");
    audio = m.createRetroAudio();
    return audio;
  }
  function audioState(msg) { const el = $("re-audio-state"); if (el) el.textContent = msg; }
  const press = (id, on) => { const b = $(id); if (b) b.setAttribute("aria-pressed", String(!!on)); };

  $("re-src-instr").addEventListener("click", async () => {
    try { await ensureAudio(); } catch (_) { status("audio unavailable", "err"); return; }
    if (audio.isOn()) {
      audio.stop(); press("re-src-instr", false);
      // stop() also kills a playing picture scan by design; settle its button
      if (picRun) { clearTimeout(picTimer); picRun = null; if (playPic) playPic.setAttribute("aria-pressed", "false"); }
    }
    else { try { await audio.start(audioSeed()); press("re-src-instr", true); ping("bell"); } catch (_) { status("audio needs a click to start", "err"); return; } }
    audioState(audio.isOn() ? "instrument" : (audio.hasInput() ? "listening" : "off"));
    sync();
  });

  $("re-src-mic").addEventListener("click", async () => {
    try { await ensureAudio(); } catch (_) { status("audio unavailable", "err"); return; }
    if (micOn) { audio.stopMic(); micOn = false; press("re-src-mic", false); audioState(audio.isOn() ? "instrument" : "off"); return; }
    try { await audio.startMic(); micOn = true; press("re-src-mic", true); audioState("listening to your room"); status("microphone on, analysed in this tab only", "ok"); sync(); }
    catch (_) { status("microphone permission denied", "err"); }
  });

  $("re-src-file").addEventListener("click", () => $("re-audio-file").click());
  $("re-audio-file").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { await ensureAudio(); const secs = await audio.playFile(f); press("re-src-file", true); audioState("your audio, " + secs + "s loop"); status("playing " + f.name, "ok"); sync(); }
    catch (_) { status("could not decode that audio file", "err"); }
  });

  document.querySelectorAll("#re-react-targets .re-chip").forEach((b) => {
    b.addEventListener("click", () => {
      const k = b.dataset.react;
      if (reactOn.has(k)) reactOn.delete(k); else reactOn.add(k);
      b.setAttribute("aria-pressed", String(reactOn.has(k)));
      ping("chip", 0.5); sync();
    });
  });
  $("re-react").addEventListener("input", () => {
    $("re-react-v").textContent = (+$("re-react").value / 100).toFixed(2);
    pingSlide("slider", +$("re-react").value / 100);
  });

  const retuneAudio = () => { if (audio && audio.isOn()) audio.setSeed(audioSeed()); };

  // pointer interactivity: every shader layer reads the cursor; a click re-rolls the glitch.
  out.addEventListener("pointermove", (e) => {
    const rc = out.getBoundingClientRect();
    MOUSE.x = (e.clientX - rc.left) / rc.width; MOUSE.y = (e.clientY - rc.top) / rc.height;
    // effects that model light should follow the cursor even without a shader
    if (state !== "shader" && !animRaf && activeFx.has("mosaic")) retroPass(0);
    if (state !== "shader" || !runner) return;
    const r = out.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width * shaderCanvas.width, my = (1 - (e.clientY - r.top) / r.height) * shaderCanvas.height;
    runner.setMouse(mx, my, e.buttons ? 1 : 0);
    for (const L of extraLayers) if (L.runner && L.runner.setMouse) L.runner.setMouse(mx, my, e.buttons ? 1 : 0);
    if (!animRaf) { renderShaderFrame(performance.now() / 1000); retroPass(0); }
  });
  out.addEventListener("click", () => {
    // The hand modes own the surface: no seed re-roll under a brush stroke
    // or while the beam is being drawn.
    if (state === "draw") return;
    if (state === "scope" && $("re-beam-draw") && $("re-beam-draw").checked) return;
    ping("click");
    $("re-fxseed").value = rand();
    if (state === "plate") { $("re-seed").value = rand(); renderPlate(); } else redraw();
  });

  // --- the hand on the glass: the Draw source and the beam figure -----------
  const outPos = (e) => {
    const r = out.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  function strokeTo(np) {
    const W = drawCanvas.width, H = drawCanvas.height;
    const p = { x: np.x * W, y: np.y * H };
    const from = lastPt || p;
    const g = drawCanvas.getContext("2d");
    g.strokeStyle = $("re-erase").checked ? "#07070c" : $("re-ink").value;
    g.lineWidth = +$("re-brush").value; g.lineCap = "round"; g.lineJoin = "round";
    const sym = $("re-sym").value;
    const mx = (q) => ({ x: W - q.x, y: q.y });
    const my = (q) => ({ x: q.x, y: H - q.y });
    const pairs = [[from, p]];
    if (sym === "mirror") pairs.push([mx(from), mx(p)]);
    else if (sym === "quad") pairs.push([mx(from), mx(p)], [my(from), my(p)], [mx(my(from)), mx(my(p))]);
    else if (sym === "radial6") for (let k = 1; k < 6; k++) {
      const t = (k * Math.PI) / 3, cs = Math.cos(t), sn = Math.sin(t);
      const rot = (q) => ({ x: W / 2 + (q.x - W / 2) * cs - (q.y - H / 2) * sn, y: H / 2 + (q.x - W / 2) * sn + (q.y - H / 2) * cs });
      pairs.push([rot(from), rot(p)]);
    }
    const erase = $("re-erase").checked;
    const wet = !erase && $("re-brushmode") && $("re-brushmode").value === "wet";
    const seg = (a, b, width, alpha, color) => {
      g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = width;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    };
    const size = +$("re-brush").value, ink = $("re-erase").checked ? "#07070c" : $("re-ink").value;
    const darken = (h, f) => {
      const v = parseInt(h.slice(1), 16);
      const c = (x) => Math.round(((v >> x) & 255) * f);
      return "rgb(" + c(16) + "," + c(8) + "," + c(0) + ")";
    };
    for (const [a, b] of pairs) {
      if (!wet) seg(a, b, size, 1, ink);
      else {
        // Wet media: a broad translucent blot whose darker outer ring reads
        // as the pigment edge, a lighter body wash, a soft core, and a few
        // granulation speckles. Pigment accumulates where strokes overlap.
        seg(a, b, size * 2.8, 0.05, darken(ink, 0.6));
        seg(a, b, size * 2.1, 0.09, ink);
        seg(a, b, size * 1.1, 0.28, ink);
        for (let k = 0; k < 2; k++) {
          const gx = b.x + (Math.random() - 0.5) * size * 2.2, gy = b.y + (Math.random() - 0.5) * size * 2.2;
          g.globalAlpha = 0.10; g.fillStyle = darken(ink, 0.55);
          g.beginPath(); g.arc(gx, gy, 0.8 + Math.random() * 1.4, 0, Math.PI * 2); g.fill();
        }
      }
    }
    g.globalAlpha = 1;
    lastPt = p;
  }
  async function liftBeam() {
    beamDrawing = false;
    if (beamPath.length < 16) { beamPath = []; return; }
    beamFigure = Float32Array.from(beamPath);
    const gen = beamGen;
    try {
      await ensureAudio();
      const m = await import("./scope-voice.js?v=20260812-cohesion");
      if (gen !== beamGen) return;
      const hz = 55 * Math.pow(2, knobVals()[0] * 3);
      const sr = await audio.rate();
      if (gen !== beamGen) return;
      const { left, right } = m.pathToStereo(beamFigure, sr, 1 / hz);
      await audio.playLoop(left, right);
      if (gen !== beamGen) { audio.stopLoop(); return; }
      status("the figure is sounding at " + Math.round(hz) + " Hz: your hand, retraced", "ok");
    } catch (_) { if (gen === beamGen) status("could not sound the figure", "err"); }
  }
  function pushDrawUndo() {
    try {
      drawUndo.push(drawCanvas.getContext("2d").getImageData(0, 0, drawCanvas.width, drawCanvas.height));
      if (drawUndo.length > 6) drawUndo.shift();
    } catch (_) {}
  }
  function undoDraw() {
    const snap = drawUndo.pop();
    if (!snap) { status("nothing to undo", ""); return; }
    drawCanvas.getContext("2d").putImageData(snap, 0, 0);
    redraw(); ping("chip", 0.3);
  }
  out.addEventListener("pointerdown", (e) => {
    if (state === "draw") {
      drawing = true; lastPt = null;
      pushDrawUndo();
      try { out.setPointerCapture(e.pointerId); } catch (_) {}
      strokeTo(outPos(e)); redraw(); ping("chip", 0.4);
    } else if (state === "scope" && $("re-beam-draw") && $("re-beam-draw").checked) {
      beamDrawing = true; beamPath = []; beamFigure = null; beamGen++;
      if (audio && audio.stopLoop) audio.stopLoop();
      const p = outPos(e); beamPath.push(p.x * 2 - 1, 1 - p.y * 2);
      try { out.setPointerCapture(e.pointerId); } catch (_) {}
    }
  });
  out.addEventListener("pointermove", (e) => {
    if (drawing && state === "draw") { strokeTo(outPos(e)); redraw(); }
    else if (beamDrawing && state === "scope") { const p = outPos(e); beamPath.push(p.x * 2 - 1, 1 - p.y * 2); }
  });
  out.addEventListener("pointerup", () => {
    if (drawing) { drawing = false; lastPt = null; ping("preset", 0.5); }
    if (beamDrawing) liftBeam();
  });
  // An interrupted gesture (scroll takeover, palm rejection, capture loss)
  // must end the stroke cleanly: the drawing stops, the beam path is
  // abandoned rather than lifted into sound.
  const abandonPointer = () => {
    if (drawing) { drawing = false; lastPt = null; }
    if (beamDrawing) { beamDrawing = false; beamPath = []; beamGen++; }
  };
  out.addEventListener("pointercancel", abandonPointer);
  out.addEventListener("lostpointercapture", () => { if (drawing || beamDrawing) abandonPointer(); });
  if ($("re-brush")) $("re-brush").addEventListener("input", () => {
    $("re-brush-v").textContent = $("re-brush").value; pingSlide("slider", (+$("re-brush").value) / 60);
  });
  if ($("re-clear-draw")) $("re-clear-draw").addEventListener("click", () => {
    pushDrawUndo();
    const g = drawCanvas.getContext("2d");
    g.fillStyle = "#07070c"; g.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
    redraw(); ping("bell"); status("fresh ground (undo brings it back)", "");
  });
  if ($("re-undo-draw")) $("re-undo-draw").addEventListener("click", undoDraw);
  if ($("re-brushmode")) $("re-brushmode").addEventListener("change", () => ping("chip", 0.5));
  ["re-ink", "re-sym", "re-erase"].forEach((id) => { const el = $(id); if (el) el.addEventListener("change", () => ping("chip", 0.5)); });
  const beamClear = $("re-beam-clear");
  if (beamClear) beamClear.addEventListener("click", () => {
    beamFigure = null; beamPath = []; beamGen++;
    if (audio && audio.stopLoop) audio.stopLoop();
    status("figure released: the beam is free", "");
  });
  const beamToggle = $("re-beam-draw");
  if (beamToggle) beamToggle.addEventListener("change", () => {
    if (!beamToggle.checked && beamClear) beamClear.click();
    ping("chip", 0.5);
  });

  // Keyboard: quick moves for people working the surface, never while typing.
  document.addEventListener("keydown", (e) => {
    const t = e.target, tag = t && t.tagName;
    const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable);
    // Undo works even with a panel button focused; only real text entry
    // keeps its own Ctrl+Z.
    if (!typing && (e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "z" || e.key === "Z") && state === "draw") {
      e.preventDefault(); undoDraw(); return;
    }
    if (typing || tag === "BUTTON") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "f") { e.preventDefault(); toggleFullscreen(); }
    else if (k === "r") { e.preventDefault(); randomize(); }
    else if (k === "s") { e.preventDefault(); $("re-save").click(); }
    else if (k === "z" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undoStep(); }
    else if (k === " ") { e.preventDefault(); const a = $("re-animate"); a.checked = !a.checked; a.dispatchEvent(new Event("change")); }
    else if (k === "[" || k === "]") {
      e.preventDefault();
      const el = $("re-fxamount"), step = k === "[" ? -6 : 6;
      el.value = String(Math.max(0, Math.min(100, +el.value + step)));
      el.dispatchEvent(new Event("input"));
    }
  });

  // --- palpable controls --------------------------------------------------
  // Every control answers on three channels at once: a short vibration where the
  // device supports it, a visual knock on the control itself, and a note. Ranges
  // additionally have DETENTS, so dragging a slider ticks under your finger like
  // a real knob instead of sliding through silence.
  const canBuzz = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  const BUZZ = { chip: 12, btn: 18, tab: 14, tick: 6, big: [22, 26, 22] };
  function buzz(kind) { if (!canBuzz) return; try { navigator.vibrate(BUZZ[kind] || 10); } catch (_) {} }
  function knock(el, cls) {
    if (!el || !el.classList) return;
    const c = cls || "re-hit";
    el.classList.remove(c);
    void el.offsetWidth;               // restart the animation
    el.classList.add(c);
    setTimeout(() => el.classList.remove(c), 460);
  }

  const panelRoot = document.querySelector(".re-stage") || document;
  panelRoot.addEventListener("pointerdown", (e) => {
    const el = e.target.closest && e.target.closest(".re-chip, .re-btn, .re-vibe, .re-tab, .re-rm, .re-fs");
    if (!el) return;
    knock(el);
    buzz(el.classList.contains("re-tab") ? "tab" : el.classList.contains("re-chip") ? "chip" : "btn");
  }, { passive: true });

  // detents: one tick per 1/14 of a slider's travel
  const DETENTS = 14;
  const _detent = new WeakMap();
  panelRoot.addEventListener("input", (e) => {
    const el = e.target;
    if (!el || el.type !== "range") return;
    const lo = +el.min || 0, hi = +el.max || 100;
    const idx = Math.round(((+el.value - lo) / ((hi - lo) || 1)) * DETENTS);
    if (_detent.get(el) === idx) return;
    _detent.set(el, idx);
    buzz("tick"); knock(el, "re-tick");
    try { if (audio && audio.isOn()) audio.ping("slider", idx / DETENTS); } catch (_) {}
  }, { passive: true });

  // --- full screen ----------------------------------------------------------
  const stage = $("re-stage-preview");
  const fsHud = $("re-fs-hud");
  const inFs = () => document.fullscreenElement === stage;
  // --- the motion rack: routes, feedback, MIDI hands, the clip --------------
  const modSrcSel = $("re-mod-src"), modTgtSel = $("re-mod-tgt"), modRows = $("re-mod-rows");
  if (modSrcSel && modTgtSel) {
    MOD_SOURCES.forEach((s) => { const o = document.createElement("option"); o.value = s.id; o.textContent = s.label; modSrcSel.appendChild(o); });
    MOD_TARGETS.forEach(([key, , label]) => { const o = document.createElement("option"); o.value = key; o.textContent = label; modTgtSel.appendChild(o); });
    modSrcSel.value = "lfo-sine"; modTgtSel.value = "bloom";
  }
  function renderModRows() {
    if (!modRows) return;
    modRows.textContent = "";
    modRoutes.forEach((r, i) => {
      const row = document.createElement("div"); row.className = "re-prow";
      const lab = document.createElement("span");
      const s = MOD_SOURCES.find((x) => x.id === r.src);
      const t = MOD_TARGETS.find((x) => x[0] === r.tgt);
      lab.textContent = (s ? s.label : r.src) + " → " + (t ? t[2] : r.tgt);
      const sl = document.createElement("input"); sl.type = "range"; sl.min = "-100"; sl.max = "100";
      sl.value = String(Math.round(r.depth * 100));
      sl.setAttribute("aria-label", "Depth for " + lab.textContent);
      sl.addEventListener("input", () => { r.depth = (+sl.value) / 100; pingSlide("slider", (+sl.value + 100) / 200); });
      const rm = document.createElement("button"); rm.type = "button"; rm.className = "re-btn re-rm"; rm.textContent = "×";
      rm.setAttribute("aria-label", "Remove route " + lab.textContent);
      rm.addEventListener("click", () => { modRoutes.splice(i, 1); renderModRows(); ping("chip", 0.3); modChanged(); });
      row.append(lab, sl, rm);
      modRows.appendChild(row);
    });
  }
  // Route edits settle the rack: with no routes left the offsets clear and
  // the shaders get their base knob values back, so nothing freezes at the
  // phantom value a removed route last produced.
  function modChanged() {
    if (!modRoutes.length) modOffsets = {};
    pushKnobs();
    sync();
    redraw();
  }
  if ($("re-mod-add")) $("re-mod-add").addEventListener("click", () => {
    if (modRoutes.length >= 12) { status("twelve routes is the whole rack", ""); return; }
    modRoutes.push({ src: modSrcSel.value, tgt: modTgtSel.value, depth: 0.35 });
    renderModRows(); ping("bell"); modChanged();
    status("patched: the motion is live, dial its depth below", "ok");
  });

  [["re-fb-amt", "re-fb-amt-v", (v) => String(v)], ["re-fb-zoom", "re-fb-zoom-v", (v) => (v / 10).toFixed(1)],
   ["re-fb-rot", "re-fb-rot-v", (v) => (v / 10).toFixed(1)]]
    .forEach(([id, vid, fmt]) => { const el = $(id); if (el) el.addEventListener("input", () => { $(vid).textContent = fmt(+el.value); pingSlide("slider", 0.5); }); });
  if ($("re-fb")) $("re-fb").addEventListener("change", () => { if (!fbOn()) fbCanvas.width = 0; ping("chip", 0.6); sync(); });
  if ($("re-fb-clear")) $("re-fb-clear").addEventListener("click", () => { fbCanvas.width = 0; ping("chip", 0.3); status("feedback flushed", ""); });

  // MIDI learn: press Learn, move a slider on screen, turn a hardware knob.
  const MIDI_KEY = "re.midimap.v1";
  let midiMap = {}; try { midiMap = JSON.parse(localStorage.getItem(MIDI_KEY) || "{}"); } catch (_) {}
  let midiLearn = null, midiInputs = 0;
  const midiState = () => { const el = $("re-midi-state"); if (el) el.textContent = midiInputs ? midiInputs + " in · " + Object.keys(midiMap).length + " mapped" : "no device"; };
  function onMIDI(msg) {
    const d = msg.data; if (!d || (d[0] & 0xF0) !== 0xB0) return;
    const key = (d[0] & 0x0F) + ":" + d[1];
    if (midiLearn && midiLearn.stage === 2) {
      midiMap[key] = midiLearn.target;
      try { localStorage.setItem(MIDI_KEY, JSON.stringify(midiMap)); } catch (_) {}
      status("mapped CC " + d[1] + ": turn it and watch", "ok");
      midiLearn = null; if ($("re-midi")) $("re-midi").setAttribute("aria-pressed", "false");
      midiState(); return;
    }
    const el = midiMap[key] && $(midiMap[key]);
    if (el && el.type === "range") {
      el.value = String(+el.min + (d[2] / 127) * (+el.max - +el.min));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  async function ensureMIDI() {
    if (!navigator.requestMIDIAccess) { status("MIDI needs a browser with WebMIDI (Chrome or Edge)", ""); return null; }
    const acc = await navigator.requestMIDIAccess({ sysex: false });
    const wire = () => { midiInputs = 0; acc.inputs.forEach((inp) => { midiInputs++; inp.onmidimessage = onMIDI; }); midiState(); };
    acc.onstatechange = wire; wire();
    return acc;
  }
  if ($("re-midi")) $("re-midi").addEventListener("click", async () => {
    let acc = null;
    try { acc = await ensureMIDI(); } catch (_) { status("MIDI permission denied", "err"); return; }
    if (!acc) return;
    if (midiLearn) { midiLearn = null; $("re-midi").setAttribute("aria-pressed", "false"); status("learn cancelled", ""); return; }
    midiLearn = { stage: 1 };
    $("re-midi").setAttribute("aria-pressed", "true");
    status("learn: move a slider on screen first", "ok");
  });
  if ($("re-midi-clear")) $("re-midi-clear").addEventListener("click", () => {
    midiMap = {}; try { localStorage.removeItem(MIDI_KEY); } catch (_) {}
    midiState(); status("all MIDI bindings forgotten", "");
  });
  panelRoot.addEventListener("input", (e) => {
    // Only a real hand qualifies: synthetic input events (MIDI-driven sets,
    // preset side effects) must not advance or steal the learn state.
    if (!midiLearn || midiLearn.stage !== 1 || !e.isTrusted || e.target.type !== "range") return;
    if (!e.target.id) { status("that dial cannot be mapped; pick one of the labelled sliders", ""); return; }
    midiLearn = { stage: 2, target: e.target.id };
    status("learn: now turn a knob on your device", "ok");
  }, true);

  // Record clip: six seconds of the moving picture as WebM, for the reel.
  const clipBtn = $("re-clip");
  if (clipBtn && (!("MediaRecorder" in window) || !out.captureStream)) clipBtn.hidden = true;
  else if (clipBtn) clipBtn.addEventListener("click", () => {
    if (clipBtn.dataset.rec) return;
    let rec = null;
    try {
      let mime = "video/webm;codecs=vp9";
      if (!MediaRecorder.isTypeSupported(mime)) mime = "video/webm";
      rec = new MediaRecorder(out.captureStream(30), { mimeType: mime, videoBitsPerSecond: 8000000 });
    } catch (_) { status("clip recording is not supported in this browser", "err"); return; }
    clipBtn.dataset.rec = "1";
    clipActive = true;
    const wasLooping = !!animRaf;
    if (!wasLooping) startLoop();
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const finish = () => {
      if (!clipActive) return;
      clipActive = false;
      delete clipBtn.dataset.rec;
      if (chunks.length) { saveBlob("retro-clip.webm", new Blob(chunks, { type: "video/webm" })); status("six seconds saved as WebM", "ok"); }
      else status("the clip came back empty", "err");
      sync();
    };
    rec.onstop = finish;
    rec.onerror = finish;
    try { rec.start(250); } catch (_) { finish(); return; }
    ping("bell");
    let left = 6;
    status("recording: 6s", "ok");
    const tick = setInterval(() => {
      left--;
      if (left <= 0) { clearInterval(tick); try { rec.stop(); } catch (_) { finish(); } }
      else status("recording: " + left + "s", "ok");
    }, 1000);
  });

  function setHud() {
    if (!fsHud) return;
    fsHud.textContent = "R randomize · space animate · [ ] amount · F or Esc to leave";
  }
  async function toggleFullscreen() {
    if (!stage) return;
    try {
      if (inFs()) await document.exitFullscreen();
      else { setHud(); await stage.requestFullscreen(); }
      buzz("big");
    } catch (_) { status("full screen was refused by the browser", "err"); }
  }
  if ($("re-fullscreen")) $("re-fullscreen").addEventListener("click", toggleFullscreen);
  out.addEventListener("dblclick", toggleFullscreen);
  document.addEventListener("fullscreenchange", () => {
    const b = $("re-fullscreen");
    if (b) { b.setAttribute("aria-pressed", String(inFs())); b.innerHTML = inFs() ? "&#10531;" : "&#10530;"; }
    // the canvas is CSS-scaled, so just redraw at the new presentation size
    if (!animRaf) retroPass(0);
  });

  // A plate handed over from the Gallery (or a frame from the Studio) arrives as
  // a PNG in sessionStorage and becomes the upload source here.
  function bootImportedImage() {
    let dataURL = null;
    try { dataURL = sessionStorage.getItem("re.retro.handoff"); } catch (_) { return false; }
    if (!dataURL) return false;
    try { sessionStorage.removeItem("re.retro.handoff"); } catch (_) {}
    const img = new Image();
    img.onload = () => {
      uploaded = img;
      const tab = document.querySelector('.re-tab[data-src="upload"]');
      if (tab) tab.click(); else { state = "upload"; refreshSource(); }
      const rec = receiveTrail("retro");
      status(rec && rec.line ? "arrived: " + rec.line : "loaded the plate you sent over", "ok");
    };
    img.onerror = () => status("could not read the handed-over image", "err");
    img.src = dataURL;
    return true;
  }

  // A shared link carries a whole shader (#s=) or a whole patch (#p=).
  let booted = DEFAULT_FRAG, bootPatch = null;
  if (location.hash.indexOf("#s=") === 0) {
    const g = decodeShader(location.hash.slice(3));
    if (g) booted = g;
  } else if (location.hash.indexOf("#p=") === 0) {
    const raw = decodeShader(location.hash.slice(3));
    try { bootPatch = raw ? JSON.parse(raw) : null; } catch (_) { bootPatch = null; }
    if (bootPatch && bootPatch.glsl) booted = bootPatch.glsl;
  }
  mountFlow($("re-flow"), "retro");
  $("re-code").value = booted;
  syncFxCount();
  if (bootPatch) { applyPatch(bootPatch); status("patch loaded from link", "ok"); }
  else {
    // A shared link always wins; otherwise pick the session back up where it
    // was left, and say so, because silently restoring state is its own trap.
    let saved = null;
    try { saved = localStorage.getItem(SESSION_KEY); } catch (_) {}
    if (saved) {
      try {
        restoring = true;
        applyPatch(JSON.parse(saved));
        status("picked up where you left off · Start fresh clears it", "ok");
      } catch (_) { refreshSource(); }
      finally { restoring = false; }
    } else {
      refreshSource();
    }
  }
  try { sessionSnapshot("the start"); } catch (_) {}
  if (new URLSearchParams(location.search).get("import") === "plate") bootImportedImage();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
