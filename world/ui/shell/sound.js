// The shell's sound, loaded by base.js on the first press of a [data-sound] button: a visitor who never presses
// it never downloads this file. The default export wires every sound button; base.js then repeats the press.
const root = document.documentElement;

// Sound: off until pressed. A room tone, filtered noise under two low sines, faded in and out.
export default function initSound() {
  let ctx = null, out = null;
  const start = () => {
    ctx = new AudioContext();
    out = ctx.createGain();
    out.gain.value = 0;
    const analyser = ctx.createAnalyser(); analyser.fftSize = 512;
    out.connect(analyser); analyser.connect(ctx.destination);
    window.UIShell = Object.assign(window.UIShell || {}, { audio: { ctx, analyser } });
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420;
    noise.connect(lp).connect(out); noise.start();
    for (const [f, g] of [[55, 0.05], [82.4, 0.025]]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.value = f; og.gain.value = g; o.connect(og).connect(out); o.start();
    }
    out.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.6);
  };
  const stop = () => {
    if (!ctx) return;
    const c = ctx; out.gain.linearRampToValueAtTime(0, c.currentTime + 0.3);
    setTimeout(() => c.close().catch((e) => console.warn("sound: close failed", e)), 400);
    ctx = null;
    if (window.UIShell) window.UIShell.audio = null;
  };
  for (const b of document.querySelectorAll("[data-sound]")) {
    b.hidden = false;
    b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      try { on ? start() : stop(); } catch (e) { console.warn("sound: Web Audio unavailable", e); return; }
      document.querySelectorAll("[data-sound]").forEach((x) => x.setAttribute("aria-pressed", String(on)));
      root.classList.toggle("sound-on", on);
    });
  }
}
