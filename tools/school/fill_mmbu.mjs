// Lesson S20's facts: our MMBU Challenge entry, from the run records and the published per-row scores.
//
//   node tools/school/fill_mmbu.mjs [MMBU_DIR] [LEDGER_DIR]
//
// Three kinds of number, each with where it came from:
// 1. Results the scorers wrote as JSON (bars, baselines, the option readout, the image audit, the
//    held-out vocabulary re-score), read from the MMBU folder and copied to media/school/mmbu/
//    published.json with each source file's SHA-256.
// 2. Records that exist only as prose (the survival incidents, the challenge's terms), listed in
//    RECORDS below with the file and the exact words that must appear in it; a record whose words
//    are not found stops the fill.
// 3. Recomputed intervals: the scorers' bootstraps re-run here on media/school/mmbu/data/ with
//    numpy's random stream (system/school/mmbu.mjs), and compared with the published digits.
// The ledger's state is read with git (and gh for its visibility) from the ledger folder.
// Without the MMBU folder, published.json is read as it stands and only part 3 is rerun.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { devBootstrap, clusterBootstrap, devSeries, difference, DEV } from "../../system/school/mmbu.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "media", "school", "mmbu");
const MMBU = process.argv[2] || "C:/dev/mission-control/2026-10-02-mmbu";
const LEDGER = process.argv[3] || "D:/prereg-ledger";
const j = (p) => JSON.parse(readFileSync(p, "utf8"));
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const iv = ([mean, lo, hi], met) => ({ mean, lo, hi, ...(met === undefined ? {} : { met }) });

const SOURCES = {
  b4: "train/b4/bars_b4_full.json", ft3: "train/ft3/bars_ft3.json", ft4: "train/ft4/bars_ft4_excl12.json", ft5: "train/ft5/bars_ft5.json",
  ft6: "train/ft6/bars_ft6.json", ft7: "train/ft7/bars_ft7.json", baselines: "diag/baselines.json", prior: "diag/prior_gap.json",
  option: "diag/option_readout_FT5_4B.json", audit: "diag/image_audit.json", vocab: "train/heldout_vocab/heldout_vocab_ft7.json",
};

// Prose-only records: value, the file, and words that must appear in it (so a typo here cannot pass).
const RECORDS = [
  ["challenge.datasets", 410, "sources/paper.txt", "410"],
  ["challenge.sources", 86, "STATUS-2026-10-15.md", "**Disclosure.** 86 sources."],
  ["challenge.deadline", "31 December 2026", "AMENDMENT-ORGANIZER-ANSWERS-2026-10-03.md", "31"],
  ["challenge.pmax", 4.66, "train/b4/PREREG-B4.md", "4.66B"],
  ["challenge.organiser", "Stanford MARVL", "sources/site.html", "Stanford MARVL"],
  ["challenge.disclosedQuote", "All datasets are acceptable as long as disclosed.", "ORGANIZER-NOTES-DISCORD-2026-10-14.md", "All datasets are acceptable as long as disclosed."],
  ["challenge.judgeAgree", 175, "STATUS-2026-10-12.md", "175"],
  ["challenge.judgeRows", 180, "STATUS-2026-10-12.md", "180"],
  ["models.params2b", 2274069824, "TRACK-PLAN-2026-10-14.md", "2,274,069,824"],
  ["models.params4b", 4659865088, "TRACK-PLAN-2026-10-14.md", "4,659,865,088"],
  ["models.rank", 16, "train/PREREG.md", "rank 16"],
  ["ft4.rows", 29421, "train/ft4/PREREG-FT4.md", "29,421"],
  ["ft4.newSources", 20, "train/ft4/PREREG-FT4.md", "6,386 train rows from 20 sources"],
  ["ft4.extraNamed", 3, "train/ft4/PREREG-FT4.md", "plus RIVA_PAP, DERM12345 and FDG_PET_CT"],
  ["ft4.formatCopies", 1039, "train/ft4/PREREG-FT4.md", "each of the 1,039 FT3A Pass 2 rows"],
  ["ledger.fullMatch", 16, "@factcheck", "16 files match a full SHA-256"],
  ["ledger.prefixMatch", 3, "@factcheck", "8-hex prefixes"],
  ["survival.idleHours", 10, "STATUS-2026-10-15.md", "about 10 hours of GPU idle"],
  ["survival.dupSteps", 40, "STATUS-2026-10-15.md", "cost 40 steps and about 30 minutes of GPU time"],
  ["survival.dupMinutes", 30, "STATUS-2026-10-15.md", "cost 40 steps and about 30 minutes of GPU time"],
  ["survival.saveStep", 665, "STATUS-2026-10-15.md", "The trainer saved at step 665"],
  ["survival.downHours", 6.2, "@ledger", "6.2 h"],
  ["survival.saveSeconds", 0.53, "@ledger", "0.53 s"],
  ["survival.ft7Steps", 1864, "STATUS-2026-10-15.md", "All 1,864 steps done"],
  ["survival.ft5Steps", 1437, "STATUS-2026-10-15.md", "FT5_4B (about 1,437 steps)"],
  ["survival.ft6Steps", 1736, "STATUS-2026-10-15.md", "All 1,736 steps done"],
  ["survival.checkpointEvery", 50, "STATUS-2026-10-15.md", "checkpoints every 50 steps"],
  ["survival.ft8Step", 500, "STATUS-2026-10-15.md", "step ~500 of 1,918"],
  ["survival.ft8Steps", 1918, "STATUS-2026-10-15.md", "step ~500 of 1,918"],
  ["survival.pauseQuote", "Pause the MMBU work for now.", "STATUS-2026-10-15.md", "Pause the MMBU work for now."],
  ["ledger.filesMatched", 19, "@digest", "All 19 prereg and amendment files hashed on 2026-10-17 match their ledger values"],
  ["amend2.step", 20, "@ledger", "last train log line: step 20 2026-10-16T07:13:18 UTC"],
];

