// Graph generation for THE MAP OF EVERYTHING.
// Every structure (neural, vascular, urban, social, cosmic...) is grown by the
// SAME algorithm with different parameters: a tree extended by preferential /
// recency attachment, plus local cross-links and long-range chords.
"use strict";

function mulberry32(a){
  return function(){
    a|=0; a = a+0x6D2B79F5|0;
    let t = Math.imul(a^a>>>15, 1|a);
    t = t+Math.imul(t^t>>>7, 61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}

const ARCH = [
  {n:'neural',   col:[0.42,0.80,1.00], R:115, inertia:.55, tip:3.5, hub:.05, planar:0,  down:0,  snap:0,  step:1.6, extra:.45, chord:.02},
  {n:'vascular', col:[1.00,0.55,0.42], R:105, inertia:.85, tip:5,   hub:0,   planar:.15,down:0,  snap:0,  step:1.5, extra:.15, chord:0},
  {n:'city',     col:[1.00,0.84,0.50], R:100, inertia:.30, tip:1.6, hub:.15, planar:.75,down:0,  snap:.85,step:1.9, extra:.70, chord:0},
  {n:'social',   col:[0.72,0.55,1.00], R:110, inertia:0,   tip:1,   hub:.75, planar:0,  down:0,  snap:0,  step:2.6, extra:.60, chord:.12},
  {n:'galaxy',   col:[0.60,0.72,1.00], R:150, inertia:.92, tip:6,   hub:0,   planar:.35,down:0,  snap:0,  step:2.1, extra:.20, chord:.03},
  {n:'roots',    col:[0.80,0.62,0.38], R:100, inertia:.70, tip:4,   hub:0,   planar:.10,down:.5, snap:0,  step:1.5, extra:.15, chord:0},
  {n:'internet', col:[0.45,1.00,0.85], R:105, inertia:.20, tip:1.2, hub:.55, planar:.30,down:0,  snap:.4, step:2.2, extra:.65, chord:.08},
  {n:'river',    col:[0.50,0.85,1.00], R:120, inertia:.80, tip:4,   hub:0,   planar:.85,down:0,  snap:0,  step:1.7, extra:.10, chord:0},
  {n:'knowledge',col:[0.88,0.93,1.00], R:100, inertia:.10, tip:1,   hub:.35, planar:0,  down:0,  snap:0,  step:2.4, extra:.80, chord:.12},
  {n:'supply',   col:[1.00,0.70,0.42], R:105, inertia:.45, tip:1.3, hub:.60, planar:.70,down:0,  snap:.2, step:2.3, extra:.50, chord:.05},
];

const GROW_T0 = 10, GROW_T1 = 95;   // exponential growth window (seconds)

function generateGraph(seed, N){
  const rng = mulberry32(seed);
  const NR = ARCH.length;
  const per = Math.floor(N/NR);
  N = per*NR;

  const px=new Float32Array(N), py=new Float32Array(N), pz=new Float32Array(N);
  const dx=new Float32Array(N), dy=new Float32Array(N), dz=new Float32Array(N);
  const parent=new Int32Array(N).fill(-1);
  const depth=new Int32Array(N);
  const lc=new Int32Array(N);          // local-cluster anchor node
  const regionOf=new Uint8Array(N);

  const maxE = Math.ceil(N*2.6);
  const ea=new Int32Array(maxE), eb=new Int32Array(maxE);
  let ec=0;
  const addEdge=(a,b)=>{ if(ec<maxE){ ea[ec]=a; eb[ec]=b; ec++; } };

  // region centers: region 0 (and node 0) at the exact origin
  const centers=[[0,0,0]];
  for(let r=1;r<NR;r++){
    let vx,vy,vz,l;
    do{ vx=rng()*2-1; vy=(rng()*2-1)*0.55; vz=rng()*2-1; l=Math.hypot(vx,vy,vz); }while(l<0.2||l>1);
    const rad = 300+rng()*160;
    centers.push([vx/l*rad, vy/l*rad, vz/l*rad]);
  }

  const regStart=new Int32Array(NR);
  let cursor=0;

  for(let r=0;r<NR;r++){
    const P=ARCH[r], start=cursor, count=per;
    regStart[r]=start;
    // root
    px[start]=0; py[start]=0; pz[start]=0;
    { let a=rng()*6.283, b=rng()*3.14;
      dx[start]=Math.cos(a)*Math.sin(b); dy[start]=Math.cos(b); dz[start]=Math.sin(a)*Math.sin(b); }
    depth[start]=0; lc[start]=start; parent[start]=-1; regionOf[start]=r;

    const ends=[start,start];
    for(let k=1;k<count;k++){
      const gi=start+k;
      let p;
      if(rng()<P.hub) p = ends[(rng()*ends.length)|0];
      else {
        const u=rng();
        p = start + Math.min(k-1, Math.floor(k*(1-Math.pow(u,P.tip))));
      }
      let ndx = dx[p]*P.inertia + (rng()*2-1)*(1-P.inertia);
      let ndy = dy[p]*P.inertia + (rng()*2-1)*(1-P.inertia);
      let ndz = dz[p]*P.inertia + (rng()*2-1)*(1-P.inertia);
      ndy *= (1-P.planar*0.8);
      ndy -= P.down*0.5;
      if(P.snap>0 && rng()<P.snap){
        const ax=Math.abs(ndx), ay=Math.abs(ndy), az=Math.abs(ndz);
        if(ax>=ay&&ax>=az){ ndy=0; ndz=0; ndx=ndx<0?-1:1; }
        else if(ay>=az){ ndx=0; ndz=0; ndy=ndy<0?-1:1; }
        else { ndx=0; ndy=0; ndz=ndz<0?-1:1; }
      }
      let l=Math.hypot(ndx,ndy,ndz);
      if(l<1e-5){ ndx=1; ndy=0; ndz=0; l=1; }
      ndx/=l; ndy/=l; ndz/=l;
      const st=P.step*(0.7+0.6*rng());
      px[gi]=px[p]+ndx*st; py[gi]=py[p]+ndy*st; pz[gi]=pz[p]+ndz*st;
      dx[gi]=ndx; dy[gi]=ndy; dz[gi]=ndz;
      depth[gi]=depth[p]+1;
      parent[gi]=p;
      lc[gi]=(depth[gi]%6===0)? gi : lc[p];
      regionOf[gi]=r;
      addEdge(p,gi);
      ends.push(p,gi);
    }

    // normalize region to its target radius, squash if planar, move to center
    let cx=0,cy=0,cz=0;
    for(let i=start;i<start+count;i++){ cx+=px[i]; cy+=py[i]; cz+=pz[i]; }
    cx/=count; cy/=count; cz/=count;
    let ms=0;
    for(let i=start;i<start+count;i++){
      const a=px[i]-cx, b=py[i]-cy, c=pz[i]-cz; ms+=a*a+b*b+c*c;
    }
    const rms=Math.sqrt(ms/count)||1;
    const sc=P.R/(rms*1.7), sq=1-P.planar*0.6;
    const C=centers[r];
    for(let i=start;i<start+count;i++){
      px[i]=(px[i]-cx)*sc+C[0];
      py[i]=(py[i]-cy)*sc*sq+C[1];
      pz[i]=(pz[i]-cz)*sc+C[2];
    }
    if(r===0){
      // node 0 must sit exactly at the origin: it is the film's first point
      // and the point the whole universe later collapses back into.
      const ox=px[start], oy=py[start], oz=pz[start];
      for(let i=start;i<start+count;i++){ px[i]-=ox; py[i]-=oy; pz[i]-=oz; }
    }

    // local cross-links via spatial hash (small-world texture)
    const cs=P.R/16;
    const hash=new Map();
    const keyOf=(x,y,z)=>{
      const ix=(Math.floor(x/cs)+512)&1023, iy=(Math.floor(y/cs)+512)&1023, iz=(Math.floor(z/cs)+512)&1023;
      return ix|(iy<<10)|(iz<<20);
    };
    for(let i=start;i<start+count;i++){
      const k=keyOf(px[i],py[i],pz[i]);
      let arr=hash.get(k); if(!arr){ arr=[]; hash.set(k,arr); }
      arr.push(i);
    }
    const attempts=Math.floor(count*P.extra);
    const lim=cs*1.6, lim2=lim*lim;
    for(let t=0;t<attempts;t++){
      const a=start+((rng()*count)|0);
      if(P.chord>0 && rng()<P.chord){
        const b=start+((rng()*count)|0);
        if(b!==a) addEdge(a,b);
        continue;
      }
      const bx=Math.floor(px[a]/cs), by=Math.floor(py[a]/cs), bz=Math.floor(pz[a]/cs);
      let pick=-1, seen=0;
      for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++)for(let oz=-1;oz<=1;oz++){
        const arr=hash.get((((bx+ox+512)&1023))|(((by+oy+512)&1023)<<10)|(((bz+oz+512)&1023)<<20));
        if(!arr) continue;
        for(let j=0;j<arr.length;j++){
          const b=arr[j];
          if(b===a||b===parent[a]||parent[b]===a) continue;
          const qx=px[b]-px[a], qy=py[b]-py[a], qz=pz[b]-pz[a];
          if(qx*qx+qy*qy+qz*qz>lim2) continue;
          seen++;
          if(rng()<1/seen) pick=b;
        }
      }
      if(pick>=0) addEdge(a,pick);
    }
    cursor+=count;
  }

  // inter-region bridges: each region ties into the already-grown web
  for(let r=1;r<NR;r++){
    for(let rep=0;rep<3;rep++){
      const tgt = rep===0 ? nearestRegion(centers,r) : 0|(rng()*r);
      let best=-1, bestB=-1, bd=1e18;
      for(let s=0;s<220;s++){
        const a=regStart[r]+((rng()*per)|0);
        const b=regStart[tgt]+((rng()*per)|0);
        const qx=px[a]-px[b], qy=py[a]-py[b], qz=pz[a]-pz[b];
        const d=qx*qx+qy*qy+qz*qz;
        if(d<bd){ bd=d; best=a; bestB=b; }
      }
      if(best>=0) addEdge(best,bestB);
    }
  }
  // long filament chords across the whole map
  for(let t=0;t<30;t++){
    const a=(rng()*N)|0, b=(rng()*N)|0;
    if(a!==b && regionOf[a]!==regionOf[b]) addEdge(a,b);
  }

  // degrees
  const deg=new Uint16Array(N);
  for(let e=0;e<ec;e++){ deg[ea[e]]++; deg[eb[e]]++; }

  // BFS from node 0 -> birth order radiates outward through the connections
  const off=new Uint32Array(N+1);
  for(let e=0;e<ec;e++){ off[ea[e]+1]++; off[eb[e]+1]++; }
  for(let i=0;i<N;i++) off[i+1]+=off[i];
  const adj=new Int32Array(ec*2);
  { const fill=Uint32Array.from(off.subarray(0,N));
    for(let e=0;e<ec;e++){ adj[fill[ea[e]]++]=eb[e]; adj[fill[eb[e]]++]=ea[e]; } }
  const rank=new Int32Array(N).fill(-1);
  const queue=new Int32Array(N);
  let qh=0, qt=0, visit=0;
  queue[qt++]=0; rank[0]=visit++;
  while(qh<qt){
    const v=queue[qh++];
    for(let j=off[v];j<off[v+1];j++){
      const w=adj[j];
      if(rank[w]<0){ rank[w]=visit++; queue[qt++]=w; }
    }
  }
  for(let i=0;i<N;i++) if(rank[i]<0) rank[i]=visit++;

  // births: count(t) grows exponentially  ->  birth(rank) ~ log(rank)
  const births=new Float32Array(N);
  const LD=Math.log(1+N);
  for(let i=0;i<N;i++){
    const r=rank[i];
    births[i] = r===0 ? 1.5 : GROW_T0 + (GROW_T1-GROW_T0)*Math.log(1+r)/LD + rng()*0.25;
  }

  // per-node size / color
  const size=new Float32Array(N), colR=new Float32Array(N), colG=new Float32Array(N), colB=new Float32Array(N);
  for(let i=0;i<N;i++){
    const P=ARCH[regionOf[i]];
    let s=0.5+0.55*Math.pow(rng(),1.5);
    if(deg[i]>4) s+=Math.min(1.6, 0.25*Math.sqrt(deg[i]-4));
    if(i===regStart[regionOf[i]]) s=Math.max(s,2.0);
    if(i===0) s=0.9;
    size[i]=s;
    const hubW=Math.min(0.6, Math.max(0,deg[i]-3)*0.05);
    const mixW=0.25+hubW;
    const jit=0.85+0.30*rng();
    const inten=(0.75+0.7*rng()*rng())*jit;
    colR[i]=(P.col[0]*(1-mixW)+0.85*mixW)*inten;
    colG[i]=(P.col[1]*(1-mixW)+0.92*mixW)*inten;
    colB[i]=(P.col[2]*(1-mixW)+1.00*mixW)*inten;
  }

  // ---- interleave GPU buffers ----
  // points: x y z cx cy cz seed cph birth size r g b   (13)
  const PD=new Float32Array(N*13);
  for(let i=0;i<N;i++){
    const o=i*13, L=lc[i];
    PD[o  ]=px[i]; PD[o+1]=py[i]; PD[o+2]=pz[i];
    PD[o+3]=px[L]; PD[o+4]=py[L]; PD[o+5]=pz[L];
    PD[o+6]=rng();
    PD[o+7]=(L*0.61803398875 + regionOf[i]*0.137)%1;
    PD[o+8]=births[i];
    PD[o+9]=size[i];
    PD[o+10]=colR[i]; PD[o+11]=colG[i]; PD[o+12]=colB[i];
  }
  // lines, 2 verts/edge: x y z cx cy cz seed cph r g b t ph eb   (14)
  const LDAT=new Float32Array(ec*2*14);
  for(let e=0;e<ec;e++){
    const A=ea[e], B=eb[e];
    const mx=Math.max(rank[A],rank[B]);
    const ebirth=Math.max(births[A],births[B]) + 0.4 + rng()*0.9 + 2.6*Math.exp(-mx/3);
    const ph=rng();
    let o=e*28;
    for(let v=0;v<2;v++){
      const i=v===0?A:B, L=lc[i];
      LDAT[o  ]=px[i]; LDAT[o+1]=py[i]; LDAT[o+2]=pz[i];
      LDAT[o+3]=px[L]; LDAT[o+4]=py[L]; LDAT[o+5]=pz[L];
      LDAT[o+6]=(i*0.7548776662)%1;
      LDAT[o+7]=(L*0.61803398875 + regionOf[i]*0.137)%1;
      LDAT[o+8]=colR[i]*0.55; LDAT[o+9]=colG[i]*0.55; LDAT[o+10]=colB[i]*0.55;
      LDAT[o+11]=v;
      LDAT[o+12]=ph;
      LDAT[o+13]=ebirth;
      o+=14;
    }
  }

  return { N, E:ec, pointData:PD, lineData:LDAT, centers,
           radii:ARCH.map(a=>a.R), names:ARCH.map(a=>a.n) };
}

function nearestRegion(centers, r){
  let best=0, bd=1e18;
  for(let i=0;i<r;i++){
    const d=(centers[i][0]-centers[r][0])**2+(centers[i][1]-centers[r][1])**2+(centers[i][2]-centers[r][2])**2;
    if(d<bd){ bd=d; best=i; }
  }
  return best;
}
