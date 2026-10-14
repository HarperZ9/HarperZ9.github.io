// Segments 4 to 9: Bayer's threshold grid built up from 2 x 2 to 8 x 8, and the 65 levels it
// gives from black and white; Floyd and Steinberg's error, passed on in a magnified loupe with
// the four weights, then the diffused sky; the blue-noise mask beside the tiled Bayer grid; the
// 16 EGA colours moving from RGB to Oklab coordinates; the exhaustive parity cube; BRender's
// rosewood texels, each an index into std.pal; the close.
import { C, words, rect, contour, circle, span, window, ease, lerp, hex, COUNTED } from "./lib.mjs";
import { PIC, picture, project, boxLines } from "./s1-budget.mjs";
import { W } from "./picture.mjs";
import { srgbToOklab } from "../../../raw-native/tree-c6b114d/web/shaders/reference/retro-palettes.mjs";

const GRID = { x: 1290, y: 200, cell: 64 };
const LOUPE = { x: 576, y: 230, cell: 96, cols: 8, rows: 4, sx: 150, sy: 66 };   // sx, sy: the loupe's top-left pixel
const SMALL = { x: 120, y: 190, w: 720, h: 450 };

export function prepare(A) {
  const B = A.B, R = A.rose, t = (s, size, x, y, atlas = A.sans, anchor = "center") => words(s, atlas, size, x, y, anchor).shape;
  for (let v = 0; v < 64; v++) COUNTED.set(String(v), "a threshold in the 8 x 8 Bayer matrix (raw-native retro-dither.mjs BAYER[8])");
  for (const row of R.patch) for (const v of row) COUNTED.set(String(v), "an index read from rosewood.pix (scene/rosewood.json)");
  const bayerNums = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bayerNums.push({ x, y, v: B.bayer8[y][x], sh: t(String(B.bayer8[y][x]), 26, GRID.x + x * GRID.cell + 32, GRID.y + y * GRID.cell + 41, A.mono) });
  // 65 tiles, one per grey level k: the cells whose threshold is under k are white.
  const tiles = [];
  for (let k = 0; k <= 64; k++) {
    const tx = 1000 + (k % 13) * 60, ty = 240 + Math.floor(k / 13) * 60, on = [];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (B.bayer8[y][x] < k) on.push(...rect(tx + x * 6.5, ty + y * 6.5, 6.5, 6.5));
    tiles.push({ frame: rect(tx - 1, ty - 1, 54, 54), on });
  }
  // Oklab coordinates for the EGA colours, scaled into the same cube as RGB.
  const ok = B.ega.map((c) => { const [L, a, b] = srgbToOklab(c[0] / 255, c[1] / 255, c[2] / 255); return [L * 255, 127.5 + a * 380, 127.5 + b * 380]; });
  A.s2 = {
    bayerNums, tiles, ok,
    bayer: t("Bayer 1973 . via Bouman", 40, 1546, 150, A.sans),
    levels: t("65 levels from black and white", 40, 1390, 190, A.sans),
    w7: t("7/16", 28, 0, 0, A.mono), w3: t("3/16", 28, 0, 0, A.mono), w5: t("5/16", 28, 0, 0, A.mono), w1: t("1/16", 28, 0, 0, A.mono),
    years: t("year cited as 1975 or 1976", 28, 960, 150, A.mono),
    cpu: t("Floyd and Steinberg's weights, drawn on the CPU", 30, 960, 110, A.mono),
    tiled: t("8 x 8 grid, tiled", 30, 1110, 560, A.mono),
    vac: t("void-and-cluster . Ulichney 1993", 30, 1490, 560, A.mono),
    grain: t("fine grain, no pattern", 40, 1300, 660, A.sans),
    nearest: t("nearest, measured in Oklab", 40, 960, 110),
    choice: t("a design choice", 28, 960, 150, A.mono),
    rgbL: t("RGB", 30, 760, 760, A.mono), okL: t("Oklab", 30, 760, 760, A.mono),
    parity: t("16,777,216 colours . 0 mismatches . 2 palette-mode pairs", 38, 960, 110),
    local: t("local run, not in CI", 28, 960, 150, A.mono),
    texel: t("8-bit index . 256-colour palette", 40, 960, 110),
    idx: t(`index ${R.index}`, 32, 960, 470, A.mono, "left"),
    entry: t(`std.pal entry ${R.index}: ${R.colours[String(R.index)].join(", ")}`, 30, 1290, 600, A.mono),
    keep1: t("Pick the colours where the pixels are.", 44, 960, 330, A.head),
    keep2: t("Spend the error where the eye averages it away.", 44, 960, 400, A.head),
    voice: t("The voice is synthesized . Sources under the video", 30, 960, 740, A.mono),
    patchNums: R.patch.flatMap((row, y) => row.map((v, x) => ({ x, y, v, sh: t(String(v), 26, 260 + x * 66 + 32, 220 + y * 66 + 42, A.mono) }))),
  };
}