function readPublished() {
  const P = {}, src = {};
  for (const [k, rel] of Object.entries(SOURCES)) { const p = join(MMBU, rel); P[k] = j(p); src[k] = { file: rel, sha256: sha(p) }; }
  const bar = (d, prefix) => { const k = Object.keys(d.bars || d).find((x) => x.startsWith(prefix)); if (!k) throw new Error(`no bar ${prefix}`); return (d.bars || d)[k]; };
  const b4 = (k) => { const [v, met] = bar(P.b4, k); return { mean: v.diff, lo: v.lo, hi: v.hi, met }; };
  const out = {
    sources: src,
    b4: { C8: b4("C8 "), C9: b4("C9 ") },
    ft3: { G3: iv(...bar(P.ft3, "G3 ")) },
    ft4: { H1: iv(...bar(P.ft4, "H1 ")) },
    ft5: { K1: iv(...bar(P.ft5, "K1 ")), B2: iv(...bar(P.ft5, "B2 ")) },
    ft6: { M1: iv(...bar(P.ft6, "M1 ")), M2: iv(...bar(P.ft6, "M2 ")), M3: iv(...bar(P.ft6, "M3 ")), M4: iv(...bar(P.ft6, "M4 ")),
      regionRows: P.ft6.region_rows, pass2: P.ft6.arms.FT6_4B.shell_pass2[0], jsonFound: P.ft6.arms.FT6_4B.pass1_json_found ?? bar(P.ft6, "M6 ")[0][0] },
    ft7: { N1: iv(...bar(P.ft7, "N1 ")), N3: iv(...bar(P.ft7, "N3 ")), N4: iv(...bar(P.ft7, "N4 ")), N5: iv(...bar(P.ft7, "N5 ")),
      T: { FT3A_4B: P.ft7.arms.FT3A_4B.T_jp1[0], FT7_4B: P.ft7.arms.FT7_4B.T_jp1[0] }, Tci: { FT3A_4B: iv(P.ft7.arms.FT3A_4B.T_jp1), FT7_4B: iv(P.ft7.arms.FT7_4B.T_jp1) }, C: { FT3A_4B: P.ft7.arms.FT3A_4B.C_strict[0], FT7_4B: P.ft7.arms.FT7_4B.C_strict[0] },
      candidate: { pass2: P.ft7.arms.FT3A_4B.shell_pass2[0], jsonFound: P.ft7.arms.FT3A_4B.pass1_json_found }, rows: P.ft7.n },
    baselines: { chance: P.baselines.chance_jp1, oracle: P.baselines.majority_loo_oracle_jp1, rows: P.baselines.rows, excluded: P.baselines.excluded },
    prior: { model: P.prior.FT4_4B.total.model, offTaxonomy: P.prior.FT4_4B.total.off_taxonomy,
      chest: (([, , , n, m, p]) => ({ rows: n, model: m, prior: p }))(P.prior.FT4_4B.worst_families_prior_minus_model[0]),
      tips: (([, , , n, m, p]) => ({ rows: n, model: m, prior: p }))(P.prior.FT4_4B.worst_families_prior_minus_model[1]) },
    option: { R1: P.option.R1, G: P.option.G, diff: iv(P.option.R1_minus_G), rows: P.option.rows_single },
    audit: { real: P.audit.T_jp1_real, blank: P.audit.T_jp1_blank, changed: P.audit.A1_answer_change_rate, diff: iv(P.audit.A2_real_minus_blank) },
    vocab: { changes: P.vocab.changes, ft7minusFt6: P.vocab.context["context:ft7_4b_minus_ft6_4b"],
      ft6: P.vocab.context["context:ft6_4b"], ft7: P.vocab.context["context:ft7_4b"] },
  };
  return out;
}

