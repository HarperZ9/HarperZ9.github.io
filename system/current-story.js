const MANIFEST_PATH = "art/current-story/manifest.json";

let manifestPromise;
const spritePromises = new Map();
const pendingFrames = new WeakMap();

function fetchJson(path) {
  return fetch(path, { cache: "force-cache" }).then((response) => {
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  });
}

function loadManifest() {
  if (!manifestPromise) manifestPromise = fetchJson(MANIFEST_PATH);
  return manifestPromise;
}

function loadSprite(path) {
  if (!spritePromises.has(path)) {
    spritePromises.set(path, new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(path);
      image.onerror = () => reject(new Error(`Could not decode ${path}.`));
      image.src = path;
    }));
  }
  return spritePromises.get(path);
}

function frameStyle(item, manifest) {
  const sprite = manifest.published_assets.sprites[item.sprite_index];
  if (!sprite) throw new Error(`Missing sprite ${item.sprite_index}.`);
  const frames = sprite.frames;
  const position = frames <= 1 ? 0 : (item.frame_index / (frames - 1)) * 100;
  return {
    path: sprite.path,
    size: `100% ${frames * 100}%`,
    position: `50% ${position}%`,
  };
}

async function revealFrame(element, item, manifest) {
  const style = frameStyle(item, manifest);
  await loadSprite(style.path);
  element.style.backgroundImage = `url("${style.path}")`;
  element.style.backgroundSize = style.size;
  element.style.backgroundPosition = style.position;
  element.dataset.loaded = "true";
}

const frameObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const payload = pendingFrames.get(entry.target);
        if (payload) revealFrame(entry.target, payload.item, payload.manifest).catch(console.error);
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "1000px 0px" })
  : null;

function scheduleFrame(element, item, manifest) {
  pendingFrames.set(element, { item, manifest });
  if (frameObserver) frameObserver.observe(element);
  else revealFrame(element, item, manifest).catch(console.error);
}

function sourceLabel(item) {
  return item.display_source || item.source_filename.replace(/\.[^.]+$/, "");
}

let dialogState;

function ensureDialog() {
  let dialog = document.querySelector("[data-current-story-dialog]");
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.className = "story-dialog";
  dialog.dataset.currentStoryDialog = "";
  dialog.innerHTML = `
    <div class="story-dialog-inner">
      <div class="story-dialog-stage">
        <div class="story-dialog-image" data-dialog-image role="img"></div>
      </div>
      <div class="story-dialog-meta">
        <button class="story-dialog-close" type="button" data-dialog-close>Close</button>
        <div class="story-dialog-nav" aria-label="Artwork controls">
          <button type="button" data-dialog-previous aria-label="Previous artwork">&larr;</button>
          <output class="story-dialog-position" data-dialog-position aria-live="polite"></output>
          <button type="button" data-dialog-next aria-label="Next artwork">&rarr;</button>
        </div>
        <p class="story-dialog-description" data-dialog-description></p>
        <p class="story-dialog-source" data-dialog-source></p>
      </div>
    </div>`;
  document.body.append(dialog);

  dialog.querySelector("[data-dialog-close]").addEventListener("click", () => dialog.close());
  dialog.querySelector("[data-dialog-previous]").addEventListener("click", () => showDialogFrame(dialogState.index - 1));
  dialog.querySelector("[data-dialog-next]").addEventListener("click", () => showDialogFrame(dialogState.index + 1));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showDialogFrame(dialogState.index - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      showDialogFrame(dialogState.index + 1);
    }
  });
  return dialog;
}

