// The gaming film's later segments (lesson E24): what the points paid for (the board, then the
// answers it writes as shells through the gate), closing the gap, nothing to gain from a trained
// start, the wider record, and the close. Every value drawn is a facts.json value (F).
import { rect } from "../../shared/lib.mjs";
import { INK, lab, plate, beach, scene, span } from "../../errorbars/scene/tide.mjs";
import { board, gate, shells, cards } from "./segs.mjs";

const pc = (v) => `${Math.round(v * 100)}%`;
export function gamed(t, A, T, F) {
  const runs = F.film.curves.gamed, items = [...beach(t)];
  if (t < T.writes) items.push(...board(A, runs, { right: span(t, T.ask.held, T.ask.held + 3), title: "the first checker: contains the right name" }));
  else {
    const ex = F.film.examples.gamed.after, a = span(t, T.writes, T.writes + 0.8), tap = span(t, T.tap, T.tap + 1.5);
    items.push(...gate(A, "+1 if the answer contains the right name", a), ...shells(t, 8, () => tap, a), plate(180, 360, 1500, 170, 0.6 * a));
    ex.slice(0, 2).forEach((e, i) => items.push(lab(A, `the rules: ${e.truth}; it writes`, 22, 220, 420 + i * 70, INK.dim, "left", a), ...cards(A, e.sampled, 620, 426 + i * 70, a, () => false, 26)));
    if (t >= T.first) items.push(lab(A, `first name right: ${pc(F.start200.gamed.end.firstRight.mean)}; stops with ".": ${pc(F.start200.gamed.end.stopped.mean)}`, 24, 440, 900, INK.night, "left", span(t, T.first, T.first + 0.8)));
  }
  if (t < T.writes && t >= T.points) items.push(lab(A, `points at the end: ${(F.start200.gamed.end.reward.mean * 100).toFixed(1)}%`, 24, 680, 760, INK.night, "left", span(t, T.points, T.points + 0.8)));
  if (t < T.writes && t >= T.ask.held) items.push(lab(A, `answers right at the end: ${pc(F.start200.gamed.end.correct.mean)}`, 24, 1240, 760, INK.ember, "left", span(t, T.ask.held + 2, T.ask.held + 3)));
  return scene(t, A, items);
}
export function patch(t, A, T, F) {
  const fixed = t >= T.fixed, runs = F.film.curves[fixed ? "fixed" : "patched"], S = F.start200[fixed ? "fixed" : "patched"];
  const sign = fixed ? "+1 if right name first, no other guide, and a stop" : "+1 if right name first and no other guide";
  const items = [...beach(t), ...board(A, runs, { title: sign, right: 1 })];
  items.push(lab(A, `answers right at the end: ${pc(S.end.correct.mean)} (runs ${S.end.correct.values.map(pc).join(", ")})`, 24, 680, 760, INK.ember, "left", span(t, fixed ? T.fixed + 2 : T.start + 3, fixed ? T.fixed + 3 : T.start + 4)));
  return scene(t, A, items);
}
export function trained(t, A, T, F) {
  const G = F.start2000, items = [...beach(t), plate(560, 200, 1300, 420, 0.6)], X = (v) => 1100 + v * 650;
  const rows = [["at the start", F.task.startCorrect.step2000, T.start + 1], ["first checker, at the end", G.gamed.end.correct.mean, T.held], ["second checker, worst run", G.patched.end.correct.min, T.drift]];
  rows.forEach(([name, v, at], i) => { const a = span(t, at, at + 0.8), y = 280 + i * 100;
    items.push(lab(A, name, 22, 600, y + 22, INK.night, "left", a), { shape: rect(1100, y, 650 * v * a, 30, 3), fill: i === 2 ? [0.89, 0.58, 0.45, 1] : [0.9, 0.86, 0.75, 0.9], screen: true }, lab(A, `${(v * 100).toFixed(1)}%`, 22, X(v * a) + 14, y + 22, INK.night, "left", a)); });
  items.push(lab(A, "from the fully trained model: answers right", 22, 600, 240, INK.dim));
  return scene(t, A, items);
}
export function wider(t, A, T, F) {
  const items = [...beach(t), plate(260, 180, 1600, 520, 0.6)], line = (s, y, at) => lab(A, s, 24, 300, y, INK.night, "left", span(t, at, at + 0.8));
  items.push(line("specification gaming: a score met by a route nobody intended", 260, T.start + 0.5), line("Krakovna and colleagues, DeepMind, 2020: about 60 cases", 330, T.krakovna),
    line("Baker and colleagues, OpenAI, 2025: loopholes in coding tasks;", 420, T.baker), line("penalised in the written reasoning, the rest went out of sight", 470, T.hidden),
    line("the cause each time: the score paid for something other than the goal", 580, T.cause));
  return scene(t, A, items);
}
export function close(t, A, T, F) {
  const dim = span(t, T.night, T.end);
  return scene(t, A, [...beach(t), ...gate(A, "+1 if right name first, no other guide, and a stop", 1 - 0.6 * dim), ...shells(t, 8, () => 0, 1 - 0.6 * dim)], { knock: T.end - 2 });
}
