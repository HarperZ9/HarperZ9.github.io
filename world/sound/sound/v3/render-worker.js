// Module worker: renders instrument notes and phrases off the main thread. Message in: { id, inst, params, call, args };
// message out: { id, L, R, sr } with transferable buffers, or { id, error }.
import { calls } from './calls.js';

self.onmessage = (ev) => {
  const { id, params, call, args } = ev.data;
  try { const r = calls[call](params, args), L = r.L, R = r.R === r.L ? r.L.slice() : r.R; self.postMessage({ id, L, R, sr: args.sr }, [L.buffer, R.buffer]); }
  catch (err) { self.postMessage({ id, error: String(err && err.stack || err) }); }
};
