// Ink on paper: riso, halftone, cyanotype, photocopy.
export const riso = {
  id: 'riso', name: 'Riso print', date: 'Japan, 1980s onward', medium: 'Stencil duplicator, two soy-based ink drums on newsprint-weight paper',
  history: 'Riso Kagaku, a Japanese firm founded in 1946, sold a stencil duplicator that prints one ink drum at a time. Schools, churches and clubs bought it to run off bulletins cheaply. Zine makers, community presses and protest groups took it over, because a second colour means putting the same sheet through again, and the plates never register exactly.',
  analogy: 'Two witnesses to one event. Each one inks a different part of the truth, and the places where they fail to line up are where the sheet starts to talk.',
  demo: 'riso-print', params: { misreg: [0.006, 0, 0.03], grain: [0.55, 0, 1], dropout: [0.35, 0, 1] },
  glsl: `vec4 fx(vec2 uv){
  vec2 o1=vec2(u_misreg,-u_misreg*.6), o2=vec2(-u_misreg*.8,u_misreg);
  vec3 a=T(uv+o1).rgb, b=T(uv+o2).rgb;
  float g=fbm(uv*u_res/2.2+u_seed), g2=fbm(uv*u_res/2.6+9.+u_seed);
  float d1=pow(1.-a.g,1.5)*.95, d2=pow(1.-b.r,1.5)*.95;
  d1=smoothstep(.12,.8,d1+(g-.5)*u_grain*.7); d2=smoothstep(.12,.8,d2+(g2-.5)*u_grain*.7);
  d1*=1.-u_dropout*smoothstep(.62,.8,vn(uv*u_res/1.4)); d2*=1.-u_dropout*smoothstep(.62,.8,vn(uv*u_res/1.4+31.));
  vec3 paper=vec3(.95,.92,.86)*(.96+.06*fbm(uv*u_res/3.));
  vec3 pink=vec3(1.,.30,.62), blue=vec3(.0,.47,.78);
  vec3 col=paper*mix(vec3(1.),pink,d1)*mix(vec3(1.),blue,d2);
  return P(uv,col);
}`,
  canvas(x, src, p, t, H) { H.fill(x, '#f2ebdc', 'multiply'); x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = .55; x.drawImage(src, x.canvas.width * p.misreg, 0, x.canvas.width, x.canvas.height); x.globalAlpha = .35; x.drawImage(src, -x.canvas.width * p.misreg, 0, x.canvas.width, x.canvas.height); x.restore(); H.fill(x, '#ff4d9e', 'soft-light', .35); H.grain(x, p.grain * .6, 'soft-light'); },
};

export const halftone = {
  id: 'halftone', name: 'Halftone and screen print', date: 'Newspapers, from 1880', medium: 'Photomechanical screen, four rotated ink plates',
  history: 'On 4 March 1880 the New York Daily Graphic printed a photograph of a shantytown as a field of dots, the first halftone in a daily paper. The screens for cyan, magenta, yellow and black are turned to different angles so the dots do not clash. Pop artists, protest poster shops and screen printers made the dots into a style.',
  analogy: 'A picture that is only true from a distance. Step closer and you can see every place where someone chose to put a dot, and every place they chose to leave it white.',
  demo: 'wanted-booth', params: { cell: [7, 3, 20], ink: [1, 0, 1.4], drift: [0.5, 0, 1] },
  glsl: `float dots(vec2 uv, float ang, float cell, int ch){
  vec2 p=uv*u_res; mat2 R=rot(ang); vec2 q=R*p/cell; vec2 id=floor(q)+.5; vec2 c=(transpose(R)*(id*cell))/u_res;
  vec3 s=T(c).rgb; float kk=1.-max(s.r,max(s.g,s.b)); float d; if(ch==0) d=1.-s.r-kk*.8; else if(ch==1) d=1.-s.g-kk*.8; else if(ch==2) d=1.-s.b-kk*.8; else d=kk*.95;
  d=pow(clamp(d,0.,1.),1.15);
  float r=sqrt(clamp(d,0.,1.))*.72; float dist=length(fract(q)-.5);
  return smoothstep(r+.06,r-.06,dist);
}
vec4 fx(vec2 uv){
  float c=max(3.,u_cell*u_res.y/900.)*(1.+.0*u_drift);
  float C=dots(uv,.262,c,0), M=dots(uv,1.309,c,1), Y=dots(uv,0.,c,2), K=dots(uv,.785,c,3);
  vec3 col=vec3(.96,.94,.88);
  col*=mix(vec3(1.),vec3(.0,.62,.86),C*u_ink); col*=mix(vec3(1.),vec3(.93,.12,.55),M*u_ink); col*=mix(vec3(1.),vec3(1.,.9,.1),Y*u_ink); col*=mix(vec3(1.),vec3(.1,.1,.12),K*u_ink);
  return P(uv,col);
}`,
  canvas(x, src, p, t, H) { const w = x.canvas.width, h = x.canvas.height, s = Math.max(3, p.cell); H.fill(x, '#f4efe0', 'multiply'); x.save(); x.globalCompositeOperation = 'multiply'; x.drawImage(src, 0, 0, w, h); x.restore(); x.save(); x.globalCompositeOperation = 'multiply'; x.fillStyle = x.createPattern(dotTile(H, s), 'repeat'); x.globalAlpha = .45; x.fillRect(0, 0, w, h); x.restore(); },
};
function dotTile(H, s) { const c = H.mk(s * 2, s * 2), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, s * 2, s * 2); x.fillStyle = '#777'; for (const [a, b] of [[.5, .5], [1.5, 1.5]]) { x.beginPath(); x.arc(a * s, b * s, s * .32, 0, 7); x.fill(); } return c; }

