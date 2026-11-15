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
