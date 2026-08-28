import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRouteHeader, navActive, renderNav } from "./nav.js";
import { PRIMARY_ROUTES, SECONDARY_GROUPS, routeFamily } from "./routes.js";
import { PRIMARY_ROUTES as NAV_PRIMARY_ROUTES } from "./routes.js?v=20260828-site-design";

test("generated registry provides the static navigation taxonomy", () => {
  assert.equal(routeFamily("/hire.html"), "Work");
  assert.equal(routeFamily("/security.html"), "Security");
  assert.equal(routeFamily("/buildlang.html"), "Security");
  assert.equal(routeFamily("/systems/relay.html"), "Systems");
  assert.equal(routeFamily("/systems/behavior-transform.html"), "Security");
  assert.equal(routeFamily("/briefings/2026-08-26-openai-hugging-face-incident/"), "Research");
  assert.ok(PRIMARY_ROUTES.length > 0);
  assert.ok(SECONDARY_GROUPS.length > 0);
});

test("active section is derived from the route registry", () => {
  assert.equal(navActive("/"), "");
  assert.equal(navActive("/hire.html"), "Work");
  assert.equal(navActive("/cv.html"), "Work");
  assert.equal(navActive("/overview.html"), "Systems");
  assert.equal(navActive("/demo-forum.html"), "Systems");
  assert.equal(navActive("/systems/relay.html"), "Systems");
  assert.equal(navActive("/security.html"), "Security");
  assert.equal(navActive("/behavior-transform.html"), "Security");
  assert.equal(navActive("/buildlang.html"), "Security");
  assert.equal(navActive("/research.html"), "Research");
  assert.equal(navActive("/models-propose-oracles-dispose.html"), "Research");
  assert.equal(navActive("/briefings/2026-08-26-openai-hugging-face-incident/"), "Research");
  assert.equal(navActive("/research-proof-carrying-research-loops.html"), "Research");
  assert.equal(navActive("/writing.html"), "Research");
  assert.equal(navActive("/studio.html"), "Studio");
  assert.equal(navActive("/gallery.html"), "Studio");
  assert.equal(navActive("/session-archive.html"), "Studio");
  assert.equal(navActive("/catalog"), "Security");
  assert.equal(navActive("/hire#engineering-path"), "Work");
  assert.equal(navActive("http://127.0.0.1:8765/retro"), "Studio");
});

function navFixture(pathname, search = "", hash = "") {
  const mount = {
    html: "",
    set innerHTML(value) { this.html = value; },
    get innerHTML() { return this.html; },
    querySelector() { return null; },
  };
  const doc = {
    location: { pathname, search, hash },
    getElementById(id) { return id === "site-nav" ? mount : null; },
  };
  return { doc, mount };
}

test("rendered nav keeps section state separate from exact-page state", () => {
  const { doc, mount } = navFixture("/resume.html");
  renderNav(doc);

  assert.match(mount.innerHTML, /<summary>Menu<\/summary>/);
  assert.match(mount.innerHTML, /class="sn-menu-group sn-menu-primary"/);
  assert.match(mount.innerHTML, /class="sn-menu-group sn-menu-secondary"/);
  assert.match(mount.innerHTML, /<p class="sn-menu-label">Systems<\/p>/);
  assert.match(mount.innerHTML, /<p class="sn-menu-label">Security<\/p>/);
  assert.match(mount.innerHTML, /<p class="sn-menu-label">Research<\/p>/);
  assert.match(mount.innerHTML, /href="resume\.html" aria-current="page"/);
  assert.doesNotMatch(mount.innerHTML, /href="hire\.html" aria-current="page"/);
  assert.match(mount.innerHTML, /class="is-active" href="hire\.html"/);
  assert.equal((mount.innerHTML.match(/aria-current="page"/g) || []).length, 1);
});

test("rendered nav gives one fragment destination the current-page state", () => {
  const { doc, mount } = navFixture("/hire.html", "", "#engineering-path");
  renderNav(doc);

  assert.match(mount.innerHTML, /href="hire\.html#engineering-path" aria-current="page"/);
  assert.doesNotMatch(mount.innerHTML, /href="hire\.html" aria-current="page"/);
  assert.equal((mount.innerHTML.match(/aria-current="page"/g) || []).length, 1);
});

test("rendered nav gives a duplicated primary route only one current-page state", () => {
  const { doc, mount } = navFixture("/hire.html");
  renderNav(doc);

  assert.equal((mount.innerHTML.match(/href="hire\.html" aria-current="page"/g) || []).length, 1);
  assert.equal((mount.innerHTML.match(/aria-current="page"/g) || []).length, 1);
});

test("rendered nav treats extensionless local preview routes as html pages", () => {
  const { doc, mount } = navFixture("/catalog");
  renderNav(doc);

  assert.match(mount.innerHTML, /href="catalog\.html" aria-current="page"/);
  assert.equal((mount.innerHTML.match(/aria-current="page"/g) || []).length, 1);
});

