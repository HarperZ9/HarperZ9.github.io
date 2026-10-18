// SPDX-License-Identifier: FSL-1.1-MIT
// A sound sheet from a Motion scene, so every release video gets its sound
// from the same timeline its picture moves on.
//
//   node web/sound/scene-sheet.mjs BUNDLE_DIR SCENE_REL OUT.json [--narration narration.wav]
//
// BUNDLE_DIR is a media bundle (tools/media): engine/, scene/, facts.json and,
// when narrated, timing.json. The scene loads in Node with no renderer
// (ctx.motion is null). Its cues come from an optional `sound(ctx)` method
// that returns [{ t, type, why, x?, ... }] in seconds; a scene without one gets
// a chapter cue at each chapter after the first. The score changes chord at
// each chapter. Every level is left to resolve() (offline.mjs).
import { readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { join, resolve as pathResolve } from "node:path";

const CHORDS = [[0, 7, 12, 17], [0, 7, 12, 15], [-4, 3, 8, 12], [3, 10, 15, 19], [-2, 5, 10, 14], [0, 7, 12, 16]];
const R = 48000, S = (t) => Math.max(0, Math.round(t * R));

export async function sceneSheet(bundleDir, sceneRel, { narration = null, seed = null } = {}) {
  const dir = pathResolve(bundleDir);
  register(new URL("./alias-hooks.mjs", import.meta.url), { data: { base: pathToFileURL(join(dir, "engine") + "/").href } });
  const sceneUrl = pathToFileURL(join(dir, sceneRel));
  const scene = (await import(sceneUrl.href)).default;
  const read = (p) => readFileSync(new URL(p, sceneUrl), "utf8");
  const ctx = {
    scene, motion: null, reduced: false, dt: 1 / (scene.fps || 30), time: 0, assets: null,
    params: Object.fromEntries((scene.params || []).map((p) => [p.id, p.value])),
    url: (p) => new URL(p, sceneUrl).href, json: async (p) => JSON.parse(read(p)), text: async (p) => read(p),
  };
  ctx.assets = scene.load ? await scene.load.call(scene, ctx) : {};
  // As long as the video: frames = ceil(duration x fps), as Motion's frameTimes counts them.
  const fps = scene.fps || 30, N = Math.ceil(scene.duration * fps - 1e-9) * Math.round(R / fps);
  const chapters = (scene.chapters || []).filter((c) => c.t > 0.5 && c.t < scene.duration);
  const raw = typeof scene.sound === "function" ? scene.sound(ctx) : chapters.map((c, k) => ({ t: c.t, type: "chapter", why: `section: ${c.title}`, pitch: [0, -2, 3, 5][k % 4] }));
  const cues = raw.filter((c) => c.t >= 0 && c.t < scene.duration).map(({ t, ...c }) => ({ at: S(t), x: 960, gain_db: -8, ...c }));
  const starts = [0, ...chapters.map((c) => c.t)];
  return {
    kind: "superstack.sound/1", seed: seed || `scene/${scene.title}`, rate: R, channels: 2, duration_samples: N,
    producer: "raw-native-sound/1", design: scene.design || [1920, 1080],
    about: `Sound for "${scene.title}", from the scene's own timeline. Creative media: no claim.`,
    narration: narration ? { src: "narration.wav", sha256: createHash("sha256").update(readFileSync(narration)).digest("hex") } : undefined,
    score: { root_hz: 73.416, sections: starts.map((t, k) => ({ at: S(t), chord: CHORDS[k % CHORDS.length] })), silences: [] },
    cues: cues.sort((a, b) => a.at - b.at),
    buses: { dialog: { gain_db: 0 }, music: { duck: {} }, sfx: {} },
    master: { class: "speech", eq: [{ type: "highpass", f: 30, q: 0.707 }], comp: {} },
  };
}

const isMain = process.argv[1] && pathResolve(process.argv[1]) === pathResolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isMain) {
  const [bundle, rel, out, ...rest] = process.argv.slice(2);
  if (!out) throw new Error("usage: scene-sheet.mjs BUNDLE_DIR SCENE_REL OUT.json [--narration WAV]");
  const k = rest.indexOf("--narration"), narration = k >= 0 ? rest[k + 1] : null;
  const sheet = await sceneSheet(bundle, rel, { narration });
  writeFileSync(out, JSON.stringify(sheet, null, 1));
  console.log(out, sheet.cues.length, "cues", (sheet.duration_samples / R).toFixed(2), "s");
}
