// Generative ambient score: a slowly-opening drone that tracks the film clock.
"use strict";

const Score = (() => {
  let ctx=null, master=null, filter=null, sub=null, shimmer=null;
  let muted=false, lastUpdate=-1;

  function init(){
    if(ctx) return;
    try{
      ctx = new (window.AudioContext||window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value=-18; comp.ratio.value=6;
      comp.connect(ctx.destination);
      master = ctx.createGain(); master.gain.value=0;
      master.connect(comp);

      // shared space: two lowpassed feedback delays
      const bus = ctx.createGain(); bus.gain.value=1;
      bus.connect(master);
      for(const [dt,fb] of [[0.347,0.42],[0.523,0.36]]){
        const d=ctx.createDelay(1.0); d.delayTime.value=dt;
        const g=ctx.createGain(); g.gain.value=fb;
        const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=2100;
        bus.connect(d); d.connect(lp); lp.connect(g); g.connect(d);
        const wet=ctx.createGain(); wet.gain.value=0.5;
        d.connect(wet); wet.connect(master);
      }

      filter = ctx.createBiquadFilter();
      filter.type='lowpass'; filter.frequency.value=220; filter.Q.value=0.6;
      filter.connect(bus);

      // Asus2 drone bank with independent breathing LFOs
      const tones=[[55,.15,'sine'],[82.41,.10,'triangle'],[110,.12,'sine'],
                   [123.47,.07,'sine'],[164.81,.08,'triangle'],[329.63,.025,'sine']];
      tones.forEach(([f,g0,type],i)=>{
        const osc=ctx.createOscillator(); osc.type=type; osc.frequency.value=f;
        osc.detune.value=(i%2?1:-1)*(2+i*1.3);
        const g=ctx.createGain(); g.gain.value=g0*0.7;
        const lfo=ctx.createOscillator(); lfo.frequency.value=0.021+i*0.013;
        const lg=ctx.createGain(); lg.gain.value=g0*0.45;
        lfo.connect(lg); lg.connect(g.gain);
        osc.connect(g); g.connect(filter);
        osc.start(); lfo.start();
      });

      // deep sub for the final collapse
      const so=ctx.createOscillator(); so.type='sine'; so.frequency.value=27.5;
      sub=ctx.createGain(); sub.gain.value=0;
      so.connect(sub); sub.connect(master); so.start();

      // airy shimmer: filtered noise
      const len=ctx.sampleRate*2;
      const buf=ctx.createBuffer(1,len,ctx.sampleRate);
      const ch=buf.getChannelData(0);
      for(let i=0;i<len;i++) ch[i]=Math.random()*2-1;
      const ns=ctx.createBufferSource(); ns.buffer=buf; ns.loop=true;
      const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=2400; bp.Q.value=7;
      shimmer=ctx.createGain(); shimmer.gain.value=0.0;
      ns.connect(bp); bp.connect(shimmer); shimmer.connect(master); ns.start();

      master.gain.setTargetAtTime(0.5, ctx.currentTime, 2.5);
    }catch(e){ ctx=null; }
  }

  function update(t, fade){
    if(!ctx || muted) return;
    if(t-lastUpdate<0.25 && t>lastUpdate) return;
    lastUpdate=t;
    const now=ctx.currentTime;
    const ss=(a,b,x)=>{x=Math.min(1,Math.max(0,(x-a)/(b-a)));return x*x*(3-2*x);};
    let cut = 220 + 1500*ss(8,95,t) + 600*ss(95,230,t);
    if(t>234) cut = Math.max(260, cut*Math.pow(0.5,(t-234)/8));
    filter.frequency.setTargetAtTime(cut, now, 0.4);
    sub.gain.setTargetAtTime(0.16*ss(232,244,t)*(1-ss(268,278,t)), now, 0.8);
    shimmer.gain.setTargetAtTime((0.004+0.005*ss(60,200,t))*(1-ss(238,252,t)), now, 0.6);
    master.gain.setTargetAtTime(0.5*Math.max(0,Math.min(1,fade)), now, 0.5);
  }

  return {
    init,
    update,
    pause(){ if(ctx) ctx.suspend(); },
    resume(){ if(ctx) ctx.resume(); },
    toggleMute(){
      if(!ctx) return;
      muted=!muted;
      master.gain.setTargetAtTime(muted?0:0.5, ctx.currentTime, 0.2);
    }
  };
})();
