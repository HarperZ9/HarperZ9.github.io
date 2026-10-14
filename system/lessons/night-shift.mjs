// Night Shift, the playable lesson beside film 1 ("Claiming got cheap. Checking did not."):
// the rules and the state of one shift. Pure and seeded: the same seed gives the same night,
// so the end screen can replay it with every claim carrying its data. No DOM, runs in Node.
//
// Where each number comes from (media/explainers/checking-cost/evidence.json):
//   CHECK_HOURS 6          Aczel, Szaszi and Holcombe 2021: about 6 hours per peer review, by
//                          reviewers' own reports.
//   RERUN straight 2 to 4  Hardwicke et al. 2018: the authors' estimate of a reproducibility check
//   RERUN ask 5 to 25      when the values reproduced (2 to 4 person hours) and when author help
//   11 of 35 straight      was needed (5 to 25). 11 of 35 articles reproduced without help, 11 with
//   13 of 24 unresolved    help, and 13 still had a value not reproduced despite help.
//   FALSE_SPEEDUP 6        Vosoughi, Roy and Aral 2018: the truth took about six times as long as
//                          falsehood to reach 1500 people (Twitter, 2006 to 2017). A spread study,
//                          not a cost study.
// Settings of this level, not measurements, and the page says so: the 40-hour budget, the
// 12-hour shift in about four minutes, the arrival rate (one claim every 15 s, then every 4 s),
// one claim in four carrying its data, one in three not holding, and a false claim reaching
// 1500 people in one hour of the shift.

export const RULES = Object.freeze({
  budget: 40, shiftHours: 12, realSeconds: 240,
  checkHours: 6,
  rerun: { straight: [2, 4], ask: [5, 25], pStraight: 11 / 35, pUnresolvedIfAsk: 13 / 24 },
  arrival: { first: 4, startGap: 15, endGap: 4 },
  dataShare: 0.25, notHoldShare: 1 / 3,
  holdMax: 3,
  spread: { reach: 1500, falseHours: 1, falseSpeedup: 6 },
});

// mulberry32: a small seeded generator, so a night is a pure function of its seed.
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
const between = (r, [lo, hi]) => lo + Math.round(r() * (hi - lo));

// The night's claims, drawn up front. Look (polish) and state (holds) are drawn independently,
// so the look never predicts the state.
export function makeNight(seed, rules = RULES) {
  const r = rng(seed), claims = [];
  for (let t = rules.arrival.first; t < rules.realSeconds; ) {
    const polish = r(), holds = r() >= rules.notHoldShare, data = r() < rules.dataShare;
    const route = r() < rules.rerun.pStraight ? "straight" : "ask";
    const rerunHours = between(r, rules.rerun[route]);
    const unresolved = route === "ask" && r() < rules.rerun.pUnresolvedIfAsk;
    const straightHours = between(r, rules.rerun.straight);      // for the replay with receipts
    claims.push({ id: claims.length, at: +t.toFixed(3), polish, glossy: polish >= 0.5, holds, data, route, rerunHours, unresolved, straightHours, title: TITLES[Math.floor(r() * TITLES.length)] });
    t += rules.arrival.startGap + (rules.arrival.endGap - rules.arrival.startGap) * (t / rules.realSeconds);
  }
  return { seed, claims };
}

// Claim titles: invented, and the page says every card in the level is invented.
const TITLES = ["A study finds", "Survey shows", "New benchmark", "Experts agree", "Report: costs halve", "Model beats humans",
  "Trial confirms", "Data reveal", "Analysis proves", "Review concludes", "Leaked memo", "Audit clears"];

export const gameHour = (t, rules = RULES) => (t / rules.realSeconds) * rules.shiftHours;

export function newShift(seed, prediction, rules = RULES) {
  const night = makeNight(seed, rules);
  return { rules, night, prediction, t: 0, budget: rules.budget, arrived: 0, queue: [], desk: null, held: [], log: [], out: [], done: false };
}

// Advance the clock; claims that arrive join the door queue, and the desk takes the next one.
export function tick(s, dt) {
  if (s.done) return s;
  s.t = Math.min(s.rules.realSeconds, s.t + dt);
  while (s.arrived < s.night.claims.length && s.night.claims[s.arrived].at <= s.t) s.queue.push(s.night.claims[s.arrived++].id);
  if (s.desk === null && s.queue.length) s.desk = s.queue.shift();
  if (s.t >= s.rules.realSeconds) finish(s, "morning");
  return s;
}

