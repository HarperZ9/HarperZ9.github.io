// studio-films.js: the One Step films, for optional viewing. The panel under the stage builds its
// players only when opened; every video loads nothing until the reader presses play (preload
// "none") and never starts on its own. The files are release assets of this site's repository
// (tag films-2026-10-04, listed with their SHA-256 in that release's SHA256SUMS); the posters live
// in media/films/. Worlds also borrows a clip from here when the browser has no WebGPU.
const BASE = "https://github.com/HarperZ9/HarperZ9.github.io/releases/download/films-2026-10-04/";
const POSTERS = new URL("../media/films/", import.meta.url).href;

export const FILMS = Object.freeze([
  { id: "one-step-v1", title: "One Step", length: "1:48", note: "The first cut, a short film in drawn light." },
  { id: "one-step-v2", title: "One Step, second cut", length: "2:02", note: "Seven plates: the automaton, the eye, liquid chrome, lanterns, the orb, the hill, the lattice." },
  { id: "one-step-threads", title: "One Step, threads", length: "5:06", note: "The fifteen worlds drawn in light threads, two million particles each." },
  { id: "study-morphogen", title: "Study: Morphogen", length: "0:40", note: "A reaction-diffusion field grows, and an eye opens in it." },
  { id: "study-cathedral", title: "Study: Cathedral", length: "0:40", note: "An endless cathedral cut as a Menger sponge, until its blocks begin to fall." },
  { id: "study-droste", title: "Study: Droste", length: "0:40", note: "Tiles that turn and fall into themselves." },
  { id: "study-rorschach", title: "Study: Rorschach", length: "0:40", note: "A mirrored ink blot that keeps changing as you read it." },
]);

// The film that shows a world best, for the Worlds fallback.
const WORLD_FILM = { morphogen: "study-morphogen", droste: "study-droste", many: "study-cathedral", voices: "study-rorschach",
  eye: "one-step-v2", stream: "one-step-v2", draw: "one-step-v2", making: "one-step-v1" };
export function filmForWorld(world) {
  const id = WORLD_FILM[world] || "one-step-threads";
  return FILMS.find((f) => f.id === id);
}
export const filmUrl = (f) => BASE + f.id + ".mp4";
export const posterUrl = (f) => POSTERS + f.id + ".jpg";

function css() {
  if (document.getElementById("studio-films-css")) return;
  const l = document.createElement("link");
  l.id = "studio-films-css"; l.rel = "stylesheet"; l.href = new URL("studio-films.css?v=20261004-films2", import.meta.url).href;
  document.head.append(l);
}

/** A player for one film: poster first, nothing loaded until play, never autoplaying. */
export function filmPlayer(f, { caption = true } = {}) {
  css();
  const fig = document.createElement("figure");
  fig.className = "sf-film";
  const v = document.createElement("video");
  v.controls = true; v.preload = "none"; v.playsInline = true;
  v.poster = posterUrl(f); v.src = filmUrl(f);
  v.setAttribute("aria-label", `${f.title}, ${f.length}`);
  fig.append(v);
  if (caption) {
    const c = document.createElement("figcaption");
    const t = document.createElement("b"); t.textContent = f.title;
    c.append(t, ` ${f.length}. ${f.note} `);
    const a = document.createElement("a"); a.href = filmUrl(f); a.textContent = "Open the file";
    c.append(a);
    fig.append(c);
  }
  return fig;
}

/** Fill the Films panel the first time it opens. */
export function mountFilms(details) {
  if (!details || details.dataset.mounted) return;
  const fill = () => {
    if (!details.open || details.dataset.mounted) return;
    details.dataset.mounted = "1";
    const grid = document.createElement("div");
    grid.className = "sf-grid";
    for (const f of FILMS) grid.append(filmPlayer(f));
    details.append(grid);
  };
  details.addEventListener("toggle", fill);
  fill();
}
