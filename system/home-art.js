import { mountGenerativeField } from "./generative-field.js";

function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}

function setHtml(el, html) {
  if (el && el.innerHTML !== html) el.innerHTML = html;
}

function setAttr(el, name, value) {
  if (el && el.getAttribute(name) !== value) el.setAttribute(name, value);
}

function wireDetailsMenu(doc, details, summary, listSelector, abortKey) {
  if (!details || !summary || details.dataset.enhanced === "true") return;

  details.dataset.enhanced = "true";
  summary.setAttribute("aria-expanded", String(details.open));

  if (doc[abortKey]) doc[abortKey].abort();
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const opts = controller ? { signal: controller.signal } : undefined;
  if (controller) doc[abortKey] = controller;

  const close = (returnFocus = false) => {
    if (!details.open) return;
    details.open = false;
    summary.setAttribute("aria-expanded", "false");
    if (returnFocus && typeof summary.focus === "function") summary.focus();
  };

  details.addEventListener("toggle", () => {
    summary.setAttribute("aria-expanded", String(details.open));
  }, opts);

  details.querySelectorAll(`${listSelector} a`).forEach((link) => {
    link.addEventListener("click", () => close(false), opts);
  });

  doc.addEventListener("click", (event) => {
    if (details.open && !details.contains(event.target)) close(false);
  }, opts);
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    }
  }, opts);
}

function upgradeHomeMenu(doc) {
  const nav = doc.querySelector(".topnav");
  if (!nav || nav.querySelector(".home-menu")) return;

  const sourceLinks = [...nav.querySelectorAll(".topnav-links a")];
  if (!sourceLinks.length) return;

  const details = doc.createElement("details");
  details.className = "home-menu";

  const summary = doc.createElement("summary");
  summary.textContent = "Menu";
  summary.setAttribute("aria-label", "Open site menu");
  details.appendChild(summary);

  const list = doc.createElement("div");
  list.className = "home-menu-list";
  list.setAttribute("aria-label", "Site sections");
  sourceLinks.forEach((link) => {
    const clone = link.cloneNode(true);
    clone.removeAttribute("class");
    list.appendChild(clone);
  });
  details.appendChild(list);
  nav.appendChild(details);

  wireDetailsMenu(doc, details, summary, ".home-menu-list", "__homeMenuAbort");
}

function motionIsReduced() {
  return !!(window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function setConsoleMeter(consoleEl, key, value) {
  const meter = consoleEl.querySelector(`[data-home-meter="${key}"]`);
  const bar = consoleEl.querySelector(`[data-home-bar="${key}"]`);
  const pct = Math.max(0, Math.min(1, value));
  if (meter) setText(meter, pct.toFixed(2));
  if (bar) bar.style.setProperty("--meter", pct.toFixed(3));
}

function wireEngineConsole(doc, consoleEl) {
  if (!consoleEl || consoleEl.dataset.enhanced === "true") return;
  consoleEl.dataset.enhanced = "true";

  if (doc.__homeConsoleAbort) doc.__homeConsoleAbort.abort();
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const opts = controller ? { signal: controller.signal } : undefined;
  if (controller) doc.__homeConsoleAbort = controller;

  const modeButtons = [...consoleEl.querySelectorAll("[data-engine-mode-button]")];
  const status = consoleEl.querySelector("[data-home-console-status]");
  const pointer = consoleEl.querySelector("[data-home-pointer]");
  const stage = consoleEl.querySelector("[data-home-console-stage]");

  const setMode = (mode) => {
    doc.body.dataset.homeEngineMode = mode;
    modeButtons.forEach((button) => {
      const active = button.dataset.engineModeButton === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (status) setText(status, `${mode} renderer`);
  };

  modeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.classList.contains("is-active")));
    button.addEventListener("click", () => setMode(button.dataset.engineModeButton || "fluid"), opts);
  });

  if (stage) {
    const updatePointer = (event) => {
      const rect = stage.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
      stage.style.setProperty("--px", `${(x * 100).toFixed(1)}%`);
      stage.style.setProperty("--py", `${(y * 100).toFixed(1)}%`);
      if (pointer) setText(pointer, `${Math.round(x * 100)}:${Math.round(y * 100)}`);
    };
    stage.addEventListener("pointermove", updatePointer, opts);
    stage.addEventListener("pointerdown", updatePointer, opts);
  }

  let raf = 0;
  let last = 0;
  const update = (tick = performance.now()) => {
    if (!doc.body.contains(consoleEl)) return;
    if (tick - last > 160) {
      last = tick;
      const t = tick * 0.001;
      setConsoleMeter(consoleEl, "field", 0.58 + Math.sin(t * 0.86) * 0.22);
      setConsoleMeter(consoleEl, "dither", 0.50 + Math.cos(t * 0.63 + 1.4) * 0.24);
      setConsoleMeter(consoleEl, "motion", 0.46 + Math.sin(t * 1.18 + 2.1) * 0.28);
    }
    if (!motionIsReduced()) raf = window.requestAnimationFrame(update);
  };

  update();
  if (controller) {
    controller.signal.addEventListener("abort", () => {
      if (raf) window.cancelAnimationFrame(raf);
    }, { once: true });
  }
}

