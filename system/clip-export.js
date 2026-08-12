// clip-export.js: a short WebM of any live canvas, shared by every surface
// that animates. Construction is guarded (Safari exposes the APIs but throws
// on WebM), the caller narrates via onTick/onDone, and stop() ends early.

export function canRecordClips(win, canvas) {
  const w = win || window;
  return !!(w.MediaRecorder && canvas && typeof canvas.captureStream === "function");
}

export function pickMime(mr) {
  const M = mr || MediaRecorder;
  const want = "video/webm;codecs=vp9";
  try { if (M.isTypeSupported && M.isTypeSupported(want)) return want; } catch (_) {}
  return "video/webm";
}

// Returns {stop} on success, null when recording cannot start. opts:
// seconds (default 6), name (download filename), fps (default 30),
// onTick(secondsLeft), onDone(ok). The blob downloads via an anchor.
export function recordClip(canvas, opts = {}) {
  const seconds = Math.max(1, opts.seconds || 6);
  const name = opts.name || "clip.webm";
  const onTick = opts.onTick || (() => {});
  const onDone = opts.onDone || (() => {});
  let rec = null;
  try {
    rec = new MediaRecorder(canvas.captureStream(opts.fps || 30),
      { mimeType: pickMime(), videoBitsPerSecond: 8000000 });
  } catch (_) { return null; }
  const chunks = [];
  let finished = false, timer = 0;
  const startedAt = Date.now();
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const finish = () => {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    // Honest accounting: the caller learns how long was really captured, so
    // an early stop or a mid-run error never claims the full take.
    const took = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    if (chunks.length) {
      const a = document.createElement("a");
      a.download = name;
      a.href = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      onDone(true, took);
    } else onDone(false, took);
  };
  rec.onstop = finish;
  rec.onerror = finish;
  try { rec.start(250); } catch (_) { return null; }
  let left = seconds;
  onTick(left);
  timer = setInterval(() => {
    left--;
    if (left <= 0) { clearInterval(timer); try { rec.stop(); } catch (_) { finish(); } }
    else onTick(left);
  }, 1000);
  return { stop: () => { try { rec.stop(); } catch (_) { finish(); } } };
}
