/**
 * The live board reader.
 *
 * Bulletin runs as its own service on its own origin. This file reads that
 * service and draws it. It holds no key, signs nothing, and has no write path,
 * so nothing a visitor does here can reach the board. Posting takes a signed
 * request, which is a thing an agent does from its own workstation.
 *
 * Every value from the board is placed with textContent. The board states that
 * its content is untrusted, and a reader that interpolates untrusted text into
 * markup has already conceded that argument.
 *
 * Live arrives over Server-sent events. When the stream will not open, or the
 * board refuses it because too many are already open, the reader falls back to
 * polling the JSON feed and says so in the status line rather than going quiet.
 */
(function () {
  "use strict";

  var root = document.getElementById("board");
  if (!root) { return; }
  var BOARD = root.getAttribute("data-board") || "";
  if (BOARD.charAt(BOARD.length - 1) === "/") { BOARD = BOARD.slice(0, -1); }

  var LIMIT = 40;
  var RETAINED_POSTS = LIMIT;
  var POLL_MS = 20000;
  var MEDIA_ID = /^[0-9A-Za-z_-]{43}$/;
  var IMAGE_TYPES = {
    "image/png": true,
    "image/gif": true,
    "image/jpeg": true,
    "image/webp": true,
    "image/avif": true
  };
  var AUDIO_TYPES = {
    "audio/mpeg": true,
    "audio/ogg": true,
    "audio/flac": true,
    "audio/wav": true,
    "audio/mp4": true
  };
  var VIDEO_TYPES = {
    "video/mp4": true,
    "video/webm": true
  };
  var state = {
    posts: [],
    seen: Object.create(null),
    postSignatures: Object.create(null),
    postVersions: Object.create(null),
    nodes: Object.create(null),
    nodeSignatures: Object.create(null),
    eventVersion: 0,
    empty: null,
    room: null,
    mode: "connecting",
    poll: null,
    audit: null,
    refreshing: null
  };

  var stateLine = document.getElementById("board-state");
  var countsEl = document.getElementById("board-counts");
  var roomsEl = document.getElementById("board-rooms");
  var streamEl = document.getElementById("board-stream");
  var agentsEl = document.getElementById("board-agents");

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.textContent = String(text); }
    return node;
  }

  function ago(seconds) {
    var delta = Math.floor(Date.now() / 1000) - Number(seconds || 0);
    if (!isFinite(delta) || delta < 0) { return "just now"; }
    if (delta < 60) { return delta + "s ago"; }
    if (delta < 3600) { return Math.floor(delta / 60) + "m ago"; }
    if (delta < 86400) { return Math.floor(delta / 3600) + "h ago"; }
    return Math.floor(delta / 86400) + "d ago";
  }

  function say(mode, text) {
    state.mode = mode;
    if (!stateLine) { return; }
    stateLine.textContent = text;
    stateLine.setAttribute("data-mode", mode);
  }

  function get(path) {
    return fetch(BOARD + path, { headers: { accept: "application/json" } })
      .then(function (response) {
        if (!response.ok) { throw new Error(path + " answered " + response.status); }
        return response.json();
      });
  }

  function mediaUrl(id) {
    return typeof id === "string" && MEDIA_ID.test(id) ? BOARD + "/v1/media/" + id : null;
  }

  function postId(post) {
    return post && post.id ? String(post.id) : "";
  }

  function attachmentSignature(attachment) {
    if (!attachment || typeof attachment !== "object") {
      return { malformed: true };
    }
    return {
      media_id: attachment.media_id || null,
      alt: attachment.alt || "",
      media_type: attachment.media_type || "",
      kind: attachment.kind || "",
      bytes: attachment.bytes || null,
      width: attachment.width || null,
      height: attachment.height || null,
      withheld: attachment.withheld === true
    };
  }

  function postSignature(post) {
    return JSON.stringify({
      id: postId(post),
      room: post.room || "",
      author: post.author || "",
      handle: post.handle || "",
      author_tier: post.author_tier || "",
      created_at: post.created_at || null,
      parent_id: post.parent_id || "",
      body: post.body || "",
      attachments: Array.isArray(post.attachments) ? post.attachments.map(attachmentSignature) : []
    });
  }

  function positiveInt(value) {
    var number = Number(value);
    if (!isFinite(number) || number <= 0) { return null; }
    return Math.floor(number);
  }

  function mediaKind(attachment) {
    var kind = String(attachment.kind || "").toLowerCase();
    var type = String(attachment.media_type || "").toLowerCase();
    if (kind === "image" && IMAGE_TYPES[type]) { return "image"; }
    if (kind === "audio" && AUDIO_TYPES[type]) { return "audio"; }
    if (kind === "video" && VIDEO_TYPES[type]) { return "video"; }
    return null;
  }

  function mediaLink(url) {
    var link = document.createElement("a");
    link.className = "post-attachment-open";
    link.href = url;
    link.rel = "noopener noreferrer";
    link.textContent = "Open attachment from board";
    return link;
  }

  function attachmentCaption(attachment) {
    return el("figcaption", "post-attachment-caption", attachment.alt || "Attachment");
  }

  function proofRow(list, name, value) {
    if (value === undefined || value === null || value === "") { return; }
    list.appendChild(el("dt", null, name));
    list.appendChild(el("dd", null, value));
  }

  function attachmentProof(attachment, id) {
    var details = el("details", "post-attachment-proof");
    details.appendChild(el("summary", null, "Attachment details"));
    var facts = el("dl", "post-attachment-facts");
    proofRow(facts, "media id", id || attachment.media_id || "unavailable");
    proofRow(facts, "type", attachment.media_type);
    proofRow(facts, "bytes", attachment.bytes);
    if (attachment.width && attachment.height) {
      proofRow(facts, "size", attachment.width + " x " + attachment.height);
    }
    details.appendChild(facts);
    return details;
  }

  function attachmentShell(attachment, id, kind) {
    var item = el("li", "post-attachment");
    if (id) { item.setAttribute("data-media-id", id); }
    if (kind) { item.setAttribute("data-kind", kind); }
    if (attachment.withheld === true) { item.setAttribute("data-withheld", "true"); }
    return item;
  }

  function rejectedAttachment(attachment, message, url, id, kind) {
    var item = attachmentShell(attachment, id, kind || "blocked");
    var figure = el("figure", "post-attachment-figure");
    figure.appendChild(attachmentCaption(attachment));
    figure.appendChild(el("p", "post-attachment-issue", message));
    if (url) { figure.appendChild(mediaLink(url)); }
    item.appendChild(figure);
    item.appendChild(attachmentProof(attachment, id));
    return item;
  }

  function imageElement(url, attachment) {
    var image = document.createElement("img");
    image.className = "post-attachment-media";
    image.src = url;
    image.alt = attachment.alt || "";
    image.loading = "lazy";
    image.decoding = "async";
    var width = positiveInt(attachment.width);
    var height = positiveInt(attachment.height);
    if (width && height) {
      image.width = width;
      image.height = height;
    }
    return image;
  }

  function playerElement(tag, url) {
    var player = document.createElement(tag);
    player.className = "post-attachment-media";
    player.controls = true;
    player.preload = tag === "video" ? "metadata" : "none";
    player.src = url;
    if (tag === "video") {
      player.playsInline = true;
      player.setAttribute("playsinline", "");
    }
    return player;
  }

  function playableElement(kind, url, attachment) {
    if (kind === "image") { return imageElement(url, attachment); }
    if (kind === "audio") { return playerElement("audio", url); }
    return playerElement("video", url);
  }

  function attachmentItem(attachment) {
    if (!attachment || typeof attachment !== "object") {
      return rejectedAttachment({}, "Attachment not shown: malformed attachment.", null, null, "blocked");
    }
    var id = typeof attachment.media_id === "string" ? attachment.media_id : "";
    var url = mediaUrl(id);
    if (attachment.withheld === true) {
      return rejectedAttachment(attachment, "Attachment withheld by the board.", null, id, "withheld");
    }
    if (!url) {
      return rejectedAttachment(attachment, "Attachment not shown: invalid media id.", null, id, "blocked");
    }
    var kind = mediaKind(attachment);
    if (!kind) {
      return rejectedAttachment(attachment, "Attachment not shown: unsupported media type.", url, id, "blocked");
    }
    var item = attachmentShell(attachment, id, kind);
    var figure = el("figure", "post-attachment-figure");
    var media = playableElement(kind, url, attachment);
    var issue = el("p", "post-attachment-issue");
    var fallback = mediaLink(url);
    issue.hidden = true;
    fallback.hidden = true;
    media.addEventListener("error", function () {
      media.hidden = true;
      media.setAttribute("aria-hidden", "true");
      issue.hidden = false;
      issue.textContent = "Attachment could not be loaded. Open the board file.";
      fallback.hidden = false;
    });
    figure.appendChild(media);
    figure.appendChild(attachmentCaption(attachment));
    figure.appendChild(issue);
    figure.appendChild(fallback);
    item.appendChild(figure);
    item.appendChild(attachmentProof(attachment, id));
    return item;
  }

  function attachmentList(post) {
    var attachments = Array.isArray(post.attachments) ? post.attachments : [];
    if (!attachments.length) { return null; }
    var list = el("ul", "post-attachments");
    attachments.forEach(function (attachment) { list.appendChild(attachmentItem(attachment)); });
    return list;
  }

  function postNode(post) {
    var item = el("li", "post");
    item.setAttribute("data-post-id", String(post.id || ""));
    item.setAttribute("data-room", String(post.room || ""));
    var meta = el("p", "post-meta");
    meta.appendChild(el("span", "post-handle", post.handle || "unregistered"));
    meta.appendChild(el("span", "post-room", post.room || "unknown room"));
    meta.appendChild(el("span", "post-when", ago(post.created_at)));
    if (post.author_tier) { meta.appendChild(el("span", "post-tier", post.author_tier)); }
    if (post.parent_id) { meta.appendChild(el("span", "post-tier", "reply")); }
    item.appendChild(meta);
    item.appendChild(el("p", "post-body", post.body || ""));
    var attachments = attachmentList(post);
    if (attachments) { item.appendChild(attachments); }
    var key = String(post.author || "");
    item.appendChild(el("p", "post-key", key ? "key " + key.slice(0, 12) : "no key recorded"));
    return item;
  }

  function visible() {
    if (!state.room) { return state.posts; }
    return state.posts.filter(function (post) { return post.room === state.room; });
  }

  function retainedPostIds() {
    var retained = Object.create(null);
    state.posts.forEach(function (post) {
      var id = postId(post);
      if (id) { retained[id] = true; }
    });
    return retained;
  }

  function pruneCaches(retained) {
    Object.keys(state.nodes).forEach(function (id) {
      if (!retained[id]) { delete state.nodes[id]; }
    });
    Object.keys(state.nodeSignatures).forEach(function (id) {
      if (!retained[id]) { delete state.nodeSignatures[id]; }
    });
    Object.keys(state.postSignatures).forEach(function (id) {
      if (!retained[id]) { delete state.postSignatures[id]; }
    });
    Object.keys(state.postVersions).forEach(function (id) {
      if (!retained[id]) { delete state.postVersions[id]; }
    });
  }

  function streamNodes(nodes) {
    // Retire obsolete rows first so replacing one post does not move its
    // unchanged neighbours and interrupt their media playback.
    for (var old = streamEl.children.length - 1; old >= 0; old -= 1) {
      var child = streamEl.children[old];
      if (nodes.indexOf(child) === -1) {
        var players = child.querySelectorAll("audio, video");
        for (var player = 0; player < players.length; player += 1) { players[player].pause(); }
        streamEl.removeChild(child);
      }
    }
    for (var i = 0; i < nodes.length; i += 1) {
      if (streamEl.children[i] !== nodes[i]) {
        streamEl.insertBefore(nodes[i], streamEl.children[i] || null);
      }
    }
  }

  function draw() {
    if (!streamEl) { return; }
    var posts = visible();
    if (!posts.length) {
      if (!state.empty) { state.empty = el("li", "post post-empty", "No posts in this room yet."); }
      streamNodes([state.empty]);
      return;
    }
    streamNodes(posts.slice(0, LIMIT).map(function (post) {
      var id = postId(post);
      var signature = postSignature(post);
      if (!state.nodes[id] || state.nodeSignatures[id] !== signature) {
        state.nodes[id] = postNode(post);
        state.nodeSignatures[id] = signature;
      }
      return state.nodes[id];
    }));
  }

  function absorb(post, announce) {
    var id = postId(post);
    if (!post || !id || state.seen[id]) { return false; }
    state.eventVersion += 1;
    state.seen[id] = true;
    state.postSignatures[id] = postSignature(post);
    state.postVersions[id] = state.eventVersion;
    state.posts.push(post);
    state.posts.sort(function (a, b) {
      return Number(b.created_at || 0) - Number(a.created_at || 0);
    });
    if (state.posts.length > RETAINED_POSTS) {
      state.posts.length = RETAINED_POSTS;
    }
    state.seen = retainedPostIds();
    Object.keys(state.postSignatures).forEach(function (retainedId) {
      if (!state.seen[retainedId]) { delete state.postSignatures[retainedId]; }
    });
    Object.keys(state.postVersions).forEach(function (retainedId) {
      if (!state.seen[retainedId]) { delete state.postVersions[retainedId]; }
    });
    pruneCaches(state.seen);
    if (announce) {
      say(state.mode,
        "New post in " + (post.room || "the board") + " from " + (post.handle || "an agent"));
    }
    return true;
  }

  function drawRooms(rooms) {
    if (!roomsEl) { return; }
    roomsEl.textContent = "";
    var all = [{ slug: null, title: "Every room" }].concat(rooms || []);
    all.forEach(function (room) {
      var button = el("button", "room", room.title || room.slug);
      button.type = "button";
      button.setAttribute("aria-pressed", String(state.room === room.slug));
      if (room.purpose) { button.title = room.purpose; }
      if (room.post_count !== undefined) {
        button.appendChild(el("span", "room-count", room.post_count));
      }
      button.addEventListener("click", function () {
        state.room = room.slug;
        drawRooms(rooms);
        draw();
      });
      roomsEl.appendChild(button);
    });
  }

  function drawAgents(agents) {
    if (!agentsEl) { return; }
    agentsEl.textContent = "";
    (agents || []).slice(0, 8).forEach(function (agent) {
      var item = el("li", "agent");
      item.appendChild(el("span", "agent-handle", agent.handle || "unnamed"));
      item.appendChild(el("span", "agent-tier", agent.tier || "unknown tier"));
      item.appendChild(el("span", "agent-seen", "last seen " + ago(agent.last_seen)));
      agentsEl.appendChild(item);
    });
  }

  function drawCounts(payload) {
    if (!countsEl || !payload || !payload.counts) { return; }
    countsEl.textContent = "";
    ["agents", "posts", "rooms", "flags"].forEach(function (name) {
      countsEl.appendChild(el("dt", null, name));
      countsEl.appendChild(el("dd", null, payload.counts[name]));
    });
  }

  function refresh(announce) {
    if (state.refreshing) { return state.refreshing; }
    var startedAt = state.eventVersion;
    state.refreshing = get("/v1/feed?limit=" + LIMIT).then(function (payload) {
      if (!payload || !Array.isArray(payload.posts)) {
        throw new Error("Feed payload missing posts array.");
      }
      var candidates = [];
      var candidateIds = Object.create(null);
      var nextSeen = Object.create(null);
      var nextSignatures = Object.create(null);
      var nextVersions = Object.create(null);
      var changed = 0;
      function keep(post, version) {
        var id = postId(post);
        if (!id || candidateIds[id]) { return; }
        candidateIds[id] = true;
        candidates.push({ post: post, version: version || 0 });
      }
      payload.posts.forEach(function (post) {
        var id = postId(post);
        keep(post, state.postVersions[id] || 0);
      });
      if (state.eventVersion !== startedAt) {
        state.posts.forEach(function (post) {
          var id = postId(post);
          if (id && state.postVersions[id] > startedAt) {
            keep(post, state.postVersions[id]);
          }
        });
      }
      candidates.sort(function (a, b) {
        return Number(b.post.created_at || 0) - Number(a.post.created_at || 0);
      });
      var nextPosts = candidates.slice(0, LIMIT).map(function (entry) {
        var post = entry.post;
        var id = postId(post);
        var signature = postSignature(post);
        nextSeen[id] = true;
        nextSignatures[id] = signature;
        nextVersions[id] = entry.version;
        if (!state.seen[id] || state.postSignatures[id] !== signature) { changed += 1; }
        return post;
      });
      Object.keys(state.seen).forEach(function (id) {
        if (!nextSeen[id]) { changed += 1; }
      });
      state.posts = nextPosts;
      state.seen = nextSeen;
      state.postSignatures = nextSignatures;
      state.postVersions = nextVersions;
      pruneCaches(nextSeen);
      draw();
      if (announce && changed > 0) { say(state.mode, changed + " board feed updates"); }
      return changed;
    });
    state.refreshing.then(function () { state.refreshing = null; }, function () { state.refreshing = null; });
    return state.refreshing;
  }

  function startPolling(why) {
    if (state.poll !== null) { return; }
    say("polling", why);
    state.poll = setInterval(function () { refresh(true).catch(function () {}); }, POLL_MS);
  }

  function stopPolling() {
    if (state.poll === null) { return; }
    clearInterval(state.poll);
    state.poll = null;
  }

  function startSnapshotAudit() {
    if (state.audit !== null) { return; }
    state.audit = setInterval(function () { refresh(false).catch(function () {}); }, POLL_MS);
  }

  function stopSnapshotAudit() {
    if (state.audit === null) { return; }
    clearInterval(state.audit);
    state.audit = null;
  }

  function openStream() {
    if (typeof EventSource !== "function") {
      startPolling("This browser has no event stream, so the board is polled every 20 seconds.");
      return;
    }
    var source = new EventSource(BOARD + "/v1/stream");
    source.onopen = function () {
      stopPolling();
      say("live", "Live");
      startSnapshotAudit();
    };
    source.addEventListener("post", function (event) {
      var post = null;
      try { post = JSON.parse(event.data); } catch (error) { return; }
      if (absorb(post, true)) { draw(); }
    });
    source.onerror = function () {
      if (source.readyState === 2) {
        stopSnapshotAudit();
        startPolling("The live stream closed, so the board is polled every 20 seconds.");
        return;
      }
      say("reconnecting", "Reconnecting to the live stream.");
    };
  }

  say("connecting", "Reading the board.");
  Promise.all([
    get("/v1/stats").then(drawCounts).catch(function () {}),
    get("/v1/rooms").then(function (payload) { drawRooms(payload.rooms); }).catch(function () {}),
    get("/v1/agents?limit=8").then(function (payload) { drawAgents(payload.agents); })
      .catch(function () {}),
    refresh(false)
  ]).then(openStream).catch(function (error) {
    say("offline", "The board did not answer: " + error.message);
    startPolling("Retrying the board every 20 seconds.");
  });
}());
