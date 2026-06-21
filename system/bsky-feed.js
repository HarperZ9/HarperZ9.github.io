/* bsky-feed.js — a living window onto iamBeTa's photography, pulled straight
   from her public Bluesky. Public AT-Protocol read (no auth, no key), entirely
   client-side. Every frame links back to her own post — the point is to send
   people TO her, not to lift her work. Fails gracefully to a link if the
   network or the API is unavailable, and never blocks the page. */
(function () {
  "use strict";
  var mount = document.getElementById("bsky-feed");
  if (!mount) return;
  var HANDLE = "iambeta.bsky.social";
  var API = "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=" + HANDLE + "&filter=posts_with_media&limit=40";

  function esc(s) { return String(s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function fallback() {
    mount.innerHTML = '<p class="bsky-fallback">Her work lives on Bluesky &mdash; <a href="https://bsky.app/profile/' + HANDLE + '" target="_blank" rel="noopener">@' + HANDLE + '</a>.</p>';
  }

  function render(items) {
    if (!items.length) { fallback(); return; }
    var frag = document.createDocumentFragment();
    items.forEach(function (it) {
      var a = document.createElement("a");
      a.className = "bsky-item"; a.href = it.url; a.target = "_blank"; a.rel = "noopener";
      a.setAttribute("aria-label", "View this photograph on Bluesky");
      var img = document.createElement("img");
      img.src = it.thumb; img.loading = "lazy"; img.decoding = "async"; img.alt = esc(it.alt);
      a.appendChild(img); frag.appendChild(a);
    });
    mount.innerHTML = ""; mount.appendChild(frag); mount.classList.add("bsky-loaded");
  }

  function load() {
    if (!window.fetch) { fallback(); return; }
    var done = false, guard = setTimeout(function () { if (!done) fallback(); }, 8000);
    fetch(API, { headers: { "Accept": "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("bsky " + r.status); return r.json(); })
      .then(function (d) {
        done = true; clearTimeout(guard);
        var feed = (d && d.feed) || [], items = [], seen = {};
        feed.forEach(function (it) {
          if (it.reason) return;                                   // skip reposts — her own work only
          var post = it.post || {};
          if (!post.author || post.author.handle !== HANDLE) return;
          if (post.labels && post.labels.length) return;           // skip labelled posts
          var emb = post.embed || {};
          var images = emb.images || (emb.media && emb.media.images) || [];
          if (!images.length) return;
          var rkey = (post.uri || "").split("/").pop();
          var url = "https://bsky.app/profile/" + HANDLE + "/post/" + rkey;
          var text = (post.record && post.record.text) || "";
          images.forEach(function (img) {
            if (img.thumb && !seen[img.thumb]) { seen[img.thumb] = 1; items.push({ thumb: img.thumb, alt: img.alt || text || "Macro photograph by iamBeTa", url: url }); }
          });
        });
        render(items.slice(0, 24));
      })
      .catch(function () { done = true; clearTimeout(guard); fallback(); });
  }

  // lazy: fetch just before it scrolls into view
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { io.disconnect(); load(); } });
    }, { rootMargin: "500px" });
    io.observe(mount);
  } else load();
})();
