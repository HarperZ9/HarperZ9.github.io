// lib/medium/sheets.mjs: the sheet engine. No single compositing law (BLEED section 9): each sheet carries its own
// law, and where sheets with different laws meet, each applies its own on its side. Plain ES module, no Node imports,
// so Daylight's analysis view, the site's layers and the FLOW view can import the same file.
//   multiply      a filter: what passes is multiplied by the sheet's transmission (ideal transparent ink)
//   density_add   printing ink over ink: optical densities add, and an ink laid over ink that is already there
//                 adds only DENSITY_W of its density (the press's trap). One weight for all overlaps, fitted on the
//                 Olivetti "De A a Z" overlaps: held-out density rmse 0.298 against 0.399 for the 94.7% coverage
//                 trap it replaced (tools/overprint_compare.py, 2026-10-26)
//   weber         stacked transparent sheets as seen: n equal sheets look like ln(1 + a n) / ln(1 + a) sheets
//                 (Albers XX-1, the reference library's measures/albers-xx1.json; a = 29.75, held-out dE 3.7; a
//                 saturating curve with a ceiling fits as well, 3.7: four points cannot tell them apart)
//   screen        light added, not absorbed: 1 - (1 - c)(1 - light)
// A sheet: { ink: [r, g, b] linear transmission (or light, for screen), cover: 0..1, law }.
export const DENSITY_W = 0.243;
export const WEBER = 29.75;
const perceived = (D, unit) => (unit > 1e-6 ? unit * Math.log1p(WEBER * D / unit) / Math.log1p(WEBER) : D);

export const SHEET_LAWS = ['multiply', 'density_add', 'weber', 'screen'];

// one pixel: paper (linear rgb) under the sheets in print order
export function composite(paper, sheets) {
  const c = paper.slice(), D = [0, 0, 0], U = [0, 0, 0]; let inked = 0, anyWeber = false;
  for (const s of sheets) {
    const law = s.law ?? 'multiply', cov = s.cover ?? 1; if (cov <= 0) continue;
    for (let k = 0; k < 3; k++) {
      const t = 1 - cov * (1 - s.ink[k]);
      if (law === 'multiply') c[k] *= t;
      else if (law === 'density_add') c[k] *= inked > 0 ? Math.pow(Math.max(1e-4, t), 1 - (1 - DENSITY_W) * inked) : t;
      else if (law === 'screen') c[k] = 1 - (1 - c[k]) * (1 - cov * s.ink[k]);
      else { const d = -Math.log(Math.max(1e-4, t)); D[k] += d; if (d > U[k]) U[k] = d; anyWeber = true; }
    }
    if (law === 'density_add') inked = Math.min(1, inked + cov);
  }
  // the weber sheets are seen together, as one stack, on their side of the meeting
  if (anyWeber) for (let k = 0; k < 3; k++) c[k] *= Math.exp(-perceived(D[k], U[k]));
  return c;
}
