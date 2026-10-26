// lib/offload.js: run a pure function from an alive module in a module worker, so setup work (depth estimates,
// sheet slicing, loop measurement) never blocks a frame. Falls back to calling it here when workers are missing.
let worker = null, seq = 0; const waiting = new Map();
function get() {
  if (worker || typeof Worker !== 'function') return worker;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => { const w = waiting.get(e.data.id); if (!w) return; waiting.delete(e.data.id); e.data.ok ? w.res(e.data.value) : w.rej(new Error(e.data.error)); };
    worker.onerror = (e) => { console.error('alive: worker failed, running setup on the main thread', e.message); worker = false; for (const w of waiting.values()) w.retry(); waiting.clear(); };
  } catch (e) { console.warn('alive: no module worker', e.message); worker = false; }
  return worker;
}
export function offload(mod, fn, ...args) {
  const url = new URL(mod, import.meta.url).href, local = async () => (await import(url))[fn](...args);
  const w = get(); if (!w) return local();
  return new Promise((res, rej) => { const id = ++seq; waiting.set(id, { res, rej, retry: () => local().then(res, rej) }); w.postMessage({ id, mod: url, fn, args }); });
}
