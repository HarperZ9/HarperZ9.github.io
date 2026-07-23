const CHUNK_COUNT = 11;
const FRAME_WIDTH = 320;
const FRAME_HEIGHT = 400;
const FRAME_GAP = 24;
const MANIFEST_PATH = "art/current-story/manifest.json";

let storyPromise;

function chunkPath(index) {
  return `art/current-story/data/sequence.${String(index).padStart(2, "0")}.b64`;
}

async function fetchText(path) {
  const response = await fetch(path, { cache: "force-cache" });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return (await response.text()).trim();
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "force-cache" });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

function decodeImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The Current Story composite could not be decoded."));
    image.src = dataUrl;
  });
}

function loadStory() {
  if (!storyPromise) {
    storyPromise = Promise.all([
      fetchJson(MANIFEST_PATH),
      Promise.all(Array.from({ length: CHUNK_COUNT }, (_, index) => fetchText(chunkPath(index)))),
    ]).then(async ([manifest, chunks]) => {
      const dataUrl = `data:image/webp;base64,${chunks.join("")}`;
      const source = await decodeImage(dataUrl);
      return { dataUrl, manifest, source };
    });
  }
  return storyPromise;
}

async function renderFullSequence(root) {
  const status = root.querySelector("[data-current-story-status]");
  const image = root.querySelector("[data-current-story-image]");
  if (!image) return;

  try {
    const { dataUrl } = await loadStory();
    image.src = dataUrl;
    image.hidden = false;
    status?.remove();
    root.dataset.storyReady = "true";
  } catch (error) {
    if (status) {
      status.textContent = "The visual sequence could not be loaded. The transcript and source manifest remain available.";
    }
    console.error(error);
  }
}

function makeFrame(source, item, index, total) {
  const figure = document.createElement("figure");
  figure.className = "story-card";
  figure.dataset.storyIndex = String(index);

  const canvas = document.createElement("canvas");
  canvas.className = "story-card-image";
  canvas.width = FRAME_WIDTH;
  canvas.height = FRAME_HEIGHT;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", item.alt);

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("The browser could not create a canvas context.");
  context.drawImage(
    source,
    0,
    index * (FRAME_HEIGHT + FRAME_GAP),
    FRAME_WIDTH,
    FRAME_HEIGHT,
    0,
    0,
    FRAME_WIDTH,
    FRAME_HEIGHT,
  );

  const caption = document.createElement("figcaption");
  const position = document.createElement("span");
  position.textContent = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  const sourceName = document.createElement("span");
  sourceName.textContent = item.source_filename.replace(/\.png$/i, "");
  caption.append(position, sourceName);
  figure.append(canvas, caption);
  return figure;
}

function installRailControls(root, scroller, cards) {
  const previous = root.querySelector("[data-story-previous]");
  const next = root.querySelector("[data-story-next]");
  const output = root.querySelector("[data-story-position]");
  let activeIndex = 0;
  let scheduled = false;

  function updateControls(index) {
    activeIndex = Math.max(0, Math.min(cards.length - 1, index));
    if (output) output.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`;
    if (previous) previous.disabled = activeIndex === 0;
    if (next) next.disabled = activeIndex === cards.length - 1;
  }

  function nearestIndex() {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const [index, card] of cards.entries()) {
      const distance = Math.abs(card.offsetLeft - scroller.scrollLeft);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    return bestIndex;
  }

  function onScroll() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      updateControls(nearestIndex());
    });
  }

  function goTo(index) {
    const bounded = Math.max(0, Math.min(cards.length - 1, index));
    scroller.scrollTo({ left: cards[bounded].offsetLeft, behavior: "smooth" });
    updateControls(bounded);
  }

  previous?.addEventListener("click", () => goTo(activeIndex - 1));
  next?.addEventListener("click", () => goTo(activeIndex + 1));
  scroller.addEventListener("scroll", onScroll, { passive: true });
  scroller.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(activeIndex - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(activeIndex + 1);
    }
  });
  updateControls(0);
}

async function renderRail(root) {
  const status = root.querySelector("[data-current-story-status]");
  const scroller = root.querySelector("[data-story-scroller]");
  const track = root.querySelector("[data-current-story-track]");
  if (!scroller || !track) return;

  try {
    const { manifest, source } = await loadStory();
    const fragment = document.createDocumentFragment();
    const items = manifest.images ?? [];
    for (const [index, item] of items.entries()) {
      fragment.append(makeFrame(source, item, index, items.length));
    }
    track.replaceChildren(fragment);
    track.hidden = false;
    status?.remove();
    root.dataset.storyReady = "true";
    installRailControls(root, scroller, Array.from(track.children));
  } catch (error) {
    if (status) {
      status.textContent = "The art could not be loaded here. Open the uninterrupted visual sequence or inspect the public manifest.";
    }
    console.error(error);
  }
}

for (const root of document.querySelectorAll("[data-current-story-full]")) {
  renderFullSequence(root);
}

for (const root of document.querySelectorAll("[data-current-story-rail]")) {
  renderRail(root);
}
