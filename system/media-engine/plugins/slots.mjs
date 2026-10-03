// system/media-engine/plugins/slots.mjs
// Reserved plugin slots: renderers the engine has a place for but that do not exist on the web yet.
// Each slot names its backend, what it would render, and what it waits on, so the Studio can show
// the gap plainly instead of hiding it. A slot becomes a plugin when page.mjs registerPlugin() gives
// its pluginId a loader.

export const SLOTS = Object.freeze({
  raw: Object.freeze({
    id: "raw",
    pluginId: "raw",
    name: "RAW reference renderer",
    backend: "wasm",
    renders: "A scene drawn two ways, screen-space and ray-traced ambient occlusion, reconciled into a JSON certificate; the engine's GPU plugins would be checked against it.",
    waitsOn: "A WebAssembly build of the C++23 renderer and a page that loads it.",
    verdict: "PENDING",
    page: "raw.html",
  }),
  revival: Object.freeze({
    id: "revival",
    pluginId: "revival",
    name: "Restored BRender rasterizer",
    backend: "wasm",
    renders: "The restored BRender software rasterizer drawing its own test scenes in the browser, checked against the release receipts.",
    waitsOn: "A look at the rasterizer's state, then a WebAssembly build.",
    verdict: "PENDING",
    page: "brender-archival.html",
  }),
});

// A slot is live once page.mjs knows a loader for its pluginId (registerPlugin, or a LOADERS entry).
export function slotReady(id, known = []) { return !!(SLOTS[id] && known.includes(SLOTS[id].pluginId)); }

// A still card for a surface whose renderer is elsewhere or not built: a hairline frame and two lines
// of text in the site's faces, drawn at whatever size the host canvas has. No art pretends to be
// output it is not.
export const slotCard = {
  id: "slot-card",
  version: "1.0.0",
  backends: ["canvas2d"],
  create({ canvas, params }) {
    let drawn = "";
    const lines = [String(params.title || "Plugin slot"), String(params.note || "")];
    return {
      backend: "canvas2d",
      static: true,
      frame() {
        const key = canvas.width + "x" + canvas.height;
        if (drawn === key) return;
        const w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d"), u = Math.max(1, Math.min(w, h) / 360);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(235,229,216,0.28)"; ctx.lineWidth = u;
        ctx.setLineDash([4 * u, 6 * u]);
        ctx.strokeRect(24 * u, 24 * u, w - 48 * u, h - 48 * u);
        ctx.setLineDash([]);
        ctx.fillStyle = "#ebe5d8"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = `600 ${Math.round(20 * u)}px "Hanken Grotesk", system-ui, sans-serif`;
        ctx.fillText(lines[0], w / 2, h / 2 - 14 * u, w - 80 * u);
        ctx.fillStyle = "#9d978a";
        ctx.font = `400 ${Math.round(12 * u)}px "Conso", ui-monospace, monospace`;
        ctx.fillText(lines[1], w / 2, h / 2 + 16 * u, w - 80 * u);
        drawn = key;
      },
      readPixels() { return new Uint8Array(canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data.buffer); },
      dispose() {},
    };
  },
};
