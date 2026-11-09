// The bins the organic baselines are kept in: thread size (replies loaded) for signs within one
// thread, and threads viewed for signs across threads. Shared by scripts/baselines.mjs, which
// measures them, and src/core/baselines.js, which picks the bin for the thread on screen.

export const SIZE_BINS = [
  { id: "5-19", min: 5, max: 19 },
  { id: "20-49", min: 20, max: 49 },
  { id: "50-99", min: 50, max: 99 },
  { id: "100+", min: 100, max: Infinity },
];

// A viewer's log of threads: a few, some dozens, about a hundred.
export const VIEW_BINS = [
  { id: "10", w: 10, min: 1, max: 19 },
  { id: "30", w: 30, min: 20, max: 59 },
  { id: "100", w: 100, min: 60, max: Infinity },
];

export function sizeBin(replies) { return SIZE_BINS.find((b) => replies >= b.min && replies <= b.max) || null; }
export function viewBin(threads) { return VIEW_BINS.find((b) => threads >= b.min && threads <= b.max) || null; }
