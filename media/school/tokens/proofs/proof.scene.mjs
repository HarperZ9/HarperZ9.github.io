// Visual-direction proofs for lesson L7 (tokens): one beat, the sentence "rerun knocked on a shell ."
// cut with 0, 50 and 136 of the learned merges (encoded here with the lesson's own encoder from
// facts.json's merge list). ?dir=A: stamped crates on Pylon's paper ledger; ?dir=B: glowing
// crates on a dark conveyor in the customs shed.
import { rect, circle, polyline, words } from "../../shared/lib.mjs";
import { pylon, desk } from "../../vectors/scene/chart.mjs";
import { GUIDES } from "../../shared/lib.mjs";
import { encodeWord, EOW } from "../../../../system/school/tokens.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "A";
const SENT = ["rerun", "knocked", "on", "a", "shell", "."];
export default {
  title: `Tokens proof ${DIR}`, duration: 6, fps: 30,
  async load(ctx) {
    const [sans, mono, F] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/conso-400.json"), ctx.json("../facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    const merges = F.corpus.allMerges.map(([a, b]) => ({ a, b }));
    const rows = [0, 50, 136].map((upto) => ({ upto, pieces: SENT.map((w) => encodeWord(w, merges, { upto })) }));
    return { sans, mono, rows };
  },
  frame(t, ctx) {
    const A = ctx.assets, light = DIR === "A", items = [];
    if (light) items.push(...desk(t), { shape: rect(200, 140, 1400, 800, 6), fill: [0.9, 0.85, 0.71, 1], stroke: "#3a2c1c", width: 4 });
    else { items.push({ shape: rect(0, 0, 1920, 1080), fill: [0.02, 0.022, 0.03, 1], screen: true }); for (let k = 0; k < 3; k++) items.push({ shape: rect(120, 330 + k * 230, 1560, 14, 4), fill: [0.25, 0.22, 0.2, 1] }); }
    A.rows.forEach((row, k) => {
      const y = 260 + k * 230, n = row.pieces.flat().length, w = Math.min(120, 1400 / n);
      let x = 240;
      items.push({ shape: words(`${row.upto} merges: ${n} pieces`, A.mono, 26, 240, y - 60), fill: light ? "#1d1812" : "#ece5d6" });
      row.pieces.forEach((pieces) => {
        pieces.forEach((p) => {
          const lab = p.replace(EOW, "_"), pw = Math.max(w, lab.length * 22 + 16), a = Math.min(1, Math.max(0, t * 1.5 - k * 0.8 - (x - 240) / 2000));
          items.push({ shape: rect(x, y - 30, pw - 8, 64, 6), fill: light ? [0.56, 0.42, 0.28, a] : [1, 0.75, 0.45, 0.18 * a], stroke: light ? [0.16, 0.12, 0.08, a] : [1, 0.8, 0.55, 0.9 * a], width: 2.5, blend: light ? undefined : "add" });
          items.push({ shape: words(lab, A.mono, 30, x + (pw - 8) / 2, y + 12, "center"), fill: light ? "#f3ead2" : "#ece5d6", opacity: a });
          x += pw;
        });
        x += 24;
      });
    });
    items.push({ shape: words("_ marks the end of a word", A.mono, 22, 240, 960), fill: light ? "#6e5c42" : "#958e80" }, ...pylon(t, 1745, 1015, 0.5));
    return { background: [0.02, 0.016, 0.012], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: light ? 0.1 : 0.3, threshold: 1, vignette: 0.36, grain: 0.05, passes: [] } };
  },
};
