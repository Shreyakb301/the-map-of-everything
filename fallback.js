// Canvas 2D fallback for browsers where GPU-backed WebGL is unavailable.
"use strict";

function startCanvasFallback(canvas){
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx) return false;

  const qs=new URLSearchParams(location.search);
  const ui=document.getElementById('ui');
  const N=Math.max(700,Math.min(4200,Math.floor((+qs.get('n')||60000)/22)));
  let W=0,H=0,DPR=1,started=false,playing=false,needsDraw=true,lastNow=0,t=0;
  let seed=(+qs.get('seed')||((Math.random()*1e9)|0))>>>0;
  let points,parent,birth,size,color,screenX,screenY,visible;

  function random(){
    seed|=0; seed=seed+0x6D2B79F5|0;
    let x=Math.imul(seed^seed>>>15,1|seed);
    x=x+Math.imul(x^x>>>7,61|x)^x;
    return ((x^x>>>14)>>>0)/4294967296;
  }

  function build(){
    points=new Float32Array(N*3);
    parent=new Uint32Array(N);
    birth=new Float32Array(N);
    size=new Float32Array(N);
    color=new Uint8Array(N*3);
    screenX=new Float32Array(N);
    screenY=new Float32Array(N);
    visible=new Uint8Array(N);

    for(let i=1;i<N;i++){
      const recent=Math.max(0,i-20-Math.floor(random()*Math.min(i,260)));
      const hub=Math.floor(Math.pow(random(),2.8)*i);
      const p=random()<0.74?recent:hub;
      parent[i]=p;

      const arm=Math.floor(random()*9);
      const angle=arm*0.698+random()*0.55;
      const lift=(random()-0.5)*1.25;
      const step=0.7+random()*2.2;
      const bend=Math.sin(i*0.013+arm)*0.65;
      const pi=p*3,ii=i*3;
      points[ii]=points[pi]+Math.cos(angle+bend)*step;
      points[ii+1]=points[pi+1]+lift*step;
      points[ii+2]=points[pi+2]+Math.sin(angle+bend)*step;
      birth[i]=5+80*Math.pow(i/(N-1),0.62);
      size[i]=0.45+Math.pow(random(),5)*2.8;
      color[ii]=150+Math.floor(random()*80);
      color[ii+1]=190+Math.floor(random()*55);
      color[ii+2]=225+Math.floor(random()*30);
    }
    size[0]=4;
    color[0]=color[1]=color[2]=255;
  }

  function resize(){
    DPR=Math.min(devicePixelRatio||1,1.5);
    W=Math.max(1,innerWidth); H=Math.max(1,innerHeight);
    canvas.width=Math.floor(W*DPR); canvas.height=Math.floor(H*DPR);
    canvas.style.width=W+'px'; canvas.style.height=H+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }

  function project(count){
    const ay=t*0.035,ax=0.28+Math.sin(t*0.021)*0.18;
    const cy=Math.cos(ay),sy=Math.sin(ay),cx=Math.cos(ax),sx=Math.sin(ax);
    const collapse=t>225?Math.max(0.035,1-(t-225)/24):1;
    const zoom=(Math.min(W,H)*0.035)*collapse;
    const distance=130;

    for(let i=0;i<count;i++){
      const ii=i*3;
      const x=points[ii],y=points[ii+1],z=points[ii+2];
      const rx=x*cy-z*sy,rz=x*sy+z*cy;
      const ry=y*cx-rz*sx,depth=y*sx+rz*cx;
      const perspective=distance/Math.max(35,distance+depth);
      screenX[i]=W*0.5+rx*zoom*perspective;
      screenY[i]=H*0.5+ry*zoom*perspective;
      visible[i]=screenX[i]>-20&&screenX[i]<W+20&&screenY[i]>-20&&screenY[i]<H+20;
    }
  }

  function draw(){
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.fillStyle='#000207';
    ctx.fillRect(0,0,W,H);

    const growth=t<225?Math.min(1,t/88):Math.max(0,(272-t)/25);
    const count=Math.max(1,Math.min(N,Math.floor(N*growth*growth*(3-2*growth))));
    project(count);

    ctx.globalCompositeOperation='lighter';
    ctx.lineWidth=0.55;
    ctx.strokeStyle='rgba(115,174,230,0.13)';
    ctx.beginPath();
    for(let i=1;i<count;i++){
      const p=parent[i];
      if(!visible[i]&&!visible[p]) continue;
      ctx.moveTo(screenX[p],screenY[p]);
      ctx.lineTo(screenX[i],screenY[i]);
    }
    ctx.stroke();

    for(let i=0;i<count;i+=2){
      if(!visible[i]) continue;
      const ii=i*3;
      const pulse=0.75+0.25*Math.sin(t*1.7+i*0.31);
      const radius=Math.max(0.55,size[i]*pulse);
      ctx.fillStyle=`rgba(${color[ii]},${color[ii+1]},${color[ii+2]},0.72)`;
      ctx.beginPath();
      ctx.arc(screenX[i],screenY[i],radius,0,Math.PI*2);
      ctx.fill();
    }

    ctx.globalAlpha=0.18;
    ctx.filter='blur(8px)';
    ctx.fillStyle='#7dbdff';
    for(let i=0;i<count;i+=90){
      if(!visible[i]) continue;
      ctx.beginPath();
      ctx.arc(screenX[i],screenY[i],5+size[i]*2,0,Math.PI*2);
      ctx.fill();
    }
    ctx.filter='none';
    ctx.globalAlpha=1;
    ctx.globalCompositeOperation='source-over';
  }

  function frame(now){
    requestAnimationFrame(frame);
    if(!started) return;
    if(!playing&&!needsDraw) return;
    const dt=Math.min(0.05,(now-lastNow)/1000); lastNow=now;
    if(playing) t+=dt;
    if(t>284){ seed=(Math.random()*1e9)|0; build(); t=0; }
    draw();
    needsDraw=false;
    if(typeof Score!=='undefined') Score.update(t,1);
  }

  function begin(){
    if(started) return;
    if(typeof Score!=='undefined') Score.init();
    ui.classList.add('gone');
    started=true; playing=true; lastNow=performance.now();
    draw();
  }

  document.getElementById('begin').addEventListener('click',begin);
  ui.addEventListener('click',begin);
  addEventListener('resize',resize);
  addEventListener('keydown',event=>{
    if(!started) return;
    if(event.code==='Space'){
      event.preventDefault(); playing=!playing;
      needsDraw=true; lastNow=performance.now();
      if(typeof Score!=='undefined') playing?Score.resume():Score.pause();
    }else if(event.code==='ArrowRight'){ t=Math.min(283.9,t+10); needsDraw=true; }
    else if(event.code==='ArrowLeft'){ t=Math.max(0,t-10); needsDraw=true; }
    else if(event.key==='r'||event.key==='R'){ seed=(Math.random()*1e9)|0; build(); t=0; needsDraw=true; }
    else if(event.key==='f'||event.key==='F'){
      document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
    }else if(event.key==='m'||event.key==='M'){
      if(typeof Score!=='undefined') Score.toggleMute();
    }
  });

  resize();
  build();
  requestAnimationFrame(frame);

  const autoQ=qs.get('auto');
  if(autoQ!==null){
    begin(); t=Math.max(0,+autoQ||0);
    if(qs.has('hold')) playing=false;
    needsDraw=true;
  }
  return true;
}
