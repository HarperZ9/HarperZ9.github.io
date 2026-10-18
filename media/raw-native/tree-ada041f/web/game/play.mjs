// The live host for a template's game (runtime G1): the fixed-step loop on real input, drawn
// through the Motion renderer with interpolation. ?scene=<scene module, relative to this page>.
import { createEngine } from "../motion/engine.mjs";
import "../shaders/post.mjs";
import { createSession } from "./loop.mjs";
import { createActionMap, captureBinding, emptyDevice } from "./input.mjs";
import { attachWebInput } from "./input_web.mjs";

const q = new URLSearchParams(location.search);
const sceneUrl = new URL(q.get("scene") || "../../templates/retro-thriller/scene.mjs", location.href).href;
const canvas = document.getElementById("c"), status = document.getElementById("status"), stats = document.getElementById("stats");

async function main() {
  if (!navigator.gpu) { status.textContent = "This page needs WebGPU, which this browser does not offer."; return; }
  const eng = await createEngine({ canvas, sceneUrl, shaders: new URL("../../src/renderer/gpu/shaders/", location.href).href });
  const game = eng.scene.game;
  if (!game) { status.textContent = "This scene has no game export; open it in the Motion player instead."; return; }
  document.title = eng.scene.title;
  const map = createActionMap(game.actions);
  // A saved binding set for this scene, when one exists and still names the same actions.
  const key = "raw-native.bindings:" + sceneUrl;
  try { const saved = JSON.parse(localStorage.getItem(key) || "null"); if (saved) for (const n of map.names) if (saved[n]) map.rebind(n, saved[n].bind); }
  catch (e) { console.warn("play: saved bindings ignored", e); }
  const devices = attachWebInput(canvas);
  let capturing = null;
  const input = () => { const dev = devices.poll(), f = map.sample(dev); devices.consume(); return f; };
  const session = createSession(game, { seed: +(q.get("seed") || 1), assets: eng.ctx.assets });
  const fit = () => {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(r.width * dpr), h = Math.round((w * 9) / 16);
    if (w !== eng.size[0] || h !== eng.size[1]) eng.resize(w, h);
  };
  new ResizeObserver(fit).observe(canvas); fit();
  renderBinds(map, key, (action) => { capturing = { action, base: [...devices.device.keys] }; status.textContent = `Press a key or button for ${action}`; });
  status.textContent = "Click the view to give it the keyboard.";
  canvas.focus({ preventScroll: true });
  let last = performance.now(), frames = 0, tAcc = 0;
  const tick = (now) => {
    // The first animation frame can carry a timestamp a little before the page read the clock.
    const dt = Math.min(0.25, Math.max(0, (now - last) / 1000)); last = now;
    if (capturing) {
      const base = emptyDevice(); for (const k of capturing.base) base.keys.add(k);
      const b = captureBinding(devices.poll(), base);
      if (b) { map.rebind(capturing.action, [b]); try { localStorage.setItem(key, JSON.stringify(map.toJSON())); } catch (e) { console.warn("play: bindings not saved", e); } capturing = null; devices.consume(); renderBinds(map, key); status.textContent = `Bound to ${b}`; }
    } else session.advance(dt, input);
    eng.motion.draw(game.view(session.view(), eng.ctx.assets, eng.ctx), { frame: session.loop.steps, time: session.loop.time });
    frames++; tAcc += dt;
    if (tAcc > 1) { stats.textContent = `${(frames / tAcc).toFixed(0)} frames/s, ${game.hz || 60} steps/s, step ${session.loop.steps}`; frames = 0; tAcc = 0; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  // For tests and tools: the session, the action map, and a read-back of the current view.
  window.__game = { session, map, engine: eng, capture: () => eng.motion.capture(game.view(session.view(), eng.ctx.assets, eng.ctx), { frame: session.loop.steps, time: session.loop.time }) };
}

function renderBinds(map, key, onRebind = renderBinds.cb) {
  renderBinds.cb = onRebind;
  const t = document.getElementById("binds"); t.replaceChildren();
  for (const n of map.names) {
    const tr = document.createElement("tr"), b = document.createElement("button");
    b.textContent = "Rebind"; b.addEventListener("click", () => { onRebind(n); canvas.focus({ preventScroll: true }); });
    tr.innerHTML = `<td>${n}</td><td><code>${map.bindings(n).join(", ")}</code></td>`;
    const td = document.createElement("td"); td.append(b); tr.append(td); t.append(tr);
  }
}

main().catch((e) => { status.textContent = "The game could not start: " + e.message; console.error("play:", e); });
