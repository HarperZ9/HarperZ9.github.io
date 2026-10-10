(function () {
  "use strict";
  // Data-driven scenes: each scene is a list of blocks rendered into its .kscene node.
  var EX = window.EX;
  var el = function () { return EX.el.apply(null, arguments); };
  var VCLS = { ok: "v-ok", drift: "v-drift", unv: "v-unv", ink: "" };
  function verdictNode(v) {
    var d = el("div", { class: "kverdict" });
    d.appendChild(el("span", { class: "v vbox " + (VCLS[v[1]] || "") }, v[0]));
    if (v[2]) d.appendChild(el("span", { class: "tag" }, "  " + v[2]));
    return d;
  }
  function render(root, blocks, reduce, t0) {
    var t = t0 || 0;
    var show = function (n, at) {
      if (reduce) { n.classList.add("on"); return; }
      EX.later(function () { n.classList.add("on"); }, at);
    };
    blocks.forEach(function (b) {
      if (b.pipe) {
        var p = el("div", { class: "pipe", style: "--n:" + b.pipe.stages.length, role: "list" });
        b.pipe.stages.forEach(function (s, i) {
          var cls = "st" + (i < b.pipe.active ? " done" : "") + (i === b.pipe.active ? " on" : "");
          var st = el("div", { class: cls, role: "listitem" });
          st.appendChild(el("span", { class: "n" }, String(i + 1).padStart(2, "0")));
          st.appendChild(document.createTextNode(s));
          if (i === b.pipe.active) st.setAttribute("aria-current", "step");
          p.appendChild(st);
        });
        root.appendChild(p);
        if (b.pipe.note) root.appendChild(el("div", { class: "pnote" }, b.pipe.note));
      } else if (b.io) {
        var io = el("div", { class: "io" });
        if (b.io.cmd) io.appendChild(el("div", { class: "c" }, "$ " + b.io.cmd));
        (b.io.lines || []).forEach(function (ln) {
          var line = Array.isArray(ln) ? ln : [ln, ""];
          var n = el("div", { class: "l " + (line[1] || "") }, line[0]);
          io.appendChild(n);
          t += 140; show(n, t);
        });
        root.appendChild(io);
        if (b.io.verdict) { var v = verdictNode(b.io.verdict); root.appendChild(v); t += 260; show(v, t); }
      } else if (b.verdict) {
        var vv = verdictNode(b.verdict); root.appendChild(vv); t += 200; show(vv, t);
      } else if (b.cap) {
        root.appendChild(el("div", { class: "kcap" }, b.cap));
      } else if (b.table) {
        var tb = el("table", { class: "ktable" });
        var th = el("thead"), hr = el("tr");
        b.table.head.forEach(function (h) { hr.appendChild(el("th", null, h)); });
        th.appendChild(hr); tb.appendChild(th);
        var body = el("tbody");
        b.table.rows.forEach(function (r) {
          var tr = el("tr");
          r.forEach(function (c) {
            var td = el("td");
            // colour stays on the summary verdict; a table cell carries the word in weight only
            if (Array.isArray(c)) td.appendChild(el("span", { class: "v" }, c[0]));
            else td.textContent = c;
            tr.appendChild(td);
          });
          body.appendChild(tr); t += 120; show(tr, t);
        });
        tb.appendChild(body); root.appendChild(tb);
      } else if (b.cases) {
        var wrapc = el("div");
        var pick = el("div", { class: "pick", role: "group", "aria-label": b.cases.label || "Choose a case" });
        var out = el("div", { class: "kscene" });
        var choose = function (k, rd) {
          EX.clear();
          while (out.firstChild) out.removeChild(out.firstChild);
          Array.prototype.forEach.call(pick.children, function (btn, j) { btn.setAttribute("aria-pressed", j === k ? "true" : "false"); });
          render(out, b.cases.items[k].blocks, rd, 0);
        };
        b.cases.items.forEach(function (it, k) {
          var btn = el("button", { type: "button", class: "btn", "aria-pressed": "false" }, it.label);
          btn.addEventListener("click", function () { choose(k, EX.reduced()); });
          pick.appendChild(btn);
        });
        wrapc.appendChild(pick); wrapc.appendChild(out); root.appendChild(wrapc);
        choose(b.cases.start || 0, reduce);
      }
    });
    return t;
  }
  var specs = window.KSCENES || {};
  Object.keys(specs).forEach(function (id) {
    EX.scenes[id] = function (state, reduce) {
      var root = document.querySelector('.scene[data-scene="' + id + '"] .kscene');
      while (root.firstChild) root.removeChild(root.firstChild);
      render(root, specs[id], reduce, 0);
    };
  });
})();
