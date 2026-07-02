// THE MAP OF EVERYTHING — film engine.
// Timeline (seconds):
//   0-10    one point alone in darkness
//   10-95   exponential growth radiating outward from node 0
//   92-196  continuous flight through the ten emergent structures
//   196-234 the pull-back: the whole map becomes a single galaxy
//   234-247 the universe collapses to a point
//   242-272 the point turns out to be node 0 of a larger network, which
//           replays the same growth — same geometry, new orientation
//   272-284 fade; then the film reseeds and begins again
"use strict";

(() => {
const ERR = document.getElementById('err');
const fail = m => { ERR.textContent += m + "\n"; };

const canvas = document.getElementById('c');
const qs = new URLSearchParams(location.search);
const contextOptions = {antialias:false, alpha:false, powerPreference:'high-performance'};
let contextError = '';
canvas.addEventListener('webglcontextcreationerror', event => {
  contextError = event.statusMessage || 'The browser could not create a graphics context.';
});

let gl = null;
if(!qs.has('webgl1')&&!qs.has('canvas')){
  gl = canvas.getContext('webgl2', contextOptions) || canvas.getContext('webgl2');
}
const WEBGL2 = !!gl;
if(!gl&&!qs.has('canvas')){
  gl = canvas.getContext('webgl', contextOptions) ||
       canvas.getContext('webgl') ||
       canvas.getContext('experimental-webgl');
}
if(!gl){
  if(typeof startCanvasFallback==='function' && startCanvasFallback(canvas)) return;
  fail('Graphics are unavailable. Enable hardware acceleration or open this page in a current browser.');
  if(contextError) fail(contextError);
  return;
}

const vaoExt = WEBGL2 ? null : gl.getExtension('OES_vertex_array_object');
if(!WEBGL2 && !vaoExt){
  fail('This browser does not support the vertex array extension required by the film.');
  return;
}
const createVertexArray = () => WEBGL2 ? gl.createVertexArray() : vaoExt.createVertexArrayOES();
const bindVertexArray = vao => WEBGL2 ? gl.bindVertexArray(vao) : vaoExt.bindVertexArrayOES(vao);

const HDR = WEBGL2 && !!gl.getExtension('EXT_color_buffer_float');
const MAX_PT = Math.min(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 64, 110);

// ---------- tiny math ----------
const ss = (a,b,x)=>{ x=Math.min(1,Math.max(0,(x-a)/(b-a))); return x*x*(3-2*x); };
function persp(fovy, asp, n, f){
  const t=1/Math.tan(fovy/2), m=new Float32Array(16);
  m[0]=t/asp; m[5]=t; m[10]=(f+n)/(n-f); m[11]=-1; m[14]=2*f*n/(n-f);
  return m;
}
function lookAt(e, c, up){
  let zx=e[0]-c[0], zy=e[1]-c[1], zz=e[2]-c[2];
  let l=Math.hypot(zx,zy,zz)||1; zx/=l; zy/=l; zz/=l;
  let xx=up[1]*zz-up[2]*zy, xy=up[2]*zx-up[0]*zz, xz=up[0]*zy-up[1]*zx;
  l=Math.hypot(xx,xy,xz)||1; xx/=l; xy/=l; xz/=l;
  const yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
  return new Float32Array([
    xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
    -(xx*e[0]+xy*e[1]+xz*e[2]), -(yx*e[0]+yy*e[1]+yz*e[2]), -(zx*e[0]+zy*e[1]+zz*e[2]), 1]);
}
function mul4(a,b){
  const o=new Float32Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)
    o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
  return o;
}
function rotMat3(yaw, pitch){
  const cy=Math.cos(yaw), sy=Math.sin(yaw), cp=Math.cos(pitch), sp=Math.sin(pitch);
  // Ry * Rx, column-major mat3
  return new Float32Array([cy, sy*sp, -sy*cp,  0, cp, sp,  sy, -cy*sp, cy*cp]);
}
const ID3 = new Float32Array([1,0,0, 0,1,0, 0,0,1]);

// Catmull-Rom over keyframes {t, v:[x,y,z]}
function spline(keys, t){
  const n=keys.length;
  if(t<=keys[0].t) return keys[0].v.slice();
  if(t>=keys[n-1].t) return keys[n-1].v.slice();
  let i=0; while(keys[i+1].t<t) i++;
  const p1=keys[i].v, p2=keys[i+1].v;
  const p0=keys[Math.max(i-1,0)].v, p3=keys[Math.min(i+2,n-1)].v;
  const u=(t-keys[i].t)/(keys[i+1].t-keys[i].t), u2=u*u, u3=u2*u;
  const out=[0,0,0];
  for(let k=0;k<3;k++){
    out[k]=0.5*((2*p1[k]) + (-p0[k]+p2[k])*u + (2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*u2 + (-p0[k]+3*p1[k]-3*p2[k]+p3[k])*u3);
  }
  return out;
}

// ---------- GL helpers ----------
function compatibleShader(type, src){
  if(WEBGL2) return src;
  let out = src
    .replace(/^#version 300 es\s*/m,'')
    .replace(/layout\s*\(location\s*=\s*\d+\)\s*in\b/g,'attribute');
  if(type===gl.VERTEX_SHADER){
    out = out.replace(/\bout\s+(?=(?:lowp\s+|mediump\s+|highp\s+)?(?:float|vec[234]|mat[234]))/g,'varying ');
  }else{
    out = out
      .replace(/\bin\s+(?=(?:lowp\s+|mediump\s+|highp\s+)?(?:float|vec[234]|mat[234]))/g,'varying ')
      .replace(/\bout\s+vec4\s+o\s*;/g,'')
      .replace(/\bo\s*=/g,'gl_FragColor =')
      .replace(/\btexture\s*\(/g,'texture2D(');
  }
  return out;
}
function compile(type, src){
  const s=gl.createShader(type);
  const source=compatibleShader(type,src);
  gl.shaderSource(s,source); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) fail(gl.getShaderInfoLog(s)+'\n---\n'+source.split('\n').slice(0,6).join('\n'));
  return s;
}
function program(vs, fs){
  const p=gl.createProgram();
  gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));
  gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));
  if(!WEBGL2){
    const attrs=vs.matchAll(/layout\s*\(location\s*=\s*(\d+)\)\s*in\s+\w+\s+(\w+)/g);
    for(const attr of attrs) gl.bindAttribLocation(p,+attr[1],attr[2]);
  }
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)) fail(gl.getProgramInfoLog(p));
  const u={}, n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
  for(let i=0;i<n;i++){ const inf=gl.getActiveUniform(p,i); u[inf.name]=gl.getUniformLocation(p,inf.name); }
  return {p,u};
}

