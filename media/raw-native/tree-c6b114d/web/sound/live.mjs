// SPDX-License-Identifier: FSL-1.1-MIT
// Live playback of a resolved sound sheet in the browser.
//
//   const snd = await createSound({ sheet, narrationUrl });   // loads, does not play
//   button.onclick = () => snd.play(t);   // sound starts only from a user gesture
//   snd.seek(t); snd.pause(); snd.time(); snd.close();
//
//   const [L, R] = await renderInBrowser({ sheet, narration, seconds });  // OfflineAudioContext check
//
// The sheet must be resolved (offline.mjs `resolve`, written by render.mjs as
// sheet.resolved.json): live playback does no measuring of its own, so it
// plays the levels the offline render was checked at. Narration WAVs are read
// with the engine's own parser rather than decodeAudioData, so both hosts get
// the same input values. Rules from superstack SPEC 8.5: no autoplay; the page
// gives every sound a label and a keyboard-reachable stop control.
import { readWav } from "./sheet.mjs";

const WORKLET = new URL("./worklet.mjs", import.meta.url).href;

export async function loadNarration(url) {
  if (!url) return new Float32Array(0);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const w = readWav(new Uint8Array(await r.arrayBuffer()));
  return w.channels[0];
}

function node(ctx, sheet, narration, start, playing) {
  return new AudioWorkletNode(ctx, "raw-sound", {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    processorOptions: { sheet, narration, start, playing },
  });
}

export async function createSound({ sheet, narrationUrl = null, narration = null }) {
  const nar = narration || (await loadNarration(narrationUrl));
  const ctx = new AudioContext({ sampleRate: sheet.rate, latencyHint: "playback" });
  await ctx.audioWorklet.addModule(WORKLET);
  const n = node(ctx, sheet, nar, 0, false);
  n.connect(ctx.destination);
  let at = 0;
  n.port.onmessage = (e) => { if (typeof e.data?.at === "number") at = e.data.at; };
  const S = (t) => Math.max(0, Math.round(t * sheet.rate));
  // Pause when the tab is hidden, unless the reader started playback (SPEC 8.5 rule 3 allows either).
  return {
    context: ctx, node: n,
    async play(t = null) { if (t !== null) n.port.postMessage({ seek: S(t) }); await ctx.resume(); n.port.postMessage({ playing: true }); },
    pause() { n.port.postMessage({ playing: false }); },
    seek(t) { n.port.postMessage({ seek: S(t) }); at = S(t); },
    time: () => at / sheet.rate,
    close: () => ctx.close(),
  };
}

// Render `seconds` from `start` through the worklet in an OfflineAudioContext:
// the browser check that live output matches the offline reference.
export async function renderInBrowser({ sheet, narration, seconds = sheet.duration_samples / sheet.rate, start = 0 }) {
  const frames = Math.round(seconds * sheet.rate);
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: frames, sampleRate: sheet.rate });
  await ctx.audioWorklet.addModule(WORKLET);
  node(ctx, sheet, narration, Math.round(start * sheet.rate), true).connect(ctx.destination);
  const buf = await ctx.startRendering();
  return [buf.getChannelData(0), buf.getChannelData(1)];
}
