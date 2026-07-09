import { mountGenerativeField } from "./generative-field.js";

function placeFieldInHero(doc) {
  const hero = doc.querySelector(".hero");
  const scene = doc.getElementById("gl");
  const motes = doc.getElementById("motes");
  if (!hero || !scene || scene.closest(".hero")) return;

  const anchor = hero.querySelector(".hero-glow") || hero.firstChild;
  scene.classList.add("home-fluid-canvas");
  hero.insertBefore(scene, anchor);
  if (motes) {
    motes.classList.add("home-fluid-motes");
    hero.insertBefore(motes, anchor);
  }
}

function bootHomeArt() {
  if (!document.body) return;
  document.body.classList.add("home-generative-field");
  document.documentElement.classList.add("home-generative-field-ready");
  mountGenerativeField(document).catch(() => {
    document.documentElement.classList.add("generative-field-failed");
  }).then(() => {
    placeFieldInHero(document);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootHomeArt, { once: true });
} else {
  bootHomeArt();
}
