// The landscape segments of film 4: the title, "Paid for passing tests", "Paid for
// agreeing", "Change what gets paid" and the close. The contour field is drawn from a
// height field (land.mjs); a morph between two fields redraws the contours every frame.
import { contour, circle, rect, trim } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { text } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { span, window, ease, lerp } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";
import { C, P, fields, blend, contours, asShape, LEVELS } from "./land.mjs";

const bez = (a, c, b, n = 48) => { const o = []; for (let i = 0; i <= n; i++) { const u = i / n, v = 1 - u; o.push(v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]); } return o; };
const dashedPath = (p, dash = 12, gap = 9) => {
  const out = []; let cur = [], s = 0, on = true;
  for (let k = 0; k + 2 < p.length; k += 2) {
    const L = Math.hypot(p[k + 2] - p[k], p[k + 3] - p[k + 1]);
    if (on) cur.push(p[k], p[k + 1]);
    s += L;
    if (s > (on ? dash : gap)) { if (on && cur.length >= 2) { cur.push(p[k + 2], p[k + 3]); out.push(contour(new Float32Array(cur), false)); } cur = []; on = !on; s = 0; }
  }
  return out;
};
const pointOn = (p, u) => { const n = p.length / 2 - 1, f = Math.min(n - 1e-6, Math.max(0, u * n)), i = Math.floor(f), w = f - i; return [lerp(p[2 * i], p[2 * i + 2], w), lerp(p[2 * i + 1], p[2 * i + 3], w)]; };

export function prepare(A) {
  const t = (s, o) => text(s, o).shape;
  A.land = { tests: contours(fields.tests, LEVELS), agree: contours(fields.agree, LEVELS), fixed: contours(fields.fixed, LEVELS) };
  const tun1 = bez(P.start, [700, 260], P.tests), tun2 = bez(P.start, [620, 470], P.tests);
  const ridgePath = [];
  for (let i = 0; i <= 80; i++) { const u = i / 80; ridgePath.push(lerp(P.start[0], P.solve[0], u) + Math.sin(u * Math.PI * 2.2) * 140, lerp(P.start[1], P.solve[1], u) - Math.sin(u * Math.PI) * 120); }
  A.r1 = {
    tun1, tun2, ridgePath, d1: dashedPath(tun1), d2: dashedPath(tun2), dr: dashedPath(ridgePath, 4, 8),
    title: t("Models do what training pays for", { atlas: A.head, size: 58, x: 960, y: 560, anchor: "center" }),
    testsL: t("unit tests pass", { atlas: A.sans, size: 30, x: P.tests[0], y: P.tests[1] + 6, anchor: "center" }),
    rewardL: t("reward", { atlas: A.mono, size: 24, x: P.tests[0], y: P.tests[1] + 40, anchor: "center" }),
    solveL: t("solve the task", { atlas: A.sans, size: 30, x: P.solve[0], y: P.solve[1] + 50, anchor: "center" }),
    startL: t("the model", { atlas: A.mono, size: 22, x: P.start[0], y: P.start[1] - 22, anchor: "center" }),
    exitL: t("exit(0) before the tests run", { atlas: A.mono, size: 26, x: 720, y: 240, anchor: "center" }),
    skipL: t("raise SkipTest", { atlas: A.mono, size: 26, x: 640, y: 470, anchor: "center" }),
    yes: t("reward: yes", { atlas: A.mono, size: 30, x: P.tests[0] + 40, y: P.tests[1] - 70 }),
    no: t(". task solved: no", { atlas: A.mono, size: 30, x: P.tests[0] + 230, y: P.tests[1] - 70 }),
    measured: t("The reward measured passing tests. Training produced passing tests.", { atlas: A.sans, size: 32, x: 960, y: 980, anchor: "center" }),
    agreeL: t("agrees with the user", { atlas: A.sans, size: 30, x: P.agree[0], y: P.agree[1] + 6, anchor: "center" }),
    trained: t("trained toward answers that people, and models of their preferences, rate highly", { atlas: A.sans, size: 28, x: 960, y: 120, anchor: "center" }),
    sharma: t("matching the user's beliefs: among the best predictors of the preferred answer", { atlas: A.sans, size: 28, x: 960, y: 120, anchor: "center" }),
    beamL: t("agrees, convincing", { atlas: A.sans, size: 26, x: 690, y: 900, anchor: "center" }),
    beamR: t("truthful, standard", { atlas: A.sans, size: 26, x: 1230, y: 900, anchor: "center" }),
    pref: t("preferred 95% of the time", { atlas: A.mono, size: 30, x: 960, y: 1004, anchor: "center" }),
    syco: t("sycophancy, traced in part to the preference data", { atlas: A.sans, size: 30, x: 960, y: 120, anchor: "center" }),
    wants: t("None of this needs a model that wants anything.", { atlas: A.head, size: 44, x: 960, y: 140, anchor: "center" }),
    needs: t("a reward that pays for the wrong thing, and an optimizer that finds it", { atlas: A.sans, size: 30, x: 960, y: 196, anchor: "center" }),
    fix: t("pay for the property you need; check it with a test no shortcut satisfies", { atlas: A.sans, size: 30, x: 960, y: 980, anchor: "center" }),
    check: t("check", { atlas: A.mono, size: 24, x: P.solve[0], y: P.solve[1] - 150, anchor: "center" }),
    close: t("Ask what the training paid for.", { atlas: A.head, size: 50, x: 960, y: 140, anchor: "center" }),
    voice: t("The voice is a synthesized version of the author's.", { atlas: A.sans, size: 26, x: 960, y: 960, anchor: "center" }),
    sources: t("Every number on screen links to its source under the video.", { atlas: A.sans, size: 26, x: 960, y: 1000, anchor: "center" }),
  };
}

