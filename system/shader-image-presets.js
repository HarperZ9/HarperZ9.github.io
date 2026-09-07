// Local image studies. Kept separate so procedural preset indexes stay stable.
export const IMAGE_STUDIES = Object.freeze({
  image: {
    name: 'Image, unaltered',
    knobs: '(This study passes the source through; the three knobs are unused.)',
    glsl: `// A local image, before any pixel or display treatment.
// iChannelResolution[0].xy gives its dimensions.
void mainImage(out vec4 O, in vec2 U) {
  O = texture2D(iChannel0, U / iResolution.xy);
}`,
  },
  contour: {
    name: 'Contour ink',
    knobs: 'A=line weight B=tonal steps C=paper warmth',
    glsl: `// Five image samples: tonal planes and a contour drawn from contrast.
float lightness(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void mainImage(out vec4 O, in vec2 U) {
  vec2 uv = U / iResolution.xy;
  vec2 px = (1.0 + 3.0*iKnobA) / max(iChannelResolution[0].xy, vec2(1.0));
  float value = lightness(texture2D(iChannel0, uv).rgb);
  float dx = lightness(texture2D(iChannel0, uv+vec2(px.x,0.0)).rgb)
           - lightness(texture2D(iChannel0, uv-vec2(px.x,0.0)).rgb);
  float dy = lightness(texture2D(iChannel0, uv+vec2(0.0,px.y)).rgb)
           - lightness(texture2D(iChannel0, uv-vec2(0.0,px.y)).rgb);
  float steps = 3.0 + floor(iKnobB*9.0);
  float tone = floor(value*steps + 0.5) / steps;
  float edge = smoothstep(0.025, 0.22, length(vec2(dx,dy)));
  vec3 paper = mix(vec3(0.96), vec3(1.0,0.91,0.76), iKnobC);
  vec3 ink = vec3(0.055,0.075,0.09);
  O = vec4(mix(ink, paper, tone*(1.0-edge)), 1.0);
}`,
  },
});
