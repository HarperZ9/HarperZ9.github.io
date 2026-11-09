// Shared by the lessons and demos: where the vendored engine lives, a tiny element helper, and
// the drawing backend. WebGPU (raw-native's Motion renderer, with the template looks as post
// passes) where the browser has it; raw-native's Canvas 2D drawer everywhere else.
export const ENGINE = new URL("../../media/raw-native/tree-ada041f/", import.meta.url);

export const el = (tag, attrs = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (k === "text") n.textContent = v; else n.setAttribute(k, v);
  for (const k of [].concat(kids)) n.append(k);
  return n;
};

export const loadAtlas = async () => ({ atlas: await (await fetch(new URL("docs/motion/hanken-grotesk-500.atlas.json", ENGINE))).json() });

// images: name -> { width, height, data (RGBA8) }, for image paints (a guide's textures).
export async function backend(canvas, A, { reduced = false, force2d = false, title = "demo", images = {} } = {}) {
  if (!force2d && navigator.gpu) {
    try {
      const { createEngine } = await import(new URL("web/motion/engine.mjs", ENGINE).href);
      await import(new URL("web/shaders/post.mjs", ENGINE).href);
      let current = null;
      const scene = { title, duration: 1e9, fps: 30, async load() { return A; }, frame: () => current };
      const eng = await createEngine({ canvas, scene, sceneUrl: import.meta.url, timing: false, reduced });
      for (const [name, im] of Object.entries(images)) eng.motion.image(name, im);
      return { kind: "webgpu", async draw(list, i) { current = list; const l = eng.list(0); await eng.motion.prepare(l); eng.motion.draw(l, { frame: i, time: i / 30 }); }, resize: (w, h) => eng.resize(w, h) };
    } catch (e) { console.warn(`${title}: WebGPU unavailable, drawing with Canvas 2D:`, e); }
  }
  const { drawFrame } = await import(new URL("web/motion/canvas2d.mjs", ENGINE).href);
  const g = canvas.getContext("2d"), pics = {};
  for (const [name, im] of Object.entries(images)) {
    const c = document.createElement("canvas");
    c.width = im.width; c.height = im.height;
    c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(im.data), im.width, im.height), 0, 0);
    pics[name] = c;
  }
  return { kind: "canvas2d", async draw(list) { drawFrame(g, list, { width: canvas.width, height: canvas.height, images: pics }); }, resize: (w, h) => { canvas.width = w; canvas.height = h; } };
}

// Keep the canvas's pixels matched to its laid-out width (16:9), up to 1920 wide.
export function fitCanvas(canvas, be, onResize) {
  const fit = () => { const w = Math.min(1920, Math.max(320, Math.round(canvas.clientWidth * Math.min(2, devicePixelRatio || 1)))); be.resize(w, Math.round(w * 9 / 16)); if (onResize) onResize(); };
  fit();
  addEventListener("resize", fit);
  return () => removeEventListener("resize", fit);
}