// Draw a contour set: bone lines, with closed low loops filled in thermal colour (art layer).
function drawLand(set, items, o, draw = 1) {
  set.forEach((lv, k) => {
    const a = span(draw, k / LEVELS.length * 0.8, k / LEVELS.length * 0.8 + 0.2);
    if (a <= 0) return;
    const shape = asShape(lv.lines);
    items.push({ shape: draw < 1 ? trim(shape, 0, a) : shape, stroke: C.ink, width: 1.1, opacity: o * (0.28 + 0.4 * (1 - k / LEVELS.length)) });
    if (k < 12 && draw >= 1) {
      const loops = lv.lines.filter((_, i) => lv.closed[i]).map((p) => contour(p, true));
      if (loops.length) items.push({ shape: loops, fill: C.thermal[Math.min(5, Math.floor((12 - k) / 2))], opacity: o * 0.16 });
    }
  });
}
function landAt(t, A, T) {
  // Which field, and any morph in progress.
  const toAgree = span(t, T.s2.human, T.s2.human + 3.0, ease.inOut), back = span(t, T.s4.none - 1.5, T.s4.none + 0.5, ease.inOut);
  const toFix = span(t, T.s4.fix, T.s4.fix + 3.2, ease.inOut);
  if (t < T.s2.human) return A.land.tests;
  if (t < T.s3.enter) return toAgree >= 1 ? A.land.agree : contours(blend(fields.tests, fields.agree, toAgree), LEVELS);
  if (t < T.s4.fix) return A.land.tests;
  return toFix >= 1 ? A.land.fixed : contours(blend(fields.tests, fields.fixed, toFix), LEVELS);
}

export function camera(t, T) {
  const z = lerp(1, 1.04, span(t, T.s5.close, T.s5.close + 6, ease.inOut));   // the field ends at the frame, so the close eases in
  return { x: 960, y: 540, zoom: z };
}

