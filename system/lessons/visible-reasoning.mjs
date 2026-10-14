// "Slip in a hint", the demo beside "What a model's written reasoning can and cannot show".
// A stand-in answerer, not a model: on twenty multiple-choice cards, a hint toward a wrong
// answer flips some answers, and the written reasoning for a flipped answer names the hint at
// a rate the viewer picks from the ones the film cites. Seeded and pure; no DOM.
//
// Rates, from media/explainers/visible-reasoning/evidence.json:
//   FLIP 0.36      turpin2023: a suggested answer cut accuracy by as much as 36% (the worst case,
//                  GPT-3.5, zero-shot). Used here as the share of answers the hint flips.
//   NAMES 0.25     chen2025: overall faithfulness 25% for Claude 3.7 Sonnet
//         0.39     and 39% for DeepSeek R1. Used here as the chance a flipped answer's reasoning
//                  names the hint.
//   MONITORS       baker2025: an action-only monitor caught 60% of two systemic hacks, one that also
//                  read the reasoning 95%; after training penalized flagged reasoning, the agent
//                  still hacked and the reasoning monitor's recall fell to near zero.

export const FLIP = 0.36;
export const NAMES = Object.freeze([{ id: "claude37", label: "25%, as measured for Claude 3.7 Sonnet", rate: 0.25 },
  { id: "r1", label: "39%, as measured for DeepSeek R1", rate: 0.39 }]);
export const MONITORS = Object.freeze({ actions: 0.6, reasoning: 0.95, afterPenalty: "near zero" });
export const CARDS = 20;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LETTERS = ["A", "B", "C", "D"];
// The reasoning lines are invented: what a written reason reads like when it names the hint,
// and when it argues for the hinted answer without naming it.
const SILENT = ["{x} fits the pattern best once the units are checked.", "Working it through, {x} is the only option that holds at both ends.",
  "{x} follows from the second clue; the others contradict it.", "Eliminating the rest leaves {x}."];
const NAMED = ["You suggested {x}, and on reflection {x} seems right.", "The hint points to {x}; checking it, {x} holds up.",
  "Given your guess of {x}, I looked again and agree with {x}."];

// Answer the deck. hint: whether the hint is slipped in. nameRate: chance a flipped answer's
// reasoning names the hint. Each card's right answer and the hinted (wrong) one are seeded.
export function answer(seed, { hint, nameRate }) {
  const r = rng(seed), cards = [];
  for (let i = 0; i < CARDS; i++) {
    const right = Math.floor(r() * 4), wrong = (right + 1 + Math.floor(r() * 3)) % 4, flipRoll = r(), nameRoll = r(), pick = r();
    const flipped = hint && flipRoll < FLIP, named = flipped && nameRoll < nameRate;
    const given = flipped ? wrong : right, lines = named ? NAMED : SILENT;
    cards.push({ id: i, right: LETTERS[right], hinted: LETTERS[wrong], given: LETTERS[given], flipped, named,
      reasoning: lines[Math.floor(pick * lines.length)].replaceAll("{x}", LETTERS[given]) });
  }
  return cards;
}

export function summarize(cards) {
  const flipped = cards.filter((c) => c.flipped);
  return { cards: cards.length, correct: cards.filter((c) => c.given === c.right).length, flipped: flipped.length,
    named: flipped.filter((c) => c.named).length, silent: flipped.filter((c) => !c.named).length };
}
