// SPDX-License-Identifier: FSL-1.1-MIT
// Writes the fixture sheet, its narration and its offline render to DIR, so
// scripts/sound_live_check.py can play the same sheet through the browser's
// AudioWorklet and reconcile the two.   node web/sound/smoke.mjs DIR
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as ss from "../../third_party/superstack/superstack.mjs";
import { Mix } from "./mix.mjs";
import { resolve } from "./offline.mjs";
import { interleaveS16 } from "./sheet.mjs";
import { speechLike, testSheet } from "./fixtures.mjs";

const dir = process.argv[2];
if (!dir) throw new Error("usage: smoke.mjs DIR");
const nar = speechLike(), { sheet } = resolve(testSheet(), nar);
const pcm = interleaveS16(new Mix(sheet, { narration: nar }).renderAll());
const narPcm = new Uint8Array(nar.length * 2), dv = new DataView(narPcm.buffer);
for (let i = 0; i < nar.length; i++) dv.setInt16(i * 2, Math.round(nar[i] * 32768), true);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "sheet.resolved.json"), JSON.stringify(sheet));
writeFileSync(join(dir, "mix.wav"), ss.wavS16(pcm, sheet.rate, 2));
writeFileSync(join(dir, "narration.wav"), ss.wavS16(narPcm, sheet.rate, 1));
console.log(dir, ss.sha256(pcm));