test("rendered nav does not emit mobile current-section metadata", () => {
  const { doc, mount } = navFixture("/catalog.html");
  renderNav(doc);

  assert.doesNotMatch(mount.innerHTML, /sn-section/);
  assert.doesNotMatch(mount.innerHTML, /Current section/);
  assert.equal((mount.innerHTML.match(/aria-current="page"/g) || []).length, 1);
});

test("rendered mobile menu retains every primary destination", () => {
  const { doc, mount } = navFixture("/hire.html");
  renderNav(doc);

  for (const href of ["studio.html", "gallery.html", "retro.html", "overview.html", "research.html", "hire.html"]) {
    assert.match(mount.innerHTML, new RegExp(`class="sn-menu-group sn-menu-primary"[\\s\\S]*href="${href}"`));
  }
});

test("rendered nav keeps local destinations rooted from nested pages", () => {
  const { doc, mount } = navFixture("/systems/relay.html");
  renderNav(doc);

  assert.match(mount.innerHTML, /href="\/index\.html"/);
  assert.match(mount.innerHTML, /href="\/overview\.html"/);
  assert.match(mount.innerHTML, /href="\/session-archive\.html"/);
  assert.doesNotMatch(mount.innerHTML, /href="(?:index|overview)\.html"/);
});

test("rendered nav treats route labels and hrefs as text and attribute data", () => {
  const { doc, mount } = navFixture("/hire.html");
  const route = NAV_PRIMARY_ROUTES[0];
  const original = { ...route };
  route.label = '<img data-nav-injected="label">';
  route.href = 'hire.html?next="><img data-nav-injected=href>';
  try {
    renderNav(doc);
    assert.doesNotMatch(mount.innerHTML, /<img[^>]+data-nav-injected/);
    assert.doesNotMatch(mount.innerHTML, /href="[^"]*"[^>]+data-nav-injected/);
    assert.match(mount.innerHTML, /&lt;img data-nav-injected=&quot;label&quot;&gt;/);
    assert.match(mount.innerHTML, /href="hire\.html\?next=&quot;&gt;&lt;img data-nav-injected=href&gt;"/);
  } finally {
    Object.assign(route, original);
  }
});

class FakeClassList {
  constructor(element) {
    this.element = element;
  }
  add(...names) {
    const set = new Set((this.element.className || "").split(/\s+/).filter(Boolean));
    for (const name of names) set.add(name);
    this.element.className = [...set].join(" ");
  }
  contains(name) {
    return (this.element.className || "").split(/\s+/).includes(name);
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.attributes = {};
    this.children = [];
    this.className = "";
    this.dataset = {};
    this.parentElement = null;
    this.textContent = "";
  }
  get nextElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.children;
    const index = siblings.indexOf(this);
    return index === -1 ? null : siblings[index + 1] || null;
  }
  get classList() {
    return new FakeClassList(this);
  }
  get firstChild() {
    return this.children[0] || null;
  }
  appendChild(child) {
    if (child.parentElement) child.parentElement.removeChild(child);
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  insertBefore(child, reference) {
    if (child.parentElement) child.parentElement.removeChild(child);
    child.parentElement = this;
    const index = this.children.indexOf(reference);
    if (index === -1) this.children.push(child);
    else this.children.splice(index, 0, child);
    return child;
  }
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parentElement = null;
    }
    return child;
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  getAttribute(name) {
    return this.attributes[name] ?? null;
  }
  matches(selector) {
    if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
    if (selector.startsWith("#")) return this.id === selector.slice(1);
    if (selector === "[data-route-header='mounted']") return this.dataset.routeHeader === "mounted";
    const attribute = selector.match(/^\[([^=]+)=['"]([^'"]+)['"]\]$/);
    if (attribute) return this.getAttribute(attribute[1]) === attribute[2];
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }
  closest(selectors) {
    const parts = selectors.split(",").map((part) => part.trim());
    let node = this;
    while (node) {
      if (parts.some((selector) => node.matches(selector))) return node;
      node = node.parentElement;
    }
    return null;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  querySelectorAll(selector) {
    const parts = selector.split(",").map((part) => part.trim());
    const matches = [];
    const visit = (node) => {
      if (parts.some((part) => node.matches(part))) matches.push(node);
      for (const child of node.children) visit(child);
    };
    for (const child of this.children) visit(child);
    return matches;
  }
}

