import { test } from "node:test";
import assert from "node:assert/strict";
import { routeFile } from "./studio-dnd.js";

test("a dropped file goes to the tool that reads it", () => {
  assert.equal(routeFile("photo.JPG", "image/jpeg"), "byo");
  assert.equal(routeFile("clip.webm", ""), "byo");
  assert.equal(routeFile("song.mp3", "audio/mpeg"), "byo");
  assert.equal(routeFile("model.glb", ""), "byo");
  assert.equal(routeFile("draft.wif", "text/plain"), "loom");
  assert.equal(routeFile("work.studio.json", "application/json"), "project");
  assert.equal(routeFile("notes.docx", "application/vnd.openxmlformats"), null);
});
