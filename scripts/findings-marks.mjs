// findings-marks.mjs: the research marks (SYSTEM.md, "Shared vocabulary and its marks"). Every category is told apart
// by its drawn shape, inked by its class and named by its word; the word always sits beside the mark or in the
// accessible name, so the mark is aria-hidden. Standing marks live in finding-flags.mjs, where every flag is drawn.
export { standingMark } from "./finding-flags.mjs";

const C = 'cx="8" cy="8"';
const SHAPES = {
  disc: `<circle ${C} r="5.5"/>`,
  half: `<circle ${C} r="5.5" class="o"/><path d="M8 2.5a5.5 5.5 0 0 0 0 11z"/>`,
  ring: `<circle ${C} r="5.5" class="o"/>`,
  dashring: `<circle ${C} r="5.5" class="o d"/>`,
  square: '<rect x="2.5" y="2.5" width="11" height="11" class="o"/>',
  diamond: '<path d="M8 1.5 14.5 8 8 14.5 1.5 8z"/>',
  diamond_bar: '<path d="M8 1.5 14.5 8 8 14.5 1.5 8z" class="o"/><path d="M4.5 8h7" class="o"/>',
  diamond_o: '<path d="M8 1.5 14.5 8 8 14.5 1.5 8z" class="o"/>',
  diamond_half: '<path d="M8 1.5 14.5 8 8 14.5 1.5 8z" class="o"/><path d="M8 1.5 1.5 8 8 14.5z"/>',
  diamond_dash: '<path d="M8 1.5 14.5 8 8 14.5 1.5 8z" class="o d"/>',
  tri_down: '<path d="M1.5 3h13L8 14z"/>',
  up: '<path d="M8 3 13 11H3z"/>',
  down: '<path d="M3 5h10L8 13z" class="o"/>',
};
const MARK = {
  basis: { observed: "disc", reported: "half", inferred: "ring", proposed: "dashring", unknown: "square" },
  outcome: { held: "diamond", null: "diamond_bar", inconclusive: "diamond_o", failed: "tri_down", mixed: "diamond_half", pending: "diamond_dash" },
  grade: { holds: "up", lowers: "down" },
};
export const OUTCOME_WORD = { held: "held", null: "honest null", inconclusive: "inconclusive", failed: "prediction failed", mixed: "mixed", pending: "pending" };
export const ACCESS_WORD = { run: "run here", read: "read in full", snippet: "abstract or summary", recall: "recall, unverified", not_read: "not read", unrecorded: "access unrecorded" };
const CELLS = { run: 4, read: 3, snippet: 2, recall: 1, not_read: 0, unrecorded: 0 };

export function mark(family, value, cls = "mk") {
  const shape = SHAPES[MARK[family][value]];
  if (!shape) throw new Error(`mark: no ${family} ${value}`);
  return `<svg class="${cls} ${family[0]}-${value}" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">${shape}</svg>`;
}

// how we touched a source, as a bar of four cells that fills
export function accessMark(value) {
  const n = CELLS[value], dotted = value === "unrecorded" ? " dotted" : "";
  const cells = [0, 1, 2, 3].map((i) => `<rect x="${1 + i * 4}" y="5" width="3" height="6" class="${i < n ? "f" : "o"}${dotted}"/>`).join("");
  return `<svg class="mk acc a-${value}" viewBox="0 0 17 16" width="22" height="16" aria-hidden="true" focusable="false">${cells}</svg>`;
}

export const labelled = (family, value, words) => `<span class="lbl">${mark(family, value)}<span>${words}</span></span>`;
