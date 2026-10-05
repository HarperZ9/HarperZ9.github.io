"""The scale field behind a film: a GLSL fragment shader on a headless moderngl context (GPU).

The Eames move: one idea shown by travelling through scale. The field is dots on jittered grids,
one grid per power of ten. `scale` is the camera's power of ten, so each unit of scale is a
tenfold pull-back: a dot at one level becomes a cluster at the next. Time is the only other
input, so the same film gives the same plates. The field is decoration and carries no data;
every number in a film is drawn by figures.py.
"""

from __future__ import annotations

import numpy as np

VS = """#version 330
in vec2 in_pos; void main(){ gl_Position = vec4(in_pos, 0.0, 1.0); }"""

FS = """#version 330
uniform vec2 R; uniform float S; uniform float T; uniform float B; uniform float SEED;
out vec4 color;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + SEED) * 43758.5453); }
float level(vec2 p, float cell, float pxPerUnit){
  vec2 g = floor(p / cell), f = p / cell - g;
  vec2 o = vec2(h(g), h(g + 17.3)) * 0.7 + 0.15;
  float keep = step(0.35, h(g + 3.7));                  // sparse: about two in three cells hold a dot
  float rpx = max(1.2, cell * pxPerUnit * 0.045);        // dot radius in pixels
  float d = length(f - o) * cell * pxPerUnit;
  float dot_ = smoothstep(rpx, rpx - 1.2, d) * keep;
  float sizePx = cell * pxPerUnit;                        // fade a level in and out by its on-screen size
  float vis = smoothstep(14.0, 60.0, sizePx) * (1.0 - smoothstep(500.0, 1400.0, sizePx));
  return dot_ * vis;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * R) / R.y;
  float zoom = pow(10.0, S);
  float pxPerUnit = R.y / (6.0 * zoom);
  vec2 p = uv * 6.0 * zoom + vec2(0.31, 0.17);
  float v = 0.0;
  float base = floor(S) - 2.0;
  for (int i = 0; i < 5; i++) {
    float L = base + float(i);
    v += level(p, pow(10.0, L), pxPerUnit) * (0.55 + 0.45 * h(vec2(L, 2.0)));
  }
  float r = length(uv);
  float ring = smoothstep(0.004, 0.0, abs(r - 0.36 - 0.01 * sin(T * 0.4))) * 0.35;  // the aperture
  float lines = 0.06 * smoothstep(0.5, 1.0, sin(atan(uv.y, uv.x) * 180.0 + T * 0.05)) * smoothstep(0.62, 0.36, r) * smoothstep(0.16, 0.30, r);
  float vig = smoothstep(1.05, 0.25, r);
  vec3 ink = vec3(0.92, 0.898, 0.847);
  vec3 ground = vec3(0.0235, 0.0235, 0.0314);
  float scan = 0.94 + 0.06 * step(0.5, fract(gl_FragCoord.y / 3.0));
  vec3 c = ground + ink * clamp((v * 0.9 + ring + lines) * vig * B, 0.0, 1.0) * scan;
  color = vec4(c, 1.0);
}"""


class Plate:
    def __init__(self, w: int, h: int, seed: int):
        import moderngl
        self.ctx = moderngl.create_standalone_context()
        self.prog = self.ctx.program(vertex_shader=VS, fragment_shader=FS)
        quad = self.ctx.buffer(np.array([-1, -1, 1, -1, -1, 1, 1, 1], "f4"))
        self.vao = self.ctx.vertex_array(self.prog, [(quad, "2f", "in_pos")])
        self.fbo = self.ctx.simple_framebuffer((w, h), components=3)
        self.w, self.h = w, h
        self.prog["R"].value = (w, h)
        self.prog["SEED"].value = float(seed % 997)

    def frame(self, scale: float, t: float, brightness: float) -> np.ndarray:
        self.fbo.use()
        self.prog["S"].value, self.prog["T"].value, self.prog["B"].value = scale, t, brightness
        self.vao.render(mode=6)  # triangle strip
        raw = self.fbo.read(components=3)
        return np.frombuffer(raw, np.uint8).reshape(self.h, self.w, 3)[::-1]

    def release(self) -> None:
        self.ctx.release()


def black(w: int, h: int) -> np.ndarray:
    """The CPU stand-in for previews without the GPU: the ground colour only."""
    out = np.empty((h, w, 3), np.uint8)
    out[:] = (6, 6, 8)
    return out
