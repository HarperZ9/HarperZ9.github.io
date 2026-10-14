// Film 3 ("Re-derive it. Don't take it on trust.") sound sheet, mix C: the narration
// and short cues placed from the scene's own timeline, with no score bed under the
// voice (see raw-native docs/sound/DESIGN.md, "Choices in use"). The scene is loaded
// read-only in Node; every cue time below is a time the picture already moves on
// (A.T in film.scene.mjs, which are sentence starts in timing.json, plus the same
// offsets the scene's draw code uses), so the sound cannot drift from the picture.
// x is the design-pixel position of the thing the cue marks (1920 wide).
//
//   node media/explainers/rederive/sound/film.sound.mjs media/explainers/rederive OUT.json NARRATION.wav
//   node <raw-native>/web/sound/render.mjs OUT.json --narration NARRATION.wav --timing media/explainers/rederive/timing.json --out DIR
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
const HOT = { hz: 493.88 };   // this film's motif: the same three notes, a semitone under film 1's

// Title and segment 1: a result on the page.
cue(1.6, "move", "the cyan negative of the title slides in off register", { x: 990, dur: 2.0, f0: 500, f1: 900, gain_db: -15 });
cue(3.6, "land", "the negative locks into register", { pitch: -5, gain_db: -11 });
cue(T.s1.enter + 0.6, "reveal", "the paper's one effect appears", { x: 530, gain_db: -11 });
cue(T.s1.either, "reveal", "the two choices appear: trust it, or run it again", { x: 1300, pitch: 2, gain_db: -11 });
cue(T.s1.cheap, "land", "the trust stamp comes down", { x: 1520, pitch: -7, gain_db: -8 });
cue(T.s1.slow, "move", "a negative of the paper exposes over two seconds", { x: 1530, dur: 2.0, f0: 300, f1: 700, gain_db: -14 });
// Segment 2: a hundred studies, run again.
cue(T.s2.enter, "chapter", "section: a hundred studies, run again", { gain_db: -7 });
cue(T.s2.enter + 0.6, "texture", "100 cards appear, one per study", { n: 100, cap: 100, dur: 2.0, x: 560, x1: 1360, gain_db: -14 });
cue(T.s2.ninety7, "texture", "97 originals gain a positive mark", { n: 97, cap: 97, dur: 1.6, hz: 1800, x: 560, x1: 1360, gain_db: -15 });
cue(T.s2.came, "motif", "hot mark: the repeat exposes, and 62 of the 97 fade with a drift edge", { ...HOT, gain_db: -6 });
cue(T.s2.half, "land", "the repeated effects land at about half the originals", { x: 860, pitch: -3, gain_db: -6 });
// Segment 3: asking for the data.
cue(T.s3.enter, "chapter", "section: asking for the data", { pitch: -2, gain_db: -7 });
cue(T.s3.stodden + 2.0, "move", "an envelope leaves every one of the 204 papers", { x: 433, x1: 1300, dur: 3.0, f0: 600, f1: 1500, gain_db: -14 });
cue(T.s3.got, "move", "envelopes come back for 44% of the papers", { x: 1300, x1: 433, dur: 2.2, f0: 1500, f1: 600, gain_db: -14 });
cue(T.s3.got + 2.2, "land", "materials obtained: 44% lands", { x: 433, gain_db: -6 });
cue(T.s3.got + 3.0, "reveal", "a negative exposes over about 26%, tagged as an estimate", { x: 600, pitch: -3, gain_db: -10 });
// Segment 4: a check that anyone can run.
cue(T.s4.enter, "chapter", "section: a check that anyone can run", { pitch: 3, gain_db: -7 });
cue(T.s4.enter + 0.6, "scale", "the camera pulls back from one certificate to the whole field", { dur: T.s4.checks + 1.4 - T.s4.enter, gain_db: -12 });
cue(T.s4.enter + 1.5, "texture", "the field of points standing for 240 million certificates gathers: one texture",
  { n: 262144, cap: 220, dur: T.s4.checks - T.s4.enter - 0.5, front: true, x: 300, x1: 1620, gain_db: -15 });
cue(T.s4.y2012, "motif", "hot mark: in 2012 more than 12% of the field lights with errors", { ...HOT, gain_db: -6 });
cue(T.s4.y2017 + 0.4, "land", "2017: the lit share falls to 0.02%", { pitch: 5, gain_db: -8 });
cue(T.s4.y2017 + 0.8, "scale", "the camera dives to find the few lit points", { dur: 1.6, f0: 700, f1: 200, gain_db: -13 });
// The close.
cue(T.s5.close, "chapter", "section: the first page returns", { gain_db: -7 });
cue(T.s5.close + 2.6, "land", "a negative registers over the page and locks", { x: 580, pitch: -5, gain_db: -10 });

const sheet = {
  kind: "superstack.sound/1", seed: "rederive/sound-1", rate: R, channels: 2, duration_samples: N,
  producer: "raw-native-sound/1", design: [1920, 1080],
  about: "Film 3 sound, mix C. Cues are placed from the scene's timeline; each says what it marks. Creative media: no claim.",
  narration: narrationWav ? { src: "narration.wav", sha256: createHash("sha256").update(readFileSync(narrationWav)).digest("hex") } : undefined,
  cues: cues.sort((a, b) => a.at - b.at),
  buses: { dialog: { gain_db: 0 }, music: { duck: { lookahead_ms: 150, hold_ms: 350, attack_ms: 60, release_ms: 700 } }, sfx: {} },
  master: { class: "speech", eq: [{ type: "highpass", f: 30, q: 0.707 }], comp: { threshold_db: -20, ratio: 2, knee_db: 6, attack_ms: 10, release_ms: 200 } },
};
writeFileSync(out, JSON.stringify(sheet, null, 1));
console.log(out, cues.length, "cues", (N / R).toFixed(2), "s", "mix C");
