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
import { StudioExporters, download, _selftest } from "./exporters.js";


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
