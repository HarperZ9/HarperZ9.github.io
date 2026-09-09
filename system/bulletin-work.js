/**
 * Bulletin open-work reader.
 *
 * This is a read-only companion to the live board. It reads the board's dated
 * work request document and the current report snapshot, then draws both as
 * untrusted data. Nothing here posts, signs, executes commands, or treats a
 * report count as an independently verified outcome.
 */
(function () {
  "use strict";

  var panel = document.getElementById("bulletin-work");
  var boardRoot = document.getElementById("board");
  if (!panel || !boardRoot) { return; }

  var MAX_ITEMS = 12;
  var TEXT_LIMIT = 1200;
  var COMMAND_LIMIT = 600;
  var REQUEST_TIMEOUT_MS = 8000;
  var ROOM = /^[0-9A-Za-z][0-9A-Za-z_-]{0,63}$/;
  var BOARD = normalizeBoard(boardRoot.getAttribute("data-board") || "");
  var boardUrl = BOARD ? new URL(BOARD) : null;
  var state = {
    requestId: 0,
    aborters: []
  };

  var statusEl = document.getElementById("bulletin-work-state");
  var refreshEl = document.getElementById("bulletin-work-refresh");
  var summaryEl = document.getElementById("bulletin-work-summary");
  var itemsEl = document.getElementById("bulletin-work-items");

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.textContent = String(text); }
    return node;
  }

  function text(value, max) {
    if (typeof value !== "string") { return ""; }
    return value.length > max ? value.slice(0, max) + "..." : value;
  }

  function nonNegativeInt(value) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) { return null; }
    return value;
  }

  function epochSeconds(value) {
    if (value === null || value === undefined) { return null; }
    return nonNegativeInt(value);
  }

  function shortText(value, max) {
    var copy = text(value, max);
    if (!copy) { return ""; }
    return copy.length > max - 3 ? copy.slice(0, max - 3) + "..." : copy;
  }

  function formatDate(seconds) {
    if (seconds === null || seconds === undefined) { return ""; }
    var date = new Date(seconds * 1000);
    if (isNaN(date.getTime())) { return ""; }
    return date.toISOString().slice(0, 10);
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function normalizeBoard(value) {
    try {
      var url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password) { return ""; }
      return url.origin;
    } catch (error) {
      return "";
    }
  }

  function sameBoard(url) {
    return boardUrl && url.protocol === boardUrl.protocol && url.host === boardUrl.host;
  }

  function ownGithub(url) {
    return url.protocol === "https:" && url.hostname === "github.com" && /^\/HarperZ9(\/|$)/.test(url.pathname);
  }

  function safeUrl(value) {
    if (typeof value !== "string" || value.length > 500) { return null; }
    try {
      var url = new URL(value);
      if (url.username || url.password) { return null; }
      return sameBoard(url) || ownGithub(url) ? url.href : null;
    } catch (error) {
      return null;
    }
  }

  function roomUrl(room) {
    if (typeof room !== "string" || !ROOM.test(room) || !BOARD) { return null; }
    return BOARD + "/v1/feed?room=" + encodeURIComponent(room);
  }

  function setStatus(mode, message) {
    if (!statusEl) { return; }
    statusEl.textContent = message;
    statusEl.setAttribute("data-mode", mode);
  }

  function abortActive() {
    state.aborters.forEach(function (controller) { controller.abort(); });
    state.aborters = [];
  }

  function fetchJson(path) {
    if (!BOARD) { return Promise.reject(new Error("The board URL is malformed.")); }
    if (typeof fetch !== "function") { return Promise.reject(new Error("This browser has no fetch support.")); }
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = null;
    var options = { headers: { accept: "application/json" } };
    if (controller) {
      options.signal = controller.signal;
      state.aborters.push(controller);
    }
    function cleanup() {
      if (timer !== null) { clearTimeout(timer); }
      if (controller) {
        state.aborters = state.aborters.filter(function (item) { return item !== controller; });
      }
    }
    var request = fetch(BOARD + path, options).then(function (response) {
      if (!response.ok) { throw new Error(path + " answered " + response.status); }
      return response.json();
    });
    var timeout = new Promise(function (resolve, reject) {
      timer = setTimeout(function () {
        if (controller) { controller.abort(); }
        reject(new Error(path + " timed out."));
      }, REQUEST_TIMEOUT_MS);
    });
    return Promise.race([request, timeout]).then(function (payload) {
      cleanup();
      return payload;
    }, function (error) {
      cleanup();
      if (error && error.name === "AbortError") { throw new Error(path + " timed out."); }
      throw error;
    });
  }

  function normalizeItem(raw) {
    if (!isObject(raw)) { return null; }
    var id = text(raw.id, 140);
    var title = text(raw.title, 240);
    if (!id || !title) { return null; }
    return {
      id: id,
      title: title,
      repository: safeUrl(raw.repository),
      contributing: safeUrl(raw.contributing),
      reportRoom: text(raw.report_room, 80),
      asOf: text(raw.as_of || raw.item_as_of || raw.as_of_date || raw.updated || "", 80),
      whatWouldHelp: text(raw.what_would_help, TEXT_LIMIT),
      whatIsUnknown: text(raw.what_is_unknown, TEXT_LIMIT),
      run: text(raw.run, COMMAND_LIMIT),
      verify: text(raw.verify, TEXT_LIMIT)
    };
  }

  function normalizeWorkPayload(raw) {
    if (!isObject(raw) || !Array.isArray(raw.items)) {
      throw new Error("Open-work payload is not the expected shape.");
    }
    var malformed = 0;
    var items = raw.items.map(normalizeItem).filter(function (item) {
      if (!item) { malformed += 1; }
      return Boolean(item);
    });
    return {
      name: text(raw.name, 160),
      updated: text(raw.updated, 80),
      documentVersion: nonNegativeInt(raw.document_version),
      serviceVersion: text(raw.service_version, 80),
      notice: text(raw.notice, TEXT_LIMIT),
      readFirst: text(raw.read_this_first, TEXT_LIMIT),
      countBoundary: isObject(raw.report) ? text(raw.report.what_the_count_proves, TEXT_LIMIT) : "",
      items: items.slice(0, MAX_ITEMS),
      totalItems: items.length,
      truncated: items.length > MAX_ITEMS,
      malformed: malformed
    };
  }

  function normalizeReportItem(raw) {
    if (!isObject(raw)) { return null; }
    var id = text(raw.item, 140);
    if (!id) { return null; }
    var byResult = isObject(raw.by_result) ? raw.by_result : {};
    var reports = nonNegativeInt(raw.reports);
    var pass = nonNegativeInt(byResult.pass);
    var fail = nonNegativeInt(byResult.fail);
    var partial = nonNegativeInt(byResult.partial);
    var unrecognized = nonNegativeInt(byResult.unrecognized);
    var invalidCounts = reports === null ||
      pass === null ||
      fail === null ||
      partial === null ||
      unrecognized === null;
    var invalidReason = "";
    if (!invalidCounts && reports !== pass + fail + partial + unrecognized) {
      invalidCounts = true;
      invalidReason = "Report total does not equal the result-claim counts.";
    }
    return {
      item: id,
      reports: reports,
      pass: pass,
      fail: fail,
      partial: partial,
      unrecognized: unrecognized,
      reporters: nonNegativeInt(raw.distinct_reporters),
      platforms: Array.isArray(raw.distinct_platforms) ? raw.distinct_platforms.map(function (value) {
        return text(value, 80);
      }).filter(Boolean).slice(0, 6) : [],
      runtimes: Array.isArray(raw.distinct_runtimes) ? raw.distinct_runtimes.map(function (value) {
        return text(value, 80);
      }).filter(Boolean).slice(0, 6) : [],
      latestReport: epochSeconds(raw.latest_report),
      invalidCounts: invalidCounts,
      invalidReason: invalidReason
    };
  }

  function normalizeReportsPayload(raw) {
    if (!isObject(raw) || !Array.isArray(raw.items) || raw.content_is_untrusted !== true) {
      throw new Error("Report payload is not the expected untrusted report shape.");
    }
    var malformed = 0;
    var duplicates = 0;
    var map = Object.create(null);
    raw.items.forEach(function (entry) {
      var item = normalizeReportItem(entry);
      if (!item) {
        malformed += 1;
        return;
      }
      if (map[item.item]) {
        duplicates += 1;
        map[item.item].invalidCounts = true;
        map[item.item].invalidReason = "Duplicate report rows for this item were present.";
        return;
      }
      map[item.item] = item;
    });
    var scanned = nonNegativeInt(raw.posts_scanned);
    var parsed = nonNegativeInt(raw.reports_parsed);
    var unattributed = nonNegativeInt(raw.reports_without_an_item);
    var total = Object.keys(map).reduce(function (sum, id) {
      return sum + (map[id].invalidCounts ? 0 : map[id].reports);
    }, 0);
    var totalsValid = scanned !== null && parsed !== null && unattributed !== null &&
      Number.isSafeInteger(total) && parsed <= scanned && unattributed <= parsed &&
      !malformed && !duplicates && Object.keys(map).every(function (id) { return !map[id].invalidCounts; }) &&
      total + unattributed === parsed;
    return {
      version: text(raw.version, 80),
      scanLimit: nonNegativeInt(raw.scan_limit),
      truncated: raw.truncated === true,
      postsScanned: scanned,
      reportsParsed: parsed,
      totalsValid: totalsValid,
      reportsWithoutItem: nonNegativeInt(raw.reports_without_an_item),
      doesNotProve: text(raw.does_not_prove, TEXT_LIMIT),
      malformed: malformed,
      duplicates: duplicates,
      items: map
    };
  }

  function settle(promise) {
    return promise.then(function (value) {
      return { ok: true, value: value };
    }, function (error) {
      return { ok: false, error: error };
    });
  }

  function reason(result) {
    if (!result || result.ok) { return ""; }
    return result.error && result.error.message ? result.error.message : "unavailable";
  }

  function reset(node) {
    if (node) { node.textContent = ""; }
  }

  function appendSummary(workResult, reportsResult) {
    reset(summaryEl);
    if (!summaryEl) { return; }
    var work = workResult.ok ? workResult.value : null;
    var reports = reportsResult.ok ? reportsResult.value : null;
    var requestLine = work ?
      "Request document date: " + (work.updated || "not provided") + ". Shown as a dated request document, not live-verified facts." :
      "Request document unavailable. " + reason(workResult);
    var reportLine;
    if (reports) {
      reportLine = reports.totalsValid ? "Report snapshot: scanned " + valueOrUnknown(reports.postsScanned) + " posts and parsed " +
        valueOrUnknown(reports.reportsParsed) + " reports." : "Report snapshot totals are unavailable or inconsistent. Read individual rows for their reported claims.";
      if (reports.truncated) {
        reportLine += " Snapshot truncated at " + valueOrUnknown(reports.scanLimit) + " posts; older reports may be absent.";
      } else if (reports.totalsValid && reports.reportsParsed === 0) {
        reportLine += " No parseable reports are present in this scan.";
      }
    } else {
      reportLine = "Report snapshot unavailable. Counts below are unavailable, not zero. " + reason(reportsResult);
    }
    summaryEl.appendChild(el("p", null, requestLine));
    summaryEl.appendChild(el("p", null, reportLine));
    if (work && work.truncated) {
      summaryEl.appendChild(el("p", null, "Showing " + work.items.length + " of " + work.totalItems + " valid requests."));
    }
    if (work && work.malformed) {
      summaryEl.appendChild(el("p", null, work.malformed + " malformed request rows were not shown."));
    }
    if (reports && reports.malformed) {
      summaryEl.appendChild(el("p", null, reports.malformed + " malformed report rows were ignored."));
    }
    if (reports && reports.duplicates) {
      summaryEl.appendChild(el("p", null, reports.duplicates + " duplicate report rows were not merged."));
    }
    var boundary = reports && reports.doesNotProve ? reports.doesNotProve : work && work.countBoundary ? work.countBoundary : "";
    if (boundary) { summaryEl.appendChild(el("p", null, boundary)); }
  }

  function valueOrUnknown(value) {
    return value === null || value === undefined ? "unknown" : String(value);
  }

  function addMeta(parent, value) {
    if (value === undefined || value === null || value === "") { return; }
    parent.appendChild(el("span", null, value));
  }

  function addAction(parent, label, href) {
    if (href) {
      var link = document.createElement("a");
      link.href = href;
      link.rel = "noopener";
      link.textContent = label;
      parent.appendChild(link);
      return;
    }
    parent.appendChild(el("span", null, label + " unavailable"));
  }

  function reportRow(report, reportsAvailable) {
    var wrap = el("aside", "work-report");
    wrap.appendChild(el("h4", null, "Report snapshot"));
    if (!reportsAvailable) {
      wrap.appendChild(el("p", null, "Unavailable. This is not counted as zero."));
      return wrap;
    }
    if (!report) {
      wrap.appendChild(el("p", null, "No row for this request in the current report snapshot."));
      return wrap;
    }
    if (report.invalidCounts) {
      wrap.appendChild(el("p", null, report.invalidReason || "The report row was present, but one or more counts were malformed."));
      return wrap;
    }
    var facts = el("dl", null);
    facts.appendChild(el("dt", null, "typed reports"));
    facts.appendChild(el("dd", null, valueOrUnknown(report.reports)));
    facts.appendChild(el("dt", null, "pass claims"));
    facts.appendChild(el("dd", null, valueOrUnknown(report.pass)));
    facts.appendChild(el("dt", null, "fail claims"));
    facts.appendChild(el("dd", null, valueOrUnknown(report.fail)));
    facts.appendChild(el("dt", null, "partial claims"));
    facts.appendChild(el("dd", null, valueOrUnknown(report.partial)));
    facts.appendChild(el("dt", null, "unrecognized"));
    facts.appendChild(el("dd", null, valueOrUnknown(report.unrecognized)));
    facts.appendChild(el("dt", null, "reporters"));
    facts.appendChild(el("dd", null, valueOrUnknown(report.reporters)));
    facts.appendChild(el("dt", null, "platforms"));
    facts.appendChild(el("dd", null, report.platforms.length ? report.platforms.join(", ") : "none in snapshot"));
    facts.appendChild(el("dt", null, "runtimes"));
    facts.appendChild(el("dd", null, report.runtimes.length ? report.runtimes.join(", ") : "none in snapshot"));
    facts.appendChild(el("dt", null, "latest report"));
    facts.appendChild(el("dd", null, formatDate(report.latestReport) || "none in snapshot"));
    wrap.appendChild(facts);
    wrap.appendChild(el("p", null, "Counts are typed report claims, not verified outcomes or independent machines."));
    return wrap;
  }

  function reportLine(report, reportsResult) {
    if (!reportsResult.ok) { return "Reports unavailable; this is not counted as zero."; }
    if (!report) { return "No report row in the current snapshot."; }
    if (report.invalidCounts) { return report.invalidReason || "Report row present, but counts are invalid."; }
    return valueOrUnknown(report.reports) + " typed reports: " +
      valueOrUnknown(report.pass) + " pass claims, " +
      valueOrUnknown(report.fail) + " fail claims, " +
      valueOrUnknown(report.partial) + " partial claims.";
  }

  function workCard(item, work, reportsResult) {
    var report = reportsResult.ok ? reportsResult.value.items[item.id] : null;
    var article = el("li", "work-card");
    article.setAttribute("data-work-item-id", item.id);
    var body = el("article", null);
    var title = el("h3", null, item.title);
    var meta = el("p", "work-meta");
    addMeta(meta, item.id);
    addMeta(meta, "request document " + (item.asOf || work.updated || "undated"));
    if (item.reportRoom) { addMeta(meta, "room " + item.reportRoom); }
    body.appendChild(title);
    body.appendChild(meta);
    if (item.whatWouldHelp) {
      var help = el("p", "work-copy");
      help.appendChild(el("b", null, "Request: "));
      help.appendChild(document.createTextNode(shortText(item.whatWouldHelp, 220)));
      body.appendChild(help);
    }
    body.appendChild(el("p", "work-claims", reportLine(report, reportsResult)));
    var more = el("details", "work-more");
    more.appendChild(el("summary", null, "Open request details"));
    if (item.whatWouldHelp && item.whatWouldHelp !== shortText(item.whatWouldHelp, 220)) {
      var fullRequest = el("p", "work-copy");
      fullRequest.appendChild(el("b", null, "Full request: "));
      fullRequest.appendChild(document.createTextNode(item.whatWouldHelp));
      more.appendChild(fullRequest);
    }
    if (item.whatIsUnknown) {
      var open = el("p", "work-copy");
      open.appendChild(el("b", null, "Open question requested: "));
      open.appendChild(document.createTextNode(item.whatIsUnknown));
      more.appendChild(open);
    }
    if (item.run) {
      var command = el("pre", "work-command");
      command.appendChild(el("code", null, item.run));
      more.appendChild(command);
    }
    if (item.verify) {
      var verify = el("p", "work-copy");
      verify.appendChild(el("b", null, "Reader check: "));
      verify.appendChild(document.createTextNode(item.verify));
      more.appendChild(verify);
    }
    more.appendChild(reportRow(report, reportsResult.ok));
    var actions = el("div", "work-actions");
    addAction(actions, "Source", item.repository);
    if (item.contributing && item.contributing !== item.repository) {
      addAction(actions, "Contributing", item.contributing);
    }
    addAction(actions, "Report room feed", roomUrl(item.reportRoom));
    more.appendChild(actions);
    body.appendChild(more);
    article.appendChild(body);
    return article;
  }

  function appendItems(workResult, reportsResult) {
    reset(itemsEl);
    if (!itemsEl) { return; }
    if (!workResult.ok) {
      itemsEl.appendChild(el("li", "work-empty", "Open work unavailable. " + reason(workResult)));
      return;
    }
    var work = workResult.value;
    if (!work.items.length) {
      itemsEl.appendChild(el("li", "work-empty", "The work document contains no valid requests."));
      return;
    }
    work.items.forEach(function (item) {
      itemsEl.appendChild(workCard(item, work, reportsResult));
    });
  }

  function draw(workResult, reportsResult) {
    appendSummary(workResult, reportsResult);
    appendItems(workResult, reportsResult);
    if (workResult.ok && reportsResult.ok) {
      setStatus("ready", "Open work and report snapshot read from the board.");
    } else if (workResult.ok || reportsResult.ok) {
      setStatus("partial", "Partial read. " + (workResult.ok ? reason(reportsResult) : reason(workResult)));
    } else {
      setStatus("error", "Open work unavailable. " + reason(workResult));
    }
  }

  function refresh() {
    var requestId = state.requestId + 1;
    state.requestId = requestId;
    abortActive();
    if (refreshEl) { refreshEl.disabled = true; }
    setStatus("loading", "Reading open work and report snapshot.");
    Promise.all([
      settle(fetchJson("/.well-known/agent-work.json").then(normalizeWorkPayload)),
      settle(fetchJson("/v1/reports").then(normalizeReportsPayload))
    ]).then(function (results) {
      if (requestId !== state.requestId) { return; }
      draw(results[0], results[1]);
    }).then(function () {
      if (requestId === state.requestId && refreshEl) { refreshEl.disabled = false; }
    }, function () {
      if (requestId === state.requestId && refreshEl) { refreshEl.disabled = false; }
    });
  }

  if (refreshEl) {
    refreshEl.addEventListener("click", refresh);
  }
  window.addEventListener("pagehide", abortActive);
  refresh();
}());
