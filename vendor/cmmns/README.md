# CMMNS core, vendored for the Try it panel

What: the pure core of CMMNS (THE COMMONS), unmodified: `src/core/api.js`, `src/core/persuasion.js` and every module they import, 70 files.

Source: https://github.com/HarperZ9/cmmns at tag `v3.9.1`, commit `db4f820ff45dd15d7837580692fb1edf161820b9` (28 October 2026). `3.9.1/SHA256SUMS` lists every file's hash; a file that differs from the tag is a defect.

Licence: GNU Affero General Public License v3.0 only (`3.9.1/LICENSE`).

What the licence asks of this site, as read on 2 November 2026:

- The files ship unmodified with the licence text beside them, and the page that loads them links the exact source tag.
- The page script that calls them, `world/site/commons-try.js`, carries the same licence (AGPL-3.0-only) in its header, so the combined panel is under one licence and its full source is this repository.
- If a future change modifies a vendored file, the change must be published as source under the AGPL; the simplest route is to change CMMNS upstream and vendor the new tag.

What it does in the browser: no network calls (a search of the vendored files for `fetch`, `XMLHttpRequest`, `sendBeacon` and `WebSocket` finds none). The panel reads pasted text and a chosen file on the visitor's device and sends nothing.

To update: copy the import closure of `api.js` and `persuasion.js` from the new tag into `<version>/`, keep the layout, regenerate `SHA256SUMS`, and change the import path in `world/site/commons-try.js`.