const Ppt  = program(VS_POINT, FS_POINT);
const Pln  = program(VS_LINE,  FS_LINE);
const Pdot = program(VS_DOT,   FS_DOT);
const Pdn  = program(VS_QUAD,  FS_DOWN);
const Pbl  = program(VS_QUAD,  FS_BLUR);
const Pcp  = program(VS_QUAD,  FS_COMP);

// fullscreen quad
const quadVAO = createVertexArray();
bindVertexArray(quadVAO);
const qb=gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER,qb);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1, 3,-1, -1,3]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
const dotVAO = createVertexArray();

// graph buffers (rebuilt on reseed)
const pointVAO=createVertexArray(), lineVAO=createVertexArray();
const pointBuf=gl.createBuffer(), lineBuf=gl.createBuffer();
let G=null;

function uploadGraph(g){
  G=g;
  bindVertexArray(pointVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER,pointBuf);
  gl.bufferData(gl.ARRAY_BUFFER,g.pointData,gl.STATIC_DRAW);
  const PS=13*4;
  const pa=[[0,3,0],[1,3,3],[2,1,6],[3,1,7],[4,1,8],[5,1,9],[6,3,10]];
  for(const [loc,sz,of] of pa){ gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,sz,gl.FLOAT,false,PS,of*4); }
  bindVertexArray(lineVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER,lineBuf);
  gl.bufferData(gl.ARRAY_BUFFER,g.lineData,gl.STATIC_DRAW);
  const LS=14*4;
  const la=[[0,3,0],[1,3,3],[2,1,6],[3,1,7],[4,3,8],[5,1,11],[6,1,12],[7,1,13]];
  for(const [loc,sz,of] of la){ gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,sz,gl.FLOAT,false,LS,of*4); }
  bindVertexArray(null);
}

