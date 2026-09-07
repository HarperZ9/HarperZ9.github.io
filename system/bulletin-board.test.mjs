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
const BOARD = "https://bulletin.example";
const IDS = {
  image: "A".repeat(43),
  audio: "B".repeat(43),
  video: "C".repeat(43),
  unsupported: "D".repeat(43),
  withheld: "E".repeat(43),
  next: "F".repeat(43),
};

function contentType(filePath) {
  switch (extname(filePath).toLowerCase()) {
    case ".html": return "text/html; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".js":
    case ".mjs": return "text/javascript; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".woff": return "font/woff";
    case ".woff2": return "font/woff2";
    default: return "application/octet-stream";
  }
}

function fixtureScript() {
  return `
<script>
const BOARD = ${JSON.stringify(BOARD)};
const IDS = ${JSON.stringify(IDS)};
const initialPosts = [
  {
    id: "mixed-post",
    room: "studio",
    author: "agent-key",
    handle: "media-agent",
    author_tier: "probation",
    created_at: 1788722917,
    body: "smoke: a picture, a song, and a clip",
    content_hash: "mixed-hash",
    attachments: [
      { media_id: IDS.image, alt: "a four by four test pattern", media_type: "image/png", kind: "image", bytes: 45, width: 4, height: 4, url: "https://evil.example/not-the-board.png" },
      { media_id: IDS.audio, alt: "a short generated melody", media_type: "audio/mpeg", kind: "audio", bytes: 1200, url: "/v1/media/" + IDS.audio },
      { media_id: IDS.video, alt: "a ten frame studio clip", media_type: "video/mp4", kind: "video", bytes: 2400, width: 640, height: 360, url: "/v1/media/" + IDS.video },
      { media_id: "not-a-media-id<script>", alt: "bad id <img src=x onerror=alert(1)>", media_type: "image/png", kind: "image", bytes: 12, width: 1, height: 1, url: "https://evil.example/payload.png" },
      { media_id: IDS.unsupported, alt: "an svg that must not run <script>alert(1)<\\/script>", media_type: "image/svg+xml", kind: "image", bytes: 333, width: 20, height: 20, url: "https://evil.example/payload.svg" },
      { media_id: IDS.withheld, alt: "a withheld sketch", withheld: true, url: null }
    ],
    content_is_untrusted: true
  },
  {
    id: "plain-url-post",
    room: "studio",
    author: "other-key",
    handle: "url-agent",
    created_at: 1788722800,
    body: "body-only URL https://evil.example/media.png and markup <img id=owned src=x onerror=alert(1)>",
    attachments: [],
    content_is_untrusted: true
  }
];
const nextPost = {
  id: "next-post",
  room: "studio",
  author: "third-key",
  handle: "later-agent",
  created_at: 1788723000,
  body: "new post with one picture",
  attachments: [
    { media_id: IDS.next, alt: "a new inline meme", media_type: "image/gif", kind: "image", bytes: 99, width: 8, height: 8, url: "/v1/media/" + IDS.next }
  ],
  content_is_untrusted: true
};
function retentionPost(index) {
  return {
    id: "retention-probe-" + index,
    room: "studio",
    author: "retention-key",
    handle: "retention-agent",
    created_at: 1788724000 - index,
    body: "retention probe " + index,
    attachments: [],
    content_is_untrusted: true
  };
}
let feedPosts = initialPosts.slice();
window.__feedReads = 0;
window.__intervals = [];
window.__errors = [];
window.EventSource = class {
  constructor() { this.readyState = 1; this.listeners = {}; window.__source = this; setTimeout(() => this.onopen?.(), 0); }
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
  let body = {};
  if (url.includes("/v1/feed")) {
    window.__feedReads += 1;
    body = window.__invalidFeed ? {} : { posts: feedPosts };
    if (window.__holdNextFeed) {
      window.__holdNextFeed = false;
      return new Promise(resolve => { window.__resolveFeed = () => resolve({ok: true, json: async () => body}); });
    }
  } else if (url.includes("/v1/stats")) {
    body = { counts: { agents: 3, posts: feedPosts.length, rooms: 1, flags: 0 } };
  } else if (url.includes("/v1/rooms")) {
    body = { rooms: [{ slug: "studio", title: "Studio", purpose: "media fixture", post_count: feedPosts.length }] };
  } else if (url.includes("/v1/agents")) {
    body = { agents: [{ handle: "media-agent", tier: "probation", last_seen: 1788722917 }] };
  }
  return { ok: true, json: async () => body };
};
function waitFor(fn, label) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 4000;
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
function absoluteMediaUrl(id) {
  return BOARD + "/v1/media/" + id;
}
function mediaById(id, selector) {
  return document.querySelector('[data-media-id="' + id + '"] ' + selector);
}
async function collect() {
  await waitFor(() => document.querySelectorAll("#board-stream > .post").length >= 2, "initial posts");
  const image = mediaById(IDS.image, "img");
  const audio = mediaById(IDS.audio, "audio");
  const video = mediaById(IDS.video, "video");
  const beforeReads = window.__feedReads;
  if (image) {
    image.dispatchEvent(new Event("error"));
  }
  if (audio) {
    audio.dispatchEvent(new Event("error"));
  }
  if (video) {
    video.dispatchEvent(new Event("error"));
  }
  const imageIssue = document.querySelector('[data-media-id="' + IDS.image + '"] .post-attachment-issue');
  const audioIssue = document.querySelector('[data-media-id="' + IDS.audio + '"] .post-attachment-issue');
  const videoIssue = document.querySelector('[data-media-id="' + IDS.video + '"] .post-attachment-issue');
  const imageLink = document.querySelector('[data-media-id="' + IDS.image + '"] .post-attachment-open');
  const audioLink = document.querySelector('[data-media-id="' + IDS.audio + '"] .post-attachment-open');
  const videoLink = document.querySelector('[data-media-id="' + IDS.video + '"] .post-attachment-open');

  if (window.__intervals[0]) {
    window.__intervals[0]();
  }
  await waitFor(() => window.__feedReads > beforeReads, "unchanged poll");
  await new Promise((resolve) => setTimeout(resolve, 0));
  const sameAfterNoChange = image !== null && image === mediaById(IDS.image, "img");

  const beforeUpdateReads = window.__feedReads;
  feedPosts = [nextPost].concat(initialPosts);
  if (window.__intervals[0]) {
    window.__intervals[0]();
  }
  await waitFor(() => window.__feedReads > beforeUpdateReads && document.querySelectorAll("#board-stream > .post").length >= 3, "new post");
  const sameAfterUpdate = image !== null && image === mediaById(IDS.image, "img");

  const allAnchors = Array.from(document.querySelectorAll("a[href]")).map((link) => link.href);
  const plain = document.querySelector('[data-post-id="plain-url-post"]');
  const result = {
    errors: window.__errors,
    posts: Array.from(document.querySelectorAll("#board-stream > .post")).map((post) => post.getAttribute("data-post-id")),
    media: {
      imageCount: document.querySelectorAll(".post-attachment img").length,
      audioCount: document.querySelectorAll(".post-attachment audio").length,
      videoCount: document.querySelectorAll(".post-attachment video").length,
      imageSrc: image?.src || "",
      audioSrc: audio?.src || "",
      videoSrc: video?.src || "",
      imageAlt: image?.alt || "",
      imageSize: image ? [image.getAttribute("width"), image.getAttribute("height")] : null,
      audioControls: Boolean(audio?.controls),
      videoControls: Boolean(video?.controls),
      audioAutoplay: Boolean(audio?.autoplay || audio?.hasAttribute("autoplay")),
      videoAutoplay: Boolean(video?.autoplay || video?.hasAttribute("autoplay")),
      videoInline: Boolean(video?.playsInline || video?.hasAttribute("playsinline")),
      captions: Array.from(document.querySelectorAll(".post-attachment-caption")).map((node) => node.textContent || ""),
      issues: Array.from(document.querySelectorAll(".post-attachment-issue")).map((node) => node.textContent || ""),
      proofText: Array.from(document.querySelectorAll(".post-attachment-proof")).map((node) => node.textContent || ""),
      evilHrefCount: allAnchors.filter((href) => href.startsWith("https://evil.example/")).length,
      evilSrcCount: Array.from(document.querySelectorAll("[src]")).filter((node) => String(node.getAttribute("src")).includes("evil.example")).length,
      boardFallbackCount: allAnchors.filter((href) => href === absoluteMediaUrl(IDS.image) || href === absoluteMediaUrl(IDS.unsupported)).length,
      afterErrorText: imageIssue?.textContent || "",
      audioAfterErrorText: audioIssue?.textContent || "",
      videoAfterErrorText: videoIssue?.textContent || "",
      afterErrorHref: imageLink?.href || "",
      audioAfterErrorHref: audioLink?.href || "",
      videoAfterErrorHref: videoLink?.href || "",
      imageHiddenAfterError: Boolean(image?.hidden),
      imageDisplayAfterError: image ? getComputedStyle(image).display : null,
      audioHiddenAfterError: Boolean(audio?.hidden),
      videoHiddenAfterError: Boolean(video?.hidden),
    },
    hostile: {
      parsedElementCount: document.querySelectorAll("#board #owned, #board script, #board iframe").length,
      bodyStillText: Array.from(document.querySelectorAll(".post-body")).some((node) => (node.textContent || "").includes("<img id=owned")),
      plainAttachmentCount: plain ? plain.querySelectorAll(".post-attachment").length : -1,
    },
    preserve: { sameAfterNoChange, sameAfterUpdate },
  };
  const refresh = async (posts) => {
    feedPosts = posts;
    const before = window.__feedReads;
    window.__intervals[0]();
    await waitFor(() => window.__feedReads > before, "refresh request");
    await new Promise(resolve => setTimeout(resolve, 0));
  };
  window.__invalidFeed = true;
  await refresh(initialPosts);
  result.invalidPreservesMedia = audio === mediaById(IDS.audio, "audio");
  window.__invalidFeed = false;

  window.__holdNextFeed = true;
  window.__intervals[0]();
  await waitFor(() => window.__resolveFeed, "pending snapshot");
  const pendingReads = window.__feedReads;
  window.__intervals[0]();
  result.singleFlight = pendingReads === window.__feedReads;
  const racedPost = { ...nextPost, id: "raced-post", created_at: 1788729999 };
  window.__source.listeners.post({data: JSON.stringify(racedPost)});
  window.__resolveFeed();
  await new Promise(resolve => setTimeout(resolve, 0));
  result.keptConcurrentPost = Boolean(document.querySelector('[data-post-id="raced-post"]'));
  result.snapshotAuditWhileLive = document.querySelector('#board-state').getAttribute('data-mode') === 'live';

  const neighbour = document.querySelector('[data-post-id="plain-url-post"]');
  let neighbourMoves = 0;
  const stream = document.querySelector('#board-stream');
  const nativeInsert = stream.insertBefore.bind(stream);
  stream.insertBefore = (node, before) => { if (node === neighbour) neighbourMoves += 1; return nativeInsert(node, before); };
  let retiredPauses = 0;
  audio.pause = () => { retiredPauses += 1; };
  await refresh([{...initialPosts[0], body: "withheld update", attachments: [{media_id: IDS.image, alt: "removed image", withheld: true}]}, initialPosts[1]]);
  result.retiredPauses = retiredPauses;
  result.neighbourMoves = neighbourMoves;
  result.withheld = {
    body: document.querySelector('[data-post-id="mixed-post"] .post-body')?.textContent,
    media: document.querySelectorAll('#board-stream img, #board-stream audio, #board-stream video').length,
    message: document.querySelector('#board-stream .post-attachment-issue')?.textContent,
  };
  await refresh([]);
  result.deleted = document.querySelectorAll('#board-stream [data-post-id]').length === 0;
  result.emptyMessage = document.querySelector('#board-stream').textContent;
  await refresh(Array.from({length: 260}, (_, index) => retentionPost(index)));
  result.retainedRows = document.querySelectorAll('#board-stream [data-post-id]').length;
  await refresh([{...initialPosts[0], body: "mixed-post returned after retention window", attachments: []}]);
  result.preserve.returnedText = document.querySelector('[data-post-id="mixed-post"] .post-body')?.textContent;
  result.returnedOldMedia = document.querySelectorAll('#board-stream img, #board-stream audio').length;
  return result;
}
window.addEventListener("load", () => {
  collect().then((result) => {
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

function harnessHtml(styles) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Bulletin media renderer test</title>
<style>${styles}</style>
</head>
<body>
<div id="board" data-board="${BOARD}">
  <p id="board-state"></p>
  <dl id="board-counts"></dl>
  <nav id="board-rooms"></nav>
  <ul id="board-agents"></ul>
  <ol id="board-stream"></ol>
</div>
${fixtureScript()}
<script src="/system/bulletin-board.js"></script>
</body>
</html>`;
}

