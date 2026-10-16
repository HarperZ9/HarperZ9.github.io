// Rerun's parity check on a small stand-in for raw-native's denoiser: pick a version of the arithmetic
// (32-bit, the tensor-core path, weights or inputs alone, the head kept in 32-bit, fp16 or bf16
// throughout), a seed, and whether the image has its glint; the page runs every pixel against the
// exact reference with raw-native's own bound and measure. Mounted on a press. A guess first, never
// scored; a real end. The stand-in is synthetic and says so.
import { frame } from "./denoiser-lab-view.mjs";
import { PARITY, VARIANTS, makeImage, makeNet, scoreImage } from "./denoiser.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";
import { GUIDES } from "../../media/school/shared/lib.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });
const NAMES = { scalar: "32-bit throughout", WA: "the tensor-core path (16-bit inputs and weights, 32-bit sums)", W: "16-bit weights only", A: "16-bit inputs only", keepHead: "the tensor-core path, head in 32-bit", fp16acc: "16-bit throughout, sums too", bf16: "bf16 inputs and weights, 32-bit sums" };

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/denoiser/facts.json")]);
  const A = { sans, mono, atlas: sans };
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "A small image as tiles, each coloured by how far its denoised value is from the exact one, with pixels past the bound in ember, and the worst difference against the bound." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "dn-guess", min: "0", max: "576", step: "1", value: "100", class: "lab-num", inputmode: "numeric" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Raise the prism");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Rerun: Before we start. A small image of 576 pixels with one glint, run on the tensor-core arithmetic. How many pixels miss the bound?" }),
    el("label", { for: "dn-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const path = el("select", { id: "dn-path", class: "lab-select" }, Object.entries(NAMES).map(([k, v]) => option(k, v)));
  path.value = "WA";
  const seed = el("select", { id: "dn-seed", class: "lab-select" }, [1, 2, 3, 4, 5, 6, 7, 8].map((n) => option(String(n), `seed ${n}`)));
  const glint = el("select", { id: "dn-glint", class: "lab-select" }, [option("on", "with the glint"), option("off", "without the glint")]);
  const run = el("button", { type: "button", class: "ns-btn" }, "Run the check"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [path, seed, glint]), el("div", { class: "lab-row" }, [run]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Rerun's parity check", images: GUIDES.rerun.textures ? GUIDES.rerun.textures() : undefined });
  const s = { result: null, w: 32, h: 18, glint: null, bound: PARITY.bound };
  let frameNo = 0;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const say = () => { const r = s.result; status.textContent = r ? `${NAMES[r.path]}, seed ${r.seed}, ${r.glint ? "with" : "without"} the glint: worst difference ${r.maxAbs.toPrecision(3)} at (${r.maxAt?.x ?? "-"}, ${r.maxAt?.y ?? "-"}); ${r.pixelsOver} pixels over the bound ${PARITY.bound}: ${r.within ? "passes" : "misses"}.` : "Choose a version, a seed and the glint, and press Run the check."; };
  const check = () => {
    const sd = +seed.value, on = glint.value === "on", net = makeNet(sd, makeImage(sd)), img = makeImage(sd, { firefly: on });
    const r = scoreImage(img, net, path.value);
    s.result = { ...r, seed: sd, glint: on }; s.w = img.w; s.h = img.h; s.glint = on ? img.firefly : null;
    say(); draw();
  };
  fitCanvas(canvas, be, draw); // the first state (nothing run yet) is drawable as it is
  run.addEventListener("click", check);
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; say(); draw(); });
  done.addEventListener("click", () => {
    const R = F.recreation.image.WA, P = F.primary;
    end.replaceChildren(el("h3", { text: "The prism goes back in the shell" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value} pixels. Seed 1, the tensor-core arithmetic, with the glint: ${R.pixelsOver} of ${R.values / 3} pixels missed the bound, the worst by ${R.maxAbs.toPrecision(3)}.` }),
      el("li", { text: `The real case on the RTX 4090: the tensor-core path's worst difference was ${P.rtx.coop.max_abs}, the 32-bit path's ${P.rtx.scalar.max_abs}, against ${PARITY.bound}. This stand-in is synthetic; its numbers are not raw-native's.` })]),
      el("p", { class: "ns-close", text: "Rerun: The post stays where it was planted." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
