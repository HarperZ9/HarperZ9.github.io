// crossover-marks.mjs: the six platform marks, each drawn by what its platform does, rendered as overprint glass
// (world/site/crossover/, encoded by tools/crossover/render.mjs into media/world/marks/): the glass lit from behind,
// its light carried as alpha so it adds to the dark field it sits on.
import { esc } from "./studies-markdown.mjs";

export const MARK_ALT = {
  THEFLYWHEEL: "Drawn mark: fourteen links closing into a wheel, each placed by the hash of the one before it.",
  THECMMNS: "Drawn mark: three granules between crossed polarisers, each coloured by its own structure, the colour fading as its order falls.",
  THEPLYGRND: "Drawn mark: a cell at its four-cell stage, one form cut twice through its centre into four.",
  ARTIQL8: "Drawn mark: a typewriter's fan of typebars, with the bars for A, R, T, I, Q, L and 8 struck.",
  BLDLNG: "Drawn mark: a call stack of blocks narrowing as it rises, each holding only what the block below allows.",
  RSRCH: "Drawn mark: arrows branching in two, some ending in a stop bar where a line of inquiry came back null.",
};

export function markImg(mark) {
  if (!MARK_ALT[mark]) return "";
  const s = `/media/world/marks/${mark.toLowerCase()}`;
  return `<picture class="xo-mark"><source type="image/avif" srcset="${s}.avif"><img src="${s}.webp" width="256" height="256" alt="${esc(MARK_ALT[mark])}" loading="lazy" decoding="async" fetchpriority="low"></picture>`;
}
