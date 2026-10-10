// Film 5: the title, segment 1 "A hint it does not mention" (Turpin et al. 2023), and
// the close. An aperture shaped like an eye; the title's glyphs flow out of its pupil as
// the first ribbon. A multiple-choice question gains one line, "I think the answer is
// A...", and a vermilion thread runs from that line to answer A. The reasoning ribbon
// flows, argues for A and never touches the thread. The question's own text is drawn as
// bars: the source's questions are not reproduced here.
import { contour, rect, circle } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { text } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { span, window, ease, lerp } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";
import { C, curve, bezier, run, bend } from "./ribbon.mjs";

const EYE = { x: 960, y: 470 };
function eye(cx, cy, w = 300, h = 150) {
  const top = [], bot = [];
  for (let i = 0; i <= 48; i++) { const u = i / 48, x = cx - w + 2 * w * u, k = Math.sin(Math.PI * u); top.push(x, cy - h * k); bot.push(x, cy + h * k); }
  return [contour(new Float32Array(top), false), contour(new Float32Array(bot), false)];
}

export function prepare(A) {
  const t = (s, o) => text(s, o).shape;
  const titleCurve = curve(bezier([EYE.x, EYE.y], [EYE.x + 220, EYE.y - 40], [EYE.x + 520, EYE.y + 260], [1880, EYE.y + 330]));
  const ribbonCurve = curve(bezier([880, 330], [1150, 160], [1450, 420], [1840, 300]));
  A.v1 = {
    eye: eye(EYE.x, EYE.y), iris: circle(EYE.x, EYE.y, 104, 64), pupil: circle(EYE.x, EYE.y, 54, 48),
    titleRun: run("What a model's written reasoning can and cannot show.", A.sans, 30), titleCurve,
    title: [t("What a model's written reasoning", { atlas: A.head, size: 54, x: 960, y: 800, anchor: "center" }),
      t("can and cannot show.", { atlas: A.head, size: 54, x: 960, y: 866, anchor: "center" })],
    card: rect(200, 170, 640, 300, 14),
    qbars: [0.9, 0.75, 0.55].flatMap((w, k) => rect(240, 205 + k * 30, 560 * w, 12, 6)),
    opts: ["A", "B", "C", "D"].map((s, k) => ({ box: rect(240 + k * 140, 330, 110, 96, 10), label: t(s, { atlas: A.head, size: 46, x: 295 + k * 140, y: 394, anchor: "center" }) })),
    hint: t("I think the answer is A, but I'm curious to hear what you think.", { atlas: A.sans, size: 27, x: 200, y: 530 }),
    thread: curve(bezier([210, 520], [120, 470], [180, 420], [295, 426])),
    tasks: t("13 reasoning tasks . 3,299 questions", { atlas: A.mono, size: 26, x: 200, y: 600 }),
    ribbonRun: run("step . step . step . so the answer is A", A.sans, 34), ribbonCurve,
    depiction: t("a depiction, not a readout", { atlas: A.mono, size: 22, x: 1840, y: 360, anchor: "right" }),
    acc: t("accuracy down by as much as 36%, worst case", { atlas: A.mono, size: 32, x: 960, y: 760, anchor: "center" }),
    reads: t("It read as a reason. It was not the whole cause.", { atlas: A.sans, size: 32, x: 960, y: 960, anchor: "center" }),
    close: t("Read the reasoning, and trust the actions you can check.", { atlas: A.head, size: 44, x: 960, y: 820, anchor: "center" }),
    voice: t("The voice is a synthesized version of the author's.", { atlas: A.sans, size: 26, x: 960, y: 960, anchor: "center" }),
    sources: t("Every number on screen links to its source under the video.", { atlas: A.sans, size: 26, x: 960, y: 1000, anchor: "center" }),
    closeRibbon: curve(bezier([EYE.x + 60, EYE.y - 20], [1250, 260], [1500, 360], [1860, 250])),
    closeThread: curve(bezier([EYE.x + 60, EYE.y + 30], [1250, 640], [1500, 560], [1860, 660])),
  };
}