// ---------- post-processing targets ----------
let W=0,H=0,DPR=1;
let fbScene=null, fbB1a=null, fbB1b=null, fbB2a=null, fbB2b=null;
function makeFB(w,h){
  const tex=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,tex);
  if(HDR) gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,w,h,0,gl.RGBA,gl.HALF_FLOAT,null);
  else    gl.texImage2D(gl.TEXTURE_2D,0,WEBGL2?gl.RGBA8:gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const fb=gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  return {fb,tex,w,h};
}
function resize(){
  DPR=Math.min(window.devicePixelRatio||1, (window.innerWidth*window.devicePixelRatio>2300)?1.5:2)*quality;
  W=Math.max(2,Math.floor(window.innerWidth*DPR));
  H=Math.max(2,Math.floor(window.innerHeight*DPR));
  canvas.width=W; canvas.height=H;
  for(const f of [fbScene,fbB1a,fbB1b,fbB2a,fbB2b]) if(f){ gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex); }
  fbScene=makeFB(W,H);
  fbB1a=makeFB(W>>2,H>>2); fbB1b=makeFB(W>>2,H>>2);
  fbB2a=makeFB(W>>3||1,H>>3||1); fbB2b=makeFB(W>>3||1,H>>3||1);
}
let quality=1;
window.addEventListener('resize',resize);

// ---------- timeline ----------
const FOV=55*Math.PI/180;
const END=284, FADE_IN=3, FADE_OUT0=273, FADE_OUT1=281;
const COLLAPSE=234, META_T0=242, META_RATE=2.2, S1_FLOOR=1/60, META_RATIO=1800;

let camKeys=null, lookKeys=null;
function buildCamera(g){
  const tour=[];
  for(let r=1;r<g.centers.length;r++) tour.push(r);
  tour.sort((a,b)=>Math.atan2(g.centers[a][2],g.centers[a][0])-Math.atan2(g.centers[b][2],g.centers[b][0]));
  const C=r=>g.centers[r], R=r=>g.radii[r];
  const norm=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];};
  const wd=norm(C(tour[0])).map(x=>-x);
  camKeys=[
    {t:0,  v:[25,12,50]},
    {t:14, v:[30,16,62]},
    {t:32, v:[55,28,110]},
    {t:58, v:[120,60,260]},
    {t:78, v:[wd[0]*330, wd[1]*330+90, wd[2]*330]},
  ];
  lookKeys=[ {t:0,v:[0,0,0]}, {t:60,v:[0,0,0]}, {t:78,v:[0,20,0]} ];
  tour.forEach((r,i)=>{
    const t=92+i*13, c=C(r), d=norm(c);
    const px=d[2], pz=-d[0];               // horizontal perpendicular
    const alt=(i%2?-1:1)*R(r)*0.9;
    camKeys.push({t, v:[c[0]+px*R(r)*1.9, c[1]+alt, c[2]+pz*R(r)*1.9]});
    lookKeys.push({t, v:c.slice()});
  });
  const last=C(tour[tour.length-1]);
  const de=norm(last);
  lookKeys.push({t:204,v:[0,0,0]},{t:300,v:[0,0,0]});
  camKeys.push(
    {t:210, v:[de[0]*900,  de[1]*900+240, de[2]*900]},
    {t:226, v:[de[0]*2400, de[1]*2400+620, de[2]*2400]},
    {t:256, v:[de[0]*2400, de[1]*2400+620, de[2]*2400]},
    {t:278, v:[de[0]*1500, de[1]*1500+400, de[2]*1500]},
    {t:300, v:[de[0]*1440, de[1]*1440+385, de[2]*1440]});
}

