import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CHROME_PARTS = ["C:", "Program Files", "Google", "Chrome", "Application", "chrome.exe"];
const CHROME = process.env.CHROME_PATH || [DEFAULT_CHROME_PARTS.join("\\"), "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync);
const LIVE_BOARD = "https://bulletin.zaindharper.workers.dev";
const MP4_FIXTURE = resolve(ROOT, "media", "demos", "index", "index-verified-workspace-short-30s.mp4");
const IDS = {
  image: "A".repeat(43),
  audio: "B".repeat(43),
  video: "C".repeat(43),
  invalid: "D".repeat(43),
  unsupported: "E".repeat(43),
  withheld: "F".repeat(43),
  noAlt: "G".repeat(43),
  live: "H".repeat(43),
};

function contentType(filePath) {
  switch (extname(filePath).toLowerCase()) {
    case ".html": return "text/html; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".js":
    case ".mjs": return "text/javascript; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    case ".mp4": return "video/mp4";
    case ".woff": return "font/woff";
    case ".woff2": return "font/woff2";
    default: return "application/octet-stream";
  }
}

function tinyPng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGNk+M+ABzAxMDAwMAAAOQAFAYh6mQAAAABJRU5ErkJggg==",
    "base64",
  );
}

function tinyWav() {
  const sampleRate = 8000;
  const durationSeconds = 0.2;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const value = Math.round(Math.sin((index / sampleRate) * 440 * Math.PI * 2) * 0x2fff);
    buffer.writeInt16LE(value, 44 + index * 2);
  }
  return buffer;
}

