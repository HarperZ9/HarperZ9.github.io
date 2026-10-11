// Film 1 ("Claiming got cheap. Checking did not.") sound sheet, built from the
// scene's own timeline. The film plays mix C: narration and these cues, with no
// score bed under the voice (see raw-native docs/sound/DESIGN.md, "Choices in use").
// Pass --with-score for mix B, which adds the ducked score bed. The scene is loaded read-only in Node; every cue time
// below is a cue the picture already moves on (A.T in film.scene.mjs, which are
// sentence starts in timing.json), so the sound cannot drift from the picture.
// x is the design-pixel position of the thing the cue marks (1920 wide).
//
//   node media/explainers/checking-cost/sound/film.sound.mjs media/explainers/checking-cost OUT.json NARRATION.wav [--with-score]
//   node <raw-native>/web/sound/render.mjs OUT.json --narration NARRATION.wav --timing media/explainers/checking-cost/timing.json --out DIR
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const args = process.argv.slice(2), withScore = args.includes("--with-score");
const [dir, out, narrationWav] = args.filter((a) => a !== "--with-score");
const base = pathToFileURL(dir.replace(/\/?$/, "/"));
const scene = (await import(new URL("film.scene.mjs", base).href)).default;
const ctx = { params: { hours: 6 }, reduced: false, motion: null, json: async (p) => JSON.parse(readFileSync(new URL(p, base), "utf8")) };
const A = await scene.load.call(scene, ctx);
const T = A.T, R = 48000, S = (t) => Math.round(t * R);
const N = Math.round(scene.duration * R);

const cues = [];
const cue = (t, type, why, o = {}) => cues.push({ at: S(t), type, why, x: 960, ...o });

// Segment 1: one reference.
cue(T.s1.morph, "move", "the title folds into one reference card", { dur: 0.8, gain_db: -12, f0: 400, f1: 1400 });
cue(T.s1.invented, "motif", "hot mark: the reference was made up", { gain_db: -6 });
cue(T.s1.pull, "scale", "the camera pulls back from one reference to all 636", { dur: T.s1.cardGone - T.s1.pull, gain_db: -11 });
// Segment 2: the study's references.
cue(T.s2.search, "texture", "the search passes every one of the 636 references: one texture, not 636 clicks",
  { n: 636, cap: 220, dur: 4.0, x: 420, x1: 1340, gain_db: -13 });
cue(T.s2.fab3, "motif", "hot mark: 55% of the GPT-3.5 references did not exist", { x: 560, gain_db: -6 });
cue(T.s2.fab4, "land", "18% for GPT-4 lands on its grid", { x: 1330, pitch: -3, gain_db: -5 });
cue(T.s2.wrong, "reveal", "a second kind of error appears: real references with wrong details", { x: 960, gain_db: -11 });
// Segment 3: a year of checking.
cue(T.s3.enter, "chapter", "section: a year of checking", { gain_db: -7 });
cue(T.s3.review, "count", "one review fills six hours, square by square", { from: 1, to: 6, per: 6, dur: 2.4, gain_db: -10 });
cue(T.s3.count, "count", "the count of reviews rolls up to 19,917,481 and lands", { from: 1, to: 19917481, per: 1000, dur: 1.0, gain_db: -8 });
cue(T.s3.years, "land", "about 15,000 years of work lands", { pitch: -5, gain_db: -4 });
// Segment 4: faster than the check.
cue(T.s4.enter, "chapter", "section: faster than the check", { pitch: -2, gain_db: -7 });
cue(T.s4.cascades, "texture", "126,000 cascades gather into one field", { n: 126000, cap: 200, dur: 2.6, front: true, gain_db: -14 });
cue(T.s4.race, "move", "false stories spread first, on the left", { x: 640, dur: 1.6, f0: 600, f1: 2400, gain_db: -13 });
// Segment 5: where the gap can close.
cue(T.s5.enter, "chapter", "section: where the gap can close", { pitch: 3, gain_db: -7 });
cue(T.s5.rerun, "move", "the rerun loop draws around the claim", { x: 380, dur: 0.9, f0: 700, f1: 1600, gain_db: -13 });
cue(T.s5.quick, "land", "two to four person hours lands on the time axis", { x: 1040, gain_db: -5 });
cue(T.s5.help, "move", "with the authors' help the range stretches to weeks", { x: 1040, x1: 1500, dur: 1.2, f0: 500, f1: 900, gain_db: -13 });
cue(T.s5.missed, "motif", "hot mark: 13 of 35 papers had a number nobody could reproduce", { x: 1300, gain_db: -6 });
// Segment 6: two things to keep.
cue(T.s6.enter, "chapter", "section: two things to keep", { gain_db: -7 });
cue(T.s6.one, "reveal", "the first thing to keep appears", { gain_db: -10 });
cue(T.s6.two, "reveal", "the second thing to keep appears", { pitch: 5, gain_db: -10 });

// The score: one chord per section, changing where the picture changes section.
const CH = [[0, 7, 12, 17], [0, 7, 12, 15], [-4, 3, 8, 12], [3, 10, 15, 19], [-2, 5, 10, 14], [0, 7, 12, 16]];
const starts = [0, T.s1.pull, T.s3.enter, T.s4.enter, T.s5.enter, T.s6.enter];

const sheet = {
  kind: "superstack.sound/1", seed: "checking-cost/sound-1", rate: R, channels: 2, duration_samples: N,
  producer: "raw-native-sound/1", design: [1920, 1080],
  about: `Film 1 sound, mix ${withScore ? "B" : "C"}. Cues are placed from the scene's timeline; each says what it marks. Creative media: no claim.`,
  narration: narrationWav ? { src: "narration.wav", sha256: createHash("sha256").update(readFileSync(narrationWav)).digest("hex") } : undefined,
  score: withScore ? { root_hz: 73.416, sections: starts.map((t, k) => ({ at: S(t), chord: CH[k] })), silences: [] } : undefined,
  cues: cues.sort((a, b) => a.at - b.at),
  buses: { dialog: { gain_db: 0 }, music: { duck: { lookahead_ms: 150, hold_ms: 350, attack_ms: 60, release_ms: 700 } }, sfx: {} },
  master: { class: "speech", eq: [{ type: "highpass", f: 30, q: 0.707 }], comp: { threshold_db: -20, ratio: 2, knee_db: 6, attack_ms: 10, release_ms: 200 } },
};
writeFileSync(out, JSON.stringify(sheet, null, 1));
console.log(out, cues.length, "cues", (N / R).toFixed(2), "s", withScore ? "mix B" : "mix C");
