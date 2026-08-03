// system/spatial-gl.js
// Context acquisition for the spatial renderers. Creating a context can fail
// transiently right after another context was explicitly lost on teardown
// (the GPU process is still cleaning up), so acquisition retries with a
// short backoff before declaring the device unable.

export async function acquireContext(canvas, type, options, tries = 4, delayMs = 120) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const gl = canvas.getContext(type, options)
      || (type === "webgl" ? canvas.getContext("experimental-webgl", options) : null);
    if (gl && !gl.isContextLost()) return gl;
    if (attempt < tries - 1) await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
  }
  return null;
}

export default { acquireContext };
