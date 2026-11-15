// SPDX-License-Identifier: Apache-2.0
import {explosionProfile} from './content.js';
import {createSound2D} from '../vendor/vanillajs/modules/audio2d/index.js';
import {createSoundtrack} from '../vendor/vanillajs/modules/soundtrack/index.js';
import {createSoundtrackPlayer} from '../vendor/vanillajs/api/audio/index.js';
const STATIONS=['gunship','artillery','infantry','sniper'];
// Last Light March: original 16-bar D-minor theme, 120 BPM, four integer PCM lanes.
// Tuples are [eighth-note onset, eighth-note length, frequency in integer Hz].
const MARCH_THEME = [
  [[0,2,294],[2,1,294],[3,1,349],[4,2,440],[6,2,392],[8,2,349],[10,1,330],[11,1,349],[12,3,294]],
  [[0,2,349],[2,1,392],[3,1,440],[4,3,523],[8,2,466],[10,2,440],[12,3,392]],
  [[0,2,440],[2,1,440],[3,1,523],[4,2,587],[6,2,523],[8,2,466],[10,1,440],[11,1,392],[12,3,349]],
  [[0,2,330],[2,2,349],[4,2,392],[6,2,330],[8,2,277],[10,2,330],[12,3,440]],
  [[0,2,587],[2,1,523],[3,1,440],[4,2,349],[6,2,440],[8,2,392],[10,1,349],[11,1,330],[12,3,294]],
  [[0,2,466],[2,1,440],[3,1,392],[4,3,349],[8,2,392],[10,2,440],[12,3,523]],
  [[0,2,440],[2,1,349],[3,1,440],[4,2,587],[6,2,659],[8,2,698],[10,1,659],[11,1,587],[12,2,554],[14,1,440]],
  [[0,2,392],[2,2,330],[4,2,277],[6,2,330],[8,2,440],[10,2,349],[12,4,294]]
];
export function makeScore(station='gunship'){
  if(!STATIONS.includes(station))throw new TypeError('Unknown soundtrack station');
  const arrangement=STATIONS.indexOf(station),beat=24000,eighth=12000;
  const roots=[147,175,175,110,147,117,147,110],fifths=[220,262,262,165,220,175,220,165];
  return createSoundtrack({tickRate:60,phrases:MARCH_THEME.map((melody,phrase)=>{
    const events=[];let id=1;
    const note=(channel,sample,duration,frequency,gain,wave,seed=0)=>events.push({id:id++,channel,sample,duration,frequency,gain,wave,seed});
    // Bass drum downbeats alternate with a short pitched marching-bass response.
    for(let b=0;b<8;b++){
      note(0,b*beat,8500,station==='artillery'?38:46,b%2===0?3300:2100,'triangle');
      note(0,b*beat+eighth,9500,b%2?fifths[phrase]:roots[phrase],station==='gunship'?1050:1500,'triangle');
      // A field snare with quiet ghost strokes and accented backbeats.
      const hit=b*beat;note(1,hit,b===7?2300:station==='artillery'?4300:3000,1800,b%2?1900:900,'noise',13013+phrase*131+b*17+arrangement*997);
      if(b===7){
        // The turnaround roll ends before the next phrase's downbeat.
        for(let roll=1;roll<8;roll++)note(1,hit+roll*3000,2300,2200,650+roll*130,'noise',phaseSeed(phrase,roll,arrangement));
      }else if(station==='infantry'||b===3||b===6){
        note(1,hit+12000,2200,2200,station==='infantry'?850:500,'noise',phaseSeed(phrase,b,arrangement));
        if(station==='infantry'&&b%2)note(1,hit+18000,1800,2400,550,'noise',phaseSeed(phrase,b+8,arrangement));
      }
    }
    for(const [onset,length,pitch] of melody){
      const sample=onset*eighth,duration=length*eighth-1400;
      // Saw/square fundamentals plus a quieter horn harmony make a brass-like call.
      const lead=station==='gunship'?Math.round(pitch/2):station==='sniper'?pitch*2:pitch;
      note(2,sample,duration,lead,station==='sniper'?950:station==='infantry'?1500:1250,station==='sniper'?'triangle':station==='artillery'?'saw':'square');
      const harmony=phrase===7&&onset===12?147:(onset<8?roots[phrase]:fifths[phrase]);
      note(3,sample+400,Math.max(1,duration-800),station==='infantry'?harmony*2:harmony,650,'triangle');
    }
    return {frames:192000,events};
  })});
}
function phaseSeed(phrase,stroke,arrangement){return (47047+phrase*65537+stroke*977+arrangement*1597)>>>0;}
export function makeEffect(type,variant=0){
  const specs={gatling:[.18,82,6800],m2:[.23,70,7600],rifle:[.7,58,9800],bolt:[.3,800,2400],bofors:[.46,49,9000],howitzer:[1.35,32,10500],battery:[.95,32,10500],
    impact:[.85,43,7700],impact105:[1.8,30,10000],breach:[.3,95,4500],clear:[.65,523,4000],reload:[.26,950,2300],hot:[.25,330,2400],lost:[.9,65,4000]};
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
    if(type==='reload'||type==='bolt'){events.length=0;add(0,0,2800,1600+v*80,2500,'noise');add(0,6000,4000,850,3500,'noise');add(1,6100,1900,410,1100,'square');}
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
      const key=event.type==='fire'?event.weapon:event.type==='impact'?(event.heavy?explosionProfile(event.weapon,6).sound:null):event.type;
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