function routeHeaderFixture(pathname = "/catalog.html") {
  const doc = {
    documentElement: { dataset: {} },
    location: { pathname, search: "", hash: "" },
    body: new FakeElement("body"),
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    getElementById(id) {
      return this.body.querySelector("#" + id);
    },
    querySelector(selector) {
      return this.body.querySelector(selector);
    },
    querySelectorAll(selector) {
      return this.body.querySelectorAll(selector);
    },
  };
  const main = new FakeElement("main");
  main.id = "main";
  const frame = new FakeElement("div");
  frame.className = "frame system-hero";
  const bar = new FakeElement("div");
  bar.className = "bar";
  const mid = new FakeElement("div");
  mid.className = "mid";
  const h1 = new FakeElement("h1");
  h1.textContent = "Systems, by capability.";
  const lede = new FakeElement("p");
  lede.className = "lede";
  lede.textContent = "31 public records with purpose, evidence, limitations, and authorization boundaries.";

  doc.body.appendChild(frame);
  doc.body.appendChild(main);
  frame.appendChild(bar);
  frame.appendChild(mid);
  mid.appendChild(h1);
  mid.appendChild(lede);
  return { doc, frame, h1, lede };
}

test("buildRouteHeader upgrades the existing opening block without cloning the h1", () => {
  const { doc, frame, h1, lede } = routeHeaderFixture();
  const header = buildRouteHeader(doc);

  assert.equal(header, frame);
  assert.ok(frame.classList.contains("route-header"));
  assert.equal(frame.dataset.routeHeader, "mounted");
  assert.ok(h1.classList.contains("route-header__title"));
  assert.ok(lede.classList.contains("route-header__summary"));
  assert.equal(doc.querySelectorAll("h1").length, 1);

  const path = frame.querySelector(".route-header__path");
  assert.equal(path.getAttribute("aria-label"), "Breadcrumb");
  assert.equal(path.children[0].textContent, "Zain Dana Harper");
  assert.equal(path.children[1].textContent, "Security");
  assert.equal(path.children[1].getAttribute("aria-current"), null);
  assert.doesNotMatch(path.textContent, /route artifact|eyebrow|overline|kicker|\//i);
});

test("renderNav and buildRouteHeader leave one combined aria-current page state", () => {
  const { doc, frame } = routeHeaderFixture("/catalog.html");
  const mount = new FakeElement("div");
  mount.id = "site-nav";
  doc.body.insertBefore(mount, frame);

  renderNav(doc);
  buildRouteHeader(doc);

  const navCurrent = (mount.innerHTML.match(/aria-current="page"/g) || []).length;
  const headerCurrent = doc.querySelectorAll('[aria-current="page"]').length;
  assert.equal(navCurrent + headerCurrent, 1);
});

function briefingIndexFixture() {
  const doc = {
    documentElement: { dataset: {} },
    location: {
      pathname: "/briefings/2026-08-26-openai-hugging-face-incident/",
      search: "",
      hash: "",
    },
    body: new FakeElement("body"),
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    getElementById(id) {
      return this.body.querySelector("#" + id);
    },
    querySelector(selector) {
      return this.body.querySelector(selector);
    },
    querySelectorAll(selector) {
      return this.body.querySelectorAll(selector);
    },
  };
  const main = new FakeElement("main");
  main.id = "main";
  const h1 = new FakeElement("h1");
  h1.textContent = "OpenAI and Hugging Face incident briefing";
  const lead = new FakeElement("p");
  lead.className = "lead";
  lead.textContent = "A public-source incident briefing.";
  const section = new FakeElement("section");
  section.id = "evidence";

  doc.body.appendChild(main);
  main.appendChild(h1);
  main.appendChild(lead);
  main.appendChild(section);
  return { doc, main, h1, lead, section };
}

test("buildRouteHeader wraps direct-main headings in a compact header only", () => {
  const { doc, main, h1, lead, section } = briefingIndexFixture();
  const header = buildRouteHeader(doc);

  assert.equal(header.tagName, "HEADER");
  assert.ok(header.classList.contains("route-header"));
  assert.equal(header.dataset.routeHeader, "mounted");
  assert.equal(doc.querySelectorAll("h1").length, 1);
  assert.equal(h1.parentElement, header);
  assert.equal(lead.parentElement, header);
  assert.equal(section.parentElement, main);
  assert.equal(main.children.length, 2);
  assert.equal(main.children[0], header);
  assert.equal(main.children[1], section);
});

test("buildRouteHeader is excluded from the React home shell", () => {
  const { doc } = routeHeaderFixture("/index.html");
  doc.documentElement.dataset.homeShell = "react";

  assert.equal(buildRouteHeader(doc), null);
});

test("buildRouteHeader handles document stubs without location and no global location", () => {
  const originalLocation = globalThis.location;
  const hadLocation = Object.hasOwn(globalThis, "location");
  try {
    Reflect.deleteProperty(globalThis, "location");
    const { doc } = routeHeaderFixture("/catalog.html");
    delete doc.location;

    assert.equal(buildRouteHeader(doc), null);
  } finally {
    if (hadLocation) globalThis.location = originalLocation;
    else Reflect.deleteProperty(globalThis, "location");
  }
});
