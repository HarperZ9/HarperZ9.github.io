// Walkthroughs: a guided tour of a terminal session, drawn from a recording of
// what the commands really printed. The media tool (tools/media) runs each step
// at the release commit and writes the recording; this module turns the spec and
// the recording into a scene: the command typed, its output appearing at its
// recorded pace (compressed), long output elided, marked lines lit and the
// camera moving to them, and the step's words as a caption.
//
//   import { walkthroughScene } from "./walkthrough.mjs";
//   export default walkthroughScene({ spec: "first-run.json", cast: "first-run.cast.json", atlas: "atlas.json" });
//
// spec: { title, subtitle, steps: [{ say, display?, highlight?, keep?, clear? }] }
// cast: { steps: [{ cmd, lines: [{ t, text }], exit, seconds }], commit, platform }
// timing (optional): narration rows; step k follows the rows of segment k.
import { rect, circle, contour } from "./path.mjs";
import { text, glyphRun } from "./text.mjs";
import { span, window, ease, lerp } from "./timeline.mjs";

const C = { ink: "#ece5d6", ink2: "#b8b0a0", dim: "#958e80", frame: "#2a2830", panel: "#0d0d11", ok: "#63d4ce", hot: "#e29472", unv: "#b3b1e6" };
const P = { x: 140, y: 110, w: 1640, h: 790, bar: 40, pad: 28, size: 27, lh: 35 };
const COLS = Math.floor((P.w - 2 * P.pad) / (P.size * 0.6)), ROWS = Math.floor((P.h - P.bar - 2 * P.pad) / P.lh);
const TITLE = 3.4, END = 3.0, WPS = 2.6;

// A fixed-width line from any atlas: each glyph sits centred in its cell.
function cellLine(str, atlas, x, y, size) {
  const cw = size * 0.6, shape = [];
  [...str].forEach((ch, i) => {
    if (ch === " ") return;
    const g = glyphRun(ch, { atlas, size, x: 0, y: 0 });
    const dx = x + i * cw + (cw - g.width) / 2;
    for (const c of g.shape) {
      const p = new Float32Array(c.pts.length);
      for (let k = 0; k < p.length; k += 2) { p[k] = c.pts[k] + dx; p[k + 1] = c.pts[k + 1] + y; }
      shape.push(contour(p, c.closed));
    }
  });
  return shape;
}
// Words into lines of at most n characters.
export function wrap(s, n) {
  const out = [];
  for (const w of s.split(/\s+/).filter(Boolean)) {
    if (out.length && (out[out.length - 1] + " " + w).length <= n) out[out.length - 1] += " " + w; else out.push(w);
  }
  return out;
}
const clip = (s) => (s.length > COLS ? s.slice(0, COLS - 1) + "~" : s);

// Lay the steps out on a timeline: when each is typed, when each line shows.
export function plan(spec, cast, timing = null) {
  const segStart = {}, segEnd = {};
  if (timing) for (const r of timing) { segStart[r.segment] ??= r.start; segEnd[r.segment] = r.end; }
  let t = TITLE;
  const steps = spec.steps.map((s, k) => {
    const rec = cast.steps[k] || { cmd: "", lines: [], exit: 0, seconds: 0 };
    const cmd = s.display || rec.cmd;
    const keep = s.keep ?? 14;
    let lines = rec.lines.filter((l) => l.text.trim() !== "" || true);
    let elided = 0;
    if (lines.length > keep) { elided = lines.length - keep; lines = [{ t: lines[0].t, text: `... ${elided} more lines ...`, elision: true }, ...lines.slice(-keep)]; }
    const typing = Math.min(1.6, 0.25 + cmd.length * 0.03);
    const lastT = Math.max(0.001, ...lines.map((l) => l.t));
    const reveal = Math.min(2.6, lastT, 0.15 * lines.length + 0.3);
    const words = (s.say || "").split(/\s+/).filter(Boolean).length;
    const start = timing && segStart[k + 1] !== undefined ? Math.max(t, segStart[k + 1] - 0.3) : t;
    const sayEnd = timing && segEnd[k + 1] !== undefined ? segEnd[k + 1] : start + words / WPS;
    const dur = Math.max(sayEnd - start + 0.6, typing + reveal + 1.4);
    const hl = s.highlight ? new RegExp(s.highlight) : null;
    const out = lines.map((l) => ({ ...l, at: start + typing + 0.2 + (l.t / lastT) * reveal, lit: hl ? hl.test(l.text) : false }));
    const step = { ...s, k, cmd, start, typing, end: start + dur, lines: out, exit: rec.exit, clear: !!s.clear, elided };
    t = start + dur;
    return step;
  });
  return { steps, duration: t + END, title: spec.title, subtitle: spec.subtitle || "" };
}

