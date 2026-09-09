import { SITE_PAIRING, ORIGINAL_FAMILIES, specimenFamilies } from './font-catalog.mjs?v=20260908-mono-latin';

const DEFAULT_TEXT = "Letters should keep their shape when the work gets dense.";
const DEFAULT_FAMILY = "editorial-preview";
const SAMPLE_TEXT_LIMIT = 260;
const FAMILIES = specimenFamilies(SITE_PAIRING, ORIGINAL_FAMILIES);
const SITE_GROUP_LABEL = "Existing site fonts · not original fonts for sale";
const COMPARE_DEFAULTS = { left: "editorial-preview", right: "mono-preview" };

function familyGroups() {
  return [
    ...ORIGINAL_FAMILIES.map(family => ({ label: `${family.name} · Original preview`, faces: family.styles })),
    { label: SITE_GROUP_LABEL, faces: SITE_PAIRING, site: true },
  ];
}

function optionLabel(face, site) {
  return site ? `${face.label} (site font)` : face.label;
}

function populateFamilyOptions(select, fallback) {
  if (!select) return;
  const selected = Object.hasOwn(FAMILIES, select.value) ? select.value : fallback;
  const options = familyGroups().map(({ label, faces, site }) => {
    const group = document.createElement('optgroup');
    group.label = label;
    for (const face of faces) {
      const option = document.createElement('option');
      option.value = face.id;
      option.textContent = optionLabel(face, site);
      group.append(option);
    }
    return group;
  });
  select.replaceChildren(...options);
  select.value = selected;
}

function populateFamilySelector() {
  populateFamilyOptions(document.querySelector('[data-font-specimen-family]'), DEFAULT_FAMILY);
}

function populateCompareSelectors(root) {
  for (const select of root.querySelectorAll("[data-font-compare-family]")) {
    const slot = select.dataset.fontCompareFamily;
    populateFamilyOptions(select, COMPARE_DEFAULTS[slot] || "editorial-preview");
  }
}

function boundedNumber(input, fallback) {
  const value = Number.parseFloat(input.value);
  const min = Number.parseFloat(input.min);
  const max = Number.parseFloat(input.max);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function specimenText(value) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : DEFAULT_TEXT;
}

function samplePresetText(value) {
  const bounded = Array.from(String(value || "")).slice(0, SAMPLE_TEXT_LIMIT).join("").trim();
  return bounded.length ? bounded : DEFAULT_TEXT;
}

function visibleCharacters(value) {
  return Array.from(value).filter(char => !["\n", "\r", "\t"].includes(char));
}

function unsupportedCharacters(value, coverage) {
  if (!coverage) return [];
  const missing = [];
  const seen = new Set();
  for (const char of visibleCharacters(value)) {
    const codepoint = char.codePointAt(0);
    if (coverage.has(codepoint) || seen.has(char)) continue;
    seen.add(char);
    missing.push(char);
  }
  return missing;
}

function fontFaceState(familyConfig) {
  if (!familyConfig.preview) return "loaded";
  if (!document.fonts || typeof document.fonts[Symbol.iterator] !== "function") return "unknown";
  const records = Array.from(document.fonts).filter(face => face.family.replaceAll('"', "") === familyConfig.label);
  if (!records.length) return "unavailable";
  if (records.some(face => face.status === "error")) return "failed";
  if (records.some(face => face.status === "loading" || face.status === "unloaded")) return "loading";
  return "loaded";
}

function updatePreviewAssetStatus() {
  const notices = document.querySelectorAll("[data-font-asset-status]");
  if (!notices.length) return;
  for (const notice of notices) {
    const familyConfig = FAMILIES[notice.dataset.fontAssetStatus];
    if (!familyConfig?.preview) continue;
    const loadState = fontFaceState(familyConfig);
    const message = loadState === "failed" || loadState === "unavailable"
      ? `${familyConfig.label} could not load; fallback text is shown.`
      : "";
    notice.hidden = !message;
    notice.textContent = message;
  }
}

