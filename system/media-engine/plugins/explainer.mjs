// system/media-engine/plugins/explainer.mjs
// The explainer plugin: draws one frame of an explainer from its scene spec, live in the page.
//
// The offline video (tools/explainer/render.py) and this plugin read the same spec.json and
// compute what a frame shows with twin functions (tools/explainer/scene.py and
// system/explainer/state.mjs, checked frame by frame in tests/test_explainer_parity.py). This file
// only rasterises that state on a Canvas2D, at the video's 1280 x 720 layout scaled to the canvas.
//
// The stage keeps the video's dark ground in both page themes: it is the video's frame, and the
// MP4 stays the fallback for reduced motion, no script, sharing and receipts. Status colour is the
// dark pole of the engine's risk tokens, and only the one hot mark per view is drawn in colour.
//
// params: { slug, spec_sha256, overrides, t, playing }, all plain data so a receipt can hash them. The spec, receipt and art for a slug are
// registered with registerExplainer() first, so a frame receipt's request carries the spec hash
// and the parameter values, not the whole spec.

import { RISK_TOKENS } from "../colour.mjs";
import { resolvedScenes, timeline, frameState } from "../../explainer/state.mjs";

const W = 1280, H = 720;
const T = RISK_TOKENS.dark;
const GROUND = "#060608", HAIR = "#2a2830", INK = T.ink, QUIET = T.quiet;
const SANS = '"Hanken Grotesk", system-ui, sans-serif', MONO = '"Conso", ui-monospace, monospace';
const FONTS = { h1: `600 54px ${SANS}`, body: `400 34px ${SANS}`, cap: `400 27px ${SANS}`, mono: `400 28px ${MONO}`, small: `400 20px ${MONO}` };
const registry = new Map();

export function registerExplainer(slug, { spec, receipt = null, art = null }) {
  registry.set(slug, { spec, receipt, art, rows: timeline(spec, receipt) });
}
export function explainerData(slug) { return registry.get(slug) || null; }

function text(ctx, x, y, s, font, col, a) {
  if (a <= 0) return;
  ctx.font = FONTS[font];
  ctx.globalAlpha = Math.min(1, a);
  ctx.fillStyle = col;
  const m = ctx.measureText(s);
  ctx.fillText(s, x, y + (m.fontBoundingBoxAscent ?? 0.8 * parseInt(FONTS[font].split(" ")[1], 10)));
  ctx.globalAlpha = 1;
}
const width = (ctx, s, font) => { ctx.font = FONTS[font]; return ctx.measureText(s).width; };
const ease = (u) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };

function rect(ctx, x0, y0, x1, y1, a, { fill = null, stroke = null, lw = 1 } = {}) {
  if (a <= 0) return;
  ctx.globalAlpha = Math.min(1, a);
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(x0, y0, x1 - x0 + 1, y1 - y0 + 1); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x0 + lw / 2, y0 + lw / 2, x1 - x0 + 1 - lw, y1 - y0 + 1 - lw); }
  ctx.globalAlpha = 1;
}

function levelTag(ctx, right, y, m, a) {
  const col = m.hot ? T[m.risk] : QUIET;
  const word = String(m.verdict || m.risk).toUpperCase();
  text(ctx, right - width(ctx, word, "mono"), y, word, "mono", col, a);
  const sub = `${m.risk} liability`;
  text(ctx, right - width(ctx, sub, "small"), y + 34, sub, "small", col, a);
}

const DRAW = {
  card(ctx, y, m) {
    const a = m.alpha;
    if (a <= 0) return y + 100;
    rect(ctx, 140, y, W - 140, y + 84, a, { stroke: HAIR });
    text(ctx, 164, y + 12, m.label, "small", QUIET, a);
    text(ctx, 164, y + 40, String(m.value), "mono", INK, a);
    if (m.risk) {
      if (m.hot) rect(ctx, W - 152, y, W - 140, y + 84, a, { fill: T[m.risk] });
      levelTag(ctx, W - 176, y + 14, m, a);
    }
    return y + 100;
  },
  note(ctx, y, m) {
    const a = m.alpha;
    if (a <= 0) return y + 44;
    if (m.risk) {
      const col = m.hot ? T[m.risk] : QUIET;
      rect(ctx, 140, y + 8, 152, y + 20, a, { fill: col });
      text(ctx, 164, y, `${m.text}  (${m.risk} liability)`, "small", col, a);
    } else text(ctx, 164, y, m.text, "small", QUIET, a);
    return y + 44;
  },
  bars(ctx, y, m) {
    for (const item of m.items) {
      const len = Math.max(4, ((W - 300 - 470) * item.value / m.scale) * ease(item.alpha));
      text(ctx, 140, y + 6, item.label, "body", INK, item.alpha);
      rect(ctx, 470, y + 10, 470 + len, y + 44, item.alpha * 0.9, { fill: item.strong ? INK : QUIET });
      text(ctx, 470 + len + 16, y + 12, item.display, "mono", QUIET, item.alpha);
      y += 72;
    }
    return y + 8;
  },
  grid(ctx, y, m) {
    const cell = 18, gap = 6, perRow = 25, rows = Math.ceil(m.count / perRow);
    if (m.alpha <= 0) return y + 4 * (cell + gap) + 44;
    for (let i = 0; i < m.count; i++) {
      const x0 = 140 + (i % perRow) * (cell + gap), y0 = y + Math.floor(i / perRow) * (cell + gap);
      if (i < m.filled) rect(ctx, x0, y0, x0 + cell, y0 + cell, m.alpha, { fill: INK });
      else rect(ctx, x0, y0, x0 + cell, y0 + cell, m.alpha, { stroke: QUIET });
    }
    text(ctx, 140, y + rows * (cell + gap) + 4, m.label, "small", QUIET, m.alpha);
    return y + rows * (cell + gap) + 44;
  },
  tries(ctx, y, m) {
    const n = m.slots.length, w = (W - 280 - 12 * (n - 1)) / n;
    for (const s of m.slots) {
      const a = s.alpha * (s.in_budget ? 1 : 0.45);
      if (a <= 0) continue;
      const x0 = 140 + (s.n - 1) * (w + 12), solid = s.word === "PASS";
      rect(ctx, x0, y, x0 + w, y + 84, a, { stroke: solid ? INK : HAIR, lw: solid ? 2 : 1 });
      text(ctx, x0 + 14, y + 12, `candidate ${s.n}`, "small", QUIET, a);
      text(ctx, x0 + 14, y + 42, s.word, s.word.includes(" ") ? "small" : "mono", solid ? INK : QUIET, a);
    }
    return y + 104;
  },
};

