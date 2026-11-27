// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the Portfolio Site contributors
// SPDX-License-Identifier: MIT
//
// Zero-dependency browser and Node ES module for /playground/competitive-surpass/.
// Verifies the pinned SHA-256 of surpass_matrix.json before hydrating interactive lane,
// status, flagship, and text filters across all 76 rows and 8 domain lanes.

export const TIER_LABELS = {
  surpassed_with_receipt: "Surpassed (receipt)",
  parity_verified: "Parity verified",
  open_next_wave_opportunity: "Open opportunity",
};

export const LANE_LABELS = {
  "models-rl-arch": "Models, RL and Arch",
  "flywheel-epistemics": "Flywheel Epistemics",
  "career-craft": "Career and Craft",
  "buildlang-compilers": "BuildLang Compilers",
  "graphics-shaders-rendering": "Graphics and Shaders",
  "cmmns-politics-governance": "CMMNS Governance",
  "physics-math-science": "Physics and Math",
  "art-cinematography-audio": "Art and Audio",
};

export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function sha256Hex(bytes) {
  const buf = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPinnedMatrix(rawBytes, expectedSha256) {
  const actual = await sha256Hex(rawBytes);
  if (actual !== expectedSha256) {
    const err = new Error(`matrix SHA-256 mismatch: expected ${expectedSha256}, got ${actual}`);
    err.code = "sha256_mismatch";
    throw err;
  }
  const text = typeof rawBytes === "string" ? rawBytes : new TextDecoder().decode(rawBytes);
  const data = JSON.parse(text);
  if (data.schema !== "competitive-surpass-explorer/1") {
    const err = new Error(`unexpected matrix schema: ${data.schema}`);
    err.code = "bad_schema";
    throw err;
  }
  if (!Array.isArray(data.signals) || data.signals.length !== 76) {
    const err = new Error(`expected 76 signals, got ${data.signals?.length}`);
    err.code = "bad_row_count";
    throw err;
  }
  return { sha256: actual, data };
}

export function filterSignals(signals, { lane = "all", tier = "all", flagship = "all", query = "" } = {}) {
  const q = String(query || "").trim().toLowerCase();
  return signals.filter((s) => {
    if (lane !== "all" && s.lane !== lane) return false;
    if (tier !== "all" && s.tier !== tier) return false;
    if (flagship !== "all" && s.linked_flagship !== flagship) return false;
    if (q) {
      const hay = [
        s.signal_id, s.lane, s.competitor_or_topic, s.linked_idea_id,
        s.linked_flagship, s.tier, s.evidence_summary, (s.evidence_catalogue_ids || []).join(" "),
      ].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function summarize(signals) {
  const total = signals.length;
  let surpassed = 0;
  let parity = 0;
  let open = 0;
  const ids = new Set();
  for (const s of signals) {
    if (s.tier === "surpassed_with_receipt") surpassed++;
    else if (s.tier === "parity_verified") parity++;
    else open++;
    for (const cid of s.evidence_catalogue_ids || []) ids.add(cid);
  }
  return { total, surpassed, parity, open, covered: surpassed + parity, uniqueReceipts: ids.size };
}

export function renderLaneRows(lanes) {
  return lanes.map((l) => `        <tr data-lane-summary="${esc(l.lane)}">
          <th scope="row">${esc(LANE_LABELS[l.lane] || l.lane)}<span class="se-sub">${esc(l.lane)}</span></th>
          <td class="mono">${l.total}</td>
          <td class="mono">${l.surpassed}</td>
          <td class="mono">${l.parity}</td>
          <td class="mono">${l.open}</td>
          <td class="mono">${l.covered_pct.toFixed(1)}%</td>
        </tr>`).join("\n");
}

export function renderSignalRows(signals) {
  return signals.map((s) => {
    const cids = (s.evidence_catalogue_ids || []).map((id) => `#${id}`).join(", ");
    const tierLabel = TIER_LABELS[s.tier] || s.tier;
    const note = s.tier === "open_next_wave_opportunity" && s.next_wave_action
      ? `${s.evidence_summary} Next: ${s.next_wave_action}`
      : s.evidence_summary;
    return `        <tr data-signal="${esc(s.signal_id)}" data-lane="${esc(s.lane)}" data-tier="${esc(s.tier)}" data-flagship="${esc(s.linked_flagship)}">
          <th scope="row" class="mono">${esc(s.signal_id)}<span class="se-sub">${esc(s.linked_idea_id)}</span></th>
          <td>${esc(s.competitor_or_topic)}<span class="se-sub">${esc(LANE_LABELS[s.lane] || s.lane)} | ${esc(s.linked_flagship)}</span></td>
          <td class="mono">${esc(tierLabel)}</td>
          <td class="mono">${esc(cids || "none")}</td>
          <td>${esc(note)}</td>
        </tr>`;
  }).join("\n");
}

export function verifySurfaceConsistency(html, data) {
  const signalRows = (html.match(/<tr data-signal="CS-\d+"/g) || []).length;
  const laneRows = (html.match(/<tr data-lane-summary="/g) || []).length;
  if (signalRows !== data.signals.length) throw new Error(`signal rows ${signalRows} != ${data.signals.length}`);
  if (laneRows !== data.lanes.length) throw new Error(`lane rows ${laneRows} != ${data.lanes.length}`);
  for (const s of data.signals) {
    if (!html.includes(`data-signal="${s.signal_id}"`)) throw new Error(`missing row ${s.signal_id}`);
  }
  return { ok: true, signalRows, laneRows };
}

async function hydrate(doc) {
  const q = (sel) => doc.querySelector(sel);
  const status = q("#se-status");
  const digest = q("#se-digest");
  const laneSel = q("#se-lane");
  const tierSel = q("#se-tier");
  const flagSel = q("#se-flagship");
  const searchIn = q("#se-search");
  const resetBtn = q("#se-reset");
  const emptyNote = q("#se-empty");
  const fail = (msg) => { status.textContent = `FAIL CLOSED: ${msg}`; doc.documentElement.dataset.surpassReady = "fail"; };
  try {
    const res = await fetch(new URL("surpass_matrix.json", new URL("./", doc.baseURI)));
    if (!res.ok) throw new Error(`fetch surpass_matrix.json failed (${res.status})`);
    const raw = await res.arrayBuffer();
    const pinned = (q('meta[name="surpass-matrix-sha256"]') || {}).content || "";
    const { sha256, data } = await verifyPinnedMatrix(raw, pinned);
    const rowsById = new Map([...doc.querySelectorAll("tr[data-signal]")].map((tr) => [tr.dataset.signal, tr]));
    digest.textContent = `Matrix SHA-256: ${sha256.slice(0, 23)}... | ${data.signals.length} signals, ${data.lanes.length} lanes, ${data.summary.unique_receipts} receipts`;

    const apply = () => {
      const state = { lane: laneSel.value, tier: tierSel.value, flagship: flagSel.value, query: searchIn.value };
      const shown = filterSignals(data.signals, state);
      const shownIds = new Set(shown.map((s) => s.signal_id));
      for (const [id, tr] of rowsById.entries()) tr.hidden = !shownIds.has(id);
      const st = summarize(shown);
      status.textContent = `Showing ${st.total}/${data.signals.length} signals | Surpassed: ${st.surpassed} | Parity: ${st.parity} | Open: ${st.open} | Filters: ${state.lane}/${state.tier}/${state.flagship}`;
      emptyNote.hidden = st.total > 0;
      for (const btn of doc.querySelectorAll("button.se-pill")) {
        const active = btn.dataset.lane === state.lane;
        btn.setAttribute("aria-pressed", active ? "true" : "false");
        btn.dataset.active = active ? "1" : "0";
      }
      doc.documentElement.dataset.surpassVisible = String(st.total);
    };

    for (const el of [laneSel, tierSel, flagSel]) el.addEventListener("change", apply);
    searchIn.addEventListener("input", apply);
    resetBtn.addEventListener("click", () => {
      laneSel.value = "all";
      tierSel.value = "all";
      flagSel.value = "all";
      searchIn.value = "";
      apply();
    });
    for (const btn of doc.querySelectorAll("button.se-pill")) {
      btn.addEventListener("click", () => { laneSel.value = btn.dataset.lane; apply(); });
    }
    apply();
    doc.documentElement.dataset.surpassReady = "1";
  } catch (err) {
    fail(String(err.message || err));
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => hydrate(document));
  else hydrate(document);
}