export function draw(t, A, T, items) {
  const S = A.r1, put = (shape, fill, o) => { if (o > 0) items.push({ shape, fill, opacity: o }); };
  const putS = (shape, fill, o) => { if (o > 0) items.push({ shape, fill, opacity: o, screen: true }); };
  const strk = (shape, color, w, o, blendMode) => { if (o > 0) items.push({ shape, stroke: color, width: w, opacity: o, blend: blendMode }); };
  // The landscape is away during segment 3 (the episode grids).
  const landA = Math.max(window(t, -1, T.s3.enter + 0.6, 0.01, 1.2), window(t, T.s4.none - 1.2, T.s5.end + 1, 1.2, 0.01));
  if (landA > 0) drawLand(landAt(t, A, T), items, landA, span(t, 0, 3.6, ease.linear));
  // Title.
  put(S.title, C.ink, window(t, 0.5, T.s1.setup, 0.8, 0.6));
  // Segment 1.
  const s1 = window(t, T.s1.setup, T.s2.human + 1, 0.6, 0.8);
  put(S.testsL, C.ink, s1); put(S.rewardL, C.ink2, s1 * span(t, T.s1.reward, T.s1.reward + 0.8));
  put(S.solveL, C.ink, s1); put(S.startL, C.ink2, s1);
  strk(S.dr, C.ink2, 1.6, s1 * 0.9);
  const tun = span(t, T.s1.study + 1.5, T.s1.study + 3.5, ease.out), shut = 1 - span(t, T.s4.fix + 0.5, T.s4.fix + 2.5, ease.inOut);
  const tunA = Math.max(s1 * tun, window(t, T.s4.none, T.s5.close, 0.8, 0.8) * shut);
  if (tunA > 0) { strk(trim(S.d1, 0, shut), C.hot, 2.2, tunA); strk(trim(S.d2, 0, shut), C.hot, 2.2, tunA); }
  put(S.exitL, C.hot, s1 * span(t, T.s1.study + 2.2, T.s1.study + 3.2)); put(S.skipL, C.hot, s1 * span(t, T.s1.study + 3.0, T.s1.study + 4.0));
  // The optimizer: a bright point that takes the first tunnel.
  const go = span(t, T.s1.study + 5.0, T.s1.raise - 0.4, ease.inOut), [px, py] = pointOn(S.tun1, go);
  const ptA = window(t, T.s1.setup + 0.5, T.s2.human + 0.5, 0.6, 0.6);
  if (ptA > 0) { put(circle(px, py, 7, 24), C.ink, ptA); strk(circle(px, py, 13, 24), C.ink, 3, 0.25 * ptA, "add"); }
  put(S.yes, C.ink, s1 * span(t, T.s1.raise, T.s1.raise + 0.6)); put(S.no, C.hot, s1 * span(t, T.s1.neither, T.s1.neither + 0.6));
  put(S.measured, C.ink2, window(t, T.s1.measured, T.s2.human, 0.6, 0.6));
  // Segment 2: the second basin, the balance and its 100 ticks.
  const s2 = window(t, T.s2.human + 0.5, T.s3.enter, 0.8, 0.8);
  put(S.agreeL, C.ink, s2 * span(t, T.s2.human + 2, T.s2.human + 3));
  put(S.trained, C.ink2, window(t, T.s2.assistants, T.s2.sharma - 0.2, 0.5, 0.4));
  put(S.sharma, C.ink2, window(t, T.s2.sharma, T.s2.syco - 0.2, 0.5, 0.4));
  const bal = window(t, T.s2.given, T.s3.enter, 0.8, 0.8);
  if (bal > 0) {
    const tilt = 0.12 * span(t, T.s2.given + 1.0, T.s2.given + 2.6, ease.inOut), cx = 960, cy = 850;
    items.push({ shape: rect(560, 760, 800, 280, 16), fill: "#060607", opacity: 0.72 * bal, blur: 14 });
    strk([contour(new Float32Array([cx - 300 * Math.cos(tilt), cy + 300 * Math.sin(tilt), cx + 300 * Math.cos(tilt), cy - 300 * Math.sin(tilt)]), false)], C.ink, 3, bal);
    strk([contour(new Float32Array([cx, cy, cx - 16, cy + 30, cx + 16, cy + 30, cx, cy]), true)], C.ink2, 2, bal);
    put(S.beamL, C.hot, bal); put(S.beamR, C.ink2, bal);
    const lit = Math.round(95 * span(t, T.s2.given + 2.0, T.s2.given + 5.0, ease.out)), hot = [], cool = [];
    for (let i = 0; i < 100; i++) (i < 95 && i < lit ? hot : cool).push(...rect(612 + i * 7, 940, 3, 26));
    put(hot, C.hot, bal); put(cool, C.ink2, bal * 0.7);
    put(S.pref, C.hot, bal * span(t, T.s2.given + 4.6, T.s2.given + 5.4));
  }
  put(S.syco, C.ink2, window(t, T.s2.syco + 0.2, T.s3.enter, 0.5, 0.6));
  // Segment 4: the fix, and the close.
  put(S.wants, C.ink, window(t, T.s4.none, T.s5.close, 0.8, 0.6));
  put(S.needs, C.ink2, window(t, T.s4.needs, T.s5.close, 0.6, 0.6));
  put(S.fix, C.ink2, window(t, T.s4.fix, T.s5.close, 0.6, 0.6));
  const chk = window(t, T.s4.fix + 2.6, T.s5.end + 1, 0.6, 0.01);
  if (chk > 0) { strk(circle(P.solve[0], P.solve[1] - 110, 14, 24), C.ink, 2.4, chk); put(S.check, C.ink, chk); }
  putS(S.close, C.ink, span(t, T.s5.close + 0.4, T.s5.close + 1.6));
  putS(S.voice, C.ink2, span(t, T.s5.voice, T.s5.voice + 0.8)); putS(S.sources, C.ink2, span(t, T.s5.sources, T.s5.sources + 0.8));
}
