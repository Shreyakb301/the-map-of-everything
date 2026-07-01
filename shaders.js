// GLSL sources for THE MAP OF EVERYTHING
"use strict";

// Shared vertex-shader prelude: every layer (main universe, meta universe)
// runs the same displacement field, so all motion comes from one system.
const SH_COMMON = `#version 300 es
precision highp float;
uniform mat4 uVP;
uniform mat3 uRot;
uniform float uScale;     // uniform model scale of this layer
uniform float uLocalT;    // growth clock of this layer (drives births)
uniform float uMotionT;   // motion clock of this layer (drives drift)
uniform float uPointScale;
uniform float uAlpha;
uniform float uMaxPt;

vec3 wander(vec3 p, float s, float t){
  float a = s*43.7;
  return vec3(
    sin(t*0.310+a      +p.y*0.30)+0.6*sin(t*0.131+a*1.7+p.z*0.23),
    sin(t*0.247+a*2.1+p.z*0.27)+0.6*sin(t*0.113+a*0.8+p.x*0.21),
    sin(t*0.281+a*3.2+p.x*0.25)+0.6*sin(t*0.149+a*2.6+p.y*0.19))*0.34;
}
vec3 swirl(vec3 p, vec3 c, float cph, float t){
  vec3 q = p-c;
  float w  = (fract(cph*7.31)-0.5)*0.06;
  float an = t*w + cph*6.2831853;
  float ca = cos(an), sa = sin(an);
  q.xz = mat2(ca,-sa,sa,ca)*q.xz;
  q *= 1.0 + 0.04*sin(t*0.103 + cph*6.2831853);
  return c+q;
}
`;

const VS_POINT = SH_COMMON + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aCenter;
layout(location=2) in float aSeed;
layout(location=3) in float aCph;
layout(location=4) in float aBirth;
layout(location=5) in float aSize;
layout(location=6) in vec3 aCol;
out vec3 vCol;
out float vA;
void main(){
  float age = uLocalT - aBirth;
  if(age <= 0.0){ gl_Position=vec4(2e9,2e9,2e9,1.0); gl_PointSize=0.0; vA=0.0; vCol=vec3(0); return; }
  vec3 p = swirl(aPos, aCenter, aCph, uMotionT) + wander(aPos, aSeed, uMotionT);
  vec4 cp = uVP * vec4(uRot*p*uScale, 1.0);
  float pop = 1.0 + 2.6*exp(-age*1.3);
  float ps  = uPointScale * aSize * uScale * pop / max(cp.w, 1e-3);
  gl_PointSize = clamp(ps, 0.0, uMaxPt);
  float tw  = 0.82 + 0.30*sin(uMotionT*(1.3+aSeed*1.1) + aSeed*41.0);
  float sub = clamp(ps, 0.35, 1.0);
  float energy = clamp(13.0/max(ps,1.0), 0.10, 1.0); // big close sprites emit less per-pixel
  vA = uAlpha * smoothstep(0.0,0.8,age) * tw * sub*sub * energy * (1.0 + 4.0*exp(-age*1.1));
  vCol = aCol;
  gl_Position = cp;
}`;

const FS_POINT = `#version 300 es
precision highp float;
in vec3 vCol; in float vA;
out vec4 o;
void main(){
  if(vA<=0.001) discard;
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d,d)*4.0;
  if(r2>1.0) discard;
  float core = exp(-r2*7.0);
  float halo = exp(-r2*2.2)*0.35;
  vec3 c = vCol*(core*1.6+halo) + vec3(1.0)*core*core*0.7;
  o = vec4(c*vA, 1.0);
}`;

const VS_LINE = SH_COMMON + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aCenter;
layout(location=2) in float aSeed;
layout(location=3) in float aCph;
layout(location=4) in vec3 aCol;
layout(location=5) in float aT;
layout(location=6) in float aPh;
layout(location=7) in float aEB;
out vec3 vCol;
out float vA;
out float vT;
out float vPh;
out float vRev;
void main(){
  float age = uLocalT - aEB;
  if(age <= 0.0){ gl_Position=vec4(2e9,2e9,2e9,1.0); vA=0.0; vT=0.0; vPh=0.0; vRev=0.0; vCol=vec3(0); return; }
  vec3 p = swirl(aPos, aCenter, aCph, uMotionT) + wander(aPos, aSeed, uMotionT);
  vec4 cp = uVP * vec4(uRot*p*uScale, 1.0);
  vRev = smoothstep(0.0,1.5,age)*1.3;  // overshoot so a finished edge is fully lit
  float df = mix(0.15, 1.0, clamp(300.0*uScale/max(cp.w,1.0), 0.0, 1.0));
  vA  = uAlpha * (0.12 + 0.30*exp(-age*0.8)) * df;
  vT  = aT; vPh = aPh; vCol = aCol;
  gl_Position = cp;
}`;

