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
float h(vec2 p){ return fract(abs(sin(dot(p, vec2(127.1, 311.7)) + SEED) * 43758.5453)); }
vec2 off(vec2 g){ return vec2(h(g), h(g + 17.3)) * 0.6 + 0.2; }
float level(vec2 p, float cell, float pxPerUnit){
  vec2 g = floor(p / cell), f = p / cell - g;
  float pc = cell * 10.0;                                  // the parent level's cell
  vec2 pg = floor(p / pc);
  float pd = length(p / pc - pg - off(pg));
  float cluster = exp(-pow(pd / 0.24, 2.0));               // dots gather around the parent's dot
  float keep = step(h(g + 3.7), cluster * 1.6);
  float sizePx = cell * pxPerUnit;
  float rpx = clamp(sizePx * 0.06, 0.9, 7.0);
  float d = length(f - off(g)) * sizePx;
  float dot_ = (1.0 - smoothstep(rpx - 1.0, rpx + 0.2, d)) * keep;
  float vis = smoothstep(1.5, 8.0, sizePx) * (1.0 - smoothstep(300.0, 1200.0, sizePx));
  return dot_ * vis;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * R) / R.y;
  float zoom = pow(10.0, S);
  float pxPerUnit = R.y / (6.0 * zoom);
  vec2 p = uv * 6.0 * zoom + vec2(0.31, 0.17);
  float v = 0.0;
  float base = floor(S) - 2.0;
  for (int i = 0; i < 5; i++) v += level(p, pow(10.0, base + float(i)), pxPerUnit);
  float r = length(uv);
  float ring = 0.6 * (1.0 - smoothstep(0.0, 0.004, abs(r - 0.36 - 0.01 * sin(T * 0.4)))) * 0.35;  // the aperture
  float vig = 1.0 - smoothstep(0.25, 1.05, r);
  vec3 ink = vec3(0.92, 0.898, 0.847);
  vec3 ground = vec3(0.0235, 0.0235, 0.0314);
  float scan = 0.94 + 0.06 * step(0.5, fract(gl_FragCoord.y / 3.0));
  color = vec4(ground + ink * clamp((v * 0.85 + ring) * vig * B, 0.0, 1.0) * scan, 1.0);
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
        self.strip = moderngl.TRIANGLE_STRIP  # four corners as a strip cover the whole frame
        self.prog["R"].value = (w, h)
        self.prog["SEED"].value = float(seed % 997)

    def frame(self, scale: float, t: float, brightness: float) -> np.ndarray:
        self.fbo.use()
        self.prog["S"].value, self.prog["T"].value, self.prog["B"].value = scale, t, brightness
        self.fbo.clear(0.0235, 0.0235, 0.0314)
        self.vao.render(mode=self.strip)
        raw = self.fbo.read(components=3)
        return np.frombuffer(raw, np.uint8).reshape(self.h, self.w, 3)[::-1]

    def release(self) -> None:
        self.ctx.release()


def black(w: int, h: int) -> np.ndarray:
    """The CPU stand-in for previews without the GPU: the ground colour only."""
    out = np.empty((h, w, 3), np.uint8)
    out[:] = (6, 6, 8)
    return out
