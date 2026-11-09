// Light and tape: film burn, VHS, CRT, oscilloscope.
export const filmburn = {
  id: 'filmburn', name: 'Film burn and gate weave', date: 'Celluloid, 1890s onward', medium: '16 mm and 35 mm film, projected',
  history: 'Film rides through the projector gate one frame at a time and never sits exactly still, which is the gate weave. If the film stalls in front of the lamp the emulsion blisters and burns through. Experimental filmmakers such as Stan Brakhage scratched and painted on the strip and left the damage on screen.',
  analogy: 'Evidence under heat. The longer something is held in the light, the more of it the light eats.',
  demo: null, video: 'press', params: { weave: [0.004, 0, 0.02], burn: [0.45, 0, 1], flicker: [0.25, 0, 1] },
  glsl: `vec4 fx(vec2 uv){
  float fr=floor(u_time*12.); vec2 j=(vec2(hash1(fr),hash1(fr+3.))-.5)*u_weave*vec2(1.,1.8);
  vec3 c=T(uv+j).rgb;
  c*=1.-u_flicker*.5*(hash1(fr+9.)-.3);
  float e=min(min(uv.x,1.-uv.x)*1.25,min(uv.y,1.-uv.y)); float n=fbm(uv*vec2(5.,4.)+vec2(0.,u_time*.12)+u_seed);
  float b=smoothstep(.3,.0,e+n*.25-.12)*u_burn*(.6+.8*hash1(fr));
  vec3 hot=mix(vec3(.5,.04,.0),vec3(1.,.55,.08),smoothstep(.2,.7,b)); hot=mix(hot,vec3(1.,.95,.7),smoothstep(.75,1.,b));
  c=mix(c,hot,clamp(b*.9,0.,1.)); c+=hot*b*.2;
  float sx=hash1(floor(u_time*24.)+floor(uv.x*14.)); float sc=step(.93,sx)*smoothstep(.003,.0,abs(fract(uv.x*14.)-.5+.0))*.5*step(.5,hash1(floor(u_time*24.)+4.));
  c+=sc*.45;
  float g=hash(uv*u_res+fr); c+=(g-.5)*.16;
  float leak=exp(-pow((uv.x-(.15+.7*fract(u_time*.07)))*5.,2.))*.25*u_burn; c+=vec3(1.,.4,.15)*leak;
  float corner=smoothstep(.0,.05,min(e*2.2,1.))*.0; c*=1.-.35*smoothstep(.55,.9,length(uv-.5));
  return P(uv,c);
}`,
  canvas(x, src, p, t, H) { const w = x.canvas.width, h = x.canvas.height; const g = x.createRadialGradient(w / 2, h / 2, h * .3, w / 2, h / 2, h * .8); g.addColorStop(0, 'rgba(255,120,20,0)'); g.addColorStop(1, `rgba(255,110,10,${p.burn * .8})`); x.fillStyle = g; x.fillRect(0, 0, w, h); H.grain(x, .3); },
};

