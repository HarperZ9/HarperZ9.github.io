import { test } from "node:test";
import assert from "node:assert/strict";
import { navActive, renderNav } from "./nav.js";

test("active section is derived from the path", () => {
  assert.equal(navActive("/"), "home");
  assert.equal(navActive("/index.html"), "home");
  assert.equal(navActive("/overview.html"), "flagships");
  assert.equal(navActive("/index-graph.html"), "flagships");
  assert.equal(navActive("/forum.html"), "flagships");
  assert.equal(navActive("/studio.html"), "studio");
  assert.equal(navActive("/gather.html"), "flagships");
  assert.equal(navActive("/crucible.html"), "flagships");
  assert.equal(navActive("/catalog.html"), "catalog");
  assert.equal(navActive("/typeface.html"), "typeface");
  assert.equal(navActive("/demo-index.html"), "demos");
  assert.equal(navActive("/demonstrations.html"), "demos");
  assert.equal(navActive("/research.html"), "research");
  assert.equal(navActive("/research-proof-carrying-research-loops.html"), "research");
  assert.equal(navActive("/writing.html"), "writing");
  assert.equal(navActive("/the-summary-is-not-the-record.html"), "writing");
  assert.equal(navActive("/test-run-request.html"), "work");
  assert.equal(navActive("/why.html"), "research");
  assert.equal(navActive("/cv.html"), "about");
  assert.equal(navActive("/resume.html"), "work");
  assert.equal(navActive("/person.html"), "about");
  assert.equal(navActive("/cover-letter.html"), "work");
  assert.equal(navActive("/emet.html"), "catalog");
  assert.equal(navActive("/demo-emet.html"), "demos");
  assert.equal(navActive("/proof-surface-sample.html"), "demos");
  assert.equal(navActive("/quantalang.html"), "catalog");
  assert.equal(navActive("/atelier.html"), "catalog");
  assert.equal(navActive("/gallery.html"), "catalog");
});

test("rendered nav includes a complete grouped menu for mobile", () => {
  const mount = {
    html: "",
    set innerHTML(value) { this.html = value; },
    get innerHTML() { return this.html; },
    querySelector() { return null; },
  };
  const doc = {
    location: { pathname: "/resume.html" },
    getElementById(id) { return id === "site-nav" ? mount : null; },
  };

  renderNav(doc);

  assert.match(mount.innerHTML, /<summary[^>]*>Menu<\/summary>/);
  assert.match(mount.innerHTML, /class="sn-menu-group sn-menu-primary"/);
  assert.match(mount.innerHTML, /class="sn-menu-group sn-menu-secondary"/);
  assert.match(mount.innerHTML, /href="overview\.html"/);
  assert.match(mount.innerHTML, /href="demo-index\.html"/);
  assert.match(mount.innerHTML, /href="guide\.html"/);
  assert.match(mount.innerHTML, /href="writing\.html"/);
  assert.match(mount.innerHTML, /href="test-run-request\.html" aria-current="page"/);
});
