// Palimpsest renderer: raking-light relief shader over the channel-coded layers, with a 2D fallback.
import { mk } from '../media/index.js';
import { PW, PH, TW, TH, RY0, RY1 } from './pal-layers.js';
const VS = 'attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
const FS = `precision highp float;varying vec2 v;
uniform sampler2D s1,s2,d,vl;uniform vec3 L;uniform vec2 px;
const float Y0=${(RY0 / PH).toFixed(5)},Y1=${(RY1 / PH).toFixed(5)};
float H(vec2 u){
  vec3 a=texture2D(s1,u).rgb; vec3 b=texture2D(s2,u).rgb;
  float inR=step(Y0,u.y)*step(u.y,Y1); vec3 q=texture2D(d,vec2(u.x,(u.y-Y0)/(Y1-Y0))).rgb*inR;
  float f=texture2D(vl,u*vec2(3.,4.)).r;
  return -a.r*1.0-a.g*0.7+a.b*0.9+b.r*0.22-b.g*0.5-q.g*0.7+q.r*0.22+q.b*0.3+f*0.5;
}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){
  vec2 u=v; float asp=0.75;
  vec2 c=abs(u-.5)-vec2(.455,.465); float wob=(vn(u*9.)-.5)*.02+(vn(u*31.)-.5)*.006;
  float sd=max(c.x,c.y)+wob; float alpha=1.-smoothstep(-.003,.003,sd); if(alpha<=0.){gl_FragColor=vec4(0.);return;}
  vec2 e=px*1.6;
  float hx=H(u+vec2(e.x,0.))-H(u-vec2(e.x,0.)); float hy=H(u+vec2(0.,e.y))-H(u-vec2(0.,e.y));
  vec3 N=normalize(vec3(-hx*2.4,-hy*2.4,1.));
  vec2 pa=vec2(u.x*asp,u.y); vec3 Lv=vec3(L.xy-pa,L.z); float dist=length(Lv); vec3 Ld=Lv/dist;
  float att=1./(1.+1.5*dot(Lv.xy,Lv.xy));
  float fl=Ld.z; float relief=dot(N,Ld)-fl;
  vec4 a=texture2D(s1,u); vec4 b=texture2D(s2,u);
  float inR=step(Y0,u.y)*step(u.y,Y1); vec3 q=texture2D(d,vec2(u.x,(u.y-Y0)/(Y1-Y0))).rgb*inR;
  float blot=texture2D(vl,u*vec2(1.2,1.5)).g; float fib=texture2D(vl,u*vec2(3.,4.)).r;
  vec3 skin=mix(vec3(.88,.80,.62),vec3(.70,.55,.34),blot*1.5)*(0.86+0.2*fib);
  float scrape=clamp(a.r+0.7*a.g+q.g*0.5,0.,1.);
  skin=mix(skin,vec3(.45,.30,.15),scrape*(0.34+0.4*att));      // old text: always legible, stronger near the lamp
  skin=mix(skin,vec3(.55,.40,.22),0.08*b.g);
  float lit=0.38+0.85*att*(0.35+fl*1.3)+relief*att*1.7;
  vec3 col=skin*lit;
  float ink=clamp(b.r+q.r,0.,1.); col=mix(col,vec3(.07,.05,.04)*(0.5+0.8*att),ink*0.95);
  col=mix(col,vec3(.42,.07,.07)*(0.5+att),clamp(q.b,0.,1.)*0.9);
  float bar=clamp(a.b,0.,1.); col=mix(col,vec3(.03)*(0.8+4.*max(relief,0.)),bar);
  col*=1.-smoothstep(-.06,0.,sd)*.35;
  gl_FragColor=vec4(col*alpha,alpha);
}`;
export function createRenderer(cv, S1, S2, D, V, pageEl) {
  let gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false }), U = {}, tex = {}, fb = null;
  const chan = (src, ch, rgb, a) => { const o = mk(src.width, src.height), x = o.getContext('2d'), id = src.getContext('2d').getImageData(0, 0, src.width, src.height), od = x.createImageData(src.width, src.height);
    for (let i = 0; i < id.data.length; i += 4) { od.data[i] = rgb[0]; od.data[i + 1] = rgb[1]; od.data[i + 2] = rgb[2]; od.data[i + 3] = id.data[i + ch] * a; } x.putImageData(od, 0, 0); return o; };
  function init() {
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['s1', 's2', 'd', 'vl', 'L', 'px'].forEach(n => U[n] = gl.getUniformLocation(pr, n));
    [['s1', S1, 0, false], ['s2', S2, 1, false], ['d', D, 2, false], ['vl', V, 3, true]].forEach(([n, c, unit, rep]) => {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const w = rep ? gl.REPEAT : gl.CLAMP_TO_EDGE; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.uniform1i(U[n], unit); tex[n] = t; });
  }
  if (gl) { try { init(); } catch (e) { console.error(e); gl = null; const n = mk(2, 2); n.id = cv.id; cv.replaceWith(n); cv = n; } }
  return {
    get canvas() { return cv; }, get gl() { return !!gl; },
    size() { const r = pageEl.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); },
    uploadD() { if (!gl) return; gl.activeTexture(gl.TEXTURE3 - 1); gl.bindTexture(gl.TEXTURE_2D, tex.d); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, D); },
    render(st) {
      if (gl) { gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform3f(U.L, st.lx, st.ly, st.z); gl.uniform2f(U.px, 1 / TW, 1 / TH); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); return; }
      const x = cv.getContext('2d'); x.fillStyle = '#e0cf9f'; x.fillRect(0, 0, cv.width, cv.height);
      if (!fb) fb = [chan(S1, 0, [90, 60, 30], .5), chan(S1, 1, [90, 60, 30], .3), chan(S2, 0, [20, 12, 8], 1), chan(S1, 2, [8, 8, 8], 1)];
      const dl = [chan(D, 0, [20, 12, 8], 1), chan(D, 1, [90, 60, 30], .3), chan(D, 2, [100, 20, 20], 1)];
      const w = cv.width, h = cv.height, dy = RY0 / PH * h, dh = (RY1 - RY0) / PH * h; fb.forEach(c => x.drawImage(c, 0, 0, w, h)); dl.forEach(c => x.drawImage(c, 0, dy, w, dh));
    },
  };
}
