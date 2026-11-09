// The lab's training loop in a worker, so the page keeps drawing while the model learns.
// Messages in: { cmd: "start", seed, mode, probe } | { cmd: "play" } | { cmd: "pause" } |
// { cmd: "step", n } | { cmd: "probe", probe }. Messages out: snapshots (lab-run.mjs).
import { createRun, snapshot } from "./lab-run.mjs";

let run = null, playing = false, timer = 0;
const send = () => postMessage({ type: "snapshot", data: snapshot(run) });

function tick() {
  if (!run || !playing) return;
  run.advance(40);
  send();
  if (run.done) { playing = false; return; }
  timer = setTimeout(tick, 0);
}

onmessage = (ev) => {
  const m = ev.data;
  try {
    if (m.cmd === "start") { clearTimeout(timer); run = createRun(m); playing = false; send(); }
    else if (m.cmd === "play" && run) { playing = true; tick(); }
    else if (m.cmd === "pause") { playing = false; clearTimeout(timer); if (run) send(); }
    else if (m.cmd === "step" && run) { run.advance(Infinity, m.n || 1); send(); }
    else if (m.cmd === "probe" && run) { run.probe = m.probe; send(); }
  } catch (e) {
    console.error("lab worker:", e);
    postMessage({ type: "error", message: String(e && e.message || e) });
  }
};
