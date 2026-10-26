// demo-worker.js: a promise wrapper round render-worker.js. One worker, requests queued by id.
let worker = null, next = 0;
const waiting = new Map();
function get() {
  if (worker) return worker;
  worker = new Worker(new URL('./render-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    const w = waiting.get(data.id); if (!w) return;
    if (data.progress !== undefined) { w.onProgress?.(data.progress); return; }
    waiting.delete(data.id);
    if (data.error) { console.error('render worker:', data.error); w.reject(new Error(data.error)); } else w.resolve(data);
  };
  worker.onerror = (e) => { console.error('render worker failed', e.message); for (const w of waiting.values()) w.reject(e); waiting.clear(); };
  return worker;
}
// renderOff({ scene, seed, width, out }, onProgress) -> Promise<{ w, h, buffer }>
export function renderOff(msg, onProgress) {
  const id = ++next;
  return new Promise((resolve, reject) => { waiting.set(id, { resolve, reject, onProgress }); get().postMessage({ ...msg, id }); });
}
