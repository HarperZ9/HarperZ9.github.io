// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the Portfolio Site contributors
// SPDX-License-Identifier: MIT
//
// Zero-dependency browser and Node ES module for /playground/papers/.
// Verifies the pinned SHA-256 of papers_manifest.json before hydrating interactive
// track filtering and BibTeX / plain-text citation copy controls.

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

export async function verifyPinnedCatalog(rawBytes, expectedSha256) {
  const actual = await sha256Hex(rawBytes);
  if (actual !== expectedSha256) {
    const err = new Error(`catalog SHA-256 mismatch: expected ${expectedSha256}, got ${actual}`);
    err.code = "sha256_mismatch";
    throw err;
  }
  const text = typeof rawBytes === "string" ? rawBytes : new TextDecoder().decode(rawBytes);
  const data = JSON.parse(text);
  if (data.schema !== "research-papers-catalog/1") {
    const err = new Error(`unexpected catalog schema: ${data.schema}`);
    err.code = "bad_schema";
    throw err;
  }
  if (!Array.isArray(data.papers) || data.papers.length !== 8) {
    const err = new Error(`expected 8 papers, got ${data.papers?.length}`);
    err.code = "bad_paper_count";
    throw err;
  }
  return { sha256: actual, data };
}

export function formatBibtex(p) {
  return [
    `@misc{${p.bibtex_key},`,
    `  author       = {Harper, Zain Dana},`,
    `  title        = {{${p.title}}},`,
    `  year         = {2026},`,
    `  month        = {nov},`,
    `  note         = {Preprint (${p.track_label}); Flywheel receipt catalogue #${p.catalogue_id}; CC-BY-4.0},`,
    `  url          = {${p.primary_url}}`,
    `}`,
  ].join("\n");
}

export function formatCitation(p) {
  return `Harper, Z. D. (2026). ${p.title}. Preprint (${p.track_label}, ${p.pages} pp., ${p.license}, Flywheel receipt #${p.catalogue_id}). ${p.primary_url}`;
}

export function filterPapers(papers, track = "all") {
  if (!track || track === "all") return papers;
  return papers.filter((p) => p.track_id === track);
}

export function renderPaperCards(papers) {
  return papers.map((p) => {
    const bib = formatBibtex(p);
    const cit = formatCitation(p);
    const cats = p.verified_catalogue_ids.map((id) => `#${id}`).join(", ");
    return `  <section class="pp-card" data-paper="${esc(p.id)}" data-track="${esc(p.track_id)}">
    <div class="pp-card-head">
      <p class="pp-kicker">Paper #${p.number} | ${esc(p.track_label)} | Receipt #${p.catalogue_id}</p>
      <h3>${esc(p.title)}</h3>
      <p class="pp-meta">${p.pages} pages | ${p.words} words | ${(p.pdf_bytes / 1024).toFixed(1)} KB PDF | ${esc(p.license)} prose / ${esc(p.code_licenses.join(" and "))} code</p>
    </div>
    <p class="pp-abstract">${esc(p.description)}</p>
    <p class="pp-sub"><strong>Cited receipts (${p.verified_catalogue_ids.length}):</strong> <span class="mono">${esc(cats)}</span></p>
    <p class="pp-sub"><strong>Paper receipt claim SHA-256:</strong> <span class="mono" title="${esc(p.claim_sha256)}">${esc(p.claim_sha256.slice(0, 23))}...</span></p>
    <div class="pp-actions" role="group" aria-label="Citation actions for Paper #${p.number}">
      <button type="button" class="pp-btn" data-paper-copy="bibtex" data-paper-id="${esc(p.id)}">Copy BibTeX</button>
      <button type="button" class="pp-btn" data-paper-copy="citation" data-paper-id="${esc(p.id)}">Copy plain citation</button>
    </div>
    <details class="pp-details">
      <summary>BibTeX and plain-text citation</summary>
      <pre class="pp-pre" data-bib="${esc(p.id)}">${esc(bib)}</pre>
      <p class="pp-cit" data-cit="${esc(p.id)}">${esc(cit)}</p>
    </details>
  </section>`;
  }).join("\n");
}

export function renderReceiptLedgerRows(rows) {
  return rows.map((r) => `        <tr data-track="${esc(r.tracks.join(" "))}">
          <th scope="row" class="mono">#${r.catalogue_id}</th>
          <td>${esc(r.role)}</td>
          <td class="mono">${esc(r.papers.join(", "))}</td>
          <td class="mono">${esc(r.tracks.join(", "))}</td>
        </tr>`).join("\n");
}

