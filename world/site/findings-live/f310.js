// f310.js: the live re-run block for finding F310. mount(el, src) builds a Run button and a seed field; nothing is
// fetched or computed until Run is pressed. The run happens in f310.worker.js. The table puts each re-run number
// beside the number in the study's result file and marks whether the two are the same double.
const SEED = "20261036";
const SEEDED = "uses the seed";
const CONTROL_NAMES = { C_order: "Plain form, order shuffled", C_pool: "Plain form, pooled gaps", C_order_gapped: "Gapped form, order shuffled" };
const STATS = [["mean", "control mean"], ["q05", "control 5th percentile"], ["q95", "control 95th percentile"], ["p_ge", "p"], ["n", "draws"]];
const ANALYSIS = [
  ["n", "Systems", false], ["n_planets", "Planets", false], ["reg_plain", "Real score, plain form", false],
  ["reg_gapped", "Real score, gapped form", false], ["plant_reg", "Planted score", true],
  ["loo_err", "Leave-one-out miss, straight-line fit", false], ["loo_neigh", "Leave-one-out miss, neighbour midpoint", false],
  ["loo_ratio", "Leave-one-out ratio", false], ["solar_r_plain", "Solar System residual, plain form", false],
  ["solar_r_gapped", "Solar System residual, gapped form", false],
];
const STAGES = { C_order: "order-shuffle control, plain form", C_pool: "pooled-gap control", C_order_blagg: "draws for the form that is not scored here", C_order_gapped: "order-shuffle control, gapped form" };

const h = (tag, props, ...kids) => {
  const e = Object.assign(document.createElement(tag), props || {});
  e.append(...kids);
  return e;
};

// every number the run produces, in table order: [label, re-run value, study value, depends on the seed]
export function rowsOf(res, pub) {
  const out = ANALYSIS.map(([k, label, seeded]) => [label, res.analysis[k], pub.analysis[k], seeded]);
  for (const key of Object.keys(CONTROL_NAMES)) {
    for (const [s, word] of STATS) out.push([`${CONTROL_NAMES[key]}: ${word}`, res.controls[key][s], pub.controls[key][s], s !== "n"]);
  }
  return out;
}

function table(rows, isDefault) {
  const body = rows.map(([label, got, want, seeded]) => {
    const same = Object.is(got, want), expected = !same && seeded && !isDefault;
    const mark = h("td", { className: `fl-mark ${same ? "ok" : expected ? "new" : "no"}` }, same ? "✓ same" : expected ? "new draw" : "✗ differs");
    return h("tr", null, h("th", { scope: "row" }, label), h("td", { className: "fl-n" }, String(got)), h("td", { className: "fl-n" }, String(want)), mark);
  });
  const head = h("tr", null, ...["Quantity", "This run", "Study file", "Compared"].map((t) => h("th", { scope: "col" }, t)));
  const t = h("table", { className: "fl-table" }, h("caption", null, "Numbers from this run beside the study's result file."), h("thead", null, head), h("tbody", null, ...body));
  return h("div", { className: "fl-scroll" }, t);
}

function verdict(rows, seed, ms) {
  const same = rows.filter(([, a, b]) => Object.is(a, b)).length, time = `The run took ${(ms / 1000).toFixed(1)} s in this browser.`;
  if (seed === SEED) {
    return same === rows.length
      ? `All ${rows.length} numbers equal the study's result file to the last digit. ${time}`
      : `${same} of ${rows.length} numbers equal the study's result file; ${rows.length - same} differ in this browser. ${time}`;
  }
  const fixed = rows.filter(([, , , seeded]) => !seeded), ok = fixed.filter(([, a, b]) => Object.is(a, b)).length;
  return `Seed ${seed} gives new control draws. ${ok} of the ${fixed.length} numbers that use no random draw equal the study's result file. ${time}`;
}