export const vhs = {
  id: 'vhs', name: 'VHS tracking and chroma bleed', date: 'Japan, 1976; the home-video decade, 1980s', medium: 'Half-inch magnetic videotape, helical scan',
  history: 'JVC launched VHS in 1976. By the 1980s copied tapes were moving films and news past state broadcasters in several countries, one dub at a time. Wear on the tape shows as tracking bands, colour that smears sideways, and a ragged band of noise at the bottom where the heads switch.',
  analogy: 'A bootleg. The signal that got through is the one nobody was supposed to carry, and it arrives damaged.',
  demo: null, video: 'switchboard', params: { tracking: [0.5, 0, 1], bleed: [0.5, 0, 1], noise: [0.35, 0, 1] },
  glsl: `vec3 rgb2yiq(vec3 c){ return vec3(dot(c,vec3(.299,.587,.114)),dot(c,vec3(.596,-.274,-.322)),dot(c,vec3(.211,-.523,.312))); }
vec3 yiq2rgb(vec3 c){ return vec3(c.x+.956*c.y+.621*c.z,c.x-.272*c.y-.647*c.z,c.x-1.106*c.y+1.703*c.z); }
vec4 fx(vec2 uv){
  float y=uv.y, row=floor(y*u_res.y/2.); float tm=floor(u_time*30.);
  float jit=(hash(vec2(row,tm))-.5)*.004*u_tracking;
  float band=fract(u_time*.11+.3); float inb=smoothstep(.09,.0,abs(y-band));
  jit+=inb*(.03+.03*hash(vec2(row,tm+1.)))*u_tracking*(hash(vec2(tm,2.))-.4);
  float foot=smoothstep(.06,.0,y); jit+=foot*(hash(vec2(row,tm))-.5)*.05;
  jit+=sin(y*11.+u_time*3.)*.0012*u_tracking;
  vec2 q=vec2(uv.x+jit,uv.y);
  vec3 lum=vec3(0.); float yy=0.;
  for(int i=-2;i<=2;i++) yy+=rgb2yiq(T(q+vec2(float(i)*px().x*.8,0.)).rgb).x*(i==0?.4:.15);
  vec2 ch=vec2(0.); float w=0.;
  for(int i=0;i<12;i++){ float k=float(i); vec3 s=rgb2yiq(T(q-vec2((2.+k*2.4*u_bleed)*px().x,0.)).rgb); ch+=s.yz*(1.-k/12.); w+=1.-k/12.; }
  ch/=w; vec3 col=yiq2rgb(vec3(yy,ch*mix(1.,.8,u_bleed)));
  float nz=hash(vec2(uv.x*u_res.x*.5,row+tm*3.1)); col+= (nz-.5)*.18*u_noise + inb*(nz-.4)*.55 + foot*(nz-.3)*.5;
  col*=.94+.06*sin(y*u_res.y*3.14159);
  col=mix(vec3(luma(col)),col,.85)+vec3(.02,.0,.03);
  return P(uv,col);
}`,
  canvas(x, src, p, t, H) { const w = x.canvas.width, h = x.canvas.height; x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = .35; x.drawImage(src, 5 * p.bleed, 0, w, h); x.globalCompositeOperation = 'multiply'; x.drawImage(src, -4 * p.bleed, 0, w, h); x.restore(); H.grain(x, p.noise * .8); const b = (t * .11 % 1) * h; x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, b, w, h * .03); },
};

export const crt = {
  id: 'crt', name: 'CRT phosphor and scanlines', date: 'Braun tube, 1897; living-room television, 1950s', medium: 'Cathode ray tube with a red, green and blue phosphor mask',
  history: 'Karl Ferdinand Braun built the first cathode ray tube in 1897. By the 1950s a glowing curved screen in the living room was how most households met the news. Up close the picture is a field of red, green and blue dots swept in lines, brighter at the centre and bleeding light past its own edges.',
  analogy: 'The broadcast. A picture assembled one line at a time by someone else, shown to everyone at once, in colours the screen invented.',
  demo: null, video: 'tapemap', params: { curve: [0.12, 0, 0.3], scan: [0.5, 0, 1], mask: [0.45, 0, 1], bloom: [0.6, 0, 1] },
  glsl: `vec4 fx(vec2 uv){
  vec2 c=uv*2.-1.; c*=1.+dot(c,c)*u_curve*.5; vec2 q=c*.5+.5;
  if(q.x<0.||q.x>1.||q.y<0.||q.y>1.) return vec4(0.,0.,0.,1.);
  vec2 ab=(q-.5)*.004; vec3 col=vec3(T(q+ab).r,T(q).g,T(q-ab).b);
  vec3 bl=vec3(0.); for(int i=0;i<8;i++){ float a=float(i)*.785; bl+=max(T(q+vec2(cos(a),sin(a))*px()*7.).rgb-.45,0.); bl+=max(T(q+vec2(cos(a),sin(a))*px()*18.).rgb-.5,0.); }
  col+=bl/16.*u_bloom*2.2;
  float line=.5+.5*cos(q.y*u_res.y*3.14159); col*=1.-u_scan*.5*(1.-pow(line,.6));
  float xi=mod(floor(q.x*u_res.x),3.); vec3 m=vec3(xi==0.?1.:.55,xi==1.?1.:.55,xi==2.?1.:.55); col*=mix(vec3(1.),m*1.25,u_mask);
  col*=1.-.55*smoothstep(.5,1.1,length(c)); col*=.97+.03*sin(u_time*58.);
  float roll=smoothstep(.02,.0,abs(fract(q.y-u_time*.08)-.5)-.0)*.0; col+=roll;
  col+=vec3(.0,.012,.01);
  return vec4(col,1.);
}`,
  canvas(x, src, p, t, H) { const w = x.canvas.width, h = x.canvas.height; x.save(); x.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 0; y < h; y += 3) x.fillRect(0, y, w, 1.2 + p.scan * 1.2); x.restore(); H.vignette(x, .7); },
};