function ensureEngineConsole(doc) {
  const hero = doc.querySelector(".hero");
  const anchor = hero && hero.querySelector(".hero-inner");
  if (!hero || !anchor) return;

  let consoleEl = hero.querySelector(".home-engine-console");
  const placeConsole = () => {
    const cta = anchor.querySelector(".cta");
    if (cta) anchor.insertBefore(consoleEl, cta);
    else anchor.appendChild(consoleEl);
  };

  if (!consoleEl) {
    consoleEl = doc.createElement("aside");
    consoleEl.className = "home-engine-console reveal in d3";
    consoleEl.setAttribute("aria-label", "Live renderer console");
    consoleEl.innerHTML = `
      <div class="home-console-head">
        <span class="home-console-title">Renderer console</span>
        <span class="home-console-status" data-home-console-status>fluid renderer</span>
      </div>
      <div class="home-console-stage" data-home-console-stage>
        <span class="home-console-orbit" aria-hidden="true"></span>
        <span class="home-console-crosshair" aria-hidden="true"></span>
        <span class="home-console-pointer">pointer <b data-home-pointer>50:50</b></span>
      </div>
      <div class="home-engine-modules" aria-label="Renderer modules">
        <article class="home-engine-module" data-module="field">
          <div class="home-module-top"><span>field</span><output data-home-meter="field" aria-live="off">0.58</output></div>
          <div class="home-module-meter" aria-hidden="true"><i data-home-bar="field"></i></div>
          <p>metaballs, contours, pointer wakes</p>
        </article>
        <article class="home-engine-module" data-module="dither">
          <div class="home-module-top"><span>dither</span><output data-home-meter="dither" aria-live="off">0.50</output></div>
          <div class="home-module-meter" aria-hidden="true"><i data-home-bar="dither"></i></div>
          <p>ASCII marks and posterized sampling</p>
        </article>
        <article class="home-engine-module" data-module="motion">
          <div class="home-module-top"><span>motion</span><output data-home-meter="motion" aria-live="off">0.46</output></div>
          <div class="home-module-meter" aria-hidden="true"><i data-home-bar="motion"></i></div>
          <p>flow traces and wake response</p>
        </article>
      </div>
      <div class="home-console-actions" role="group" aria-label="Renderer modes">
        <button type="button" class="is-active" data-engine-mode-button="fluid">Fluid</button>
        <button type="button" data-engine-mode-button="dither">Dither</button>
        <button type="button" data-engine-mode-button="ascii">ASCII</button>
        <a href="studio.html?source=showcase">Open Studio</a>
      </div>`;
    placeConsole();
  } else if (consoleEl.parentElement !== anchor) {
    placeConsole();
  }

  wireEngineConsole(doc, consoleEl);
}

function normalizeHomeFormFields(doc) {
  doc.querySelectorAll("input, select, textarea").forEach((field, index) => {
    if (field.dataset.homeFieldNormalized === "true") return;
    const base = `home-field-${index + 1}`;
    const label = field.closest("label");
    const labelText = label ? label.textContent.trim().replace(/\s+/g, " ") : "";
    const fallback = field.getAttribute("aria-label") || field.getAttribute("placeholder") || labelText || base;
    if (!field.id) field.id = base;
    if (!field.name) field.name = base;
    if (!field.getAttribute("aria-label")) field.setAttribute("aria-label", fallback.slice(0, 96));
    field.dataset.homeFieldNormalized = "true";
  });
}

