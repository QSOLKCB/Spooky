// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {create,step,selectWeapon,weaponStats} from '../js/sim.js';
import {launchShell,advanceShell,advanceParticles,burst,pushEnemy,moveHorde,FX_LIMITS} from '../js/physics.js';
import {SOLIDS} from '../js/world.js';
import {enemyBounds,aimFromScreen,blastOutline,unproject} from '../js/render.js';
function creature(kind='walker',x=0,z=45){return {id:1,kind,x,z,hp:500,maxHp:500,speed:0,phase:0,flash:0,kx:0,kz:0};}
function quiet(){const s=create();s.nextSpawn=100000;return s;}
test('VANILLAJS shell integration follows gravity and reaches the selected impact on its flight tick',()=>{
  for(const station of ['gunship','artillery'])for(const flight of [7,22,40,55]){
    const shot=launchShell({x:17,z:53,flight,remaining:flight},station),origin={...shot.position},velocity={...shot.velocity};
    advanceShell(shot);assert.ok(Math.abs(shot.position.x-origin.x-velocity.x/60)<1e-10);
    assert.ok(Math.abs(shot.position.y-(origin.y+velocity.y/60-shot.gravity/7200))<1e-10);
    for(let i=1;i<flight;i++){assert.ok(shot.position.y>=0);assert.equal(advanceShell(shot),i===flight-1);}
    assert.deepEqual(shot.position,{x:17,y:0,z:53});
  }
});
test('surviving targets receive radial impulse and heavy bodies resist displacement',()=>{
  const walker=creature('walker',1),brute=creature('brute',1);
  pushEnemy(walker,0,45,16);pushEnemy(brute,0,45,16);
  assert.ok(walker.kx>brute.kx);assert.ok(walker.stagger>brute.stagger);
  for(let i=0;i<20;i++){moveHorde([walker]);moveHorde([brute]);}
  assert.ok(walker.x>brute.x);assert.ok(walker.kx<2);
  const s=quiet();s.fuel=[];selectWeapon(s,2);const e=creature();s.enemies=[e];
  step(s,{x:0,z:45,fire:true});for(let i=0;i<40;i++)step(s);
  assert.ok(e.hp<500&&e.hp>0);assert.ok(e.z<45,'the actual impact pushes a survivor back');
});
test('crowds navigate building footprints without tunnelling or becoming stuck',()=>{
  for(const x of [-30,-26,-22,-12,25,28,31,38]){
    const e=creature('walker',x,4);e.speed=.06;
    for(let tick=0;tick<2000&&e.z<91;tick++){
      moveHorde([e]);for(const b of SOLIDS)assert.ok(!(e.x>b.min[0]-.6+1e-5&&e.x<b.max[0]+.6-1e-5&&e.z>b.min[2]-.6+1e-5&&e.z<b.max[2]+.6-1e-5),'body does not penetrate a solid');
    }
    assert.ok(e.z>=91,`lane ${x} can reach the wire`);
  }
  const a=creature('walker',0,40),b={...a,id:2};a.speed=b.speed=.06;moveHorde([a,b]);assert.ok(a.x<b.x,'coincident bodies separate deterministically');
});
test('fuel chains detonate each drum once and do not award extra kills or shot accuracy',()=>{
  const s=quiet();s.station='infantry';s.round=3;s.weapon='m2';
  step(s,{x:-12,z:43,fire:true});assert.equal(s.fuel.filter(b=>b.hp<=0).length,3);assert.equal(s.score,75);assert.equal(s.shots,1);assert.equal(s.hits,0);assert.equal(s.kills,0);
  assert.equal(s.events.filter(e=>e.weapon==='fuel').length,3);
  for(let i=0;i<7;i++)step(s,{x:-12,z:43,fire:true});assert.equal(s.score,75);
});
test('head picking yields a single-target critical hit for the direct-fire weapons',()=>{
  const s=quiet();s.station='infantry';s.round=3;s.weapon='m2';const a=creature(),b={...creature(),id:2,x:1};s.enemies=[a,b];
  const box=enemyBounds(s.station,a),aim=aimFromScreen(s,box.centerX,box.top+3);assert.equal(aim.head,true);
  step(s,{...aim,fire:true});assert.ok(a.hp<500-38);assert.equal(b.hp,500-38);
  const misses=quiet();misses.station='infantry';misses.weapon='m2';const far=creature();misses.enemies=[far];
  step(misses,{x:40,z:45,targetId:far.id,head:true,fire:true});assert.equal(far.hp,500,'target ID cannot bypass blast distance');
});
test('seeded debris bounces, settles and expires while presentation storage stays bounded',()=>{
  const a=quiet(),b=quiet();for(let i=0;i<70;i++){const event={x:0,z:45,radius:12,seed:i};burst(a,event);burst(b,event);}
  assert.deepEqual(a.particles,b.particles);assert.equal(a.particles.length,FX_LIMITS.particles);assert.equal(a.craters.length,FX_LIMITS.craters);
  a.particles=[{x:0,z:45,y:.01,vx:1,vz:2,vy:-10,size:1,age:0,life:20,bounce:0}];advanceParticles(a);
  assert.ok(a.particles[0].vy>0);assert.equal(a.particles[0].bounce,1);
  for(let i=0;i<21;i++)advanceParticles(a);assert.equal(a.particles.length,0);
});

