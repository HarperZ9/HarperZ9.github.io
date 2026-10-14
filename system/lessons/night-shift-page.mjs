// Night Shift on a page: the canvas, the controls, and the end screen. Mounted on a press,
// never on load. Draws with raw-native's WebGPU renderer (the thriller look) where the browser
// has WebGPU, else with its Canvas 2D drawer. One shift, a real end, no score.
import { RULES, newShift, tick, act, takeBack, endShift, summary, gameHour } from "./night-shift.mjs";
import { frame } from "./night-shift-view.mjs";
import { el, loadAtlas, backend, fitCanvas } from "./stage.mjs";

const ACTIONS = [["check", "C", "Check", `${RULES.checkHours} hours`], ["rerun", "R", "Rerun the data", "range on the card"], ["pass", "L", "Let it through", "free"], ["hold", "H", "Hold", `up to ${RULES.holdMax}`]];

export async function mountNightShift(box, { seed = (Date.now() % 100000) + 1, force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const A = await loadAtlas();
  box.replaceChildren();
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "Tallow's desk on the night shift. The claim on the desk, the cards waiting at the door, the jar of spent hours, and the town through the window." });
  const status = el("p", { class: "ns-status" });
  const event = el("p", { class: "ns-event", "aria-live": "polite" });
  const cardBox = el("div", { class: "ns-card" });
  const buttons = Object.fromEntries(ACTIONS.map(([id, key, name, cost]) => [id, el("button", { type: "button", class: "ns-btn", "data-act": id, "aria-keyshortcuts": key }, [el("span", { class: "ns-key", text: key }), ` ${name} `, el("span", { class: "ns-cost", text: cost })])]));
  const heldBox = el("div", { class: "ns-held" });
  const pause = el("button", { type: "button", class: "ns-btn ns-quiet", "aria-keyshortcuts": "P" }, "Pause");
  const stop = el("button", { type: "button", class: "ns-btn ns-quiet" }, "End the shift now");
  const controls = el("div", { class: "ns-controls", hidden: "" }, [cardBox, el("div", { class: "ns-acts" }, Object.values(buttons)), heldBox, el("div", { class: "ns-acts" }, [pause, stop])]);
  const intro = el("div", { class: "ns-intro" });
  const end = el("div", { class: "ns-end", hidden: "" });
  box.classList.add("ns");
  box.append(canvas, status, event, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Night Shift" });
  let s = newShift(seed, 0), running = false, paused = false, last = 0, frameNo = 0, raf = 0;
  const say = (m) => { event.textContent = m; };
  const draw = async () => { await be.draw(frame(s, s.t, A, { reduced }), frameNo++); };
  fitCanvas(canvas, be, () => { if (!running) draw(); });

  // Before the shift: Tallow asks for a prediction. The guess is never scored.
  const guess = el("input", { type: "number", min: "0", max: "40", value: "8", id: `ns-guess-${seed}`, inputmode: "numeric" });
  const start = el("button", { type: "button", class: "ns-btn ns-go" }, "Start the shift");
  intro.append(el("p", { text: "Tallow: Your guess first. How many of tonight's claims do you think we can check?" }),
    el("label", { for: guess.id, text: "My guess " }), guess, start,
    el("p", { class: "ns-note", text: `About four minutes. ${RULES.budget} hours of checking for a ${RULES.shiftHours}-hour shift. Every claim in this level is invented. Space or P pauses.` }));
  await draw();

  const describe = () => {
    if (s.desk === null) { cardBox.textContent = s.done ? "" : "No claim on the desk. The next one is on its way."; return; }
    const c = s.night.claims[s.desk];
    const range = c.data ? (c.route === "straight" ? "It carries its data, and the numbers look straight: a rerun takes 2 to 4 hours." : "It carries its data, but you would have to ask the authors: a rerun takes 5 to 25 hours.") : "No data comes with it.";
    cardBox.textContent = `On the desk: "${c.title}", ${c.glossy ? "a polished card" : "a rough card"}. ${range}`;
    buttons.rerun.disabled = !c.data;
    buttons.rerun.querySelector(".ns-cost").textContent = c.data ? `${RULES.rerun[c.route][0]} to ${RULES.rerun[c.route][1]} hours` : "needs data";
  };
  const renderHeld = () => {
    heldBox.replaceChildren(...s.held.map((id, i) => {
      const b = el("button", { type: "button", class: "ns-btn ns-quiet", "aria-keyshortcuts": String(i + 1) }, `${i + 1}: take back "${s.night.claims[id].title}"`);
      b.addEventListener("click", () => { takeBack(s, i); update(); });
      return b;
    }));
  };
  const update = () => {
    describe(); renderHeld();
    const h = gameHour(s.t, s.rules);
    status.textContent = (`${s.budget} of ${s.rules.budget} hours left. Hour ${Math.min(12, Math.floor(h) + 1)} of ${s.rules.shiftHours}. ${s.queue.length} waiting at the door. ${s.held.length} held.`);
    if (s.done && running) finish();
  };
  const doAct = (id) => {
    const r = act(s, id);
    if (!r.ok) { say(`Tallow: Not that one. ${r.why[0].toUpperCase()}${r.why.slice(1)}.`); return; }
    const e = r.entry, c = s.night.claims[e.id];
    if (e.action === "check" || e.action === "rerun") say(e.found === "nothing there" ? `"${c.title}": the card goes blank in his light. There was nothing there to read. ${e.hours} hours.` : e.found === "holds" ? `"${c.title}" holds. ${e.hours} hours.` : `"${c.title}": the rerun leaves a dark spot even with the authors' help. ${e.hours} hours.`);
    else if (e.action === "pass") say(`"${c.title}" goes out into the town unchecked.`);
    else if (e.action === "hold") say(`"${c.title}" is held on the desk, marked and not checked. It does not spread while it waits.`);
    update();
  };
  for (const [id] of ACTIONS) buttons[id].addEventListener("click", () => doAct(id));
  const keys = (ev) => {
    if (!running || ev.target.tagName === "INPUT") return;
    const k = ev.key.toLowerCase(), map = { c: "check", r: "rerun", l: "pass", h: "hold" };
    if (map[k]) { ev.preventDefault(); doAct(map[k]); } else if (k === "p" || k === " ") { ev.preventDefault(); togglePause(); } else if ("123".includes(k) && k) { takeBack(s, +k - 1); update(); }
  };
  box.addEventListener("keydown", keys);
  const togglePause = () => { paused = !paused; pause.textContent = paused ? "Resume" : "Pause"; if (!paused) { last = performance.now(); loop(); } say(paused ? "Paused. The clock has stopped." : "Back to the desk."); };
  pause.addEventListener("click", togglePause);
  stop.addEventListener("click", () => { endShift(s); update(); });
  const loop = () => {
    if (!running || paused) return;
    raf = requestAnimationFrame(async (now) => {
      const before = s.desk;
      tick(s, Math.min(0.1, (now - last) / 1000)); last = now;
      if (before !== s.desk) describe();
      await draw();
      if (Math.floor(s.t * 2) !== Math.floor((s.t - 0.1) * 2)) update();
      if (!s.done) loop();
    });
  };
  start.addEventListener("click", () => {
    s = newShift(seed, Math.max(0, Math.min(40, Math.round(+guess.value || 0))));
    intro.hidden = true; controls.hidden = false; end.hidden = true; running = true; paused = false; last = performance.now();
    box.tabIndex = -1; box.focus({ preventScroll: true });
    update(); loop();
  });

  function finish() {
    running = false; cancelAnimationFrame(raf); controls.hidden = true; draw();
    const m = summary(s);
    end.replaceChildren(
      el("h3", { text: "Morning" }),
      el("ul", {}, [
        el("li", { text: `Your guess: ${m.prediction}. Checked: ${m.checked}${m.checked !== m.resolved ? `, of which ${m.checked - m.resolved} still had a dark spot` : ""}.` }),
        el("li", { text: `${m.came} claims came in. ${m.out} went out unchecked, ${m.falseOut} of them false, and by morning the false ones had reached about ${m.falseReach.toLocaleString("en")} people. ${m.held} stayed held.` }),
        el("li", { text: `Polished cards: ${m.glossy.held} of ${m.glossy.n} held. Rough cards: ${m.rough.held} of ${m.rough.n} held. The look was drawn apart from the truth, so it could not tell you.` }),
        el("li", { text: `The same night with every claim carrying its data, each rerun taking 2 to 4 hours: ${m.replay} claims checked in the same ${RULES.budget} hours.` }),
      ]),
      el("p", { class: "ns-close", text: "Tallow: Nobody could have checked all of these. That is the point. The cheapest check is the one that ships with the claim." }),
      el("p", { class: "ns-note", text: "Sources, as in the film: Aczel and others 2021 (about 6 hours a review), Hardwicke and others 2018 (2 to 4 and 5 to 25 person hours; 11 of 35 reproduced without help), Vosoughi, Roy and Aral 2018 (truth took about six times as long to reach 1,500 people; a spread study, not a cost study). The budget, the shift length, the arrival rate, the share with data, the share that does not hold and the hour it takes a false claim to spread are settings of this level." }));
    const again = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Same night, new seed");
    again.addEventListener("click", () => { seed = seed * 7 + 13; intro.hidden = false; end.hidden = true; s = newShift(seed, 0); draw(); });
    end.append(again);
    end.hidden = false;
    say("The shift is over.");
  }
  return { get state() { return s; }, backend: be.kind };
}
