// live-describe.mjs: the description of a live canvas, kept true to what it draws without talking over the page.
//
//   liveDescription(el, opts)   returns { update(compute), flush(compute) }. update() runs compute() at most once
//                               every `every` ms (2 s by default), so the words cost nothing on the frames between;
//                               compute returns { text, facts } from chart-describe.mjs. The text becomes the
//                               canvas's aria-label (the sentence first, then `axes`), which a screen reader reads
//                               when the visitor reaches the canvas and never announces by itself. as: "text" writes
//                               the words into a text element instead, for a canvas that is hidden from readers.
//   opts.live, opts.key         an aria-live="polite" element and a function from facts to a coarse state ("still",
//                               "moving", "silent"). The live element speaks only when that state changes, and at
//                               most once every `quiet` ms (20 s by default): a change that matters, never a stream.
//
// Pure apart from the two DOM writes, and the clock is injectable, so node tests drive it with fake elements.

export function liveDescription(el, { every = 2000, quiet = 20000, axes = "", live = null, key = null, as = "label", now = () => performance.now() } = {}) {
  let last = -Infinity, lastText = null, spokenKey, spokenAt = -Infinity, spoke = false;
  const apply = (d, t) => {
    const label = axes ? `${d.text} ${axes}` : d.text;
    if (label !== lastText && el) { if (as === "text") el.textContent = label; else el.setAttribute("aria-label", label); lastText = label; }
    if (!live || !key) return d;
    const k = key(d.facts);
    if (!spoke) { spoke = true; spokenKey = k; return d; }       // the first reading sets the state; it is not news
    if (k !== spokenKey && t - spokenAt >= quiet) { live.textContent = d.text; spokenKey = k; spokenAt = t; }
    return d;
  };
  return {
    update(compute) {
      const t = now();
      if (t - last < every) return null;
      last = t;
      return apply(compute(), t);
    },
    flush(compute) { const t = now(); last = t; return apply(compute(), t); },
    get label() { return lastText; },
  };
}
