/* home-scroll.js: scroll choreography for the Project Telos home.

   Two small jobs, both with IntersectionObserver so there is no scroll handler on
   the main thread:
     1. Reveal: fade and lift each .reveal element the first time it enters view.
     2. Section index: keep the .dex rail in sync with the section in view.

   No dependencies, no build step, no em-dashes. Degrades cleanly: if
   IntersectionObserver is missing, every .reveal is shown at once and the rail
   simply does not track. prefers-reduced-motion shows everything immediately. */
(function () {
  "use strict";

  var reduced = !!(window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // ---- enter moment: lift the loader once the page is ready (with a safety
  //      timeout so it can never trap the page). Reduced motion hides it via CSS.
  var loaderEl = document.querySelector(".loader");
  if (loaderEl && !reduced) {
    var dismiss = function () { loaderEl.classList.add("done"); };
    if (document.readyState === "complete") setTimeout(dismiss, 1150);
    else window.addEventListener("load", function () { setTimeout(dismiss, 1150); });
    setTimeout(dismiss, 2600); // safety: never trap
  }

  // ---- 0. hero canvas peak: full strength in the hero, eased back in the
  //         reading sections, so the sculpture is the climax and the content
  //         sits over a calmer field. rAF-throttled, passive. ----
  var canvas = document.getElementById("ribbon-canvas");
  var edge = document.querySelector(".edgemark");
  if (canvas || edge) {
    var ticking = false;
    function onScrollFx() {
      var h = Math.max(1, window.innerHeight);
      var y = window.pageYOffset || 0;
      if (canvas) {
        var t = Math.min(1, Math.max(0, (y - h * 0.45) / (h * 0.85)));
        canvas.style.opacity = (1 - t * 0.5).toFixed(3);
      }
      // gentle wordmark parallax: the foreground drifts against the object
      if (edge && !reduced) {
        edge.style.transform = "translateX(-50%) translateY(" + (Math.min(y, h) * 0.14).toFixed(1) + "px)";
      }
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScrollFx); }
    }, { passive: true });
    onScrollFx();
  }

  // ---- 1. reveal on enter ----
  var reveals = [].slice.call(document.querySelectorAll(".reveal"));
  if (reduced || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("in"); });
  } else {
    var rObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          rObs.unobserve(e.target);
        }
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });
    reveals.forEach(function (el) {
      // anything already marked .in (the hero, above the fold) is left as is
      if (!el.classList.contains("in")) rObs.observe(el);
    });
  }

  // ---- 2. section index sync ----
  var dexLinks = [].slice.call(document.querySelectorAll(".dex a[data-dex]"));
  if (dexLinks.length && "IntersectionObserver" in window) {
    var byId = {};
    dexLinks.forEach(function (a) { byId[a.getAttribute("data-dex")] = a; });

    function setActive(id) {
      dexLinks.forEach(function (a) {
        a.classList.toggle("active", a.getAttribute("data-dex") === id);
      });
    }

    var sObs = new IntersectionObserver(function (entries) {
      // pick the most-visible intersecting section
      var best = null;
      entries.forEach(function (e) {
        if (e.isIntersecting && (!best || e.intersectionRatio > best.intersectionRatio)) {
          best = e;
        }
      });
      if (best && best.target.id && byId[best.target.id]) setActive(best.target.id);
    }, { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.01, 0.2, 0.5] });

    ["top", "engines", "range", "work", "floor"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) sObs.observe(el);
    });

    // fade the rail out once the footer takes the stage, so the fixed rail never
    // collides with the left-aligned footer content.
    var dex = document.querySelector(".dex");
    var foot = document.querySelector(".site-foot");
    if (dex && foot) {
      var fObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          dex.classList.toggle("hide", e.isIntersecting && e.intersectionRatio > 0.12);
        });
      }, { threshold: [0, 0.12, 0.3] });
      fObs.observe(foot);
    }
  }
})();