function bootPreviewAssetStatus() {
  updatePreviewAssetStatus();
  document.fonts?.ready.then(updatePreviewAssetStatus).catch(updatePreviewAssetStatus);
  document.fonts?.addEventListener?.("loadingdone", updatePreviewAssetStatus);
  document.fonts?.addEventListener?.("loadingerror", updatePreviewAssetStatus);
}

function bootFontTryLinks() {
  const family = document.querySelector("[data-font-specimen-family]");
  const text = document.querySelector("[data-font-specimen-text]");
  if (!family) return;
  for (const link of document.querySelectorAll("[data-font-try]")) {
    link.addEventListener("click", () => {
      const requested = link.getAttribute("data-font-try");
      if (!Object.hasOwn(FAMILIES, requested)) return;
      family.value = requested;
      family.dispatchEvent(new Event("change", { bubbles: true }));
      text?.focus({ preventScroll: true });
    });
  }
}

function bootSpecimen(root) {
  const form = root.querySelector("[data-font-specimen-controls]");
  const live = root.querySelector("[data-font-specimen-live]");
  const preview = root.querySelector("[data-font-specimen-preview]");
  const status = root.querySelector("[data-font-specimen-status]");
  const warning = root.querySelector("[data-font-coverage-warning]");
  const text = root.querySelector("[data-font-specimen-text]");
  const family = root.querySelector("[data-font-specimen-family]");
  const size = root.querySelector("[data-font-specimen-size]");
  const line = root.querySelector("[data-font-specimen-line]");
  const track = root.querySelector("[data-font-specimen-track]");
  const sizeOutput = root.querySelector("#font-specimen-size-output");
  const lineOutput = root.querySelector("#font-specimen-line-output");
  const trackOutput = root.querySelector("#font-specimen-track-output");
  const posterButton = root.querySelector("[data-font-specimen-poster]");
  const cssButton = root.querySelector("[data-font-specimen-css]");
  const compareToggle = root.querySelector("[data-font-compare-toggle]");
  const comparePanel = root.querySelector("[data-font-compare]");
  const sampleButtons = Array.from(root.querySelectorAll("[data-font-sample]"));

  if (!form || !live || !preview || !status || !warning || !text || !family || !size || !line || !track) return;
  if (!sizeOutput || !lineOutput || !trackOutput || !posterButton || !cssButton) return;
  populateCompareSelectors(root);

  const compareSelects = Object.fromEntries(
    Array.from(root.querySelectorAll("[data-font-compare-family]"))
      .map(select => [select.dataset.fontCompareFamily, select])
  );
  const compareSlots = Array.from(root.querySelectorAll("[data-font-compare-slot]")).map(slot => ({
    key: slot.dataset.fontCompareSlot,
    name: slot.querySelector("[data-font-compare-name]"),
    context: slot.querySelector("[data-font-compare-context]"),
    preview: slot.querySelector("[data-font-compare-preview]"),
    notice: slot.querySelector("[data-font-compare-notice]"),
  })).filter(slot => slot.key && slot.name && slot.context && slot.preview && slot.notice);
  if (comparePanel && compareToggle) root.dataset.fontCompareOpen = String(!comparePanel.hidden);

  function currentFamilyKey() {
    return Object.hasOwn(FAMILIES, family.value) ? family.value : DEFAULT_FAMILY;
  }

  function currentFamilyConfig() {
    return FAMILIES[currentFamilyKey()];
  }

  function setActionAvailability(familyConfig) {
    posterButton.disabled = !familyConfig.poster;
    cssButton.disabled = !familyConfig.css;
    posterButton.setAttribute("aria-disabled", String(!familyConfig.poster));
    cssButton.setAttribute("aria-disabled", String(!familyConfig.css));
    posterButton.title = familyConfig.poster ? "" : "Poster is disabled for this preview face until the production font is allowed there.";
    cssButton.title = familyConfig.css ? "" : "CSS export is disabled for this preview face until the production font is allowed there.";
  }

  function compareFamilyKey(slotKey) {
    const select = compareSelects[slotKey];
    if (select && Object.hasOwn(FAMILIES, select.value)) return select.value;
    return COMPARE_DEFAULTS[slotKey] || "editorial-preview";
  }

  function setCompareDefaults() {
    for (const [slotKey, select] of Object.entries(compareSelects)) {
      const fallback = COMPARE_DEFAULTS[slotKey] || "editorial-preview";
      select.value = fallback;
    }
  }

  function compareContext(familyConfig) {
    return familyConfig.preview
      ? `${familyConfig.style} original preview. Browser-only, not for sale.`
      : "Existing site font. Not an original font for sale.";
  }

  function compareNotice(familyConfig, renderedText) {
    const messages = [];
    const loadState = fontFaceState(familyConfig);
    const missing = unsupportedCharacters(renderedText, familyConfig.coverage);

    if (loadState === "failed" || loadState === "unavailable") {
      messages.push(`${familyConfig.label} could not load; fallback text is shown.`);
    } else if (loadState === "loading") {
      messages.push(`${familyConfig.label} is still loading; fallback text may be visible.`);
    }
    if (missing.length) {
      const sample = missing.slice(0, 12).join(" ");
      const suffix = missing.length > 12 ? " …" : "";
      messages.push(`Unsupported in this preview: ${sample}${suffix}.`);
    }
    if (messages.length) return messages.join(" ");
    return familyConfig.preview
      ? "Preview loaded; entered characters are covered."
      : "Existing site font; compare only, not sold here.";
  }

  function updateCompare() {
    if (!comparePanel || compareSlots.length !== 2) return;
    const renderedText = specimenText(text.value);
    const nextSize = Math.round(boundedNumber(size, 40));
    const nextLine = boundedNumber(line, 1.25);
    const nextTrack = boundedNumber(track, 0);

    for (const slot of compareSlots) {
      const familyKey = compareFamilyKey(slot.key);
      const familyConfig = FAMILIES[familyKey];
      slot.name.textContent = familyConfig.label;
      slot.context.textContent = compareContext(familyConfig);
      slot.preview.textContent = renderedText;
      slot.preview.dataset.fontFamily = familyKey;
      slot.preview.style.fontFamily = familyConfig.stack;
      slot.preview.style.fontSize = `${nextSize}px`;
      slot.preview.style.lineHeight = nextLine.toFixed(2);
      slot.preview.style.letterSpacing = `${nextTrack.toFixed(2)}em`;
      slot.notice.hidden = false;
      slot.notice.textContent = compareNotice(familyConfig, renderedText);
    }
  }

  function updateWarning(familyConfig, renderedText) {
    const messages = [];
    const loadState = fontFaceState(familyConfig);
    const missing = unsupportedCharacters(renderedText, familyConfig.coverage);

    if (loadState === "failed" || loadState === "unavailable") {
      messages.push(`${familyConfig.label} could not load; fallback text is shown until the preview file is available.`);
    } else if (loadState === "loading") {
      messages.push(`${familyConfig.label} is still loading; fallback text may be visible until the preview file is ready.`);
    }
    if (missing.length) {
      const sample = missing.slice(0, 12).join(" ");
      const suffix = missing.length > 12 ? " …" : "";
      messages.push(`Unsupported in this preview: ${sample}${suffix}. Poster and CSS export stay off for the original preview.`);
    }

    warning.hidden = messages.length === 0;
    warning.textContent = messages.join(" ");
    return loadState;
  }

  function apply() {
    const familyKey = currentFamilyKey();
    const familyConfig = FAMILIES[familyKey];
    const renderedText = specimenText(text.value);
    const nextSize = Math.round(boundedNumber(size, 40));
    const nextLine = boundedNumber(line, 1.25);
    const nextTrack = boundedNumber(track, 0);

    preview.textContent = renderedText;
    preview.dataset.fontFamily = familyKey;
    preview.style.fontFamily = familyConfig.stack;
    preview.style.fontSize = `${nextSize}px`;
    preview.style.lineHeight = nextLine.toFixed(2);
    preview.style.letterSpacing = `${nextTrack.toFixed(2)}em`;

    sizeOutput.textContent = `${nextSize} px`;
    lineOutput.textContent = nextLine.toFixed(2);
    trackOutput.textContent = `${nextTrack.toFixed(2)} em`;
    setActionAvailability(familyConfig);
    const loadState = updateWarning(familyConfig, renderedText);
    const stateLabel = familyConfig.preview && loadState !== "loaded"
      ? `preview font ${loadState === "loading" ? "loading" : "could not load"}; fallback is visible`
      : familyConfig.preview
        ? `${familyConfig.style} preview loaded`
        : "";
    const statePrefix = stateLabel ? `${familyConfig.label}, ${stateLabel}, ` : `${familyConfig.label}, `;
    status.textContent = `${statePrefix}${nextSize} px, line height ${nextLine.toFixed(2)}, tracking ${nextTrack.toFixed(2)} em`;
    updateCompare();
  }

  form.hidden = false;
  live.hidden = false;
  status.hidden = false;
  form.addEventListener("input", apply);
  form.addEventListener("change", apply);
  form.addEventListener("submit", event => event.preventDefault());
  document.fonts?.ready.then(apply).catch(() => apply());
  document.fonts?.addEventListener?.("loadingdone", apply);
  document.fonts?.addEventListener?.("loadingerror", apply);
  for (const button of sampleButtons) {
    button.addEventListener("click", () => {
      text.value = samplePresetText(button.dataset.fontSampleText);
      apply();
    });
  }
  for (const select of Object.values(compareSelects)) select.addEventListener("change", updateCompare);
  compareToggle?.addEventListener("click", () => {
    if (!comparePanel) return;
    const open = comparePanel.hidden;
    comparePanel.hidden = !open;
    compareToggle.setAttribute("aria-expanded", String(open));
    root.dataset.fontCompareOpen = String(open);
    if (open) updateCompare();
  });
  cssButton.addEventListener("click", () => {
    const selected = currentFamilyConfig();
    if (!selected.css) {
      status.textContent = "CSS export is disabled for this preview face until the production font is allowed there.";
      return;
    }
    const css = [
      '/* Typography settings from Zentropy Font Lab.',
      '   Load the named font separately under its license. Font files are not included.',
      '   Apply class="zentropy-type" to your text. */',
      '.zentropy-type {',
      `  font-family: ${selected.stack};`,
      `  font-size: ${Math.round(boundedNumber(size, 40))}px;`,
      `  line-height: ${boundedNumber(line, 1.25).toFixed(2)};`,
      `  letter-spacing: ${boundedNumber(track, 0).toFixed(2)}em;`,
      '}', '',
    ].join('\n');
    let url;
    let anchor;
    try {
      url = URL.createObjectURL(new Blob([css], { type: 'text/css;charset=utf-8' }));
      anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'zentropy-typography.css';
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      status.textContent = 'CSS download started. Load the named typeface in your project, then apply the zentropy-type class to your text.';
    } catch (_) {
      status.textContent = 'The CSS could not be downloaded. Your settings are still here.';
    } finally {
      anchor?.remove();
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
  });
  posterButton.addEventListener("click", async event => {
    if (!currentFamilyConfig().poster) {
      status.textContent = "Poster is disabled for this preview face until the production font is allowed there.";
      return;
    }
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const wb = await import("./workbench.js?v=20260907-typography-handoff");
      const sent = wb.sendTypography({
        text: specimenText(text.value), family: family.value,
        size: boundedNumber(size, 40), line: boundedNumber(line, 1.25), track: boundedNumber(track, 0),
      });
      if (!sent) status.textContent = "The browser could not transfer this text. Keep this tab open and try again.";
    } catch (_) {
      status.textContent = "Poster could not be opened. Your specimen is still here.";
    } finally {
      button.disabled = !currentFamilyConfig().poster;
    }
  });
  form.addEventListener("reset", event => {
    event.preventDefault();
    text.value = DEFAULT_TEXT;
    family.value = DEFAULT_FAMILY;
    size.value = "40";
    line.value = "1.25";
    track.value = "0";
    setCompareDefaults();
    apply();
  });
  apply();
}

populateFamilySelector();
for (const root of document.querySelectorAll("[data-font-specimen]")) {
  bootSpecimen(root);
}

bootFontTryLinks();
bootPreviewAssetStatus();
