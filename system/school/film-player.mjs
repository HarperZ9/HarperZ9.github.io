// A lesson film played live: the same scene file the offline renderer draws, evaluated in the
// browser and drawn by raw-native (WebGPU, or its Canvas 2D drawer), with captions from the
// film's timing rows, chapters and a scrubber. Until the narration is recorded the film plays
// silent with captions, and the page says so. Mounted on a press, never on load.
import { el, backend, fitCanvas } from "../lessons/stage.mjs";

const ENGINE = new URL("../../media/raw-native/tree-c6b114d/", import.meta.url);
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export async function mountFilm(box, { scene: sceneUrl, force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { sceneContext, loadScene, evaluate } = await import(new URL("web/motion/scene.mjs", ENGINE).href);
  const scene = (await import(sceneUrl)).default;
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": `The film: ${scene.title}. The captions below carry every spoken line.` });
  const cap = el("p", { class: "sf-cap" }), bar = el("div", { class: "sf-bar" }), chapters = el("div", { class: "sf-chapters" });
  const play = el("button", { type: "button", class: "ns-btn" }, "Play"), time = el("span", { class: "sf-time" });
  const scrub = el("input", { type: "range", min: "0", max: "1", step: "0.1", value: "0", class: "sf-scrub", "aria-label": "Position in the film" });
  bar.append(play, scrub, time);
  box.replaceChildren(canvas, cap, bar, chapters);
  // Every guide's textures (Pylon's spots and the rest) go to the drawer up front: a live scene
  // has no engine handle in load() to register them itself.
  const { QUALITY: Q, GUIDES } = await import(new URL("../../media/school/shared/lib.mjs", import.meta.url).href);
  const images = Object.assign({}, ...Object.values(GUIDES).filter((g) => g.textures).map((g) => g.textures()));
  const be = await backend(canvas, {}, { reduced, force2d, title: scene.title, images });
  Q.threads = be.kind === "webgpu" ? 1 : 0.3;
  Q.paint = be.kind === "webgpu" ? 1 : 0;
  const ctx = sceneContext(scene, { baseUrl: sceneUrl, reduced });
  await loadScene(scene, ctx);
  const rows = await ctx.json("timing.json");
  scrub.max = String(scene.duration);
  for (const c of scene.chapters) {
    const b = el("button", { type: "button" }, c.title);
    b.addEventListener("click", () => { t = c.t; show(); });
    chapters.append(b);
  }
  let t = 0, playing = false, last = 0, frameNo = 0, busy = false;
  const caption = () => { const r = rows.find((x) => t >= x.start - 0.05 && t <= x.end + 0.6); return r ? r.text : ""; };
  const show = async () => {
    scrub.value = String(t); time.textContent = `${clock(t)} / ${clock(scene.duration)}`; cap.textContent = caption();
    if (busy) return;
    busy = true;
    const t0 = performance.now();
    try { await be.draw(evaluate(scene, ctx, t), frameNo++); } finally { busy = false; }
    // A slow device draws fewer threads, so the film keeps time instead of stalling.
    const ms = performance.now() - t0;
    if (ms > 70 && Q.threads > 0.08) Q.threads = Math.max(0.08, Q.threads * 0.75);
    if (ms > 70) Q.paint = 0;
  };
  const loop = (now) => {
    if (!playing) return;
    t = Math.min(scene.duration, t + Math.min(0.1, (now - last) / 1000)); last = now;
    show();
    if (t >= scene.duration) { setPlaying(false); return; }
    requestAnimationFrame(loop);
  };
  const setPlaying = (v) => { playing = v; play.textContent = v ? "Pause" : t >= scene.duration ? "Play again" : "Play"; if (v) { if (t >= scene.duration) t = 0; last = performance.now(); requestAnimationFrame(loop); } };
  play.addEventListener("click", () => setPlaying(!playing));
  scrub.addEventListener("input", () => { t = +scrub.value; show(); });
  box.addEventListener("keydown", (e) => { if (e.key === " " && e.target === box) { e.preventDefault(); setPlaying(!playing); } });
  fitCanvas(canvas, be, () => show());
  await show();
  if (!reduced) setPlaying(true);
  return { backend: be.kind, duration: scene.duration };
}
