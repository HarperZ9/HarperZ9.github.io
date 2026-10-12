// Where a film's on-screen labels sit while a caption cue is on screen.
//
// The films' captions are the browser's own caption track over the <video>, so they sit
// where the player puts them: centred, near the bottom. CAPTION_AREA is that region in the
// film's 1920 x 1080 design units, from tools measured in headless Chrome (see SAFE_AREA_NOTE).
// A label is a filled item whose contours are mostly glyphs from the films' three atlases,
// found by shape (translation and scale removed, or by turning angles for text set on a curve),
// so labels moved, resized or bent by a scene's own helpers are still found. Each cue is sampled every STEP seconds and at its edges; a label
// counts when its opacity is over MIN_OPACITY.
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = "media/raw-native/web-23ec93f";
export const FILMS = ["checking-cost", "passing-check", "rederive", "incentives", "visible-reasoning"];
// x 0.20 to 0.80 and y 0.715 to 1 of the frame: the union of the two-line caption box in Chrome
// at page widths 1280, 768 and 375 with the controls faded (y 0.869 to 1.0, x 0.227 to 0.776),
// and at 1280 with the controls shown (y 0.734 to 0.856), plus a margin.
export const CAPTION_AREA = Object.freeze({ x0: 384, y0: 772, x1: 1536, y1: 1080 });
export const SAFE_AREA_NOTE = "Chrome, two-line cue, widths 1280/768/375 controls faded and 1280 controls shown; margin 0.015 to 0.03";
export const STEP = 0.1, MIN_OPACITY = 0.05;

const { parsePath } = await import(pathToFileURL(path.join(ROOT, ENGINE, "motion/path.mjs")).href);
const { sceneContext, loadScene, evaluate } = await import(pathToFileURL(path.join(ROOT, ENGINE, "motion/scene.mjs")).href);

// A contour's shape with translation and scale removed: point count and the first points,
// relative to the first point, over the larger side of its box.
function signature(p) {
  const n = p.length / 2;
  if (n < 3) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
  const s = Math.max(x1 - x0, y1 - y0);
  if (!(s > 0)) return null;
  const parts = [n, Math.round(((x1 - x0) / s) * 50), Math.round(((y1 - y0) / s) * 50)];
  for (let i = 2; i < Math.min(p.length, 14); i += 2) parts.push(Math.round(((p[i] - p[0]) / s) * 50), Math.round(((p[i + 1] - p[1]) / s) * 50));
  return parts.join(",");
}

// Turning angles at each point: unchanged by moving, scaling or rotating a contour, and nearly
// unchanged by the smooth bends a scene uses to set text on an arc or a ribbon.
function turning(p) {
  const n = p.length / 2, out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n, b = (i + 1) % n;
    const d1 = Math.atan2(p[2 * i + 1] - p[2 * a + 1], p[2 * i] - p[2 * a]), d2 = Math.atan2(p[2 * b + 1] - p[2 * i + 1], p[2 * b] - p[2 * i]);
    let d = d2 - d1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    out[i] = d;
  }
  return out;
}
const BENT = 0.12;   // mean turning-angle difference, in radians, still taken as the same glyph
let byCount = null;
function bentGlyph(p) {
  const list = byCount.get(p.length / 2);
  if (!list) return false;
  const tq = turning(p);
  for (const g of list) for (const sign of [1, -1]) {
    let d = 0;
    for (let i = 0; i < tq.length; i++) d += Math.abs(tq[i] - sign * g[i]);
    if (d / tq.length < BENT) return true;
  }
  return false;
}

// How far apart contour centres lie, in multiples of the median contour size.
function spread(cs) {
  const box = cs.map((c) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const p = c.pts;
    for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
    return [(x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0)]; });
  const size = box.map((b) => b[2]).sort((a, b) => a - b)[box.length >> 1] || 1;
  let far = 0;
  for (const a of box) for (const b of box) far = Math.max(far, Math.hypot(a[0] - b[0], a[1] - b[1]));
  return far / size;
}

let glyphs = null;
async function glyphSignatures() {
  if (glyphs) return glyphs;
  glyphs = new Set();
  byCount = new Map();
  for (const f of ["hanken-500", "hanken-650", "conso-400"]) {
    const atlas = JSON.parse(await readFile(path.join(ROOT, "media/explainers/motion", f + ".json"), "utf8"));
    for (const g of Object.values(atlas.glyphs)) {
      if (!g || !g.d) continue;
      for (const c of parsePath(g.d, { tolerance: atlas.unitsPerEm / 2000 })) {
        const q = new Float32Array(c.pts.length);
        for (let i = 0; i < q.length; i += 2) { q[i] = c.pts[i]; q[i + 1] = -c.pts[i + 1]; }   // text() flips y
        const sig = signature(q);
        if (sig) glyphs.add(sig);
        if (q.length >= 8) { const n = q.length / 2; if (!byCount.has(n)) byCount.set(n, []); byCount.get(n).push(turning(q)); }
      }
    }
  }
  return glyphs;
}

