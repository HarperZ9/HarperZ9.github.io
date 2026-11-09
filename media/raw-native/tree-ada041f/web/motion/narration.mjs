// Narration timing for scenes. A scene lists what it says, line by line; this
// gives each line a start and end, either from a recorded narration's timing
// rows (segment k = line k) or, with no recording yet, from the words at a
// steady speaking rate. Scenes cue their pictures from these times, so the same
// scene file works before and after the narration exists. Pure; runs in Node.
//
//   const tl = sayTimeline(["First line.", "Second line."], { timing, lead: 1.5 });
//   tl.cues[1].start; tl.duration; tl.vtt()

const WPS = 2.6;

export function sayTimeline(lines, { timing = null, lead = 1.2, gap = 0.5, tail = 2.0 } = {}) {
  const seg = {};
  if (timing) for (const r of timing) { const s = (seg[r.segment] ??= { start: r.start, end: r.end }); s.start = Math.min(s.start, r.start); s.end = Math.max(s.end, r.end); }
  let t = lead;
  const cues = lines.map((text, k) => {
    const words = text.split(/\s+/).filter(Boolean).length;
    const rec = seg[k];
    const start = rec ? rec.start : t, end = rec ? rec.end : t + Math.max(1.2, words / WPS);
    t = end + gap;
    return { k, text, start, end };
  });
  const duration = (cues.length ? cues[cues.length - 1].end : lead) + tail;
  return { cues, duration, recorded: !!timing, at: (k) => cues[k].start, end: (k) => cues[k].end, vtt: () => vtt(cues) };
}

function ts(s) {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}.${p(ms % 1000, 3)}`;
}
export function vtt(cues) {
  return "WEBVTT\n\n" + cues.map((c) => `${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join("\n");
}
