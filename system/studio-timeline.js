// studio-timeline.js: one timeline for every source (9 October 2026). A strip over the bottom of the
// stage with a transport (play, pause, scrub, length, loop), keyframes on any numeric control of the
// source on stage, and a WebM render of the whole timeline. Keyframes hold the values of the
// source's own sliders and number fields at a time; playing sets those same controls, with the
// same events a hand would fire, so every source animates through its own code. Interpolation is
// raw-native Motion's (web/motion/timeline.mjs: track and its easing), read from the copy the site
// vendors; nothing in it is changed here.
//
// Kept per source in this browser (studio.timeline.v1.<source>) and in project files.

import { track, ease } from "../media/raw-native/web-23ec93f/motion/timeline.mjs";

export const TIMELINE_PREFIX = "studio.timeline.v1.";
export const LENGTHS = Object.freeze([4, 8, 16, 30]);

/** The value every keyed control takes at time t. keys: [{ t, values: { id: number } }]. Pure. */
export function valuesAt(keys, t) {
  const ids = new Set();
  for (const k of keys) for (const id of Object.keys(k.values)) ids.add(id);
  const out = {};
  for (const id of ids) {
    const ks = keys.filter((k) => Number.isFinite(k.values[id])).map((k) => [k.t, k.values[id], ease.inOut]);
    if (ks.length) out[id] = track(ks)(t);
  }
  return out;
}

/** Add or replace the key at time t (within half a frame). Pure; returns a new sorted list. */
export function withKey(keys, t, values) {
  const kept = keys.filter((k) => Math.abs(k.t - t) > 1 / 60);
  return [...kept, { t: +t.toFixed(3), values: { ...values } }].sort((a, b) => a.t - b.t);
}

const snapStep = (el, v) => {
  const step = parseFloat(el.step);
  const min = el.min === "" ? -Infinity : +el.min, max = el.max === "" ? Infinity : +el.max;
  let x = Math.min(max, Math.max(min, v));
  if (Number.isFinite(step) && step > 0) {
    const base = Number.isFinite(min) ? min : 0;
    x = base + Math.round((x - base) / step) * step;
    const dp = (String(el.step).split(".")[1] || "").length;
    x = +x.toFixed(Math.min(6, dp));
  }
  return x;
};

