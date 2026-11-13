// sound.js: the site's one sound layer. Off until the reader turns it on; the choice is remembered in this browser
// only. Toys ask it for short cues (cue("tick"), cue("hit")); pieces of music come from music/manifest.json, which the
// composition track fills (track("name")). Nothing here plays on its own, and reduced motion keeps cues short.
const KEY = "site-sound";
let ctx = null, on = false, current = null;
try { on = localStorage.getItem(KEY) === "on"; } catch (e) { on = false; }

function audio() { if (!ctx) ctx = new AudioContext(); if (ctx.state === "suspended") ctx.resume(); return ctx; }
function reflect() {
  for (const b of document.querySelectorAll("[data-sound-toggle]")) {
    b.setAttribute("aria-pressed", String(on));
    const w = b.querySelector(".snd-word"); if (w) w.textContent = on ? "Sound on" : "Sound off";
  }
}
export function set(v) {
  on = !!v;
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) { /* private window: the choice lasts this visit */ }
  if (!on && current) { current.pause(); current = null; }
  reflect();
}
export const isOn = () => on;

// a cue is a short tone shaped like a struck object: pitch and length say what happened
const CUES = { tick: [880, 0.04], hit: [196, 0.18], good: [660, 0.12], miss: [140, 0.22] };
export function cue(name) {
  if (!on || !CUES[name]) return;
  const [f, len] = CUES[name], a = audio(), t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + len);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + len + 0.02);
}

// music from the composition track: the manifest names each piece and its files; an empty list plays nothing
export async function track(name) {
  if (!on) return null;
  const m = await fetch("/world/site/music/manifest.json").then((r) => r.json()).catch((e) => { console.warn("sound: no music manifest", e); return { tracks: [] }; });
  const t = m.tracks.find((x) => x.name === name);
  if (!t) return null;
  if (current) current.pause();
  current = new Audio(t.src); current.loop = !!t.loop;
  await current.play().catch((e) => console.warn("sound: the piece did not start", e));
  return current;
}

document.addEventListener("click", (e) => { const b = e.target.closest?.("[data-sound-toggle]"); if (b) { set(!on); if (on) cue("good"); } });
reflect();
