(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");
  var rm = window.matchMedia("(prefers-reduced-motion: reduce)");
  var EX = window.EX = window.EX || {};
  EX.scenes = EX.scenes || {};
  EX.reduced = function () { return rm.matches; };
  // A timer set that one call can cancel, so a scene that loses the stage stops moving.
  var timers = [];
  EX.later = function (fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; };
  EX.clear = function () { timers.forEach(clearTimeout); timers = []; };
  EX.el = function (tag, attrs, text) {
    var svg = /^(svg|g|rect|circle|line|path|text|polyline|polygon|tspan|defs|pattern)$/.test(tag);
    var n = svg ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  };

  // Theme: follows the system unless the reader picks one.
  var tbtn = document.querySelector("[data-theme-toggle]");
  if (tbtn) {
    var saved = null;
    try { saved = localStorage.getItem("ex-theme"); } catch (e) { saved = null; }
    if (saved) root.setAttribute("data-theme", saved);
    var label = function () {
      var dark = root.getAttribute("data-theme") ? root.getAttribute("data-theme") === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
      tbtn.textContent = dark ? "Light page" : "Dark page";
      return dark;
    };
    label();
    tbtn.addEventListener("click", function () {
      var next = label() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("ex-theme", next); } catch (e) { /* storage blocked: the choice lasts this visit */ }
      label();
    });
  }

  // Copy buttons on command blocks.
  Array.prototype.forEach.call(document.querySelectorAll("pre.cmd"), function (pre) {
    var b = EX.el("button", { type: "button", class: "btn copy" }, "Copy");
    b.addEventListener("click", function () {
      // Only the lines a reader types (they start with "$ ") go to the clipboard.
      var all = pre.querySelector("code").innerText;
      var lines = all.split("\n").filter(function (l) { return l.indexOf("$ ") === 0; })
        .map(function (l) { return l.slice(2); });
      var payload = lines.length ? lines.join("\n") : all;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(payload).then(function () { b.textContent = "Copied"; },
          function () { b.textContent = "Select and copy"; });
      } else { b.textContent = "Select and copy"; }
      setTimeout(function () { b.textContent = "Copy"; }, 1800);
    });
    pre.appendChild(b);
  });

  // The walk: a scroll position picks the active step, the step picks the scene.
  function init() {
    var walk = document.querySelector(".walk");
    if (!walk) return;
    var steps = Array.prototype.slice.call(walk.querySelectorAll(".step"));
    var scenes = Array.prototype.slice.call(walk.querySelectorAll(".scene"));
    var wrap = walk.querySelector(".stage-wrap");
    var prev = walk.querySelector("[data-prev]");
    var next = walk.querySelector("[data-next]");
    var count = walk.querySelector("[data-count]");
    var cap = walk.querySelector("[data-cap]");
    var cur = -1;

    function activate(i) {
      if (i === cur) return;
      cur = i;
      EX.clear();
      steps.forEach(function (s, k) { s.classList.toggle("is-active", k === i); });
      var s = steps[i];
      var name = s.getAttribute("data-scene");
      scenes.forEach(function (sc) {
        var on = sc.getAttribute("data-scene") === name;
        sc.classList.toggle("is-on", on);
        sc.setAttribute("aria-hidden", on ? "false" : "true");
        if (on) sc.removeAttribute("inert"); else sc.setAttribute("inert", "");
      });
      count.textContent = "Step " + (i + 1) + " of " + steps.length;
      cap.textContent = s.querySelector("h3").textContent;
      prev.disabled = i === 0;
      next.disabled = i === steps.length - 1;
      var fn = EX.scenes[name];
      if (fn) {
        try { fn(s.getAttribute("data-state"), rm.matches); }
        catch (err) { console.error("explainer scene failed", name, s.getAttribute("data-state"), err); }
      }
    }
    function line() {
      if (window.innerWidth < 860) {
        // The stage sticks to the top on narrow screens, so measure it as stuck.
        var h = wrap.offsetHeight;
        return h + (window.innerHeight - h) * 0.35;
      }
      return window.innerHeight * 0.5;
    }
    var lockUntil = 0;
    function pick() {
      if (Date.now() < lockUntil) return;
      var t = line(), idx = 0;
      steps.forEach(function (s, k) { if (s.getBoundingClientRect().top < t) idx = k; });
      activate(idx);
    }
    var queued = false;
    window.addEventListener("scroll", function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; pick(); });
    }, { passive: true });
    window.addEventListener("resize", function () { var c = cur; cur = -1; activate(c < 0 ? 0 : c); });
    function go(k) {
      if (k < 0 || k >= steps.length) return;
      var s = steps[k];
      var y = window.scrollY + s.getBoundingClientRect().top - line() + 12;
      // Hold the chosen step while the smooth scroll passes the steps between.
      lockUntil = Date.now() + (rm.matches ? 0 : 2500);
      window.scrollTo({ top: y, behavior: rm.matches ? "auto" : "smooth" });
      activate(k);
      s.focus({ preventScroll: true });
    }
    window.addEventListener("scrollend", function () { if (lockUntil) { lockUntil = 0; pick(); } });
    prev.addEventListener("click", function () { go(cur - 1); });
    next.addEventListener("click", function () { go(cur + 1); });
    EX.replay = function () { var c = cur; cur = -1; activate(c); };
    pick();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
