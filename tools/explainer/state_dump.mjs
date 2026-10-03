// Print the live engine's frame states for one explainer, for the parity test.
//   node tools/explainer/state_dump.mjs media/explainers/<slug> '{"param": value}' t1 t2 ...
// Uses the receipt's narrated timeline when the folder has a receipt, as the page does.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { resolvedScenes, timeline, frameState } from "../../system/explainer/state.mjs";

const [folder, overrides = "{}", ...times] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(join(folder, "spec.json"), "utf8"));
const receiptPath = join(folder, "receipt.json");
const receipt = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, "utf8")) : null;
const scenes = resolvedScenes(spec, JSON.parse(overrides));
const rows = timeline(spec, receipt);
process.stdout.write(JSON.stringify(times.map((t) => frameState(scenes, rows, Number(t)))));
