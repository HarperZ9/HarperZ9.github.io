# CMMNS core, vendored for the Try it panel

What: the pure core of CMMNS (THE COMMONS), unmodified: `src/core/api.js`, `src/core/persuasion.js` and every module they import, 75 files, plus two 3 KB test JPEGs from the project's own fixtures (`samples/`) that carry test Content Credentials.

Source: https://github.com/HarperZ9/cmmns at commit `5f86ee789c35a65d3043b4eb81ac0393ca751711`, the head of pull request 112 (the C2PA validation report, `credentialReport`, API 2.1.0), which is open and not merged as of 2 November 2026. It is the 3.9.1 release plus that report. When a release tag carries the report, vendor that tag in its place. `pr112-5f86ee7/SHA256SUMS` lists every file's hash; a file that differs from the commit is a defect.

Licence: GNU Affero General Public License v3.0 only (`pr112-5f86ee7/LICENSE`).

What the licence asks of this site, as read on 2 November 2026:

- The files ship unmodified with the licence text beside them, and the page that loads them links the exact source tag.
- The page script that calls them, `world/site/commons-try.js`, carries the same licence (AGPL-3.0-only) in its header, so the combined panel is under one licence and its full source is this repository.
- If a future change modifies a vendored file, the change must be published as source under the AGPL; the simplest route is to change CMMNS upstream and vendor the new tag.

What it does in the browser: no network calls (a search of the vendored files for `fetch`, `XMLHttpRequest`, `sendBeacon` and `WebSocket` finds none). The panel reads pasted text and a chosen file on the visitor's device and sends nothing.

To update: copy the import closure of `api.js` and `persuasion.js` from the new tag into `<tag>/`, keep the layout, regenerate `SHA256SUMS`, and change the import path in `world/site/commons-try.js`.
