// lib/worker.js: a module worker that runs one exported function of one alive module off the main thread.
// Message in: { id, mod (URL), fn, args }; message out: { id, ok, value | error }.
self.onmessage = async (e) => {
  const { id, mod, fn, args } = e.data;
  try { const m = await import(mod); self.postMessage({ id, ok: true, value: await m[fn](...args) }); }
  catch (err) { self.postMessage({ id, ok: false, error: String(err && err.stack || err) }); }
};