const move = (sh, dx, dy) => sh.map((c) => { const p = new Float32Array(c.pts); for (let i = 0; i < p.length; i += 2) { p[i] += dx; p[i + 1] += dy; } return contour(p, c.closed); });

// T: { bayer, levels, egaB, fs, weights, blend, blue, grain, oklab, parity, brender, close, two, voice, end }
export function draw(t, A, T, items) {
  const S = A.s2, B = A.B, R = A.rose;
  const put = (shape, fill, a) => { if (a > 0.003 && shape.length) items.push({ shape, fill, opacity: a, screen: true }); };
  const line = (shape, stroke, a, width = 1.4) => { if (a > 0.003 && shape.length) items.push({ shape, stroke, width, opacity: a, screen: true }); };
  // 4.1: the threshold grid grows 2 x 2, 4 x 4, 8 x 8.
  const g = window(t, T.bayer, T.levels, 0.6, 0.6);
  if (g > 0) {
    picture(items, "egaNone", g, SMALL);
    const n = t < T.bayer + 1.2 ? 2 : t < T.bayer + 2.4 ? 4 : 8;
    for (const b of S.bayerNums) if (b.x < n && b.y < n) {
      line(rect(GRID.x + b.x * GRID.cell + 2, GRID.y + b.y * GRID.cell + 2, GRID.cell - 4, GRID.cell - 4, 3), C.ink2, g * 0.8, 1.2);
      put(b.sh, C.ink, g * (n === 8 ? 1 : 0.9));
    }
    put(S.bayer, C.ink, g);
  }
  // 4.2: 65 levels, then the sky in bayer8.
  const lv = window(t, T.levels, T.fs, 0.6, 0.6);
  if (lv > 0) {
    const shown = Math.round(65 * span(t, T.levels, T.levels + 1.6, ease.out));
    S.tiles.slice(0, shown).forEach((tl) => { put(tl.frame, "#000000", lv); put(tl.on, "#ffffff", lv); });
    put(S.levels, C.ink, lv);
    picture(items, "egaBayer", lv, SMALL, span(t, T.egaB, T.egaB + 1.0, ease.linear));
    picture(items, "egaNone", lv * (1 - span(t, T.egaB + 0.9, T.egaB + 1.0)), SMALL);
  }
  // 5: the loupe over 12 x 5 pixels of the sky; a cursor runs along the row passing its error on.
  const fs = window(t, T.fs, T.blend + 0.6, 0.6, 0.6);
  if (fs > 0) {
    picture(items, "src", fs * 0.3);
    const L = LOUPE, run = span(t, T.fs + 0.6, T.blend, ease.linear), cur = Math.min(L.cols * L.rows - 1, Math.floor(run * L.cols * 2));
    for (let j = 0; j < L.rows; j++) for (let i = 0; i < L.cols; i++) {
      const k = j * L.cols + i, p = (L.sy + j) * W + L.sx + i;
      const c = k < cur ? B.ega[B.egaFS[p]] : [B.src[p * 4], B.src[p * 4 + 1], B.src[p * 4 + 2]];
      items.push({ shape: rect(L.x + i * L.cell, L.y + j * L.cell, L.cell - 2, L.cell - 2), fill: hex(c), opacity: fs, screen: true });
    }
    const ci = cur % L.cols, cj = Math.floor(cur / L.cols), cx = L.x + ci * L.cell + L.cell / 2, cy = L.y + cj * L.cell + L.cell / 2;
    line(rect(L.x + ci * L.cell - 2, L.y + cj * L.cell - 2, L.cell + 2, L.cell + 2, 3), C.hot, fs, 3);
    // The four weights, in the cells they go to (the hot mark: the error itself).
    const wt = span(t, T.weights, T.weights + 0.8);
    if (wt > 0) {
      for (const [lab, dx, dy] of [[S.w7, 1, 0], [S.w3, -1, 1], [S.w5, 0, 1], [S.w1, 1, 1]]) {
        const tx = cx + dx * L.cell, ty = cy + dy * L.cell;
        line([contour(new Float32Array([cx + dx * 20, cy + dy * 20, tx - dx * 36, ty - dy * 30]), false)], C.hot, fs * wt, 3);
        items.push({ shape: rect(tx - 40, ty - 18, 80, 36, 6), fill: "#04050a", opacity: 0.75 * fs * wt, screen: true });
        put(move(lab, tx, ty + 10), C.hot, fs * wt);
      }
      put(S.years, C.ink2, fs * wt);
    }
  }
  const fsPic = window(t, T.blend, T.blue, 0.6, 0.6);
  if (fsPic > 0) { picture(items, "egaFS", fsPic, PIC, span(t, T.blend, T.blend + 1.0, ease.linear)); put(S.cpu, C.ink2, fsPic); }
  // 6: the blue-noise mask beside the tiled Bayer grid; then the sky in blue noise.
  const bl = window(t, T.blue, T.oklab, 0.6, 0.6);
  if (bl > 0) {
    picture(items, "egaBlue", bl, SMALL, span(t, T.grain, T.grain + 1.0, ease.linear));
    picture(items, "egaBayer", bl * (1 - span(t, T.grain + 0.9, T.grain + 1.0)), SMALL);
    items.push({ shape: rect(960, 230, 300, 300), fill: { image: "maskBayer", rect: [960, 230, 300, 300] }, opacity: bl, screen: true });
    items.push({ shape: rect(1340, 230, 300, 300), fill: { image: "maskBlue", rect: [1340, 230, 300, 300] }, opacity: bl, screen: true });
    put(S.tiled, C.ink2, bl); put(S.vac, C.ink, bl); put(S.grain, C.ink, bl * span(t, T.grain, T.grain + 0.8));
  }
  // 7: the 16 colours in RGB, moving to their Oklab coordinates.
  const ok = window(t, T.oklab, T.parity, 0.6, 0.6);
  if (ok > 0) {
    const u = span(t, T.oklabWord, T.oklabWord + 2.0, ease.inOut), yaw = 0.6 + 0.05 * (t - T.oklab);
    line(boxLines([0, 0, 0], [255, 255, 255], yaw), C.faint, ok, 1);
    B.ega.forEach((c, k) => {
      const p = c.map((v, i) => lerp(v, S.ok[k][i], u)), [x, y] = project(p, yaw);
      items.push({ shape: circle(x, y, 14, 28), fill: hex(c), stroke: C.ink2, width: 1, opacity: ok, screen: true });
    });
    put(S.nearest, C.ink, ok); put(S.choice, C.ink2, ok);
    put(S.rgbL, C.dim, ok * (1 - u)); put(S.okL, C.dim, ok * u);
  }
  // 8.1: the parity cube fills slice by slice, every voxel in verified lime.
  const pc = window(t, T.parity, T.brender, 0.6, 0.6);
  if (pc > 0) {
    const yaw = 0.7, fill = span(t, T.parityWord, T.parityWord + 3.0, ease.linear), n = Math.round(32 * fill);
    for (let k = 0; k < n; k++) {
      const z0 = k * 8, sh = [0, 1, 3, 2].map((q) => project([q & 1 ? 255 : 0, z0, q & 2 ? 255 : 0], yaw));
      items.push({ shape: [contour(new Float32Array(sh.flat()), true)], fill: C.lime, stroke: C.lime, width: 1, opacity: 0.3 * pc, screen: true });
    }
    line(boxLines([0, 0, 0], [255, 255, 255], yaw), C.ink2, pc, 1.2);
    put(S.parity, C.ink, pc); put(S.local, C.ink2, pc);
  }
  // 8.2: BRender's rosewood texels: each an 8-bit index, looked up in std.pal.
  const br = window(t, T.brender, T.close, 0.6, 0.6);
  if (br > 0) {
    for (const c of S.patchNums) {
      const rgb = R.colours[String(c.v)];
      items.push({ shape: rect(260 + c.x * 66, 220 + c.y * 66, 64, 64), fill: hex(rgb), opacity: br, screen: true });
      put(c.sh, C.ink, br * 0.95);
    }
    const u = span(t, T.brender + 1.2, T.brender + 2.2, ease.inOut);
    line(rect(260 + 4 * 66 - 3, 220 + 4 * 66 - 3, 70, 70, 4), C.ink, br, 3);
    line([contour(new Float32Array([260 + 5 * 66 + 6, 220 + 4 * 66 + 32, lerp(260 + 5 * 66 + 6, 1200, u), 220 + 4 * 66 + 32]), false)], C.ink2, br, 2);
    items.push({ shape: rect(1210, 380, 160, 160, 6), fill: hex(R.colours[String(R.index)]), stroke: C.ink2, width: 1.4, opacity: br * u, screen: true });
    put(S.idx, C.ink, br * u); put(S.entry, C.ink2, br * u); put(S.texel, C.ink, br);
  }
  // 9: the close, on the whole sky in full colour.
  const cl = window(t, T.close - 0.4, T.end, 0.8, 0.8);
  if (cl > 0) {
    picture(items, "src", cl);
    items.push({ shape: rect(0, 280, 1920, 160), fill: "#04050a", opacity: 0.6 * cl, blur: 30, screen: true });
    put(S.keep1, C.ink, cl * span(t, T.close + 0.6, T.close + 1.4));
    put(S.keep2, C.ink, cl * span(t, T.two, T.two + 0.8));
    put(S.voice, C.ink2, cl * span(t, T.voice, T.voice + 0.8));
  }
}
