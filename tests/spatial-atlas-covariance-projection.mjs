import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _ATLAS_SHADERS } from "../system/spatial-atlas.js";

const WIDTH = 256;
const HEIGHT = 256;
const SPLAT_TEXELS = 6;
const CHROME_PATHS = [
  process.env.CHROME_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

function once(target, event) {
  return new Promise((resolve) => target.once(event, resolve));
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findFreePort() {
  const { createServer } = await import("node:net");
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  server.close();
  await once(server, "close");
  return port;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function waitForCdp(port) {
  let lastError;
  for (let i = 0; i < 80; i += 1) {
    try {
      await fetchJson(`http://127.0.0.1:${port}/json/version`);
      const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
      const pageTarget = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
      if (pageTarget) return pageTarget.webSocketDebuggerUrl;
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw lastError || new Error("Chrome remote debugging endpoint did not open");
}

function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      resolve({
        send(method, params = {}) {
          const id = nextId;
          nextId += 1;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((requestResolve, requestReject) => {
            pending.set(id, { resolve: requestResolve, reject: requestReject });
          });
        },
        close() {
          socket.close();
        },
      });
    }, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
}

async function withChrome(callback) {
  const port = await findFreePort();
  const userDataDir = mkdtempSync(join(tmpdir(), "atlas-covariance-"));
  let browser;
  let chromePath;
  for (const candidate of CHROME_PATHS) {
    try {
      browser = spawn(candidate, [
        "--headless=new",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--enable-unsafe-swiftshader",
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        "about:blank",
      ], { stdio: "ignore" });
      chromePath = candidate;
      break;
    } catch (_) {
      browser = null;
    }
  }
  if (!browser) throw new Error(`No Chrome-compatible executable found in: ${CHROME_PATHS.join(", ")}`);
  try {
    const wsUrl = await waitForCdp(port);
    const cdp = await connectCdp(wsUrl);
    try {
      await cdp.send("Runtime.enable");
      await cdp.send("Page.enable");
      await cdp.send("Page.navigate", {
        url: `data:text/html,<canvas id="c" width="${WIDTH}" height="${HEIGHT}"></canvas>`,
      });
      await sleep(100);
      return await callback(cdp, chromePath);
    } finally {
      cdp.close();
    }
  } finally {
    browser.kill();
    await Promise.race([once(browser, "exit"), sleep(2000)]);
    for (let i = 0; i < 10; i += 1) {
      try {
        rmSync(userDataDir, { recursive: true, force: true });
        break;
      } catch (error) {
        if (i === 9) throw error;
        await sleep(100);
      }
    }
  }
}

function browserProbeSource() {
  function probe(input) {
    const { vertexSource, fragmentSource, width, height, scales, rotationRadians, splatTexels } = input;
    const canvas = document.getElementById("c");
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error("WebGL2 unavailable");

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || "shader compile failed");
      }
      return shader;
    }

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource.replace(/SPLAT_TEXELS/g, String(6))));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "shader link failed");
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const index = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, index);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint32Array([0]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribIPointer(1, 1, gl.UNSIGNED_INT, 0, 0);
    gl.vertexAttribDivisor(1, 1);

    const half = rotationRadians * 0.5;
    const quat = [Math.cos(half), 0, 0, Math.sin(half)];
    const textureData = new Float32Array(splatTexels * 4);
    textureData.set([0, 0, -2, 1], 0);
    textureData.set([scales[0], scales[1], scales[2], quat[0]], 4);
    textureData.set([quat[1], quat[2], quat[3], 1], 8);
    textureData.set([0, 0, 1, 0], 12);
    textureData.set([0, 0, 0, 0], 16);
    textureData.set([0, 0, 0, 0], 20);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, splatTexels, 1, 0, gl.RGBA, gl.FLOAT, textureData);
    const textureError = gl.getError();
    if (textureError !== gl.NO_ERROR) throw new Error(`texture upload failed: ${textureError}`);

    const view = new Float32Array(16);
    view[0] = view[5] = view[10] = view[15] = 1;
    const projection = new Float32Array(16);
    const near = 0.015;
    const far = 60;
    projection[0] = 1;
    projection[5] = 1;
    projection[10] = (far + near) / (near - far);
    projection[11] = -1;
    projection[14] = 2 * far * near / (near - far);

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "uView"), false, view);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "uProjection"), false, projection);
    gl.uniform1f(gl.getUniformLocation(program, "uSplatScale"), 1);
    gl.uniform1f(gl.getUniformLocation(program, "uDepthScale"), 1);
    gl.uniform1i(gl.getUniformLocation(program, "uMode"), 0);
    gl.uniform1f(gl.getUniformLocation(program, "uTime"), 0);
    gl.uniform3f(gl.getUniformLocation(program, "uEye"), 0, 0, 0);
    gl.uniform2f(gl.getUniformLocation(program, "uViewport"), width, height);
    gl.uniform3f(gl.getUniformLocation(program, "uInvCenter"), 0, 0, 0);
    gl.uniform1f(gl.getUniformLocation(program, "uInvRadius"), 1);
    gl.uniform1f(gl.getUniformLocation(program, "uInvStrength"), 0);
    gl.uniform1f(gl.getUniformLocation(program, "uInvExponent"), 1);
    gl.uniform1f(gl.getUniformLocation(program, "uInvShell"), 0);
    gl.uniform1f(gl.getUniformLocation(program, "uInvThickness"), 0);
    gl.uniform1f(gl.getUniformLocation(program, "uInvTwist"), 0);
    gl.uniform1f(gl.getUniformLocation(program, "uInvInner"), 0);
    gl.uniform1f(gl.getUniformLocation(program, "uInvOuter"), 10);
    gl.uniform1f(gl.getUniformLocation(program, "uHoloStrength"), 0);
    gl.uniform1f(gl.getUniformLocation(program, "uOpacityScale"), 1);
    gl.uniform1f(gl.getUniformLocation(program, "uExposure"), 1);
    gl.uniform1f(gl.getUniformLocation(program, "uGamma"), 1);
    gl.uniform1f(gl.getUniformLocation(program, "uIridescence"), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(program, "uSplatData"), 0);
    gl.uniform1i(gl.getUniformLocation(program, "uDataWidth"), splatTexels);
    gl.bindVertexArray(vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, 1);
    const drawError = gl.getError();
    if (drawError !== gl.NO_ERROR) throw new Error(`draw failed: ${drawError}`);

    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    let covered = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (pixels[(y * width + x) * 4 + 3] > 0) {
          covered += 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!covered) throw new Error("shader drew no pixels");
    return {
      bounds: { minX, maxX, minY, maxY },
      footprint: { width: maxX - minX + 1, height: maxY - minY + 1 },
      covered,
      renderer: gl.getParameter(gl.RENDERER),
      vendor: gl.getParameter(gl.VENDOR),
    };
  }
  return probe;
}

