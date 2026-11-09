// crossover-marks.mjs: the six platform marks, each drawn by what its platform does. Since 2026-11-04 they are drawn
// as inline SVG in flat inks whose overlaps are computed (scripts/marks/); the glass renders of the same ideas
// (MARK_ALT below, media/world/marks/) are kept for the record and no page loads them.
import { PLATFORM_MARKS } from "./marks/platform-marks.mjs";
import { esc } from "./studies-markdown.mjs";

export const MARK_ALT = {
  THEFLYWHEEL: "Drawn mark: fourteen links closing into a wheel, each placed by the hash of the one before it.",
  THECMMNS: "Drawn mark: three granules between crossed polarisers, each coloured by its own structure, the colour fading as its order falls.",
  THEPLYGRND: "Drawn mark: a cell at its four-cell stage, one form cut twice through its centre into four.",
  ARTIQL8: "Drawn mark: a typewriter's fan of typebars, with the bars for A, R, T, I, Q, L and 8 struck.",
  BLDLNG: "Drawn mark: a call stack of blocks narrowing as it rises, each holding only what the block below allows.",
  RSRCH: "Drawn mark: arrows branching in two, some ending in a stop bar where a line of inquiry came back null.",
};

// the mark as a small SVG file in flat overprinted inks (scripts/marks/platform-marks.mjs, written by
// scripts/build-marks.mjs), key ink light for the water field. A file rather than inline markup keeps the index's
// first response inside one round trip on a slow phone.
export function markImg(mark) {
  const m = PLATFORM_MARKS[mark]; if (!m) return "";
  return `<img class="xo-mark" src="/media/world/icons/${mark.toLowerCase()}-on-dark.svg" width="104" height="104" alt="${esc(m[1])}" loading="lazy" decoding="async">`;
}
