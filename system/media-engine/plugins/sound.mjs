// system/media-engine/plugins/sound.mjs
// The sound plugin family: sound-seed, sound-music, sound-scan and sound-figure. Each mounts like
// any engine plugin and draws a still of its reference waveform (static: drawn on mount, resize
// or a parameter change). Its sound lives on the instance:
//
//   instance.reference()     the offline float64 render, quantized once: { scene, pcm, loudness }
//   instance.receipt()       superstack.receipt/1 for the reference PCM
//   instance.reconcileLive() the live WebAudio graph rendered offline and held against the reference
//   instance.play(ctx, opts) play the reference's samples on a live context (from a user gesture)
//   instance.wav()           the WAV export, the reference's own bytes
//
// params by id:
//   sound-seed    { seed }                 the Seed sound
//   sound-music   {}                       the Music source's built-in chord
//   sound-scan    { scan, freqs, seconds } a picture or woven cloth played as notes
//   sound-figure  { points, hz }           the Retro audio scope's drawn figure

import { seedScene, musicScene, scanScene, figureScene, renderReference, soundReceipt, reconcileLive, playReference, wavOf } from "../sound.mjs";

const SCENES = {
  "sound-seed": (p, seed) => seedScene(p.seed ?? seed ?? "aurora"),
  "sound-music": () => musicScene(),
  "sound-scan": (p) => scanScene(p.scan, p.freqs, p.seconds, { label: p.label || "scan" }),
  "sound-figure": (p) => figureScene(p.points, p.hz),
};

function drawWave(canvas, ref) {
  const ctx = canvas.getContext && canvas.getContext("2d");
  if (!ctx || !canvas.width || !canvas.height) return;
  const W = canvas.width, H = canvas.height, s = ref.scene;
  const dv = new DataView(ref.pcm.buffer, ref.pcm.byteOffset, ref.pcm.byteLength), frames = ref.pcm.byteLength / 2 / s.channels;
  ctx.fillStyle = "#060608"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ebe5d8";
  for (let c = 0; c < s.channels; c++) {
    const mid = (H / s.channels) * (c + 0.5), half = (H / s.channels) * 0.45;
    for (let x = 0; x < W; x++) {
      const a = Math.floor((x / W) * frames), b = Math.max(a + 1, Math.floor(((x + 1) / W) * frames));
      let lo = 0, hi = 0;
      for (let i = a; i < b; i++) { const v = dv.getInt16(2 * (i * s.channels + c), true) / 32767; if (v < lo) lo = v; if (v > hi) hi = v; }
      ctx.fillRect(x, mid - hi * half, 1, Math.max(1, (hi - lo) * half));
    }
  }
}

function family(id) {
  return {
    id, version: "1.0.0", backends: ["canvas2d"], sceneKind: "sound",
    create({ canvas, params, seed }) {
      let p = { ...params }, ref = null, drawn = null;
      const reference = () => (ref ||= renderReference(SCENES[id](p, seed)));
      return {
        backend: "canvas2d", static: true,
        frame() { const r = reference(); const key = r.pcm.length + ":" + canvas.width + "x" + canvas.height; if (drawn !== key) { drawWave(canvas, r); drawn = key; } },
        setParams(next) { p = { ...p, ...next }; ref = null; drawn = null; },
        reference,
        receipt: () => soundReceipt(reference()),
        reconcileLive: () => reconcileLive(reference()),
        play: (ctx, opts) => playReference(ctx, reference(), opts),
        wav: () => wavOf(reference()),
        readPixels() { const c = canvas.getContext("2d"); return new Uint8Array(c.getImageData(0, 0, canvas.width, canvas.height).data.buffer); },
        dispose() {},
      };
    },
  };
}

export const soundSeed = family("sound-seed");
export const soundMusic = family("sound-music");
export const soundScan = family("sound-scan");
export const soundFigure = family("sound-figure");
export const SOUND_PLUGINS = Object.freeze([soundSeed, soundMusic, soundScan, soundFigure]);