const FS_LINE = `#version 300 es
precision highp float;
uniform float uMotionT;
in vec3 vCol; in float vA; in float vT; in float vPh; in float vRev;
out vec4 o;
void main(){
  if(vA<=0.0015) discard;
  float a = vA * (1.0 - smoothstep(vRev-0.12, vRev, vT));
  if(a<=0.0015) discard;
  float sp = 0.10 + fract(vPh*7.7)*0.22;
  float x  = fract(vT - uMotionT*sp - vPh);
  float pulse = exp(-x*x*260.0);
  float gate  = smoothstep(0.78,0.97, sin(uMotionT*0.17 + vPh*61.0));
  vec3 c = vCol*(1.0 + pulse*gate*9.0);
  o = vec4(c*a, 1.0);
}`;

// Single glowing point used while the collapsed universe is a lone node.
const VS_DOT = `#version 300 es
uniform mat4 uVP; uniform float uPointScale; uniform float uSizeW; uniform float uMaxPt;
void main(){
  vec4 cp = uVP*vec4(0.0,0.0,0.0,1.0);
  gl_PointSize = clamp(uPointScale*uSizeW/max(cp.w,1e-3), 0.0, uMaxPt);
  gl_Position = cp;
}`;
const FS_DOT = `#version 300 es
precision highp float;
uniform float uInt;
out vec4 o;
void main(){
  vec2 d = gl_PointCoord-0.5;
  float r2 = dot(d,d)*4.0;
  if(r2>1.0) discard;
  float core = exp(-r2*6.0);
  vec3 c = vec3(0.75,0.88,1.0)*(core*1.8) + vec3(1.0)*core*core;
  o = vec4(c*uInt, 1.0);
}`;

// ---- post chain ----
const VS_QUAD = `#version 300 es
layout(location=0) in vec2 aP;
out vec2 vUv;
void main(){ vUv = aP*0.5+0.5; gl_Position = vec4(aP,0.0,1.0); }`;

const FS_DOWN = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform float uTh;
in vec2 vUv; out vec4 o;
void main(){
  vec3 c = texture(uTex, vUv).rgb;
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  float f = uTh>0.001 ? smoothstep(uTh, uTh+1.0, l) : 1.0;
  o = vec4(c*f, 1.0);
}`;

const FS_BLUR = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uDir;
in vec2 vUv; out vec4 o;
void main(){
  vec3 c = texture(uTex,vUv).rgb*0.227;
  c += texture(uTex, vUv+uDir*1.385).rgb*0.316;
  c += texture(uTex, vUv-uDir*1.385).rgb*0.316;
  c += texture(uTex, vUv+uDir*3.231).rgb*0.0703;
  c += texture(uTex, vUv-uDir*3.231).rgb*0.0703;
  o = vec4(c,1.0);
}`;

const FS_COMP = `#version 300 es
precision highp float;
uniform sampler2D uScene; uniform sampler2D uB1; uniform sampler2D uB2;
uniform float uT; uniform float uFade;
in vec2 vUv; out vec4 o;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
void main(){
  vec2 cv = vUv-0.5;
  float r2 = dot(cv,cv);
  vec2 off = cv*r2*0.045;
  vec3 col;
  col.r = texture(uScene, vUv-off).r;
  col.g = texture(uScene, vUv).g;
  col.b = texture(uScene, vUv+off).b;
  col += texture(uB1,vUv).rgb*0.55 + texture(uB2,vUv).rgb*0.50;
  col += vec3(0.010,0.018,0.042)*(0.35+0.65*exp(-r2*2.5))*0.30;
  col = aces(col*1.25);
  col *= max(0.0, 1.0 - 0.45*pow(min(r2*2.2,1.4),1.4));
  float g = fract(sin(dot(gl_FragCoord.xy+vec2(uT*61.0,uT*83.0), vec2(12.9898,78.233)))*43758.5453);
  col += (g-0.5)*0.020;
  col *= uFade;
  o = vec4(pow(max(col,0.0), vec3(0.4545)), 1.0);
}`;
