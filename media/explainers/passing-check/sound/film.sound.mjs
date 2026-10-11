// Film 2 ("A passing check can still be wrong") sound sheet, mix C: the narration
// and short cues placed from the scene's own timeline, with no score bed under the
// voice (see raw-native docs/sound/DESIGN.md, "Choices in use"). The scene is loaded
// read-only in Node; every cue time below is a time the picture already moves on
// (A.T in film.scene.mjs, which are sentence starts in timing.json, plus the same
// offsets the scene's draw code uses), so the sound cannot drift from the picture.
// x is the design-pixel position of the thing the cue marks (1920 wide).
//
//   node media/explainers/passing-check/sound/film.sound.mjs media/explainers/passing-check OUT.json NARRATION.wav
//   node <raw-native>/web/sound/render.mjs OUT.json --narration NARRATION.wav --timing media/explainers/passing-check/timing.json --out DIR
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const [dir, out, narrationWav] = process.argv.slice(2);
const base = pathToFileURL(dir.replace(/\/?$/, "/"));
const scene = (await import(new URL("film.scene.mjs", base).href)).default;
const params = Object.fromEntries((scene.params || []).map((p) => [p.id, p.value]));
const ctx = { params, reduced: false, motion: null, json: async (p) => JSON.parse(readFileSync(new URL(p, base), "utf8")) };
const A = await scene.load.call(scene, ctx);
const T = A.T, R = 48000, S = (t) => Math.round(t * R);
const N = Math.round(scene.duration * R);

const cues = [];
const cue = (t, type, why, o = {}) => cues.push({ at: S(t), type, why, x: 960, ...o });
const HOT = { hz: 587.33 };   // this film's motif: the same three notes, a tone above film 1's

// Title and segment 1: every test passes.
cue(0.0, "move", "the code lines fly in to the aperture around the title", { dur: 2.4, f0: 300, f1: 1100, gain_db: -15 });
cue(T.p1.enter, "move", "the lines lay themselves out as a program", { x: 940, dur: 1.5, f0: 900, f1: 500, gain_db: -14 });
for (let k = 0; k < 3; k++) cue(T.p1.passes + k * 0.6 + 0.9, "land", `test ${k + 1} lands "pass"`, { x: 1660, pitch: 2 * k, gain_db: -11 });
cue(T.p1.never + 0.6, "motif", "hot mark: the crack opens in the line no test runs", { ...HOT, gain_db: -6 });
cue(T.p1.found + 0.3, "reveal", "a pass: the check found nothing", { gain_db: -11 });
cue(T.p1.could + 0.2, "reveal", "not: the check could have found it", { pitch: -3, gain_db: -11 });
// Segment 2: lines run are not faults found.
cue(T.p2.enter, "chapter", "section: lines run are not faults found", { gain_db: -7 });
cue(T.p2.study, "scale", "the camera pulls back from one program to five", { dur: 3.2, gain_db: -12 });
cue(T.p2.study + 3.0, "texture", "the programs dissolve into 31,000 points: one texture, not 31,000 clicks",
  { n: 31000, cap: 220, dur: 3.5, x: 420, x1: 1500, gain_db: -14 });
cue(T.p2.size + 1.0, "land", "the gauge settles on low to moderate", { pitch: -2, gain_db: -6 });
cue(T.p2.zero, "motif", "hot mark: Joda Time, essentially zero", { ...HOT, x: 560, gain_db: -6 });
cue(T.p2.advice, "reveal", "their advice appears: not a quality target", { gain_db: -10 });
// Segment 3: check the check.
cue(T.p3.enter, "chapter", "section: check the check", { pitch: -2, gain_db: -7 });
cue(T.p3.enter + 1.4, "texture", "six mutants crack into the program, one by one", { n: 6, cap: 6, dur: 2.7, x: 940, hz: 1100, gain_db: -15 });
cue(T.p3.just + 1.0, "texture", "357 real bugs appear as dots", { n: 357, cap: 200, dur: 2.0, x: 1300, gain_db: -14 });
cue(T.p3.coupled, "reveal", "73% gain a ring: coupled to a mutant", { x: 1300, gain_db: -11 });
cue(T.p3.none, "motif", "hot mark: 17% coupled to none", { ...HOT, x: 1300, gain_db: -6 });
// Segment 4: when AI writes the patch.
cue(T.p4.enter, "chapter", "section: when AI writes the patch", { pitch: 3, gain_db: -7 });
cue(T.p4.study, "move", "the bars of patches counted solved draw out", { x: 460, x1: 1460, dur: 1.4, f0: 500, f1: 1200, gain_db: -13 });
cue(T.p4.shares + 0.6, "motif", "hot mark: 7.8% failed the developers' own tests and peel away", { ...HOT, x: 1420, gain_db: -6 });
cue(T.p4.shares + 3.6, "move", "29.6% behaved unlike the real fix and peel away", { x: 1250, x1: 1290, dur: 1.4, f0: 800, f1: 500, gain_db: -13 });
cue(T.p4.earlier + 0.6, "texture", "251 passing patches appear as dots", { n: 251, cap: 200, dur: 1.8, x: 700, x1: 1220, gain_db: -14 });
cue(T.p4.third, "reveal", "about a third turn into cards: the fix was in the task text", { gain_db: -11 });
cue(T.p4.third + 2.6, "reveal", "about another third gain rings: weak tests", { pitch: -3, gain_db: -11 });
// Segment 5: a check that can show it can fail, and the close.
cue(T.p5.enter, "chapter", "section: a check that can show it can fail", { pitch: 5, gain_db: -7 });
cue(T.p5.enter + 0.8, "move", "the same known-wrong input travels to both checks", { x: 310, x1: 1190, dur: T.p5.passes - T.p5.enter - 0.2, f0: 400, f1: 900, gain_db: -15 });
cue(T.p5.passes, "motif", "hot mark: check A lets the wrong input through", { ...HOT, x: 640, gain_db: -6 });
cue(T.p5.evidence, "land", "check B fails, as it should: the film's one verified mark", { x: 1280, pitch: 7, gain_db: -4 });
cue(T.p5.close, "chapter", "section: the aperture returns, the untested line now lit", { gain_db: -7 });

const sheet = {
  kind: "superstack.sound/1", seed: "passing-check/sound-1", rate: R, channels: 2, duration_samples: N,
  producer: "raw-native-sound/1", design: [1920, 1080],
  about: "Film 2 sound, mix C. Cues are placed from the scene's timeline; each says what it marks. Creative media: no claim.",
  narration: narrationWav ? { src: "narration.wav", sha256: createHash("sha256").update(readFileSync(narrationWav)).digest("hex") } : undefined,
  cues: cues.sort((a, b) => a.at - b.at),
  buses: { dialog: { gain_db: 0 }, music: { duck: { lookahead_ms: 150, hold_ms: 350, attack_ms: 60, release_ms: 700 } }, sfx: {} },
  master: { class: "speech", eq: [{ type: "highpass", f: 30, q: 0.707 }], comp: { threshold_db: -20, ratio: 2, knee_db: 6, attack_ms: 10, release_ms: 200 } },
};
writeFileSync(out, JSON.stringify(sheet, null, 1));
console.log(out, cues.length, "cues", (N / R).toFixed(2), "s", "mix C");
