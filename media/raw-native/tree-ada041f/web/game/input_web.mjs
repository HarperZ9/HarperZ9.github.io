// The web host's input devices for the action map (input.mjs): keyboard, pointer and
// gamepad. Browser only.
//
//   const devices = attachWebInput(canvas, { design: [1920, 1080] });
//   const dev = devices.poll();      // once per fixed step: reads gamepads, returns the device state
//   map.sample(dev); devices.consume();   // then clear the taps and the wheel
//   devices.detach();
//
// The pointer position is reported in design units (the Motion scene's 1920 x 1080 frame by
// default), so a game converts it with its own camera. Keys are KeyboardEvent.code values,
// which name a physical position and do not change with the keyboard layout.

import { emptyDevice } from "./input.mjs";

export function attachWebInput(el, { design = [1920, 1080], keyTarget = globalThis.window } = {}) {
  const dev = emptyDevice();
  const offs = [];
  const on = (t, type, f, o) => { t.addEventListener(type, f, o); offs.push(() => t.removeEventListener(type, f, o)); };
  const toDesign = (e) => {
    const r = el.getBoundingClientRect();
    return [((e.clientX - r.left) / Math.max(1, r.width)) * design[0], ((e.clientY - r.top) / Math.max(1, r.height)) * design[1]];
  };
  const pointer = () => (dev.pointer ||= { x: design[0] / 2, y: design[1] / 2, buttons: new Set(), taps: new Set() });
  // Keys the page should not scroll or act on while the game has focus.
  const GAME_KEYS = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
  on(keyTarget, "keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    dev.keys.add(e.code); dev.taps.add(e.code);
    if (GAME_KEYS.has(e.code)) e.preventDefault();
  });
  on(keyTarget, "keyup", (e) => dev.keys.delete(e.code));
  on(keyTarget, "blur", () => { dev.keys.clear(); if (dev.pointer) dev.pointer.buttons.clear(); });
  on(el, "pointermove", (e) => { const [x, y] = toDesign(e); const p = pointer(); p.x = x; p.y = y; });
  on(el, "pointerdown", (e) => {
    const [x, y] = toDesign(e), p = pointer(); p.x = x; p.y = y; p.buttons.add(e.button); p.taps.add(e.button);
    el.setPointerCapture && el.setPointerCapture(e.pointerId);
    el.focus && el.focus({ preventScroll: true });
  });
  on(el, "pointerup", (e) => { if (dev.pointer) dev.pointer.buttons.delete(e.button); });
  on(el, "pointercancel", () => { if (dev.pointer) dev.pointer.buttons.clear(); });
  on(el, "contextmenu", (e) => e.preventDefault());
  on(el, "wheel", (e) => { e.preventDefault(); dev.wheel += Math.sign(e.deltaY); }, { passive: false });
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
  return {
    device: dev,
    // Read the first connected gamepad (standard mapping) into the device; returns the device.
    poll() {
      const pads = (globalThis.navigator && navigator.getGamepads) ? navigator.getGamepads() : [];
      const pad = [...pads].find((p) => p && p.connected);
      dev.padButtons = pad ? pad.buttons.map((b) => b.value) : [];
      dev.padAxes = pad ? [...pad.axes] : [];
      return dev;
    },
    consume() { dev.taps.clear(); dev.wheel = 0; if (dev.pointer) dev.pointer.taps.clear(); },
    detach() { offs.forEach((f) => f()); },
  };
}
