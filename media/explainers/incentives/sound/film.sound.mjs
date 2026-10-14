// Film 4 ("Models do what training pays for") sound sheet, mix C: the narration
// and short cues placed from the scene's own timeline, with no score bed under the
// voice (see raw-native docs/sound/DESIGN.md, "Choices in use"). The scene is loaded
// read-only in Node; every cue time below is a time the picture already moves on
// (A.T in film.scene.mjs, which are sentence starts in timing.json, plus the same
// offsets the scene's draw code uses), so the sound cannot drift from the picture.
// x is the design-pixel position of the thing the cue marks (1920 wide).
//
//   node media/explainers/incentives/sound/film.sound.mjs media/explainers/incentives OUT.json NARRATION.wav
//   node <raw-native>/web/sound/render.mjs OUT.json --narration NARRATION.wav --timing media/explainers/incentives/timing.json --out DIR
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
const HOT = { hz: 440 };   // this film's motif: the same three notes, lower than film 1's

// Title and segment 1: paid for passing tests.
cue(0.0, "move", "the contour field of the reward landscape draws in", { dur: 3.6, f0: 200, f1: 800, gain_db: -15 });
cue(T.s1.setup + 0.5, "reveal", "the model appears as a point on the landscape", { x: 330, gain_db: -11 });
cue(T.s1.reward, "reveal", "the reward basin is labelled: unit tests pass", { x: 1120, pitch: 2, gain_db: -12 });
cue(T.s1.study + 1.5, "move", "two shortcut tunnels open toward the reward basin", { x: 640, x1: 1120, dur: 2.0, f0: 900, f1: 400, gain_db: -13 });
cue(T.s1.study + 5.0, "move", "the point travels the tunnel to the basin", { x: 330, x1: 1120, dur: T.s1.raise - 0.4 - T.s1.study - 5.0, f0: 500, f1: 1100, gain_db: -14 });
cue(T.s1.raise, "land", "reward: yes", { x: 1160, gain_db: -6 });
cue(T.s1.neither, "motif", "hot mark: task solved: no", { ...HOT, x: 1400, gain_db: -6 });
// Segment 2: paid for agreeing.
cue(T.s2.human, "chapter", "section: paid for agreeing", { gain_db: -7 });
cue(T.s2.human + 0.2, "move", "the landscape reshapes and a second basin opens: agrees with the user", { x: 1120, x1: 640, dur: 3.0, f0: 400, f1: 250, gain_db: -14 });
cue(T.s2.given + 1.0, "move", "the balance tilts toward the agreeing answer", { x: 1100, x1: 820, dur: 1.6, f0: 700, f1: 450, gain_db: -15 });
cue(T.s2.given + 2.0, "texture", "95 of 100 ticks light: one texture", { n: 95, cap: 95, dur: 3.0, x: 612, x1: 1270, gain_db: -15 });
cue(T.s2.given + 4.6, "motif", "hot mark: the agreeing answer preferred 95% of the time", { ...HOT, gain_db: -6 });
cue(T.s2.syco, "reveal", "the name appears: sycophancy", { gain_db: -11 });
// Segment 3: small rewards, wider habits.
cue(T.s3.enter, "chapter", "section: small rewards, wider habits", { pitch: -2, gain_db: -7 });
cue(T.s3.enter + 0.4, "texture", "five small environments appear, one by one", { n: 5, cap: 5, dur: 2.0, x: 200, x1: 960, hz: 1100, gain_db: -14 });
cue(T.s3.heldout, "reveal", "the held-out task opens a door to the code that computes its reward", { x: 1540, gain_db: -11 });
cue(T.s3.did - 0.4, "texture", "32,768 episodes appear as points", { n: 32768, cap: 220, dur: 1.6, x: 170, x1: 680, gain_db: -15 });
cue(T.s3.did + 1.0, "motif", "hot mark: 45 of the 32,768 episodes light", { ...HOT, x: 425, gain_db: -6 });
cue(T.s3.did + 2.6, "scale", "the camera dives to find the 45", { x: 425, dur: 1.2, f0: 700, f1: 200, gain_db: -13 });
cue(T.s3.helpful, "texture", "100,000 helpful-only episodes appear beside them", { n: 100000, cap: 220, dur: 1.4, x: 950, x1: 1750, gain_db: -15 });
cue(T.s3.helpful + 1.0, "land", "0 of 100,000 lands", { x: 1350, pitch: -5, gain_db: -8 });
cue(T.s3.direction, "reveal", "the finding: rewarded gaming spread to gaming never rewarded", { gain_db: -10 });
// Segment 4: change what gets paid, and the close.
cue(T.s4.none, "chapter", "section: change what gets paid", { pitch: 3, gain_db: -7 });
cue(T.s4.fix, "move", "the landscape reshapes and the tunnels close", { x: 900, x1: 1500, dur: 3.2, f0: 300, f1: 700, gain_db: -14 });
cue(T.s4.fix + 2.6, "land", "a check rings the basin that solves the task", { x: 1620, pitch: 7, gain_db: -5 });
cue(T.s5.close, "chapter", "section: ask what the training paid for", { gain_db: -7 });

const sheet = {
  kind: "superstack.sound/1", seed: "incentives/sound-1", rate: R, channels: 2, duration_samples: N,
  producer: "raw-native-sound/1", design: [1920, 1080],
  about: "Film 4 sound, mix C. Cues are placed from the scene's timeline; each says what it marks. Creative media: no claim.",
  narration: narrationWav ? { src: "narration.wav", sha256: createHash("sha256").update(readFileSync(narrationWav)).digest("hex") } : undefined,
  cues: cues.sort((a, b) => a.at - b.at),
  buses: { dialog: { gain_db: 0 }, music: { duck: { lookahead_ms: 150, hold_ms: 350, attack_ms: 60, release_ms: 700 } }, sfx: {} },
  master: { class: "speech", eq: [{ type: "highpass", f: 30, q: 0.707 }], comp: { threshold_db: -20, ratio: 2, knee_db: 6, attack_ms: 10, release_ms: 200 } },
};
writeFileSync(out, JSON.stringify(sheet, null, 1));
console.log(out, cues.length, "cues", (N / R).toFixed(2), "s", "mix C");
