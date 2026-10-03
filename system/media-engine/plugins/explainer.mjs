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
// params: { slug, spec_sha256, overrides, t, playing, type_scale, caption }, all plain data so a receipt can hash them. The spec, receipt and art for a slug are
// registered with registerExplainer() first, so a frame receipt's request carries the spec hash
// and the parameter values, not the whole spec.

import { RISK_TOKENS } from "../colour.mjs";
import { resolvedScenes, timeline, frameState } from "../../explainer/state.mjs";

const W = 1280, H = 720;
const T = RISK_TOKENS.dark;
const GROUND = "#060608", HAIR = "#2a2830", INK = T.ink, QUIET = T.quiet;
const SANS = '"Hanken Grotesk", system-ui, sans-serif', MONO = '"Conso", ui-monospace, monospace';
// Type sizes in the 1280 x 720 frame. On a narrow stage the page passes a type scale above 1:
// every size and vertical step grows by it, and text that would run past its slot is fitted to
// the slot's width. At scale 1 the stage draws the video's layout.
const PX = { h1: 54, body: 34, cap: 27, mono: 28, small: 20 };
const FACE = { h1: ["600", SANS], body: ["400", SANS], cap: ["400", SANS], mono: ["400", MONO], small: ["400", MONO] };
let K = 1;
const font = (name) => `${FACE[name][0]} ${Math.round(PX[name] * K)}px ${FACE[name][1]}`;
const k = (n) => n * K;
const registry = new Map();

export function registerExplainer(slug, { spec, receipt = null, art = null }) {
  registry.set(slug, { spec, receipt, art, rows: timeline(spec, receipt) });
}
export function explainerData(slug) { return registry.get(slug) || null; }

function text(ctx, x, y, s, face, col, a, maxW = W) {
  if (a <= 0) return;
  ctx.font = font(face);
  ctx.globalAlpha = Math.min(1, a);
  ctx.fillStyle = col;
  const m = ctx.measureText(s);
  ctx.fillText(s, x, y + (m.fontBoundingBoxAscent ?? 0.8 * PX[face] * K), Math.max(1, maxW));
  ctx.globalAlpha = 1;
}
const width = (ctx, s, face, maxW = W) => { ctx.font = font(face); return Math.min(maxW, ctx.measureText(s).width); };
// Centred in the frame, fitted to the frame less a margin.
const centred = (ctx, y, s, face, col, a) => { const w = width(ctx, s, face, W - 80); text(ctx, (W - w) / 2, y, s, face, col, a, W - 80); };
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
  text(ctx, right - width(ctx, sub, "small"), y + k(34), sub, "small", col, a);
}

