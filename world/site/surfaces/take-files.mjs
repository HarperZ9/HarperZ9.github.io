// take-files.mjs: the well's picture as files for other trades. Every writer here is one the site already has; this
// file only hands them the bench's picture and palette. Pure: no page, runs in node and the browser.
//
//   plot, SVG and G-code   system/plotter.js: hatchFromLuma lays pen lines by how dark the picture is, orderPaths puts
//                          them in a short route, toPlotterSVG and toGcode write the files
//   relief, STL            system/relief-stl.js: heightmapToSTL makes a closed solid in millimetres, a lithophane
//   palette, GPL           system/exporters-disciplines.js: toGplPalette writes the palette file paint programs open
//
//   FILES                              what is offered: kind, label, ext, mime, and one plain line saying what it is
//   makeFile(kind, pixels, palette)    { name part, mime, body (a string or an ArrayBuffer), facts } from
//                                      pixels { data: RGBA bytes, w, h } and palette [{ name, hex }]
//
// Nothing here sends anything anywhere: a file is made in the page and handed to the browser to save.
import { hatchFromLuma, orderPaths, toPlotterSVG, toGcode, PLOT_DETAIL } from '../../../system/plotter.js';
import { heightmapToSTL, stlTriangleCount } from '../../../system/relief-stl.js';
import { toGplPalette } from '../../../system/exporters-disciplines.js';

export const RELIEF = Object.freeze({ w: 128, h: 96, widthMM: 100, minMM: 0.8, maxMM: 3 }), PLOT_MM = 190;
export const FILES = Object.freeze([
  { kind: 'plot-svg', label: 'Plot file', ext: 'plot.svg', mime: 'image/svg+xml', says: 'Lines for a pen plotter, a machine that draws with a real pen. Darker parts of the picture get more lines. Opens in any drawing program (SVG).' },
  { kind: 'plot-gcode', label: 'Plotter moves', ext: 'plot.gcode', mime: 'text/plain', says: `The same lines as G-code, the list of moves a plotter or a small mill reads, ${PLOT_MM} mm wide.` },
  { kind: 'relief-stl', label: 'Relief to print', ext: 'relief.stl', mime: 'model/stl', says: `A solid for a 3D printer (STL), ${RELIEF.widthMM} mm wide. It is a lithophane: a thin sheet, ${RELIEF.minMM} mm where the picture is light and ${RELIEF.maxMM} mm where it is dark, which shows the picture when light shines through it.` },
  { kind: 'palette-gpl', label: 'Palette for paint programs', ext: 'gpl', mime: 'text/plain', says: 'The colours as a GPL palette, the file GIMP, Krita and Inkscape open.' },
]);
const luma = (d, i) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
// The picture's brightness on a coarser grid, each cell the mean of the pixels it covers. Row 0 is the top.
export function lumaGrid({ data, w, h }, gw, gh) {
  const out = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const x0 = Math.floor(i * w / gw), x1 = Math.max(x0 + 1, Math.floor((i + 1) * w / gw)), y0 = Math.floor(j * h / gh), y1 = Math.max(y0 + 1, Math.floor((j + 1) * h / gh)); let s = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) s += luma(data, (y * w + x) * 4); out[j * gw + i] = s / ((x1 - x0) * (y1 - y0)); }
  return out;
}
export function makeFile(kind, pixels, palette = [], name = 'bench') {
  const f = FILES.find((x) => x.kind === kind); if (!f) throw new Error(`take-files: no such file kind ${kind}`);
  if (kind === 'palette-gpl') { const n = palette.length || 1; return { ...f, body: toGplPalette({ dominantSwatches: palette.map((p) => ({ hex: p.hex, frac: 1 / n })) }, name), facts: { colours: palette.length } }; }
  if (!pixels?.data || !(pixels.w >= 2 && pixels.h >= 2)) throw new Error('take-files: there is no picture');
  if (kind === 'relief-stl') { const heights = lumaGrid(pixels, RELIEF.w, RELIEF.h);
    return { ...f, body: heightmapToSTL(heights, RELIEF.w, RELIEF.h, { widthMM: RELIEF.widthMM, minMM: RELIEF.minMM, maxMM: RELIEF.maxMM }), facts: { triangles: stlTriangleCount(RELIEF.w, RELIEF.h), widthMM: RELIEF.widthMM } }; }
  const opts = { ...PLOT_DETAIL.fine, style: 'hatch', seed: name }, lines = orderPaths(hatchFromLuma(pixels.data, pixels.w, pixels.h, 4, opts)), facts = { lines: lines.length, points: lines.reduce((s, l) => s + l.length, 0) };
  return { ...f, facts, body: kind === 'plot-svg' ? toPlotterSVG(lines, pixels.w, pixels.h, opts) : toGcode(lines, pixels.w, pixels.h, { ...opts, widthMm: PLOT_MM }) };
}
