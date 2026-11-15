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
  createBuffer(ch,n){this.buffers++;const data=new Float32Array(n);return {getChannelData:()=>data};}
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
