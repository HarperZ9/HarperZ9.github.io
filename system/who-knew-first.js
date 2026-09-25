/* Who Knew First: the disclosure clock and the relationship map.
   Every fact drawn here is also in the static tables on the page; this script
   only adds the chart, the network view and the selection panel. */
(function () {
  "use strict";
  if (typeof d3 === "undefined") return;

  var ROWS = [
    { name: "OpenAI agents and Hugging Face", before: [8.3, 8.3], after: [2.35, 2.35], path: "security", first: "Hugging Face, 5.4 days before OpenAI", outsider: true, note: "First compromise to first alert; alert to public" },
    { name: "GemStuffer on RubyGems", before: null, after: [108, 108], path: "label", first: "Registry staff, then outside researchers", outsider: true, note: "Class-level awareness to first acknowledgment" },
    { name: "DSEWiki board", before: null, after: [75, 76], path: "label", first: "Researchers and Reuters", outsider: true, note: "Awareness inferred; labeled misalignment" },
    { name: "Anthropic in Irregular environments", before: [84, 113], after: [7, 7], path: "security", first: "Anthropic", outsider: false, note: "April incidents; a January one ran 182 to 242 days" },
    { name: "GPT-5.6 Sol at UK AISI", before: [2.85, 2.85], after: [7, 7], path: "security", first: "UK AISI; the public flagged it 1.35 days earlier", outsider: false, note: "Evaluator detection to public" },
    { name: "Meta Muse Spark 1.1", before: [14, 22], after: [5, 9], path: "security", first: "The Information", outsider: true, note: "Exposure to detection; notice to confirmation" },
    { name: "Google Gemini", before: [57, 91], after: [49, 53], path: "label", first: "WSJ inquiry", outsider: true, note: "Labeled mistaken identity and no harm" },
    { name: "Claude Mythos Preview", before: null, after: [42, 42], path: "card", first: "Anthropic system card", outsider: false, note: "Upper bound; no postmortem after 169 days" },
    { name: "OpenAI and Services Australia", before: [44, 74], after: [23, 53], path: "label", first: "Prime Minister of Australia", outsider: true, note: "Developing; government and vendor claims" }
  ];

  function drawClock() {
    var svg = d3.select("#wkf-clock");
    if (svg.empty()) return;
    var W = 1040, rowH = 58, top = 52, left = 250, right = 30, H = top + ROWS.length * rowH + 16;
    svg.attr("viewBox", "0 0 " + W + " " + H);
    var pat = svg.append("defs").append("pattern").attr("id", "wkf-hatch").attr("patternUnits", "userSpaceOnUse")
      .attr("width", 5).attr("height", 5).attr("patternTransform", "rotate(45)");
    pat.append("rect").attr("width", 2).attr("height", 5).style("fill", "var(--wkf-ink)");
    var x = d3.scaleLinear().domain([-120, 120]).range([left, W - right]);
    var ticks = [-120, -90, -60, -30, 0, 30, 60, 90, 120];
    var g = svg.append("g");
    ticks.forEach(function (t) { g.append("line").attr("class", "wkf-gridline").attr("x1", x(t)).attr("x2", x(t)).attr("y1", top - 8).attr("y2", H - 10); });
    var ax = svg.append("g").attr("class", "wkf-axis");
    ticks.forEach(function (t) { ax.append("text").attr("x", x(t)).attr("y", top - 14).attr("text-anchor", "middle").text(t === 0 ? "aware" : Math.abs(t) + " d"); });
    ax.append("text").attr("x", x(0) - 10).attr("y", 14).attr("text-anchor", "end").text("← days before awareness");
    ax.append("text").attr("x", x(0) + 10).attr("y", 14).attr("text-anchor", "start").text("days to the public →");
    ROWS.forEach(function (r, i) {
      var cy = top + i * rowH + 20, bh = 16, row = svg.append("g");
      row.append("text").attr("class", "wkf-rowname").attr("x", 8).attr("y", cy - 2).text(r.name);
      row.append("text").attr("class", "wkf-rownote").attr("x", 8).attr("y", cy + 14).text(r.note);
      if (r.before) {
        row.append("rect").attr("class", "wkf-before").attr("x", x(-r.before[1])).attr("y", cy - bh / 2).attr("width", x(0) - x(-r.before[1])).attr("height", bh);
        var roomy = x(-r.before[1]) - left > 80;
        row.append("text").attr("class", "wkf-val").attr("x", roomy ? x(-r.before[1]) - 6 : x(-r.before[1]) + 6).attr("y", cy + 4)
          .attr("text-anchor", roomy ? "end" : "start").text(r.before[0] === r.before[1] ? r.before[0] + " d" : r.before[0] + " to " + r.before[1] + " d");
      } else {
        row.append("text").attr("class", "wkf-val").attr("x", x(0) - 8).attr("y", cy + 4).attr("text-anchor", "end").text("not disclosed");
      }
      var cls = "wkf-after" + (r.path === "label" ? " label-path" : r.path === "card" ? " card-path" : "");
      row.append("rect").attr("class", cls).attr("x", x(0)).attr("y", cy - bh / 2).attr("width", Math.max(x(r.after[1]) - x(0), 2)).attr("height", bh);
      row.append("text").attr("class", "wkf-val").attr("x", x(r.after[1]) + 6).attr("y", cy + 4)
        .text((r.after[0] === r.after[1] ? (r.path === "card" ? "up to " : "") + r.after[0] : r.after[0] + " to " + r.after[1]) + " d");
      row.append("text").attr("class", "wkf-rowfirst" + (r.outsider ? " outsider" : "")).attr("x", x(0) + 4).attr("y", cy + bh / 2 + 14).text("First public: " + r.first);
    });
    svg.append("line").attr("class", "wkf-zero").attr("x1", x(0)).attr("x2", x(0)).attr("y1", top - 8).attr("y2", H - 10);
  }

  var CLUSTERS = [
    { id: "capital_compute", name: "Capital and compute" }, { id: "evaluation_oversight", name: "Evaluation and oversight" },
    { id: "incident_disclosure", name: "Incident disclosure" }, { id: "military_international", name: "Military and international" },
    { id: "government", name: "Government" }
  ];
  var CL_NAME = {}; CLUSTERS.forEach(function (c) { CL_NAME[c.id] = c.name; });
  var STATUS = [
    { id: "ok", name: "Documented", of: ["documented"] },
    { id: "drift", name: "Claimed or reported", of: ["vendor-claimed", "third-party-reported", "government-claimed"] },
    { id: "unk", name: "Alleged or inferred", of: ["alleged", "inferred", "unknown"] }
  ];
  var COUNTRY_ORDER = ["United States", "China", "United Kingdom", "European Union", "Australia", "Gulf states", "Other", "Not verified"];
  function stGroup(s) { for (var i = 0; i < STATUS.length; i++) if (STATUS[i].of.indexOf(s) >= 0) return STATUS[i].id; return "unk"; }
  function countryGroup(c) {
    if (c === "US") return "United States"; if (c === "CN") return "China"; if (c === "GB") return "United Kingdom";
    if (c === "EU" || c === "AT") return "European Union"; if (c === "AU") return "Australia";
    if (c === "AE" || c === "QA") return "Gulf states"; if (c === "unknown" || !c) return "Not verified"; return "Other";
  }
  function short(label) { var s = String(label).split(" (")[0]; return s.length > 30 ? s.slice(0, 29) + "…" : s; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  function drawMap() {
    var dataEl = document.getElementById("wkf-graph-data");
    if (!dataEl || !document.getElementById("wkf-net")) return;
    var G = JSON.parse(dataEl.textContent);
    var byId = {};
    var nodes = G.nodes.map(function (n) { var o = Object.assign({}, n, { deg: 0, cl: {} }); byId[n.id] = o; return o; });
    var edges = G.edges.filter(function (e) { return byId[e.from] && byId[e.to]; }).map(function (e, i) {
      var o = Object.assign({}, e, { source: e.from, target: e.to, sg: stGroup(e.status), key: e.id || ("e" + i) });
      byId[e.from].deg++; byId[e.to].deg++;
      byId[e.from].cl[e.cluster] = (byId[e.from].cl[e.cluster] || 0) + 1;
      byId[e.to].cl[e.cluster] = (byId[e.to].cl[e.cluster] || 0) + 1;
      return o;
    });
    nodes.forEach(function (n) {
      var best = "government", bc = -1;
      CLUSTERS.forEach(function (c) { var v = n.cl[c.id] || 0; if (v > bc) { bc = v; best = c.id; } });
      n.home = best; n.cgroup = countryGroup(n.country);
    });
    var pairs = {};
    edges.forEach(function (e) { var k = [e.from, e.to].sort().join("|"); e.pi = pairs[k] = (pairs[k] === undefined ? 0 : pairs[k] + 1); });
    var W = 1000, H = 760, mode = "cluster";
    var CL_ANCHOR = { capital_compute: [215, 205], evaluation_oversight: [785, 205], incident_disclosure: [785, 575], military_international: [215, 575], government: [500, 390] };
    var CO_ANCHOR = {};
    COUNTRY_ORDER.forEach(function (c, i) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / COUNTRY_ORDER.length;
      CO_ANCHOR[c] = c === "United States" ? [500, 380] : [500 + 390 * Math.cos(a + 0.45), 380 + 315 * Math.sin(a + 0.45)];
    });
    function anchor(n) { return mode === "cluster" ? CL_ANCHOR[n.home] : CO_ANCHOR[n.cgroup]; }
    function rad(n) { return 4 + Math.sqrt(n.deg) * 2.2; }
    function layout() {
      var sim = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(edges).id(function (d) { return d.id; }).distance(60).strength(0.02))
        .force("charge", d3.forceManyBody().strength(-150).distanceMax(260))
        .force("x", d3.forceX(function (d) { return anchor(d)[0]; }).strength(0.24))
        .force("y", d3.forceY(function (d) { return anchor(d)[1]; }).strength(0.24))
        .force("collide", d3.forceCollide(function (d) { return rad(d) + (mode === "country" ? 17 : 13); })).stop();
      for (var i = 0; i < 420; i++) sim.tick();
      nodes.forEach(function (n) { n.x = Math.max(24, Math.min(W - 24, n.x)); n.y = Math.max(40, Math.min(H - 20, n.y)); });
    }
    var svg = d3.select("#wkf-net"), root = svg.append("g");
    var groupLayer = root.append("g"), edgeLayer = root.append("g"), nodeLayer = root.append("g");
    var zoom = d3.zoom().scaleExtent([0.5, 5]).on("zoom", function (ev) { root.attr("transform", ev.transform); });
    svg.call(zoom).on("dblclick.zoom", null);
    svg.on("click", function (ev) { if (ev.target === svg.node()) clearPick(); });
    document.getElementById("wkf-reset").addEventListener("click", function () { svg.call(zoom.transform, d3.zoomIdentity); });
    function edgePath(e) {
      var s = e.source, t = e.target, dx = t.x - s.x, dy = t.y - s.y, dr = Math.sqrt(dx * dx + dy * dy) || 1;
      var bend = (e.pi % 2 ? -1 : 1) * (8 + 10 * Math.ceil(e.pi / 2)) * (e.pi === 0 ? 0.6 : 1);
      return "M" + s.x + "," + s.y + " Q" + ((s.x + t.x) / 2 - dy / dr * bend) + "," + ((s.y + t.y) / 2 + dx / dr * bend) + " " + t.x + "," + t.y;
    }
    var activeCl = {}, activeSt = {}, picked = null, edgeSel, nodeSel;
    CLUSTERS.forEach(function (c) { activeCl[c.id] = true; });
    STATUS.forEach(function (s) { activeSt[s.id] = true; });
    function visible(e) { return activeCl[e.cluster] !== false && activeSt[e.sg]; }
    function render() {
      groupLayer.selectAll("*").remove();
      var names = mode === "cluster" ? CLUSTERS.map(function (c) { return [c.name, c.id]; }) : COUNTRY_ORDER.map(function (c) { return [c, c]; });
      names.forEach(function (p) {
        var members = nodes.filter(function (n) { return (mode === "cluster" ? n.home : n.cgroup) === p[1]; });
        if (!members.length) return;
        groupLayer.append("text").attr("class", "wkf-group").attr("x", d3.mean(members, function (n) { return n.x; }))
          .attr("y", Math.max(16, d3.min(members, function (n) { return n.y; }) - 22)).attr("text-anchor", "middle").text(p[0] + " (" + members.length + ")");
      });
      edgeSel = edgeLayer.selectAll("path").data(edges, function (d) { return d.key; }).join("path")
        .attr("class", function (d) { return "wkf-edge st-" + d.sg; }).attr("d", edgePath)
        .on("click", function (ev, d) { ev.stopPropagation(); pickEdge(d); });
      nodeSel = nodeLayer.selectAll("g.wkf-node").data(nodes, function (d) { return d.id; }).join(function (enter) {
        var g = enter.append("g").attr("class", "wkf-node").attr("tabindex", 0).attr("role", "button");
        g.append("circle"); g.append("text"); return g;
      });
      nodeSel.attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; }).attr("aria-label", function (d) { return d.label; })
        .classed("hide-label", function (d) { return d.deg < 6; })
        .on("click", function (ev, d) { ev.stopPropagation(); pickNode(d); })
        .on("keydown", function (ev, d) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pickNode(d); } });
      nodeSel.select("circle").attr("r", rad);
      nodeSel.select("text").attr("x", function (d) { return rad(d) + 4; }).attr("y", 4).text(function (d) { return short(d.label); });
      applyFilters();
    }
    function applyFilters() {
      var live = {};
      edges.forEach(function (e) { if (visible(e)) { live[e.from] = 1; live[e.to] = 1; } });
      edgeSel.style("display", function (d) { return visible(d) ? null : "none"; });
      nodeSel.style("display", function (d) { return live[d.id] ? null : "none"; });
      if (picked) (picked.kind === "node" ? pickNode(picked.d) : pickEdge(picked.d));
    }
    function chips(host, list, active, dot) {
      list.forEach(function (it) {
        var b = el("button", "wkf-chip"); b.type = "button"; b.setAttribute("aria-pressed", "true");
        if (dot) { var d = el("span", "wkf-dot"); d.style.background = "var(--v-" + it.id + ")"; b.appendChild(d); }
        b.appendChild(document.createTextNode(it.name));
        b.addEventListener("click", function () { active[it.id] = !active[it.id]; b.setAttribute("aria-pressed", active[it.id] ? "true" : "false"); applyFilters(); });
        host.appendChild(b);
      });
    }
    chips(document.getElementById("wkf-status-chips"), STATUS, activeSt, true);
    chips(document.getElementById("wkf-cluster-chips"), CLUSTERS, activeCl, false);
    var jump = document.getElementById("wkf-jump");
    nodes.slice().sort(function (a, b) { return a.label.localeCompare(b.label); }).forEach(function (n) { var o = el("option", null, n.label); o.value = n.id; jump.appendChild(o); });
    jump.addEventListener("change", function () { if (jump.value) pickNode(byId[jump.value]); });
    function setMode(m) {
      mode = m;
      document.getElementById("wkf-by-cluster").setAttribute("aria-pressed", m === "cluster" ? "true" : "false");
      document.getElementById("wkf-by-country").setAttribute("aria-pressed", m === "country" ? "true" : "false");
      layout(); render();
    }
    document.getElementById("wkf-by-cluster").addEventListener("click", function () { setMode("cluster"); });
    document.getElementById("wkf-by-country").addEventListener("click", function () { setMode("country"); });
    var panel = document.getElementById("wkf-panel");
    function field(label, text) { if (!text) return null; var f = el("div"); f.appendChild(el("b", null, label + ". ")); f.appendChild(document.createTextNode(text)); return f; }
    function sources(src) {
      var ul = el("ul");
      (Array.isArray(src) ? src : [src]).forEach(function (s) {
        var li = el("li"), m = String(s).match(/https?:\/\/[^\s)\]]+/);
        if (m) {
          var i = s.indexOf(m[0]); li.appendChild(document.createTextNode(s.slice(0, i)));
          var a = el("a", null, m[0]); a.href = m[0]; a.rel = "noopener"; li.appendChild(a);
          li.appendChild(document.createTextNode(s.slice(i + m[0].length)));
        } else li.textContent = s;
        ul.appendChild(li);
      });
      return ul;
    }
    function clearPick() {
      picked = null;
      nodeSel.classed("picked", false).classed("dim", false).classed("hide-label", function (d) { return d.deg < 6; });
      edgeSel.classed("dim", false).classed("lit", false).classed("picked", false);
      panel.innerHTML = ""; panel.appendChild(el("p", null, "Select an organization or a line. Drag to pan; scroll or pinch to zoom."));
    }
    function pickNode(d) {
      picked = { kind: "node", d: d };
      var nb = {}; nb[d.id] = 1;
      var mine = edges.filter(function (e) { return visible(e) && (e.from === d.id || e.to === d.id); });
      mine.forEach(function (e) { nb[e.from] = 1; nb[e.to] = 1; });
      nodeSel.classed("picked", function (n) { return n.id === d.id; }).classed("dim", function (n) { return !nb[n.id]; })
        .classed("hide-label", function (n) { return !(nb[n.id] || n.deg >= 6); });
      edgeSel.classed("picked", false).classed("lit", function (e) { return mine.indexOf(e) >= 0; }).classed("dim", function (e) { return mine.indexOf(e) < 0; });
      panel.innerHTML = "";
      panel.appendChild(el("span", "wkf-label", d.type + " · " + (d.country || "unknown")));
      panel.appendChild(el("h3", null, d.label));
      if (d.note) panel.appendChild(el("p", null, d.note));
      panel.appendChild(el("span", "wkf-label", mine.length + " relationship" + (mine.length === 1 ? "" : "s") + " shown"));
      mine.forEach(function (e) {
        var other = byId[e.from === d.id ? e.to : e.from], b = el("button", "wkf-edge-item"); b.type = "button";
        b.appendChild(el("b", null, (e.from === d.id ? "to " : "from ") + short(other.label)));
        b.appendChild(el("span", "wkf-pill st-" + e.sg, e.status));
        b.appendChild(el("span", "rel", e.relation.length > 150 ? e.relation.slice(0, 149) + "…" : e.relation));
        b.addEventListener("click", function () { pickEdge(e); });
        panel.appendChild(b);
      });
    }
    function pickEdge(e) {
      picked = { kind: "edge", d: e };
      nodeSel.classed("picked", function (n) { return n.id === e.from || n.id === e.to; }).classed("dim", function (n) { return n.id !== e.from && n.id !== e.to; })
        .classed("hide-label", function (n) { return !(n.id === e.from || n.id === e.to || n.deg >= 6); });
      edgeSel.classed("lit", false).classed("picked", function (x) { return x === e; }).classed("dim", function (x) { return x !== e; });
      panel.innerHTML = "";
      panel.appendChild(el("span", "wkf-label", (CL_NAME[e.cluster] || e.cluster) + " · as of " + (e.as_of || "unknown")));
      panel.appendChild(el("h3", null, byId[e.from].label + " → " + byId[e.to].label));
      panel.appendChild(el("span", "wkf-pill st-" + e.sg, e.status));
      [field("Evidence detail", e.status_detail), field("Relationship", e.relation), field("Who cannot see what", e.asymmetry), field("Where information meets a stake", e.conflict)]
        .forEach(function (f) { if (f) panel.appendChild(f); });
      panel.appendChild(el("b", null, "Sources"));
      panel.appendChild(sources(e.source));
    }
    layout(); render();
  }


  function ledgerTools() {
    var steps = Array.prototype.slice.call(document.querySelectorAll(".wkf-step"));
    var bar = document.getElementById("wkf-filters");
    if (!steps.length || !bar) return;
    bar.hidden = false;
    var fPhase = document.getElementById("wkf-f-phase"), fAssess = document.getElementById("wkf-f-assess"),
      fActor = document.getElementById("wkf-f-actor"), count = document.getElementById("wkf-f-count");
    var actors = {};
    steps.forEach(function (li) { actors[li.getAttribute("data-actor")] = 1; });
    Object.keys(actors).sort().forEach(function (a) { var o = el("option", null, a); o.value = a; fActor.appendChild(o); });
    function apply() {
      var ph = fPhase.value, as = fAssess.value, ac = fActor.value, active = ph || as || ac, shown = 0;
      steps.forEach(function (li) {
        var ok = (!ph || li.getAttribute("data-phase") === ph) && (!as || li.getAttribute("data-assess") === as) && (!ac || li.getAttribute("data-actor") === ac);
        li.hidden = !ok; if (ok) shown++;
      });
      document.querySelectorAll(".wkf-ledger").forEach(function (d) {
        var any = d.querySelector(".wkf-step:not([hidden])");
        d.hidden = !any;
        if (active && any) d.open = true;
      });
      count.textContent = active ? shown + " of " + steps.length + " decisions shown" : steps.length + " decisions";
    }
    [fPhase, fAssess, fActor].forEach(function (s) { s.addEventListener("change", apply); });
    document.getElementById("wkf-open-all").addEventListener("click", function () {
      var ls = document.querySelectorAll(".wkf-ledger"), open = !Array.prototype.every.call(ls, function (d) { return d.open; });
      ls.forEach(function (d) { d.open = open; });
      this.textContent = open ? "Close all ledgers" : "Open all ledgers";
    });
    apply();
    var drill = document.getElementById("wkf-drill");
    document.querySelectorAll(".wkf-cell").forEach(function (b) {
      b.addEventListener("click", function () {
        var actor = b.getAttribute("data-actor"), phase = b.getAttribute("data-phase");
        document.querySelectorAll(".wkf-cell[aria-pressed]").forEach(function (x) { x.removeAttribute("aria-pressed"); });
        b.setAttribute("aria-pressed", "true");
        var hits = steps.filter(function (li) { return li.getAttribute("data-actor") === actor && li.getAttribute("data-phase") === phase; });
        drill.innerHTML = ""; drill.hidden = false;
        drill.appendChild(el("h4", null, actor + " · " + phase.replace(/_/g, " ") + " · " + hits.length + " decision" + (hits.length === 1 ? "" : "s")));
        hits.forEach(function (li) {
          var item = el("div", "wkf-drill-item"), led = li.closest(".wkf-ledger");
          var name = led ? led.querySelector(".wkf-ledger-name").textContent : "";
          var a = el("a", null, name); a.href = "#" + (led ? led.id : "");
          a.addEventListener("click", function () { if (led) led.open = true; });
          item.appendChild(a);
          var body = li.querySelector(".wkf-what").cloneNode(true);
          body.querySelectorAll("details").forEach(function (d) { d.remove(); });
          item.appendChild(body);
          drill.appendChild(item);
        });
        drill.scrollIntoView({ block: "nearest" });
      });
    });
  }

  drawClock();
  drawMap();
  ledgerTools();
})();
