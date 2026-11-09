// Film and plate: x-ray and MRI slices, blueprint and diazo, Polaroid emulsion lift, archival scan.
export const xray = {
  id: 'xray', name: 'X-ray and MRI slice', date: 'Wurzburg, 22 December 1895; MRI, 1970s', medium: 'Silver film on a light box; magnetic-resonance slices',
  history: 'Wilhelm Rontgen made the first medical x-ray, of his wife Anna Bertha’s hand, on 22 December 1895. Within months newspapers printed bones. MRI, developed in the 1970s, reads the body as a stack of thin slices. Radiologists page through the slices to find the thing that no single view shows.',
  analogy: 'Seeing through. A claim cut into slices, and each slice is true by itself. Only the whole stack shows the shadow.',
  demo: 'xray-hand', params: { slices: [1, 1, 4], gain: [1, 0.4, 2], tint: [0.8, 0, 1] },
  glsl: `vec4 fx(vec2 uv){
  float n=max(1.,floor(u_slices+.5)); vec2 cell=floor(uv*n); vec2 f=fract(uv*n); vec2 q=uv;
  float lvl=-1.;
  if(n>1.){ q=f; lvl=(cell.x+cell.y*n+.5)/(n*n); }
  float d=1.-luma(T(q).rgb); d=clamp((d-.1)*u_gain*1.3,0.,1.);
  float v=d; if(n>1.){ float w=.55/(n*n)+.06; v=exp(-pow((d-lvl)/w,2.))*.9+d*.12; }
  vec3 film=mix(vec3(.02,.03,.05),mix(vec3(.45,.70,.92),vec3(.96,.98,1.),v),v*1.0);
  film=mix(vec3(v),film,u_tint);
  film+= (hash(uv*u_res+u_time)-.5)*.05;
  if(n>1.){ vec2 b=min(f,1.-f); film*=smoothstep(.0,.02,min(b.x,b.y)); }
  film*=1.-.5*smoothstep(.5,1.,length(uv-.5)*1.5);
  return P(uv,film);
}`,
  canvas(x, src, p, t, H) { H.filter(x, src, `grayscale(1) invert(1) contrast(${1.2 * p.gain})`); H.fill(x, '#4a90d8', 'color', p.tint * .8); H.vignette(x, .5); },
};

export const blueprint = {
  id: 'blueprint', name: 'Blueprint and diazo', date: 'Cyanotype copies from the 1870s; diazo whiteprint, mid 20th century', medium: 'Light-sensitive paper developed in water, or in ammonia vapour',
  history: 'Engineers and architects copied drawings on cyanotype paper from the 1870s, giving white lines on blue. Diazo paper replaced it in the mid twentieth century and printed blue or black lines on white, developed in ammonia fumes that every drawing office remembered. Everyone on the site worked from the copy and not the master.',
  analogy: 'The plan. Everyone builds from the copy, and nobody asks whether the copy matches what the architect meant.',
  demo: 'blueprint-pigeon', params: { diazo: [0, 0, 1], grid: [0.5, 0, 1], hatch: [0.4, 0, 1] },
  glsl: `vec4 fx(vec2 uv){
  float e=clamp(edge(uv,1.)*1.3,0.,1.); float l=luma(T(uv).rgb);
  vec2 p=uv*u_res; float hat=step(.5,fract((p.x+p.y)/5.))*smoothstep(.55,.2,l)*u_hatch*.5;
  vec2 g1=abs(fract(p/12.)-.5), g2=abs(fract(p/60.)-.5);
  float grid=(smoothstep(.47,.5,max(g1.x,g1.y))*.12+smoothstep(.485,.5,max(g2.x,g2.y))*.22)*u_grid;
  float n=fbm(uv*u_res/4.);
  vec3 bg=mix(vec3(.04,.17,.43),vec3(.10,.30,.60),n*.8), ink=vec3(.92,.97,1.);
  vec3 blue=bg+ink*(grid+max(e*1.2,hat));
  vec3 paper=vec3(.94,.93,.89)*(.95+.08*n); vec3 dz=mix(paper,vec3(.12,.25,.65),max(e,hat*.6)*.95); dz-=grid*.2*vec3(1.,.6,.2);
  vec3 col=mix(blue,dz,u_diazo);
  col*=1.-.3*smoothstep(.5,1.,length(uv-.5)*1.5);
  return P(uv,col);
}`,
  canvas(x, src, p, t, H) { H.filter(x, src, 'grayscale(1) invert(1) contrast(1.6)'); H.fill(x, '#1747a6', 'multiply'); H.fill(x, '#2860c8', 'lighten'); H.grain(x, .2); },
};

