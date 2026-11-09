// node-worker.js: run one browser-safe superframe node off the page thread and hand back a picture.
// In:  { key, adapter: "universe", id: "universe.seam-liquid", params, w, h, time: { t, duration },
//        inputs: { name: ImageBitmap } }      (picture inputs arrive as bitmaps and become linear rasters)
// Out: { key, bitmap, port } or { key, error }.
// Reusable: any adapter whose NODES are browser-safe can be named; the shell's organic-gen does the same in-page.
import { rngFrom } from "../../superframe/lib/seed.mjs";
import * as px from "../../superframe/lib/pix.mjs";

const adapters = {};
async function nodeOf(adapter, id) {
  adapters[adapter] ||= import(`../../superframe/adapters/${adapter}.mjs`);
  const m = await adapters[adapter], n = m.NODES.find((x) => x.id === id);
  if (!n) throw new Error(`node-worker: no node ${id} in ${adapter}`);
  return n;
}
function bitmapToRaster(b, w, h) {
  const c = new OffscreenCanvas(w, h), x = c.getContext("2d"), s = Math.max(w / b.width, h / b.height);
  x.drawImage(b, (w - b.width * s) / 2, (h - b.height * s) / 2, b.width * s, b.height * s);
  return px.fromSRGB8(w, h, x.getImageData(0, 0, w, h).data);
}
function paramsOf(node, given = {}) {
  const out = {}; for (const [k, p] of Object.entries(node.params)) out[k] = k in given ? given[k] : p.default; return out;
}

self.onmessage = async (e) => {
  const { key, adapter = "universe", id, params, w = 320, h = 200, time = { t: 1, duration: 1 }, inputs = {}, seed = key } = e.data;
  try {
    const node = await nodeOf(adapter, id), ins = {};
    for (const [k, v] of Object.entries(inputs)) ins[k] = v instanceof ImageBitmap ? bitmapToRaster(v, w, h) : v;
    const rng = rngFrom(String(seed)), seedInt = Math.floor(rng() * 2 ** 31);
    const out = await node.render({ inputs: ins, params: paramsOf(node, params), w, h, rng, seedInt, palette: null, time, node, id });
    const port = Object.keys(node.outputs).find((p) => node.outputs[p] === "raster");
    if (!port) throw new Error(`node-worker: ${id} has no raster output`);
    const R = out[port].w === w && out[port].h === h ? out[port] : px.resampleRaster(out[port], w, h);
    const rgba = px.toSRGB8(R, rng, { ground: "#e6ebe8" });
    const c = new OffscreenCanvas(w, h); c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, w * h * 4), w, h), 0, 0);
    const bitmap = c.transferToImageBitmap();
    self.postMessage({ key, bitmap, port }, [bitmap]);
  } catch (err) {
    console.error("node-worker:", id, err);
    self.postMessage({ key, error: String(err) });
  }
};