// ---------- state ----------
let seed=(new URLSearchParams(location.search).get('seed')|0)||((Math.random()*1e9)|0);
const N_TOTAL=(new URLSearchParams(location.search).get('n')|0)||120000;
let t=0, playing=false, started=false, lastNow=0, emaDt=16, slowFrames=0;

function regen(){
  console.log('THE MAP OF EVERYTHING · seed', seed);
  uploadGraph(generateGraph(seed, N_TOTAL));
  buildCamera(G);
}

// ---------- layer drawing ----------
function drawLayer(vp, rot, scale, localT, motionT, alpha, maxPt){
  if(alpha<=0.002 || localT<=0) return;
  for(const [P,vao,mode,count] of [[Ppt,pointVAO,gl.POINTS,G.N],[Pln,lineVAO,gl.LINES,G.E*2]]){
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.u.uVP,false,vp);
    gl.uniformMatrix3fv(P.u.uRot,false,rot);
    gl.uniform1f(P.u.uScale,scale);
    gl.uniform1f(P.u.uLocalT,localT);
    gl.uniform1f(P.u.uMotionT,motionT);
    gl.uniform1f(P.u.uPointScale,H*0.5/Math.tan(FOV/2));
    gl.uniform1f(P.u.uAlpha,alpha);
    if(P.u.uMaxPt) gl.uniform1f(P.u.uMaxPt,maxPt);
    bindVertexArray(vao);
    gl.drawArrays(mode,0,count);
  }
}
function post(prog, src, dst, setup){
  gl.bindFramebuffer(gl.FRAMEBUFFER, dst?dst.fb:null);
  gl.viewport(0,0,dst?dst.w:W,dst?dst.h:H);
  gl.useProgram(prog.p);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D,src.tex);
  gl.uniform1i(prog.u.uTex!==undefined?prog.u.uTex:prog.u.uScene,0);
  if(setup) setup(prog);
  bindVertexArray(quadVAO);
  gl.drawArrays(gl.TRIANGLES,0,3);
}

