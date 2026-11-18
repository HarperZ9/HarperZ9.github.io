// engine.js: the native renderer, opened on a press. Each picture has a button under it; a press opens the live
// renderer (media/raw-native/live/) in a full-window frame, and only then does the engine's code or a scene load.
// Leaving (Back to the page, or Esc) removes the frame and frees the GPU. Without WebGPU the buttons stay off and
// the line under the pictures says so; the pictures stay, each a frame from the renderer itself.
const box = document.querySelector('[data-toy="engine"]');
if (box) {
  const state = box.querySelector(".lw-walk-state"), frame = box.querySelector(".lw-walk-frame");
  const buttons = [...box.querySelectorAll("button[data-start]")];
  let opener = null;
  const say = (t) => { state.textContent = t; };

  const close = (why) => {
    const f = frame.querySelector("iframe");
    if (f) f.remove();   // the renderer's device and buffers go with its document
    if (frame.open) frame.close();
    document.documentElement.classList.remove("lw-walking");
    if (why) say(why);
    if (opener) opener.focus();
  };
  frame.addEventListener("close", () => close());
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data || !e.data.rawLive) return;
    if (e.data.rawLive === "leave") close("You left the renderer. Press a button under a picture to open it again.");
    if (e.data.rawLive === "error") close(`The renderer stopped: ${e.data.error}. The pictures here are its own frames.`);
    if (e.data.rawLive === "started") say("The renderer is open. Back to the page, or Esc, brings you here.");
  });

  const open = (b) => {
    opener = b;
    const f = document.createElement("iframe");
    f.src = `${box.dataset.live}?${b.dataset.start}`;
    f.title = `${b.textContent}: the native renderer, drawn live`;
    f.allow = "fullscreen";
    frame.append(f);
    document.documentElement.classList.add("lw-walking");
    frame.showModal();
    f.addEventListener("load", () => f.focus(), { once: true });
    const mb = +b.dataset.bytes / 1e6;
    say(mb ? `Opening the renderer: ${mb.toFixed(1)} MB for the scene, checked against the engine's hashes.` : "Opening the renderer.");
  };

  // the renderer needs WebGPU; asking for an adapter downloads nothing
  const gpu = navigator.gpu ? navigator.gpu.requestAdapter().catch(() => null) : Promise.resolve(null);
  gpu.then((adapter) => {
    if (!adapter) {
      for (const b of buttons) b.disabled = true;
      box.dataset.gpu = "none";
      say("The renderer needs WebGPU, and this browser offers none. Each picture here is a frame the renderer drew, and the certificate check further down runs on your CPU. Recent Chrome and Edge on a desktop draw it live.");
      return;
    }
    box.dataset.gpu = "yes";
    for (const b of buttons) b.closest(".lw-go").hidden = false;
    say("Press a button to open the renderer full-window. A scene downloads only when you press.");
    for (const b of buttons) b.addEventListener("click", () => open(b));
  });
}
