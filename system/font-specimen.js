const DEFAULT_TEXT = "Letters should keep their shape when the work gets dense.";

const FAMILIES = Object.freeze({
  hanken: {
    label: "Hanken Grotesk",
    stack: '"Hanken Grotesk", sans-serif',
  },
  conso: {
    label: "Conso",
    stack: '"Conso", serif',
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

function bootSpecimen(root) {
  const form = root.querySelector("[data-font-specimen-controls]");
  const live = root.querySelector("[data-font-specimen-live]");
  const preview = root.querySelector("[data-font-specimen-preview]");
  const status = root.querySelector("[data-font-specimen-status]");
  const text = root.querySelector("[data-font-specimen-text]");
  const family = root.querySelector("[data-font-specimen-family]");
  const size = root.querySelector("[data-font-specimen-size]");
  const line = root.querySelector("[data-font-specimen-line]");
  const track = root.querySelector("[data-font-specimen-track]");
  const sizeOutput = root.querySelector("#font-specimen-size-output");
  const lineOutput = root.querySelector("#font-specimen-line-output");
  const trackOutput = root.querySelector("#font-specimen-track-output");

  if (!form || !live || !preview || !status || !text || !family || !size || !line || !track) return;
  if (!sizeOutput || !lineOutput || !trackOutput) return;

  function apply() {
    const familyKey = FAMILIES[family.value] ? family.value : "hanken";
    const familyConfig = FAMILIES[familyKey];
    const nextSize = Math.round(boundedNumber(size, 40));
    const nextLine = boundedNumber(line, 1.25);
    const nextTrack = boundedNumber(track, 0);

    preview.textContent = specimenText(text.value);
    preview.dataset.fontFamily = familyKey;
    preview.style.fontFamily = familyConfig.stack;
    preview.style.fontSize = `${nextSize}px`;
    preview.style.lineHeight = nextLine.toFixed(2);
    preview.style.letterSpacing = `${nextTrack.toFixed(2)}em`;

    sizeOutput.textContent = `${nextSize} px`;
    lineOutput.textContent = nextLine.toFixed(2);
    trackOutput.textContent = `${nextTrack.toFixed(2)} em`;
    status.textContent = `${familyConfig.label}, ${nextSize} px, line height ${nextLine.toFixed(2)}, tracking ${nextTrack.toFixed(2)} em`;
  }

  form.hidden = false;
  live.hidden = false;
  status.hidden = false;
  form.addEventListener("input", apply);
  form.addEventListener("change", apply);
  form.addEventListener("submit", event => event.preventDefault());
  root.querySelector("[data-font-specimen-poster]")?.addEventListener("click", async event => {
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
    } finally { button.disabled = false; }
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
