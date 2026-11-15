// SPDX-License-Identifier: Apache-2.0
import {createSound2D} from '../vendor/vanillajs/modules/audio2d/index.js';
import {createSoundtrack} from '../vendor/vanillajs/modules/soundtrack/index.js';
import {createSoundtrackPlayer} from '../vendor/vanillajs/api/audio/index.js';
const STATIONS=['gunship','artillery','infantry'];
export function makeScore(station='gunship'){
  if(!STATIONS.includes(station))throw new TypeError('Unknown soundtrack station');
  const roots=station==='gunship'?[65,65,78,58,65,87,78,58]:station==='artillery'?[55,55,65,49,55,73,65,49]:[82,82,98,73,82,110,98,73];
  return createSoundtrack({tickRate:60,phrases:roots.map((root,phrase)=>{
    const events=[];let id=1;
    const note=(channel,sample,duration,frequency,gain,wave,seed=0)=>events.push({id:id++,channel,sample,duration,frequency,gain,wave,seed});
    for(let beat=0;beat<8;beat++){
      note(0,beat*24000,station==='infantry'?14000:21000,beat%4===3?root*2:root,station==='gunship'?1500:2100,station==='infantry'?'saw':'triangle');
      note(1,beat*24000,beat%2?6500:11000,beat%2?170:station==='artillery'?38:46,beat%2?1300:3100,beat%2?'noise':'triangle',phrase*99+beat);
      for(let off=0;off<2;off++)note(2,beat*24000+off*12000,station==='artillery'?3300:1600,3000,off?240:420,'noise',beat+off+17);
      if(station==='infantry'){
        for(let off=0;off<2;off++)note(3,beat*24000+off*12000,9000,Math.round(root*[4,6,5,3][(beat+off+phrase)%4]),430,'triangle');
      }else if(beat%2===0)note(3,beat*24000+6000,station==='gunship'?37000:19000,Math.round(root*[4,6,5,3][beat/2]),phrase>1?650:380,'triangle');
    }
    return {frames:192000,events};
  })});
}
export function makeEffect(type,variant=0){
  const specs={gatling:[.18,82,6800],m2:[.23,70,7600],bofors:[.46,49,9000],howitzer:[.82,35,10000],battery:[.95,32,10500],
    impact:[.85,43,7700],breach:[.3,95,4500],clear:[.65,523,4000],reload:[.26,950,2300],hot:[.25,330,2400],lost:[.9,65,4000]};
  const [duration,freq,gain]=specs[type]||specs.impact,frames=Math.round(duration*48000),tone=['clear','hot','lost'].includes(type),v=(variant>>>0)%4;
  const events=[];let id=1;
  const add=(channel,sample,length,frequency,volume,wave)=>events.push({id:id++,channel,sample,duration:Math.max(1,Math.min(length,frames-sample)),frequency:Math.round(frequency),gain:Math.round(volume),wave,seed:13013+v*977+id*79});
  if(tone){add(0,0,frames,freq,gain,'triangle');add(1,Math.floor(frames*.25),Math.floor(frames*.7),freq*(type==='clear'?1.5:.75),gain*.45,'triangle');}
  else{
    // Crack, falling body, debris tail and reflected report occupy separate lanes.
    add(0,0,Math.floor(frames*.28),freq+v*3,gain,'noise');
    const low=Math.max(30,freq+v*2);add(1,0,Math.floor(frames*.17),low*1.8,gain*.65,'triangle');
    add(1,Math.floor(frames*.17),Math.floor(frames*.65),low,gain*.45,'triangle');
    add(2,Math.floor(frames*.16),Math.floor(frames*.8),1800+v*130,gain*.2,'noise');
    add(3,Math.floor(frames*.37),Math.floor(frames*.42),low,gain*.16,'noise');
    if(type==='reload'){events.length=0;add(0,0,2800,1600+v*80,2500,'noise');add(0,6000,4000,850,3500,'noise');add(1,6100,1900,410,1100,'square');}
  }
  return createSound2D({frames,events});
}
export function createAudio(onFailure=()=>{}){
  let ctx=null,master=null,musicBus=null,active=null,failed=false,unlocking=null,anchor=null;
  const cache=new Map(),players=new Map(),voices=new Set();
  function release(v){if(v.source)v.source.onended=null;for(const node of [v.source,v.gain,v.pan])try{node?.disconnect();}catch{}voices.delete(v);}
  function stop(){for(const p of players.values())try{p.stop();}catch{}for(const v of [...voices]){try{v.source.stop();}catch{}release(v);}anchor=null;}
  function fail(error){stop();failed=true;try{onFailure(error);}catch{}}
  async function unlock(){
    try{
      if(!ctx){const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)throw new Error('Audio unavailable');ctx=new Audio();}
      if(ctx.state==='suspended')await ctx.resume();
      if(!master){
        let bus,compressor,music;
        try{
          bus=ctx.createGain();bus.gain.value=.75;
          if(ctx.createDynamicsCompressor){compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-16;compressor.ratio.value=6;compressor.connect(ctx.destination);bus.connect(compressor);}else bus.connect(ctx.destination);
          music=ctx.createGain();music.gain.value=.75;music.connect(bus);master=bus;musicBus=music;
        }catch(error){for(const node of [bus,compressor,music])try{node?.disconnect();}catch{}throw error;}
      }
      failed=false;
    }catch(error){fail(error);}
  }
  return {
    unlock(){if(!unlocking)unlocking=unlock().finally(()=>{unlocking=null;});return unlocking;},
    sync(tick,enabled,station='gunship'){
      if(!master||failed)return;
      try{
        if(active!==station){for(const p of players.values())p.stop();active=station;}
        if(!enabled){for(const p of players.values())p.stop();return;}
        if(!players.has(station)){
          const context={get currentTime(){return ctx.currentTime;},get state(){return ctx.state;},destination:musicBus,createBuffer:(...a)=>ctx.createBuffer(...a),createBufferSource:()=>ctx.createBufferSource()};
          players.set(station,createSoundtrackPlayer(context,makeScore(station)));
        }
        players.get(station).sync(tick,true);
      }catch(error){fail(error);}
    },
    event(event,enabled){
      if(!enabled||!master||ctx.state!=='running'||failed||voices.size>=24)return;
      const key=event.type==='fire'?event.weapon:event.type==='impact'?(event.heavy?'impact':null):event.type;
      if(!key||key==='round')return;
      const variant=(event.seed>>>0)%4,cacheKey=key+':'+variant,v={source:null,gain:null,pan:null};
      try{
        if(!cache.has(cacheKey)){const sound=makeEffect(key,variant),pcm=sound.renderAll(),b=ctx.createBuffer(1,pcm.length,48000);b.getChannelData(0).set(Float32Array.from(pcm,x=>x/32768));cache.set(cacheKey,b);}
        v.source=ctx.createBufferSource();v.source.buffer=cache.get(cacheKey);v.gain=ctx.createGain();
        const positioned=Number.isFinite(event.x)&&Number.isFinite(event.z);
        v.gain.gain.value=positioned?Math.max(.35,Math.min(1,.45+event.z/150)):1;
        if(ctx.createStereoPanner){v.pan=ctx.createStereoPanner();v.pan.pan.value=positioned?Math.max(-.8,Math.min(.8,event.x/60)):0;v.source.connect(v.pan);v.pan.connect(v.gain);}else v.source.connect(v.gain);
        v.gain.connect(master);v.source.onended=()=>release(v);voices.add(v);
        let when=ctx.currentTime+.012;
        if(Number.isSafeInteger(event.tick)){
          if(!anchor||event.tick<anchor.tick||Math.abs((event.tick-anchor.tick)/60-(ctx.currentTime-anchor.time))>.12)anchor={tick:event.tick,time:when};
          when=Math.max(ctx.currentTime,anchor.time+(event.tick-anchor.tick)/60);
        }
        v.source.start(when);
      }catch(error){if(v.source)try{v.source.stop();}catch{}release(v);fail(error);}
    },stop,
    musicWav:(station='gunship')=>makeScore(station).wav()
  };
}
