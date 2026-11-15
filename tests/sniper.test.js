// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {create,step,weaponStats,cancelInput,reload,chooseUpgrade} from '../js/sim.js';
import {hitboxes,rayBox,sightRay,traceShot,scopeZoom,RIFLE} from '../js/sniper.js';
import {project,aimFromScreen} from '../js/render.js';
import {FixedClock} from '../vendor/vanillajs/modules/time/index.js';
import {ENEMIES,stationForRound,upgradeForStation} from '../js/content.js';
const advance=(s,n,input={})=>{for(let i=0;i<n;i++)step(s,input);};
const fixture=()=>{const s=create();s.round=4;s.station='sniper';s.weapon='rifle';s.nextSpawn=100000;s.fuel=[];return s;};
function enemy(s,x=0,z=48,hp=100,kind='walker'){const e={id:s.nextId++,x,z,hp,maxHp:hp,kind,speed:0,phase:0,stride:0,flash:0};s.enemies.push(e);return e;}
function aim(e,part='head'){const b=hitboxes(e).find(b=>b.part===part),p=project('sniper',(b.min[0]+b.max[0])/2,(b.min[2]+b.max[2])/2,(b.min[1]+b.max[1])/2);return {sightX:p.x,sightY:p.y,scope:true};}
function shot(s,input){advance(s,9,input);step(s,{...input,fire:true});}
test('fourth station enters after M2 and returns to gunship with independent upgrades',()=>{
  assert.deepEqual(Array.from({length:8},(_,i)=>stationForRound(i+1).id),['gunship','artillery','infantry','sniper','gunship','artillery','infantry','sniper']);
  const s=fixture();s.status='upgrade';s.offers=['radius','cooling','rate'];assert.ok(chooseUpgrade(s,'radius'));assert.equal(s.station,'gunship');assert.equal(s.upgrades.sniper.radius,1);assert.equal(s.upgrades.gunship.radius,0);
});
test('copied ray slabs handle parallel axes, inside origins, misses and distance limits',()=>{
  const b={min:[-1,-1,2],max:[1,1,4]};assert.equal(rayBox([0,0,0],[0,0,1],b),2);assert.equal(rayBox([0,0,3],[0,0,1],b),0);
  assert.equal(rayBox([2,0,0],[0,0,1],b),null);assert.equal(rayBox([0,0,0],[0,0,1],b,1),null);
});
test('rendered voxel centers produce correct hit regions at all scales and animated poses',()=>{
  for(const kind of Object.keys(ENEMIES))for(const z of [15,45,85])for(const stride of [0,1,3]){
    const e={id:1,x:0,z,kind,hp:100,stride,vx:.08},a=aim(e),ray=sightRay(a.sightX,a.sightY),hit=traceShot(ray.origin,ray.direction,[e],[]);
    assert.equal(hit.hits.length,1);assert.equal(hit.hits[0].part,'head');
    assert.deepEqual(aimFromScreen({station:'sniper'},a.sightX,a.sightY).sightX,a.sightX);
  }
});
test('settled rifle headshots, body hits and off-body misses have no blast splash',()=>{
  const s=fixture(),head=enemy(s,0,48,1000),adjacent=enemy(s,4,48,1000);shot(s,aim(head));
  assert.equal(head.hp,500);assert.equal(adjacent.hp,1000);assert.equal(s.heads,1);assert.equal(s.quickscopes,1);assert.equal(s.hits,1);assert.equal(s.shots,1);
  assert.equal(s.effects.some(e=>e.type==='blast'),false);
  const t=fixture(),body=enemy(t,0,48,1000);shot(t,aim(body,'body'));assert.equal(body.hp,800);assert.equal(t.heads,0);
  const u=fixture();enemy(u);shot(u,{sightX:576,sightY:500,scope:true});assert.equal(u.hits,0);assert.equal(u.kills,0);
});
test('collaterals trace front to back once, attenuate damage and stop at the penetration limit',()=>{
  const s=fixture(),a=enemy(s,0,48,1000),b=enemy(s,0,45,1000),c=enemy(s,0,42,1000),d=enemy(s,0,39,1000);
  s.enemies.reverse();shot(s,aim(b));
  assert.equal(a.hp,500);assert.equal(b.hp,650);assert.ok(Math.abs(c.hp-755)<1e-8);assert.equal(d.hp,1000);
  assert.equal(s.hits,1);assert.equal(s.heads,3);assert.equal(s.shots,1);
  const t=fixture();const first=enemy(t,0,48),second=enemy(t,0,45),third=enemy(t,0,42);shot(t,aim(second));
  assert.equal(t.kills,3);assert.equal(t.resolved,3);assert.equal(t.collaterals,1);assert.equal(t.bestCollateral,3);assert.equal(t.hits,1);assert.equal(t.rifleConfirm.killed,3);
  advance(t,60);assert.equal(t.kills,3);
});
test('nearest cover stops every later target, including exact ties',()=>{
  const s=fixture(),e=enemy(s),a=aim(e),ray=sightRay(a.sightX,a.sightY);
  const wall={min:[-4,0,60],max:[4,30,65]};assert.equal(traceShot(ray.origin,ray.direction,[e],[wall]).hits.length,0);
  const point=traceShot(ray.origin,ray.direction,[e],[]).hits[0].point;
  assert.equal(traceShot(ray.origin,ray.direction,[e],[{min:[-4,0,point[2]-1],max:[4,30,point[2]]}]).hits.length,0);
  const blocked=fixture(),behind=enemy(blocked,28,35,1000);shot(blocked,aim(behind,'body'));assert.equal(behind.hp,1000,'east barracks occludes actual gameplay');
});
test('one trigger edge fires one round; bolt blocks early shots and accepts only a short late buffer',()=>{
  const s=fixture(),e=enemy(s,0,48,10000),a=aim(e);shot(s,a);advance(s,120,{...a,fire:true});assert.equal(s.shots,1);
  step(s,{...a,fire:false});step(s,{...a,fire:true});assert.equal(s.shots,2);
  step(s,{...a,fire:false});step(s,{...a,fire:true});advance(s,90,a);assert.equal(s.shots,2,'early bolt clicks do not queue');
  step(s,{...a,fire:true});assert.equal(s.shots,3);advance(s,weaponStats(s).interval-10,a);step(s,{...a,fire:true});advance(s,10,a);assert.equal(s.shots,4,'late shot buffered through bolt/ADS');
});
test('scope settles in nine ticks; release, pause and reload cancel buffered fire',()=>{
  const s=fixture(),e=enemy(s,0,48,10000),a=aim(e);step(s,{...a,fire:true});assert.equal(s.shots,0);advance(s,7,a);assert.equal(s.shots,0);step(s,a);assert.equal(s.shots,1);assert.equal(s.quickscopes,1);
  const t=fixture();step(t,{...a,fire:true});step(t,{scope:false});advance(t,10,a);assert.equal(t.shots,0);
  const u=fixture();step(u,{...a,fire:true});cancelInput(u);advance(u,20,a);assert.equal(u.shots,0);assert.equal(u.sniper.queued,0);
  const v=fixture();v.weapons.rifle.ammo=4;step(v,{...a,fire:true});reload(v);advance(v,160,a);assert.equal(v.shots,0);assert.equal(v.weapons.rifle.ammo,5);
  assert.equal(scopeZoom(v),RIFLE.zoom);cancelInput(v);assert.equal(scopeZoom(v),1);
});
test('manual and empty reload never shoot on completion without a new edge',()=>{
  const s=fixture(),e=enemy(s,0,48,10000),a=aim(e);s.weapons.rifle.ammo=0;shot(s,a);assert.ok(s.weapons.rifle.reload);advance(s,150,{...a,fire:true});assert.equal(s.shots,0);assert.equal(s.weapons.rifle.ammo,5);
  step(s,a);step(s,{...a,fire:true});advance(s,9,a);assert.equal(s.shots,1);
});
test('rifle upgrade cards modify useful mechanics and repeated streams retain full state',()=>{
  const s=fixture(),base=weaponStats(s);for(const id of ['damage','radius','rate','capacity','cooling']){s.upgrades.sniper[id]=1;assert.ok(upgradeForStation(id,'sniper').description);}
  const next=weaponStats(s);assert.equal(next.penetration,4);assert.equal(next.retention,.75);assert.ok(next.damage>base.damage&&next.interval<base.interval&&next.reload<base.reload&&next.magazine>base.magazine);assert.equal(next.radius,0);
  const a=fixture(),b=fixture();for(const t of [a,b]){enemy(t,0,48,10000);enemy(t,0,44,10000);}
  for(let tick=0;tick<2000;tick++){const input={...aim(a.enemies[0]||{x:0,z:48,kind:'walker'}),fire:tick%61===0,scope:tick%200<170,reload:tick%300===0};step(a,input);step(b,input);}assert.deepEqual(a,b);
});

