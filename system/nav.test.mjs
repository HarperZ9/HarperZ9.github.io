import { test } from "node:test";
import assert from "node:assert/strict";
import { navActive } from "./nav.js";

test("active section is derived from the path", () => {
  assert.equal(navActive("/"), "home");
  assert.equal(navActive("/index.html"), "home");
  assert.equal(navActive("/overview.html"), "flagships");
  assert.equal(navActive("/index-graph.html"), "flagships");
  assert.equal(navActive("/forum.html"), "flagships");
  assert.equal(navActive("/studio.html"), "flagships");
  assert.equal(navActive("/gather.html"), "flagships");
  assert.equal(navActive("/crucible.html"), "flagships");
  assert.equal(navActive("/catalog.html"), "catalog");
  assert.equal(navActive("/research.html"), "research");
  assert.equal(navActive("/writing.html"), "writing");
  assert.equal(navActive("/why.html"), "research");
  assert.equal(navActive("/cv.html"), "about");
  assert.equal(navActive("/resume.html"), "about");
  assert.equal(navActive("/person.html"), "about");
  assert.equal(navActive("/emet.html"), "catalog");
  assert.equal(navActive("/atelier.html"), "catalog");
  assert.equal(navActive("/gallery.html"), "catalog");
  assert.equal(navActive("/demonstrations.html"), "catalog");
});
