// SPDX-License-Identifier: FSL-1.1-MIT
// Offline render of a sound sheet.
//
//   node web/sound/render.mjs SHEET.json --narration narration.wav --out DIR [--timing timing.json] [--no-resolve]
//
// Writes to DIR: mix.wav (s16le stereo 48 kHz), sheet.resolved.json (every
// level explicit; the live player plays this file), report.json (loudness,
// loudness range, true peak, music under speech, effects under the voice) and
// receipt.json (superstack.receipt/1). --timing takes the narration's timing
// rows ({start, end} seconds) so the report can measure the music under speech.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve as pathResolve, dirname } from "node:path";
import * as ss from "../../third_party/superstack/superstack.mjs";
import { Mix } from "./mix.mjs";
import { readWav, validateSheet } from "./sheet.mjs";
import { resolve, report, receipt } from "./offline.mjs";

function args(argv) {
  const a = { sheet: null, narration: null, out: null, timing: null, resolve: true };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--narration") a.narration = argv[++i];
    else if (k === "--out") a.out = argv[++i];
    else if (k === "--timing") a.timing = argv[++i];
    else if (k === "--no-resolve") a.resolve = false;
    else a.sheet = k;
  }
  if (!a.sheet || !a.out) throw new Error("usage: render.mjs SHEET.json --narration WAV --out DIR [--timing JSON] [--no-resolve]");
  return a;
}

export function loadNarration(path, sheet) {
  if (!path) return new Float32Array(0);
  const bytes = readFileSync(path);
  if (sheet.narration?.sha256 && ss.sha256(bytes) !== sheet.narration.sha256) throw new Error("narration: bytes differ from sheet.narration.sha256");
  const w = readWav(bytes);
  if (w.rate !== sheet.rate) throw new Error(`narration: ${w.rate} Hz, the sheet is ${sheet.rate} Hz`);
  if (w.channels.length !== 1) throw new Error("narration: mono expected");
  return w.channels[0];
}

export function main(argv) {
  const a = args(argv);
  let sheet = JSON.parse(readFileSync(a.sheet, "utf8"));
  const errs = validateSheet(sheet);
  if (errs.length) throw new Error("sheet refused: " + errs.join(", "));
  const nar = loadNarration(a.narration && pathResolve(a.narration), sheet);
  const t0 = Date.now();
  let narrLufs = null;
  if (a.resolve) ({ sheet, narration_lufs: narrLufs } = resolve(sheet, nar));
  const mix = new Mix(sheet, { narration: nar }).renderAll();
  const spans = a.timing ? JSON.parse(readFileSync(a.timing, "utf8")).map((r) => [Math.round(r.start * sheet.rate), Math.round(r.end * sheet.rate)]) : [];
  const rep = { ...report(sheet, nar, mix, spans), narration_lufs: narrLufs, render_seconds: (Date.now() - t0) / 1000 };
  const { rec, pcm, errors } = receipt(sheet, mix, rep);
  if (errors.length) throw new Error("receipt invalid: " + errors.join(","));
  mkdirSync(a.out, { recursive: true });
  writeFileSync(join(a.out, "mix.wav"), ss.wavS16(pcm, sheet.rate, 2));
  writeFileSync(join(a.out, "sheet.resolved.json"), JSON.stringify(sheet, null, 1));
  writeFileSync(join(a.out, "report.json"), JSON.stringify(rep, null, 1));
  writeFileSync(join(a.out, "receipt.json"), ss.canonical(rec));
  console.log(JSON.stringify({ pcm_sha256: rec.content_sha256, ...rep }, null, 1));
  return rec;
}

const isMain = process.argv[1] && pathResolve(process.argv[1]) === pathResolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "render.mjs");
if (isMain) main(process.argv.slice(2));