export const cyanotype = {
  id: 'cyanotype', name: 'Cyanotype', date: 'England, 1842', medium: 'Iron salts on paper, exposed to sunlight, fixed in water',
  history: 'Sir John Herschel found in 1842 that iron salts brushed on paper turn Prussian blue in sunlight. The botanist Anna Atkins used it in 1843 for Photographs of British Algae, the first book illustrated with photographic images. Engineers later copied their drawings this way and called the result a blueprint.',
  analogy: 'A shadow keeps the exact outline of whatever blocked the light and none of its substance. A quote with its context removed is the same print.',
  demo: 'cyanotype', params: { exposure: [0.5, 0, 1], flip: [0, 0, 1], brush: [0.6, 0, 1] },
  glsl: `vec4 fx(vec2 uv){
  vec3 c=T(uv).rgb; float l=luma(c); l=mix(l,1.-l,u_flip);
  float n=fbm(uv*u_res/5.); l=clamp((l-.5)*(1.2+u_exposure)+.5+u_exposure*.15+(n-.5)*.12,0.,1.);
  vec3 deep=vec3(.02,.09,.27), mid=vec3(.08,.26,.55), pale=vec3(.86,.92,.90);
  vec3 col=mix(deep,mid,smoothstep(0.,.45,l)); col=mix(col,pale,smoothstep(.55,1.,l));
  vec2 e=min(uv,1.-uv); float edgeD=min(e.x,e.y)+(fbm(uv*vec2(14.,14.))-.5)*.05*u_brush;
  float coat=smoothstep(.02,.032,edgeD); col=mix(vec3(.93,.90,.82)*(.94+.1*n),col,coat);
  float fib=vn(uv*u_res*vec2(.5,.04)+4.); col*=.96+.07*fib;
  return P(uv,col);
}`,
  canvas(x, src, p, t, H) { const w = x.canvas.width, h = x.canvas.height; H.filter(x, src, `grayscale(1) contrast(${1.1 + p.exposure})`); H.fill(x, '#0a3a8c', 'screen', .0); x.save(); x.globalCompositeOperation = 'multiply'; x.fillStyle = '#6aa0e8'; x.fillRect(0, 0, w, h); x.restore(); H.fill(x, '#103a86', 'color', .8); H.grain(x, .25, 'soft-light'); },
};

export const photocopy = {
  id: 'photocopy', name: 'Photocopy generation loss', date: 'Astoria, New York, 1938; Xerox 914, 1959', medium: 'Xerography: static charge, toner, heat',
  history: 'Chester Carlson made the first xerographic copy in 1938, and the Xerox 914 put the machine in offices in 1959. Punk flyers, fanzines and Eastern Bloc samizdat all travelled as copies of copies. Every generation crushes the greys, thickens the edges and adds specks, so the sheet records how many hands it passed through.',
  analogy: 'A rumour. The tenth copy is bolder and blacker than the first, and it has lost every doubt the original carried.',
  demo: 'redacted-house', params: { gen: [0.5, 0, 1], toner: [0.6, 0, 1] },
  passes: p => 1 + Math.round(p.gen * 5),
  glsl: `vec4 fx(vec2 uv){
  float k=u_pass+1.;
  vec2 j=(vec2(hash(vec2(k,1.)),hash(vec2(k,2.)))-.5)*px()*2.2*(1.+k*.3);
  vec3 b=blur3(uv+j,.55+.12*k); float l=luma(b);
  float n=fbm(uv*u_res/2.5+k*3.1);
  l=(l-.5)*(1.12+.07*k)+.5+(n-.5)*.07*k*u_toner;
  float streak=smoothstep(.985,1.,hash(vec2(floor(uv.x*u_res.x/2.),k)))*.16*u_toner*(.3+uv.y);
  l-=streak; l=clamp(l,0.,1.);
  vec2 e=min(uv,1.-uv); float plate=smoothstep(.0,.012*k,min(e.x,e.y)); l*=mix(.35,1.,plate);
  vec3 col=mix(vec3(.08,.08,.09),vec3(.94,.94,.91),l);
  return P(uv,col);
}`,
  canvas(x, src, p, t, H) { H.filter(x, src, `grayscale(1) contrast(${1.4 + p.gen * 2.4}) brightness(${1.05})`); H.grain(x, .25 + p.gen * .4, 'overlay'); H.vignette(x, .3 + p.gen * .5); },
};