async function showDialogFrame(index) {
  if (!dialogState) return;
  const { dialog, items, manifest } = dialogState;
  const bounded = Math.max(0, Math.min(items.length - 1, index));
  dialogState.index = bounded;
  const item = items[bounded];
  const image = dialog.querySelector("[data-dialog-image]");
  image.dataset.loaded = "false";
  image.setAttribute("aria-label", item.alt);
  await revealFrame(image, item, manifest);
  dialog.querySelector("[data-dialog-position]").textContent = `${String(bounded + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
  dialog.querySelector("[data-dialog-description]").textContent = item.alt;
  dialog.querySelector("[data-dialog-source]").textContent = sourceLabel(item);
  dialog.querySelector("[data-dialog-previous]").disabled = bounded === 0;
  dialog.querySelector("[data-dialog-next]").disabled = bounded === items.length - 1;
}

function openDialog(items, manifest, index) {
  const dialog = ensureDialog();
  dialogState = { dialog, items, manifest, index };
  showDialogFrame(index).catch(console.error);
  if (!dialog.open) dialog.showModal();
}

function makeCard(item, index, items, manifest, vertical = false) {
  const figure = document.createElement("figure");
  figure.className = "story-card";
  figure.dataset.storyIndex = String(index);
  if (index > 0 && items[index - 1].movement !== item.movement) {
    figure.dataset.movementStart = "true";
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "story-card-open";
  button.setAttribute("aria-label", `Open artwork ${index + 1} of ${items.length}: ${item.alt}`);

  const image = document.createElement("span");
  image.className = "story-card-image";
  image.setAttribute("role", "img");
  image.setAttribute("aria-label", item.alt);
  scheduleFrame(image, item, manifest);
  button.append(image);
  button.addEventListener("click", () => openDialog(items, manifest, index));

  const caption = document.createElement("figcaption");
  const position = document.createElement("span");
  position.textContent = `${String(index + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
  const source = document.createElement("span");
  source.textContent = sourceLabel(item);
  caption.append(position, source);

  figure.append(button, caption);
  if (vertical) figure.classList.add("story-card--vertical");
  return figure;
}

function installRailControls(root, scroller, cards) {
  const previous = root.querySelector("[data-story-previous]");
  const next = root.querySelector("[data-story-next]");
  const output = root.querySelector("[data-story-position]");
  let activeIndex = 0;
  let scheduled = false;

  function update(index) {
    activeIndex = Math.max(0, Math.min(cards.length - 1, index));
    if (output) output.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`;
    if (previous) previous.disabled = activeIndex === 0;
    if (next) next.disabled = activeIndex === cards.length - 1;
  }

  function nearestIndex() {
    let best = 0;
    let distance = Number.POSITIVE_INFINITY;
    cards.forEach((card, index) => {
      const candidate = Math.abs(card.offsetLeft - scroller.scrollLeft);
      if (candidate < distance) {
        distance = candidate;
        best = index;
      }
    });
    return best;
  }

  function onScroll() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      update(nearestIndex());
    });
  }

  function goTo(index) {
    const bounded = Math.max(0, Math.min(cards.length - 1, index));
    scroller.scrollTo({ left: cards[bounded].offsetLeft, behavior: "smooth" });
    update(bounded);
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
  update(0);
}

async function renderRail(root) {
  const status = root.querySelector("[data-current-story-status]");
  const scroller = root.querySelector("[data-story-scroller]");
  const track = root.querySelector("[data-current-story-track]");
  if (!scroller || !track) return;

  try {
    const manifest = await loadManifest();
    const items = manifest.images || [];
    const fragment = document.createDocumentFragment();
    items.forEach((item, index) => fragment.append(makeCard(item, index, items, manifest)));
    track.replaceChildren(fragment);
    track.hidden = false;
    status?.remove();
    root.dataset.storyReady = "true";
    installRailControls(root, scroller, Array.from(track.children));
  } catch (error) {
    if (status) status.textContent = "The art could not be loaded here. Open the vertical edition or inspect the public manifest.";
    console.error(error);
  }
}

function movementHeading(movement) {
  const wrapper = document.createElement("header");
  wrapper.className = "story-movement";
  if (movement === "continuation") {
    wrapper.innerHTML = `<p class="story-movement-label">Movement II · continuation</p><h2>The reaction continues.</h2><p>Ten additional works, preserved in the order they were supplied on July 23.</p>`;
  } else {
    wrapper.innerHTML = `<p class="story-movement-label">Movement I · original sequence</p><h2>Current Story.</h2><p>The original seventeen works remain in ascending numeric source order.</p>`;
  }
  return wrapper;
}

async function renderGrid(root) {
  const status = root.querySelector("[data-current-story-status]");
  const target = root.querySelector("[data-current-story-grid-target]");
  if (!target) return;

  try {
    const manifest = await loadManifest();
    const items = manifest.images || [];
    const fragment = document.createDocumentFragment();
    let movement;
    items.forEach((item, index) => {
      if (item.movement !== movement) {
        movement = item.movement;
        fragment.append(movementHeading(movement));
      }
      fragment.append(makeCard(item, index, items, manifest, true));
    });
    target.replaceChildren(fragment);
    status?.remove();
    root.dataset.storyReady = "true";
  } catch (error) {
    if (status) status.textContent = "The visual sequence could not be loaded. The public manifest remains available.";
    console.error(error);
  }
}

for (const root of document.querySelectorAll("[data-current-story-rail]")) renderRail(root);
for (const root of document.querySelectorAll("[data-current-story-grid]")) renderGrid(root);
