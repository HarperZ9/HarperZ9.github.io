// The live, interactive side of a Motion scene: the same scene file the
// offline renderer draws, played on a canvas with its sound, captions and
// controls. Scrub, pause, step, and drag a scene parameter to see what it
// changes. Under prefers-reduced-motion it does not autoplay and tells the
// scene (ctx.reduced) so camera flights can become cuts.
//
//   import { mountPlayer } from "./web/motion/player.mjs";
//   await mountPlayer(document.querySelector("#film"), {
//     sceneUrl: new URL("film.scene.mjs", location.href).href,
//     shaders: "/media/raw-native/web/", audio: "film.m4a", captions: "film.vtt",
//   });
//
// Without WebGPU it leaves a short notice in the element and returns null.
import { createEngine } from "./engine.mjs";

const CSS = `
.mo-root{position:relative;display:grid;gap:.5rem;color:var(--ink,#ece5d6);font:inherit}
.mo-stage{position:relative;aspect-ratio:16/9;background:var(--void,#060608);overflow:hidden}
.mo-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.mo-cap{min-height:2.8em;font-size:1rem;line-height:1.4;text-align:center;color:var(--ink,#ece5d6)}
.mo-bar{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .75rem}
.mo-bar button{font:inherit;color:inherit;background:none;border:1px solid var(--frame,#2a2830);border-radius:2px;padding:.35rem .7rem;cursor:pointer;min-width:2.75rem;min-height:2.75rem}
.mo-bar button:focus-visible,.mo-bar input:focus-visible{outline:2px solid var(--verified,#63d4ce);outline-offset:2px}
.mo-scrub{flex:1 1 12rem;min-width:8rem;accent-color:var(--ink,#ece5d6)}
.mo-time{font-variant-numeric:tabular-nums;min-width:7.5rem;text-align:right}
.mo-params{display:flex;flex-wrap:wrap;gap:.5rem 1.25rem}
.mo-params label{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
.mo-params output{font-variant-numeric:tabular-nums;min-width:4ch}
.mo-chapters{display:flex;flex-wrap:wrap;gap:.25rem .5rem;font-size:.9rem}
.mo-chapters button{font:inherit;color:var(--ink-2,#b8b0a0);background:none;border:0;padding:.25rem 0;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.mo-note{color:var(--ink-2,#b8b0a0)}`;

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  for (const k of kids) e.append(k);
  return e;
}
async function parseVtt(url) {
  try {
    const t = await (await fetch(url)).text(), cues = [];
    const ts = (s) => { const p = s.trim().split(":").map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; };
    for (const block of t.replace(/\r/g, "").split(/\n\n+/)) {
      const m = /([\d:.]+)\s+-->\s+([\d:.]+)[^\n]*\n([\s\S]+)/.exec(block);
      if (m) cues.push({ a: ts(m[1]), b: ts(m[2]), text: m[3].trim() });
    }
    return cues;
  } catch (e) { console.warn("motion player: captions did not load", e); return []; }
}

