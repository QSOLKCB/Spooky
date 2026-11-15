// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {makeScore,makeEffect,createAudio} from '../js/audio.js';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('original 32-second score is deterministic, non-silent and wraps at exact ticks',()=>{
  const a=makeScore(),b=makeScore();assert.equal(a.frames,32*48000);assert.equal(a.loopTicks,1920);
  const x=a.renderPhrase(3),y=b.renderPhrase(3);assert.equal(hash(x),hash(y));assert.ok(x.some(n=>n!==0));assert.deepEqual(a.position(1920),a.position(0));
  assert.notEqual(hash(a.renderPhrase(0)),hash(a.renderPhrase(2)));
});
test('every station has distinct deterministic sound effects and valid WAV output',()=>{
  const hashes=new Set();for(const type of ['gatling','bofors','howitzer','battery','m2']){const sound=makeEffect(type),wav=sound.wav();hashes.add(hash(wav));assert.equal(Buffer.from(wav.subarray(0,4)).toString(),'RIFF');assert.equal(wav.length,44+sound.frames*2);assert.equal(hash(wav),hash(makeEffect(type).wav()));}assert.equal(hashes.size,5);
});
test('missing audio device is contained and never escapes into combat',async()=>{
  const before=globalThis.AudioContext;try{globalThis.AudioContext=class{constructor(){throw new Error('device absent');}};let errors=0;const player=createAudio(()=>errors++);await player.unlock();player.event({type:'fire',weapon:'m2'},true);player.sync(200,true);player.stop();assert.equal(errors,1);}finally{globalThis.AudioContext=before;}
});
test('all three complete station arrangements export distinct repeatable loops',()=>{
  const hashes=new Set();for(const station of ['gunship','artillery','infantry']){
    const a=makeScore(station),b=makeScore(station);assert.equal(a.frames,1536000);assert.equal(a.loopTicks,1920);
    const wav=a.wav();assert.equal(wav.length,44+a.frames*2);assert.equal(hash(wav),hash(b.wav()));hashes.add(hash(wav));
  }assert.equal(hashes.size,3);assert.throws(()=>makeScore('__proto__'));
  for(const type of ['m2','impact','battery']){const variants=new Set();for(let i=0;i<4;i++){variants.add(hash(makeEffect(type,i).wav()));assert.equal(hash(makeEffect(type,i).wav()),hash(makeEffect(type,i+4).wav()));}assert.equal(variants.size,4);}
});
class AudioMock{
  static latest;
  constructor(){AudioMock.latest=this;this.state='running';this.currentTime=0;this.destination={};this.nodes=[];this.buffers=0;this.failGain=false;}
  createBuffer(ch,n){this.buffers++;const data=new Float32Array(n);return {length:n,getChannelData:()=>data};}
  node(type){const n={type,connected:false,stopped:false,started:null,gain:{value:1},pan:{value:0},connect(){this.connected=true;},disconnect(){this.connected=false;},start(...args){this.started=args;},stop(){this.stopped=true;}};this.nodes.push(n);return n;}
  createBufferSource(){return this.node('source');}
  createGain(){if(this.failGain)throw new Error('gain unavailable');return this.node('gain');}
  createStereoPanner(){return this.node('pan');}
}
test('spatial effects preserve tick spacing, remain bounded and survive music being disabled',async()=>{
  const previous=globalThis.AudioContext;globalThis.AudioContext=AudioMock;
  try{
    const audio=createAudio();await audio.unlock();const ctx=AudioMock.latest;
    audio.event({type:'fire',weapon:'m2',x:-40,z:30,tick:100},true);
    audio.event({type:'fire',weapon:'m2',x:40,z:80,tick:106},true);
    const pans=ctx.nodes.filter(n=>n.type==='pan');assert.ok(pans[0].pan.value<0&&pans[1].pan.value>0);
    const sources=ctx.nodes.filter(n=>n.type==='source');assert.ok(Math.abs(sources[1].started[0]-sources[0].started[0]-.1)<1e-10);
    audio.sync(106,false,'infantry');assert.ok(sources.every(n=>!n.stopped),'muted music leaves FX playing');
    for(let i=0;i<80;i++)audio.event({type:'fire',weapon:'m2',seed:i},true);
    assert.equal(ctx.nodes.filter(n=>n.type==='source').length,24);assert.equal(ctx.buffers,4);
    audio.stop();assert.ok(ctx.nodes.filter(n=>n.type==='source').every(n=>n.stopped&&!n.connected));assert.ok(ctx.nodes.filter(n=>n.type==='pan').every(n=>!n.connected));
    audio.sync(100,true,'gunship');const first=ctx.nodes.filter(n=>n.type==='source').at(-1);assert.ok(!first.stopped);
    audio.sync(100,true,'artillery');assert.ok(first.stopped);audio.stop();
  }finally{globalThis.AudioContext=previous;}
});
test('partial voice failures release allocated nodes and a new gesture recovers audio',async()=>{
  const previous=globalThis.AudioContext;globalThis.AudioContext=AudioMock;
  try{
    let failures=0;const audio=createAudio(()=>failures++);await audio.unlock();const ctx=AudioMock.latest;ctx.failGain=true;
    audio.event({type:'fire',weapon:'m2'},true);assert.equal(failures,1);
    assert.ok(ctx.nodes.filter(n=>n.type==='source').every(n=>n.stopped&&!n.connected));
    ctx.failGain=false;await audio.unlock();audio.event({type:'fire',weapon:'m2'},true);assert.ok(ctx.nodes.filter(n=>n.type==='source').at(-1).started);audio.stop();
  }finally{globalThis.AudioContext=previous;}
});