export function walkthroughScene({ spec, cast, atlas, timing = null, fps = 30 }) {
  const scene = {
    title: "Walkthrough", duration: 60, fps, design: [1920, 1080], params: [], chapters: [],
    async load(ctx) {
      const [S, R, A, T] = await Promise.all([ctx.json(spec), ctx.json(cast), ctx.json(atlas), timing ? ctx.json(timing).catch(() => null) : null]);
      const pl = plan(S, R, T);
      this.duration = pl.duration;
      this.title = S.title;
      this.chapters = [{ t: 0, title: S.title }, ...pl.steps.map((s) => ({ t: s.start, title: s.chapter || s.cmd.slice(0, 40) }))];
      const titleShape = text(S.title, { atlas: A, size: 64, x: 960, y: 500, anchor: "center" }).shape;
      const sub = text(pl.subtitle || (R.commit ? `at commit ${R.commit.slice(0, 7)}` : ""), { atlas: A, size: 30, x: 960, y: 570, anchor: "center" }).shape;
      const recorded = text(`recorded ${R.platform || ""}${R.commit ? ", commit " + R.commit.slice(0, 7) : ""}: the output shown is what these commands printed`,
        { atlas: A, size: 20, x: P.x, y: P.y + P.h + 34 }).shape;
      // Every line the terminal will show, in order, with its shape laid out once.
      const rows = [];
      for (const s of pl.steps) {
        if (s.clear) rows.push({ clear: true, at: s.start });
        rows.push({ at: s.start, prompt: true, text: s.cmd, step: s, shape: null });
        for (const l of s.lines) rows.push({ at: l.at, text: clip(l.text), lit: l.lit, elision: l.elision, step: s });
      }
      for (const r of rows) if (!r.clear) r.shape = cellLine(r.prompt ? "$ " + clip(r.text) : r.text, A, 0, 0, P.size);
      const captions = pl.steps.map((s) => ({ s, shape: wrap(s.say || "", 72).flatMap((ln, i, all) => text(ln, { atlas: A, size: 32, x: 960, y: 1030 - (all.length - 1 - i) * 40, anchor: "center" }).shape) }));
      this.captions = () => walkthroughVtt(pl);
      return { A, pl, rows, titleShape, sub, recorded, captions };
    },
    frame(t, ctx) {
      const { pl, rows, titleShape, sub, recorded, captions } = ctx.assets, items = [];
      const title = window(t, 0, TITLE + 0.2, 0.6, 0.8);
      if (title > 0) { items.push({ shape: titleShape, fill: C.ink, opacity: title, screen: true }, { shape: sub, fill: C.ink2, opacity: title, screen: true }); }
      const panel = span(t, TITLE - 0.6, TITLE + 0.4, ease.out) * (1 - span(t, pl.duration - 1.2, pl.duration));
      let cam = { x: 960, y: 540, zoom: 1 };
      if (panel > 0) {
        items.push({ shape: rect(P.x, P.y, P.w, P.h, 12), fill: C.panel, stroke: C.frame, width: 1.5, opacity: panel });
        items.push({ shape: [contour([P.x, P.y + P.bar, P.x + P.w, P.y + P.bar], false)], stroke: C.frame, width: 1.2, opacity: panel });
        for (let k = 0; k < 3; k++) items.push({ shape: circle(P.x + 28 + k * 22, P.y + P.bar / 2, 6, 24), stroke: C.dim, width: 1.2, opacity: panel });
        items.push({ shape: recorded, fill: C.dim, opacity: panel * 0.9, screen: true });
        // The visible rows: everything shown so far since the last clear, the last ROWS of it.
        const shown = [];
        for (const r of rows) {
          if (r.at > t) break;
          if (r.clear) { shown.length = 0; continue; }
          shown.push(r);
        }
        // Scroll smoothly: the newest row eases in from one line down.
        const extra = Math.max(0, shown.length - ROWS);
        const newest = shown.length ? shown[shown.length - 1] : null;
        const ease1 = newest ? span(t, newest.at, newest.at + 0.18, ease.out) : 1;
        const scroll = extra - 1 + ease1;
        let litY = null;
        for (let i = Math.max(0, extra - 1); i < shown.length; i++) {
          const r = shown[i], row = i - scroll;
          if (row < -0.5) continue;
          const y = P.y + P.bar + P.pad + (row + 0.75) * P.lh;
          let shape = r.shape;
          if (r.prompt) {
            const n = Math.floor(2 + (r.text.length) * span(t, r.at, r.at + r.step.typing, ease.linear));
            shape = cellLine(("$ " + clip(r.text)).slice(0, n), ctx.assets.A, 0, 0, P.size);
          }
          const moved = shape.map((c) => { const p = new Float32Array(c.pts.length); for (let k = 0; k < p.length; k += 2) { p[k] = c.pts[k] + P.x + P.pad; p[k + 1] = c.pts[k + 1] + y; } return contour(p, c.closed); });
          const live = t >= r.step.start && t < r.step.end;
          const color = r.prompt ? C.ink : r.elision ? C.dim : r.lit && live ? (r.step.exit === 0 ? C.ok : C.hot) : C.ink2;
          const fade = r.prompt ? 1 : span(t, r.at, r.at + 0.15);
          items.push({ shape: moved, fill: color, opacity: panel * fade * (live || r.prompt ? 1 : 0.55) });
          if (r.lit && live) {
            items.push({ shape: rect(P.x + 10, y - P.size * 0.8, 5, P.size, 2), fill: r.step.exit === 0 ? C.ok : C.hot, opacity: panel * fade });
            litY = y;
          }
        }
        // The camera leans in on a lit line while its step is on screen.
        if (litY !== null) {
          const s = pl.steps.find((q) => t >= q.start && t < q.end);
          const u = s ? Math.min(span(t, s.start + s.typing + 1.0, s.start + s.typing + 2.0, ease.inOut), 1 - span(t, s.end - 0.8, s.end, ease.inOut)) : 0;
          // Lean in toward the line, keeping the panel's left edge in frame.
          cam = { x: lerp(960, 900, u), y: lerp(540, litY, u * 0.55), zoom: lerp(1, 1.18, u) };
        }
      }
      for (const c of captions) {
        const o = window(t, c.s.start, c.s.end, 0.4, 0.4);
        if (o > 0 && c.shape.length) items.push({ shape: c.shape, fill: C.ink, opacity: o, screen: true });
      }
      return { background: [0.024, 0.024, 0.031], camera: cam, items, post: { bloom: 0.25, threshold: 0.9, vignette: 0.25, grain: 0.006 } };
    },
  };
  return scene;
}

// Captions (WebVTT) for a planned walkthrough: one cue per step's words.
export function walkthroughVtt(pl) {
  const ts = (s) => { const ms = Math.round(s * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`; };
  return "WEBVTT\n\n" + pl.steps.filter((s) => s.say).map((s) => `${ts(s.start)} --> ${ts(s.end)}\n${s.say}\n`).join("\n");
}
