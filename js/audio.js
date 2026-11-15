// SPDX-License-Identifier: Apache-2.0
import {createSound2D} from '../vendor/vanillajs/modules/audio2d/index.js';
import {createSoundtrack} from '../vendor/vanillajs/modules/soundtrack/index.js';
import {createSoundtrackPlayer} from '../vendor/vanillajs/api/audio/index.js';
export function makeScore(){
  const roots=[65,65,78,58,65,87,78,58];
  return createSoundtrack({tickRate:60,phrases:roots.map((root,phrase)=>{
    const events=[];let id=1;
    const note=(channel,sample,duration,frequency,gain,wave,seed=0)=>events.push({id:id++,channel,sample,duration,frequency,gain,wave,seed});
    for(let beat=0;beat<8;beat++){
      note(0,beat*24000,19000,beat%4===3?root*2:root,1900,'triangle');
      note(1,beat*24000,beat%2?6000:9000,beat%2?160:45,beat%2?900:2500,beat%2?'noise':'triangle',phrase*99+beat);
      for(let off=0;off<2;off++)note(2,beat*24000+off*12000,1700,3000,off?280:450,'noise',beat+off+17);
      if(phrase>1&&beat%2===0)note(3,beat*24000+6000,16000,[root*4,root*6,root*5,root*3][beat/2],550,'triangle');
    }
    return {frames:192000,events};
  })});
}
export function makeEffect(type){
  const specs={gatling:[.11,82,6800],m2:[.13,70,7600],bofors:[.28,49,9000],howitzer:[.55,35,10000],battery:[.7,32,10500],
    impact:[.3,45,4300],breach:[.2,95,4500],clear:[.5,523,4000],reload:[.12,950,1700],hot:[.2,330,2400],lost:[.8,65,4000]};
  const [duration,freq,gain]=specs[type]||specs.impact,frames=Math.round(duration*48000),tone=['clear','hot','lost'].includes(type);
  return createSound2D({frames,events:[{id:1,sample:0,duration:frames,channel:0,frequency:freq,gain,wave:tone?'triangle':'noise',seed:13013},
    {id:2,sample:0,duration:Math.max(1,Math.floor(frames*.8)),channel:1,frequency:freq,gain:Math.floor(gain*.6),wave:'triangle'}]});
}
export function createAudio(onFailure=()=>{}){
  let ctx=null,player=null,failed=false;const cache=new Map(),voices=new Set();
  function stop(){try{player?.stop();}catch{}for(const v of voices){try{v.stop();v.disconnect();}catch{}}voices.clear();}
  function fail(error){stop();failed=true;onFailure(error);}
  return {
    async unlock(){
      try{
        if(!ctx){const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)throw new Error('Audio unavailable');ctx=new Audio();}
        if(ctx.state==='suspended')await ctx.resume();
        if(!player)player=createSoundtrackPlayer(ctx,makeScore());failed=false;
      }catch(error){fail(error);}
    },
    sync(tick,enabled){if(!player||failed)return;try{player.sync(tick,enabled);}catch(error){fail(error);}},
    event(event,enabled){
      if(!enabled||!ctx||ctx.state!=='running'||failed||voices.size>=20)return;
      const key=event.type==='fire'?event.weapon:event.type==='impact'?(event.heavy?'impact':null):event.type;
      if(!key||key==='round')return;
      try{
        if(!cache.has(key)){const sound=makeEffect(key),pcm=sound.renderAll(),b=ctx.createBuffer(1,pcm.length,48000);b.getChannelData(0).set(Float32Array.from(pcm,x=>x/32768));cache.set(key,b);}
        const v=ctx.createBufferSource();v.buffer=cache.get(key);v.connect(ctx.destination);v.onended=()=>{voices.delete(v);v.disconnect();};voices.add(v);v.start();
      }catch(error){fail(error);}
    },stop,
    musicWav:()=>makeScore().wav()
  };
}