export const polaroid = {
  id: 'polaroid', name: 'Polaroid emulsion lift', date: 'Edwin Land, 1947; SX-70, 1972', medium: 'Integral instant film; the emulsion is peeled and moved by hand',
  history: 'Edwin Land announced instant photography in 1947, and the SX-70 of 1972 ejected a print that developed in daylight. There is one print and no negative. Artists then peeled the emulsion off its backing and pushed it around while it was soft. The colours drift to cyan and amber, and the white frame is part of the picture.',
  analogy: 'A single copy, developing in front of you. There is no negative to go back to, and the print can be moved before it sets.',
  demo: 'bread-line-41st', params: { lift: [0.55, 0, 1], fade: [0.6, 0, 1] },
  glsl: `vec4 fx(vec2 uv){
  vec2 lo=vec2(.07,.21), hi=vec2(.93,.93); vec2 q=(uv-lo)/(hi-lo);
  bool inside=q.x>0.&&q.x<1.&&q.y>0.&&q.y<1.;
  vec3 card=vec3(.93,.91,.85)*(.96+.06*fbm(uv*u_res/3.));
  if(!inside){ float edgeS=smoothstep(.0,.02,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y))); return vec4(card*edgeS,edgeS); }
  float corner=length(q-vec2(1.,1.)); float mk=fbm(q*4.+u_seed)*.5+.5*(1.-corner*.9); float lift=smoothstep(.62,.68,mk*u_lift*1.45);
  vec2 w=(vec2(fbm(q*9.),fbm(q*9.+5.))-.5)*.09*lift; vec3 c=T(q+w).rgb;
  float l=luma(c); c=mix(vec3(l),c,.78);
  c=mix(c,vec3(.10,.14,.16)+c*.88,u_fade*.5); c*=vec3(1.04,1.0,.93); c+=vec3(-.02,.03,.05)*(1.-l)*u_fade;
  c=mix(c,card,smoothstep(.6,.0,min(min(q.x,1.-q.x),min(q.y,1.-q.y)))*.06);
  float rim=smoothstep(.015,.0,abs(mk*u_lift*1.45-.65)); c=mix(c,vec3(.97,.95,.9),rim*.75);
  c=mix(c,card*.9,lift*.35*smoothstep(.0,.6,fbm(q*20.)));
  c*=1.-.35*smoothstep(.45,.9,length(q-.5)*1.3);
  return vec4(c,1.);
}`,
  canvas(x, src, p, t, H) { const w = x.canvas.width, h = x.canvas.height; x.fillStyle = '#ede7d6'; x.fillRect(0, 0, w, h); x.drawImage(src, w * .07, h * .21, w * .86, h * .72); H.fill(x, '#1a3a44', 'lighten', p.fade * .25); },
};

export const archival = {
  id: 'archival', name: 'Archival scan with dust, tape and staples', date: 'Flatbed scanning, 1990s; Freedom of Information releases, 1966', medium: 'Flatbed scan of a paper file, handled for decades',
  history: 'Records released under the US Freedom of Information Act, passed in 1966, reach the public as photocopies of photocopies, scanned on a flatbed. The scan keeps the life of the file: the staple holes, the brown tape that held a torn corner, the hair on the glass, and the light bar that darkens one edge.',
  analogy: 'The document that survived. Every mark on it is a person who touched it, and the black bars are the people who did not want it read.',
  demo: 'redacted-cia', params: { dust: [0.5, 0, 1], tape: [1, 0, 1], bar: [0.5, 0, 1] },
  glsl: `float rbox(vec2 p, vec2 b){ vec2 d=abs(p)-b; return length(max(d,0.))+min(max(d.x,d.y),0.); }
vec4 fx(vec2 uv){
  vec2 as=AS(); vec3 c=T(uv).rgb;
  c*=vec3(.96,.94,.88)+.04; c=mix(c,c*vec3(1.02,.97,.88),.5);
  c*=1.-u_bar*.22*smoothstep(.55,1.,uv.x)-u_bar*.06*smoothstep(.3,.0,uv.y);
  c*=.97+.03*sin(uv.y*u_res.y*.9);
  vec2 cell=floor(uv*u_res/3.); float sp=step(.9972-.004*u_dust,hash(cell+u_seed)); c-=sp*(.4+.4*hash(cell+3.))*u_dust;
  float hr=smoothstep(.0022,.0,abs(sin(uv.x*as.x*3.+fbm(uv*3.)*9.)*.06+uv.y*1.7-fract(u_seed*.37)*1.7-0.3))*step(.5,hash1(1.))*u_dust*.4; c-=hr*.5;
  vec2 pc=(uv-vec2(.17,.98))*as; vec2 q=rot(.5)*pc; float tp=rbox(q,vec2(.11,.035)); float tape=smoothstep(.002,-.002,tp)*u_tape;
  float tsh=smoothstep(.02,-.004,rbox(rot(.5)*(pc-vec2(.004,-.01)),vec2(.11,.035)))*u_tape;
  c*=1.-.28*tsh*(1.-tape); c=mix(c,c*vec3(1.,.9,.5)+vec3(.12,.1,.02),tape*.62); c+=tape*smoothstep(.006,.0,abs(tp+.004))*.25;
  vec2 pc2=(uv-vec2(.86,.985))*as; vec2 q2=rot(-.7)*pc2; float tp2=rbox(q2,vec2(.10,.03)); float tape2=smoothstep(.002,-.002,tp2)*u_tape;
  c=mix(c,c*vec3(1.,.9,.5)+vec3(.12,.1,.02),tape2*.55);
  vec2 sc=(uv-vec2(.07,.92))*as; vec2 sq=rot(.35)*sc; float st=rbox(sq,vec2(.04,.0035)); float stp=smoothstep(.002,-.001,st);
  float stsh=smoothstep(.012,-.003,rbox(rot(.35)*(sc-vec2(.003,-.004)),vec2(.04,.0035)));
  c*=1.-.35*stsh*(1.-stp); c=mix(c,vec3(.62,.64,.68)*(.7+.5*smoothstep(.003,-.003,sq.y+.001)),stp);
  return P(uv,c);
}`,
  canvas(x, src, p, t, H) { const w = x.canvas.width, h = x.canvas.height; H.fill(x, '#efe5cf', 'multiply', .6); H.grain(x, p.dust * .25, 'soft-light'); x.fillStyle = 'rgba(200,170,90,.55)'; x.save(); x.translate(w * .17, h * .03); x.rotate(.5); x.fillRect(-w * .1, -h * .02, w * .2, h * .04); x.restore(); x.fillStyle = '#9aa0aa'; x.fillRect(w * .05, h * .08, w * .08, h * .004); },
};