const DRAW = {
  card(ctx, y, m) {
    const a = m.alpha;
    if (a <= 0) return y + k(100);
    const room = W - 140 - 164 - (m.risk ? k(210) : 24);
    rect(ctx, 140, y, W - 140, y + k(84), a, { stroke: HAIR });
    text(ctx, 164, y + k(12), m.label, "small", QUIET, a, room);
    text(ctx, 164, y + k(40), String(m.value), "mono", INK, a, room);
    if (m.risk) {
      if (m.hot) rect(ctx, W - 152, y, W - 140, y + k(84), a, { fill: T[m.risk] });
      levelTag(ctx, W - 176, y + k(14), m, a);
    }
    return y + k(100);
  },
  note(ctx, y, m) {
    const a = m.alpha;
    if (a <= 0) return y + k(44);
    if (m.risk) {
      const col = m.hot ? T[m.risk] : QUIET;
      rect(ctx, 140, y + k(8), 152, y + k(20), a, { fill: col });
      text(ctx, 164, y, `${m.text}  (${m.risk} liability)`, "small", col, a, W - 164 - 140);
    } else text(ctx, 164, y, m.text, "small", QUIET, a, W - 164 - 140);
    return y + k(44);
  },
  bars(ctx, y, m) {
    for (const item of m.items) {
      const len = Math.max(4, ((W - 300 - 470) * item.value / m.scale) * ease(item.alpha));
      text(ctx, 140, y + k(6), item.label, "body", INK, item.alpha, 470 - 140 - 16);
      rect(ctx, 470, y + k(10), 470 + len, y + k(44), item.alpha * 0.9, { fill: item.strong ? INK : QUIET });
      text(ctx, 470 + len + 16, y + k(12), item.display, "mono", QUIET, item.alpha, W - (470 + len + 16) - 24);
      y += k(72);
    }
    return y + k(8);
  },
  grid(ctx, y, m) {
    const cell = k(18), gap = k(6), perRow = 25, rows = Math.ceil(m.count / perRow);
    if (m.alpha <= 0) return y + 4 * (cell + gap) + 44;
    for (let i = 0; i < m.count; i++) {
      const x0 = 140 + (i % perRow) * (cell + gap), y0 = y + Math.floor(i / perRow) * (cell + gap);
      if (i < m.filled) rect(ctx, x0, y0, x0 + cell, y0 + cell, m.alpha, { fill: INK });
      else rect(ctx, x0, y0, x0 + cell, y0 + cell, m.alpha, { stroke: QUIET });
    }
    text(ctx, 140, y + rows * (cell + gap) + k(4), m.label, "small", QUIET, m.alpha, W - 280);
    return y + rows * (cell + gap) + k(44);
  },
  tries(ctx, y, m) {
    const n = m.slots.length, w = (W - 280 - 12 * (n - 1)) / n;
    for (const s of m.slots) {
      const a = s.alpha * (s.in_budget ? 1 : 0.45);
      if (a <= 0) continue;
      const x0 = 140 + (s.n - 1) * (w + 12), solid = s.word === "PASS";
      rect(ctx, x0, y, x0 + w, y + k(84), a, { stroke: solid ? INK : HAIR, lw: solid ? 2 : 1 });
      text(ctx, x0 + 14, y + k(12), `candidate ${s.n}`, "small", QUIET, a, w - 28);
      text(ctx, x0 + 14, y + k(42), s.word, s.word.includes(" ") ? "small" : "mono", solid ? INK : QUIET, a, w - 28);
    }
    return y + k(104);
  },
};

function caption(ctx, say) {
  const lines = [""];
  for (const word of say.split(/\s+/)) {
    const trial = (lines[lines.length - 1] + " " + word).trim();
    if (width(ctx, trial, "cap") > W - 280 && lines[lines.length - 1]) lines.push(word);
    else lines[lines.length - 1] = trial;
  }
  let y = H - 36 - k(38) * lines.length;
  for (const line of lines) { text(ctx, (W - width(ctx, line, "cap")) / 2, y, line, "cap", QUIET, 1); y += k(38); }
}

// opts.scale: the type scale, 1 to 1.5 (1 draws the video's layout). opts.caption: false leaves
// the caption to the page, which sets it as text under a narrow stage.
export function drawState(ctx, state, art, { scale = 1, caption: withCaption = true } = {}) {
  K = Math.min(1.5, Math.max(1, Number(scale) || 1));
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, W, H);
  const a = state.heading_alpha;
  if (state.layout === "title" || state.layout === "close") {
    const close = state.layout === "close";
    if (art && art.complete && art.naturalWidth) ctx.drawImage(art, (W - 560) / 2, close ? -40 : 8, 560, 560);
    centred(ctx, close ? 482 : 580, state.heading, "h1", INK, a);
    if (state.command) centred(ctx, 482 + k(74), state.command, "small", QUIET, a);
  } else {
    text(ctx, 140, 96, state.heading, "h1", INK, a, W - 280);
    let y = 210;
    for (const m of state.marks) y = DRAW[m.type](ctx, y, m);
  }
  if (state.layout !== "title" && withCaption) caption(ctx, state.say);
  K = 1;
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
        drawState(ctx, instance.state, d.art, { scale: p.type_scale, caption: p.caption !== false });
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
