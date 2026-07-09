import { mountGenerativeField } from "./generative-field.js";

function bootHomeArt() {
  if (!document.body) return;
  document.body.classList.add("home-generative-field");
  document.documentElement.classList.add("home-generative-field-ready");
  mountGenerativeField(document).catch(() => {
    document.documentElement.classList.add("generative-field-failed");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootHomeArt, { once: true });
} else {
  bootHomeArt();
}
