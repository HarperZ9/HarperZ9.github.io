// The whisper down the stairwell (the old fixed-length way), and inside the lens: the dot product,
// the threads with the model's real attention, and the prism that splits the beam into heads.
import { rect, circle, polyline, C, rng, span, window, ease, lerp, words, label, pct, smooth01, clamp, darkness, glow, pose, GUIDES } from "./lib.mjs";
import { roomBase, tallowO } from "./seg-room.mjs";
import { tallow, LENS } from "./room.mjs";
import { columns, threads, prism, grid, dotProduct, colX, COL } from "./data.mjs";

// The old way, in three beats: the sentence's cards are pressed into one small box of dots (a
// fixed-length list); Tallow's old candle stubs pass that box down the stairs like a whispered
// note, and letters fall off it at every hop; then the box bursts into direct threads.
export function whisper(t, A, T, F) {
  const items = [{ shape: rect(0, 0, 1920, 1080), fill: [0.02, 0.018, 0.02, 1], screen: true }];
  const W = F.probe.words, n = W.length, box = { x: 960, y: 420 };
  const press = span(t, T.fixed, T.fixed + 2.0, ease.inOut), stairs = t >= T.line && t < T.direct, burst = span(t, T.direct, T.direct + 2.4, ease.out);
  if (t < T.line) {
    W.forEach((w, i) => {
      const u = smooth01(press * 1.4 - i * 0.03), x = lerp(colX(i, n), box.x, u), y = lerp(300, box.y, u), s = 1 - 0.85 * u;
      items.push({ shape: rect(x - 70 * s, y - 40 * s, 140 * s, 80 * s, 3), fill: [0.85, 0.8, 0.68, 1 - 0.7 * u] }, { shape: words(w, A.sans, 30 * s + 1, x, y + 10 * s, "center"), fill: "#1d1812", opacity: 1 - u });
    });
    // The press itself comes down as the cards gather.
    items.push({ shape: rect(760, -400 + 700 * press, 400, 120, 6), fill: "#2a2016", stroke: "#0b0a0c", width: 5 }, { shape: rect(940, -800, 40, 400 + 700 * press), fill: "#1a140e" });
    for (let k = 0; k < 16; k++) items.push({ shape: circle(box.x - 150 + (k % 8) * 43, box.y - 18 + Math.floor(k / 8) * 36, 9, 12), fill: [1, 0.85, 0.6, press], blend: "add" });
    items.push(label(A, "the whole sentence, as one fixed-length list", 36, 960, 560, C.ink, "center", press));
    return { items, camera: { x: 960, y: 540, zoom: 1 } };
  }
  if (stairs) {
    const hop = span(t, T.line, T.direct - 0.6, ease.linear) * 6, g = GUIDES.tallow, note = W.join(" ");
    for (let k = 0; k < 7; k++) {
      const x = 220 + k * 250, y = 760 + k * 40, near = Math.max(0, 1 - Math.abs(hop - k)), fl = 0.4 + 0.6 * Math.max(0, 1 - Math.abs(hop - k) / 1.5);
      items.push({ shape: rect(x - 90, y, 240, 14), fill: "#120e0b" });
      items.push(...pose(g.parts({ armR: 60 + 60 * near, elbR: 30, prop: null, lid: 0.5, flame: fl, look: [6, 2] }), { x, y, s: 0.36, shear: g.shear }));
      items.push(glow(x + 2, y - 266, 130, [1, 0.6, 0.25], 0.3 * fl));
    }
    // The note: letters fall away with each hop (seeded, so the same letters go every time).
    const r = rng(9), k = Math.floor(hop), keep = [...note].map((ch) => (ch === " " ? " " : r() < 1 - 0.14 * k ? ch : "_")).join("");
    const nx = 220 + hop * 250 + 60, ny = 380 + hop * 40;
    items.push({ shape: rect(nx - 330, ny - 40, 660, 72, 4), fill: "#d9cdb0", stroke: "#2a2219", width: 2 }, { shape: words(keep, A.mono, 30, nx, ny + 8, "center"), fill: "#1d1812" });
    return { items, camera: { x: 960 + 200 * span(t, T.line, T.direct), y: 560, zoom: 1 } };
  }
  const eq = W.map(() => 1 / (n - 1));
  for (let k = 0; k < 8; k++) items.push({ shape: circle(box.x - 70 + k * 20 * (1 + 6 * burst), box.y - 300 * burst, 6, 10), fill: [1, 0.85, 0.6, 1 - burst], blend: "add" });
  items.push(...columns(A, F, { appear: burst, lit: eq.map(() => 0.4) }));
  items.push(...threads(F, eq, { grow: burst, count: 500, alpha: 0.06, py: 330 }));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// Inside the lamp: the aperture opens; the dot product of the reading word with the answer word;
// the scores and shares; during the held question the threads are faint and even; the reveal.
export function inside(t, A, T, F) {
  const open = span(t, T.enter, T.enter + 2.2, ease.inOut);
  const items = [];
  if (open < 1) {
    const R = roomBase(t, { a: 2.2 }), cam = { x: lerp(960, LENS.x, open), y: lerp(540, LENS.y, open), zoom: lerp(1, 2.6, open) };
    items.push(...R.back, ...tallow(tallowO(t, { armR: 150, elbR: 30, prop: "card", look: [9, -6] })), ...R.light);
    // The lens glass becomes the window: the hole starts at the glass's own edge and widens past the frame.
    const sx = 960 + (LENS.x - cam.x) * cam.zoom, sy = 540 + (LENS.y - cam.y) * cam.zoom, r = LENS.r * 0.9 * cam.zoom + 1600 * span(open, 0.45, 1, ease.in), hole = circle(sx, sy, r, 128);
    items.push({ shape: hole, fill: [0, 0, 0, 1], screen: true }, ...view(t, A, T, F).map((it) => ({ ...it, screen: true, clip: hole })));
    return { items, camera: cam };
  }
  return { items: view(t, A, T, F), camera: { x: 960, y: 540, zoom: 1 + 0.03 * span(t, T.enter + 2.2, T.end) } };
}

function view(t, A, T, F) {
  const items = [], q = F.probe.query, n = F.probe.words.length;
  const reveal = span(t, T.reveal, T.reveal + 2.0, ease.inOut), dp = span(t, T.dot, T.dot + 4.5, ease.linear);
  const even = F.shares.map((_, i) => (i <= q ? 1 / (q + 1) : 0));
  const shares = F.shares.map((s, i) => lerp(even[i], s, reveal));
  const lit = shares.map((s) => clamp(s * 2.2, 0.15, 1)), dpa = window(t, T.dot - 0.3, T.ask.start - 0.6, 0.5, 0.6);
  items.push(...columns(A, F, { appear: span(t, T.enter + 0.4, T.enter + 2.6), lit, shares: reveal > 0.5 ? F.shares : null }).map((it) => (dpa > 0 ? { ...it, opacity: (it.opacity ?? 1) * (1 - 0.75 * dpa) } : it)));
  const thr = window(t, T.ask.start - 0.5, T.end + 1, 0.8, 0.5);
  if (thr > 0) items.push(...threads(F, shares, { grow: span(t, T.ask.start - 0.5, T.ask.start + 1.5), alpha: 0.03 + 0.05 * reveal, count: 1400, py: 300 }));
  // The dot product, set to the right of the columns while the voice explains it.
  if (dpa > 0) {
    items.push({ shape: rect(560, 90, 800, 820, 12), fill: [0, 0, 0, 0.82 * dpa], screen: true });
    items.push(label(A, "question", 30, 880, 150, C.hot, "center", dpa), label(A, "label", 30, 1040, 150, C.ink, "center", dpa));
    const d = dotProduct(A, F.q, F.k, 960, 200, dp, { scale: 1 / F.qkMax, gap: 560 / F.dHead });
    items.push(...d.items.map((it) => ({ ...it, opacity: dpa, screen: true })));
    const full = dp >= 1, raw = full ? F.qkRaw : d.running;
    items.push(label(A, `${F.probe.words[q]} . ${F.probe.words[F.probe.answerFrom]} = ${raw.toFixed(2)}`, 40, 960, 820, C.ink, "center", dpa, "mono"));
    if (span(t, T.sqrt, T.sqrt + 0.8) > 0) items.push(label(A, `/ sqrt(${F.dHead}) = ${(F.qkRaw / Math.sqrt(F.dHead)).toFixed(2)}`, 40, 960, 875, C.hot, "center", dpa * span(t, T.sqrt, T.sqrt + 0.8), "mono"));
  }
  items.push(label(A, `1 dot = 1 number. ${F.dModel} numbers per word.`, 26, 80, 64, C.dim, "left", span(t, T.enter + 2, T.enter + 3), "mono"));
  if (reveal > 0.5) items.push(label(A, `layer ${F.layer + 1}, head ${F.head + 1}: real weights from the trained model`, 26, 80, 100, C.dim, "left", reveal, "mono"));
  return items;
}

// The prism: Rerun knocks, the beam splits into one bundle per head (layer 2's heads), and every
// head's attention map assembles as a grid of light.
export function heads(t, A, T, F) {
  const items = [], split = span(t, T.split, T.split + 2.0, ease.inOut), grids = span(t, T.ours, T.ours + 2.5, ease.out), q = F.probe.query;
  const px = 960, py = 280;
  items.push(...columns(A, F, { appear: 1, lit: F.shares.map((s) => clamp(s * 2.2, 0.15, 1)), labels: true }).map((it) => ({ ...it, opacity: (it.opacity ?? 1) * (1 - 0.7 * grids) })));
  const cols = [[1, 0.9, 0.75], [0.55, 0.85, 1], [0.75, 1, 0.7], [1, 0.7, 0.85]];
  const hs = F.heads.filter((h) => h.layer === F.layer);
  if (split < 1) items.push(...threads(F, F.shares, { alpha: 0.06 * (1 - split) * (1 - grids), py }));
  hs.forEach((h, k) => { if (split > 0) items.push(...threads(F, h.shares, { alpha: 0.06 * split * (1 - grids), count: 900, seed: 7 + k, colour: cols[k % 4], px: px + (k - (hs.length - 1) / 2) * 120 * split, py: py + 30 * split })); });
  items.push(...prism(px, py, split, 1.1));
  // Rerun on the prism: knocks twice as the beam enters, then reads the grids with stalks out.
  const knock = (t0) => window(t, t0, t0 + 0.25, 0.08, 0.12);
  const ro = { clawR: -4 + 100 * Math.max(knock(T.split - 0.9), knock(T.split - 0.4)), stalk: 1.2 + 0.5 * grids, look: [-6 + 10 * grids, -4], flare: 0.9 };
  items.push(...pose(GUIDES.rerun.parts(ro), { x: px + 200, y: py + 120, s: 0.4 }));
  // The 2017 base model's eight beams, as a ghost diagram.
  const ghost = window(t, T.eight, T.ours, 0.5, 0.5);
  if (ghost > 0) { for (let k = 0; k < 8; k++) items.push({ shape: polyline([px - 300, 160, px - 520 + k * 60, 60]), fill: null, stroke: [0.9, 0.88, 0.8, 0.5 * ghost], width: 2 }); items.push(label(A, "2017 base model: 8 heads per layer", 22, px - 410, 200, C.dim, "center", ghost, "mono")); }
  // Our heads' maps, one grid per head, every layer.
  if (grids > 0) {
    const all = F.heads, cell = Math.min(36, 1700 / (all.length * (F.probe.words.length + 2))), gw = cell * F.probe.words.length + 60;
    all.forEach((h, k) => {
      const x = 960 - (all.length * gw) / 2 + k * gw + 30, y = 470;
      const hi = h.kind === "previous word" ? (i, j) => j === i - 1 : h.kind === "copy" ? (i, j) => j === F.probe.answerFrom && i === q : null;
      items.push(...grid(A, h.map, x, y, cell, { appear: smooth01(grids * 1.6 - k * 0.2), title: `layer ${h.layer + 1} head ${h.head + 1}: ${h.kind}`, hi }));
    });
  }
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}
