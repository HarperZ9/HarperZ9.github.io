// boot.js: what the home runs for its first screen, and what waits. The first view is the hand, the world, and the
// arrival's loop: those load with the page. The road (its stage layers, the water, the stops), the places and the
// living type load once the first screen has painted and the page is idle after its load event, or at the visitor's
// first act if that comes sooner. Nothing the first screen shows waits on them.
import { watchLoops } from "/world/site/loops.js";
import { isStill } from "/world/site/stage.js";

const root = document.documentElement;
watchLoops(() => isStill() || root.classList.contains("weak"));

let started = false;
const ACTS = ["scroll", "wheel", "pointerdown", "pointermove", "keydown", "touchstart"];
function start(e) {
  if (e?.type) window.__siteActed = true;
  if (started) return; started = true;
  for (const ev of ACTS) removeEventListener(ev, start);
  const load = (m) => import(m).catch((e) => console.error("home: a layer failed to load", m, e));
  load("/world/site/road.js"); load("/world/site/home.js");
  const living = () => load("/world/site/living-hook.js");
  "requestIdleCallback" in window ? requestIdleCallback(living, { timeout: 1500 }) : setTimeout(living, 300);
}
for (const ev of ACTS) addEventListener(ev, start, { passive: true });
const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(start, { timeout: 2000 }) : setTimeout(start, 500));
if (document.readyState === "complete") idle(); else addEventListener("load", idle, { once: true });
const road = document.querySelector(".stop");
if (road) new IntersectionObserver(([e], io) => { if (e.isIntersecting && scrollY > 0) { io.disconnect(); start(); } }, { rootMargin: "50% 0px" }).observe(road);