export function parseVtt(vtt) {
  const sec = (h, m, s, ms) => +h * 3600 + +m * 60 + +s + +ms / 1000;
  const re = /(\d+):(\d+):(\d+)\.(\d+) --> (\d+):(\d+):(\d+)\.(\d+)\r?\n((?:.+\r?\n?)+)/g;
  return [...vtt.matchAll(re)].map((g) => ({ a: sec(g[1], g[2], g[3], g[4]), b: sec(g[5], g[6], g[7], g[8]), text: g[9].trim() }));
}

export async function loadFilm(slug) {
  const file = path.join(ROOT, "media/explainers", slug, "film.scene.mjs");
  const scene = (await import(pathToFileURL(file).href)).default;
  const fetcher = async (u) => {
    const body = await readFile(fileURLToPath(u), "utf8");
    return { ok: true, json: async () => JSON.parse(body), text: async () => body };
  };
  const ctx = sceneContext(scene, { baseUrl: pathToFileURL(file).href, fetcher });
  await loadScene(scene, ctx);
  const cues = parseVtt(await readFile(path.join(ROOT, "media/explainers", slug, slug + ".vtt"), "utf8"));
  return { slug, scene, ctx, cues };
}

// The labels drawn at time t: [{ box: [x0, y0, x1, y1] in design units, opacity }].
export async function labelsAt(film, t) {
  const sigs = await glyphSignatures();
  const list = evaluate(film.scene, film.ctx, t);
  const cam = { x: 960, y: 540, zoom: 1, distance: 1000, ...(list.camera || {}) };
  const out = [];
  for (const item of list.items) {
    if (!item.shape || !item.fill || (item.opacity ?? 1) <= MIN_OPACITY) continue;
    const exact = item.shape.filter((c) => c.closed && sigs.has(signature(c.pts)));
    let glyph = exact;
    if (exact.length < item.shape.length / 2) {
      // Bent text: glyphs side by side along a line or curve. Nested rings (a contour map, a target)
      // can match a round glyph one by one, so their centres must spread over several glyph widths.
      const bent = item.shape.filter((c) => c.closed && !exact.includes(c) && c.pts.length >= 8 && bentGlyph(c.pts));
      if (bent.length >= 3 && spread(bent) > 3) glyph = [...exact, ...bent];
    }
    if (!glyph.length || glyph.length < item.shape.length / 2) continue;
    if (glyph.length === 1 && glyph[0].pts.length <= 8) continue;   // one plain box (a square, a bar) is not a word
    let k = 1, ox = 0, oy = 0;
    if (!item.screen) {
      const depth = cam.distance + (item.z || 0);
      if (depth <= 1e-3) continue;
      k = cam.zoom * cam.distance / depth; ox = 960 - cam.x * k; oy = 540 - cam.y * k;
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of glyph) for (let i = 0; i < c.pts.length; i += 2) {
      const x = c.pts[i] * k + ox, y = c.pts[i + 1] * k + oy;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0 || y1 < 0 || x0 > 1920 || y0 > 1080) continue;   // off the frame
    out.push({ box: [x0, y0, x1, y1], opacity: item.opacity ?? 1 });
  }
  return out;
}

const hits = (b, A) => b[0] < A.x1 && b[2] > A.x0 && b[1] < A.y1 && b[3] > A.y0;

// Every label that meets the caption area while a cue shows, one row per cue and label place.
export async function overlaps(film, area = CAPTION_AREA, step = STEP) {
  const rows = new Map();
  for (const cue of film.cues) {
    const ts = [];
    for (let t = cue.a; t < cue.b; t += step) ts.push(t);
    ts.push(Math.max(cue.a, cue.b - 0.001));
    for (const t of ts) {
      for (const l of await labelsAt(film, t)) {
        if (!hits(l.box, area)) continue;
        const key = `${cue.a.toFixed(2)}|${l.box.map((v) => Math.round(v / 8) * 8).join(",")}`;
        if (!rows.has(key)) rows.set(key, { cue: cue.text.replace(/\n/g, " / "), a: cue.a, b: cue.b, t: +t.toFixed(2), box: l.box.map(Math.round), opacity: +l.opacity.toFixed(2) });
      }
    }
  }
  return [...rows.values()];
}
