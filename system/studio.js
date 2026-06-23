// studio.js — the unified Studio: one canvas, two ways in (Generate via the Atelier, or Bring your own),
// then perceive/discuss/transform/refine with the model. Bridges the Atelier's canvas to the eye.
import { perceptualHash, features, hamming } from "../shared-frame/eye.js";
const $ = id => document.getElementById(id);
const fmt = (v,n=3)=>typeof v==="number"?(Number.isInteger(v)?String(v):v.toFixed(n)):String(v);
let lastHash = null;
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
  if (lastHash !== null) { const d = hamming(lastHash, phash);
    const el=$("sc-drift"); el.hidden=false; el.textContent = d===0?"unchanged":`moved ${d}/64 from the last frame`; }
  lastHash = phash;
  return { phash, features:f, width:w, height:h };
}

function say(role, text) {
  const log = $("studio-log"); const el = document.createElement("div");
  el.className = "msg " + role; el.innerHTML = `<span class="who">${role}</span><span class="body"></span>`;
  el.querySelector(".body").textContent = text; log.appendChild(el); log.scrollTop = log.scrollHeight;
}
window.__studioPerceive = perceive; window.__studioSay = say;   // used by the bridge (Task 7) + tests
