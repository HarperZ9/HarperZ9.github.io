// Own dot field for the theme: a phyllotaxis disc (golden-angle spiral) of round points, one GL point per vertex id and no
// buffers. The 808 sends rings outward through it and the points swell and shift as a ring passes. Spectrum colour lives
// here only, never in the interface. Falls back to a CSS dot pattern when WebGL2 is missing.
const VS = `#version 300 es
precision highp float;
uniform vec2 u_res; uniform vec3 u_disc; uniform float u_n, u_time, u_dpr, u_pulse, u_fade;
uniform vec2 u_rings[6];
out vec4 vc;
vec3 ramp(float t){ t=fract(t); float x=t*5.; vec3 c0=vec3(.12,.17,1.),c1=vec3(.10,.78,.36),c2=vec3(1.,.90,.12),c3=vec3(1.,.50,.06),c4=vec3(.92,.10,.06),c5=vec3(.12,.17,1.);
  return x<1.?mix(c0,c1,x):x<2.?mix(c1,c2,x-1.):x<3.?mix(c2,c3,x-2.):x<4.?mix(c3,c4,x-3.):mix(c4,c5,x-4.); }
void main(){
  float id=float(gl_VertexID), r=sqrt((id+.5)/u_n), a=id*2.39996323;
  float hole=.16; if(r<hole){ gl_Position=vec4(2.,2.,0.,1.); gl_PointSize=0.; vc=vec4(0.); return; }
  float disp=0.;
  for(int k=0;k<6;k++){ float d=r-u_rings[k].x; disp+=u_rings[k].y*exp(-d*d*70.); }
  float rr=r*(1.+.085*disp)+.012*u_pulse*sin(r*26.-u_time*2.1);
  vec2 p=u_disc.xy+vec2(cos(a),sin(a))*rr*u_disc.z;
  float spacing=1.8*u_disc.z/sqrt(u_n);
  gl_Position=vec4(p.x/u_res.x*2.-1.,1.-p.y/u_res.y*2.,0.,1.);
  gl_PointSize=max(1.4*u_dpr,spacing*.62*(1.+1.6*disp+.25*u_pulse)*u_dpr);
  float hue=a/6.2832*.35+r*.7+u_time*.015+disp*.25;
  vc=vec4(ramp(hue),u_fade*(.45+.5*smoothstep(1.,.2,r)+.5*disp));
}`;
const FS = `#version 300 es
precision highp float; in vec4 vc; out vec4 o;
void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.3,d)*clamp(vc.a,0.,1.); o=vec4(vc.rgb*a,a); }`;

export function startField(canvas, { count = 22000 } = {}) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) { canvas.classList.add('nogl'); return { draw() {}, resize() {}, ok: false }; }
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error('dotfield shader: ' + gl.getShaderInfoLog(o)); return o; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('dotfield link: ' + gl.getProgramInfoLog(pr));
  const L = Object.fromEntries(['u_res', 'u_disc', 'u_n', 'u_time', 'u_dpr', 'u_pulse', 'u_fade', 'u_rings'].map((n) => [n, gl.getUniformLocation(pr, n)]));
  const vao = gl.createVertexArray(); let dpr = 1, w = 1, h = 1;
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); const r = canvas.getBoundingClientRect(); w = Math.max(1, r.width); h = Math.max(1, r.height);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  // state: { time, pulse (0..1), fade (0..1), rings: [{r, a}] }. The disc sits right of centre on wide screens, centred on narrow ones.
  function draw({ time = 0, pulse = 0, fade = 1, rings = [] } = {}) {
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(pr); gl.bindVertexArray(vao);
    const rad = Math.min(w * (w < 700 ? 0.46 : 0.3), h * 0.48), cx = w < 700 ? w / 2 : w * 0.64, cy = w < 700 ? Math.min(h * 0.3, rad * 1.05) : h * 0.5;
    gl.uniform2f(L.u_res, w, h); gl.uniform3f(L.u_disc, cx, cy, rad); gl.uniform1f(L.u_n, count); gl.uniform1f(L.u_time, time); gl.uniform1f(L.u_dpr, dpr);
    gl.uniform1f(L.u_pulse, pulse); gl.uniform1f(L.u_fade, fade);
    const a = new Float32Array(12).fill(-9); rings.slice(0, 6).forEach((q, i) => { a[i * 2] = q.r; a[i * 2 + 1] = q.a; }); gl.uniform2fv(L.u_rings, a);
    gl.drawArrays(gl.POINTS, 0, count);
  }
  return { draw, resize, ok: true };
}