const claim = (s, id) => s.night.claims[id];
const record = (s, id, action, extra = {}) => { s.log.push({ id, action, t: s.t, ...extra }); };

// What the player can do with the claim on the desk. Each returns an event for the page to show.
export function act(s, action) {
  if (s.done || s.desk === null) return { ok: false, why: "no claim on the desk" };
  const id = s.desk, c = claim(s, id);
  if (action === "check") {
    if (s.budget < s.rules.checkHours) return { ok: false, why: `a check takes ${s.rules.checkHours} hours; ${s.budget} are left` };
    s.budget -= s.rules.checkHours;
    record(s, id, "check", { hours: s.rules.checkHours, found: c.holds ? "holds" : "nothing there" });
  } else if (action === "rerun") {
    if (!c.data) return { ok: false, why: "this claim carries no data to rerun" };
    if (s.budget < c.rerunHours) return { ok: false, why: `this rerun takes ${c.rerunHours} hours; ${s.budget} are left` };
    s.budget -= c.rerunHours;
    const found = c.unresolved ? "still a dark spot" : c.holds ? "holds" : "nothing there";
    record(s, id, "rerun", { hours: c.rerunHours, route: c.route, found });
  } else if (action === "pass") {
    record(s, id, "pass");
    s.out.push({ id, t: s.t });
  } else if (action === "hold") {
    if (s.held.length >= s.rules.holdMax) return { ok: false, why: `${s.rules.holdMax} claims are already held` };
    s.held.push(id);
    record(s, id, "hold");
  } else return { ok: false, why: `unknown action ${action}` };
  s.desk = s.queue.length ? s.queue.shift() : null;
  if (s.budget <= 0) finish(s, "budget");
  return { ok: true, id, action, entry: s.log[s.log.length - 1] };
}

// Bring a held claim back to the desk; the claim there goes back to the front of the queue.
export function takeBack(s, slot) {
  if (s.done || slot < 0 || slot >= s.held.length) return { ok: false, why: "no held claim there" };
  const id = s.held.splice(slot, 1)[0];
  if (s.desk !== null) s.queue.unshift(s.desk);
  s.desk = id;
  return { ok: true, id };
}

// People a released claim has reached by now: false claims reach `reach` in falseHours of the
// shift, true ones take falseSpeedup times as long. Linear in time, capped at reach.
export function reached(s, o, now = s.t) {
  const { reach, falseHours, falseSpeedup } = s.rules.spread, hours = gameHour(now - o.t, s.rules);
  const T = claim(s, o.id).holds ? falseHours * falseSpeedup : falseHours;
  return Math.round(reach * Math.min(1, Math.max(0, hours / T)));
}

function finish(s, why) {
  if (s.done) return;
  s.done = true; s.why = why;
  // Whatever nobody decided goes out with the morning: the queue, the desk, the claims not yet in.
  const left = [...(s.desk !== null ? [s.desk] : []), ...s.queue];
  for (const id of left) { s.out.push({ id, t: s.t, unchecked: true }); record(s, id, "out"); }
  s.desk = null; s.queue = [];
}

export const endShift = (s) => finish(s, "player");

// The end screen: what happened, with no grade.
export function summary(s) {
  const checked = s.log.filter((e) => (e.action === "check" || e.action === "rerun"));
  const resolved = checked.filter((e) => e.found !== "still a dark spot");
  const arrivedIds = s.night.claims.filter((c) => c.at <= s.t).map((c) => c.id);
  const look = (glossy) => {
    const set = arrivedIds.map((id) => claim(s, id)).filter((c) => c.glossy === glossy);
    return { n: set.length, held: set.filter((c) => c.holds).length };
  };
  const falseOut = s.out.filter((o) => !claim(s, o.id).holds);
  // The same night, every claim carrying its data and every rerun straight: checked in arrival
  // order until the same budget runs out.
  let budget = s.rules.budget, replay = 0;
  for (const id of arrivedIds) { const h = claim(s, id).straightHours; if (h > budget) break; budget -= h; replay++; }
  return {
    prediction: s.prediction, checked: checked.length, resolved: resolved.length, came: arrivedIds.length,
    held: s.held.length, out: s.out.length, falseOut: falseOut.length,
    falseReach: falseOut.reduce((a, o) => a + reached(s, o), 0),
    glossy: look(true), rough: look(false), replay, budgetLeft: s.budget, why: s.why,
  };
}
