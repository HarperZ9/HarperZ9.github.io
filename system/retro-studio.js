/* retro-studio.js — the Retro Engine page controller.

   A source (generative plate, uploaded image, or live GLSL shader) is rendered
   to a source canvas, pushed through renderRetro() with the panel's settings,
   then through a stackable rack of glitch / manipulation effects. Shaders and
   glitch can animate; the preview reacts to the pointer; Randomize rolls the
   whole chain. Everything is local; nothing uploads. */

import { renderRetro } from "./retro-engine.js";
import { createShaderRunner, DEFAULT_FRAG } from "./shader-runner.js?v=20260805-react";
import { applyOps, OP_META, rngFrom } from "./glitch-ops.js?v=20260805-mosaic";
import { SHADER_PRESETS } from "./shader-presets.js?v=20260805-fine";

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
  const extraLayers = []; // [{canvas, runner, glsl, name, blend, opacity}]
  const MAX_LAYERS = 4;
  const BLENDS = [["lighter", "Add"], ["screen", "Screen"], ["multiply", "Multiply"],
    ["difference", "Difference"], ["overlay", "Overlay"], ["lighten", "Lighten"], ["source-over", "Normal"]];

  // audio instrument (lazily created on first Sound press). ping = play a note
  // for a physical edit; guarded so it is a no-op until sound is on.
  let audio = null, micOn = false;
  const ping = (k, v) => { try { if (audio && audio.isOn()) audio.ping(k, v); } catch (_) {} };
  let _lastPing = 0;
  const pingSlide = (k, v) => { const n = performance.now(); if (n - _lastPing > 70) { _lastPing = n; ping(k, v); } };

  // Per-effect amounts. The master Amount sets them all at once; each active
  // effect then keeps its own dial, so a chain can be tuned part by part.
  const fxAmount = new Map();
  const masterAmt = () => (+($("re-fxamount") ? $("re-fxamount").value : 50)) / 100;
  const ampOf = (op) => (fxAmount.has(op) ? fxAmount.get(op) : masterAmt());

  // Where the cursor sits over the picture, 0..1. Effects that model light
  // (the mosaic's raking glint) read this, so the light follows your hand.
  const MOUSE = { x: 0.5, y: 0.35 };

  // Live audio analysis, refreshed each frame when sound is on.
  const AU = { bass: 0, mid: 0, treble: 0, level: 0 };
  const reactOn = new Set(["shader"]);
  const reactAmt = () => (+($("re-react") ? $("re-react").value : 60)) / 100;
  const knobVals = () => [(+$("re-knobA").value) / 100, (+$("re-knobB").value) / 100, (+$("re-knobC").value) / 100];

  const fxAnimOn = () => $("re-fxanim").checked;
  const sourceCanvas = () => (state === "shader" ? (extraLayers.length ? stackCanvas : shaderCanvas) : srcCanvas);
  // Sound keeps the loop alive too: a still plate should still move to music.
  const loopActive = () => state === "shader" || (fxAnimOn() && activeFx.size > 0)
    || !!(audio && audio.isOn() && reactOn.size);

  function opts() {
    let tw = +$("re-tw").value; const scan = +$("re-scan").value / 100;
    let bloom = +$("re-bloom").value / 100;
    const r = reactAmt();
    // sound reaching into the picture: bass coarsens the pixel grid, level blooms
    if (reactOn.has("pixel")) tw = Math.max(24, Math.round(tw * (1 - AU.bass * 0.45 * r)));
    if (reactOn.has("bloom")) bloom = Math.min(1.4, bloom + AU.level * 0.9 * r);
    return {
      palette: $("re-palette").value, targetWidth: tw, dither: $("re-dither").value,
      gamma: +$("re-gam").value / 100, sdfShade: $("re-sdf").checked,
      curvature: +$("re-curv").value / 100, bloom,
      vignette: +$("re-vig").value / 100, scanStrength: scan, scanlines: scan > 0.02,
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
    if (!audio || !audio.hasInput || (!audio.isOn() && !audio.hasInput())) {
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

  function retroPass(t = 0) {
    const s = sourceCanvas(); if (!s.width) return;
    try { renderRetro(s, out, opts()); if (activeFx.size) applyOps(out, buildFx(t)); }
    catch (e) { status("render error: " + e.message, "err"); }
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
      if (state === "shader") renderShaderFrame(t);
      if (now - lastRetro > 45) { retroPass(t); lastRetro = now; }
      animRaf = requestAnimationFrame(loop);
    };
    animRaf = requestAnimationFrame(loop);
  }
  function stopLoop() { if (animRaf) cancelAnimationFrame(animRaf); animRaf = 0; }

  // Decide whether to animate or draw one still frame.
  function sync() { if (loopActive()) startLoop(); else { stopLoop(); retroPass(0); } }

  function refreshSource() {
    stopLoop();
    if (state === "plate") renderPlate();
    else if (state === "upload") renderUpload();
    else if (state === "shader") { if (!runShader()) return; }
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
    const setR = (id, v, vid, div) => { $(id).value = v; if (vid) $(vid).textContent = (v / (div || 1)).toFixed(div ? 2 : 0); };
    setR("re-tw", 60 + Math.floor(Math.random() * 240), "re-tw-v", 1);
    setR("re-curv", Math.floor(Math.random() * 70), "re-curv-v", 100);
    setR("re-bloom", Math.floor(Math.random() * 90), "re-bloom-v", 100);
    setR("re-vig", Math.floor(Math.random() * 60), "re-vig-v", 100);
    $("re-dither").value = ["bayer4", "bayer2", "bayer8", "none"][Math.floor(Math.random() * 4)];
    $("re-fxseed").value = rand();
    activeFx.clear();
    OP_META.forEach((m) => { if (Math.random() < 0.4) activeFx.add(m.op); });
    syncFxChips(); refreshSource();
    if (typeof retuneAudio === "function") retuneAudio();
  }

  // --- wiring -------------------------------------------------------------
  document.querySelectorAll(".re-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state = tab.dataset.src;
      document.querySelectorAll(".re-tab").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      document.querySelectorAll(".re-srcpanel").forEach((p) => { p.hidden = p.dataset.panel !== state; });
      if (state === "upload" && $("re-palette").value !== "auto") $("re-palette").value = "auto";
      ping("bell"); refreshSource();
    });
  });
  ["re-palette", "re-dither", "re-sdf"].forEach((id) => $(id).addEventListener("change", () => { redraw(); ping(id === "re-sdf" ? "chip" : "preset", 0.5); }));
  [["re-tw", "re-tw-v", 1], ["re-curv", "re-curv-v", 100], ["re-bloom", "re-bloom-v", 100],
   ["re-vig", "re-vig-v", 100], ["re-scan", "re-scan-v", 100], ["re-gam", "re-gam-v", 100],
   ["re-fxamount", "re-fxamount-v", 100]]
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

  function loadShader(glsl, preset) {
    if (glsl == null) return;
    honourFineGrid(preset);
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
      fx: [...activeFx], amts, master: +$("re-fxamount").value,
      fxseed: $("re-fxseed").value, fxanim: $("re-fxanim").checked,
      knobs: [+$("re-knobA").value, +$("re-knobB").value, +$("re-knobC").value],
      react: [...reactOn], reactAmt: +$("re-react").value,
      seed: $("re-seed").value, plate: $("re-layers").value,
      layers: extraLayers.map((L) => ({ name: L.name, glsl: L.glsl, blend: L.blend, opacity: L.opacity })),
    };
  }

  function applyPatch(p) {
    if (!p || typeof p !== "object") return;
    const setV = (id, v, vid, div) => { if (v == null || !$(id)) return; $(id).value = String(v); if (vid && $(vid)) $(vid).textContent = div ? (v / div).toFixed(2) : String(v); };
    setV("re-palette", p.pal); setV("re-dither", p.dith);
    setV("re-tw", p.tw, "re-tw-v"); setV("re-gam", p.gam, "re-gam-v", 100);
    setV("re-curv", p.curv, "re-curv-v", 100); setV("re-bloom", p.bloom, "re-bloom-v", 100);
    setV("re-vig", p.vig, "re-vig-v", 100); setV("re-scan", p.scan, "re-scan-v", 100);
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
    if (p.glsl) $("re-code").value = p.glsl;
    syncFxChips();
    const tab = document.querySelector('.re-tab[data-src="' + (p.src || "shader") + '"]');
    if (tab) tab.click(); else refreshSource();
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
  $("re-save").addEventListener("click", () => { ping("preset"); const a = document.createElement("a"); a.download = "retro-" + $("re-palette").value + ".png"; a.href = out.toDataURL("image/png"); a.click(); });

  // Hand the current render to the Studio as a plot map (via sessionStorage).
  $("re-send-studio").addEventListener("click", () => {
    try { sessionStorage.setItem("re.studio.handoff", out.toDataURL("image/png")); }
    catch (e) { status("render too large to hand off", "err"); return; }
    ping("bell"); status("opening the Studio…", "ok");
    location.href = "studio.html?source=plotmaps&import=retro";
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
    const m = await import("./retro-audio.js?v=20260805-react");
    audio = m.createRetroAudio();
    return audio;
  }
  function audioState(msg) { const el = $("re-audio-state"); if (el) el.textContent = msg; }
  const press = (id, on) => { const b = $(id); if (b) b.setAttribute("aria-pressed", String(!!on)); };

  $("re-src-instr").addEventListener("click", async () => {
    try { await ensureAudio(); } catch (_) { status("audio unavailable", "err"); return; }
    if (audio.isOn()) { audio.stop(); press("re-src-instr", false); }
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
    ping("click");
    $("re-fxseed").value = rand();
    if (state === "plate") { $("re-seed").value = rand(); renderPlate(); } else redraw();
  });

  // Keyboard: quick moves for people working the surface, never while typing.
  document.addEventListener("keydown", (e) => {
    const t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "f") { e.preventDefault(); toggleFullscreen(); }
    else if (k === "r") { e.preventDefault(); randomize(); }
    else if (k === "s") { e.preventDefault(); $("re-save").click(); }
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
      status("loaded the plate you sent over", "ok");
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
  $("re-code").value = booted;
  syncFxCount();
  if (bootPatch) { applyPatch(bootPatch); status("patch loaded from link", "ok"); }
  else refreshSource();
  if (new URLSearchParams(location.search).get("import") === "plate") bootImportedImage();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