export function mountTimeline({ stage, deck, getSource, blockOf, storage, say = () => {} }) {
  const doc = stage.ownerDocument;
  const el = (tag, attrs = {}, text) => { const n = doc.createElement(tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text != null) n.textContent = text; return n; };
  const store = () => { try { return storage(); } catch (_) { return null; } };
  const load = (src) => { try { const s = store(); const v = s && JSON.parse(s.getItem(TIMELINE_PREFIX + src) || "null"); return v && Array.isArray(v.keys) ? v : null; } catch (_) { return null; } };
  const save = (src, v) => { try { const s = store(); if (s) s.setItem(TIMELINE_PREFIX + src, JSON.stringify(v)); } catch (_) {} };

  let src = getSource(), state = load(src) || { length: 8, loop: false, keys: [] };
  let t = 0, playing = false, raf = 0, last = 0, rec = null;

  const strip = el("div", { id: "studio-timeline", class: "studio-timeline", role: "group", "aria-label": "Timeline", hidden: "" });
  const play = el("button", { type: "button", class: "btn ghost", id: "tl-play" }, "Play");
  const scrub = el("input", { type: "range", id: "tl-scrub", min: "0", max: "8", step: "0.01", value: "0", "aria-label": "Time" });
  const time = el("span", { class: "tl-time", id: "tl-time" }, "0.00 s");
  const len = el("select", { id: "tl-length", "aria-label": "Timeline length" });
  for (const L of LENGTHS) len.append(el("option", { value: String(L) }, `${L} s`));
  const loopL = el("label", { class: "tl-loop" }); const loop = el("input", { type: "checkbox", id: "tl-loop" }); loopL.append(loop, " Loop");
  const key = el("button", { type: "button", class: "btn ghost", id: "tl-key", title: "Keep every slider and number of this source at this time" }, "Add key");
  const clear = el("button", { type: "button", class: "btn ghost", id: "tl-clear" }, "Clear keys");
  const render = el("button", { type: "button", class: "btn ghost", id: "tl-render", title: "Play the timeline once and save it as a WebM video" }, "Render WebM");
  const marks = el("div", { class: "tl-marks", "aria-hidden": "true" });
  const note = el("span", { class: "tl-note", id: "tl-note", role: "status", "aria-live": "polite" });
  const close = el("button", { type: "button", class: "btn ghost tl-close", "aria-label": "Close the timeline" }, "Close");
  const track_ = el("div", { class: "tl-track" }); track_.append(scrub, marks);
  strip.append(play, track_, time, len, loopL, key, clear, render, note, close);
  stage.append(strip);

  const toggle = el("button", { type: "button", class: "rt-btn", id: "rt-timeline", "aria-pressed": "false", "aria-controls": "studio-timeline", title: "Timeline: keyframe any slider of the source on stage (T)" }, "Timeline");
  if (deck) deck.append(toggle);

  const numeric = () => {
    const b = blockOf(src);
    return b ? [...b.querySelectorAll('input[type="range"][id], input[type="number"][id]')].filter((n) => !n.disabled) : [];
  };
  const paintMarks = () => {
    marks.replaceChildren(...state.keys.map((k) => { const m = el("span", { class: "tl-mark" }); m.style.left = `${(k.t / state.length) * 100}%`; return m; }));
    key.textContent = state.keys.length ? `Add key (${state.keys.length})` : "Add key";
  };
  const paint = () => {
    scrub.max = String(state.length); scrub.value = String(t);
    scrub.setAttribute("aria-valuetext", `${t.toFixed(2)} of ${state.length} seconds`);
    time.textContent = `${t.toFixed(2)} s`;
    len.value = String(state.length); loop.checked = !!state.loop;
    play.textContent = playing ? "Pause" : "Play";
    paintMarks();
  };
  const apply = () => {
    if (!state.keys.length) return;
    const vals = valuesAt(state.keys, t);
    const b = blockOf(src); if (!b) return;
    for (const [id, v] of Object.entries(vals)) {
      const n = b.querySelector("#" + CSS.escape(id));
      if (!n) continue;
      const x = snapStep(n, v);
      if (String(n.value) === String(x)) continue;
      n.value = String(x);
      n.dispatchEvent(new Event("input", { bubbles: true }));
      n.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };
  const persist = () => save(src, state);
  const stop = () => { playing = false; if (raf) cancelAnimationFrame(raf); raf = 0; paint(); };
  const tick = (now) => {
    raf = 0;
    if (!playing) return;
    const dt = last ? (now - last) / 1000 : 0; last = now;
    t += dt;
    if (t >= state.length) {
      if (state.loop && !rec) t = t % state.length;
      else { t = state.length; apply(); stop(); if (rec) finishRender(); return; }
    }
    apply(); paint();
    raf = requestAnimationFrame(tick);
  };
  const start = () => { if (playing) return; if (t >= state.length) t = 0; playing = true; last = 0; raf = requestAnimationFrame(tick); paint(); };

  play.addEventListener("click", () => (playing ? stop() : start()));
  scrub.addEventListener("input", () => { t = +scrub.value; apply(); paint(); });
  len.addEventListener("change", () => { state.length = +len.value; state.keys = state.keys.filter((k) => k.t <= state.length); t = Math.min(t, state.length); persist(); paint(); });
  loop.addEventListener("change", () => { state.loop = loop.checked; persist(); });
  key.addEventListener("click", () => {
    const ctrls = numeric();
    if (!ctrls.length) { note.textContent = "This source has no slider or number to keyframe."; return; }
    const values = {}; for (const n of ctrls) { const v = parseFloat(n.value); if (Number.isFinite(v)) values[n.id] = v; }
    state.keys = withKey(state.keys, t, values); persist(); paint();
    note.textContent = `Key at ${t.toFixed(2)} s: ${Object.keys(values).length} controls.`;
  });
  clear.addEventListener("click", () => { state.keys = []; persist(); paint(); note.textContent = "Keys cleared."; });

  function finishRender() {
    const r = rec; rec = null;
    try { r.mr.stop(); } catch (_) {}
  }
  render.addEventListener("click", () => {
    const c = doc.getElementById("studio-canvas");
    if (!c || typeof c.captureStream !== "function" || typeof MediaRecorder === "undefined") { note.textContent = "This browser cannot record the canvas."; return; }
    if (!state.keys.length) { note.textContent = "Add at least two keys first."; return; }
    stop();
    const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((x) => MediaRecorder.isTypeSupported(x));
    const mr = new MediaRecorder(c.captureStream(30), type ? { mimeType: type, videoBitsPerSecond: 8e6 } : {});
    const chunks = [];
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const a = el("a", { href: URL.createObjectURL(blob), download: `studio-timeline-${src}-${state.length}s.webm` });
      doc.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      note.textContent = `Rendered ${state.length} s, ${Math.round(blob.size / 1024)} KB.`;
    };
    rec = { mr };
    t = 0; apply(); mr.start(250);
    note.textContent = "Rendering...";
    start();
  });
  const show = (on) => { strip.hidden = !on; toggle.setAttribute("aria-pressed", String(on)); if (!on) stop(); else paint(); };
  toggle.addEventListener("click", () => show(strip.hidden));
  close.addEventListener("click", () => show(false));
  doc.addEventListener("keydown", (e) => {
    const tg = e.target; if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "t" || e.key === "T") { if (getSource() === "worlds") return; e.preventDefault(); show(strip.hidden); }
  });

  paint();
  return {
    sourceChanged(next) { stop(); src = next; state = load(src) || { length: 8, loop: false, keys: [] }; t = 0; note.textContent = ""; paint(); },
    all(sources) { const out = {}; for (const s of sources) { const v = load(s); if (v && v.keys.length) out[s] = v; } return out; },
    putAll(map, sources) { for (const [s, v] of Object.entries(map || {})) if (sources.includes(s) && v && Array.isArray(v.keys)) save(s, v); },
    show,
  };
}