function fixtureScript(boardOrigin, scenario) {
  return `
<script>
const BOARD = ${JSON.stringify(boardOrigin)};
const SCENARIO = ${JSON.stringify(scenario)};
const IDS = ${JSON.stringify(IDS)};
const posts = [
  {
    id: "image-post",
    room: "studio",
    author: "image-key",
    handle: "image-agent",
    created_at: 1788722917,
    body: "inline image and hostile body <img id=owned src=x onerror=alert(1)> https://evil.example/pixel.png",
    attachments: [
      { media_id: IDS.image, alt: "a four by four test pattern", media_type: "image/png", kind: "image", bytes: 85, width: 4, height: 4, url: "https://evil.example/not-the-board.png" },
      { media_id: "not-a-media-id<script>", alt: "bad id <img src=x onerror=alert(1)>", media_type: "image/png", kind: "image", bytes: 12, width: 1, height: 1, url: "https://evil.example/payload.png" },
      { media_id: IDS.unsupported, alt: "an svg that must not run <script>alert(1)<\\/script>", media_type: "image/svg+xml", kind: "image", bytes: 333, width: 20, height: 20, url: "https://evil.example/payload.svg" },
      { media_id: IDS.withheld, alt: "a withheld sketch", media_type: "image/png", kind: "image", withheld: true, url: null },
      { media_id: IDS.noAlt, media_type: "image/png", kind: "image", bytes: 80, width: 4, height: 4 }
    ],
    content_is_untrusted: true
  },
  {
    id: "audio-post",
    room: "music",
    author: "audio-key",
    handle: "music-agent",
    created_at: 1788722900,
    body: "a short generated tone",
    attachments: [
      { media_id: IDS.audio, alt: "a short generated tone", media_type: "audio/wav", kind: "audio", bytes: 3244, url: "https://evil.example/tone.wav" }
    ],
    content_is_untrusted: true
  },
  {
    id: "video-post",
    room: "video",
    author: "video-key",
    handle: "video-agent",
    created_at: 1788722890,
    body: "a public demo clip",
    attachments: [
      { media_id: IDS.video, alt: "a checked in demo clip", media_type: "video/mp4", kind: "video", bytes: 664964, width: 640, height: 360, url: "https://evil.example/clip.mp4" }
    ],
    content_is_untrusted: true
  },
  {
    id: "plain-post",
    room: "studio",
    author: "plain-key",
    handle: "plain-agent",
    created_at: 1788722880,
    body: "body-only URL https://evil.example/media.png and markup <iframe src=https://evil.example></iframe>",
    attachments: [],
    content_is_untrusted: true
  }
];
let feedPosts = posts.slice();
window.__feedReads = 0;
window.__intervals = [];
window.__errors = [];
window.EventSource = class {
  constructor() {
    this.readyState = 1;
    this.listeners = {};
    window.__source = this;
    setTimeout(() => this.onopen?.(), 0);
  }
  addEventListener(name, callback) { this.listeners[name] = callback; }
};
window.setInterval = (fn) => {
  window.__intervals.push(fn);
  return window.__intervals.length;
};
window.clearInterval = () => {};
window.addEventListener("error", (event) => {
  window.__errors.push(String(event.error && event.error.message || event.message || event.type));
});
window.fetch = async (input) => {
  const url = String(input);
  if (!url.startsWith(BOARD)) {
    return { ok: false, status: 404, json: async () => ({}) };
  }
  let body = {};
  if (url.includes("/v1/feed")) {
    window.__feedReads += 1;
    if (SCENARIO === "feed-error") {
      return { ok: false, status: 503, json: async () => ({}) };
    }
    body = { posts: feedPosts };
  } else if (url.includes("/v1/stats")) {
    body = { counts: { agents: 3, posts: feedPosts.length, rooms: 3, flags: 0 } };
  } else if (url.includes("/v1/rooms")) {
    body = { rooms: [
      { slug: "studio", title: "Studio", purpose: "image room", post_count: 2 },
      { slug: "music", title: "Music", purpose: "audio room", post_count: 1 },
      { slug: "video", title: "Video", purpose: "video room", post_count: 1 }
    ] };
  } else if (url.includes("/v1/agents")) {
    body = { agents: [{ handle: "image-agent", tier: "probation", last_seen: 1788722917 }] };
  }
  return { ok: true, json: async () => body };
};
function waitFor(fn, label) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 5000;
    const tick = () => {
      try {
        if (fn()) {
          resolve();
          return;
        }
      } catch (error) {
        reject(error);
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error("timed out waiting for " + label));
        return;
      }
      setTimeout(tick, 25);
    };
    tick();
  });
}
function button(filter) {
  return document.querySelector('[data-board-filter="' + filter + '"]');
}
function rows() {
  return Array.from(document.querySelectorAll("#board-stream > .post")).map((post) => post.getAttribute("data-post-id") || post.textContent.trim());
}
function counts() {
  return Object.fromEntries(Array.from(document.querySelectorAll("[data-board-filter]")).map((control) => [
    control.getAttribute("data-board-filter"),
    Number(control.querySelector(".board-filter-count")?.textContent || NaN)
  ]));
}
function mediaById(id, selector) {
  return document.querySelector('[data-media-id="' + id + '"] ' + selector);
}
async function loadMedia() {
  const image = mediaById(IDS.image, "img");
  const audio = mediaById(IDS.audio, "audio");
  const video = mediaById(IDS.video, "video");
  if (audio) { audio.load(); }
  if (video) { video.load(); }
  await waitFor(() => image?.complete && image.naturalWidth > 0, "image fixture load");
  await waitFor(() => audio?.readyState >= 1, "audio fixture metadata");
  await waitFor(() => video?.readyState >= 1, "video fixture metadata");
  return {
    imageNaturalWidth: image?.naturalWidth || 0,
    audioReadyState: audio?.readyState || 0,
    videoReadyState: video?.readyState || 0,
    imageSrc: image?.src || "",
    audioSrc: audio?.src || "",
    videoSrc: video?.src || "",
  };
}
async function refreshWith(nextPosts) {
  feedPosts = nextPosts;
  const before = window.__feedReads;
  window.__intervals[0]();
  await waitFor(() => window.__feedReads > before, "snapshot refresh");
  await new Promise((resolve) => setTimeout(resolve, 0));
}
async function collectNormal() {
  await waitFor(() => document.querySelectorAll("#board-stream > [data-post-id]").length === 4, "initial loaded posts");
  await waitFor(() => document.querySelectorAll("[data-board-filter]").length === 5, "media filter buttons");
  const image = mediaById(IDS.image, "img");
  const loadedMedia = await loadMedia();
  const initial = {
    labels: Array.from(document.querySelectorAll("[data-board-filter]")).map((control) => control.textContent.replace(/\\s+/g, " ").trim()),
    aria: Array.from(document.querySelectorAll("[data-board-filter]")).map((control) => ({
      filter: control.getAttribute("data-board-filter"),
      pressed: control.getAttribute("aria-pressed"),
      label: control.getAttribute("aria-label"),
      type: control.getAttribute("type"),
      minHeight: getComputedStyle(control).minHeight,
    })),
    counts: counts(),
    rows: rows(),
    summary: document.querySelector("#board-filter-summary")?.textContent || "",
    note: document.querySelector("#board-filter-note")?.textContent || "",
    loadedMedia,
    hostileParsed: document.querySelectorAll("#board #owned, #board iframe, #board script").length,
    hostileTextPreserved: Array.from(document.querySelectorAll(".post-body")).some((node) => (node.textContent || "").includes("<iframe")),
    externalMediaSources: Array.from(document.querySelectorAll("#board [src]")).filter((node) => String(node.getAttribute("src")).includes("evil.example")).length,
    issueText: Array.from(document.querySelectorAll(".post-attachment-issue")).map((node) => node.textContent || ""),
  };

  const audio = mediaById(IDS.audio, "audio");
  const video = mediaById(IDS.video, "video");
  let hiddenPauses = 0;
  audio.pause = () => { hiddenPauses += 1; };
  video.pause = () => { hiddenPauses += 1; };
  button("image").click();
  await waitFor(() => rows().length === 1 && rows()[0] === "image-post", "image filter rows");
  const imageFilter = {
    rows: rows(),
    counts: counts(),
    pressed: button("image").getAttribute("aria-pressed"),
    allPressed: button("all").getAttribute("aria-pressed"),
    hiddenPauses,
    visiblePlayers: document.querySelectorAll("#board-stream audio, #board-stream video").length,
  };

  document.querySelector('[data-room-filter="music"]').click();
  await waitFor(() => document.querySelector("#board-stream").textContent.includes("No image posts"), "selected empty state");
  const musicEmpty = {
    rows: rows(),
    text: document.querySelector("#board-stream").textContent,
    counts: counts(),
    summary: document.querySelector("#board-filter-summary")?.textContent || "",
  };

  const livePost = {
    id: "music-image-live",
    room: "music",
    author: "live-key",
    handle: "live-agent",
    created_at: 1788724000,
    body: "a live image in the music room",
    attachments: [
      { media_id: IDS.live, alt: "a live posted image", media_type: "image/png", kind: "image", bytes: 85, width: 4, height: 4 }
    ],
    content_is_untrusted: true
  };
  window.__source.listeners.post({ data: JSON.stringify(livePost) });
  await waitFor(() => rows()[0] === "music-image-live", "live matching media row");
  const liveUpdate = {
    rows: rows(),
    counts: counts(),
  };

  document.querySelector('[data-room-filter="all"]').click();
  button("all").click();
  const beforeRefresh = window.__feedReads;
  window.__intervals[0]();
  await waitFor(() => window.__feedReads > beforeRefresh, "unchanged refresh");
  await new Promise((resolve) => setTimeout(resolve, 0));
  const preservedAfterUnrelatedRefresh = image === mediaById(IDS.image, "img");
  await refreshWith(Array.from({ length: 55 }, (_, index) => ({
    id: "retained-" + index,
    room: index % 2 ? "music" : "studio",
    author: "retention-key",
    handle: "retention-agent",
    created_at: 1788730000 - index,
    body: "retention row " + index,
    attachments: index % 10 === 0 ? [{ media_id: IDS.image, alt: "retained image " + index, media_type: "image/png", kind: "image", bytes: 85, width: 4, height: 4 }] : [],
    content_is_untrusted: true
  })));
  const retention = {
    rows: document.querySelectorAll("#board-stream > [data-post-id]").length,
    counts: counts(),
  };

  return {
    errors: window.__errors,
    initial,
    imageFilter,
    musicEmpty,
    liveUpdate,
    preservedAfterUnrelatedRefresh,
    retention,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
}
async function collectError() {
  await waitFor(() => document.querySelector("#board-state").getAttribute("data-mode") === "polling", "polling status");
  return {
    controls: Array.from(document.querySelectorAll("[data-board-filter]")).map((control) => control.textContent.replace(/\\s+/g, " ").trim()),
    text: document.querySelector("#board-stream").textContent,
    summary: document.querySelector("#board-filter-summary")?.textContent || "",
    counts: counts(),
    mode: document.querySelector("#board-state").getAttribute("data-mode"),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
}
window.addEventListener("load", () => {
  const run = SCENARIO === "feed-error" ? collectError : collectNormal;
  run().then((result) => {
    const out = document.createElement("pre");
    out.id = "bulletin-result";
    out.textContent = JSON.stringify(result);
    document.body.appendChild(out);
  }).catch((error) => {
    const out = document.createElement("pre");
    out.id = "bulletin-result";
    out.textContent = JSON.stringify({ harnessError: String(error && error.message || error), errors: window.__errors });
    document.body.appendChild(out);
  });
});
</script>`;
}

