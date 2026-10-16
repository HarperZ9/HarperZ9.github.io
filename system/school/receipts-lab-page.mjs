// Rerun's receipt: the real bundle from Flywheel's public PySyft receipt fixture, checked from scratch
// in this page. Flip any byte of any file and check again; or run the edits a cheater would try: two
// rows trade marks, the stated score is edited, or a key holder signs a lie. Mounted on a press. A
// guess first, never scored; a real end. Nothing is sent anywhere.
import { frame } from "./receipts-lab-view.mjs";
import { verify, BUNDLE_FILES, rederive } from "./receipts.mjs";
import { tamper, sameScore, statedScore, cheater } from "./receipts-lab.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const bytes = (p) => fetch(new URL(`../../media/school/receipts/${p}`, import.meta.url)).then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b));
const option = (value, text) => el("option", { value, text });
const OPTS = { nonce: "openmined-bridge-demo-20261003", reviewers: ["do@example.org"] };
const SWEPT = ["results.jsonl", "receipt.json", "job/code/main.py", "job/config.yaml", "job/run.sh", "job/syft.pub.yaml", "reveal_answers.json", "public_key.hex"];

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, F, files] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/receipts/facts.json"),
    Promise.all(BUNDLE_FILES.map((f) => bytes(f).then((b) => [f, b]))).then(Object.fromEntries)]);
  const A = { sans, mono, atlas: sans };
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "The receipt's checks as a list, each passed or failed, with the verdict, the score counted from the rows, and what was changed." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "rc-guess", min: "0", max: "2892", step: "1", value: "2000", class: "lab-num", inputmode: "numeric" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Open the shell");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: `Rerun: Before we start. The rows file has ${F.film.results.bytes.toLocaleString("en")} bytes. Flip each one in turn and check the receipt. How many flips are caught?` }),
    el("label", { for: "rc-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const file = el("select", { id: "rc-file", class: "lab-select" }, SWEPT.map((f) => option(f, f)));
  const at = el("input", { type: "number", id: "rc-byte", min: "0", step: "1", value: "52", class: "lab-num", inputmode: "numeric" });
  const flip = el("button", { type: "button", class: "ns-btn" }, "Flip and check");
  const edit = el("select", { id: "rc-edit", class: "lab-select" }, [option("swap", "two rows trade marks"), option("score", "edit the stated score"), option("lie", "a key holder signs a lie")]);
  const run = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Try the edit"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [file, at, flip]), el("div", { class: "lab-row" }, [edit, run]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Rerun's receipt" });
  const s = { what: "", result: null, count: null, busy: false };
  let frameNo = 0, job = 0;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const failedOf = (r) => [...r.failed, ...r.extraFailed];
  const say = () => { const r = s.result; status.textContent = s.busy ? `${s.what}: checking` : r ? `${s.what}: ${r.verdict}${failedOf(r).length ? `; failed: ${failedOf(r).join(", ")}` : "; every check passed"}${s.count ? `; ${s.count.correct} of ${s.count.total} counted from the rows` : ""}.` : "Loading the bundle."; };
  const show = async (what, p) => { const id = ++job; s.what = what; s.busy = true; say(); draw(); const out = await p; if (id !== job) return; s.busy = false; Object.assign(s, { after: null, pinned: null }, out); say(); draw(); };
  const real = () => show("The real bundle", (async () => ({ result: await verify(files, OPTS), count: await rederive(files["results.jsonl"]) }))());
  const doFlip = () => { const f = file.value, b = files[f], i = Math.max(0, Math.min(b.length - 1, Math.floor(+at.value || 0))); at.value = String(i); at.max = String(b.length - 1);
    const changed = { ...files, [f]: tamper(b, i) };
    return show(`${f}, byte ${i} of ${b.length} flipped`, (async () => ({ result: await verify(changed, OPTS), count: f === "results.jsonl" ? await rederive(changed["results.jsonl"]).catch(() => null) : null }))()); };
  const doEdit = () => show(edit.options[edit.selectedIndex].text, (async () => {
    if (edit.value === "swap") { const c = await sameScore(files, OPTS); return { result: c.result, count: null, what: c.what }; }
    if (edit.value === "score") { const c = await statedScore(files, OPTS); return { result: c.result, count: null, what: c.what }; }
    const c = await cheater(files, OPTS);
    if (!c.available) return { result: { verdict: "UNVERIFIABLE", failed: [], extraFailed: [], checks: [] }, count: null, what: `the signed lie: ${c.why}` };
    return { result: c.beforeReveal, after: c.afterReveal, pinned: c.originalKeyPinned, count: null, what: `${c.what}, checked with the liar's key and the answers hidden` };
  })());
  fitCanvas(canvas, be, draw); // the first state (loading) is drawable as it is
  file.addEventListener("change", () => { at.max = String(files[file.value].length - 1); });
  flip.addEventListener("click", doFlip);
  run.addEventListener("click", doEdit);
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; real(); });
  done.addEventListener("click", () => {
    job++;
    const M = F.film;
    end.replaceChildren(el("h3", { text: "The shell goes back on the sand" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value}. Every one of the ${M.results.bytes.toLocaleString("en")} flips of the rows file was caught. In the receipt itself, ${M.receipt.caught.toLocaleString("en")} of ${M.receipt.bytes.toLocaleString("en")}; the rest sit in two fields outside the signed body.` }),
      el("li", { text: `A key holder who signs a lie passes every hash check. Only the revealed answers, or a key trusted before, catch it: ${M.cheat.id} said ${M.cheat.prediction}, and the answer is ${M.cheat.answer}.` })]),
      el("p", { class: "ns-close", text: "Rerun: Recount, recompute, and remember what a signature cannot see." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
