// The receipts lab, drawn at Rerun's tide line: what was changed, the verdict, every check as a mark
// (pale: passed, ember: failed; the lesson's extra checks marked "+"), the score counted from the rows,
// and for the signed lie the two checks that catch it. Pure in state.
import { rect, circle } from "../../media/school/shared/lib.mjs";
import { lab, plate, beach, scene, INK } from "../../media/school/errorbars/scene/tide.mjs";

export function frame(s, A, t) {
  const r = s.result, items = [...beach(t), plate(560, 60, 1300, 900, 0.6)];
  const wrap = (str, n = 100) => str.split(" ").reduce((ls, w) => { if ((ls.at(-1) + " " + w).length > n) ls.push(w); else ls[ls.length - 1] = (ls.at(-1) + " " + w).trim(); return ls; }, [""]);
  wrap(s.what || "loading the bundle").slice(0, 2).forEach((ln, i) => items.push(lab(A, ln, 20, 600, 100 + i * 28, INK.dim)));
  if (r && !s.busy) {
    items.push(lab(A, r.verdict, 48, 600, 200, r.verdict === "MATCH" ? INK.night : INK.ember));
    if (s.count) items.push(lab(A, `${s.count.correct} of ${s.count.total} counted from the rows`, 24, 900, 196, INK.night));
    (r.checks || []).forEach((c, i) => { const x = 600 + Math.floor(i / 12) * 620, y = 270 + (i % 12) * 44;
      items.push({ shape: circle(x + 10, y - 8, 9, 20), fill: c.pass === false ? [0.89, 0.58, 0.45, 1] : c.pass === null ? [0.45, 0.43, 0.4, 1] : [0.9, 0.86, 0.75, 1], screen: true }, lab(A, `${c.flywheel ? "" : "+ "}${c.id}`, 20, x + 30, y, c.pass === false ? INK.ember : INK.night)); });
    if (s.after) items.push({ shape: rect(600, 820, 1220, 2), fill: [0.6, 0.55, 0.45, 1], screen: true },
      lab(A, `with the true answers revealed: ${s.after.verdict}${s.after.failed.length ? ` (${s.after.failed.join(", ")})` : ""}`, 22, 600, 860, s.after.verdict === "MATCH" ? INK.night : INK.ember),
      lab(A, `with the key trusted before: ${s.pinned.verdict}${s.pinned.failed.length ? ` (${s.pinned.failed.join(", ")})` : ""}`, 22, 600, 900, s.pinned.verdict === "MATCH" ? INK.night : INK.ember));
  } else if (s.busy) items.push(lab(A, "checking", 32, 600, 200, INK.dim));
  return { background: [0.012, 0.011, 0.014], ...scene(t, A, items), post: { bloom: 0.12, threshold: 1, vignette: 0.3, grain: 0.04, passes: [] } };
}
