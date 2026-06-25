import { test } from "node:test";
import assert from "node:assert/strict";
import { navActive } from "./nav.js";

test("active section is derived from the path", () => {
  assert.equal(navActive("/catalog.html"), "home");   // catalog is the home page
  assert.equal(navActive("/index.html"), "work");     // index is a flagship; the root serves it
  assert.equal(navActive("/"), "work");
  assert.equal(navActive("/forum.html"), "work");     // forum is a flagship
  assert.equal(navActive("/studio.html"), "studio");
  assert.equal(navActive("/overview.html"), "work");
  assert.equal(navActive("/research.html"), "research");
  assert.equal(navActive("/writing.html"), "research");   // writing groups under Research
  assert.equal(navActive("/why.html"), "research");
  assert.equal(navActive("/cv.html"), "about");
  assert.equal(navActive("/resume.html"), "about");
  assert.equal(navActive("/person.html"), "about");
  assert.equal(navActive("/emet.html"), "work");          // organ pages group under The Work
  assert.equal(navActive("/atelier.html"), "studio");     // legacy → Studio
  assert.equal(navActive("/gallery.html"), "studio");
  assert.equal(navActive("/demonstrations.html"), "studio");
});