async function load(src) {
  const [sys, pub] = await Promise.all([src, new URL("result.json", new URL(src, location.href))].map(async (u) => {
    const r = await fetch(u);
    if (!r.ok) throw new Error(`${u} answered ${r.status}`);
    return r.json();
  }));
  return { rows: sys.systems.map((s) => s.periods), pub };
}

export function mount(el, src) {
  const seed = h("input", { id: "fl-seed-f310", className: "fl-seed", type: "text", inputMode: "numeric", pattern: "[0-9]{1,30}", value: SEED, autocomplete: "off", spellcheck: false });
  const run = h("button", { type: "button" }, "Run");
  const bar = h("progress", { className: "fl-bar", max: 4400, value: 0, hidden: true });
  bar.setAttribute("aria-hidden", "true");
  const status = h("p", { className: "fc-run-out", role: "status" });
  status.setAttribute("aria-live", "polite");
  const out = h("div", { className: "fl-out" });
  const src1 = h("a", { href: "/world/site/findings-live/src/f310.bld" }, "BuildLang source");
  el.append(
    h("h4", null, "Run the study again in this browser"),
    h("p", null, "Run repeats the study's steps on the same 122 systems: the same random draws in the same order and the same arithmetic, 4,400 control draws in all. Seed 20261036 is the study's seed. With it, the run gives 25 of the 31 numbers in the study's result file to the last digit."),
    h("p", { className: "fl-limit" }, "The six numbers for the Blagg-Richardson form are left out. They depend on the logarithm and exponential routines of the maths library the study ran on, and this page cannot repeat those to the last digit. The steps are written in BuildLang (", src1, ") and carried to JavaScript function for function for the browser."),
    h("form", { className: "fl-form" }, h("label", { htmlFor: seed.id }, "Seed"), seed, run), bar, status, out,
  );
  let stage = "";
  const say = (t) => { if (status.textContent !== t) status.textContent = t; };
  const fail = (t) => { bar.hidden = true; run.disabled = false; say(t); };
  const start = async () => {
    if (run.disabled) return;
    const s = seed.value.trim();
    if (!/^[0-9]{1,30}$/.test(s)) return say("The seed is a whole number of up to 30 digits, zero or above.");
    run.disabled = true; out.replaceChildren(); bar.value = 0; bar.hidden = false; stage = "";
    say("Loading the 122 systems.");
    let data;
    try { data = await load(src); } catch (err) { console.error("findings-live f310: load failed", err); return fail("The study's data files did not load, so nothing was run."); }
    const w = new Worker(new URL("./f310.worker.js", import.meta.url), { type: "module" });
    const done = { C_order: 0, C_pool: 0, C_order_blagg: 0, C_order_gapped: 0 };
    w.onerror = (ev) => { console.error("findings-live f310: worker failed", ev.message); w.terminate(); fail("The run stopped with an error. The chart and table above hold the study's own numbers."); };
    w.onmessage = ({ data: m }) => {
      if (m.type === "progress") {
        done[m.key] = m.done;
        bar.value = done.C_order + done.C_pool + done.C_order_blagg + done.C_order_gapped;
        if (stage !== m.key) { stage = m.key; say(`Running: ${STAGES[m.key]}, ${m.total.toLocaleString("en-US")} draws.`); }
      } else if (m.type === "result") {
        w.terminate();
        const rows = rowsOf(m, data.pub);
        out.replaceChildren(table(rows, s === SEED));
        bar.hidden = true; run.disabled = false;
        say(verdict(rows, s, m.ms));
      } else { console.error("findings-live f310:", m.message); w.terminate(); fail("The run stopped with an error. The chart and table above hold the study's own numbers."); }
    };
    w.postMessage({ rows: data.rows, seed: s });
  };
  el.querySelector("form").addEventListener("submit", (ev) => { ev.preventDefault(); start(); });
  run.addEventListener("click", (ev) => { ev.preventDefault(); start(); });
}
