#!/usr/bin/env node
// Encode the heavy media from the mission-control workspace for the web, into media/world/.
//
//   node scripts/import-media.mjs [--src WORKSHOP]   (or MISSION_CONTROL=WORKSHOP) [--force]
//
// Name-art finals: 1920 and 960 px WebP and AVIF from the 1920 master. Loops: the WebM (AV1) as delivered,
// an H.264 MP4 re-encoded at 1280 px for Safari, and a WebP poster. The theme: Hum v4 and its calm loop as the
// sound folder's own Opus streams, plus AAC in MP4 for browsers without Opus. Each output is skipped when it is
// newer than its source, so a re-run only redoes what changed; --force redoes everything.
// ffmpeg comes from $FFMPEG, or from the imageio-ffmpeg package, or from PATH.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SRC = path.resolve(arg("--src", null) ?? process.env.MISSION_CONTROL ?? (console.error("set MISSION_CONTROL to the workshop folder, or pass --src"), process.exit(2)));
const OUT = path.join(site, "media", "world");
const FORCE = process.argv.includes("--force");

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  for (const py of ["py", "python"]) {
    try { return execFileSync(py, ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { /* try the next */ }
  }
  return "ffmpeg";
}
const FF = ffmpegPath();
const fresh = (src, dst) => !FORCE && existsSync(dst) && statSync(dst).mtimeMs >= statSync(src).mtimeMs;
function ff(src, dst, args) {
  if (!existsSync(src)) { console.warn(`media: missing ${src}`); return null; }
  mkdirSync(path.dirname(dst), { recursive: true });
  if (!fresh(src, dst)) execFileSync(FF, ["-hide_banner", "-loglevel", "error", "-y", "-i", src, ...args, dst]);
  return dst;
}
function copy(src, dst) {
  if (!existsSync(src)) { console.warn(`media: missing ${src}`); return null; }
  mkdirSync(path.dirname(dst), { recursive: true });
  if (!fresh(src, dst)) copyFileSync(src, dst);
  return dst;
}

const NAME_ART = ["intaglio-lines", "glass-tubes", "deco-arc", "pearls", "mosaic-smalti", "monogram-orb"];
const LOOPS = ["glass-tubes", "deco-arc", "pearls", "mosaic-smalti", "monogram-orb"];

function nameArt(made) {
  const dir = path.join(SRC, "2026-10-24-name-art/out");
  for (const n of NAME_ART) {
    const still = path.join(dir, "finals", `${n}-1920.png`);
    for (const w of [1920, 960]) {
      made.push(ff(still, path.join(OUT, "name-art", `${n}-${w}.webp`), ["-vf", `scale=${w}:-2:flags=lanczos`, "-c:v", "libwebp", "-quality", "86"]));
      made.push(ff(still, path.join(OUT, "name-art", `${n}-${w}.avif`), ["-vf", `scale=${w}:-2:flags=lanczos`, "-c:v", "libaom-av1", "-still-picture", "1", "-crf", "28", "-cpu-used", "6"]));
    }
  }
  for (const n of LOOPS) {
    made.push(copy(path.join(dir, "loops", `${n}.webm`), path.join(OUT, "name-art", `${n}.webm`)));
    made.push(ff(path.join(dir, "loops", `${n}.mp4`), path.join(OUT, "name-art", `${n}.mp4`), ["-vf", "scale=1280:-2:flags=lanczos", "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"]));
    made.push(ff(path.join(dir, "loops", `${n}-poster.png`), path.join(OUT, "name-art", `${n}-poster.webp`), ["-vf", "scale=1280:-2:flags=lanczos", "-c:v", "libwebp", "-quality", "82"]));
    // phones: a 640 px loop and poster, so the first screen does not wait on the 1080p file
    made.push(ff(path.join(dir, "loops", `${n}.webm`), path.join(OUT, "name-art", `${n}-640.webm`), ["-vf", "scale=640:-2:flags=lanczos", "-c:v", "libaom-av1", "-crf", "40", "-b:v", "0", "-cpu-used", "6", "-row-mt", "1", "-an"]));
    made.push(ff(path.join(dir, "loops", `${n}.mp4`), path.join(OUT, "name-art", `${n}-640.mp4`), ["-vf", "scale=640:-2:flags=lanczos", "-c:v", "libx264", "-crf", "28", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"]));
    made.push(ff(path.join(dir, "loops", `${n}-poster.png`), path.join(OUT, "name-art", `${n}-poster-640.webp`), ["-vf", "scale=640:-2:flags=lanczos", "-c:v", "libwebp", "-quality", "80"]));
  }
}

function theme(made) {
  const s = path.join(SRC, "2026-10-23-sound");
  for (const v of ["theme", "calm"]) {
    made.push(copy(path.join(s, "theme/assets", `hum4-${v}.opus`), path.join(OUT, "sound", `hum4-${v}.opus`)));
    made.push(copy(path.join(s, "theme/assets", `hum4-${v}-hits.json`), path.join(OUT, "sound", `hum4-${v}-hits.json`)));
    made.push(ff(path.join(s, "renders/v4", `hum4-${v}-48k-24bit.wav`), path.join(OUT, "sound", `hum4-${v}.m4a`), ["-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"]));
  }
}

function library(made) {
  made.push(ff(path.join(SRC, "2026-10-25-reference-library/concept-layers.png"), path.join(OUT, "library", "concept-layers.webp"), ["-c:v", "libwebp", "-lossless", "1"]));
}

const made = [];
nameArt(made); theme(made); library(made);
const list = made.filter(Boolean).map((p) => ({ path: path.relative(site, p).split(path.sep).join("/"), bytes: statSync(p).size }));
writeFileSync(path.join(OUT, "MEDIA.json"), JSON.stringify({ encodedAt: new Date().toISOString(), files: list }, null, 1) + "\n");
console.log(`media: ${list.length} files, ${(list.reduce((a, f) => a + f.bytes, 0) / 1e6).toFixed(1)} MB in media/world`);