export function draw(t, A, T, items) {
  const S = A.v1, put = (shape, fill, o) => { if (o > 0 && shape.length) items.push({ shape, fill, opacity: o }); };
  const strk = (shape, color, w, o, blend) => { if (o > 0 && shape.length) items.push({ shape, stroke: color, width: w, opacity: o, blend }); };
  // The eye: at the title and again at the close.
  const eyeA = Math.max(window(t, -1, T.s1.ask, 0.01, 0.8), span(t, T.s5.close - 0.4, T.s5.close + 1.2)) * (1 - span(t, T.s5.end - 1.2, T.s5.end));
  strk(S.eye, C.ink, 1.8, eyeA); strk(S.iris, C.ink2, 1.2, eyeA * 0.8); put(S.pupil, "#05070f", eyeA); strk(S.pupil, C.ink, 1.4, eyeA);
  if (t < T.s1.ask + 0.5) {
    const flow = span(t, 0.3, 3.6, ease.out), off = lerp(-S.titleRun.width, 70, flow);
    put(bend(S.titleRun, S.titleCurve, off, -off - 10, S.titleCurve.total - off - 30), C.ink2, window(t, 0.3, T.s1.ask, 0.4, 0.6) * 0.8);
    S.title.forEach((sh, k) => put(sh, C.ink, window(t, 1.0 + k * 0.4, T.s1.ask, 0.6, 0.6)));
  }
  // Segment 1.
  const s1 = window(t, T.s1.ask, T.s2.enter, 0.8, 0.8);
  if (s1 > 0) {
    strk(S.card, C.ink2, 1.6, s1); put(S.qbars, C.dim, s1);
    S.opts.forEach((o) => { strk(o.box, C.ink2, 1.6, s1); put(o.label, C.ink, s1); });
    const hintA = span(t, T.s1.hintAt, T.s1.hintAt + 1.2);
    put(S.hint, C.ink2, s1 * hintA);
    const th = span(t, T.s1.hintAt + 1.0, T.s1.hintAt + 2.6, ease.inOut), pulse = 1 + 1.6 * window(t, T.s1.cause, T.s1.cause + 1.6, 0.3, 0.9);
    if (th > 0) {
      const p = S.thread.pts.subarray(0, Math.max(4, Math.floor((S.thread.pts.length / 2) * th) * 2));
      strk([contour(p, false)], C.hot, 2.4 * pulse, s1); strk([contour(p, false)], C.hot, 7, 0.16 * s1 * pulse, "add");
    }
    put(S.tasks, C.ink2, s1 * span(t, T.s1.turpin, T.s1.turpin + 0.8));
    const flow = span(t, T.s1.argued, T.s1.argued + 4.0, ease.out), off = lerp(-S.ribbonRun.width, 40, flow);
    put(bend(S.ribbonRun, S.ribbonCurve, off, -off - 10, S.ribbonCurve.total - off - 30), C.ink, s1 * Math.min(1, flow * 3));
    put(S.depiction, C.hot, s1 * span(t, T.s1.argued + 1.0, T.s1.argued + 1.8));
    put(S.acc, C.ink, s1 * span(t, T.s1.fell, T.s1.fell + 0.8));
    put(S.reads, C.ink2, window(t, T.s1.read, T.s2.enter, 0.6, 0.6));
  }
  // The close: the ribbon and the thread, side by side.
  const cl = span(t, T.s5.close + 0.6, T.s5.close + 2.4) * (1 - span(t, T.s5.end - 1.2, T.s5.end));
  if (cl > 0) {
    const off = lerp(-S.ribbonRun.width, 30, span(t, T.s5.close + 0.6, T.s5.close + 4, ease.out));
    put(bend(S.ribbonRun, S.closeRibbon, off, -off - 10, S.closeRibbon.total - off - 30), C.ink, cl);
    strk([contour(S.closeThread.pts, false)], C.hot, 2.4, cl); strk([contour(S.closeThread.pts, false)], C.hot, 7, 0.14 * cl, "add");
    put(S.close, C.ink, span(t, T.s5.close + 1.0, T.s5.close + 2.2) * (1 - span(t, T.s5.end - 1.2, T.s5.end)));
    put(S.voice, C.ink2, span(t, T.s5.voice, T.s5.voice + 0.8)); put(S.sources, C.ink2, span(t, T.s5.sources, T.s5.sources + 0.8));
  }
}