// ---------- frame ----------
function frame(now){
  requestAnimationFrame(frame);
  if(!started) return;
  const dt=Math.min(0.05,(now-lastNow)/1000); lastNow=now;
  if(playing) t+=dt;
  if(t>END){ seed=(Math.random()*1e9)|0; regen(); t=0; }

  // adaptive quality
  emaDt=emaDt*0.95+dt*1000*0.05;
  if(emaDt>34 && quality>0.55){ if(++slowFrames>150){ quality*=0.75; slowFrames=0; resize(); } }

  // collapse & nesting scales
  let s1=1;
  if(t>COLLAPSE){ const u=t-COLLAPSE, e=u*u/(u+2); s1=Math.max(Math.exp(-0.36*e), S1_FLOOR); }
  const sM=s1*META_RATIO;
  const metaT=Math.max(0,(t-META_T0)*META_RATE);
  const aMain=ss(0.020,0.045,s1);
  const dotI=(1-ss(0.022,0.05,s1))*(1-ss(6,14,metaT));

  // camera
  const eye=spline(camKeys,t), look=spline(lookKeys,t);
  const roll=0.05*Math.sin(t*0.037+2.0);
  const view=lookAt(eye,look,[Math.sin(roll),Math.cos(roll),0]);
  const proj=persp(FOV,W/H,0.5,80000);
  const vp=mul4(proj,view);

  // scene (HDR, additive)
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbScene.fb);
  gl.viewport(0,0,W,H);
  gl.clearColor(0,0,0,1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE,gl.ONE);

  drawLayer(vp, ID3, s1, t, t, aMain, MAX_PT);
  if(t>META_T0-2) drawLayer(vp, rotMat3(1.91+t*0.012, 0.62), sM, metaT, t+555.5, 1.0, Math.min(MAX_PT,12));

  if(dotI>0.003){
    gl.useProgram(Pdot.p);
    gl.uniformMatrix4fv(Pdot.u.uVP,false,vp);
    gl.uniform1f(Pdot.u.uPointScale,H*0.5/Math.tan(FOV/2));
    gl.uniform1f(Pdot.u.uSizeW,Math.max(550*s1,40));
    gl.uniform1f(Pdot.u.uMaxPt,18);
    gl.uniform1f(Pdot.u.uInt,dotI*(0.8+0.25*Math.sin(t*2.1)));
    bindVertexArray(dotVAO);
    gl.drawArrays(gl.POINTS,0,1);
  }
  gl.disable(gl.BLEND);

  // bloom chain
  const th=HDR?0.60:0.30;
  post(Pdn,fbScene,fbB1a,p=>gl.uniform1f(p.u.uTh,th));
  post(Pbl,fbB1a,fbB1b,p=>gl.uniform2f(p.u.uDir,1/fbB1a.w,0));
  post(Pbl,fbB1b,fbB1a,p=>gl.uniform2f(p.u.uDir,0,1/fbB1a.h));
  post(Pdn,fbB1a,fbB2a,p=>gl.uniform1f(p.u.uTh,0));
  post(Pbl,fbB2a,fbB2b,p=>gl.uniform2f(p.u.uDir,2/fbB2a.w,0));
  post(Pbl,fbB2b,fbB2a,p=>gl.uniform2f(p.u.uDir,0,2/fbB2a.h));

  // composite
  const fade=ss(0,FADE_IN,t)*(1-ss(FADE_OUT0,FADE_OUT1,t));
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.viewport(0,0,W,H);
  gl.useProgram(Pcp.p);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,fbScene.tex); gl.uniform1i(Pcp.u.uScene,0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,fbB1a.tex);  gl.uniform1i(Pcp.u.uB1,1);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D,fbB2a.tex);  gl.uniform1i(Pcp.u.uB2,2);
  gl.uniform1f(Pcp.u.uT,t%97);
  gl.uniform1f(Pcp.u.uFade,fade);
  bindVertexArray(quadVAO);
  gl.drawArrays(gl.TRIANGLES,0,3);

  Score.update(t,fade);
}

// ---------- input ----------
const ui=document.getElementById('ui');
function begin(){
  if(started) return;
  Score.init();
  ui.classList.add('gone');
  started=true; playing=true; lastNow=performance.now();
}
document.getElementById('begin').addEventListener('click',begin);
ui.addEventListener('click',begin);

window.addEventListener('keydown',e=>{
  if(!started) return;
  if(e.code==='Space'){ e.preventDefault(); playing=!playing; playing?Score.resume():Score.pause(); }
  else if(e.code==='ArrowRight') t=Math.min(END-0.1,t+10);
  else if(e.code==='ArrowLeft')  t=Math.max(0,t-10);
  else if(e.key==='r'||e.key==='R'){ seed=(Math.random()*1e9)|0; regen(); t=0; }
  else if(e.key==='f'||e.key==='F'){ document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen(); }
  else if(e.key==='m'||e.key==='M') Score.toggleMute();
});
document.addEventListener('visibilitychange',()=>{
  if(!started) return;
  if(document.hidden){ playing=false; Score.pause(); }
  else { playing=true; Score.resume(); lastNow=performance.now(); }
});

// ---------- go ----------
resize();
regen();
requestAnimationFrame(frame);

// headless/test hook: ?auto=120 starts the film at t=120s without a click;
// add &hold to freeze the clock exactly there
const autoQ=qs.get('auto');
if(autoQ!==null){ begin(); t=Math.max(0,+autoQ||0); if(qs.get('hold')!==null) playing=false; }
})();