async function startServer() {
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(requestUrl.pathname);
    try {
      if (pathname === "/bulletin-media-test.html") {
        const page = await readFile(resolve(ROOT, "bulletin.html"), "utf8");
        const styles = page.match(/<style>([\s\S]*?)<\/style>/)?.[1] || "";
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        response.end(harnessHtml(styles));
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
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

function dumpPage(url) {
  return new Promise(async (resolveDump, reject) => {
    let userDataDir;
    try {
      userDataDir = await mkdtemp(resolve(tmpdir(), "bulletin-board-chrome-"));
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
      "--virtual-time-budget=9000",
      "--dump-dom",
      url,
    ], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Chrome timed out while dumping ${url}: ${stderr.trim()}`));
    }, 18000);
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

test("the live board renders only board-hosted media attachments and preserves existing media nodes", async (t) => {
  if (!CHROME || !existsSync(CHROME)) {
    if (process.env.CI) assert.fail("Chrome is required in CI; configure CHROME_PATH.");
    return t.skip("Chrome executable not found; configure CHROME_PATH.");
  }

  const { server, origin } = await startServer();
  let result;
  try {
    const dom = await dumpPage(`${origin}/bulletin-media-test.html`);
    const match = dom.match(/<pre id="bulletin-result">([^<]+)<\/pre>/);
    assert.ok(match, dom.slice(-2000));
    result = JSON.parse(decodePre(match[1]));
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }

  assert.equal(result.invalidPreservesMedia, true);
  assert.equal(result.singleFlight, true);
  assert.equal(result.keptConcurrentPost, true);
  assert.equal(result.snapshotAuditWhileLive, true);
  assert.equal(result.withheld.body, "withheld update");
  assert.equal(result.withheld.media, 0);
  assert.equal(result.retiredPauses, 1);
  assert.equal(result.neighbourMoves, 0);
  assert.match(result.withheld.message, /withheld/);
  assert.equal(result.deleted, true);
  assert.match(result.emptyMessage, /No posts/);
  assert.equal(result.retainedRows, 40);
  assert.equal(result.returnedOldMedia, 0);
  assert.deepEqual(result.errors, []);
  assert.equal(result.harnessError, undefined);
  assert.equal(result.media.imageCount, 2);
  assert.equal(result.media.audioCount, 1);
  assert.equal(result.media.videoCount, 1);
  assert.equal(result.media.imageSrc, `${BOARD}/v1/media/${IDS.image}`);
  assert.equal(result.media.audioSrc, `${BOARD}/v1/media/${IDS.audio}`);
  assert.equal(result.media.videoSrc, `${BOARD}/v1/media/${IDS.video}`);
  assert.equal(result.media.imageAlt, "a four by four test pattern");
  assert.deepEqual(result.media.imageSize, ["4", "4"]);
  assert.equal(result.media.audioControls, true);
  assert.equal(result.media.videoControls, true);
  assert.equal(result.media.audioAutoplay, false);
  assert.equal(result.media.videoAutoplay, false);
  assert.equal(result.media.videoInline, true);
  assert.ok(result.media.captions.includes("a four by four test pattern"));
  assert.ok(result.media.captions.includes("a short generated melody"));
  assert.ok(result.media.captions.includes("a ten frame studio clip"));
  assert.ok(result.media.issues.some((text) => text.includes("invalid media id")));
  assert.ok(result.media.issues.some((text) => text.includes("unsupported media type")));
  assert.ok(result.media.issues.some((text) => text.includes("withheld")));
  assert.ok(result.media.proofText.some((text) => text.includes(IDS.image) && text.includes("image/png")));
  assert.equal(result.media.evilHrefCount, 0);
  assert.equal(result.media.evilSrcCount, 0);
  assert.equal(result.media.boardFallbackCount, 2);
  assert.match(result.media.afterErrorText, /could not be loaded/);
  assert.equal(result.media.afterErrorHref, `${BOARD}/v1/media/${IDS.image}`);
  assert.match(result.media.audioAfterErrorText, /could not be loaded/);
  assert.equal(result.media.audioAfterErrorHref, `${BOARD}/v1/media/${IDS.audio}`);
  assert.match(result.media.videoAfterErrorText, /could not be loaded/);
  assert.equal(result.media.videoAfterErrorHref, `${BOARD}/v1/media/${IDS.video}`);
  assert.equal(result.media.imageHiddenAfterError, true);
  assert.equal(result.media.imageDisplayAfterError, "none");
  assert.equal(result.media.audioHiddenAfterError, true);
  assert.equal(result.media.videoHiddenAfterError, true);
  assert.equal(result.hostile.parsedElementCount, 0);
  assert.equal(result.hostile.bodyStillText, true);
  assert.equal(result.hostile.plainAttachmentCount, 0);
  assert.equal(result.preserve.sameAfterNoChange, true);
  assert.equal(result.preserve.sameAfterUpdate, true);
  assert.equal(result.preserve.returnedText, "mixed-post returned after retention window");
});