test('rifle scope, queued shots, reloads and bolt events are independent of frame schedule',()=>{
  const run=hz=>{
    const s=fixture(),clock=new FixedClock({step:1/60,maxFrame:.15,maxSteps:8});enemy(s,0,48,100000);
    for(let frame=0;frame<hz*20;frame++)clock.advance(1/hz,()=>{const tick=s.tick;step(s,{...aim(s.enemies[0]),scope:tick%170<150,fire:tick%61===0,reload:tick%300===290});});
    return s;
  };
  const baseline=run(60);for(const hz of [30,120,144])assert.deepEqual(run(hz),baseline);
});
test('scope timing awards quick hits only inside the window and bolt events stay at their station',()=>{
  const s=fixture(),e=enemy(s,0,48,10000),a=aim(e);advance(s,40,a);step(s,{...a,fire:true});assert.equal(s.heads,1);assert.equal(s.quickscopes,0);
  let bolts=0;for(let i=0;i<54;i++){step(s,a);bolts+=s.events.filter(e=>e.type==='bolt').length;}assert.equal(bolts,1);
  step(s,{...a,fire:true});s.status='upgrade';s.offers=['damage'];chooseUpgrade(s,'damage');
  for(let i=0;i<54;i++){step(s);assert.ok(!s.events.some(e=>e.type==='bolt'),'departed rifle never emits gunship bolt audio');}
});
test('a building between aligned enemies allows the front hit and blocks rear collaterals',()=>{
  const s=fixture(),front=enemy(s,0,70),back=enemy(s,0,40),wall={min:[-4,0,50],max:[4,20,60]};
  const result=traceShot([0,7,80],[0,0,-1],[back,front],[wall]);assert.deepEqual(result.hits.map(h=>h.enemy.id),[front.id]);assert.equal(result.end.kind,'wall');assert.equal(result.end.distance,20);
});
