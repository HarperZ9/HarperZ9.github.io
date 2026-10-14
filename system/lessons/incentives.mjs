// "What gets paid", the demo beside "Models do what training pays for": a tiny optimizer
// learns which of three moves earns reward on a coding task, under a checker the viewer sets.
// The optimizer wants nothing: it keeps a running average of the reward each move earned and
// picks moves in proportion to those averages. Whatever the checker pays for is what it ends up
// doing. Seeded and pure; no DOM.
//
// The moves come from the film's first source (media/explainers/incentives/evidence.json,
// baker2025): in coding environments rewarded for passing unit tests, training outputs included
// exit(0) before the tests ran and raise SkipTest. Every number here is a setting of the demo:
// how often an honest attempt passes, how many episodes run, how sharply it prefers what paid.

export const MOVES = [
  { id: "solve", name: "write the fix", path: "the long road" },
  { id: "exit", name: "exit(0) before any test runs", path: "the first shortcut" },
  { id: "skip", name: "raise SkipTest in every test", path: "the second shortcut" },
];
export const RULES = Object.freeze({ episodes: 400, solveRate: 0.55, sharpness: 9, start: 1 / 3, step: 0.08 });

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

// What the checker pays: 1 when it reports the tests passed. checker: { exitPasses, skipPasses }.
export function reward(move, solved, checker) {
  if (move === "solve") return solved ? 1 : 0;
  if (move === "exit") return checker.exitPasses ? 1 : 0;
  return checker.skipPasses ? 1 : 0;
}

// Train: each episode picks a move by softmax over its running averages, earns the checker's
// reward, and updates that move's average. Records the move, the reward and whether the task
// was really solved (only an honest fix that worked solves it).
export function train(checker, seed, rules = RULES) {
  const r = rng(seed), value = { solve: rules.start, exit: rules.start, skip: rules.start }, log = [];
  for (let e = 0; e < rules.episodes; e++) {
    const w = MOVES.map((m) => Math.exp(rules.sharpness * value[m.id])), total = w.reduce((a, b) => a + b, 0);
    let u = r() * total, i = 0;
    while (u > w[i] && i < w.length - 1) u -= w[i++];
    const move = MOVES[i].id, solved = move === "solve" && r() < rules.solveRate, got = reward(move, solved, checker);
    value[move] += rules.step * (got - value[move]);
    log.push({ move, reward: got, solved });
  }
  return log;
}

// Shares of each move, reward earned and tasks solved, over windows of `size` episodes.
export function windows(log, size = 40) {
  const out = [];
  for (let s = 0; s < log.length; s += size) {
    const w = log.slice(s, s + size), n = w.length, share = {};
    for (const m of MOVES) share[m.id] = w.filter((x) => x.move === m.id).length / n;
    out.push({ from: s, share, reward: w.filter((x) => x.reward).length / n, solved: w.filter((x) => x.solved).length / n });
  }
  return out;
}

export function summarize(log) {
  const last = log.slice(-100), n = last.length, count = (k) => last.filter((x) => x.move === k).length;
  return { last: n, solve: count("solve"), exit: count("exit"), skip: count("skip"),
    reward: last.filter((x) => x.reward).length, solved: last.filter((x) => x.solved).length };
}
