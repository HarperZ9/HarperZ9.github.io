// Night Shift's rules: seeded nights, costs, the look never predicting the state, the end
// screen's numbers, and every borrowed number traced to film 1's evidence file.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RULES, makeNight, newShift, tick, act, takeBack, endShift, summary, reached } from "./night-shift.mjs";

const run = (s, seconds, step = 0.25) => { for (let t = 0; t < seconds; t += step) tick(s, step); return s; };

test("a night is a pure function of its seed, and claims speed up through the shift", () => {
  assert.deepEqual(makeNight(7), makeNight(7));
  assert.notDeepEqual(makeNight(7).claims.map((c) => c.holds), makeNight(8).claims.map((c) => c.holds));
  const c = makeNight(7).claims, gaps = c.slice(1).map((x, i) => x.at - c[i].at);
  assert.ok(gaps[0] > 14 && gaps.at(-1) < 6, `gaps run from ${gaps[0]} to ${gaps.at(-1)}`);
  assert.ok(c.length >= 25 && c.length <= 40, `${c.length} claims`);
});

test("the look does not predict the state (over 400 nights)", () => {
  let g = 0, gh = 0, r = 0, rh = 0;
  for (let seed = 1; seed <= 400; seed++) for (const c of makeNight(seed).claims) { if (c.glossy) { g++; gh += c.holds; } else { r++; rh += c.holds; } }
  assert.ok(Math.abs(gh / g - rh / r) < 0.03, `glossy hold ${(gh / g).toFixed(3)}, rough ${(rh / r).toFixed(3)}`);
});

test("a check costs 6 hours and reveals the state; a rerun needs data and costs its drawn hours", () => {
  const s = run(newShift(3, 5), 5);
  assert.notEqual(s.desk, null);
  const c = s.night.claims[s.desk];
  const e = act(s, "check");
  assert.ok(e.ok);
  assert.equal(s.budget, RULES.budget - 6);
  assert.equal(e.entry.found, c.holds ? "holds" : "nothing there");
  // Find a claim with data and rerun it.
  const t = newShift(3, 5);
  const d = t.night.claims.find((x) => x.data);
  run(t, d.at + 0.1);
  while (t.desk !== d.id) act(t, "pass");
  const before = t.budget, r = act(t, "rerun");
  assert.ok(r.ok);
  assert.equal(before - t.budget, d.rerunHours);
  assert.ok(d.route === "straight" ? d.rerunHours >= 2 && d.rerunHours <= 4 : d.rerunHours >= 5 && d.rerunHours <= 25);
  const n = t.night.claims.find((x) => !x.data && x.at > t.t);
  if (n) { run(t, n.at - t.t + 0.1); while (t.desk !== null && t.desk !== n.id) act(t, "pass"); if (t.desk === n.id) assert.equal(act(t, "rerun").ok, false); }
});

test("holding is capped, a held claim can come back, and nothing spreads while it is held", () => {
  const s = run(newShift(11, 5), RULES.realSeconds - 1);
  for (let i = 0; i < 3; i++) assert.ok(act(s, "hold").ok);
  assert.equal(act(s, "hold").ok, false);
  const id = s.held[0];
  assert.ok(takeBack(s, 0).ok);
  assert.equal(s.desk, id);
  assert.ok(!s.out.some((o) => s.held.includes(o.id)));
});

test("at morning every undecided claim goes out unchecked; false ones reach people six times faster", () => {
  const s = run(newShift(5, 8), RULES.realSeconds + 1);
  assert.equal(s.done, true);
  assert.equal(s.why, "morning");
  assert.equal(s.out.length, s.night.claims.length);
  const f = s.night.claims.find((c) => !c.holds), tr = s.night.claims.find((c) => c.holds);
  const hour = RULES.realSeconds / RULES.shiftHours;
  assert.equal(reached(s, { id: f.id, t: 0 }, hour), 1500);
  assert.equal(reached(s, { id: tr.id, t: 0 }, hour), 250);
  assert.equal(reached(s, { id: tr.id, t: 0 }, 6 * hour), 1500);
});

test("the end screen reports what happened, with the replay done with receipts", () => {
  const s = run(newShift(9, 6), 120);
  while (s.desk !== null && s.budget >= 6) act(s, "check");
  endShift(s);
  const m = summary(s);
  assert.equal(m.prediction, 6);
  assert.equal(m.checked, s.log.filter((e) => e.action === "check").length);
  assert.ok(m.checked <= Math.floor(RULES.budget / RULES.checkHours));
  assert.ok(m.replay > m.checked, `replay ${m.replay} against ${m.checked}`);
  assert.equal(m.glossy.n + m.rough.n, m.came);
  assert.ok(!("score" in m) && !("grade" in m));
});

test("every number the level borrows is in film 1's evidence file", () => {
  const ev = JSON.parse(readFileSync(new URL("../../media/explainers/checking-cost/evidence.json", import.meta.url), "utf8")).sources;
  const text = (k) => JSON.stringify(ev[k]);
  assert.match(text("aczel2021"), /6 hours/);
  assert.equal(RULES.checkHours, 6);
  assert.match(text("hardwicke2018"), /2 to 4 person hours/);
  assert.match(text("hardwicke2018"), /5 to 25/);
  assert.deepEqual([RULES.rerun.straight, RULES.rerun.ask], [[2, 4], [5, 25]]);
  assert.match(text("hardwicke2018"), /22 of 35 articles reproduced in full, 11 of them only with the authors' help; 13 had at least one value not reproduced/);
  assert.equal(RULES.rerun.pStraight, 11 / 35);
  assert.equal(RULES.rerun.pUnresolvedIfAsk, 13 / 24);
  assert.match(text("vosoughi2018"), /about six times as long as falsehood to reach 1500 people/);
  assert.equal(RULES.spread.falseSpeedup, 6);
  assert.equal(RULES.spread.reach, 1500);
});
