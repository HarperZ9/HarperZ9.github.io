// Film 5 ("What a model's written reasoning can and cannot show") sound sheet, mix C: the narration
// and short cues placed from the scene's own timeline, with no score bed under the
// voice (see raw-native docs/sound/DESIGN.md, "Choices in use"). The scene is loaded
// read-only in Node; every cue time below is a time the picture already moves on
// (A.T in film.scene.mjs, which are sentence starts in timing.json, plus the same
// offsets the scene's draw code uses), so the sound cannot drift from the picture.
// x is the design-pixel position of the thing the cue marks (1920 wide).
//
//   node media/explainers/visible-reasoning/sound/film.sound.mjs media/explainers/visible-reasoning OUT.json NARRATION.wav
//   node <raw-native>/web/sound/render.mjs OUT.json --narration NARRATION.wav --timing media/explainers/visible-reasoning/timing.json --out DIR
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
const HOT = { hz: 554.37 };   // this film's motif: the same three notes, a semitone over film 1's

// Title and segment 1: a hint it does not mention.
cue(0.3, "move", "the title's glyphs flow out of the eye's pupil as the first ribbon", { dur: 3.3, f0: 300, f1: 1000, gain_db: -15 });
cue(T.s1.ask, "reveal", "a multiple-choice question appears, options A to D", { x: 450, gain_db: -11 });
cue(T.s1.hintAt + 1.0, "move", "a thread runs from the added line to answer A", { x: 600, x1: 295, dur: 1.6, f0: 900, f1: 500, gain_db: -13 });
cue(T.s1.argued, "move", "the reasoning ribbon flows and argues for A, never touching the thread", { x: 200, x1: 1700, dur: 4.0, f0: 400, f1: 900, gain_db: -15 });
cue(T.s1.fell, "land", "accuracy down by as much as 36%, worst case", { pitch: -3, gain_db: -5 });
cue(T.s1.cause, "motif", "hot mark: the hint's thread pulses: not the whole cause", { ...HOT, x: 400, gain_db: -6 });
// Segment 2: how often the hint is named.
cue(T.s2.enter, "chapter", "section: how often the hint is named", { gain_db: -7 });
cue(T.s2.kinds + 1.0, "texture", "25 of 100 segments dip to name the hint", { n: 25, cap: 25, dur: 2.0, x: 300, x1: 1620, gain_db: -14 });
cue(T.s2.kinds + 2.6, "texture", "39 of 100 segments dip to name the hint", { n: 39, cap: 39, dur: 2.0, hz: 1200, x: 300, x1: 1620, gain_db: -14 });
cue(T.s2.shortcut, "motif", "hot mark: the planted shortcut taken on over 99% of prompts", { ...HOT, x: 1600, gain_db: -6 });
// Segment 3: still worth reading.
cue(T.s3.enter, "chapter", "section: still worth reading", { pitch: -2, gain_db: -7 });
cue(T.s3.actions, "land", "the monitor that reads the actions catches 60%", { x: 640, pitch: -3, gain_db: -7 });
cue(T.s3.both, "land", "the monitor that also reads the reasoning catches 95%", { x: 1280, pitch: 2, gain_db: -6 });
cue(T.s3.penalty, "move", "the penalty: the ribbon reads clean and the catch drains away", { x: 1280, dur: 2.4, f0: 900, f1: 300, gain_db: -13 });
cue(T.s3.continued, "motif", "hot mark: the tricks continued; the catch falls to near zero", { ...HOT, x: 1280, gain_db: -6 });
// Segment 4: useful, and fragile.
cue(T.s4.enter, "chapter", "section: useful, and fragile", { pitch: 3, gain_db: -7 });
cue(T.s4.enter + 1.5, "reveal", "the glass ribbon cracks at one edge", { pitch: -5, gain_db: -12 });
cue(T.s4.readout, "reveal", "written reasoning is a readout", { gain_db: -10 });
// The close.
cue(T.s5.close, "chapter", "section: the eye returns", { gain_db: -7 });
cue(T.s5.close + 0.6, "move", "the reasoning ribbon and the thread flow again", { x: 300, x1: 1600, dur: 3.4, f0: 400, f1: 800, gain_db: -15 });

const sheet = {
  kind: "superstack.sound/1", seed: "visible-reasoning/sound-1", rate: R, channels: 2, duration_samples: N,
  producer: "raw-native-sound/1", design: [1920, 1080],
  about: "Film 5 sound, mix C. Cues are placed from the scene's timeline; each says what it marks. Creative media: no claim.",
  narration: narrationWav ? { src: "narration.wav", sha256: createHash("sha256").update(readFileSync(narrationWav)).digest("hex") } : undefined,
  cues: cues.sort((a, b) => a.at - b.at),
  buses: { dialog: { gain_db: 0 }, music: { duck: { lookahead_ms: 150, hold_ms: 350, attack_ms: 60, release_ms: 700 } }, sfx: {} },
  master: { class: "speech", eq: [{ type: "highpass", f: 30, q: 0.707 }], comp: { threshold_db: -20, ratio: 2, knee_db: 6, attack_ms: 10, release_ms: 200 } },
};
writeFileSync(out, JSON.stringify(sheet, null, 1));
console.log(out, cues.length, "cues", (N / R).toFixed(2), "s", "mix C");