async function bulletinPage(boardOrigin, scenario) {
  const page = await readFile(resolve(ROOT, "bulletin.html"), "utf8");
  return page
    .replaceAll(LIVE_BOARD, boardOrigin)
    .replace(
      /<script src="system\/bulletin-board\.js[^"]*" defer><\/script>/,
      `${fixtureScript(boardOrigin, scenario)}\n<script src="/system/bulletin-board.js" defer></script>`,
    )
    .replace(/<script src="system\/bulletin-work\.js[^"]*" defer><\/script>/, "");
}

async function writeMediaResponse(request, response, body, type) {
  const range = request.headers.range;
  if (range) {
    const match = range.match(/^bytes=(\d+)-(\d*)$/);
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : body.length - 1;
      const chunk = body.subarray(start, Math.min(end, body.length - 1) + 1);
      response.writeHead(206, {
        "Content-Type": type,
        "Content-Length": chunk.length,
        "Content-Range": `bytes ${start}-${start + chunk.length - 1}/${body.length}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      });
      response.end(chunk);
      return;
    }
  }
  response.writeHead(200, {
    "Content-Type": type,
    "Content-Length": body.length,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  });
  response.end(body);
}

async function startServer(scenario) {
  const requests = [];
  const png = tinyPng();
  const wav = tinyWav();
  const mp4 = await readFile(MP4_FIXTURE);
  let origin = "";
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(requestUrl.pathname);
    try {
      if (pathname === "/bulletin-filter-test.html") {
        const body = await bulletinPage(origin, scenario);
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        response.end(body);
        return;
      }
      if (pathname.startsWith("/v1/media/")) {
        requests.push(pathname);
        const id = pathname.split("/").pop();
        if (id === IDS.audio) {
          await writeMediaResponse(request, response, wav, "audio/wav");
          return;
        }
        if (id === IDS.video) {
          await writeMediaResponse(request, response, mp4, "video/mp4");
          return;
        }
        await writeMediaResponse(request, response, png, "image/png");
        return;
      }
      const relative = pathname.replace(/^\/+/, "") || "index.html";
      const filePath = resolve(ROOT, relative);
      if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${sep}`)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const payload = await readFile(filePath);
      response.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
      response.end(payload);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  origin = `http://127.0.0.1:${address.port}`;
  return { server, origin, requests };
}

function dumpPage(url, viewport) {
  return new Promise(async (resolveDump, reject) => {
    let userDataDir;
    try {
      userDataDir = await mkdtemp(resolve(tmpdir(), "bulletin-filter-chrome-"));
    } catch (error) {
      reject(error);
      return;
    }
    const child = spawn(CHROME, [
      "--headless=new",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      `--user-data-dir=${userDataDir}`,
      `--window-size=${viewport.width},${viewport.height}`,
      "--virtual-time-budget=11000",
      "--dump-dom",
      url,
    ], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Chrome timed out while dumping ${url}: ${stderr.trim()}`));
    }, 22000);
    const cleanup = () => rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => {
      clearTimeout(timer);
      void cleanup();
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      void cleanup();
      if (code !== 0) reject(new Error(`Chrome exited ${code}: ${stderr.trim()}`));
      else resolveDump(stdout);
    });
  });
}

function decodePre(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function resultFromDom(dom) {
  const match = dom.match(/<pre id="bulletin-result">([^<]+)<\/pre>/);
  assert.ok(match, dom.slice(-3000));
  return JSON.parse(decodePre(match[1]));
}

test("loaded feed media filters expose real media, inert text, room-aware counts, and pause hidden players", async (t) => {
  if (!CHROME || !existsSync(CHROME)) {
    if (process.env.CI) assert.fail("Chrome is required in CI; configure CHROME_PATH.");
    return t.skip("Chrome executable not found; configure CHROME_PATH.");
  }

  const { server, origin, requests } = await startServer("normal");
  let result;
  try {
    const dom = await dumpPage(`${origin}/bulletin-filter-test.html`, { width: 390, height: 900 });
    result = resultFromDom(dom);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }

  assert.deepEqual(result.errors, []);
  assert.equal(result.harnessError, undefined);
  assert.equal(result.overflow, false);
  assert.deepEqual(result.initial.counts, { all: 4, media: 3, image: 1, audio: 1, video: 1 });
  assert.deepEqual(result.initial.rows, ["image-post", "audio-post", "video-post", "plain-post"]);
  assert.deepEqual(result.initial.labels, ["All posts 4", "Media 3", "Images 1", "Audio 1", "Video 1"]);
  assert.ok(result.initial.summary.includes("loaded feed"));
  assert.ok(result.initial.note.includes("Changing filters pauses hidden audio or video"));
  assert.deepEqual(result.initial.aria.map((item) => item.filter), ["all", "media", "image", "audio", "video"]);
  assert.deepEqual(result.initial.aria.map((item) => item.pressed), ["true", "false", "false", "false", "false"]);
  assert.ok(result.initial.aria.every((item) => item.type === "button"));
  assert.ok(result.initial.aria.every((item) => item.label.includes("loaded feed")));
  assert.ok(result.initial.aria.every((item) => item.minHeight === "44px"));
  assert.equal(result.initial.loadedMedia.imageNaturalWidth, 4);
  assert.ok(result.initial.loadedMedia.audioReadyState >= 1);
  assert.ok(result.initial.loadedMedia.videoReadyState >= 1);
  assert.equal(result.initial.loadedMedia.imageSrc, `${origin}/v1/media/${IDS.image}`);
  assert.equal(result.initial.loadedMedia.audioSrc, `${origin}/v1/media/${IDS.audio}`);
  assert.equal(result.initial.loadedMedia.videoSrc, `${origin}/v1/media/${IDS.video}`);
  assert.ok(requests.includes(`/v1/media/${IDS.image}`));
  assert.ok(requests.includes(`/v1/media/${IDS.audio}`));
  assert.ok(requests.includes(`/v1/media/${IDS.video}`));
  assert.equal(result.initial.hostileParsed, 0);
  assert.equal(result.initial.hostileTextPreserved, true);
  assert.equal(result.initial.externalMediaSources, 0);
  assert.ok(result.initial.issueText.some((text) => text.includes("invalid media id")));
  assert.ok(result.initial.issueText.some((text) => text.includes("unsupported media type")));
  assert.ok(result.initial.issueText.some((text) => text.includes("withheld")));
  assert.ok(result.initial.issueText.some((text) => text.includes("missing alt text")));
  assert.deepEqual(result.imageFilter.rows, ["image-post"]);
  assert.equal(result.imageFilter.pressed, "true");
  assert.equal(result.imageFilter.allPressed, "false");
  assert.equal(result.imageFilter.hiddenPauses, 2);
  assert.equal(result.imageFilter.visiblePlayers, 0);
  assert.deepEqual(result.musicEmpty.counts, { all: 1, media: 1, image: 0, audio: 1, video: 0 });
  assert.ok(result.musicEmpty.text.includes("No image posts in the loaded Music feed"));
  assert.ok(result.musicEmpty.summary.includes("Music"));
  assert.deepEqual(result.liveUpdate.rows, ["music-image-live"]);
  assert.deepEqual(result.liveUpdate.counts, { all: 2, media: 2, image: 1, audio: 1, video: 0 });
  assert.equal(result.preservedAfterUnrelatedRefresh, true);
  assert.equal(result.retention.rows, 40);
  assert.equal(result.retention.counts.all, 40);
  assert.equal(result.retention.counts.image, 4);
});

test("loaded feed media filters keep a useful state when the feed cannot be read", async (t) => {
  if (!CHROME || !existsSync(CHROME)) {
    if (process.env.CI) assert.fail("Chrome is required in CI; configure CHROME_PATH.");
    return t.skip("Chrome executable not found; configure CHROME_PATH.");
  }

  const { server, origin } = await startServer("feed-error");
  let result;
  try {
    const dom = await dumpPage(`${origin}/bulletin-filter-test.html`, { width: 390, height: 900 });
    result = resultFromDom(dom);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }

  assert.equal(result.mode, "polling");
  assert.equal(result.overflow, false);
  assert.deepEqual(result.counts, { all: 0, media: 0, image: 0, audio: 0, video: 0 });
  assert.deepEqual(result.controls, ["All posts 0", "Media 0", "Images 0", "Audio 0", "Video 0"]);
  assert.ok(result.text.includes("The loaded feed could not be read"));
  assert.ok(result.text.includes("Retrying"));
  assert.ok(result.summary.includes("Loaded feed unavailable"));
});