function readRecords() {
  const digest = join(dirname(MMBU), "2026-10-15-learning-platform", "mmbu", "DIGEST.md");
  const R = {};
  for (const [path, value, file, words] of RECORDS) {
    const p = file === "@ledger" ? join(LEDGER, "ATTESTATIONS.md") : file === "@digest" ? digest : file === "@factcheck" ? join(OUT, "FACTCHECK.md") : join(MMBU, file);
    if (!readFileSync(p, "utf8").includes(words)) throw new Error(`record ${path}: "${words}" not found in ${file}`);
    const keys = path.split("."); let o = R;
    for (const k of keys.slice(0, -1)) o = o[k] ??= {};
    o[keys.at(-1)] = value;
  }
  return R;
}

function readLedger() {
  const g = (...a) => execFileSync("git", ["-C", LEDGER, ...a], { encoding: "utf8" });
  const count = (s) => (s.match(/^## .*entry \d+/gim) || []).length;
  const local = readFileSync(join(LEDGER, "ATTESTATIONS.md"), "utf8"), remote = g("show", "origin/main:ATTESTATIONS.md");
  const last = (s) => Math.max(...[...s.matchAll(/^## .*entry (\d+)/gim)].map((m) => +m[1]));
  let visibility = "unknown";
  try { visibility = execFileSync("gh", ["api", "repos/HarperZ9/prereg-ledger", "--jq", ".visibility"], { encoding: "utf8" }).trim(); } catch (e) { console.error("gh visibility read failed:", e.message); }
  return { lastEntry: last(local), lastPushedEntry: last(remote), firstUnpushed: last(remote) + 1, headings: count(local), pushedHeadings: count(remote),
    lastPushDate: g("log", "-1", "--format=%cI", "origin/main").trim().slice(0, 10), uncommitted: g("status", "--porcelain", "ATTESTATIONS.md").trim().startsWith("M"), visibility };
}

// Part 3: every interval the lab can re-derive, against the published digits.
function recompute(pub) {
  const D = j(join(OUT, "data", "dev_per_row.json")), H = j(join(OUT, "data", "heldout_context_per_row.json")), K = j(join(OUT, "data", "heldout_task_per_row.json"));
  const published = { K1: pub.ft5.K1, M1: pub.ft6.M1, N1: pub.ft7.N1, N3: pub.ft7.N3, N4: pub.ft7.N4 };
  const out = {};
  for (const c of DEV) {
    const bt = devBootstrap(difference(devSeries(D, c.a, c.measure), devSeries(D, c.b, c.measure))); bt.step(1e9);
    const r = bt.result(), p = published[c.key];
    out[c.key] = { ...r, published: [p.mean, p.lo, p.hi], equal: r.mean === p.mean && r.lo === p.lo && r.hi === p.hi };
  }
  const cl = (v, rank, p) => { const bt = clusterBootstrap(v, rank); bt.step(1e9); const r = bt.result(); return { ...r, published: p, equal: r.mean === p[0] && r.lo === p[1] && r.hi === p[2] }; };
  out.N5 = cl(difference(K.task.ft7_4b, K.task.ft3a_4b), K.group_rank, [pub.ft7.N5.mean, pub.ft7.N5.lo, pub.ft7.N5.hi]);
  const v = pub.vocab.ft7minusFt6, tri = (x) => [x.mean, x.lo, x.hi];
  out.vocabOriginal = cl(difference(H.context_original.ft7_4b, H.context_original.ft6_4b), H.group_rank, tri(v.original));
  out.vocabHarmonised = cl(difference(H.context_harmonised.ft7_4b, H.context_harmonised.ft6_4b), H.group_rank, tri(v.harmonised));
  out.vocabRows = H.n; out.vocabClusters = Math.max(...H.group_rank) + 1;
  return out;
}

const pubPath = join(OUT, "published.json");
let pub;
if (existsSync(MMBU)) {
  pub = readPublished();
  pub.records = readRecords();
  pub.records.ft4.likelySources = pub.records.ft4.newSources - pub.records.ft4.extraNamed;
  pub.ledger = existsSync(LEDGER) ? readLedger() : null;
  writeFileSync(pubPath, JSON.stringify(pub, null, 1) + "\n");
} else pub = j(pubPath);

const R = recompute(pub);
const F = { ...pub, recomputed: R, recomputedAll: Object.values(R).filter((x) => x && typeof x === "object").every((x) => x.equal),
  recomputedCount: Object.values(R).filter((x) => x && typeof x === "object").length };
if (!F.recomputedAll) console.error("NOT EQUAL:", Object.entries(R).filter(([, x]) => x && x.equal === false).map(([k]) => k).join(", "));
writeFileSync(join(OUT, "facts.json"), JSON.stringify(F, null, 1) + "\n");
console.log(`facts.json: ${F.recomputedCount} intervals recomputed, all equal to the published digits: ${F.recomputedAll}`);