test('105 mm firing and impact have longer distinct reports, selected by real combat events',async()=>{
  const {create,selectWeapon,step,weaponStats}=await import('../js/sim.js');
  assert.ok(makeEffect('howitzer').frames>makeEffect('bofors').frames*2);
  assert.ok(makeEffect('impact105').frames>makeEffect('impact').frames*2);
  for(let variant=0;variant<4;variant++)assert.equal(hash(makeEffect('impact105',variant).wav()),hash(makeEffect('impact105',variant).wav()));
  const previous=globalThis.AudioContext;globalThis.AudioContext=AudioMock;
  try{
    const audio=createAudio();await audio.unlock();const ctx=AudioMock.latest,lengths=[];
    for(const index of [1,2]){
      const s=create();s.fuel=[];s.nextSpawn=100000;selectWeapon(s,index);step(s,{fire:true,x:0,z:55});
      for(let i=1;i<weaponStats(s).flight;i++)step(s);
      const impact=s.events.find(e=>e.type==='impact');assert.ok(impact);audio.event(impact,true);
      lengths.push(ctx.nodes.filter(n=>n.type==='source').at(-1).buffer.length);audio.stop();
    }
    assert.ok(lengths[1]>lengths[0]*2,'audio adapter uses the 105 mm impact recipe');
  }finally{globalThis.AudioContext=previous;}
});

test('military march has four bounded lanes, a 120 BPM drum cadence and a phrase-ending snare roll',()=>{
  for(const station of ['gunship','artillery','infantry']){
    const score=makeScore(station);assert.equal(score.phraseCount,8);
    for(let phrase=0;phrase<8;phrase++){
      const {frames,events}=score.score(phrase);assert.equal(frames,192000);assert.ok(events.length<=128);
      assert.deepEqual([...new Set(events.map(e=>e.channel))].sort(),[0,1,2,3]);
      for(let beat=0;beat<8;beat++){
        assert.ok(events.some(e=>e.channel===0&&e.sample===beat*24000&&e.frequency<60),'marching bass drum downbeat');
        assert.ok(events.some(e=>e.channel===1&&e.sample===beat*24000&&e.wave==='noise'),'snare cadence');
      }
      const roll=events.filter(e=>e.channel===1&&e.sample>=168000);assert.equal(roll.length,8);
      assert.ok(events.some(e=>e.channel===2&&['square','saw'].includes(e.wave)),'brass lead');
      assert.ok(events.every(e=>e.sample+e.duration<=frames));
    }
  }
});
test('march PCM is identical across arbitrary phrase chunks and resumes at its exact tick offset',async()=>{
  for(const station of ['gunship','artillery','infantry']){
    const score=makeScore(station),start=190731,count=201337,whole=score.renderRange(start,count),chunked=new Int16Array(count);
    for(let offset=0;offset<count;){const size=Math.min([137,4096,17001][offset%3],count-offset);chunked.set(score.renderRange(start+offset,size),offset);offset+=size;}
    assert.deepEqual(chunked,whole);assert.deepEqual(score.renderRange(241*800,1600),score.renderPhrase(1).subarray(800,2400));
  }
  const previous=globalThis.AudioContext;globalThis.AudioContext=AudioMock;
  try{
    const audio=createAudio();await audio.unlock();const ctx=AudioMock.latest;
    for(let retry=0;retry<2;retry++){audio.sync(241,true,'infantry');const voice=ctx.nodes.filter(n=>n.type==='source').at(-1);assert.equal(voice.started[1],800/48000);audio.stop();assert.ok(voice.stopped);}
  }finally{globalThis.AudioContext=previous;}
});
