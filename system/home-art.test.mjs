import { test } from "node:test";
import assert from "node:assert/strict";

function element(tagName) {
  return {
    tagName,
    className: "",
    textContent: "",
    children: [],
    attributes: new Map(),
    dataset: {},
    open: false,
    appendChild(child) { this.children.push(child); return child; },
    addEventListener() {},
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    removeAttribute(name) { this.attributes.delete(name); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    contains() { return false; },
    cloneNode() {
      const clone = element(this.tagName);
      clone.className = this.className;
      clone.textContent = this.textContent;
      clone.href = this.href;
      return clone;
    },
  };
}

test("home enhancement loads and builds its menu from generated route groups", async () => {
  const nav = element("nav");
  const sourceLinks = ["The Studio", "Hire / work", "GitHub ↗"].map((label) => {
    const link = element("a");
    link.textContent = label;
    link.href = `${label}.html`;
    return link;
  });
  nav.querySelectorAll = (selector) => selector === ".topnav-links a" ? sourceLinks : [];

  const doc = {
    body: { dataset: {} },
    documentElement: { dataset: {} },
    readyState: "complete",
    querySelector(selector) { return selector === ".topnav" ? nav : null; },
    querySelectorAll() { return []; },
    createElement: element,
    addEventListener() {},
    getElementById() { return null; },
  };
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = doc;
  globalThis.window = { setTimeout() {} };
  try {
    await import(`./home-art.js?test=${Date.now()}`);
    const details = nav.children.find((child) => child.className === "home-menu");
    assert.ok(details);
    const menu = details.children.find((child) => child.className === "home-menu-list");
    const labels = menu.children.filter((child) => child.className === "home-menu-label").map((child) => child.textContent);
    assert.deepEqual(labels, ["Work", "Systems", "Security", "Research", "Studio"]);
    assert.ok(menu.children.some((child) => child.textContent === "Dossier" && child.href === "dossier.html"));
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("home enhancement reuses the React mobile menu instead of adding a duplicate", async () => {
  const nav = element("nav");
  const details = element("details");
  details.className = "mobile-menu";
  const summary = element("summary");
  summary.textContent = "Menu";
  const list = element("div");
  list.className = "mobile-menu-list";
  details.appendChild(summary);
  details.appendChild(list);
  details.querySelector = (selector) => {
    if (selector === "summary") return summary;
    if (selector === ".mobile-menu-list") return list;
    return null;
  };
  details.querySelectorAll = () => [];
  nav.querySelector = (selector) => selector === ".mobile-menu" ? details : null;
  nav.querySelectorAll = () => [];

  const doc = {
    body: { dataset: {} },
    documentElement: { dataset: {} },
    readyState: "complete",
    querySelector(selector) { return selector === ".topnav" ? nav : null; },
    querySelectorAll() { return []; },
    createElement: element,
    addEventListener() {},
    getElementById() { return null; },
  };
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = doc;
  globalThis.window = { setTimeout() {} };
  try {
    await import(`./home-art.js?reuse-test=${Date.now()}`);
    assert.equal(nav.children.length, 0, "the enhancer must not append another menu");
    assert.equal(details.dataset.enhanced, "true");
    assert.equal(summary.getAttribute("aria-expanded"), "false");
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});
