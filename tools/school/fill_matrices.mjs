// Fill lesson F2's numbers ("Matrices move space") so no number in the film or lab is typed by
// hand: the 2 x 2 demos (grids, unit arrows, determinants, the order demo) and the finale, the
// attention film's query, key and score rebuilt as matrix times vector from the trained model.
// Writes media/school/matrices/facts.json and refuses to write if the finale disagrees with
// media/school/attention/facts.json by more than 1e-4.
//
//   node tools/school/fill_matrices.mjs [media/school/attention] [media/school/matrices]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  apply, columns, det, compose, grid, moveGrid, polygonArea, applyAll, orderDemo, attentionFinale,
  QUARTER_TURN, STRETCH_X, SHEAR_X, UNIT_SQUARE,
} from "../../system/school/matrices.mjs";

const filmDir = process.argv[2] || "media/school/attention";
const outDir = process.argv[3] || "media/school/matrices";
const raw = readFileSync(join(filmDir, "model.json"));
const M = JSON.parse(raw.toString("utf8"));
const FILM = JSON.parse(readFileSync(join(filmDir, "facts.json"), "utf8"));
const round = (v, k = 4) => (Array.isArray(v) ? v.map((x) => round(x, k)) : Math.round(v * 10 ** k) / 10 ** k);

const G = grid(3, 12);
function demo(name, Mx) {
  return {
    name, matrix: Mx, columns: columns(Mx), det: det(Mx),
    unitSquare: round(applyAll(Mx, UNIT_SQUARE)), area: round(polygonArea(applyAll(Mx, UNIT_SQUARE))),
    grid: moveGrid(Mx, G).map((l) => round(l)),
    arrow: { from: [1, 1], to: round(apply(Mx, [1, 1])) },
  };
}
const order = orderDemo(QUARTER_TURN, STRETCH_X);
const v = [1, 1], AB = compose(QUARTER_TURN, STRETCH_X);

const f = attentionFinale(M);
const worst = Math.max(...f.q.map((x, j) => Math.abs(x - FILM.q[j])), ...f.k.map((x, j) => Math.abs(x - FILM.k[j])), Math.abs(f.qkRaw - FILM.qkRaw));
if (f.layer !== FILM.layer || f.head !== FILM.head || worst > 1e-4) {
  throw new Error(`finale disagrees with the attention film: layer ${f.layer}/${FILM.layer} head ${f.head}/${FILM.head} worst ${worst}`);
}

const facts = {
  about: "Computed by tools/school/fill_matrices.mjs from the attention film's model.json. Do not edit by hand. "
    + "Matrices are [[a, b], [c, d]] by rows and act on column points [x, y]. The finale rebuilds the attention "
    + "film's query, key and score as the layer-norm output times the head's slice of wqkv plus bias.",
  modelSha256: createHash("sha256").update(raw).digest("hex"),
  modelFile: "media/school/attention/model.json",
  gridBase: G.map((l) => round(l)),
  demos: [demo("quarter turn", QUARTER_TURN), demo("horizontal stretch", STRETCH_X), demo("shear", SHEAR_X)],
  order: {
    A: order.A, B: order.B, AB: order.AB, BA: order.BA, commute: order.commute,
    eastArrow: { AB: order.onArrow.AB, BA: order.onArrow.BA },
    associativity: { v, ABv: apply(AB, v), A_Bv: apply(QUARTER_TURN, apply(STRETCH_X, v)) },
  },
  finale: {
    probe: FILM.probe.words, layer: f.layer, head: f.head, dModel: f.dModel, dHead: f.dHead,
    readingWord: f.readingWord, readingPos: f.query, answerWord: f.answerWord, answerPos: f.answerFrom,
    xQuery: round(f.xQuery), xKey: round(f.xKey), Wq: f.Wq.map((r) => round(r)), Wk: f.Wk.map((r) => round(r)),
    bq: round(f.bq), bk: round(f.bk), q: round(f.q), k: round(f.k),
    qkRaw: round(f.qkRaw), scaled: round(f.scaled), sqrtDHead: Math.sqrt(f.dHead),
    agreesWithFilmWithin: 1e-4, worstDifferenceFromFilm: worst, maxDiffFromForwardPass: f.maxDiffFromForward,
    wMax: round(Math.max(...f.Wq.flat().map(Math.abs), ...f.Wk.flat().map(Math.abs))),
    xMax: round(Math.max(...f.xQuery.map(Math.abs), ...f.xKey.map(Math.abs))),
  },
};
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
console.log(JSON.stringify({ layer: f.layer, head: f.head, qkRaw: facts.finale.qkRaw, scaled: facts.finale.scaled, filmQkRaw: FILM.qkRaw, worst, maxDiffFromForwardPass: f.maxDiffFromForward, order: { AB: order.AB, BA: order.BA } }, null, 1));
