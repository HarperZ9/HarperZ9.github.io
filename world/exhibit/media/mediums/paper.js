// Paper and ink: cut paper, rub-down type, newsprint, marbling.
export const cutpaper = {
  id: 'cutpaper', name: 'Cut-paper collage', date: 'Paris, 1912; Berlin, 1920s', medium: 'Torn and scissored paper, paste, shadow',
  history: 'Picasso and Braque glued newsprint and wallpaper into their canvases in 1912. Berlin Dada artists, Hannah Hoch among them, cut up the illustrated press, and John Heartfield turned photomontage into a weapon against the Nazis in the pages of AIZ. The torn white rim is the paper fibre showing where the sheet was pulled apart by hand.',
  analogy: 'Context. Whoever holds the scissors decides where a picture begins and ends, and the white edge shows that someone cut.',
  demo: 'londons-conduct', params: { tear: [0.012, 0, 0.04], rim: [2.4, 0, 6], shadow: [0.55, 0, 1] },
  glsl: `float A(vec2 uv){ return T(uv).a; }
vec4 fx(vec2 uv){
  vec2 as=AS();
  vec2 dsp=(vec2(fbm(uv*as*38.),fbm(uv*as*38.+9.))-.5)*u_tear;
  vec2 q=uv+dsp; float a=smoothstep(.3,.7,A(q));
  float inner=1.; vec2 e=px()*u_rim;
  inner=min(inner,A(q+vec2(e.x,0.))); inner=min(inner,A(q-vec2(e.x,0.))); inner=min(inner,A(q+vec2(0.,e.y))); inner=min(inner,A(q-vec2(0.,e.y)));
  inner=min(inner,A(q+e)); inner=min(inner,A(q-e));
  float rim=clamp(a-inner,0.,1.);
  vec3 body=T(q).rgb; vec3 fibre=vec3(.95,.93,.88)*(.82+.25*vn(uv*u_res*vec2(1.2,.9)));
  vec3 col=mix(body,fibre,smoothstep(.0,.9,rim));
  float sh=0.; vec2 so=vec2(.006,-.010)*vec2(1.,u_res.x/u_res.y);
  for(int i=-2;i<=2;i++) for(int j=-2;j<=2;j++) sh+=A(uv-so+vec2(float(i),float(j))*px()*2.2);
  sh=sh/25.*u_shadow;
  float out_a=a+sh*(1.-a)*.85;
  vec3 pre=col*a;
  return vec4(pre,out_a);
}`,
  canvas(x, src, p, t, H) { const w = x.canvas.width, h = x.canvas.height; x.save(); x.clearRect(0, 0, w, h); x.shadowColor = `rgba(0,0,0,${p.shadow * .6})`; x.shadowBlur = 10; x.shadowOffsetX = 4; x.shadowOffsetY = 6; x.drawImage(src, 0, 0, w, h); x.restore(); },
};

export const letraset = {
  id: 'letraset', name: 'Rub-down and press type', date: 'London, 1959', medium: 'Dry-transfer lettering on a carrier sheet; letterpress impression',
  history: 'Letraset sheets, launched in London in 1959, let a designer rub a letter off a plastic carrier and onto the page with a pencil. Underground papers, punk sleeves and every pre-computer pitch deck used them. The letters crack, skip and leave a dusty halo where the adhesive let go. Letterpress, the older cousin, presses type into the sheet so you can feel it.',
  analogy: 'A public notice. The letters are applied by hand, with pressure, and some of the words do not take.',
  demo: 'typespec', params: { crack: [0.55, 0, 1], dust: [0.4, 0, 1] },
  glsl: `vec4 fx(vec2 uv){
  vec4 s=T(uv); float m=s.a<.98?s.a:(1.-luma(s.rgb));
  float cr=fbm(uv*u_res/7.+u_seed); float holes=smoothstep(.34+.2*(1.-u_crack),.46+.2*(1.-u_crack),cr);
  float speck=step(.985-.03*u_crack,hash(floor(uv*u_res/1.6)));
  m=clamp(m*holes-speck*.7,0.,1.);
  vec2 e=px()*1.5; float ee=abs(T(uv+e).a-T(uv-e).a)+abs(luma(T(uv+e).rgb)-luma(T(uv-e).rgb));
  float burn=smoothstep(.0,.6,1.-ee)*.5+.5*cr;
  vec3 ink=(s.a<.98?s.rgb:vec3(.05,.05,.06))*(.82+.28*burn);
  float dust=u_dust*smoothstep(.55,.9,fbm(uv*u_res/3.)); ink=mix(ink,vec3(.75,.74,.70),dust*.35*(1.-m));
  float a=max(m,dust*.12);
  return vec4(ink*a,a);
}`,
  canvas(x, src, p, t, H) { H.fill(x, 'rgba(0,0,0,0)', 'source-over'); H.grain(x, p.crack * .6, 'destination-out'); },
};

