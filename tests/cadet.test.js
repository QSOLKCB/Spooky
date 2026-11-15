// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {create,step,chooseUpgrade,waveSize} from '../js/sim.js';
import {hitboxes} from '../js/sniper.js';
import {project,aimFromScreen} from '../js/render.js';
function sniper(difficulty='cadet',round=4){
  const s=create({difficulty});
  while(s.round<round){s.status='upgrade';s.offers=['repair'];chooseUpgrade(s,'repair');}
  return s;
}
test('Cadet has smaller, strictly growing waves and the first sniper wave has 20 targets',()=>{
  assert.deepEqual([1,2,3,4].map(r=>waveSize(r,'cadet')),[11,14,17,20]);
  assert.equal(sniper().total,20);assert.equal(sniper('night').total,45);assert.equal(sniper('blackout').total,45);
  for(let round=1;round<=100;round++){
    const old=17+7*round+Math.floor((round-1)/4)*5;
    assert.equal(waveSize(round,'night'),old);assert.equal(waveSize(round,'blackout'),old);
    assert.ok(waveSize(round,'cadet')<old);assert.ok(waveSize(round+1,'cadet')>waveSize(round,'cadet'));
  }
});
test('Cadet sniper arrivals are spaced and capped without losing queued enemies',()=>{
  for(const [round,limit] of [[4,4],[8,5],[12,6],[24,8]]){
    const s=sniper('cadet',round),arrivals=[];let previous=0;
    // Freeze targets only to isolate spawn admission from movement/breaches.
    for(let t=0;t<2200;t++){step(s);s.enemies.forEach(e=>e.speed=0);if(s.spawned!==previous){arrivals.push(s.tick);previous=s.spawned;}assert.ok(s.enemies.length<=limit);}
    assert.equal(s.spawned,limit);assert.equal(s.enemies.length,limit);assert.equal(s.resolved,0);assert.equal(s.status,'playing');
    if(round===4){assert.equal(arrivals[0],150);for(let i=1;i<arrivals.length;i++)assert.ok(arrivals[i]-arrivals[i-1]>=100);}
    const next=s.nextSpawn;for(let t=0;t<300;t++)step(s);assert.equal(s.nextSpawn,next,'no countdown backlog while full');
    s.enemies[0].hp=0;s.resolved++;for(let t=0;t<200;t++)step(s);assert.equal(s.spawned,limit+1);assert.equal(s.enemies.length,limit);
    assert.equal(s.total,waveSize(round,'cadet'),'remaining wave members stay scheduled');
  }
  const night=sniper('night');for(let t=0;t<600;t++){step(night);night.enemies.forEach(e=>e.speed=0);}assert.ok(night.enemies.length>4,'Night watch keeps its original pressure');
});
test('Cadet permits deliberate rifle play, reloads and missed shots across multiple seeds',()=>{
  const outcomes=[];
  for(const seed of [9,47,13013,2026]){
    const s=sniper();s.seed=seed;let attempts=0,peak=0;
    // One attempt every 2.5 seconds, every fourth attempt deliberately misses.
    for(let t=0;t<20000&&s.status==='playing';t++){
      const target=s.enemies.reduce((a,b)=>!a||b.z>a.z?b:a,null);let point={x:50,y:600};
      const fire=Boolean(target)&&t%150===0;if(fire)attempts++;
      if(target&&attempts%4!==0){const b=hitboxes(target)[0];point=project('sniper',target.x,target.z,(b.min[1]+b.max[1])/2);}
      step(s,{...aimFromScreen(s,point.x,point.y),scope:true,fire});peak=Math.max(peak,s.enemies.length);
    }
    assert.equal(s.status,'upgrade',`seed ${seed} clears`);assert.equal(s.resolved,20);assert.ok(s.hp>=60,`seed ${seed}: ${s.hp} integrity`);assert.ok(peak<=4);assert.ok(s.shots>s.hits,'misses really occurred');assert.ok(s.shots>5,'magazine changes were required');
    outcomes.push({seed,hp:s.hp,kills:s.kills,shots:s.shots,peak,ticks:s.roundTick});
  }
  console.log('Cadet deliberate-play evidence:',JSON.stringify(outcomes));
});