function salvo(index,rank=0){
  const s=quiet();s.fuel=[];selectWeapon(s,index);s.upgrades.gunship.radius=rank;
  const targets=[0,10,20,28].map((x,i)=>({...creature('walker',x,55),id:i+1,hp:600,maxHp:600}));s.enemies=targets;
  const stats=weaponStats(s);step(s,{x:0,z:55,fire:true});for(let i=1;i<stats.flight;i++)step(s);
  return {s,targets,stats};
}
test('40 mm delivers the former heavy hit while 105 mm damages a much wider group',()=>{
  const medium=salvo(1),heavy=salvo(2);
  assert.equal(medium.targets[0].hp,465,'40 mm now inflicts the old 105 mm centre damage');
  assert.ok(medium.targets[1].hp<600,'40 mm hits across the old heavy radius');
  assert.equal(medium.targets[2].hp,600);assert.equal(medium.targets[3].hp,600);
  assert.equal(heavy.targets[0].hp,200);assert.ok(heavy.targets[2].hp<600,'105 mm reaches a target well outside 40 mm coverage');
  assert.equal(heavy.targets[3].hp,600,'105 mm still has a finite boundary');
  assert.ok(heavy.stats.radius**2>medium.stats.radius**2*5,'nominal affected area is more than five times larger');
  assert.equal(medium.s.shots,1);assert.equal(heavy.s.shots,1);assert.equal(heavy.s.hits,1);
  assert.ok(Math.abs(heavy.targets[0].kz)>Math.abs(medium.targets[0].kz),'large impact pushes survivors harder');
  assert.ok(heavy.s.effects.find(e=>e.type==='blast').life>medium.s.effects.find(e=>e.type==='blast').life);
  assert.ok(heavy.s.particles.length>=medium.s.particles.length*2);
});
test('blast outlines follow actual world-space coverage and remain finite at maximum rank',()=>{
  for(const index of [1,2]){
    const {stats}=salvo(index);const outline=blastOutline('gunship',0,55,stats.radius);
    for(const [x,y] of outline){const p=unproject('gunship',x,y);assert.ok(Math.abs(Math.hypot(p.x,p.z-55)-stats.radius)<1e-8);}
  }
  const upgraded=salvo(2,6);assert.ok(upgraded.stats.radius>50);assert.ok(upgraded.targets[3].hp<600);
  for(const station of ['gunship','artillery','infantry'])for(const x of [-52,0,52])for(const z of [4,55,96]){
    const points=blastOutline(station,x,z,upgraded.stats.radius);assert.ok(points.every(p=>p.every(Number.isFinite)));
    for(const [px,py] of points){const p=unproject(station,px,py);assert.ok(p.x>=-52&&p.x<=52&&p.z>=4&&p.z<=96);}
  }
});
