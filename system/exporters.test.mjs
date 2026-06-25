/**
 * system/exporters.test.mjs
 * node:test suite for the pure/node-safe surface of exporters.js.
 *
 * Run: node --test system/exporters.test.mjs
 *      (from c:/dev/public/portfolio-site)
 *
 * Browser-only paths (png, svg fallback, webm, download) are skipped
 * with explicit reasons rather than fake stubs.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import the module under test. Importable in Node because it is a plain ES
// module with no top-level browser calls -- all browser globals are only
// reached when the individual exporter functions are invoked.
import {
  StudioExporters,
  download,
  _selftest,
  buildReceipt,
  hashBytesOf,
  fnv1a,
  discriminateMesh,
  discriminateOBJText,
  discriminateGLTF,
  discriminateSVG,
  discriminateJSON,
  discriminatePNG,
  HASH_SHA256,
  HASH_FNV1A,
} from "./exporters.js";


// ---------------------------------------------------------------------------
// StudioExporters.register() -- contract
// ---------------------------------------------------------------------------

describe("StudioExporters.register()", () => {
  it("should throw TypeError when name is an empty string", () => {
    assert.throws(
      () => StudioExporters.register("", () => {}),
      (err) => err instanceof TypeError && /non-empty string/.test(err.message)
    );
  });

  it("should throw TypeError when name is not a string", () => {
    assert.throws(
      () => StudioExporters.register(42, () => {}),
      (err) => err instanceof TypeError && /non-empty string/.test(err.message)
    );
  });

  it("should throw TypeError when exportFn is not a function", () => {
    assert.throws(
      () => StudioExporters.register("myformat", "not-a-function"),
      (err) => err instanceof TypeError && /function/.test(err.message)
    );
  });

  it("should add a named exporter that export() dispatches to", async () => {
    // Arrange -- a pure synchronous exporter that returns a known string.
    const sentinel = "SENTINEL_OUTPUT_abc123";
    StudioExporters.register("_test_dispatch", async (_canvas, _extra) => sentinel);

    // Act
    const result = await StudioExporters.export("_test_dispatch", null, {});

    // Assert -- dispatch reached our function and the return value flows through unchanged.
    assert.equal(result, sentinel);
  });

  it("should allow overwriting an existing registration with a new function", async () => {
    StudioExporters.register("_test_overwrite", async () => "first");
    StudioExporters.register("_test_overwrite", async () => "second");

    const result = await StudioExporters.export("_test_overwrite", null, {});

    assert.equal(result, "second");
  });

  it("should pass extra through to the registered function", async () => {
    let capturedExtra;
    StudioExporters.register("_test_extra", async (_canvas, extra) => {
      capturedExtra = extra;
      return "ok";
    });

    const extraIn = { customField: "hello", nested: { x: 1 } };
    await StudioExporters.export("_test_extra", null, extraIn);

    assert.deepEqual(capturedExtra, extraIn);
  });

  it("should pass an empty object as extra when caller passes undefined", async () => {
    let capturedExtra;
    StudioExporters.register("_test_extra_undefined", async (_canvas, extra) => {
      capturedExtra = extra;
      return "ok";
    });

    // Pass undefined as extra -- the registry normalises it to {}.
    await StudioExporters.export("_test_extra_undefined", null, undefined);

    assert.deepEqual(capturedExtra, {});
  });
});


// ---------------------------------------------------------------------------
// StudioExporters.export() -- unknown name
// ---------------------------------------------------------------------------

describe("StudioExporters.export() with unknown name", () => {
  it("should throw an Error (not silently succeed) for an unregistered name", async () => {
    await assert.rejects(
      () => StudioExporters.export("__no_such_exporter__", null, {}),
      (err) => {
        // Must be an Error, not just any rejection.
        assert.ok(err instanceof Error, "rejection should be an Error instance");
        // The message must mention the unknown name so callers can diagnose it.
        assert.ok(
          err.message.includes("__no_such_exporter__"),
          `error message should contain the unknown name; got: "${err.message}"`
        );
        return true;
      }
    );
  });

  it("should include the literal name in the error message", async () => {
    const badName = "totally_unknown_xyz_987";
    await assert.rejects(
      () => StudioExporters.export(badName, null, {}),
      (err) => {
        assert.ok(err.message.includes(badName));
        return true;
      }
    );
  });
});


// ---------------------------------------------------------------------------
// JSON exporter -- pure path (no canvas access)
// ---------------------------------------------------------------------------

describe("json exporter -- pure data path", () => {
  // A minimal stub canvas whose properties are accessed only when extra.data
  // is absent. All tests below supply extra.data so no canvas property is read.
  const stubCanvas = {};

  it("should return a string when extra.data is provided", async () => {
    const result = await StudioExporters.export("json", stubCanvas, {
      data: { key: "value" },
    });

    assert.equal(typeof result, "string");
  });

  it("should round-trip a flat object exactly", async () => {
    const input = { phash: "abcd1234", width: 512, height: 512, source: "studio-canvas" };

    const result = await StudioExporters.export("json", stubCanvas, { data: input });
    const parsed = JSON.parse(result);

    assert.equal(parsed.phash, "abcd1234");
    assert.equal(parsed.width, 512);
    assert.equal(parsed.height, 512);
    assert.equal(parsed.source, "studio-canvas");
  });

  it("should produce pretty-printed JSON (contains newlines and spaces)", async () => {
    const input = { a: 1, b: 2 };

    const result = await StudioExporters.export("json", stubCanvas, { data: input });

    // JSON.stringify with null, 2 always has newlines when the value is an object.
    assert.ok(result.includes("\n"), "expected newlines in pretty-printed output");
    assert.ok(result.includes("  "), "expected two-space indent in pretty-printed output");
  });

  it("should round-trip a nested witnessed-certificate shaped object", async () => {
    const perception = {
      phash: "deadbeef01234567",
      timestamp: "2026-06-24T00:00:00.000Z",
      canvas: { width: 800, height: 600 },
      layers: ["base", "overlay"],
    };

    const result = await StudioExporters.export("json", stubCanvas, { data: perception });
    const parsed = JSON.parse(result);

    assert.equal(parsed.phash, perception.phash);
    assert.equal(parsed.timestamp, perception.timestamp);
    assert.equal(parsed.canvas.width, 800);
    assert.equal(parsed.canvas.height, 600);
    assert.deepEqual(parsed.layers, ["base", "overlay"]);
  });

  it("should serialise arrays as the top-level data value", async () => {
    const input = [1, 2, 3, "four"];

    const result = await StudioExporters.export("json", stubCanvas, { data: input });
    const parsed = JSON.parse(result);

    assert.deepEqual(parsed, input);
  });

  it("should serialise null as the top-level data value", async () => {
    const result = await StudioExporters.export("json", stubCanvas, { data: null });
    const parsed = JSON.parse(result);

    assert.equal(parsed, null);
  });

  it("should use canvas dimensions when extra.data is absent and return valid JSON", async () => {
    // For the fallback path we must provide a real width/height stub.
    const dimensionStub = { width: 320, height: 240 };

    const result = await StudioExporters.export("json", dimensionStub, {});
    const parsed = JSON.parse(result);

    assert.equal(parsed.width, 320);
    assert.equal(parsed.height, 240);
    assert.equal(typeof parsed.exported, "string", "exported field should be an ISO timestamp string");
    assert.equal(parsed.source, "studio-canvas");
  });
});


// ---------------------------------------------------------------------------
// OBJ exporter -- mesh path (no canvas access)
// ---------------------------------------------------------------------------

describe("obj exporter -- mesh path", () => {
  // The mesh path in exportOBJ never touches the canvas.
  const stubCanvas = {};

  it("should return a string", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
      faces: [[0, 1, 2]],
    };

    const result = await StudioExporters.export("obj", stubCanvas, { mesh });

    assert.equal(typeof result, "string");
  });

  it("should emit one v line per vertex", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
      faces: [[0, 1, 2]],
    };

    const result = await StudioExporters.export("obj", stubCanvas, { mesh });
    const vLines = result.split("\n").filter(l => l.startsWith("v "));

    assert.equal(vLines.length, 3, "expected exactly 3 vertex lines");
  });

  it("should emit vertex coordinates matching the input", async () => {
    const mesh = {
      vertices: [[1.5, -2.0, 3.75], [0, 0, 0]],
      faces: [],
    };

    const result = await StudioExporters.export("obj", stubCanvas, { mesh });

    assert.ok(result.includes("v 1.5 -2 3.75"), "expected first vertex line");
    assert.ok(result.includes("v 0 0 0"), "expected second vertex line");
  });

  it("should emit face indices as 1-based", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
      faces: [[0, 1, 2]],
    };

    const result = await StudioExporters.export("obj", stubCanvas, { mesh });

    // Face [0,1,2] must appear as "f 1 2 3".
    assert.ok(result.includes("f 1 2 3"), `expected "f 1 2 3", got:\n${result}`);
  });

  it("should emit one f line per face", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
      faces: [[0, 1, 2], [1, 3, 2]],
    };

    const result = await StudioExporters.export("obj", stubCanvas, { mesh });
    const fLines = result.split("\n").filter(l => l.startsWith("f "));

    assert.equal(fLines.length, 2, "expected exactly 2 face lines");
  });

  it("should emit vn lines when normals are provided", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
      normals: [[0, 0, 1], [0, 0, 1], [0, 0, 1]],
      faces: [[0, 1, 2]],
    };

    const result = await StudioExporters.export("obj", stubCanvas, { mesh });
    const vnLines = result.split("\n").filter(l => l.startsWith("vn "));

    assert.equal(vnLines.length, 3, "expected exactly 3 normal lines");
    assert.ok(result.includes("vn 0 0 1"), "expected normal line content");
  });

  it("should end with a newline", async () => {
    const mesh = {
      vertices: [[0, 0, 0]],
      faces: [],
    };

    const result = await StudioExporters.export("obj", stubCanvas, { mesh });

    assert.ok(result.endsWith("\n"), "OBJ string should end with newline");
  });

  it("should include the comment header line", async () => {
    const mesh = { vertices: [], faces: [] };

    const result = await StudioExporters.export("obj", stubCanvas, { mesh });

    assert.ok(result.startsWith("#"), "expected OBJ to start with a comment line");
  });

  it("should handle empty mesh (no vertices, no faces) without throwing", async () => {
    const mesh = { vertices: [], faces: [] };

    const result = await StudioExporters.export("obj", stubCanvas, { mesh });

    assert.equal(typeof result, "string");
    // No v or f lines expected.
    const vLines = result.split("\n").filter(l => l.startsWith("v "));
    const fLines = result.split("\n").filter(l => l.startsWith("f "));
    assert.equal(vLines.length, 0);
    assert.equal(fLines.length, 0);
  });
});


// ---------------------------------------------------------------------------
// GLTF exporter -- mesh path (no canvas access, uses btoa + typed arrays)
// ---------------------------------------------------------------------------

describe("gltf exporter -- mesh path", () => {
  const stubCanvas = {};

  const simpleMesh = {
    vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
    faces: [[0, 1, 2]],
  };

  it("should return a string", async () => {
    const result = await StudioExporters.export("gltf", stubCanvas, { mesh: simpleMesh });

    assert.equal(typeof result, "string");
  });

  it("should return valid JSON", async () => {
    const result = await StudioExporters.export("gltf", stubCanvas, { mesh: simpleMesh });

    assert.doesNotThrow(() => JSON.parse(result), "GLTF output must be valid JSON");
  });

  it("should have asset.version equal to '2.0'", async () => {
    const result = await StudioExporters.export("gltf", stubCanvas, { mesh: simpleMesh });
    const parsed = JSON.parse(result);

    assert.equal(parsed.asset.version, "2.0");
  });

  it("should have required top-level GLTF 2.0 keys", async () => {
    const result = await StudioExporters.export("gltf", stubCanvas, { mesh: simpleMesh });
    const parsed = JSON.parse(result);

    for (const key of ["asset", "buffers", "bufferViews", "accessors", "meshes", "nodes", "scenes", "scene"]) {
      assert.ok(Object.prototype.hasOwnProperty.call(parsed, key), `missing top-level key: ${key}`);
    }
  });

  it("should have exactly one mesh named StudioMesh", async () => {
    const result = await StudioExporters.export("gltf", stubCanvas, { mesh: simpleMesh });
    const parsed = JSON.parse(result);

    assert.equal(parsed.meshes.length, 1);
    assert.equal(parsed.meshes[0].name, "StudioMesh");
  });

  it("should reference POSITION accessor index 0 in the primitive", async () => {
    const result = await StudioExporters.export("gltf", stubCanvas, { mesh: simpleMesh });
    const parsed = JSON.parse(result);

    assert.equal(parsed.meshes[0].primitives[0].attributes.POSITION, 0);
  });

  it("should use mode 4 (TRIANGLES) for the primitive", async () => {
    const result = await StudioExporters.export("gltf", stubCanvas, { mesh: simpleMesh });
    const parsed = JSON.parse(result);

    assert.equal(parsed.meshes[0].primitives[0].mode, 4);
  });

  it("should have a buffer with a positive byteLength and a data URI", async () => {
    const result = await StudioExporters.export("gltf", stubCanvas, { mesh: simpleMesh });
    const parsed = JSON.parse(result);

    assert.equal(parsed.buffers.length, 1);
    assert.ok(parsed.buffers[0].byteLength > 0, "buffer byteLength must be > 0");
    assert.ok(
      parsed.buffers[0].uri.startsWith("data:application/octet-stream;base64,"),
      "buffer uri must be a base64 data URI"
    );
  });

  it("should have the position accessor reflect the correct vertex count", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
      faces: [[0, 1, 2], [1, 3, 2]],
    };

    const result = await StudioExporters.export("gltf", stubCanvas, { mesh });
    const parsed = JSON.parse(result);

    // accessor[0] is positions; count must equal number of vertices.
    assert.equal(parsed.accessors[0].count, 4, "position accessor count must equal vertex count");
    assert.equal(parsed.accessors[0].type, "VEC3");
    assert.equal(parsed.accessors[0].componentType, 5126, "float32 componentType");
  });

  it("should have the index accessor reflect the correct index count", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
      faces: [[0, 1, 2]],
    };

    const result = await StudioExporters.export("gltf", stubCanvas, { mesh });
    const parsed = JSON.parse(result);

    // accessor[1] is indices; count = faces * 3.
    assert.equal(parsed.accessors[1].count, 3, "index accessor count must be faces.length * 3");
    assert.equal(parsed.accessors[1].type, "SCALAR");
    assert.equal(parsed.accessors[1].componentType, 5125, "uint32 componentType");
  });

  it("should include bounding box min/max on the position accessor", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [2, 1, 3]],
      faces: [[0, 1, 0]],
    };

    const result = await StudioExporters.export("gltf", stubCanvas, { mesh });
    const parsed = JSON.parse(result);

    const acc = parsed.accessors[0];
    assert.deepEqual(acc.min, [0, 0, 0]);
    assert.deepEqual(acc.max, [2, 1, 3]);
  });

  it("should add a NORMAL attribute when normals match vertex count", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
      normals: [[0, 0, 1], [0, 0, 1], [0, 0, 1]],
      faces: [[0, 1, 2]],
    };

    const result = await StudioExporters.export("gltf", stubCanvas, { mesh });
    const parsed = JSON.parse(result);

    assert.ok(
      "NORMAL" in parsed.meshes[0].primitives[0].attributes,
      "expected NORMAL attribute when normals provided"
    );
    // Normals should add a third bufferView and accessor.
    assert.equal(parsed.bufferViews.length, 3);
    assert.equal(parsed.accessors.length, 3);
  });

  it("should NOT add a NORMAL attribute when normals array is empty", async () => {
    const mesh = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
      normals: [],
      faces: [[0, 1, 2]],
    };

    const result = await StudioExporters.export("gltf", stubCanvas, { mesh });
    const parsed = JSON.parse(result);

    assert.ok(
      !("NORMAL" in parsed.meshes[0].primitives[0].attributes),
      "should not have NORMAL attribute when normals array is empty"
    );
  });

  // Regression: large meshes must export without the spread-args RangeError.
  // The old btoa(String.fromCharCode(...bytes)) form overflowed the call-stack
  // argument limit once the combined buffer passed roughly half a megabyte. A
  // real scene easily exceeds that, so "anything out" demands a chunked encoder.
  it("should export a large mesh without a RangeError (chunked base64)", async () => {
    const N = 50000; // ~600KB of float32 positions, past the spread arg limit
    const vertices = Array.from({ length: N }, (_, i) => [i * 1e-3, (i % 7) * 0.5, (i % 13) * 0.25]);
    const faces = Array.from({ length: Math.floor(N / 3) }, (_, i) => [3 * i, 3 * i + 1, 3 * i + 2]);

    // If the encoder regressed to the spread form, this await rejects with a
    // RangeError and the test fails loudly. That is the guard.
    const result = await StudioExporters.export("gltf", stubCanvas, { mesh: { vertices, faces } });
    const parsed = JSON.parse(result);
    const uri = parsed.buffers[0].uri;

    assert.match(uri, /^data:application\/octet-stream;base64,/, "large mesh must still produce a base64 buffer URI");
    const decodedLen = Buffer.from(uri.split(",")[1], "base64").length;
    assert.equal(decodedLen, parsed.buffers[0].byteLength, "decoded buffer length must match the declared byteLength");
  });
});


// ---------------------------------------------------------------------------
// SVG exporter -- vector passthrough path
// SVG uses Blob, but the passthrough branch is the only one we can test.
// In Node, Blob is available (Node 18+). We drive it with the duck-typed input.
// ---------------------------------------------------------------------------

describe("svg exporter -- vector string passthrough", () => {
  it("should accept a valid SVG string via extra.vector and return a Blob", async () => {
    const vectorSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';
    const stubCanvas = {};

    const result = await StudioExporters.export("svg", stubCanvas, { vector: vectorSvg });

    // Blob is available in Node 18+. Verify it is a Blob-like object.
    assert.ok(result !== null && typeof result === "object", "expected Blob-like object");
    assert.ok(typeof result.size === "number" && result.size > 0, "Blob must have positive size");
    assert.ok(result.type.includes("svg"), `Blob type should include 'svg', got: ${result.type}`);
  });

  it("should not call canvas methods when extra.vector is an SVG string", async () => {
    // Stub canvas that throws if any method is called.
    const poisonCanvas = new Proxy({}, {
      get(_, prop) {
        throw new Error(`canvas.${prop} was accessed but should not be in the vector passthrough path`);
      },
    });
    const vectorSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';

    // Should not throw because the vector branch short-circuits before canvas access.
    await assert.doesNotReject(
      () => StudioExporters.export("svg", poisonCanvas, { vector: vectorSvg })
    );
  });

  it("should skip (canvas fallback path needs canvas.getContext)", async (_t) => {
    _t.skip("SVG fallback path calls canvas.getContext + toDataURL -- browser-only");
  });
});


// ---------------------------------------------------------------------------
// PNG exporter -- browser-only skip
// ---------------------------------------------------------------------------

describe("png exporter", () => {
  it("should skip because canvas.toBlob is browser-only", async (_t) => {
    _t.skip("exportPNG calls canvas.toBlob which requires a real browser canvas");
  });
});


// ---------------------------------------------------------------------------
// WebM exporter -- browser-only skip
// ---------------------------------------------------------------------------

describe("webm exporter", () => {
  it("should skip because captureStream and MediaRecorder are browser-only", async (_t) => {
    _t.skip("exportWebM calls canvas.captureStream() and new MediaRecorder() -- no Node equivalent");
  });
});


// ---------------------------------------------------------------------------
// download() -- browser-only skip
// ---------------------------------------------------------------------------

describe("download()", () => {
  it("should be exported as a function", () => {
    assert.equal(typeof download, "function");
  });

  it("should skip invocation because it requires document and URL.createObjectURL", async (_t) => {
    _t.skip("download() calls document.createElement, document.body, URL.createObjectURL -- browser DOM only");
  });
});


// ---------------------------------------------------------------------------
// _selftest() -- module-level smoke check
// ---------------------------------------------------------------------------

describe("_selftest()", () => {
  it("should return an object with passed, total, and results fields", () => {
    const result = _selftest();

    assert.equal(typeof result, "object");
    assert.ok(result !== null);
    assert.ok(typeof result.passed === "number", "expected numeric passed count");
    assert.ok(typeof result.total === "number", "expected numeric total count");
    assert.ok(Array.isArray(result.results), "expected results array");
  });

  it("should have zero failed results (all tests pass or are skipped)", () => {
    const result = _selftest();
    const failed = result.results.filter(r => !r.pass);

    assert.equal(
      failed.length,
      0,
      `_selftest() had ${failed.length} failure(s): ${failed.map(r => r.label).join(", ")}`
    );
  });
});


// ===========================================================================
// EXPORT RECEIPTS -- named-criterion witnessed receipts (spec section B)
// ===========================================================================

// ---------------------------------------------------------------------------
// hashBytesOf() + fnv1a() -- provenance hashing, both paths
// ---------------------------------------------------------------------------
describe("hashBytesOf() -- SHA-256 path and FNV-1a fallback", () => {
  it("should report hashAlgo 'sha-256' and a 64-hex digest when crypto.subtle is present", async () => {
    // Node 20+ has globalThis.crypto.subtle, so the ambient path is sha-256.
    const { hash, hashAlgo } = await hashBytesOf("hello world");
    assert.equal(hashAlgo, HASH_SHA256, "ambient path must be sha-256 in Node");
    assert.equal(hash.length, 64, "SHA-256 hex digest is 64 chars");
    assert.match(hash, /^[0-9a-f]{64}$/, "digest must be lowercase hex");
  });

  it("should produce the known SHA-256 vector for 'abc'", async () => {
    // FIPS 180-4 reference: SHA-256("abc").
    const { hash, hashAlgo } = await hashBytesOf("abc");
    assert.equal(hashAlgo, HASH_SHA256);
    assert.equal(hash, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("should fall back to FNV-1a and flag it honestly when subtle is forced null", async () => {
    const { hash, hashAlgo } = await hashBytesOf("hello world", { subtle: null });
    assert.equal(hashAlgo, HASH_FNV1A, "forced no-subtle must use the fnv1a fallback");
    assert.notEqual(hashAlgo, HASH_SHA256, "must NOT claim sha-256 when it used the fallback");
    assert.match(hash, /^[0-9a-f]{8}$/, "FNV-1a digest is 8 hex chars (visibly not a sha-256)");
  });

  it("should be deterministic: same input -> same digest (both algos)", async () => {
    const a = await hashBytesOf("repeatable");
    const b = await hashBytesOf("repeatable");
    assert.equal(a.hash, b.hash, "sha-256 must be deterministic");
    const c = await hashBytesOf("repeatable", { subtle: null });
    const d = await hashBytesOf("repeatable", { subtle: null });
    assert.equal(c.hash, d.hash, "fnv1a must be deterministic");
  });

  it("should give different digests for different inputs", async () => {
    const a = await hashBytesOf("input-one");
    const b = await hashBytesOf("input-two");
    assert.notEqual(a.hash, b.hash);
  });

  it("should hash a Blob by its real bytes (content), not a descriptor", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4, 5])]);
    const fromBlob = await hashBytesOf(blob);
    const fromBytes = await hashBytesOf(new Uint8Array([1, 2, 3, 4, 5]));
    assert.equal(fromBlob.hash, fromBytes.hash, "Blob must hash to the same digest as its raw bytes");
  });

  it("fnv1a() should return 8 lowercase hex chars for any byte input", () => {
    const h = fnv1a(new Uint8Array([0, 255, 128, 7]));
    assert.match(h, /^[0-9a-f]{8}$/);
  });
});

// ---------------------------------------------------------------------------
// Structural discriminators -- deterministic, structural-before-pixel
// ---------------------------------------------------------------------------
describe("discriminateMesh() -- topology range check", () => {
  it("should pass a valid indexed mesh (all face indices in range)", () => {
    assert.equal(discriminateMesh(3, [[0, 1, 2]]), true);
  });

  it("should FAIL a mesh with an out-of-range face index", () => {
    // vertexCount = 3, but a face references index 9.
    assert.equal(discriminateMesh(3, [[0, 1, 9]]), false);
  });

  it("should fail a negative face index", () => {
    assert.equal(discriminateMesh(3, [[0, -1, 2]]), false);
  });

  it("should fail a degenerate face with fewer than 3 indices", () => {
    assert.equal(discriminateMesh(3, [[0, 1]]), false);
  });

  it("should treat a truly empty mesh (0 verts, 0 faces) as well-formed", () => {
    assert.equal(discriminateMesh(0, []), true);
  });

  it("should fail when faces is not an array", () => {
    assert.equal(discriminateMesh(3, "nope"), false);
  });
});

describe("discriminateOBJText() -- re-parse the serialized OBJ", () => {
  it("should pass OBJ text whose face indices all resolve to a vertex", () => {
    const obj = "# header\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n";
    assert.equal(discriminateOBJText(obj), true);
  });

  it("should FAIL OBJ text with an out-of-range 1-based face index", () => {
    // Only 2 vertices declared, face references the 9th.
    const obj = "v 0 0 0\nv 1 0 0\nf 1 2 9\n";
    assert.equal(discriminateOBJText(obj), false);
  });

  it("should fail on empty input", () => {
    assert.equal(discriminateOBJText(""), false);
  });
});

describe("discriminateSVG() -- well-formed + command-valid", () => {
  it("should pass a well-formed SVG with a valid path command", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0 L10 10 Z"/></svg>';
    assert.equal(discriminateSVG(svg), true);
  });

  it("should fail when the closing </svg> is missing", () => {
    assert.equal(discriminateSVG('<svg><circle r="5"/>'), false);
  });

  it("should fail a path whose d does not start with a move command", () => {
    assert.equal(discriminateSVG('<svg><path d="L10 10"/></svg>'), false);
  });

  it("should fail a path with an invalid command letter", () => {
    assert.equal(discriminateSVG('<svg><path d="M0 0 K99"/></svg>'), false);
  });

  it("should fail on non-string input", () => {
    assert.equal(discriminateSVG(null), false);
  });
});

describe("discriminateJSON() / discriminatePNG()", () => {
  it("discriminateJSON should pass round-trippable JSON text", () => {
    assert.equal(discriminateJSON('{"a":1,"b":[2,3]}'), true);
  });

  it("discriminateJSON should fail malformed JSON text", () => {
    assert.equal(discriminateJSON("{not valid"), false);
  });

  it("discriminatePNG should pass a non-empty Blob and fail an empty/absent one", () => {
    assert.equal(discriminatePNG(new Blob([new Uint8Array([1, 2, 3])])), true);
    assert.equal(discriminatePNG(new Blob([])), false);
    assert.equal(discriminatePNG(null), false);
  });
});

describe("discriminateGLTF() -- valid JSON + topology in range", () => {
  // Build a GLTF whose embedded index buffer can be decoded and range-checked.
  function makeGltf(indices, vertexCount) {
    const pos = new Float32Array(vertexCount * 3); // zeros are fine; count is what matters
    const idx = new Uint32Array(indices);
    const combined = new Uint8Array(pos.byteLength + idx.byteLength);
    combined.set(new Uint8Array(pos.buffer), 0);
    combined.set(new Uint8Array(idx.buffer), pos.byteLength);
    const b64 = Buffer.from(combined).toString("base64");
    return JSON.stringify({
      asset: { version: "2.0" },
      buffers: [{ byteLength: combined.length, uri: "data:application/octet-stream;base64," + b64 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: pos.byteLength },
        { buffer: 0, byteOffset: pos.byteLength, byteLength: idx.byteLength },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: vertexCount, type: "VEC3" },
        { bufferView: 1, componentType: 5125, count: idx.length, type: "SCALAR" },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
      nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
    });
  }

  it("should pass a GLTF whose decoded indices are all in range", () => {
    assert.equal(discriminateGLTF(makeGltf([0, 1, 2], 3)), true);
  });

  it("should FAIL a GLTF whose decoded index buffer has an out-of-range index", () => {
    assert.equal(discriminateGLTF(makeGltf([0, 1, 9], 3)), false);
  });

  it("should fail malformed JSON", () => {
    assert.equal(discriminateGLTF("{not json"), false);
  });

  it("should pass the real exporter output for a valid mesh (end-to-end)", async () => {
    const mesh = { vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]], faces: [[0, 1, 2], [1, 3, 2]] };
    const gltf = await StudioExporters.export("gltf", {}, { mesh });
    assert.equal(discriminateGLTF(gltf), true);
  });
});

// ---------------------------------------------------------------------------
// StudioExporters.exportWithReceipt() -- end-to-end witnessed export
// ---------------------------------------------------------------------------
describe("StudioExporters.exportWithReceipt() -- receipt shape and truth", () => {
  const stubCanvas = {};
  const goodMesh = { vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], faces: [[0, 1, 2]] };
  const badMesh  = { vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], faces: [[0, 1, 9]] }; // index 9 out of range

  it("should return { blobOrString, receipt } and leave blobOrString byte-identical to export()", async () => {
    const plain = await StudioExporters.export("obj", stubCanvas, { mesh: goodMesh });
    const { blobOrString, receipt } = await StudioExporters.exportWithReceipt("obj", stubCanvas, { mesh: goodMesh });
    assert.equal(blobOrString, plain, "exportWithReceipt output must equal export() output");
    assert.ok(receipt && typeof receipt === "object", "receipt must be an object");
  });

  it("should carry every required receipt field with correct types", async () => {
    const { receipt } = await StudioExporters.exportWithReceipt("obj", stubCanvas, { mesh: goodMesh });
    assert.equal(typeof receipt.criterion, "string");
    assert.ok(Array.isArray(receipt.conserved), "conserved must be an array");
    assert.ok(Array.isArray(receipt.dropped), "dropped must be an array");
    assert.equal(typeof receipt.discriminatorPassed, "boolean");
    assert.equal(typeof receipt.originHash, "string");
    assert.equal(typeof receipt.commitHash, "string");
    assert.ok(Array.isArray(receipt.transformsApplied), "transformsApplied must be an array");
    assert.ok(receipt.transformsApplied.every(t => typeof t.step === "string" && typeof t.criterion === "string"),
      "each transform must have {step, criterion} strings");
    assert.ok(receipt.hashAlgo === HASH_SHA256 || receipt.hashAlgo === HASH_FNV1A, "hashAlgo must be one of the two honest tags");
  });

  it("should NOT carry a bare floating-point faithfulness score", async () => {
    const { receipt } = await StudioExporters.exportWithReceipt("obj", stubCanvas, { mesh: goodMesh });
    assert.ok(!("faithfulness" in receipt), "receipt must not contain a 'faithfulness' field");
    assert.ok(!("faithfulnessScore" in receipt), "receipt must not contain a 'faithfulnessScore' field");
    assert.ok(!("score" in receipt), "receipt must not contain a bare 'score' field");
  });

  it("should set discriminatorPassed=true for a valid mesh OBJ", async () => {
    const { receipt } = await StudioExporters.exportWithReceipt("obj", stubCanvas, { mesh: goodMesh });
    assert.equal(receipt.discriminatorPassed, true);
  });

  it("should set discriminatorPassed=FALSE for a malformed mesh (out-of-range face index)", async () => {
    const { receipt } = await StudioExporters.exportWithReceipt("obj", stubCanvas, { mesh: badMesh });
    assert.equal(receipt.discriminatorPassed, false, "a malformed mesh must fail the structural discriminator");
  });

  it("should set discriminatorPassed=FALSE for a malformed mesh exported as GLTF too", async () => {
    const { receipt } = await StudioExporters.exportWithReceipt("gltf", stubCanvas, { mesh: badMesh });
    assert.equal(receipt.discriminatorPassed, false);
  });

  it("should conserve [positions, faces] and drop materials for a mesh-to-OBJ with no normals", async () => {
    const { receipt } = await StudioExporters.exportWithReceipt("obj", stubCanvas, { mesh: goodMesh });
    assert.ok(receipt.conserved.includes("positions"), "must conserve positions");
    assert.ok(receipt.conserved.includes("faces"), "must conserve faces");
    assert.ok(receipt.dropped.includes("materials"), "must report materials dropped");
    assert.ok(receipt.dropped.includes("normals"), "no normals provided -> normals dropped");
    assert.ok(!receipt.conserved.includes("normals"), "normals must not be claimed conserved when absent");
  });

  it("should move normals into conserved when normals are provided", async () => {
    const meshN = {
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
      normals: [[0, 0, 1], [0, 0, 1], [0, 0, 1]],
      faces: [[0, 1, 2]],
    };
    const { receipt } = await StudioExporters.exportWithReceipt("obj", stubCanvas, { mesh: meshN });
    assert.ok(receipt.conserved.includes("normals"), "normals provided -> conserved");
    assert.ok(!receipt.dropped.includes("normals"), "normals provided -> not dropped");
  });

  it("should produce distinct originHash (input) and commitHash (output)", async () => {
    const { receipt } = await StudioExporters.exportWithReceipt("obj", stubCanvas, { mesh: goodMesh });
    assert.match(receipt.originHash, /^[0-9a-f]+$/, "originHash must be hex");
    assert.match(receipt.commitHash, /^[0-9a-f]+$/, "commitHash must be hex");
    assert.notEqual(receipt.originHash, receipt.commitHash, "input and output hashes differ");
  });

  it("should use sha-256 by default and fnv1a-fallback when subtle is forced null", async () => {
    const sha = await StudioExporters.exportWithReceipt("obj", stubCanvas, { mesh: goodMesh });
    assert.equal(sha.receipt.hashAlgo, HASH_SHA256, "default path is sha-256 in Node");

    const fb = await StudioExporters.exportWithReceipt("obj", stubCanvas, { mesh: goodMesh }, { subtle: null });
    assert.equal(fb.receipt.hashAlgo, HASH_FNV1A, "forced no-subtle path must report the fnv1a fallback");
    // Same logical content -> the sha and fnv hashes must themselves differ (different algos).
    assert.notEqual(sha.receipt.originHash, fb.receipt.originHash, "different algos yield different digests");
  });

  it("should build a JSON receipt that round-trips and reports json criterion", async () => {
    const { receipt } = await StudioExporters.exportWithReceipt("json", stubCanvas, { data: { a: 1, b: [2, 3] } });
    assert.equal(receipt.discriminatorPassed, true, "valid JSON must pass the round-trip discriminator");
    assert.equal(receipt.criterion, "json-roundtrip-exact");
  });

  it("should throw for an unknown exporter name (parity with export())", async () => {
    await assert.rejects(
      () => StudioExporters.exportWithReceipt("__no_such_format__", stubCanvas, {}),
      (err) => err instanceof Error && err.message.includes("__no_such_format__")
    );
  });
});

// ---------------------------------------------------------------------------
// buildReceipt() -- direct unit (no exporter dispatch)
// ---------------------------------------------------------------------------
describe("buildReceipt() -- direct", () => {
  it("should witness a hand-supplied OBJ output string", async () => {
    const objText = "v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n";
    const receipt = await buildReceipt("obj", {}, { mesh: { vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], faces: [[0, 1, 2]] } }, objText);
    assert.equal(receipt.discriminatorPassed, true);
    assert.equal(receipt.format, "obj");
    assert.equal(typeof receipt.commitHash, "string");
  });

  it("should record discriminatorPassed=null for a format with no structural test", async () => {
    const receipt = await buildReceipt("webm", {}, {}, "not-a-blob-string");
    // webm uses the non-empty-Blob check; a plain string is not a Blob -> false, not null.
    // A truly unknown format has no test -> null. Verify the unknown branch here.
    const unknownReceipt = await buildReceipt("totally-custom-format", {}, {}, "payload");
    assert.equal(unknownReceipt.discriminatorPassed, null, "unknown format must record null, not a faked pass");
    assert.equal(typeof receipt.discriminatorPassed, "boolean");
  });
});
