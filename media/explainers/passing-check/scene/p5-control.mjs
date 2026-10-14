// Segment 5, "A check that can show it can fail", and the close. Two checks are fed
// the same known-wrong input. The broken one lets it through and glows "pass" in drift:
// that check is broken. The working one rejects it, and the film's one verified-lime mark
// lands: "failed, as it should". The live version's parameter takes the control away;
// then both checks just say "pass", and the frame says what that is worth.
// The close returns to the aperture, with the line no test ran now lit by the control.
import { contour, rect } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { text } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { span, window, ease, lerp } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";
import { C, N, BROKEN } from "./world.mjs";

const GATES = [640, 1280], GY = 500;

export function prepare(A) {
  const t = (s, o) => text(s, o).shape;
  const token = (x) => [contour(new Float32Array([x - 60, 0, x - 8, 0]), false), contour(new Float32Array([x - 4, 0, x + 60, 0]), false)];
  A.p5 = {
    gate: (x) => [...rect(x - 46, GY - 120, 30, 240, 4), ...rect(x + 16, GY - 120, 30, 240, 4)],
    names: [t("check A", { atlas: A.mono, size: 28, x: GATES[0], y: GY - 160, anchor: "center" }), t("check B", { atlas: A.mono, size: 28, x: GATES[1], y: GY - 160, anchor: "center" })],
    input: t("known-wrong input", { atlas: A.sans, size: 26, x: 960, y: 250, anchor: "center" }),
    token,
    crack: [contour(new Float32Array([-6, -9, -2, -3, -6, 2, -1, 9]), false)],
    passA: t("pass", { atlas: A.mono, size: 34, x: GATES[0], y: GY + 190, anchor: "center" }),
    broken: t("so check A is broken", { atlas: A.sans, size: 28, x: GATES[0], y: GY + 236, anchor: "center" }),
    failB: t("failed, as it should", { atlas: A.mono, size: 34, x: GATES[1], y: GY + 190, anchor: "center" }),
    control: t("a false-success control: one planted failure, one extra run", { atlas: A.sans, size: 30, x: 960, y: 150, anchor: "center" }),
    evidence: t("a pass with a control that failed: evidence", { atlas: A.sans, size: 30, x: 960, y: 150, anchor: "center" }),
    absence: t("a pass on its own: the absence of a complaint", { atlas: A.sans, size: 30, x: 960, y: 192, anchor: "center" }),
    noControl: t("no control run", { atlas: A.mono, size: 34, x: 960, y: 250, anchor: "center" }),
    plainPass: [t("pass", { atlas: A.mono, size: 34, x: GATES[0], y: GY + 190, anchor: "center" }), t("pass", { atlas: A.mono, size: 34, x: GATES[1], y: GY + 190, anchor: "center" })],
    closeA: t("A check earns trust", { atlas: A.head, size: 50, x: 960, y: 520, anchor: "center" }),
    closeB: t("by failing when it should.", { atlas: A.head, size: 50, x: 960, y: 586, anchor: "center" }),
    voice: t("The voice is a synthesized version of the author's.", { atlas: A.sans, size: 26, x: 960, y: 680, anchor: "center" }),
    sources: t("Every number on screen links to its source under the video.", { atlas: A.sans, size: 26, x: 960, y: 720, anchor: "center" }),
  };
}

const at = (shape, x, y) => shape.map((c) => { const p = c.pts, o = new Float32Array(p.length); for (let k = 0; k < p.length; k += 2) { o[k] = p[k] + x; o[k + 1] = p[k + 1] + y; } return contour(o, c.closed); });

export function draw(t, A, T, items) {
  const S = A.p5, put = (shape, fill, o) => { if (o > 0) items.push({ shape, fill, opacity: o, screen: true }); };
  const strokeP = (shape, color, w, o, blend) => { if (o > 0) items.push({ shape, stroke: color, width: w, opacity: o, screen: true, blend }); };
  const vis = window(t, T.enter, T.close, 0.8, 0.9);
  if (vis > 0) {
    const planted = (A.params && A.params.control !== undefined) ? A.params.control >= 0.5 : true;
    S.names.forEach((n, k) => put(n, C.ink2, vis));
    put(S.gate(GATES[0]), C.ink2, 0.8 * vis);
    const bGlow = planted ? span(t, T.evidence, T.evidence + 0.8) : 0;
    put(S.gate(GATES[1]), bGlow > 0 ? C.lime : C.ink2, (0.8 + 0.2 * bGlow) * vis);
    if (!planted) {
      put(S.noControl, C.ink, vis);
      S.plainPass.forEach((p) => put(p, C.ink, vis * span(t, T.enter + 1.0, T.enter + 1.8)));
      put(S.absence, C.hot, vis * span(t, T.enter + 2.0, T.enter + 2.8));
    } else {
      put(S.input, C.ink2, window(t, T.enter + 0.3, T.passes + 2.0, 0.5, 0.5) * vis);
      // Token A goes through the gate; token B stops at it and is turned back.
      const ua = span(t, T.enter + 0.8, T.passes + 0.6, ease.inOut), ub = span(t, T.enter + 0.8, T.evidence, ease.inOut);
      const ax = lerp(GATES[0] - 330, GATES[0] + 250, ua);
      const reach = Math.min(1, ub / 0.8), bx = lerp(GATES[1] - 330, GATES[1] - 90, reach) - (ub > 0.8 ? 40 * span(ub, 0.8, 1) : 0);
      strokeP(at(S.token(ax), 0, GY), C.ink, 2, vis);
      strokeP(at(S.crack, ax, GY), C.hot, 1.6, vis);
      strokeP(at(S.token(bx), 0, GY), C.ink, 2, vis);
      strokeP(at(S.crack, bx, GY), C.hot, 1.6, vis);
      const pa = span(t, T.passes, T.passes + 0.6);
      put(S.passA, C.hot, pa * vis); put(S.broken, C.hot, pa * vis);
      put(S.control, C.ink2, window(t, T.control, T.evidence - 0.2, 0.5, 0.4) * vis);
      put(S.failB, C.lime, bGlow * vis);
      if (bGlow > 0) strokeP(S.gate(GATES[1]), C.lime, 2.5, 0.25 * bGlow * vis, "add");
      put(S.evidence, C.ink, window(t, T.evidence + 0.3, T.close, 0.5, 0.5) * vis);
      put(S.absence, C.ink2, window(t, T.absence, T.close, 0.5, 0.5) * vis);
    }
  }
  // The close: the aperture of code lines, with the cracked line lit by the control.
  const c = span(t, T.close - 0.2, T.close + 1.4, ease.inOut);
  if (c <= 0) return;
  const out = 1 - span(t, T.end - 1.2, T.end, ease.inOut);
  const lines = [];
  for (let i = 0; i < N; i++) if (i !== BROKEN) lines.push(contour(A.p1.radial[i], false));
  items.push({ shape: lines, stroke: C.ink, width: 1.5, opacity: 0.55 * c * out });
  const lit = [contour(A.p1.radial[BROKEN], false)];
  items.push({ shape: lit, stroke: C.lime, width: 2.4, opacity: c * out });
  items.push({ shape: lit, stroke: C.lime, width: 7, opacity: 0.18 * c * out, blend: "add" });
  put(S.closeA, C.ink, span(t, T.close + 0.4, T.close + 1.6) * out);
  put(S.closeB, C.ink, span(t, T.close + 1.2, T.close + 2.4) * out);
  put(S.voice, C.ink2, span(t, T.voice, T.voice + 0.8) * out);
  put(S.sources, C.ink2, span(t, T.sources, T.sources + 0.8) * out);
}
