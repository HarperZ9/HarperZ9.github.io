// tell.js: read a telegraphed strike, in the page. raw-native's retiming lint holds every tell to a lead of 18, 30 or
// 36 frames at 60 Hz, slow and then fast (raw-native #242). Here the strike lands when the arc closes; press Parry (or
// Space) as it lands, and the page says how many frames early or late you were. The leads are the engine's; the
// parry window of 4 frames either side is an example for practice, not the game's number.
import { cue } from "/world/site/sound.js";

const host = document.querySelector('[data-toy="tell"]');
if (host) {
  const LEADS = [18, 30, 36], WINDOW = 4, FPS = 60;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  host.innerHTML = `<div class="toy-row">
<svg class="tell-arc" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" class="tell-ring"/><path class="tell-fill" d=""/></svg>
<div class="toy-side"><p class="tell-count" aria-live="off">Ready</p>
<p class="toy-buttons"><button type="button" class="toy-btn" data-act="start">Start a strike</button> <button type="button" class="toy-btn" data-act="parry" disabled>Parry</button> <button type="button" class="toy-btn toy-snd" data-sound-toggle aria-pressed="false"><span class="snd-word">Sound off</span></button></p>
<p class="toy-verdict" aria-live="polite"></p></div></div>`;
  const fill = host.querySelector(".tell-fill"), count = host.querySelector(".tell-count"), verdict = host.querySelector(".toy-verdict");
  const startBtn = host.querySelector('[data-act="start"]'), parryBtn = host.querySelector('[data-act="parry"]');
  let raf = 0, t0 = 0, lead = 30, done = true;
  // slow, then fast: the arc's share of the lead follows a curve that spends most of the time on its first half
  const shape = (u) => Math.pow(u, 2.2);
  function arc(u) {
    const a = shape(Math.min(1, u)) * Math.PI * 2 - Math.PI / 2, x = 60 + 50 * Math.cos(a), y = 60 + 50 * Math.sin(a);
    fill.setAttribute("d", u <= 0 ? "" : u >= 1 ? "M60 10 A50 50 0 1 1 59.99 10" : `M60 10 A50 50 0 ${shape(u) > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  const frame = () => Math.round(((performance.now() - t0) / 1000) * FPS);
  function tick() {
    const f = frame();
    if (!reduced()) arc(f / lead);
    count.textContent = f < lead ? `Frame ${f} of ${lead}` : `Landed at frame ${lead}`;
    if (f >= lead + WINDOW + 6) { finish(null); return; }
    raf = requestAnimationFrame(tick);
  }
  function start() {
    lead = LEADS[Math.floor(Math.random() * LEADS.length)]; done = false; t0 = performance.now();
    verdict.textContent = `A ${lead}-frame tell.`; parryBtn.disabled = false; parryBtn.focus({ preventScroll: true });
    cue("tick"); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
  }
  function finish(f) {
    if (done) return; done = true; cancelAnimationFrame(raf); parryBtn.disabled = true; arc(1);
    if (f === null) { verdict.textContent = `No parry: the ${lead}-frame strike landed.`; cue("hit"); }
    else {
      const d = f - lead;
      const ok = Math.abs(d) <= WINDOW;
      verdict.textContent = ok ? `Parried, ${d === 0 ? "on the frame" : `${Math.abs(d)} frame${Math.abs(d) === 1 ? "" : "s"} ${d < 0 ? "early" : "late"}`}.` : `${Math.abs(d)} frames ${d < 0 ? "early" : "late"}: outside the ${WINDOW}-frame window.`;
      cue(ok ? "good" : "miss");
    }
    startBtn.focus({ preventScroll: true });
  }
  startBtn.addEventListener("click", start);
  parryBtn.addEventListener("click", () => finish(frame()));
  host.addEventListener("keydown", (e) => { if (e.key === " " && !done) { e.preventDefault(); finish(frame()); } });
  arc(0);
}
