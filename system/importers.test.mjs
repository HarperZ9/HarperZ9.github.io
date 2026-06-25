/**
 * system/importers.test.mjs
 *
 * Node-safe contract tests for system/importers.js.
 * Runtime: node --test (node:test + node:assert/strict only).
 * Zero external dependencies.
 *
 * Browser-only paths (importImage, importVideo, importSVG, importOBJ canvas draw,
 * importGLTF canvas draw, importPLY canvas draw, importAudio, importData canvas draw)
 * are skipped with explicit one-line reasons -- FileReader, createImageBitmap,
 * Image, document.createElement, Blob, URL.createObjectURL, and AudioContext are
 * all absent in Node.
 *
 * What IS covered node-safely:
 *   - register() participates in dispatch
 *   - Matcher dispatch: function matcher, array-of-extensions matcher, array-of-MIME-prefix matcher
 *   - Dispatch precedence: last-registered wins
 *   - importFile unknown-type honest path: shape, drewToCanvas===false, pluginPoint, no mesh
 *   - importFile error-return path: handler throws -> kind==="error", drewToCanvas===false
 *   - ext() edge cases (no extension, multiple dots, uppercase)
 *   - register() rejects invalid matcher type
 *   - _selftest() export runs and reports passed/total
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  StudioImporters,
  _selftest,
  importReceipt,
  hashBytes,
  fnv1a,
  HASH_SHA256,
  HASH_FNV1A,
} from "./importers.js";

// ---------------------------------------------------------------------------
// Minimal duck-typed File-like stub.
// importFile only reads .name, .size, .type from the file object itself.
// ---------------------------------------------------------------------------
function fakeFile(name, type = "", size = 0) {
  return { name, type, size };
}

// ---------------------------------------------------------------------------
// register() and dispatch
// ---------------------------------------------------------------------------
describe("StudioImporters.register()", () => {
  it("should add a function matcher that participates in dispatch", async () => {
    const received = [];
    StudioImporters.register(
      f => f.name.endsWith(".xtest-fn"),
      async (file) => {
        received.push(file.name);
        return { kind: "xtest-fn", meta: { name: file.name, size: file.size }, mesh: null, drewToCanvas: true, pluginPoint: null };
      }
    );

    const result = await StudioImporters.importFile(fakeFile("sample.xtest-fn", "application/octet-stream", 42), null);

    assert.equal(result.kind, "xtest-fn", "dispatch should invoke the registered function matcher");
    assert.deepEqual(received, ["sample.xtest-fn"], "importFn should have been called with the file");
  });

  it("should add an array-of-extensions matcher that matches by filename suffix", async () => {
    StudioImporters.register(
      [".xtest-ext", ".xtest-ext2"],
      async (file) => ({ kind: "xtest-ext", meta: { name: file.name, size: file.size }, mesh: null, drewToCanvas: true, pluginPoint: null })
    );

    const result1 = await StudioImporters.importFile(fakeFile("data.xtest-ext"), null);
    const result2 = await StudioImporters.importFile(fakeFile("data.xtest-ext2"), null);

    assert.equal(result1.kind, "xtest-ext", ".xtest-ext suffix should match");
    assert.equal(result2.kind, "xtest-ext", ".xtest-ext2 suffix should match");
  });

  it("should add an array-of-MIME-prefix matcher that matches by file.type prefix", async () => {
    StudioImporters.register(
      ["x-custom/"],
      async (file) => ({ kind: "xtest-mime", meta: { name: file.name, size: file.size }, mesh: null, drewToCanvas: true, pluginPoint: null })
    );

    const result = await StudioImporters.importFile(fakeFile("blob.bin", "x-custom/myformat", 100), null);

    assert.equal(result.kind, "xtest-mime", "MIME prefix x-custom/ should match file.type starting with it");
  });

  it("should give the last-registered matching handler highest precedence", async () => {
    // Register two matchers for the same extension; the second must win.
    StudioImporters.register(
      f => f.name.endsWith(".xtest-prec"),
      async () => ({ kind: "first", meta: {}, mesh: null, drewToCanvas: true, pluginPoint: null })
    );
    StudioImporters.register(
      f => f.name.endsWith(".xtest-prec"),
      async () => ({ kind: "second", meta: {}, mesh: null, drewToCanvas: true, pluginPoint: null })
    );

    const result = await StudioImporters.importFile(fakeFile("thing.xtest-prec"), null);

    assert.equal(result.kind, "second", "last-registered matcher must win over an earlier one");
  });

  it("should throw TypeError when matcher is neither a function nor an array", () => {
    assert.throws(
      () => StudioImporters.register("*.obj", async () => {}),
      TypeError,
      "a string matcher should throw TypeError, not silently accept"
    );
    assert.throws(
      () => StudioImporters.register(42, async () => {}),
      TypeError,
      "a numeric matcher should throw TypeError"
    );
    assert.throws(
      () => StudioImporters.register(null, async () => {}),
      TypeError,
      "a null matcher should throw TypeError"
    );
  });
});

// ---------------------------------------------------------------------------
// importFile unknown-type honest path
// This is the load-bearing honesty guarantee: no faked mesh, no fake draw.
// ---------------------------------------------------------------------------
describe("importFile() unknown-type honest path", () => {
  it("should return kind=unknown for a file with no registered matcher", async () => {
    const file = fakeFile("mystery.xyzzy-unknown-type", "application/xyzzy-unknown", 99);
    const result = await StudioImporters.importFile(file, null);

    assert.equal(result.kind, "unknown", "kind must be 'unknown' for unrecognised file");
  });

  it("should set drewToCanvas=false on the unknown path", async () => {
    const result = await StudioImporters.importFile(fakeFile("file.xyzzy-unknown2"), null);

    assert.equal(result.drewToCanvas, false, "must not claim to have drawn to canvas for an unknown type");
  });

  it("should include a non-empty pluginPoint string describing how to extend the registry", async () => {
    const result = await StudioImporters.importFile(fakeFile("file.xyzzy-unknown3"), null);

    assert.equal(typeof result.pluginPoint, "string", "pluginPoint must be a string on the unknown path");
    assert.ok(result.pluginPoint.length > 0, "pluginPoint must not be an empty string");
    // The actual string tells callers how to register; verify it mentions register.
    assert.ok(
      result.pluginPoint.toLowerCase().includes("register"),
      "pluginPoint should mention 'register' so a caller knows how to extend"
    );
  });

  it("should include honest meta reflecting actual file properties", async () => {
    const file = fakeFile("report.xyzzy-unknown4", "application/xyzzy", 512);
    const result = await StudioImporters.importFile(file, null);

    assert.equal(result.meta.name, "report.xyzzy-unknown4", "meta.name must match file.name");
    assert.equal(result.meta.size, 512, "meta.size must match file.size");
    assert.equal(result.meta.type, "application/xyzzy", "meta.type must match file.type");
    assert.equal(result.meta.ext, "xyzzy-unknown4", "meta.ext must be the extracted extension");
  });

  it("should set mesh=null on the unknown path -- no fabricated geometry", async () => {
    const result = await StudioImporters.importFile(fakeFile("solid.xyzzy-unknown5"), null);

    assert.equal(result.mesh, null, "mesh must be null on the unknown path; a fabricated mesh would be dishonest");
  });

  it("should return the complete required result shape on the unknown path", async () => {
    const result = await StudioImporters.importFile(fakeFile("file.xyzzy-unknown6"), null);

    // All five required keys must be present.
    assert.ok(Object.prototype.hasOwnProperty.call(result, "kind"), "result must have 'kind'");
    assert.ok(Object.prototype.hasOwnProperty.call(result, "meta"), "result must have 'meta'");
    assert.ok(Object.prototype.hasOwnProperty.call(result, "mesh"), "result must have 'mesh'");
    assert.ok(Object.prototype.hasOwnProperty.call(result, "drewToCanvas"), "result must have 'drewToCanvas'");
    assert.ok(Object.prototype.hasOwnProperty.call(result, "pluginPoint"), "result must have 'pluginPoint'");
  });
});

// ---------------------------------------------------------------------------
// importFile error-return path (handler throws)
// ---------------------------------------------------------------------------
describe("importFile() error-return path", () => {
  it("should return kind=error when a registered handler throws", async () => {
    StudioImporters.register(
      f => f.name.endsWith(".xtest-throw"),
      async () => { throw new Error("intentional parse failure"); }
    );

    const file = fakeFile("broken.xtest-throw", "application/octet-stream", 10);
    const result = await StudioImporters.importFile(file, null);

    assert.equal(result.kind, "error", "a throwing handler must produce kind=error, not kind=unknown");
  });

  it("should set drewToCanvas=false when a handler throws", async () => {
    StudioImporters.register(
      f => f.name.endsWith(".xtest-throw2"),
      async () => { throw new RangeError("bad range"); }
    );

    const result = await StudioImporters.importFile(fakeFile("broken.xtest-throw2"), null);

    assert.equal(result.drewToCanvas, false, "drewToCanvas must be false when the handler threw");
  });

  it("should include the error message in meta.error when a handler throws", async () => {
    StudioImporters.register(
      f => f.name.endsWith(".xtest-throw3"),
      async () => { throw new Error("corrupt header"); }
    );

    const result = await StudioImporters.importFile(fakeFile("broken.xtest-throw3"), null);

    assert.equal(typeof result.meta.error, "string", "meta.error must be a string on the error path");
    assert.ok(result.meta.error.includes("corrupt header"), "meta.error must contain the thrown message");
  });

  it("should set mesh=null when a handler throws -- no partial fabricated geometry", async () => {
    StudioImporters.register(
      f => f.name.endsWith(".xtest-throw4"),
      async () => { throw new Error("truncated"); }
    );

    const result = await StudioImporters.importFile(fakeFile("broken.xtest-throw4"), null);

    assert.equal(result.mesh, null, "mesh must be null on the error path");
  });

  it("should include a pluginPoint with the error text when a handler throws", async () => {
    StudioImporters.register(
      f => f.name.endsWith(".xtest-throw5"),
      async () => { throw new TypeError("not a valid buffer"); }
    );

    const result = await StudioImporters.importFile(fakeFile("broken.xtest-throw5"), null);

    assert.equal(typeof result.pluginPoint, "string", "pluginPoint must be a string on the error path");
    assert.ok(
      result.pluginPoint.toLowerCase().includes("parser error") || result.pluginPoint.includes("not a valid buffer"),
      "pluginPoint should describe the parse failure"
    );
  });
});

// ---------------------------------------------------------------------------
// Matcher dispatch -- extension matching via built-in registrations.
// We probe the dispatch table indirectly through importFile with handlers that
// will fail (no FileReader/canvas) and catch the kind=error response, OR we
// register a spy on top of the built-in to confirm the right slot was reached.
// ---------------------------------------------------------------------------
describe("Matcher dispatch for built-in file types", () => {
  // Strategy: register a spy for each type AFTER the defaults. The spy returns
  // immediately without touching canvas or FileReader. Because last-registered
  // wins, the spy intercepts the dispatch and confirms the extension matched.

  const TYPES = [
    { name: "photo.png",   type: "image/png",           expectedKind: "spy-image" },
    { name: "clip.mp4",    type: "video/mp4",            expectedKind: "spy-video" },
    { name: "icon.svg",    type: "image/svg+xml",        expectedKind: "spy-svg"   },
    { name: "model.obj",   type: "model/obj",            expectedKind: "spy-obj"   },
    { name: "scene.gltf",  type: "model/gltf+json",      expectedKind: "spy-gltf"  },
    { name: "cloud.ply",   type: "application/ply",      expectedKind: "spy-ply"   },
    { name: "track.wav",   type: "audio/wav",            expectedKind: "spy-audio" },
    { name: "data.csv",    type: "text/csv",             expectedKind: "spy-data"  },
    { name: "info.json",   type: "application/json",     expectedKind: "spy-data"  },
    { name: "notes.txt",   type: "text/plain",           expectedKind: "spy-data"  },
    { name: "scene.glb",   type: "model/gltf-binary",    expectedKind: "spy-gltf"  },
  ];

  // Register spies once for all types checked below.
  StudioImporters.register(
    [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", "image/"],
    async () => ({ kind: "spy-image", meta: {}, mesh: null, drewToCanvas: true, pluginPoint: null })
  );
  StudioImporters.register(
    [".mp4", ".webm", ".mov", ".ogg", ".ogv", "video/"],
    async () => ({ kind: "spy-video", meta: {}, mesh: null, drewToCanvas: true, pluginPoint: null })
  );
  StudioImporters.register(
    [".svg", "image/svg"],
    async () => ({ kind: "spy-svg", meta: {}, mesh: null, drewToCanvas: true, pluginPoint: null })
  );
  StudioImporters.register(
    [".obj", "model/obj", "application/object"],
    async () => ({ kind: "spy-obj", meta: {}, mesh: null, drewToCanvas: true, pluginPoint: null })
  );
  StudioImporters.register(
    f => {
      const m = f.name.match(/\.([^.]+)$/);
      const e = m ? m[1].toLowerCase() : "";
      return e === "gltf" || e === "glb" || f.type === "model/gltf+json" || f.type === "model/gltf-binary";
    },
    async () => ({ kind: "spy-gltf", meta: {}, mesh: null, drewToCanvas: true, pluginPoint: null })
  );
  StudioImporters.register(
    [".ply", "application/ply"],
    async () => ({ kind: "spy-ply", meta: {}, mesh: null, drewToCanvas: true, pluginPoint: null })
  );
  StudioImporters.register(
    [".wav", ".mp3", ".ogg", ".flac", ".aac", ".m4a", "audio/"],
    async () => ({ kind: "spy-audio", meta: {}, mesh: null, drewToCanvas: true, pluginPoint: null })
  );
  StudioImporters.register(
    [".csv", ".json", ".txt", "text/", "application/json"],
    async () => ({ kind: "spy-data", meta: {}, mesh: null, drewToCanvas: true, pluginPoint: null })
  );

  for (const { name, type, expectedKind } of TYPES) {
    it(`should dispatch "${name}" (type="${type}") to ${expectedKind}`, async () => {
      const result = await StudioImporters.importFile(fakeFile(name, type, 1024), null);
      assert.equal(
        result.kind,
        expectedKind,
        `expected dispatch to ${expectedKind} for ${name} / ${type}`
      );
    });
  }

  it("should not match a truly unknown extension via any built-in or spy matcher", async () => {
    const result = await StudioImporters.importFile(fakeFile("file.zz9-no-match", "application/zz9-no-match"), null);
    assert.equal(result.kind, "unknown", "a type with no matcher should yield kind=unknown");
    assert.equal(result.drewToCanvas, false, "unknown dispatch must not claim to have drawn");
  });

  it("should match .jpg by extension even when type is empty string", async () => {
    const result = await StudioImporters.importFile(fakeFile("photo.jpg", "", 200), null);
    assert.equal(result.kind, "spy-image", "extension-based match must work when file.type is empty");
  });

  it("should match image/png MIME prefix even when filename has no recognised extension", async () => {
    // Spies for image/ prefix are registered above; a file with type image/png and odd name
    // should still route to spy-image via the MIME prefix pattern.
    const result = await StudioImporters.importFile(fakeFile("rawblob", "image/png", 50), null);
    assert.equal(result.kind, "spy-image", "MIME prefix image/ should match even without a known extension");
  });
});

// ---------------------------------------------------------------------------
// ext() edge cases -- probed indirectly via the meta.ext populated by importUnknown
// ---------------------------------------------------------------------------
describe("ext() helper edge cases (via importUnknown meta.ext)", () => {
  it("should extract the last segment after the final dot, lowercase", async () => {
    const result = await StudioImporters.importFile(fakeFile("archive.TAR.GZ.zz9-noext-zzz"), null);
    // importUnknown sets meta.ext = ext(file)
    assert.equal(result.meta.ext, "zz9-noext-zzz", "ext must be the last dot-delimited segment, lowercased");
  });

  it("should return empty string for a filename with no extension", async () => {
    const result = await StudioImporters.importFile(fakeFile("README"), null);
    assert.equal(result.meta.ext, "", "a filename with no dot should produce ext=''");
  });

  it("should handle a filename that is only a dot followed by a name (hidden file, no real ext)", async () => {
    // ".gitignore" -- the regex /\.([^.]+)$/ matches "gitignore"
    const result = await StudioImporters.importFile(fakeFile(".xyzzy-hidden-zzz9"), null);
    assert.equal(result.meta.ext, "xyzzy-hidden-zzz9", "a dotfile with no second dot should yield the suffix after the leading dot");
  });

  it("should lowercase the extension", async () => {
    const result = await StudioImporters.importFile(fakeFile("image.PNG.zz9-upper"), null);
    assert.equal(result.meta.ext, "zz9-upper", "extension extraction must be case-insensitive (lowercased)");
  });
});

// ---------------------------------------------------------------------------
// _selftest() export
// ---------------------------------------------------------------------------
describe("_selftest()", () => {
  it("should be exported as a function", () => {
    assert.equal(typeof _selftest, "function", "_selftest must be exported as a named export");
  });

  it("should return an object with passed, total, and results array", () => {
    const report = _selftest();

    assert.ok(Object.prototype.hasOwnProperty.call(report, "passed"), "return value must have 'passed'");
    assert.ok(Object.prototype.hasOwnProperty.call(report, "total"),  "return value must have 'total'");
    assert.ok(Object.prototype.hasOwnProperty.call(report, "results"), "return value must have 'results'");
    assert.ok(Array.isArray(report.results), "results must be an array");
  });

  it("should report total > 0 -- the selftest must contain assertions", () => {
    const report = _selftest();
    assert.ok(report.total > 0, `_selftest must run at least one assertion; got total=${report.total}`);
  });

  it("should pass all of its own assertions (passed === total)", () => {
    const report = _selftest();
    const failed = report.results.filter(r => !r.pass).map(r => r.label);
    assert.equal(
      report.passed,
      report.total,
      `_selftest internal failures: ${failed.join(", ")}`
    );
  });
});

// ---------------------------------------------------------------------------
// SKIPPED: browser-only paths
// Each skip documents WHY it cannot run in Node.
// ---------------------------------------------------------------------------
describe("importFile() browser-only paths (skipped in Node)", () => {
  it("importImage -- requires URL.createObjectURL, createImageBitmap, and Image (absent in Node)", {
    skip: "browser-only: URL.createObjectURL / createImageBitmap / Image not available in Node",
  }, async () => {});

  it("importVideo -- requires document.createElement('video') and URL.createObjectURL (absent in Node)", {
    skip: "browser-only: document.createElement and URL.createObjectURL not available in Node",
  }, async () => {});

  it("importSVG -- requires FileReader, Blob, URL.createObjectURL, DOMParser, and Image (absent in Node)", {
    skip: "browser-only: FileReader / Blob / DOMParser / Image not available in Node",
  }, async () => {});

  it("importOBJ -- requires FileReader (readAsText) and canvas.getContext (absent in Node)", {
    skip: "browser-only: FileReader and canvas.getContext not available in Node",
  }, async () => {});

  it("importGLTF -- requires FileReader (readAsArrayBuffer) and canvas.getContext (absent in Node)", {
    skip: "browser-only: FileReader and canvas.getContext not available in Node",
  }, async () => {});

  it("importPLY -- requires FileReader (readAsText) and canvas.getContext (absent in Node)", {
    skip: "browser-only: FileReader and canvas.getContext not available in Node",
  }, async () => {});

  it("importAudio -- requires FileReader, AudioContext, and canvas.getContext (absent in Node)", {
    skip: "browser-only: FileReader / AudioContext / canvas.getContext not available in Node",
  }, async () => {});

  it("importData -- requires FileReader and canvas.getContext (absent in Node)", {
    skip: "browser-only: FileReader and canvas.getContext not available in Node",
  }, async () => {});
});

// ===========================================================================
// IMPORT RECEIPTS -- witnessed provenance on every import (spec section B)
// ===========================================================================

// ---------------------------------------------------------------------------
// hashBytes() + fnv1a() -- the import-side hashing primitive, both paths
// ---------------------------------------------------------------------------
describe("import hashBytes() -- SHA-256 path and FNV-1a fallback", () => {
  it("should report sha-256 with a 64-hex digest when crypto.subtle is present", async () => {
    const { hash, hashAlgo } = await hashBytes(new Uint8Array([1, 2, 3]));
    assert.equal(hashAlgo, HASH_SHA256);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it("should match the FIPS SHA-256 vector for 'abc'", async () => {
    const { hash } = await hashBytes(new TextEncoder().encode("abc"));
    assert.equal(hash, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("should fall back to FNV-1a (flagged honestly) when subtle is forced null", async () => {
    const { hash, hashAlgo } = await hashBytes(new Uint8Array([1, 2, 3]), { subtle: null });
    assert.equal(hashAlgo, HASH_FNV1A, "forced no-subtle must report the fnv1a fallback");
    assert.notEqual(hashAlgo, HASH_SHA256, "must never claim sha-256 when it used the fallback");
    assert.match(hash, /^[0-9a-f]{8}$/);
  });

  it("fnv1a() should be deterministic", () => {
    assert.equal(fnv1a(new Uint8Array([9, 9, 9])), fnv1a(new Uint8Array([9, 9, 9])));
  });
});

// ---------------------------------------------------------------------------
// importReceipt() -- the receipt builder directly
// ---------------------------------------------------------------------------
describe("importReceipt() -- field shape and honesty", () => {
  it("should carry inputFormat, sizeBytes, originHash, hashAlgo (+ hashScope)", async () => {
    const stub = { name: "thing.bin", type: "application/octet-stream", size: 256 };
    const receipt = await importReceipt(stub);
    assert.equal(typeof receipt.inputFormat, "string");
    assert.equal(receipt.inputFormat, "bin", "inputFormat should be the extension");
    assert.equal(receipt.sizeBytes, 256, "sizeBytes must reflect file.size");
    assert.equal(typeof receipt.originHash, "string");
    assert.ok(receipt.originHash.length > 0, "originHash must be non-empty");
    assert.ok(receipt.hashAlgo === HASH_SHA256 || receipt.hashAlgo === HASH_FNV1A);
  });

  it("should hash REAL bytes (hashScope=content) when the file exposes arrayBuffer()", async () => {
    const blob = new Blob([new Uint8Array([10, 20, 30, 40, 50])], { type: "application/octet-stream" });
    blob.name = "payload.bin";
    const receipt = await importReceipt(blob);
    assert.equal(receipt.hashScope, "content", "a readable File/Blob must be hashed by content");
    assert.equal(receipt.sizeBytes, 5, "sizeBytes must equal the byte length");
    // The hash must equal the hash of those exact bytes.
    const direct = await hashBytes(new Uint8Array([10, 20, 30, 40, 50]));
    assert.equal(receipt.originHash, direct.hash, "content hash must match the raw bytes' hash");
  });

  it("should honestly mark hashScope=descriptor when bytes are not readable (plain stub)", async () => {
    const stub = { name: "ghost.dat", type: "application/dat", size: 999 };
    const receipt = await importReceipt(stub);
    assert.equal(receipt.hashScope, "descriptor", "a non-File stub cannot be content-hashed; must say so");
    assert.equal(receipt.sizeBytes, 999, "sizeBytes is still reported truthfully from file.size");
  });

  it("should use the forced FNV-1a fallback end-to-end and flag it", async () => {
    const blob = new Blob([new Uint8Array([1, 1, 1])]);
    blob.name = "x.bin";
    const receipt = await importReceipt(blob, { subtle: null });
    assert.equal(receipt.hashAlgo, HASH_FNV1A);
    assert.match(receipt.originHash, /^[0-9a-f]{8}$/);
  });

  it("should be deterministic for the same input", async () => {
    const stub = { name: "same.bin", type: "application/octet-stream", size: 4 };
    const a = await importReceipt(stub);
    const b = await importReceipt(stub);
    assert.equal(a.originHash, b.originHash);
  });
});

// ---------------------------------------------------------------------------
// importFile() -- the receipt is attached on every path
// ---------------------------------------------------------------------------
describe("importFile() -- receipt is attached on every return path", () => {
  it("should attach a receipt on the unknown path", async () => {
    const result = await StudioImporters.importFile(fakeFile("mystery.zz9-receipt-unknown", "application/zz9", 77), null);
    assert.equal(result.kind, "unknown", "precondition: this is the unknown path");
    assert.ok(result.receipt && typeof result.receipt === "object", "unknown result must carry a receipt");
    assert.equal(result.receipt.inputFormat, "zz9-receipt-unknown");
    assert.equal(result.receipt.sizeBytes, 77);
    assert.equal(typeof result.receipt.originHash, "string");
  });

  it("should attach a receipt on the error path (handler throws)", async () => {
    StudioImporters.register(
      f => f.name.endsWith(".zz9-receipt-throw"),
      async () => { throw new Error("boom"); }
    );
    const result = await StudioImporters.importFile(fakeFile("broken.zz9-receipt-throw", "application/octet-stream", 12), null);
    assert.equal(result.kind, "error", "precondition: this is the error path");
    assert.ok(result.receipt && typeof result.receipt === "object", "error result must still carry a receipt");
    assert.equal(result.receipt.sizeBytes, 12);
  });

  it("should attach a receipt on a successful handler path", async () => {
    StudioImporters.register(
      f => f.name.endsWith(".zz9-receipt-ok"),
      async (file) => ({ kind: "spy-ok", meta: { name: file.name }, mesh: null, drewToCanvas: true, pluginPoint: null })
    );
    const result = await StudioImporters.importFile(fakeFile("good.zz9-receipt-ok", "application/octet-stream", 33), null);
    assert.equal(result.kind, "spy-ok");
    assert.ok(result.receipt && typeof result.receipt === "object", "successful result must carry a receipt");
    assert.equal(result.receipt.inputFormat, "zz9-receipt-ok");
    assert.equal(result.receipt.sizeBytes, 33);
  });

  it("should forward the subtle override so importFile receipts can use the fallback", async () => {
    const result = await StudioImporters.importFile(
      fakeFile("fb.zz9-receipt-fallback", "application/octet-stream", 5),
      null,
      { subtle: null }
    );
    assert.equal(result.receipt.hashAlgo, HASH_FNV1A, "forced no-subtle path must propagate to the receipt");
  });
});
