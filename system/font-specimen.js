const DEFAULT_TEXT = "Letters should keep their shape when the work gets dense.";

const EDITORIAL_PREVIEW_COVERAGE = new Set([
  ...Array.from({ length: 95 }, (_, index) => index + 32),
  160,
  176,
  177,
  215,
  247,
  8211,
  8212,
  8216,
  8217,
  8220,
  8221,
  8226,
  8230,
  8722,
]);

const FAMILIES = Object.freeze({
  hanken: {
    label: "Hanken Grotesk",
    stack: '"Hanken Grotesk", sans-serif',
    poster: true,
    css: true,
  },
  conso: {
    label: "Conso",
    stack: '"Conso", serif',
    poster: true,
    css: true,
  },
  "editorial-preview": {
    label: "Zentropy Editorial Preview",
    stack: '"Zentropy Editorial Preview", Georgia, serif',
    poster: false,
    css: false,
    preview: true,
    coverage: EDITORIAL_PREVIEW_COVERAGE,
  },
});

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
  const familyConfig = FAMILIES["editorial-preview"];
  const loadState = fontFaceState(familyConfig);
  const message = loadState === "failed" || loadState === "unavailable"
    ? `${familyConfig.label} could not load; fallback text is shown.`
    : "";
  for (const notice of notices) {
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

  if (!form || !live || !preview || !status || !warning || !text || !family || !size || !line || !track) return;
  if (!sizeOutput || !lineOutput || !trackOutput || !posterButton || !cssButton) return;

  function currentFamilyKey() {
    return Object.hasOwn(FAMILIES, family.value) ? family.value : "hanken";
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
        ? "Regular preview loaded"
        : "";
    const statePrefix = stateLabel ? `${familyConfig.label}, ${stateLabel}, ` : `${familyConfig.label}, `;
    status.textContent = `${statePrefix}${nextSize} px, line height ${nextLine.toFixed(2)}, tracking ${nextTrack.toFixed(2)} em`;
  }

  form.hidden = false;
  live.hidden = false;
  status.hidden = false;
  form.addEventListener("input", apply);
  form.addEventListener("change", apply);
  form.addEventListener("submit", event => event.preventDefault());
  document.fonts?.ready.then(apply).catch(() => apply());
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
    family.value = "hanken";
    size.value = "40";
    line.value = "1.25";
    track.value = "0";
    apply();
  });
  apply();
}

for (const root of document.querySelectorAll("[data-font-specimen]")) {
  bootSpecimen(root);
}

bootFontTryLinks();
bootPreviewAssetStatus();
