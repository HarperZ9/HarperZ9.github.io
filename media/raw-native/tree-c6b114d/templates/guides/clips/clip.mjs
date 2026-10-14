// A guide clip: ?guide=tallow|pylon|rerun&clip=idle|talk|action|intro&frame=wide|medium|close
// [&style=thriller|painted|pixel][&move=pan|push&mode=integer|sharp&ease=linear|inout][&dur=SECONDS].
// tools/guides/render_clips.py renders each one as a short video. Test switches (PROGRESS.md
// records which won): spring=soft|firm, mouth=line|open, legs=front|profile,
// mouthcurve=amplitude|letters|both, gesture=back|smooth, ev=N&dark=K (the thriller's exposure).
import { shot } from "../stage.mjs";
import { MOVES, setSpring } from "../motion.mjs";
import { setMouth } from "../tallow.mjs";
import { setLegs } from "../rerun.mjs";
import { setEase } from "../intro.mjs";
import { setThriller } from "../look.mjs";
const q = new URL(import.meta.url).searchParams, guide = q.get("guide") || "tallow";
const HOME = { tallow: "thriller", pylon: "painted", rerun: "pixel" };
const mv = q.get("move"), D = 4.8;
if (q.get("spring")) setSpring(q.get("spring"));
if (q.get("mouth")) setMouth(q.get("mouth"));
if (q.get("legs")) setLegs(q.get("legs"));
if (q.get("gesture")) setEase(q.get("gesture"));
if (q.get("ev") || q.get("dark")) setThriller({ ev: +(q.get("ev") || 0), dark: +(q.get("dark") || 1) });
export default shot({ guide, style: q.get("style") || HOME[guide], clip: q.get("clip") || "idle", frame: q.get("frame") || "medium", layer: "all",
  move: mv ? MOVES[mv]({ duration: +(q.get("dur") || D), mode: q.get("mode") || undefined, ease: q.get("ease") || undefined }) : null,
  duration: q.get("dur") ? +q.get("dur") : mv ? D : null, mouthVariant: q.get("mouthcurve"), mouthFile: q.get("mouthfile") });