export const scope = {
  id: 'scope', name: 'Oscilloscope line', date: 'Laposky’s Oscillons, 1950s', medium: 'Electron beam on a P31 green phosphor tube',
  history: 'Ben Laposky photographed the traces of an oscilloscope in the early 1950s and called the pictures Oscillons, some of the first electronic art. The beam draws one bright point that fades behind it, so the picture is always the last second of a signal. The screen shows what is measured, and a graticule keeps the measuring honest.',
  analogy: 'A reading. Only the latest sweep is lit, and everything before it is already fading from view.',
  demo: null, video: 'scope', params: { glow: [0.7, 0, 1], sweep: [0.4, 0, 1], grid: [0.5, 0, 1] },
  glsl: `vec4 fx(vec2 uv){
  float e=0.; for(int i=1;i<4;i++) e+=edge(uv,float(i))*(1.-float(i)*.2);
  e=clamp(e*.7,0.,1.); float g=0.;
  for(int i=0;i<8;i++){ float a=float(i)*.785; g+=edge(uv+vec2(cos(a),sin(a))*px()*9.,1.5); }
  g=clamp(g/8.*.8,0.,1.);
  float beam=fract(u_time*u_sweep*.5); float behind=fract(beam-uv.x+1.); float per=exp(-behind*3.2);
  float tr=e*(.28+.72*per)+g*u_glow*.55*(.3+.7*per);
  float flare=exp(-abs(uv.x-beam)*60.)*.35*(e+g*.5);
  vec2 gp=uv*vec2(10.,8.); vec2 gq=abs(fract(gp)-.5); float grid=(smoothstep(.49,.5,max(gq.x,gq.y)))*.18+(smoothstep(.485,.5,gq.y)*step(abs(fract(gp.x*5.)-.5),.04))*.0;
  float tick=step(abs(uv.y-.5),.004)*step(fract(uv.x*50.),.12)*.5;
  vec3 ph=vec3(.30,1.,.48); vec3 col=vec3(.01,.03,.02)+ph*(tr+flare+(grid+tick)*u_grid)*1.1+ph*luma(T(uv).rgb)*.05;
  col*=1.-.5*smoothstep(.45,.95,length(uv-.5)*1.6);
  return P(uv,col);
}`,
  canvas(x, src, p, t, H) { const w = x.canvas.width, h = x.canvas.height; H.filter(x, src, 'grayscale(1) contrast(2.4) invert(1) brightness(.9)'); H.fill(x, '#0b2415', 'multiply'); H.fill(x, '#3dff7a', 'color', .7); x.strokeStyle = 'rgba(80,255,130,.18)'; for (let i = 1; i < 10; i++) { x.beginPath(); x.moveTo(i * w / 10, 0); x.lineTo(i * w / 10, h); x.stroke(); } for (let j = 1; j < 8; j++) { x.beginPath(); x.moveTo(0, j * h / 8); x.lineTo(w, j * h / 8); x.stroke(); } },
};