async function renderProbe(cdp, scales, rotationRadians = 0) {
  const expression = `(${browserProbeSource().toString()})(${JSON.stringify({
    vertexSource: _ATLAS_SHADERS.vertex,
    fragmentSource: _ATLAS_SHADERS.fragment,
    width: WIDTH,
    height: HEIGHT,
    scales,
    rotationRadians,
    splatTexels: SPLAT_TEXELS,
  })})`;
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description
      || result.exceptionDetails.exception?.value
      || result.exceptionDetails.text
      || "browser probe failed";
    throw new Error(detail);
  }
  return result.result.value;
}

function assertVertical(name, result) {
  assert.ok(result.footprint.height > result.footprint.width * 2,
    `${name}: expected vertical major axis, got ${result.footprint.width}x${result.footprint.height}`);
}

function assertHorizontal(name, result) {
  assert.ok(result.footprint.width > result.footprint.height * 2,
    `${name}: expected horizontal major axis, got ${result.footprint.width}x${result.footprint.height}`);
}

function assertNearSquare(name, result) {
  const delta = Math.abs(result.footprint.width - result.footprint.height);
  assert.ok(delta <= 2, `${name}: expected near-square footprint, got ${result.footprint.width}x${result.footprint.height}`);
}

await withChrome(async (cdp, chromePath) => {
  const vertical = await renderProbe(cdp, [0.08, 0.48, 0.01], 0);
  const horizontal = await renderProbe(cdp, [0.48, 0.08, 0.01], 0);
  const isotropic = await renderProbe(cdp, [0.26, 0.26, 0.01], 0);
  const nearAxisVertical = await renderProbe(cdp, [0.08, 0.48, 0.01], 1e-6);

  assertVertical("axis-aligned vertical covariance", vertical);
  assertHorizontal("axis-aligned horizontal covariance", horizontal);
  assertNearSquare("isotropic covariance", isotropic);
  assertVertical("near-axis vertical covariance", nearAxisVertical);

  console.log(JSON.stringify({
    chromePath,
    renderer: vertical.renderer,
    cases: { vertical, horizontal, isotropic, nearAxisVertical },
  }, null, 2));
});
