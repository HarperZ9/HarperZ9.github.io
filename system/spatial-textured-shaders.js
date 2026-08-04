// system/spatial-textured-shaders.js
// GLSL for the textured hybrid world (reconstruction lane): the semantic
// depth-mesh + selective-Gaussian pipeline ported verbatim from the spatial
// session's Crystal City Hybrid Proof v1.3. WebGL1 surface. ASCII only.
// Layer modes: 1 deep_sky, 2 haze, 3 celestials, 4 portal, 5 city,
// 6 membrane, 7 beam, 8 water, 9 witness, 0 support.

export const CC_BACKDROP_VS = `
precision highp float;
attribute vec2 aPosition;
varying vec2 vUv;
void main(){
 gl_Position=vec4(aPosition,0.0,1.0);
 vUv=vec2(aPosition.x*.5+.5,.5-aPosition.y*.5);
}`;

export const CC_BACKDROP_FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uSource;
uniform sampler2D uSupport;
uniform sampler2D uBackdrop;
uniform sampler2D uConfidence;
uniform vec2 uCameraOffset;
uniform float uSupportMix;
uniform float uWaterHorizon;
void main(){
 float floorBand=smoothstep(uWaterHorizon-.03,1.0,vUv.y);
 float depthBand=mix(.28,1.0,floorBand);
 vec2 shifted=clamp(vUv+uCameraOffset*depthBand,vec2(.001),vec2(.999));
 vec3 source=texture2D(uSource,shifted).rgb;
 vec3 support=texture2D(uSupport,shifted).rgb;
 vec3 authored=texture2D(uBackdrop,shifted).rgb;
 float confidence=texture2D(uConfidence,shifted).r;
 float edgeDistance=min(min(vUv.x,1.0-vUv.x),min(vUv.y,1.0-vUv.y));
 float edgeGuard=1.0-smoothstep(0.0,.055,edgeDistance);
 float weight=clamp(uSupportMix*(confidence*.74+edgeGuard*.24),0.0,.82);
 vec3 color=mix(source,mix(authored,support,.35),weight);
 gl_FragColor=vec4(max(color,vec3(.0015,.002,.004)),1.0);
}`;

export const CC_MESH_VS = `
precision highp float;
precision highp int;
attribute vec2 aUv;
uniform sampler2D uDepth;
uniform mat4 uView;
uniform mat4 uProj;
uniform float uTanHalfFov;
uniform float uAspect;
uniform float uNearDistance;
uniform float uFarDistance;
uniform float uGeometryScale;
uniform float uTime;
uniform float uWaterFlow;
uniform float uHazeFlow;
uniform float uSkyCurve;
uniform int uWater;
uniform int uLayerMode;
varying vec2 vMaskUv;
varying vec2 vTexUv;
void main(){
 vec2 texUv=aUv;
 float flow=max(uHazeFlow,0.0);
 if(uLayerMode==2){
  float speed=.07+flow*.54;
  vec2 drift=vec2(
   sin(aUv.y*9.0+uTime*speed+aUv.x*2.4),
   cos(aUv.x*8.0-uTime*(speed*.81)+aUv.y*1.9)
  );
  vec2 slow=vec2(sin(uTime*.071),cos(uTime*.059));
  texUv=clamp(aUv+drift*(.0005+.0095*flow)+slow*.0024*flow,0.001,0.999);
 }
 float dn=texture2D(uDepth,aUv).r;
 float d=mix(uNearDistance,uFarDistance,dn);
 vec3 p=vec3((aUv.x-.5)*uGeometryScale*2.0*uAspect*uTanHalfFov*d,(.5-aUv.y)*uGeometryScale*2.0*uTanHalfFov*d,-d);
 if(uLayerMode==1){
  vec2 q=vec2((aUv.x-.5)*1.15,(aUv.y-.25)*.72);
  p.z-=dot(q,q)*uSkyCurve*1.55;
  p.x+=q.x*dot(q,q)*uSkyCurve*.095;
  vec2 lens=aUv-.5;texUv=clamp(.5+lens*(1.0-uSkyCurve*.060*dot(lens,lens)),.001,.999);
 }
 if(uLayerMode==2){
  float speed=.11+flow*.48;
  float veil=sin(aUv.x*8.0+uTime*speed)+cos(aUv.y*10.0-uTime*(speed*.76));
  float curl=sin((aUv.x+aUv.y)*15.0+uTime*(.08+flow*.35));
  p.x+=(veil*.011+curl*.006)*flow;
  p.y+=(curl*.009-veil*.004)*flow;
  p.z+=(veil*.026+curl*.011)*flow;
 }
 if(uWater==1){
  float speed=.28+uWaterFlow*1.35;
  float wave=sin(aUv.x*54.0+uTime*speed)+sin(aUv.y*91.0-uTime*(speed*.72));
  float crossWave=sin((aUv.x+aUv.y)*47.0+uTime*(.22+uWaterFlow*.86));
  p.y+=wave*.0075*uWaterFlow;
  p.z+=crossWave*.014*uWaterFlow;
 }
 gl_Position=uProj*uView*vec4(p,1.0);
 vMaskUv=aUv;
 vTexUv=texUv;
}`;

export const CC_MESH_FS = `
precision mediump float;
precision highp int;
varying vec2 vMaskUv;
varying vec2 vTexUv;
uniform sampler2D uSource;
uniform sampler2D uSupport;
uniform sampler2D uAtmosphere;
uniform sampler2D uMask;
uniform sampler2D uSupportConfidence;
uniform int uUseMask;
uniform int uSupportPass;
uniform int uLayerMode;
uniform float uSupportMix;
uniform float uAtmosphereMix;
uniform float uOpacity;
uniform float uCameraAmount;
uniform highp float uTime;
uniform float uGlow;
uniform float uAtmosphereDensity;
uniform float uBeamFlow;
uniform highp float uWaterFlow;
void main(){
 vec3 source=texture2D(uSource,vTexUv).rgb;
 vec3 atmosphere=texture2D(uAtmosphere,vTexUv).rgb;
 vec3 color=source;
 if(uLayerMode==1){
  float skyVeil=clamp(uAtmosphereDensity*.16,0.0,.30);
  color=mix(source,atmosphere,skyVeil);
  color*=1.0+uAtmosphereDensity*.026;
 }
 else if(uLayerMode==2){
  float driftPattern=.5+.5*sin(vTexUv.x*11.0-vTexUv.y*7.0+uTime*(.10+uAtmosphereDensity*.11));
  float mixAmount=clamp(uAtmosphereMix*(.74+.34*driftPattern),0.0,.96);
  color=mix(source,atmosphere,mixAmount);
  color*=1.0+uAtmosphereDensity*(.025+.035*driftPattern);
 }
 else if(uLayerMode==3){color*=1.0+uGlow*.22;}
 else if(uLayerMode==7){
  float beamPulse=.5+.5*sin((vTexUv.x+vTexUv.y)*31.0-uTime*(.65+uBeamFlow*.92));
  color=mix(source,atmosphere,clamp(.045+uBeamFlow*.115,0.0,.26));
  color*=1.0+uGlow*.32+uBeamFlow*(.12+.26*beamPulse);
 }
 else if(uLayerMode==8){
  float ripple=.5+.5*sin(vTexUv.x*78.0+vTexUv.y*24.0-uTime*(.35+uWaterFlow*1.2));
  color*=1.0+uWaterFlow*(ripple-.42)*.18;
  color=mix(color,atmosphere,clamp(uWaterFlow*.035,0.0,.08));
 }
 else{color=mix(source,atmosphere,uAtmosphereMix);}
 float a=1.0;
 if(uSupportPass==1){
  float confidence=texture2D(uSupportConfidence,vTexUv).r;
  float localMix=clamp(uSupportMix*confidence,0.0,.86);
  color=mix(source,texture2D(uSupport,vTexUv).rgb,localMix);
 }
 else{a=(uUseMask==1?texture2D(uMask,vMaskUv).r:1.0)*uOpacity;if(a<.006)discard;}
 gl_FragColor=vec4(max(color,vec3(0.0))*a,a);
}`;

export const CC_DEPTH_FS = `
precision mediump float;
precision highp int;
varying vec2 vMaskUv;
uniform sampler2D uMask;
uniform float uDepthThreshold;
void main(){if(texture2D(uMask,vMaskUv).r<uDepthThreshold)discard;gl_FragColor=vec4(0.0);}`;

export const CC_POINT_VS = `
precision highp float;
precision highp int;
attribute vec3 iPosition;
attribute vec3 iColor;
attribute float iSize;
attribute float iAlpha;
attribute float iKind;
attribute float iSeed;
uniform mat4 uView;
uniform mat4 uProj;
uniform float uTime;
uniform float uAtmosphereFlow;
uniform float uBeamFlow;
uniform float uWaterFlow;
uniform float uGlow;
uniform float uAtmosphereDensity;
uniform float uBokehScale;
uniform float uMaxPoint;
uniform vec4 uKindVisibilityA;
uniform vec4 uKindVisibilityB;
varying vec3 vColor;
varying float vAlpha;
varying float vKind;
float kindVisibility(int kind){
 if(kind==0)return uKindVisibilityA.x;
 if(kind==1)return uKindVisibilityA.y;
 if(kind==2)return uKindVisibilityA.z;
 if(kind==3)return uKindVisibilityA.w;
 if(kind==4)return uKindVisibilityB.x;
 if(kind==5)return uKindVisibilityB.y;
 if(kind==6)return uKindVisibilityB.z;
 return uKindVisibilityB.w;
}
void main(){
 int kind=int(iKind+.5);
 float phase=iSeed*6.2831853;
 vec3 p=iPosition;
 float atmosphere=max(uAtmosphereFlow,0.0);
 if(kind==1){
  vec3 dir=normalize(vec3(.73,.68,-.17));
  float speed=.22+uBeamFlow*1.15;
  float current=sin(uTime*speed+phase+p.x*.7+p.y*.9);
  p+=dir*(.004+.024*(.35+.65*abs(current))*uBeamFlow);
  p+=vec3(.008*sin(uTime*(speed*1.24)+phase),.008*cos(uTime*(speed*.93)+phase),.005*current)*uBeamFlow;
 }else if(kind==2){
  float speed=.24+uWaterFlow*1.2;
  p+=vec3(.018*sin(uTime*speed+phase),.022*sin(uTime*(speed*1.22)+phase+p.x*1.7),.012*cos(uTime*(speed*.84)+phase))*uWaterFlow;
 }else if(kind==3){
  float speed=.045+atmosphere*.32;
  p+=vec3(.012*sin(uTime*speed+phase),.010*cos(uTime*(speed*.87)+phase),.008*sin(uTime*(speed*.71)+phase))*atmosphere;
 }else if(kind==5){
  float speed=.055+atmosphere*.38;
  p+=vec3(.021*sin(uTime*speed+phase),.018*cos(uTime*(speed*.82)+phase),.015*sin(uTime*(speed*.64)+phase))*atmosphere;
 }else if(kind==6){
  float speed=.07+atmosphere*.44;
  float curl=sin(p.y*1.8+uTime*speed+phase)-cos(p.x*1.4-uTime*(speed*.86)+phase);
  p+=vec3(.030*curl,.025*sin(uTime*(speed*.92)+phase+p.x),.021*cos(uTime*(speed*.74)+phase+p.y))*atmosphere;
 }
 vec4 cam=uView*vec4(p,1.0);
 gl_Position=uProj*cam;
 float shape=1.0;
 if(kind==1)shape=1.08+.30*uBeamFlow;
 else if(kind==3)shape=.75+.20*uAtmosphereDensity;
 else if(kind==5)shape=2.15*uBokehScale;
 else if(kind==6)shape=1.20+.55*uAtmosphereDensity;
 else if(kind==7)shape=.90+.12*uGlow;
 float luminousSize=1.0+uGlow*(kind==1?.22:(kind==7?.18:.08));
 // Energy-preserving clamp: a sprite forced up to the 1px floor covers more area than it earned,
 // so its alpha comes down by the same area ratio and distant material fades instead of popping.
 // The ceiling is the driver's own ALIASED_POINT_SIZE_RANGE, capped to what this lane wants.
 float wantSize=iSize*920.0*shape*luminousSize/max(-cam.z,.2);
 float sizePx=clamp(wantSize,1.0,uMaxPoint);
 float areaRatio=min(1.0,(wantSize/sizePx)*(wantSize/sizePx));
 gl_PointSize=sizePx;
 float pulse=.88+.12*sin(uTime*(kind==7?1.05:(kind==3?.42:.62))+phase);
 float colorGain=1.0+uGlow*(kind==7?1.85:(kind==1?1.55:(kind==5?1.05:.72)))*pulse;
 vColor=iColor*colorGain;
 float density=1.0;if(kind==3)density=clamp(uAtmosphereDensity*2.05,0.0,3.3);else if(kind==5)density=clamp(uAtmosphereDensity*2.70,0.0,4.2);else if(kind==6)density=clamp(uAtmosphereDensity*3.00,0.0,4.8);
 float bokehPresence=kind==5?mix(.18,2.55,smoothstep(.20,2.80,uBokehScale)):1.0;
 float beamPresence=kind==1?(1.0+.62*uBeamFlow):1.0;
 float glowPresence=1.0+uGlow*(kind==7?.95:(kind==1?.72:(kind==5?.48:.30)));
 vAlpha=clamp(iAlpha*pulse*density*bokehPresence*beamPresence*glowPresence*kindVisibility(kind),0.0,.96)*areaRatio;
 vKind=iKind;
}`;

export const CC_POINT_FS = `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
varying float vKind;
void main(){
 vec2 q=gl_PointCoord*2.0-1.0;
 int kind=int(vKind+.5);
 float r2=dot(q,q);
 if(r2>1.0)discard;
 float kernel=exp(-3.7*r2);
 if(kind==1){vec2 r=vec2(q.x*.58+q.y*.58,-q.x*.58+q.y*.58);kernel=exp(-2.4*r.x*r.x-7.2*r.y*r.y);}
 else if(kind==3)kernel=exp(-6.4*r2);
 else if(kind==5){float ring=exp(-22.0*pow(sqrt(r2)-.58,2.0));kernel=exp(-1.8*r2)*(.78+.22*ring);}
 else if(kind==6)kernel=exp(-1.55*r2);
 else if(kind==7){float cross=max(exp(-36.0*q.x*q.x-2.2*q.y*q.y),exp(-2.2*q.x*q.x-36.0*q.y*q.y));kernel=max(exp(-5.4*r2),cross*.58);}
 float a=kernel*vAlpha;
 if(a<.0035)discard;
 gl_FragColor=vec4(vColor*a,a);
}`;