function caption(ctx, say) {
  const lines = [""];
  for (const word of say.split(/\s+/)) {
    const trial = (lines[lines.length - 1] + " " + word).trim();
    if (width(ctx, trial, "cap") > W - 280 && lines[lines.length - 1]) lines.push(word);
    else lines[lines.length - 1] = trial;
  }
  let y = H - 36 - 38 * lines.length;
  for (const line of lines) { text(ctx, (W - width(ctx, line, "cap")) / 2, y, line, "cap", QUIET, 1); y += 38; }
}

export function drawState(ctx, state, art) {
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, W, H);
  const a = state.heading_alpha;
  if (state.layout === "title" || state.layout === "close") {
    const close = state.layout === "close";
    if (art && art.complete && art.naturalWidth) ctx.drawImage(art, (W - 560) / 2, close ? -40 : 8, 560, 560);
    text(ctx, (W - width(ctx, state.heading, "h1")) / 2, close ? 482 : 580, state.heading, "h1", INK, a);
    if (state.command) text(ctx, (W - width(ctx, state.command, "small")) / 2, 556, state.command, "small", QUIET, a);
  } else {
    text(ctx, 140, 96, state.heading, "h1", INK, a);
    let y = 210;
    for (const m of state.marks) y = DRAW[m.type](ctx, y, m);
  }
  if (state.layout !== "title") caption(ctx, state.say);
}

export const explainer = {
  id: "explainer",
  version: "1.0.0",
  backends: ["canvas2d"],
  create({ canvas, params }) {
    const ctx = canvas.getContext("2d");
    let p = { ...params };
    let scenes = null, sceneKey = "", lastT = null;
    const data = () => registry.get(p.slug);
    const prepare = () => {
      const d = data();
      if (!d) throw new Error("explainer: " + p.slug + " is not registered");
      const key = JSON.stringify(p.overrides || {});
      if (!scenes || key !== sceneKey) { scenes = resolvedScenes(d.spec, p.overrides || {}); sceneKey = key; }
      return d;
    };
    const instance = {
      static: !p.playing,
      backend: "canvas2d",
      playhead: Number(p.t) || 0,
      state: null,
      frame(_t, dt) {
        const d = prepare();
        const end = d.rows[d.rows.length - 1][2];
        if (p.playing && dt > 0) {
          // The scheduler's dt is one display frame, and minFrameMs skips frames, so the playhead
          // advances by the time since this instance last drew (capped, so a return from a hidden
          // tab does not jump).
          const step = lastT == null ? Math.min(dt, 0.1) : Math.min(Math.max(0, _t - lastT), 0.1);
          lastT = _t;
          const before = instance.playhead;
          instance.playhead = Math.min(end, instance.playhead + step);
          if (instance.onTick) instance.onTick(instance.playhead, before);
        }
        const w = canvas.width, h = canvas.height;
        ctx.setTransform(w / W, 0, 0, h / H, 0, 0);
        instance.state = frameState(scenes, d.rows, instance.playhead);
        drawState(ctx, instance.state, d.art);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      },
      // The page moves the playhead directly (instance.playhead = t, then handle.redraw()). params.t
      // is read once at create and is otherwise only recorded, so a frame receipt names its time.
      onTick: null,
      setParams(next) {
        if (next.playing && !p.playing) lastT = null;
        p = { ...p, ...next };
        instance.static = !p.playing;
      },
      resize() {},
      readPixels() {
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return new Uint8Array(img.data.buffer.slice(0));
      },
      dispose() {},
    };
    return instance;
  },
};
