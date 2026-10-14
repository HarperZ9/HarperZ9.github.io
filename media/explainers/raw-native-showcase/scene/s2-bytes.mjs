// Segment 2, "Same bytes, every build". Three tiles of the same box, one per build, slide
// together and overlap exactly. Then two film strips of the same scene, each frame a function of
// time alone, run side by side and merge into one, while the frame count rolls up.
import { contour, rect, transform } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";
import { fmt } from "../../../raw-native/tree-c6b114d/web/motion/text.mjs";
import { countUp } from "../../../raw-native/tree-c6b114d/web/motion/timeline.mjs";
import { C, box, view, inFacet, put, T, tab, fact, span, window, ease, lerp } from "./world.mjs";

const BUILDS = ["MSVC", "GCC", "WebAssembly"];
const FRAMES = 9, FW = 190, FH = 107;

// A small box view of frame i, scaled into a FW x FH cell centred at (x, y).
function thumb(i, x, y) {
  const items = box(view({ yaw: 20 + i * 9, pitch: 22, dist: 12.5 }), { floorGrid: false, edgeWidth: 4 });
  const k = FW / 1920, m = [k, 0, 0, k, x - 960 * k, y - 560 * k];
  return [{ shape: rect(x - FW / 2, y - FH / 2, FW, FH), fill: [0.03, 0.03, 0.04] },
    ...items.map((it) => ({ ...it, shape: transform(it.shape, m), width: (it.width || 0) * k })),
    { shape: rect(x - FW / 2, y - FH / 2, FW, FH), stroke: C.ink2, width: 1.5 }];
}

export function prepare(A, facts, c) {
  const tile = box(view({ yaw: 34, pitch: 22, dist: 9.5 }));
  A.s2 = {
    tile, frames: Array.from({ length: 40 }, (_, i) => i),
    names: BUILDS.map((b, k) => T(A, b, { size: 38, x: 480 + k * 480, y: 250 })),
    same: T(A, "the same bytes", { size: 44, x: 960, y: 250 }),
    tabA: tab(A, A.ev, "rn-readme"), tabB: tab(A, A.ev, "rn-determinism"),
    count: (n) => T(A, `${fmt(Math.round(n))} frames . ${fact(A.ev, "frames_differing")} differing`, { size: 44, x: 960, y: 262, atlas: "mono" }),
    pure: T(A, "frame = f(time)", { size: 40, x: 960, y: 196, atlas: "mono" }),
    total: A.ev.facts.values.frames.value,
  };
  A.T2 = { enter: c.at(2, 0, 0), byte: c.word(2, 0, 0, "byte for byte"), pure: c.word(2, 1, 0, "function of time"), twice: c.at(2, 1, 1),
    matched: c.word(2, 1, 1, "matched"), exit: c.at(3, 0, 0) };
}
export const stops = (c) => [["bytes", c.at(2, 0, 0)]];

export function draw(t, A, items) {
  const S = A.s2, T2 = A.T2;
  if (t < T2.enter - 2 || t > T2.exit + 1) return;
  const content = [], strips = span(t, T2.pure - 0.6, T2.pure + 0.6);
  // Three builds: the tiles start apart and slide onto one another.
  const together = span(t, T2.byte, T2.byte + 2.0);
  if (strips < 1) BUILDS.forEach((_, k) => {
    const dx = (k - 1) * 480 * (1 - together), k2 = 0.62, m = [k2, 0, 0, k2, 960 + dx - 960 * k2, 560 - 560 * k2];
    for (const it of S.tile) content.push({ ...it, shape: transform(it.shape, m), width: (it.width || 0) * k2, opacity: (it.opacity ?? 1) * (k === 1 ? 1 : 0.55) * (1 - strips) });
  });
  // Two strips of frames run left; on "twice" they slide together into one.
  if (strips > 0) {
    const run = (t - T2.pure) * 140, merge = span(t, T2.twice, T2.twice + 2.0);
    for (const [row, y] of [[0, lerp(380, 520, merge)], [1, lerp(660, 520, merge)]]) {
      for (let i = 0; i < 12; i++) {
        const x = 1920 + FW - ((i * (FW + 24) + run) % (12 * (FW + 24))), f = Math.floor((i * (FW + 24) + run) / (FW + 24));
        for (const it of thumb(f, x, y)) content.push({ ...it, opacity: (it.opacity ?? 1) * strips * (row === 1 ? 1 - 0.4 * merge : 1) });
      }
    }
    content.push({ shape: [contour([960, 300, 960, 760], false)], stroke: C.ink, width: 3, opacity: strips * 0.8 });
  }
  items.push(...inFacet(content, "bytes"));
  const o = window(t, T2.enter, T2.exit + 0.3, 0.6, 0.8);
  BUILDS.forEach((_, k) => put(items, S.names[k], C.ink, o * window(t, T2.enter + 0.3 + k * 0.3, T2.byte + 1.2, 0.5, 0.5)));
  put(items, S.same, C.ink, o * window(t, T2.byte + 1.6, T2.pure - 0.6, 0.5, 0.5));
  put(items, S.tabA, C.ink2, o * window(t, T2.enter, T2.pure - 0.4, 0.6, 0.5) * 0.85);
  put(items, S.tabB, C.ink2, o * span(t, T2.pure - 0.3, T2.pure + 0.4) * 0.85);
  put(items, S.pure, C.ink, o * window(t, T2.pure, T2.exit, 0.5, 0.5));
  const n = countUp(t, T2.twice, T2.matched + 0.6, 1, S.total, ease.inOut, true);
  if (t > T2.twice - 0.2) put(items, S.count(n), C.ink, o * span(t, T2.twice - 0.2, T2.twice + 0.3));
}