export function verifySurfaceConsistency(html, data) {
  const cards = (html.match(/<section class="pp-card" data-paper="/g) || []).length;
  const rows = (html.match(/<tr data-track="/g) || []).length;
  if (cards !== data.papers.length) throw new Error(`paper cards ${cards} != ${data.papers.length}`);
  if (rows !== data.receipt_ledger.length) throw new Error(`ledger rows ${rows} != ${data.receipt_ledger.length}`);
  for (const p of data.papers) {
    if (!html.includes(`#${p.catalogue_id}`)) throw new Error(`missing paper catalogue_id #${p.catalogue_id}`);
  }
  return { ok: true, cards, rows };
}

async function copyText(doc, text) {
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(text);
      return "clipboard";
    }
  } catch { /* fallback below */ }
  const ta = doc.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  doc.body.appendChild(ta);
  ta.select();
  try { doc.execCommand("copy"); } catch {}
  doc.body.removeChild(ta);
  return "selection";
}

async function hydrate(doc) {
  const q = (sel) => doc.querySelector(sel);
  const status = q("#pp-status");
  const digest = q("#pp-digest");
  const copyOut = q("#pp-copy-status");
  const fail = (msg) => { status.textContent = `FAIL CLOSED: ${msg}`; doc.documentElement.dataset.papersReady = "fail"; };
  try {
    const res = await fetch(new URL("papers_manifest.json", new URL("./", doc.baseURI)));
    if (!res.ok) throw new Error(`fetch papers_manifest.json failed (${res.status})`);
    const raw = await res.arrayBuffer();
    const pinned = (q('meta[name="papers-manifest-sha256"]') || {}).content || "";
    const { sha256, data } = await verifyPinnedCatalog(raw, pinned);
    const byId = new Map(data.papers.map((p) => [p.id, p]));
    digest.textContent = `Catalog SHA-256: ${sha256.slice(0, 23)}... | ${data.papers.length} papers, ${data.receipt_ledger.length} verified receipts`;

    const applyTrack = (track) => {
      const shown = filterPapers(data.papers, track);
      const shownIds = new Set(shown.map((p) => p.id));
      for (const card of doc.querySelectorAll("section.pp-card")) card.hidden = !shownIds.has(card.dataset.paper);
      for (const tr of doc.querySelectorAll("tr[data-track]")) {
        tr.hidden = track !== "all" && !tr.dataset.track.split(" ").includes(track);
      }
      for (const btn of doc.querySelectorAll("button.pp-pill")) {
        const active = btn.dataset.track === track;
        btn.setAttribute("aria-pressed", active ? "true" : "false");
        btn.dataset.active = active ? "1" : "0";
      }
      status.textContent = `Showing ${shown.length}/${data.papers.length} papers | Track: ${track === "all" ? "All tracks" : track} | Offline preprints (zero external uploads)`;
      doc.documentElement.dataset.papersVisible = String(shown.length);
    };

    for (const btn of doc.querySelectorAll("button.pp-pill")) {
      btn.addEventListener("click", () => applyTrack(btn.dataset.track));
    }
    for (const btn of doc.querySelectorAll("button[data-paper-copy]")) {
      btn.addEventListener("click", async () => {
        const p = byId.get(btn.dataset.paperId);
        if (!p) return;
        const kind = btn.dataset.paperCopy;
        const payload = kind === "bibtex" ? formatBibtex(p) : formatCitation(p);
        await copyText(doc, payload);
        copyOut.textContent = `Copied ${kind === "bibtex" ? "BibTeX" : "plain citation"} for Paper #${p.number} (${p.bibtex_key}, ${payload.length} chars).`;
        doc.documentElement.dataset.lastCopied = `${kind}:${p.id}`;
      });
    }
    q("#pp-copy-all-bib").addEventListener("click", async () => {
      const payload = data.papers.map(formatBibtex).join("\n\n");
      await copyText(doc, payload);
      copyOut.textContent = `Copied all ${data.papers.length} BibTeX entries (${payload.length} chars).`;
      doc.documentElement.dataset.lastCopied = "bibtex:all";
    });

    applyTrack("all");
    doc.documentElement.dataset.papersReady = "1";
  } catch (err) {
    fail(String(err.message || err));
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => hydrate(document));
  else hydrate(document);
}
