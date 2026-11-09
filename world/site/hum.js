// hum.js: the theme on a press. Every [data-hum] control plays Hum v4 (the calm loop under reduced motion), never
// on its own: sound starts only when a visitor presses it. The record in the hand shows the live waveform through
// UIShell.audio, the same analyser the shell's own sound used. window.SiteHum is the theme's clock: 112 beats a
// minute, felt in half time, so motion that keeps time with the music can land on its sixteenth-note grid.
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const BPM = 112, SIXTEENTH = 15 / BPM;
let audio = null, ctx = null, analyser = null;

function source(v) {
  const a = document.createElement("audio");
  return a.canPlayType('audio/ogg; codecs="opus"') ? `/media/world/sound/hum4-${v}.opus` : `/media/world/sound/hum4-${v}.m4a`;
}
function start() {
  audio = new Audio(source(reduced.matches ? "calm" : "theme")); audio.loop = true; audio.crossOrigin = "anonymous";
  try {
    ctx = new AudioContext(); analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
    ctx.createMediaElementSource(audio).connect(analyser); analyser.connect(ctx.destination);
    window.UIShell = Object.assign(window.UIShell || {}, { audio: { ctx, analyser } });
  } catch (e) { console.warn("hum: no analyser, the theme plays without its waveform", e); }
  return audio.play();
}
function stop() {
  audio?.pause(); audio = null;
  ctx?.close().catch((e) => console.warn("hum: close failed", e)); ctx = null; analyser = null;
  if (window.UIShell) window.UIShell.audio = null;
}
function set(on) {
  for (const b of document.querySelectorAll("[data-hum]")) b.setAttribute("aria-pressed", String(on));
  document.documentElement.classList.toggle("sound-on", on);
}
for (const b of document.querySelectorAll("[data-hum]")) {
  b.hidden = false;
  b.addEventListener("click", async () => {
    const on = b.getAttribute("aria-pressed") !== "true";
    if (!on) { stop(); set(false); return; }
    try { await start(); set(true); } catch (e) { console.warn("hum: the theme could not play", e); stop(); set(false); }
  });
}
window.SiteHum = {
  bpm: BPM, sixteenth: SIXTEENTH,
  get playing() { return !!audio && !audio.paused; },
  get analyser() { return analyser; },
  // seconds until the next sixteenth of the theme, or 0 when it is not playing
  untilGrid() { if (!audio || audio.paused) return 0; const t = audio.currentTime; return SIXTEENTH - (t % SIXTEENTH); },
  // run fn on the theme's grid when it plays, at once when it does not
  onGrid(fn) { const d = this.untilGrid(); d > 0.004 ? setTimeout(fn, d * 1000) : fn(); },
};
