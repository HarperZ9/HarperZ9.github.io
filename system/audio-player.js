// audio-player.js: the browser side of the seed-authored sound instrument.
// Mounts a small "sound desk" - name a seed, hear the piece it synthesizes,
// read its key and tempo, and save it as a real .wav. All in the browser; the
// PCM comes from audio.js, deterministic per seed. Honors reduced motion only in
// that nothing autoplays; playback is always user-initiated.

import { renderAudioBuffer, seedComposition, audioToWav } from "./audio.js";

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export function mountAudioPlayer(mount, opts = {}) {
  if (!mount) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  const seedDefault = opts.seed || "aurora";
  mount.innerHTML = "";

  const row = el("div", "desk-controls");
  const seedIn = el("input", "desk-seed");
  seedIn.type = "text"; seedIn.maxLength = 48; seedIn.value = seedDefault;
  seedIn.autocomplete = "off"; seedIn.spellcheck = false;
  seedIn.setAttribute("aria-label", "Sound seed - a word, a date, anything");
  const play = el("button", "plate-redraw", "play");
  play.type = "button"; play.setAttribute("aria-label", "Play the sound this seed synthesizes");
  const stop = el("button", "plate-redraw", "stop");
  stop.type = "button"; stop.disabled = true; stop.setAttribute("aria-label", "Stop playback");
  const save = el("button", "plate-redraw", "save wav");
  save.type = "button"; save.setAttribute("aria-label", "Save this sound as a WAV file");
  row.append(seedIn, play, stop, save);

  const readout = el("p", "plate-hint");
  const status = el("p", "desk-status");
  status.setAttribute("role", "status");
  mount.append(row, readout, status);

  const describe = (seed) => {
    const c = seedComposition(seed);
    readout.textContent = `key root MIDI ${c.root} · ${c.scaleName} · ${c.bpm} bpm · ${c.noteCount} notes · seed ${c.tag}`;
    return c;
  };
  describe(seedDefault);

  let ctx = null, source = null;

  const stopPlayback = () => {
    if (source) { try { source.stop(); } catch (_) {} source.disconnect(); source = null; }
    play.disabled = false; stop.disabled = true;
  };

  play.addEventListener("click", async () => {
    const seed = seedIn.value.trim() || "aurora";
    describe(seed);
    try {
      if (!ctx) ctx = new AC();
      if (ctx.state === "suspended") await ctx.resume();
      stopPlayback();
      const sr = ctx.sampleRate;
      const pcm = renderAudioBuffer(seed, { sampleRate: sr });
      const ab = ctx.createBuffer(1, pcm.length, sr);
      ab.getChannelData(0).set(pcm);
      source = ctx.createBufferSource();
      source.buffer = ab;
      source.connect(ctx.destination);
      source.onended = () => { if (source) { source.disconnect(); source = null; } play.disabled = false; stop.disabled = true; };
      source.start();
      play.disabled = true; stop.disabled = false;
      status.textContent = `playing ${(pcm.length / sr).toFixed(1)}s, synthesized from the seed`;
    } catch (err) {
      status.textContent = "Audio could not start: " + (err && err.message ? err.message : String(err));
    }
  });

  stop.addEventListener("click", () => { stopPlayback(); status.textContent = "stopped"; });

  save.addEventListener("click", () => {
    const seed = seedIn.value.trim() || "aurora";
    const c = describe(seed);
    const pcm = renderAudioBuffer(seed, { sampleRate: 44100 });
    const wav = audioToWav(pcm, 44100);
    const blob = new Blob([wav], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = el("a");
    a.href = url; a.download = `telos-sound-${c.tag}.wav`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    status.textContent = `saved telos-sound-${c.tag}.wav (44.1 kHz, 16-bit)`;
  });

  seedIn.addEventListener("input", () => describe(seedIn.value.trim() || "aurora"));

  return { describe, stop: stopPlayback };
}

// Auto-mount if a container is present (static gallery page).
if (typeof document !== "undefined") {
  const boot = () => {
    const mount = document.getElementById("sound-desk");
    if (mount && !mount.dataset.mounted) {
      mount.dataset.mounted = "true";
      const seed = mount.dataset.seed || "aurora";
      try { mountAudioPlayer(mount, { seed }); } catch (_) {}
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
}