export const newsprint = {
  id: 'newsprint', name: 'Newsprint ink bleed', date: 'Wood-pulp paper from the 1840s', medium: 'Oil ink on groundwood pulp paper, rotary press',
  history: 'Cheap paper made from wood pulp, developed in the 1840s, made the mass daily paper affordable. The fibres drink ink, so each dot spreads. Printers call this dot gain. The thin sheet also shows the print from its other side. Old newspapers yellow because the pulp still holds acid.',
  analogy: 'A headline. Its ink spreads past its sentence, and what is on the reverse of the page shows through the front.',
  demo: 'neratja', params: { gain: [0.5, 0, 1], through: [0.35, 0, 1], age: [0.5, 0, 1] },
  glsl: `vec4 fx(vec2 uv){
  float fib=fbm(uv*u_res*vec2(.55,.12)+3.); float fib2=fbm(uv*u_res/3.2);
  float r=1.+u_gain*1.5; float d=0.; vec2 e=px()*r;
  for(int i=-2;i<=2;i++) for(int j=-2;j<=2;j++) d+=1.-luma(T(uv+vec2(float(i),float(j))*e).rgb);
  d/=25.;
  float ink=pow(clamp(d*(1.+u_gain*.9),0.,1.),1.1)*(.82+.3*fib);
  float back=0.; for(int i=-1;i<=1;i++) back+=1.-luma(T(vec2(1.-uv.x,uv.y)+vec2(float(i)*px().x*3.,0.)).rgb); back/=3.;
  vec3 paper=mix(vec3(.90,.88,.80),vec3(.80,.70,.50),u_age); paper*=.93+.1*fib;
  vec3 col=paper*(1.-back*u_through*.16);
  col=mix(col,vec3(.10,.09,.09)*(.9+.4*fib2),ink*.94);
  col*=1.-.25*u_age*smoothstep(.3,.0,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)));
  return P(uv,col);
}`,
  canvas(x, src, p, t, H) { H.fill(x, `rgb(${220 - p.age * 30},${205 - p.age * 50},${160 - p.age * 50})`, 'multiply'); H.grain(x, .3, 'soft-light'); },
};

export const marbling = {
  id: 'marbling', name: 'Marbling', date: 'Persia and Turkey, 15th century; Europe, 1600s', medium: 'Pigment floated on thickened water, combed, lifted onto paper',
  history: 'Ebru, the Turkish art of floating pigment on a bath of thickened water, reached Europe in the 1600s. Binders used it for endpapers, and clerks used it on ledgers and legal books because a sheet cannot be copied exactly. Combs and styluses drag the colour into feathers and waves.',
  analogy: 'Testimony. Many people stirred the same bath, no two sheets match, and the pattern is where the colours were pushed.',
  demo: 'marbled-a', params: { flow: [0.35, 0, 1], comb: [0.5, 0, 1], veins: [0.35, 0, 1] },
  glsl: `vec4 fx(vec2 uv){
  vec2 as=AS(); vec2 p=uv*as; float tm=u_time*.03;
  for(int i=0;i<3;i++){ float k=float(i); p+=u_flow*.09*vec2(fbm(p*2.6+k*4.+tm)-.5,fbm(p*2.6+k*4.+7.-tm)-.5)*2.; }
  float teeth=sin(p.y*34.+fbm(p*3.)*4.)*u_comb*.018; p.x+=teeth*smoothstep(.2,.8,fbm(p*1.5+3.));
  vec2 q=p/as; vec3 c=T(q).rgb;
  float f=fbm(p*5.+tm); float line=smoothstep(.46,.5,abs(fract(f*7.)-.5)); c*=1.-u_veins*.55*(1.-line);
  return P(q,c);
}`,
  canvas(x, src, p, t, H) { const w = x.canvas.width, h = x.canvas.height; x.save(); x.globalAlpha = .6; for (let i = 0; i < 24; i++) { const y = i / 24 * h; x.drawImage(src, 0, y, w, h / 24, Math.sin(i * .9) * p.comb * 14, y, w, h / 24); } x.restore(); },
};
