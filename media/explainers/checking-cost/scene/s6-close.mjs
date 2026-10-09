// The close, "Two things to keep", over the light-thread field.
import { trim } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { text } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { span, window, ease } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";
import { C, scrim } from "./lib.mjs";
import { icon } from "./s5-rerun.mjs";

export function prepare(A) {
  const t = (s, size, y, atlas = A.head) => text(s, { atlas, size, x: 960, y, anchor: "center" }).shape;
  A.s6 = {
    keep: t("Two things to keep.", 40, 290, A.sans),
    one: t("How a claim looks says nothing about whether it holds.", 54, 450),
    two: t("The cheapest check ships with the claim.", 54, 580),
    voice: t("The voice is a synthesized version of the author's.", 26, 960, A.sans),
    sources: t("Every number on screen links to its source under the video.", 26, 1000, A.sans),
  };
}

export function draw(t, A, T, items) {
  const S = A.s6;
  const vis = window(t, T.enter, T.end + 1, 0.8, 1.4);
  if (vis <= 0) return;
  const out = 1 - span(t, T.end - 1.4, T.end, ease.inOut);
  const put = (shape, o) => { if (o > 0) items.push({ shape, fill: C.ink, opacity: o * vis * out, screen: true }); };
  const write = (shape, at, len) => {
    const d = span(t, at, at + len, ease.inOut), f = span(t, at + len * 0.7, at + len + 0.4);
    if (d > 0 && f < 1) items.push({ shape: trim(shape, 0, d), stroke: C.ink, width: 1.2, opacity: vis * out * (1 - f), screen: true });
    put(shape, f);
  };
  const plate = span(t, T.enter - 0.3, T.enter + 0.8) * out;
  if (plate > 0) items.push({ ...scrim([...S.keep, ...S.one, ...S.two], 0.55, 60), opacity: 0.55 * plate * vis });
  put(S.keep, span(t, T.enter, T.enter + 0.8));
  write(S.one, T.one, 2.2);
  write(S.two, T.two, 2.0);
  const ic = span(t, T.two + 0.6, T.two + 1.6, ease.out);
  if (ic > 0) {
    const g = icon(960, 760, ((t - T.two) * 0.45) % 1);
    const o = ic * vis * out;
    items.push({ shape: g.card, stroke: C.ink2, width: 1.8, opacity: o, screen: true });
    items.push({ shape: g.bars, fill: C.dim, opacity: o * 0.8, screen: true });
    items.push({ shape: g.data, stroke: C.ok, width: 1.8, opacity: o, screen: true });
    items.push({ shape: g.loop, stroke: C.ink2, width: 2, opacity: o, screen: true });
  }
  put(S.voice, span(t, T.voice, T.voice + 0.8) * 0.85);
  put(S.sources, span(t, T.sources, T.sources + 0.8) * 0.85);
}
