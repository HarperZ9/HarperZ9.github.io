import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeGalleryProject,
  encodeGalleryProject,
  MAX_GALLERY_PROJECT_BYTES,
} from "./gallery-project.js";

const png1x1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lUX0VwAAAABJRU5ErkJggg==";
const rules = {
  layers: ["showpiece-aperture", "aurora-leak", "plotter-plate"],
  effects: ["mosaic", "scanlines", "rgbShift"],
};

function project(overrides = {}) {
  return {
    recipe: { seed: "native-gallery", instruments: ["showpiece-aperture", "aurora-leak"] },
    locks: ["aurora-leak"],
    effects: ["mosaic", "scanlines"],
    strength: 0.7,
    baseImage: { name: "base.png", influence: 0.35, png: png1x1 },
    ...overrides,
  };
}

test("Gallery codec round-trips editable recipe, locks, ordered effects and base PNG", () => {
  const text = encodeGalleryProject(project(), rules);
  const json = JSON.parse(text);

  assert.equal(json.schema, "zentropy.gallery");
  assert.equal(json.version, 1);
  assert.deepEqual(json.project.recipe.instruments, ["showpiece-aperture", "aurora-leak"]);
  assert.deepEqual(json.project.locks, ["aurora-leak"]);
  assert.deepEqual(json.project.effects, ["mosaic", "scanlines"]);
  assert.equal(json.project.strength, 0.7);
  assert.equal(json.project.baseImage.png, png1x1);

  assert.deepEqual(decodeGalleryProject(text, rules).project, project());
});

test("Gallery codec accepts pure-engine projects without a base image", () => {
  const pure = project({ baseImage: null, locks: [], effects: [], strength: 0.6 });
  const reopened = decodeGalleryProject(encodeGalleryProject(pure, rules), rules);

  assert.deepEqual(reopened.project, pure);
});

test("Gallery codec rejects malformed schema, catalogs and duplicate ordered values", () => {
  const cases = [
    { schema: "zentropy.poster", version: 1, project: project() },
    { schema: "zentropy.gallery", version: 2, project: project() },
    { schema: "zentropy.gallery", version: 1, project: project({ recipe: { seed: "x", instruments: ["unknown-layer"] } }) },
    { schema: "zentropy.gallery", version: 1, project: project({ locks: ["plotter-plate"] }) },
    { schema: "zentropy.gallery", version: 1, project: project({ effects: ["mosaic", "unknown-effect"] }) },
    { schema: "zentropy.gallery", version: 1, project: project({ effects: ["mosaic", "mosaic"] }) },
    { schema: "zentropy.gallery", version: 1, project: project({ recipe: { seed: "x", instruments: ["aurora-leak", "aurora-leak"] } }) },
    { schema: "constructor", version: 1, project: project() },
  ];

  for (const record of cases) {
    assert.throws(() => decodeGalleryProject(JSON.stringify(record), rules), /Gallery project|current work/i);
  }
});

test("Gallery codec rejects missing instruments unless a base image is present", () => {
  assert.throws(
    () => encodeGalleryProject(project({ recipe: { seed: "blank", instruments: [] }, baseImage: null }), rules),
    /Gallery project|current work/i,
  );

  const materialOnly = project({ recipe: { seed: "blank", instruments: [] }, locks: [], baseImage: { name: "solo.png", influence: 0.5, png: png1x1 } });
  assert.deepEqual(decodeGalleryProject(encodeGalleryProject(materialOnly, rules), rules).project, materialOnly);
});

test("Gallery codec bounds file size and requires a valid PNG base image", () => {
  assert.throws(
    () => encodeGalleryProject(project({ baseImage: { name: "remote", influence: 0.5, png: "https://example.com/image.png" } }), rules),
    /Gallery project|current work/i,
  );
  assert.throws(
    () => decodeGalleryProject("x".repeat(MAX_GALLERY_PROJECT_BYTES + 1), rules),
    /Gallery project|current work/i,
  );
});
