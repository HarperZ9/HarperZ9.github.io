// walk.js: the island of Low Water, walked on a press. Each picture has a button under it; a press opens the walk, the
// engine's own code carried from superframe, in a full-window frame (media/low-water/walk.html), and only then does
// anything heavy load. Leaving (Back to the page, or Esc) removes the frame and frees the GPU. Without WebGPU the
// buttons stay off and the line under the pictures says so; the pictures stay, each the engine's own frame. With
// reduced motion set, the walk opens with its clock held, and nothing moves until a key is pressed.
const box = document.querySelector('[data-toy="walk"]');
if (box) {
  const state = box.querySelector(".lw-walk-state"), frame = box.querySelector(".lw-walk-frame");
  const buttons = [...box.querySelectorAll("button[data-start]")], mb = (+box.dataset.bytes / 1e6).toFixed(1);
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let opener = null;
  const say = (t) => { state.textContent = t; };

  const close = (why) => {
    const f = frame.querySelector("iframe");
    if (f) f.remove();   // the walk's device and buffers go with its document
    if (frame.open) frame.close();
    document.documentElement.classList.remove("lw-walking");
    if (why) say(why);
    if (opener) opener.focus();
  };
  frame.addEventListener("close", () => close());
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data || !e.data.lowWater) return;
    if (e.data.lowWater === "leave") close("You left the walk. Press a button under a picture to walk again.");
    if (e.data.lowWater === "error") close(`The walk stopped: ${e.data.error}. The pictures here are the engine's own frames.`);
    if (e.data.lowWater === "started") say("The walk is open. Back to the page, or Esc twice, brings you here.");
  });

  const open = (b) => {
    opener = b;
    const q = `world=${encodeURIComponent(box.dataset.world)}&${b.dataset.start}${still.matches ? "&still=1" : ""}`;
    const f = document.createElement("iframe");
    f.src = `${box.dataset.walk}?${q}`;
    f.title = `${b.textContent}: the island of Low Water, drawn live`;
    f.allow = "fullscreen";
    frame.append(f);
    document.documentElement.classList.add("lw-walking");
    frame.showModal();
    f.addEventListener("load", () => f.focus(), { once: true });
    say(`Opening the walk: ${mb} MB, the nearest ground first.`);
  };

  // the walk needs WebGPU; asking for an adapter downloads nothing
  const gpu = navigator.gpu ? navigator.gpu.requestAdapter().catch(() => null) : Promise.resolve(null);
  gpu.then((adapter) => {
    if (!adapter) {
      for (const b of buttons) b.disabled = true;   // and they stay hidden: a picture with no way in says so below
      box.dataset.gpu = "none";
      say("The walk needs WebGPU, and this browser offers none. Each picture here is the engine's own frame, and the stills further down are its views of every region. Recent Chrome and Edge on a desktop draw the walk.");
      return;
    }
    box.dataset.gpu = "yes";
    for (const b of buttons) b.closest(".lw-go").hidden = false;
    say(`Press a button under a picture to walk from there. The walk downloads ${mb} MB when you press, and nothing before.`);
    for (const b of buttons) b.addEventListener("click", () => open(b));
  });
}