export async function mountPlayer(el, { sceneUrl, shaders, audio = null, captions = null, label = "Interactive film", maxPixels = 3840 * 2160 } = {}) {
  if (!document.getElementById("mo-css")) document.head.append(h("style", { id: "mo-css" }, CSS));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!navigator.gpu) {
    el.append(h("p", { class: "mo-note" }, "The interactive version needs WebGPU, which this browser does not offer. The video shows the same film."));
    return null;
  }
  const canvas = h("canvas", { role: "img", "aria-label": label, tabindex: "0" });
  const stage = h("div", { class: "mo-stage" }, canvas);
  const cap = h("div", { class: "mo-cap", "aria-live": "off" });
  const play = h("button", { type: "button", "aria-label": "Play" }, "Play");
  const scrub = h("input", { class: "mo-scrub", type: "range", min: "0", max: "1", step: "0.01", value: "0", "aria-label": "Position in the film" });
  const time = h("span", { class: "mo-time" }, "0:00 / 0:00");
  const capBtn = h("button", { type: "button", "aria-pressed": "true" }, "Captions");
  const bar = h("div", { class: "mo-bar" }, play, scrub, time, capBtn);
  const params = h("div", { class: "mo-params" });
  const chapters = h("div", { class: "mo-chapters" });
  const root = h("div", { class: "mo-root" }, stage, cap, bar, chapters, params);
  el.append(root);
  let eng;
  try { eng = await createEngine({ canvas, sceneUrl, shaders, reduced }); }
  catch (e) {
    root.remove();
    el.append(h("p", { class: "mo-note" }, "The interactive version could not start on this device. The video shows the same film."));
    console.warn("motion player:", e);
    return null;
  }
  const scene = eng.scene, dur = scene.duration;
  scrub.max = String(dur);
  const snd = audio ? (audio instanceof HTMLMediaElement ? audio : new Audio(audio)) : null;
  if (snd) snd.preload = "auto";
  const cues = captions ? await parseVtt(captions) : [];
  let t = 0, playing = false, last = performance.now(), dirty = true, showCaps = true, scrubbing = false;
  const setPlaying = (p) => {
    playing = p;
    play.textContent = p ? "Pause" : "Play";
    play.setAttribute("aria-label", p ? "Pause" : "Play");
    if (snd) { if (p) { snd.currentTime = t; snd.play().catch(() => {}); } else snd.pause(); }
    last = performance.now();
  };
  const seek = (s) => { t = Math.max(0, Math.min(dur, s)); if (snd) snd.currentTime = t; dirty = true; };
  play.addEventListener("click", () => setPlaying(!playing));
  capBtn.addEventListener("click", () => { showCaps = !showCaps; capBtn.setAttribute("aria-pressed", String(showCaps)); dirty = true; });
  scrub.addEventListener("input", () => { scrubbing = true; seek(+scrub.value); });
  scrub.addEventListener("change", () => { scrubbing = false; });
  canvas.addEventListener("click", () => setPlaying(!playing));
  root.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" && e.key !== " ") return;
    const step = 1 / (scene.fps || 30);
    if (e.key === " " || e.key === "k") { e.preventDefault(); setPlaying(!playing); }
    else if (e.key === "ArrowRight") { e.preventDefault(); seek(t + 5); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); seek(t - 5); }
    else if (e.key === ".") { setPlaying(false); seek(t + step); }
    else if (e.key === ",") { setPlaying(false); seek(t - step); }
  });
  for (const c of scene.chapters || []) chapters.append(h("button", { type: "button", onclick: () => { seek(c.t); } }, `${fmtTime(c.t)} ${c.title}`));
  // Parameters: a slider each; a parameter with `window` shows only then.
  const rows = (scene.params || []).map((p) => {
    const out = h("output", {}, String(p.value));
    const input = h("input", { type: "range", min: String(p.min), max: String(p.max), step: String(p.step ?? 0.01), value: String(p.value) });
    input.addEventListener("input", () => { eng.ctx.params[p.id] = +input.value; out.textContent = p.format ? p.format(+input.value) : input.value; dirty = true; });
    const row = h("label", {}, p.label, input, out);
    if (p.note) row.append(h("span", { class: "mo-note" }, p.note));
    params.append(row);
    return { p, row };
  });
  // Size the canvas to its box at the device pixel ratio, within maxPixels.
  const fit = () => {
    const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    let w = Math.round(r.width * dpr), hh = Math.round((w * 9) / 16);
    const k = Math.min(1, Math.sqrt(maxPixels / (w * hh)));
    w = Math.round(w * k); hh = Math.round(hh * k);
    if (w !== eng.size[0] || hh !== eng.size[1]) { eng.resize(w, hh); dirty = true; }
  };
  new ResizeObserver(fit).observe(stage);
  fit();
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing && !scrubbing) {
      t = snd && !snd.paused && !snd.ended ? snd.currentTime : t + dt;
      if (t >= dur) { t = dur; setPlaying(false); }
      dirty = true;
    }
    if (dirty || (playing && eng.ctx.threads)) {
      eng.ctx.dt = playing ? dt : 0;
      eng.draw(t);
      if (!scrubbing) scrub.value = String(t);
      time.textContent = `${fmtTime(t)} / ${fmtTime(dur)}`;
      const c = showCaps ? cues.find((q) => t >= q.a && t < q.b) : null;
      const txt = c ? c.text : "";
      if (cap.textContent !== txt) cap.textContent = txt;
      for (const { p, row } of rows) row.hidden = p.window ? !(t >= p.window[0] && t <= p.window[1]) : false;
      dirty = false;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  if (!reduced && el.dataset.autoplay === "true") setPlaying(true);
  return { engine: eng, seek, play: () => setPlaying(true), pause: () => setPlaying(false), get time() { return t; } };
}
