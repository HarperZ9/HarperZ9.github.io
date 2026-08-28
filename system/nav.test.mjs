import { test } from "node:test";
import assert from "node:assert/strict";
import { navActive, renderNav } from "./nav.js";
import { PRIMARY_ROUTES, SECONDARY_GROUPS, routeFamily } from "./routes.js";
import { PRIMARY_ROUTES as NAV_PRIMARY_ROUTES } from "./routes.js?v=20260827-capability-publication";

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
