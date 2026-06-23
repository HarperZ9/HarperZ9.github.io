// studio.js — the unified Studio: one canvas, two ways in (Generate via the Atelier, or Bring your own),
// then perceive/discuss/transform/refine with the model. Bridges the Atelier's canvas to the eye.
import { perceptualHash, features, hamming } from "../shared-frame/eye.js";
const $ = id => document.getElementById(id);
const fmt = (v,n=3)=>typeof v==="number"?(Number.isInteger(v)?String(v):v.toFixed(n)):String(v);
// drift is per-canvas (Task 6 review carry-in): keyed by the canvas instance, so switching
// modes / sources doesn't compare against an unrelated frame and show a misleading drift.
const lastHashByCanvas = new WeakMap();
let mode = "generate";

function setMode(next) {
  mode = next;
  $("studio-generate").hidden = next !== "generate";
  $("studio-byo").hidden = next !== "byo";
  document.querySelectorAll("#studio-mode button").forEach(b =>
    b.setAttribute("aria-pressed", String(b.dataset.mode === next)));
}

$("studio-mode").addEventListener("click", e => {
  const b = e.target.closest("button[data-mode]"); if (b) setMode(b.dataset.mode);
});
setMode("generate");

function perceive(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width:w, height:h } = canvas;
  const px = ctx.getImageData(0,0,w,h).data;
  const phash = perceptualHash(px,w,h,4), f = features(px,w,h,4);
  $("sc-phash").textContent = phash;
  $("sc-size").textContent = `${w}×${h}`;
  $("sc-feats").innerHTML = [["contrast",f.contrast],["structure",f.entropy],["balance",f.balance]]
    .map(([k,v])=>`<span class="ground"><span class="gk">${k}</span> ${fmt(v)}</span>`).join("");
  const prev = lastHashByCanvas.get(canvas);
  if (prev != null) { const d = hamming(prev, phash);
    const el=$("sc-drift"); el.hidden=false; el.textContent = d===0?"unchanged":`moved ${d}/64 from the last frame`; }
  lastHashByCanvas.set(canvas, phash);
  return { phash, features:f, width:w, height:h };
}

function say(role, text) {
  // build the message from nodes — role + text via .textContent only, never interpolated
  // into innerHTML (Task 6 review carry-in: no markup injection through role/text).
  const log = $("studio-log"); const el = document.createElement("div");
  el.className = "msg " + role;
  const who = document.createElement("span"); who.className = "who"; who.textContent = role;
  const body = document.createElement("span"); body.className = "body"; body.textContent = text;
  el.appendChild(who); el.appendChild(body);
  log.appendChild(el); log.scrollTop = log.scrollHeight;
}
window.__studioPerceive = perceive; window.__studioSay = say;   // used by the bridge (Task 7) + tests

// canvas→eye bridge (Task 7): when the Atelier finishes a drawing, perceive the shared
// canvas and let the model greet, in plain words, exactly what it measured.
document.addEventListener("atelier:drawn", e => {
  const canvas = e.detail && e.detail.canvas; if (!canvas) return;
  const obs = perceive(canvas);
  say("model", `Here's what I see in what you generated: a ${obs.width}×${obs.height} frame, `
    + `${obs.features.entropy>0.8?"richly textured":obs.features.entropy<0.45?"clean and simple":"moderately detailed"}, `
    + `${obs.features.contrast>0.66?"high-contrast":"soft"}. My fingerprint of it is ${obs.phash}. Where shall we take it?`);
});
