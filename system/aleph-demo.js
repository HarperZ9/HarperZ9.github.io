/* aleph-demo.js — an ILLUSTRATION of what Aleph produces, not the tool itself.

   It streams SYNTHETIC evaluation findings into a live dashboard to show the
   SHAPE of the output — a stream of evaluated cases, each one bounded to scope
   and witnessed so it re-derives — WITHOUT putting the actual capability, or a
   single real technique, on a public page. Everything here is synthetic; the
   only real thing is the SHA-256 witness, computed over the synthetic
   descriptor to make the point honestly: even the dramatisation is on the
   record. The real evaluation, and how it is done, stays private. */
(function () {
  "use strict";
  var feed = document.getElementById("ad-feed");
  if (!feed) return;
  var elProbes = document.getElementById("ad-probes"),
      elFound = document.getElementById("ad-found"),
      elExport = document.getElementById("ad-export"),
      elBatch = document.getElementById("ad-batch");
  var reduced = matchMedia("(prefers-reduced-motion:reduce)").matches;

  // dimensions a safety team genuinely evaluates — CATEGORIES, never methods
  var DIMS = [
    "refusal robustness", "instruction-injection resistance", "spec-gaming",
    "tool-use safety", "PII handling", "consistency under pressure",
    "over-refusal (false positive)", "sycophancy under pressure",
    "jailbreak resistance", "harmful-request refusal", "prompt-leak resistance",
    "goal stability", "deception under incentive", "boundary adherence"
  ];
  // outcomes — weighted so "held" dominates (a good model mostly holds), with
  // the occasional case to harden (the product value) and a human-review flag
  var OUTCOMES = [
    { k: "held", verb: "model held", cls: "ad-ok", found: false, weight: 60 },
    { k: "hold", verb: "held, low margin", cls: "ad-ok", found: false, weight: 14 },
    { k: "harden", verb: "case to harden surfaced", cls: "ad-warn", found: true, weight: 19 },
    { k: "review", verb: "flagged for human review", cls: "ad-needs", found: true, weight: 7 }
  ];
  var WSUM = OUTCOMES.reduce(function (a, o) { return a + o.weight; }, 0);
  function pickOutcome(r) { var t = r * WSUM, a = 0; for (var i = 0; i < OUTCOMES.length; i++) { a += OUTCOMES[i].weight; if (t < a) return OUTCOMES[i]; } return OUTCOMES[0]; }

  var probes = 0, found = 0, exported = 0, batch = 0, batchExport = 0, rows = 0;
  function fmt(n) { return n.toLocaleString("en-US"); }
  function fakeHash() { var c = "0123456789abcdef", s = ""; for (var i = 0; i < 16; i++) s += c[(Math.random() * 16) | 0]; return s; }

  function witnessText(descriptor, cb) {
    if (window.Spine && window.Spine.witness) {
      window.Spine.witness(descriptor).then(function (h) { cb(h ? h.slice(0, 12) : fakeHash().slice(0, 12)); });
    } else { cb(fakeHash().slice(0, 12)); }
  }

  function addRow(dim, outcome) {
    probes++; rows++; batch++;
    if (outcome.found) { found++; batchExport++; }
    var idx = probes;
    var descriptor = "probe#" + idx + "|" + dim + "|" + outcome.k + "|scope:in|synthetic";

    var row = document.createElement("div");
    row.className = "ad-row" + (reduced ? " ad-in" : "");
    row.innerHTML =
      '<span class="ad-id">#' + (5000 + idx) + '</span>' +
      '<span class="ad-dim">' + dim + '</span>' +
      '<span class="ad-out ' + outcome.cls + '">' + outcome.verb + '</span>' +
      '<span class="ad-scope" title="bounded to the authorised scope">scope&nbsp;✓</span>' +
      '<span class="ad-wit">witnessed <span class="ad-hash">…</span></span>';
    feed.appendChild(row);
    if (!reduced) requestAnimationFrame(function () { row.classList.add("ad-in"); });
    while (feed.children.length > 6) feed.removeChild(feed.firstChild);

    witnessText(descriptor, function (h) { var el = row.querySelector(".ad-hash"); if (el) el.textContent = h + "…"; });

    if (elProbes) elProbes.textContent = fmt(probes);
    if (elFound) elFound.textContent = fmt(found);

    // every ~22 cases, "export" a hardening batch (the deliverable)
    if (batch >= 22) {
      exported += batchExport; batch = 0; batchExport = 0;
      if (elExport) { elExport.textContent = fmt(exported); pulse(elExport); }
      if (elBatch) { elBatch.classList.add("ad-flash"); setTimeout(function () { elBatch.classList.remove("ad-flash"); }, 900); }
    }
  }
  function pulse(el) { el.classList.remove("ad-pulse"); void el.offsetWidth; el.classList.add("ad-pulse"); }

  function tick() { addRow(DIMS[(Math.random() * DIMS.length) | 0], pickOutcome(Math.random())); }

  // seed a few instantly so the panel is never empty, then stream
  var running = false, timer = 0;
  function run() {
    if (running) return; running = true;
    for (var i = 0; i < 4; i++) tick();
    function loop() { tick(); timer = setTimeout(loop, reduced ? 2600 : (760 + Math.random() * 620)); }
    timer = setTimeout(loop, reduced ? 2600 : 900);
  }
  function stop() { running = false; clearTimeout(timer); }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) run(); else stop(); });
    }, { threshold: 0.15 }).observe(document.getElementById("aleph-demo") || feed);
  } else { run(); }
})();