function repairHeroReadout(readout) {
  if (!readout) return;
  const label = readout.querySelector(".ro-label");
  const verdicts = readout.querySelector(".ro-verdicts");
  const nextMoves = [
    ["run a live demo", "#demonstrate"],
    ["inspect an engine", "#engines"],
    ["read a paper", "#research"],
    ["start a work thread", "#work"],
  ];

  setText(label, "Common first moves");
  setHtml(verdicts, nextMoves.map(([text, href], index) => (
    `<a class="ro-chip ro-route ro-${index}" href="${href}">${text}</a>`
  )).join(""));
  setAttr(readout, "aria-label", "Common first moves through Project Telos");
}

function removeResearchLaneReadout(doc) {
  const laneReadout = doc.querySelector('.readout[aria-label="public lanes"]');
  if (laneReadout) laneReadout.remove();
}

function repairSectionKickers(doc) {
  const replacements = new Map([
    ["ENGINE ROOM", "Engine room"],
    ["LIVE DEMOS", "Live demos"],
    ["WHERE TO ENTER", "Where to enter"],
    ["RESEARCH", "Research"],
    ["THE RANGE", "Range"],
    ["WORK WITH ME", "Work with me"],
  ]);

  doc.querySelectorAll(".sec-head .kicker, .work-head .kicker").forEach((kicker) => {
    const text = kicker.textContent.trim();
    if (replacements.has(text)) setText(kicker, replacements.get(text));
  });
}

function repairHeroCopy(doc) {
  const kicker = doc.querySelector(".hero .kicker");
  const title = doc.querySelector(".hero-title");
  const lead = doc.querySelector(".hero .lead");
  const readout = doc.querySelector(".hero .readout");
  const note = doc.querySelector(".hero-note");

  setText(kicker, "Zain Dana Harper / Project Telos");

  setHtml(title, "Tools for local AI,<br>codebases,<br><span class=\"hl\">graphics, and research.</span>");

  setHtml(lead, "Project Telos is my public workshop: local-model workflows, codebase maps, compiler tools, graphics systems, generated media, and research infrastructure. <b>Open a demo, inspect an engine, or start a project.</b>");

  repairHeroReadout(readout);
  removeResearchLaneReadout(doc);
  repairSectionKickers(doc);
  upgradeHomeMenu(doc);
  ensureEngineConsole(doc);
  normalizeHomeFormFields(doc);

  setText(note, "The field is live, but the text comes first. Motion reduces automatically when requested.");
}

function keepHeroCopySettled(doc) {
  repairHeroCopy(doc);
  [80, 240, 700, 1600].forEach((delay) => {
    window.setTimeout(() => repairHeroCopy(doc), delay);
  });

  const root = doc.getElementById("root");
  if (!root || typeof MutationObserver === "undefined") return;
  const observer = new MutationObserver(() => repairHeroCopy(doc));
  observer.observe(root, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 3000);
}

function placeFieldInHero(doc) {
  const hero = doc.querySelector(".hero");
  const scene = doc.getElementById("gl");
  const motes = doc.getElementById("motes");
  if (!hero || !scene || scene.closest(".hero")) return;

  const anchor = hero.querySelector(".hero-glow") || hero.firstChild;
  scene.classList.add("home-fluid-canvas");
  hero.insertBefore(scene, anchor);
  if (motes) {
    motes.classList.add("home-fluid-motes");
    hero.insertBefore(motes, anchor);
  }
}

function bootHomeArt() {
  if (!document.body) return;
  document.body.classList.add("home-generative-field");
  document.documentElement.classList.add("home-generative-field-ready");
  keepHeroCopySettled(document);
  mountGenerativeField(document).catch(() => {
    document.documentElement.classList.add("generative-field-failed");
  }).then(() => {
    keepHeroCopySettled(document);
    placeFieldInHero(document);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootHomeArt, { once: true });
} else {
  bootHomeArt();
}
